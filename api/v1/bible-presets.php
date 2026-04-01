<?php
/**
 * B1G Timer - Bible Presets API
 *
 * Routes:
 *   GET    /api/v1/bible-presets?room={id}   - List presets for a room
 *   POST   /api/v1/bible-presets             - Create a preset
 *   PUT    /api/v1/bible-presets/{id}        - Update a preset
 *   PUT    /api/v1/bible-presets/reorder     - Bulk reorder presets
 *   DELETE /api/v1/bible-presets/{id}        - Delete a preset
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';

setJsonHeader();

// Ensure table exists
function ensureBiblePresetsTable($pdo) {
    static $checked = false;
    if ($checked) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS `bible_presets` (
        `id`          INT AUTO_INCREMENT PRIMARY KEY,
        `room_id`     INT NOT NULL,
        `label`       VARCHAR(200) NOT NULL,
        `book`        VARCHAR(50) NOT NULL,
        `chapter`     INT NOT NULL,
        `verse_start` INT NOT NULL,
        `verse_end`   INT NULL DEFAULT NULL,
        `version`     VARCHAR(10) NOT NULL DEFAULT 'ESV',
        `position`    INT NOT NULL DEFAULT 0,
        `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $checked = true;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $parts  = array_values(array_filter(explode('/', $path)));

    // Find ID after "bible-presets"
    $preset_id = null;
    $is_reorder = false;
    $found = false;
    foreach ($parts as $i => $seg) {
        if ($seg === 'bible-presets') {
            $found = true;
            if (isset($parts[$i + 1])) {
                if ($parts[$i + 1] === 'reorder') {
                    $is_reorder = true;
                } elseif (is_numeric($parts[$i + 1])) {
                    $preset_id = (int)$parts[$i + 1];
                }
            }
            break;
        }
    }

    $pdo = getPDOInstance();
    ensureBiblePresetsTable($pdo);

    switch ($method) {
        case 'GET':
            handleGetPresets($pdo);
            break;
        case 'POST':
            handleCreatePreset($pdo);
            break;
        case 'PUT':
            if ($is_reorder) {
                handleReorderPresets($pdo);
            } elseif ($preset_id) {
                handleUpdatePreset($pdo, $preset_id);
            } else {
                sendError(ERROR_INVALID_INPUT, 'PUT requires a preset ID or /reorder', HTTP_BAD_REQUEST);
            }
            break;
        case 'DELETE':
            if ($preset_id) {
                handleDeletePreset($pdo, $preset_id);
            } else {
                sendError(ERROR_INVALID_INPUT, 'DELETE requires a preset ID', HTTP_BAD_REQUEST);
            }
            break;
        default:
            sendError(ERROR_INVALID_INPUT, "Method '$method' not supported", HTTP_METHOD_NOT_ALLOWED);
    }
} catch (Exception $e) {
    sendDatabaseError('bible presets', $e);
}

function handleGetPresets($pdo) {
    $roomId = isset($_GET['room']) ? (int)$_GET['room'] : null;
    if (!$roomId) {
        sendError(ERROR_INVALID_INPUT, 'room query parameter is required', HTTP_BAD_REQUEST);
    }
    $stmt = $pdo->prepare('SELECT * FROM bible_presets WHERE room_id = ? ORDER BY position ASC, id ASC');
    $stmt->execute([$roomId]);
    sendSuccess($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function handleCreatePreset($pdo) {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) sendError(ERROR_INVALID_INPUT, 'Invalid JSON body', HTTP_BAD_REQUEST);

    $required = ['room_id', 'label', 'book', 'chapter', 'verse_start'];
    foreach ($required as $field) {
        if (empty($body[$field]) && $body[$field] !== 0) {
            sendError(ERROR_INVALID_INPUT, "Missing required field: $field", HTTP_BAD_REQUEST);
        }
    }

    // Get next position
    $posStmt = $pdo->prepare('SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM bible_presets WHERE room_id = ?');
    $posStmt->execute([(int)$body['room_id']]);
    $nextPos = $posStmt->fetch(PDO::FETCH_ASSOC)['next_pos'];

    $stmt = $pdo->prepare('INSERT INTO bible_presets (room_id, label, book, chapter, verse_start, verse_end, version, position)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        (int)$body['room_id'],
        substr(trim($body['label']), 0, 200),
        substr(trim($body['book']), 0, 50),
        (int)$body['chapter'],
        (int)$body['verse_start'],
        isset($body['verse_end']) ? (int)$body['verse_end'] : null,
        substr(trim($body['version'] ?? 'ESV'), 0, 10),
        $nextPos
    ]);

    $id = $pdo->lastInsertId();
    $fetch = $pdo->prepare('SELECT * FROM bible_presets WHERE id = ?');
    $fetch->execute([$id]);
    sendSuccess($fetch->fetch(PDO::FETCH_ASSOC), HTTP_CREATED);
}

function handleUpdatePreset($pdo, $id) {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) sendError(ERROR_INVALID_INPUT, 'Invalid JSON body', HTTP_BAD_REQUEST);

    // Check exists
    $check = $pdo->prepare('SELECT id FROM bible_presets WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch()) sendNotFound('Preset', $id);

    $fields = [];
    $values = [];
    $allowed = ['label', 'book', 'chapter', 'verse_start', 'verse_end', 'version', 'position'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "$f = ?";
            $values[] = $body[$f];
        }
    }
    if (empty($fields)) sendError(ERROR_INVALID_INPUT, 'No fields to update', HTTP_BAD_REQUEST);

    $values[] = $id;
    $pdo->prepare('UPDATE bible_presets SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

    $fetch = $pdo->prepare('SELECT * FROM bible_presets WHERE id = ?');
    $fetch->execute([$id]);
    sendSuccess($fetch->fetch(PDO::FETCH_ASSOC));
}

function handleReorderPresets($pdo) {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !isset($body['items']) || !is_array($body['items'])) {
        sendError(ERROR_INVALID_INPUT, 'Expected { items: [{id, position}, ...] }', HTTP_BAD_REQUEST);
    }

    $stmt = $pdo->prepare('UPDATE bible_presets SET position = ? WHERE id = ?');
    foreach ($body['items'] as $item) {
        if (isset($item['id'], $item['position'])) {
            $stmt->execute([(int)$item['position'], (int)$item['id']]);
        }
    }
    sendSuccess(['reordered' => count($body['items'])]);
}

function handleDeletePreset($pdo, $id) {
    $check = $pdo->prepare('SELECT id FROM bible_presets WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch()) sendNotFound('Preset', $id);

    $pdo->prepare('DELETE FROM bible_presets WHERE id = ?')->execute([$id]);
    sendSuccess(['deleted' => true, 'id' => $id]);
}

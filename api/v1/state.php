<?php
/**
 * B1G Timer - Live Timer State Endpoint
 *
 * GET /api/v1/state?room={id}
 *   Returns the most recently saved live timer state for a room.
 *   Used by Stage Display to sync on load (cross-browser / cross-device).
 *
 * State is written by broadcast.php whenever a timer event is broadcast.
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

setJsonHeader();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('METHOD_NOT_ALLOWED', 'Only GET is allowed', 405);
}

$room_id = isset($_GET['room']) ? (int)$_GET['room'] : 0;
if (!$room_id) {
    sendError('INVALID_INPUT', 'room parameter is required', 400);
}

try {
    $pdo = getPDOInstance();

    // Create table if it doesn't exist yet (first run)
    $pdo->exec("CREATE TABLE IF NOT EXISTS `timer_live_state` (
        `room_id`            INT          PRIMARY KEY,
        `is_running`         TINYINT(1)   NOT NULL DEFAULT 0,
        `deadline_timestamp` BIGINT       NULL     DEFAULT NULL,
        `remaining_seconds`  INT          NULL     DEFAULT NULL,
        `timer_index`        SMALLINT     NULL     DEFAULT NULL,
        `timer_title`        VARCHAR(100) NULL     DEFAULT NULL,
        `action`             VARCHAR(30)  NULL     DEFAULT NULL,
        `state_json`         TEXT         NOT NULL,
        `stage_style_json`   TEXT         NULL     DEFAULT NULL,
        `updated_at`         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Migrate old schema if needed
    try {
        $pdo->exec("ALTER TABLE `timer_live_state`
            ADD COLUMN IF NOT EXISTS `is_running`         TINYINT(1)   NOT NULL DEFAULT 0 AFTER `room_id`,
            ADD COLUMN IF NOT EXISTS `deadline_timestamp` BIGINT       NULL     DEFAULT NULL AFTER `is_running`,
            ADD COLUMN IF NOT EXISTS `remaining_seconds`  INT          NULL     DEFAULT NULL AFTER `deadline_timestamp`,
            ADD COLUMN IF NOT EXISTS `timer_index`        SMALLINT     NULL     DEFAULT NULL AFTER `remaining_seconds`,
            ADD COLUMN IF NOT EXISTS `timer_title`        VARCHAR(100) NULL     DEFAULT NULL AFTER `timer_index`,
            ADD COLUMN IF NOT EXISTS `action`             VARCHAR(30)  NULL     DEFAULT NULL AFTER `timer_title`,
            ADD COLUMN IF NOT EXISTS `stage_style_json`   TEXT         NULL     DEFAULT NULL AFTER `state_json`");
    } catch (Exception $e) { /* columns already present */ }

    // Migrate: ensure message_json column exists
    try {
        $pdo->exec("ALTER TABLE `timer_live_state`
            ADD COLUMN IF NOT EXISTS `message_json` TEXT NULL DEFAULT NULL AFTER `stage_style_json`");
    } catch (Exception $e) { /* column already exists */ }

    $stmt = $pdo->prepare('SELECT * FROM timer_live_state WHERE room_id = ?');
    $stmt->execute([$room_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        // Prefer returning explicit columns when available (new schema)
        $response = [];
        if (isset($row['deadline_timestamp']) && $row['deadline_timestamp']) {
            $response['deadlineTimestamp'] = (int)$row['deadline_timestamp'];
        }
        $response['isRunning'] = isset($row['is_running']) ? (bool)$row['is_running'] : null;
        $response['remainingSeconds'] = isset($row['remaining_seconds']) ? ($row['remaining_seconds'] === null ? null : (int)$row['remaining_seconds']) : null;
        $response['timerIndex'] = isset($row['timer_index']) ? ($row['timer_index'] === null ? null : (int)$row['timer_index']) : null;
        $response['timerTitle'] = isset($row['timer_title']) ? $row['timer_title'] : null;

        // Fallback to state_json for backward compatibility
        $decoded = json_decode($row['state_json'], true) ?: [];
        $response = array_merge($decoded, $response);

        // Include stage style if stored
        if (!empty($row['stage_style_json'])) {
            $style = json_decode($row['stage_style_json'], true);
            if ($style) {
                $response['stageStyle'] = $style;
            }
        }

        // Include active message if stored
        if (!empty($row['message_json'])) {
            $msg = json_decode($row['message_json'], true);
            if ($msg) {
                $response['activeMessage'] = $msg;
            }
        }

        // Metadata
        $response['serverTime'] = time();
        $response['serverTimeISO'] = gmdate('Y-m-d\TH:i:s\Z');
        $response['stateUpdatedAt'] = $row['updated_at'];

        sendSuccess($response);
    } else {
        sendSuccess(null);
    }

} catch (Exception $e) {
    sendDatabaseError('fetch live state', $e);
}
?>

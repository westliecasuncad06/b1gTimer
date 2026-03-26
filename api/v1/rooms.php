<?php
/**
 * B1G Timer - Room Management API Endpoints
 * 
 * Routes:
 *   GET  /api/v1/rooms          - List all rooms
 *   GET  /api/v1/rooms/{id}     - Get single room with timers
 *   POST /api/v1/rooms          - Create new room
 *   PUT  /api/v1/rooms/{id}     - Update room and timers
 *   DELETE /api/v1/rooms/{id}   - Delete room
 * 
 * Phase 2 Tasks: 2.1, 2.2, 2.3, 2.4, 2.5
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';
require_once dirname(__DIR__) . '/middleware/validate.php';

// Enable error reporting for debugging
if (defined('APP_DEBUG') && APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Set JSON content type
setJsonHeader();

try {
    // Parse request method and path
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $parts = array_filter(explode('/', $path));
    
    // Extract room ID if present (last part of path)
    $room_id = null;
    if (end($parts) !== 'rooms') {
        $room_id = end($parts);
        // Validate room_id is numeric
        if (!is_numeric($room_id)) {
            sendError(
                ERROR_INVALID_INPUT,
                'Invalid room ID format. Must be numeric.',
                HTTP_BAD_REQUEST
            );
        }
        $room_id = (int)$room_id;
    }
    
    // Route to appropriate handler
    switch ($method) {
        case 'GET':
            if ($room_id === null) {
                handleGetRooms();
            } else {
                handleGetRoomDetail($room_id);
            }
            break;
            
        case 'POST':
            if ($room_id === null) {
                handleCreateRoom();
            } else {
                sendError(
                    ERROR_INVALID_INPUT,
                    'POST to /api/v1/rooms/{id} is not allowed. Use PUT to update.',
                    HTTP_BAD_REQUEST
                );
            }
            break;
            
        case 'PUT':
            if ($room_id === null) {
                sendError(
                    ERROR_INVALID_INPUT,
                    'PUT requires a room ID: /api/v1/rooms/{id}',
                    HTTP_BAD_REQUEST
                );
            } else {
                handleUpdateRoom($room_id);
            }
            break;
            
        case 'DELETE':
            if ($room_id === null) {
                sendError(
                    ERROR_INVALID_INPUT,
                    'DELETE requires a room ID: /api/v1/rooms/{id}',
                    HTTP_BAD_REQUEST
                );
            } else {
                handleDeleteRoom($room_id);
            }
            break;
            
        default:
            sendError(
                ERROR_INVALID_INPUT,
                "HTTP method '{$method}' is not supported.",
                HTTP_METHOD_NOT_ALLOWED
            );
    }
    
} catch (Exception $e) {
    // Catch all unexpected errors
    sendDatabaseError('request processing', $e);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Ensure the dashboard_name column exists on timer_rooms table
 */
function ensureDashboardNameColumn($pdo) {
    static $checked = false;
    if ($checked) return;
    try {
        $pdo->exec("ALTER TABLE timer_rooms ADD COLUMN IF NOT EXISTS dashboard_name VARCHAR(100) NULL DEFAULT NULL AFTER name");
    } catch (Exception $e) { /* column already exists */ }
    $checked = true;
}

// ============================================================================
// HANDLER FUNCTIONS
// ============================================================================

/**
 * Task 2.1: GET /api/v1/rooms
 * Fetch all rooms, sorted by created_at DESC
 * 
 * Response: { success: true, data: [ {...}, ... ], timestamp, requestId }
 */
function handleGetRooms() {
    try {
        $pdo = getPDOInstance();
        ensureDashboardNameColumn($pdo);
        $query = 'SELECT id, name, dashboard_name, created_at, updated_at FROM timer_rooms ORDER BY created_at DESC';
        
        $stmt = $pdo->prepare($query);
        $stmt->execute();
        $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        sendSuccess($rooms ?? []);
        
    } catch (PDOException $e) {
        sendDatabaseError('fetch all rooms', $e);
    }
}

/**
 * Task 2.2: GET /api/v1/rooms/{id}
 * Fetch single room with all its timers
 * 
 * Response: { success: true, data: { id, name, timers: [...], created_at, updated_at }, ... }
 */
function handleGetRoomDetail($room_id) {
    try {
        $pdo = getPDOInstance();
        
        ensureDashboardNameColumn($pdo);
        // Fetch room
        $room_query = 'SELECT id, name, dashboard_name, created_at, updated_at FROM timer_rooms WHERE id = ?';
        $room_stmt = $pdo->prepare($room_query);
        $room_stmt->execute([$room_id]);
        $room = $room_stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$room) {
            sendNotFound('Room', $room_id);
        }
        
        // Fetch timers for this room
        $timers_query = 'SELECT id, title, duration_seconds, position FROM timer_items WHERE room_id = ? ORDER BY position ASC';
        $timers_stmt = $pdo->prepare($timers_query);
        $timers_stmt->execute([$room_id]);
        $timers = $timers_stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Attach timers to room
        $room['timers'] = $timers ?? [];
        
        sendSuccess($room);
        
    } catch (PDOException $e) {
        sendDatabaseError('fetch room detail', $e);
    }
}

/**
 * Task 2.3: POST /api/v1/rooms
 * Create new room (name only, starts with no timers)
 * 
 * Request: { "name": "Main Event" }
 * Response: { success: true, data: { id, name, timers: [], created_at, updated_at }, ... }
 */
function handleCreateRoom() {
    try {
        // Parse JSON body
        $body = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            sendValidationError(['Invalid JSON in request body']);
        }
        
        $name = $body['name'] ?? '';
        
        // Validate room name
        $validation = validateRoomName($name);
        if (!$validation['valid']) {
            sendValidationError($validation['errors']);
        }
        
        $pdo = getPDOInstance();
        ensureDashboardNameColumn($pdo);
        
        $dashboard_name = isset($body['dashboard_name']) ? trim($body['dashboard_name']) : null;
        
        // Insert room
        $insert_query = 'INSERT INTO timer_rooms (name, dashboard_name, created_at, updated_at) VALUES (?, ?, NOW(), NOW())';
        $insert_stmt = $pdo->prepare($insert_query);
        $insert_stmt->execute([$name, $dashboard_name]);
        
        $new_room_id = $pdo->lastInsertId();
        
        // Fetch and return newly created room
        $room_query = 'SELECT id, name, dashboard_name, created_at, updated_at FROM timer_rooms WHERE id = ?';
        $room_stmt = $pdo->prepare($room_query);
        $room_stmt->execute([$new_room_id]);
        $room = $room_stmt->fetch(PDO::FETCH_ASSOC);
        $room['timers'] = [];
        
        sendSuccess($room, HTTP_CREATED);
        
    } catch (PDOException $e) {
        sendDatabaseError('create room', $e);
    }
}

/**
 * Task 2.4: PUT /api/v1/rooms/{id}
 * Update room name and/or timers (upsert pattern)
 * 
 * Request: {
 *   "name": "Updated Room Name",
 *   "timers": [
 *     { "id": 1, "title": "Cue 1", "duration_seconds": 300, "position": 0 },
 *     { "id": 2, "title": "Cue 2", "duration_seconds": 600, "position": 1 },
 *     { "id": null, "title": "New Cue", "duration_seconds": 900, "position": 2 }
 *   ]
 * }
 * 
 * Response: { success: true, data: { id, name, timers: [...], ... }, ... }
 */
function handleUpdateRoom($room_id) {
    try {
        // Parse JSON body
        $body = json_decode(file_get_contents('php://input'), true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            sendValidationError(['Invalid JSON in request body']);
        }
        
        $pdo = getPDOInstance();
        ensureDashboardNameColumn($pdo);
        
        // Check if room exists
        $room_check = $pdo->prepare('SELECT id FROM timer_rooms WHERE id = ?');
        $room_check->execute([$room_id]);
        if (!$room_check->fetch()) {
            sendNotFound('Room', $room_id);
        }
        
        // Begin transaction
        $pdo->beginTransaction();
        
        try {
            // Update room name if provided
            if (isset($body['name'])) {
                $name = $body['name'];
                
                // Validate room name
                $validation = validateRoomName($name);
                if (!$validation['valid']) {
                    $pdo->rollBack();
                    sendValidationError($validation['errors']);
                }
                
                $update_query = 'UPDATE timer_rooms SET name = ?, updated_at = NOW() WHERE id = ?';
                $update_stmt = $pdo->prepare($update_query);
                $update_stmt->execute([$name, $room_id]);
            }
            
            // Update dashboard_name if provided
            if (array_key_exists('dashboard_name', $body)) {
                $dashboard_name = $body['dashboard_name'] !== null ? trim($body['dashboard_name']) : null;
                $dn_stmt = $pdo->prepare('UPDATE timer_rooms SET dashboard_name = ?, updated_at = NOW() WHERE id = ?');
                $dn_stmt->execute([$dashboard_name, $room_id]);
            }
            
            // Update timers if provided
            if (isset($body['timers']) && is_array($body['timers'])) {
                // Validate all timers
                $timers = $body['timers'];
                $timer_validation = validateTimerList($timers);
                if (!$timer_validation['valid']) {
                    $pdo->rollBack();
                    sendValidationError($timer_validation['errors']);
                }
                
                // Get existing timer IDs
                $existing_query = 'SELECT id FROM timer_items WHERE room_id = ? ORDER BY id';
                $existing_stmt = $pdo->prepare($existing_query);
                $existing_stmt->execute([$room_id]);
                $existing_ids = array_map(function($row) { return $row['id']; }, $existing_stmt->fetchAll(PDO::FETCH_ASSOC));
                
                // Track which IDs we're keeping
                $new_ids = [];
                
                // Upsert each timer
                foreach ($timers as $timer) {
                    $timer_id = $timer['id'] ?? null;
                    $title = $timer['title'] ?? '';
                    $duration = $timer['duration_seconds'] ?? 0;
                    $position = $timer['position'] ?? 0;
                    
                    if ($timer_id && in_array($timer_id, $existing_ids)) {
                        // Update existing timer
                        $update_timer = 'UPDATE timer_items SET title = ?, duration_seconds = ?, position = ?, updated_at = NOW() WHERE id = ? AND room_id = ?';
                        $update_timer_stmt = $pdo->prepare($update_timer);
                        $update_timer_stmt->execute([$title, $duration, $position, $timer_id, $room_id]);
                        $new_ids[] = $timer_id;
                    } else {
                        // Insert new timer
                        $insert_timer = 'INSERT INTO timer_items (room_id, title, duration_seconds, position, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())';
                        $insert_timer_stmt = $pdo->prepare($insert_timer);
                        $insert_timer_stmt->execute([$room_id, $title, $duration, $position]);
                        $new_ids[] = $pdo->lastInsertId();
                    }
                }
                
                // Delete timers not in the new list
                $ids_to_delete = array_diff($existing_ids, $new_ids);
                if (!empty($ids_to_delete)) {
                    $placeholders = implode(',', array_fill(0, count($ids_to_delete), '?'));
                    $delete_query = "DELETE FROM timer_items WHERE id IN ($placeholders) AND room_id = ?";
                    $delete_stmt = $pdo->prepare($delete_query);
                    $delete_stmt->execute(array_merge($ids_to_delete, [$room_id]));
                }
            }
            
            // Commit transaction
            $pdo->commit();
            
            // Fetch and return updated room
            $room_query = 'SELECT id, name, dashboard_name, created_at, updated_at FROM timer_rooms WHERE id = ?';
            $room_stmt = $pdo->prepare($room_query);
            $room_stmt->execute([$room_id]);
            $room = $room_stmt->fetch(PDO::FETCH_ASSOC);
            
            $timers_query = 'SELECT id, title, duration_seconds, position FROM timer_items WHERE room_id = ? ORDER BY position ASC';
            $timers_stmt = $pdo->prepare($timers_query);
            $timers_stmt->execute([$room_id]);
            $timers = $timers_stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $room['timers'] = $timers ?? [];
            
            sendSuccess($room);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        
    } catch (PDOException $e) {
        sendDatabaseError('update room', $e);
    }
}

/**
 * Task 2.5: DELETE /api/v1/rooms/{id}
 * Delete room (cascade deletes all timers via foreign key)
 * 
 * Response: { success: true, data: { message: "Room deleted successfully" }, ... }
 */
function handleDeleteRoom($room_id) {
    try {
        $pdo = getPDOInstance();
        
        // Check if room exists
        $room_check = $pdo->prepare('SELECT id FROM timer_rooms WHERE id = ?');
        $room_check->execute([$room_id]);
        if (!$room_check->fetch()) {
            sendNotFound('Room', $room_id);
        }
        
        // Delete room (timers cascade delete via FK)
        $delete_query = 'DELETE FROM timer_rooms WHERE id = ?';
        $delete_stmt = $pdo->prepare($delete_query);
        $delete_stmt->execute([$room_id]);
        
        sendSuccess(['message' => 'Room deleted successfully']);
        
    } catch (PDOException $e) {
        sendDatabaseError('delete room', $e);
    }
}
?>

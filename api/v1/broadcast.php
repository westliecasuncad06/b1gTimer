<?php
/**
 * B1G Timer - Pusher Event Broadcaster Endpoint
 * 
 * POST /api/v1/broadcast
 * 
 * Accepts timer control events from Control Dashboard or other sources
 * and broadcasts them via Pusher WebSockets to all connected devices.
 * 
 * Phase 2 Task: 2.6
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';

// Enable error reporting for debugging
if (defined('APP_DEBUG') && APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Set JSON content type
setJsonHeader();

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError(
        ERROR_INVALID_INPUT,
        'Only POST method is allowed for /api/v1/broadcast',
        HTTP_METHOD_NOT_ALLOWED
    );
}

try {
    // Parse JSON body
    $body = json_decode(file_get_contents('php://input'), true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendValidationError(['Invalid JSON in request body']);
    }
    
    // Extract and validate required fields
    $room_id = $body['roomId'] ?? null;
    $action = $body['action'] ?? null;
    $payload = $body['payload'] ?? [];
    $display_id = $body['displayId'] ?? null;
    
    // Validation: roomId
    if (empty($room_id) || !is_numeric($room_id)) {
        sendValidationError(['roomId is required and must be numeric']);
    }
    $room_id = (int)$room_id;
    
    // Validation: action
    if (empty($action) || !is_string($action)) {
        sendValidationError(['action is required and must be a string']);
    }
    
    // Validation: action is one of the allowed actions
    $allowed_actions = [
        'TIMER_START',
        'TIMER_PAUSE',
        'TIMER_RESUME',
        'TIMER_STOP',
        'TIMER_RESET',
        'TIMER_SKIP',
        'NEXT_TIMER',
        'PREVIOUS_TIMER',
        'BLACKOUT_ON',
        'BLACKOUT_OFF',
        'FLASH_TRIGGER',
        'MESSAGE_SHOW',
        'MESSAGE_HIDE',
        'ROOM_UPDATED',
        'TIME_ADJUSTMENT'
    ];
    
    if (!in_array($action, $allowed_actions)) {
        sendValidationError([
            "Invalid action '{$action}'. Allowed actions: " . implode(', ', $allowed_actions)
        ]);
    }
    
    // Check if room exists in database
    try {
        $pdo = getPDOInstance();
        $room_check = $pdo->prepare('SELECT id FROM timer_rooms WHERE id = ?');
        $room_check->execute([$room_id]);
        
        if (!$room_check->fetch()) {
            sendNotFound('Room', $room_id);
        }
    } catch (PDOException $e) {
        sendDatabaseError('verify room', $e);
    }
    
    // Build Pusher channel name
    $channel = 'presence-room-' . $room_id;
    
    // Prepare broadcast payload
    $broadcast_payload = [
        'roomId' => $room_id,
        'action' => $action,
        'payload' => $payload,
        'displayId' => $display_id,
        'broadcastedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    
    // Broadcast via root config.php pusherTrigger() — no SDK needed
    $broadcast_success = pusherTrigger($channel, $action, $broadcast_payload);
    
    if (!$broadcast_success) {
        // If Pusher is not available, return error
        // In production, Stage Display should implement fallback polling
        sendError(
            ERROR_SERVICE_UNAVAILABLE,
            'Real-time broadcast service unavailable. Stage Display may need to refresh manually.',
            HTTP_SERVICE_UNAVAILABLE
        );
    }
    
    // Generate broadcast ID for tracking
    $broadcast_id = uniqid('bcast_', true);
    
    // Success response
    sendSuccess([
        'broadcastId' => $broadcast_id,
        'roomId' => $room_id,
        'action' => $action,
        'channel' => $channel,
        'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ISO8601)
    ]);
    
} catch (Exception $e) {
    // Log unexpected error
    if (defined('APP_DEBUG') && APP_DEBUG) {
        error_log('[BROADCAST] ERROR: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    }
    sendError(
        ERROR_INTERNAL_ERROR,
        'An unexpected error occurred while broadcasting event.',
        HTTP_INTERNAL_SERVER_ERROR
    );
}
?>

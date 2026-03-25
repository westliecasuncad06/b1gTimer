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
        'TIME_ADJUSTMENT',
        'STAGE_STYLE_UPDATE'
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
    
    // Build Pusher channel name (public channel, no auth required)
    $channel = 'room-' . $room_id;
    
    // Prepare broadcast payload
    $broadcast_payload = [
        'roomId' => $room_id,
        'action' => $action,
        'payload' => $payload,
        'displayId' => $display_id,
        'broadcastedAt' => gmdate('Y-m-d\TH:i:s\Z'),
    ];
    
    // ── Save live timer state to DB (enables cross-browser polling) ──────────
    $tracked_actions = ['TIMER_START', 'TIMER_PAUSE', 'TIMER_RESUME', 'TIMER_STOP', 'TIMER_RESET', 'NEXT_TIMER', 'PREVIOUS_TIMER', 'TIME_ADJUSTMENT', 'STAGE_STYLE_UPDATE'];
    if (in_array($action, $tracked_actions)) {
        try {
            // Guarantee the table exists (matches database/schema.sql definition)
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

            // Migrate table from the original 3-column schema if needed
            // (ADD COLUMN IF NOT EXISTS is MySQL 5.7+ safe; the try/catch below handles older versions)
            try {
                $pdo->exec("ALTER TABLE `timer_live_state`
                    ADD COLUMN IF NOT EXISTS `is_running`         TINYINT(1)   NOT NULL DEFAULT 0 AFTER `room_id`,
                    ADD COLUMN IF NOT EXISTS `deadline_timestamp` BIGINT       NULL     DEFAULT NULL AFTER `is_running`,
                    ADD COLUMN IF NOT EXISTS `remaining_seconds`  INT          NULL     DEFAULT NULL AFTER `deadline_timestamp`,
                    ADD COLUMN IF NOT EXISTS `timer_index`        SMALLINT     NULL     DEFAULT NULL AFTER `remaining_seconds`,
                    ADD COLUMN IF NOT EXISTS `timer_title`        VARCHAR(100) NULL     DEFAULT NULL AFTER `timer_index`,
                    ADD COLUMN IF NOT EXISTS `action`             VARCHAR(30)  NULL     DEFAULT NULL AFTER `timer_title`,
                    ADD COLUMN IF NOT EXISTS `stage_style_json`   TEXT         NULL     DEFAULT NULL AFTER `state_json`");
            } catch (Exception $alter_err) {
                // Older MySQL without IF NOT EXISTS support — ignore; columns may already exist
            }

            // Use Asia/Manila timezone for human-readable timestamps stored in JSON
            date_default_timezone_set('Asia/Manila');

            // STAGE_STYLE_UPDATE: persist style only (don't overwrite timer state)
            if ($action === 'STAGE_STYLE_UPDATE') {
                $style_json = json_encode($payload);
                // Ensure the row exists first, then update only the style column
                $pdo->prepare("INSERT INTO timer_live_state
                                   (room_id, is_running, state_json, stage_style_json)
                               VALUES (?, 0, '{}', ?)
                               ON DUPLICATE KEY UPDATE
                                   stage_style_json = VALUES(stage_style_json),
                                   updated_at       = NOW()")
                    ->execute([$room_id, $style_json]);
                // Skip the normal timer-state insert/update below
                goto pusher_broadcast;
            }

            $is_running = in_array($action, ['TIMER_START', 'TIMER_RESUME']);
            $remaining  = $payload['remainingSeconds'] ?? $payload['duration'] ?? $payload['newRemaining'] ?? null;

            // Compute absolute deadline (Unix epoch, UTC) when running.
            // timeLeft = deadline - now on every client tick.
            $deadline_ts = null;
            if ($is_running && $remaining !== null) {
                // time() is always UTC epoch regardless of timezone setting above
                $deadline_ts = time() + (int)round((float)$remaining);
            }
            // For TIME_ADJUSTMENT the timer stays running — recompute deadline
            if ($action === 'TIME_ADJUSTMENT' && $remaining !== null) {
                $deadline_ts = time() + (int)round((float)$remaining);
                $is_running  = true;
            }
            // TIMER_STOP resets deadline and clears remaining
            if ($action === 'TIMER_STOP') {
                $deadline_ts = null;
                $remaining   = null;
                $is_running  = false;
            }
            // TIMER_RESET: timer is NOT running; remaining = full duration from payload
            if ($action === 'TIMER_RESET') {
                $deadline_ts = null;
                $remaining   = $payload['duration'] ?? $remaining;  // full duration
                $is_running  = false;
            }
            // TIMER_PAUSE: not running; remaining snapshotted by client is already in $remaining.
            // If the client also sent the current deadline, compute remaining server-side for accuracy.
            if ($action === 'TIMER_PAUSE') {
                $client_deadline = isset($payload['deadlineTimestamp']) ? (int)$payload['deadlineTimestamp'] : null;
                if ($client_deadline && $client_deadline > time()) {
                    // Use server time for accuracy — avoids client-clock skew
                    $remaining = $client_deadline - time();
                }
                $deadline_ts = null;
                $is_running  = false;
            }

            $timer_index = $payload['timerIndex'] ?? $payload['toIndex'] ?? null;
            $timer_title = $payload['timerTitle'] ?? null;

            $live_state = [
                'action'            => $action,
                'isRunning'         => $is_running,
                'remainingSeconds'  => $remaining,
                'deadlineTimestamp' => $deadline_ts,
                'timerIndex'        => $timer_index,
                'timerTitle'        => $timer_title,
                // Manila-local timestamp for human audit trail
                'savedAt'           => date('Y-m-d\TH:i:sP'),
                'serverTime'        => time(),
            ];
            $json = json_encode($live_state);

            $stmt = $pdo->prepare("INSERT INTO timer_live_state
                                       (room_id, is_running, deadline_timestamp, remaining_seconds,
                                        timer_index, timer_title, action, state_json)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                   ON DUPLICATE KEY UPDATE
                                       is_running         = VALUES(is_running),
                                       deadline_timestamp = VALUES(deadline_timestamp),
                                       remaining_seconds  = VALUES(remaining_seconds),
                                       timer_index        = VALUES(timer_index),
                                       timer_title        = VALUES(timer_title),
                                       action             = VALUES(action),
                                       state_json         = VALUES(state_json),
                                       updated_at         = NOW()");
            $stmt->execute([
                $room_id,
                $is_running ? 1 : 0,
                $deadline_ts,
                $remaining !== null ? (int)round((float)$remaining) : null,
                $timer_index !== null ? (int)$timer_index : null,
                $timer_title,
                $action,
                $json,
            ]);

            // Inject server-computed deadline into the Pusher payload
            // so stage/dashboard receive the authoritative value in real time
            if ($deadline_ts !== null) {
                $broadcast_payload['payload']['deadlineTimestamp'] = $deadline_ts;
                $broadcast_payload['payload']['serverTime']        = time();
            }
        } catch (Exception $db_err) {
            error_log('[BROADCAST] State save failed: ' . $db_err->getMessage());
        }
    }
    
    pusher_broadcast:
    // Broadcast via root config.php pusherTrigger() — failure is now non-fatal
    $broadcast_success = pusherTrigger($channel, $action, $broadcast_payload);
    
    // Generate broadcast ID for tracking
    $broadcast_id = uniqid('bcast_', true);
    
    // Success response (Pusher failure is non-fatal; DB state + BroadcastChannel are fallbacks)
    sendSuccess([
        'broadcastId' => $broadcast_id,
        'roomId' => $room_id,
        'action' => $action,
        'channel' => $channel,
        'pusherSent' => $broadcast_success,
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

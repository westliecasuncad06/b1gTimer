<?php
/**
 * B1G Timer - Pusher WebSocket Configuration
 * 
 * Initializes Pusher PHP SDK for real-time event broadcasting.
 * Used in Task 2.6 (POST /api/v1/broadcast).
 */

// Load environment variables
require_once __DIR__ . '/database.php';

// Load Pusher credentials from environment
$pusher_key = $_ENV['PUSHER_KEY'] ?? getenv('PUSHER_KEY');
$pusher_secret = $_ENV['PUSHER_SECRET'] ?? getenv('PUSHER_SECRET');
$pusher_cluster = $_ENV['PUSHER_CLUSTER'] ?? getenv('PUSHER_CLUSTER');
$pusher_encrypted = (int)($_ENV['PUSHER_ENCRYPTED'] ?? getenv('PUSHER_ENCRYPTED') ?? 1);

// Define Pusher configuration constants
if (!defined('PUSHER_KEY')) {
    define('PUSHER_KEY', $pusher_key);
}
if (!defined('PUSHER_SECRET')) {
    define('PUSHER_SECRET', $pusher_secret);
}
if (!defined('PUSHER_CLUSTER')) {
    define('PUSHER_CLUSTER', $pusher_cluster);
}
if (!defined('PUSHER_ENCRYPTED')) {
    define('PUSHER_ENCRYPTED', $pusher_encrypted);
}

// Pusher options
define('PUSHER_OPTIONS', [
    'cluster' => PUSHER_CLUSTER,
    'encrypted' => PUSHER_ENCRYPTED == 1,
    'timeout' => 10  // 10 second timeout
]);

// Define Pusher channel naming conventions
define('PUSHER_CHANNEL_PREFIX', 'presence-room-');

/**
 * Get Pusher singleton instance
 * 
 * @return \Pusher\Pusher|null  Pusher instance or null if credentials not configured
 */
function getPusherInstance() {
    static $pusher_instance = null;
    
    if ($pusher_instance !== null) {
        return $pusher_instance;
    }
    
    // Check if credentials are configured
    if (empty(PUSHER_KEY) || empty(PUSHER_SECRET) || empty(PUSHER_CLUSTER)) {
        if (defined('APP_DEBUG') && APP_DEBUG) {
            error_log('[PUSHER] WARNING: Credentials not configured. Broadcasting disabled.');
        }
        return null;
    }
    
    try {
        // Require Pusher SDK (install via: composer require pusher/pusher-php-server)
        // For MVP: use fallback implementation if SDK not available
        if (class_exists('Pusher\Pusher')) {
            $pusher_instance = new \Pusher\Pusher(
                PUSHER_KEY,
                PUSHER_SECRET,
                PUSHER_CLUSTER,
                PUSHER_OPTIONS
            );
        } else {
            if (defined('APP_DEBUG') && APP_DEBUG) {
                error_log('[PUSHER] WARNING: Pusher SDK not installed. Install with: composer require pusher/pusher-php-server');
            }
            return null;
        }
        
        return $pusher_instance;
        
    } catch (Exception $e) {
        if (defined('APP_DEBUG') && APP_DEBUG) {
            error_log('[PUSHER] ERROR: Failed to initialize Pusher: ' . $e->getMessage());
        }
        return null;
    }
}

/**
 * Broadcast event to Pusher channel
 * 
 * @param string $channel     Pusher channel name
 * @param string $event       Event name (e.g., "TIMER_START")
 * @param array  $data        Event payload
 * 
 * @return bool               True if broadcast successful, false otherwise
 */
function broadcastPusherEvent($channel, $event, $data) {
    try {
        $pusher = getPusherInstance();
        
        if ($pusher === null) {
            if (defined('APP_DEBUG') && APP_DEBUG) {
                error_log('[PUSHER] BROADCAST SKIPPED: SDK not available or credentials missing');
            }
            // In production, we want to fail gracefully, not crash
            // Stage Display should have fallback mechanism if broadcast fails
            return false;
        }
        
        // Trigger event
        $result = $pusher->trigger($channel, $event, $data);
        
        if (defined('APP_DEBUG') && APP_DEBUG) {
            error_log("[PUSHER] Event broadcast: $event to channel $channel");
        }
        
        return true;
        
    } catch (Exception $e) {
        if (defined('APP_DEBUG') && APP_DEBUG) {
            error_log('[PUSHER] ERROR: ' . $e->getMessage());
        }
        return false;
    }
}

/**
 * Get Pusher channel name for a room
 * 
 * @param int|string $room_id  Room ID
 * 
 * @return string              Channel name (e.g., "presence-room-123")
 */
function getPusherChannelName($room_id) {
    return PUSHER_CHANNEL_PREFIX . $room_id;
}
?>

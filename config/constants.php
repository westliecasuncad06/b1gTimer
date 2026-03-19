<?php
/**
 * B1G Timer MVP - Application Constants
 * 
 * Centralized configuration for validation rules, API endpoints, timezones, and application constants.
 * Loaded after .env is loaded by config/database.php
 */

// =============================================================================
// API ENDPOINTS & ROUTES
// =============================================================================

define('API_VERSION', 'v1');
define('API_BASE_PATH', '/api/' . API_VERSION);

// REST endpoints
define('ENDPOINT_ROOMS', API_BASE_PATH . '/rooms');
define('ENDPOINT_HEALTH', API_BASE_PATH . '/health');

// =============================================================================
// VALIDATION RULES
// =============================================================================

// Room name validation
define('ROOM_NAME_MAX_LENGTH', 100);
define('ROOM_NAME_PATTERN', '/^[a-zA-Z0-9\s\-]+$/'); // Alphanumeric, spaces, hyphens only

// Timer title validation
define('TIMER_TITLE_MAX_LENGTH', 100);
define('TIMER_TITLE_ALLOW_SPECIAL_CHARS', true); // Allow most chars except script tags

// Timer duration validation
define('TIMER_DURATION_MIN_SECONDS', 0);
define('TIMER_DURATION_MAX_SECONDS', 36000); // 10 hours in seconds
define('TIMER_DURATION_DISPLAY_FORMAT', 'MM:SS'); // Format for UI

// Message text validation
define('MESSAGE_TEXT_MAX_LENGTH', 255);
define('MESSAGE_ALLOWED_COLORS', ['white', 'yellow', 'red', 'green', 'blue', 'cyan', 'magenta', '#FFFFFF', '#FFFF00', '#FF0000', '#00FF00', '#0000FF', '#00FFFF', '#FF00FF']);
define('MESSAGE_ALLOWED_FONT_SIZES', [12, 16, 20, 24, 32, 40, 48]); // In pixels

// Scalability limits (MVP targets from analysis)
define('MAX_TIMERS_PER_ROOM', 100);
define('MAX_CONCURRENT_DASHBOARDS_PER_ROOM', 5);
define('MAX_EXPECTED_DAILY_ACTIVE_ROOMS', 100);

// =============================================================================
// TIMEZONE CONFIGURATION
// =============================================================================

/**
 * Get configured timezones from environment
 */
$server_timezone = getenv('SERVER_TIMEZONE') ?: 'UTC';
$venue_timezone = getenv('VENUE_TIMEZONE') ?: 'Asia/Manila';

define('SERVER_TIMEZONE', $server_timezone);
define('VENUE_TIMEZONE', $venue_timezone);

/**
 * Calculate UTC offset for venue timezone (for JavaScript calculations)
 * Returns offset in hours (e.g., -6 for America/Chicago in winter)
 */
function getVenueTimezoneOffset() {
    try {
        $tz = new DateTimeZone(VENUE_TIMEZONE);
        $dt = new DateTime('now', $tz);
        $offset_seconds = $tz->getOffset($dt);
        return round($offset_seconds / 3600); // Convert to hours
    } catch (Exception $e) {
        return 0; // Fallback to UTC if timezone invalid
    }
}

// =============================================================================
// HTTP STATUS CODES & ERROR CODES
// =============================================================================

define('HTTP_OK', 200);
define('HTTP_CREATED', 201);
define('HTTP_BAD_REQUEST', 400);
define('HTTP_NOT_FOUND', 404);
define('HTTP_INTERNAL_SERVER_ERROR', 500);
define('HTTP_SERVICE_UNAVAILABLE', 503);

// Error codes (for API responses)
define('ERROR_CODE_INVALID_INPUT', 'INVALID_INPUT');
define('ERROR_CODE_ROOM_NOT_FOUND', 'ROOM_NOT_FOUND');
define('ERROR_CODE_TIMER_NOT_FOUND', 'TIMER_NOT_FOUND');
define('ERROR_CODE_DB_ERROR', 'DATABASE_ERROR');
define('ERROR_CODE_INTERNAL_ERROR', 'INTERNAL_SERVER_ERROR');

// =============================================================================
// DATABASE CONSTRAINTS
// =============================================================================

// Index performance targets (from success criteria)
define('DB_QUERY_TIMEOUT_MS', 200); // Target: room + timers fetch in <200ms
define('DB_MAX_ROOM_TIMERS', 100); // Align with MAX_TIMERS_PER_ROOM

// =============================================================================
// PUSHER REAL-TIME COMMUNICATION CONFIGURATION
// =============================================================================

/**
 * ARCHITECTURE CHANGE: Switched from BroadcastChannel API (same-origin only) to Pusher (internet-accessible)
 * Reason: Supports mobile phone control over internet (InfinityFree hosting + mobile deployment)
 * 
 * Channel Strategy:
 * - 'presence-room-{roomId}': Presence channel for connection tracking & control messages
 * - Control Dashboard & Stage Display both subscribe to same Pusher channel
 * - All events broadcast to that channel (Control Dashboard sends commands, Stage Display listens)
 * 
 * Message Protocol: Same 15 action types, but transported via Pusher instead of BroadcastChannel
 */

// Pusher credentials from .env
$pusher_key = getenv('PUSHER_KEY');
$pusher_secret = getenv('PUSHER_SECRET');
$pusher_cluster = getenv('PUSHER_CLUSTER') ?: 'mt1';
$pusher_encrypted = getenv('PUSHER_ENCRYPTED') !== 'false';

define('PUSHER_KEY', $pusher_key);
define('PUSHER_SECRET', $pusher_secret);
define('PUSHER_CLUSTER', $pusher_cluster);
define('PUSHER_ENCRYPTED', $pusher_encrypted);

// Pusher channel naming
define('PUSHER_CHANNEL_PREFIX', 'presence-room-'); // 'presence-room-{roomId}'
define('PUSHER_PRIVATE_CHANNEL_PREFIX', 'private-room-'); // For future private messaging

// Action types (transported via Pusher, not BroadcastChannel)
define('ACTION_TIMER_START', 'TIMER_START');
define('ACTION_TIMER_PAUSE', 'TIMER_PAUSE');
define('ACTION_TIMER_RESUME', 'TIMER_RESUME');
define('ACTION_TIMER_RESTART', 'TIMER_RESTART');
define('ACTION_TIMER_ADJUST', 'TIMER_ADJUST');
define('ACTION_NEXT_TIMER', 'NEXT_TIMER');
define('ACTION_BLACKOUT_ON', 'BLACKOUT_ON');
define('ACTION_BLACKOUT_OFF', 'BLACKOUT_OFF');
define('ACTION_FLASH_SCREEN', 'FLASH_SCREEN');
define('ACTION_SHOW_MESSAGE', 'SHOW_MESSAGE');
define('ACTION_HIDE_MESSAGE', 'HIDE_MESSAGE');
define('ACTION_SYNC_REQUEST', 'SYNC_REQUEST');
define('ACTION_SYNC_RESPONSE', 'SYNC_RESPONSE');
define('ACTION_DISPLAY_CONNECTED', 'DISPLAY_CONNECTED');
define('ACTION_DISPLAY_DISCONNECTED', 'DISPLAY_DISCONNECTED');

// Pusher protocol version (for compatibility)
define('PUSHER_PROTOCOL_VERSION', 1);

// =============================================================================
// UI & STYLING CONSTANTS (from visual design clarification)
// =============================================================================

// Stage Display typography & colors (matches Q2 clarification)
define('STAGE_COUNTDOWN_FONT_SIZE_PX', 120); // Minimum
define('STAGE_TIME_FONT_SIZE_PX', 48); // Minimum
define('STAGE_TEXT_COLOR_HEX', '#FFFFFF'); // White
define('STAGE_BACKGROUND_COLOR_HEX', '#0a0a0a'); // Near-black
define('STAGE_PROGRESS_COLOR_GREEN_HEX', '#10b981'); // Green
define('STAGE_PROGRESS_COLOR_YELLOW_HEX', '#f59e0b'); // Yellow
define('STAGE_PROGRESS_COLOR_RED_HEX', '#ef4444'); // Red

// Progress bar thresholds (color transitions)
define('PROGRESS_COLOR_YELLOW_THRESHOLD_SECONDS', 120); // 2:00 remaining
define('PROGRESS_COLOR_RED_THRESHOLD_SECONDS', 0); // 00:00 remaining

// Timer overage: how long to continue displaying negative time (optional cutoff)
define('MAX_OVERAGE_DISPLAY_SECONDS', 3600); // 1 hour max overage display (optional for Phase 2)

// Flash screen pulse duration
define('FLASH_DURATION_MS', 500); // 500ms white pulse for flash effect

// =============================================================================
// PERFORMANCE & ACCURACY TARGETS (from success criteria)
// =============================================================================

// Real-time performance targets
define('TARGET_BROADCAST_LATENCY_MS', 100); // Multi-tab sync target
define('TARGET_TIMER_ACCURACY_MS', 50); // ±50ms over 60 minutes
define('TARGET_APP_LOAD_TIME_S', 2); // App load time
define('TARGET_API_RESPONSE_TIME_MS', 500); // API response time

// =============================================================================
// ENVIRONMENT-SPECIFIC SETTINGS
// =============================================================================

$environment = getenv('PHP_ENVIRONMENT') ?: 'development';
define('APP_ENV', $environment);

// In development: show detailed errors; in production: log only
define('APP_DEBUG', APP_ENV === 'development');
define('APP_LOG_FILE', dirname(__DIR__) . '/logs/app.log');

// Request logging for debugging
define('LOG_REQUEST_DETAILS', APP_ENV === 'development'); // False in production

?>

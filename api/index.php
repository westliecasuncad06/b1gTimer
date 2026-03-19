<?php
/**
 * B1G Timer - API Router/Dispatcher
 * 
 * Main entry point for all /api/v1/* requests.
 * Routes requests to appropriate handler files.
 * 
 * Endpoints:
 *   GET    /api/v1/rooms              → api/v1/rooms.php
 *   GET    /api/v1/rooms/{id}         → api/v1/rooms.php
 *   POST   /api/v1/rooms              → api/v1/rooms.php
 *   PUT    /api/v1/rooms/{id}         → api/v1/rooms.php
 *   DELETE /api/v1/rooms/{id}         → api/v1/rooms.php
 *   POST   /api/v1/broadcast          → api/v1/broadcast.php
 *   GET    /api/v1/health             → api/v1/health.php
 * 
 * Phase 2 Task: 2.8
 */

// Enable error reporting in development
if (defined('APP_DEBUG') && APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
}

// Set JSON response header globally
header('Content-Type: application/json');

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // ── Dynamic base-path detection ─────────────────────────────────────
    // Works on XAMPP (/B1G_TIMER/api/index.php) AND InfinityFree (/api/index.php)
    $script_dir  = dirname($_SERVER['SCRIPT_NAME']);          // e.g. /B1G_TIMER/api
    $base_path   = dirname($script_dir);                     // e.g. /B1G_TIMER
    $request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    // Strip the project base so we always get /api/v1/...
    $request_path = substr($request_uri, strlen($base_path)) ?: '/';

    // Check if request is for /api/v1/*
    if (strpos($request_path, '/api/v1/') !== 0) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Not Found',
            'code' => 'NOT_FOUND',
            'message' => 'The requested API endpoint does not exist.',
            'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ISO8601)
        ]);
        exit;
    }
    
    // Extract route (e.g., /rooms, /broadcast, /health)
    $route_path = substr($request_path, strlen('/api/v1'));
    if (empty($route_path)) {
        $route_path = '/';
    }
    
    // Parse route segments
    $segments = array_filter(explode('/', $route_path));
    $resource = reset($segments);  // First segment: rooms, broadcast, health, etc.
    
    // Route to appropriate handler
    switch ($resource) {
        case 'rooms':
            // Use include instead of require to allow multiple includes in test environment
            include __DIR__ . '/v1/rooms.php';
            break;
            
        case 'broadcast':
            include __DIR__ . '/v1/broadcast.php';
            break;
            
        case 'health':
            include __DIR__ . '/v1/health.php';
            break;
            
        case 'pusher-config':
            include __DIR__ . '/v1/pusher-config.php';
            break;
            
        default:
            http_response_code(404);
            echo json_encode([
                'error' => 'Endpoint Not Found',
                'code' => 'ENDPOINT_NOT_FOUND',
                'message' => "API endpoint '/{$resource}' is not recognized.",
                'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ISO8601)
            ]);
            exit;
    }
    
} catch (Exception $e) {
    // Unexpected error in router
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'code' => 'ROUTER_ERROR',
        'message' => 'An error occurred while routing the request.',
        'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ISO8601)
    ]);
    exit;
}
?>

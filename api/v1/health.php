<?php
/**
 * B1G Timer - Health Check Endpoint
 * 
 * GET /api/v1/health
 * 
 * Simple endpoint to verify API and database connectivity.
 * Used by frontend for connection monitoring.
 * 
 * Phase 2 Task: 2.7
 */

require_once dirname(__DIR__) . '/config/db.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Set JSON content type
setJsonHeader();

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError(
        ERROR_INVALID_INPUT,
        'Only GET method is allowed for /api/v1/health',
        HTTP_METHOD_NOT_ALLOWED
    );
}

try {
    $pdo = getPDOInstance();
    
    // Test database connection
    $stmt = $pdo->prepare('SELECT 1');
    $stmt->execute();
    
    // Success - database is connected
    sendSuccess([
        'status' => 'ok',
        'database' => 'connected',
        'apiVersion' => '1.0.0',
        'timestamp' => (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ISO8601)
    ]);
    
} catch (PDOException $e) {
    // Database connection failed
    sendError(
        ERROR_SERVICE_UNAVAILABLE,
        'Database connection failed. Service is temporarily unavailable.',
        HTTP_SERVICE_UNAVAILABLE
    );
} catch (Exception $e) {
    // Unexpected error
    sendError(
        ERROR_INTERNAL_ERROR,
        'An unexpected error occurred while checking health status.',
        HTTP_INTERNAL_SERVER_ERROR
    );
}
?>

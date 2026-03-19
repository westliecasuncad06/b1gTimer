<?php
/**
 * Error & Success Response Handler
 *
 * Centralized JSON response formatting for all API endpoints.
 * Constants are guarded with if (!defined(...)) so they never
 * conflict with config/constants.php.
 */

// ── HTTP Status Codes (guarded) ─────────────────────────────────────────────
if (!defined('HTTP_OK'))                    define('HTTP_OK', 200);
if (!defined('HTTP_CREATED'))               define('HTTP_CREATED', 201);
if (!defined('HTTP_BAD_REQUEST'))           define('HTTP_BAD_REQUEST', 400);
if (!defined('HTTP_UNAUTHORIZED'))          define('HTTP_UNAUTHORIZED', 401);
if (!defined('HTTP_FORBIDDEN'))             define('HTTP_FORBIDDEN', 403);
if (!defined('HTTP_NOT_FOUND'))             define('HTTP_NOT_FOUND', 404);
if (!defined('HTTP_METHOD_NOT_ALLOWED'))    define('HTTP_METHOD_NOT_ALLOWED', 405);
if (!defined('HTTP_CONFLICT'))              define('HTTP_CONFLICT', 409);
if (!defined('HTTP_INTERNAL_SERVER_ERROR')) define('HTTP_INTERNAL_SERVER_ERROR', 500);
if (!defined('HTTP_SERVICE_UNAVAILABLE'))   define('HTTP_SERVICE_UNAVAILABLE', 503);

// ── Error Codes (guarded) ───────────────────────────────────────────────────
if (!defined('ERROR_INVALID_INPUT'))      define('ERROR_INVALID_INPUT', 'INVALID_INPUT');
if (!defined('ERROR_ROOM_NOT_FOUND'))     define('ERROR_ROOM_NOT_FOUND', 'ROOM_NOT_FOUND');
if (!defined('ERROR_TIMER_NOT_FOUND'))    define('ERROR_TIMER_NOT_FOUND', 'TIMER_NOT_FOUND');
if (!defined('ERROR_DB_ERROR'))           define('ERROR_DB_ERROR', 'DATABASE_ERROR');
if (!defined('ERROR_INTERNAL_ERROR'))     define('ERROR_INTERNAL_ERROR', 'INTERNAL_SERVER_ERROR');
if (!defined('ERROR_UNAUTHORIZED'))       define('ERROR_UNAUTHORIZED', 'UNAUTHORIZED');
if (!defined('ERROR_FORBIDDEN'))          define('ERROR_FORBIDDEN', 'FORBIDDEN');
if (!defined('ERROR_SERVICE_UNAVAILABLE'))define('ERROR_SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE');

// ── Response Helpers ────────────────────────────────────────────────────────

/** Alias used in endpoint files */
function setJsonHeader(): void { setJsonResponseHeaders(); }

function setJsonResponseHeaders(): void {
    header('Content-Type: application/json; charset=utf-8', true);
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0', true);
}

// =============================================================================
// ERROR RESPONSE
// =============================================================================

/**
 * Send error response and exit
 * 
 * JSON Schema:
 * {
 *   "error": "Human-readable error message",
 *   "code": "ERROR_CODE_CONSTANT",
 *   "timestamp": "2026-03-19T12:34:56Z",
 *   "requestId": "optional-uuid-for-debugging"
 * }
 * 
 * Usage:
 *   sendError(
 *     ERROR_ROOM_NOT_FOUND,
 *     "Room with ID 999 does not exist",
 *     HTTP_NOT_FOUND
 *   );
 * 
 * @param string $error_code Error code constant (e.g., ERROR_ROOM_NOT_FOUND)
 * @param string $message Human-readable error message
 * @param int $http_status HTTP status code (200-599)
 * @param string|null $request_id Optional request ID for debugging
 * @return void (exits after output)
 */
function sendError(
    string $error_code,
    string $message,
    int $http_status = HTTP_INTERNAL_SERVER_ERROR,
    ?string $request_id = null
): void {
    // Set headers
    setJsonResponseHeaders();
    http_response_code($http_status);
    
    // Generate request ID if not provided
    if ($request_id === null) {
        $request_id = uniqid('req_', true);
    }
    
    // Build response
    $response = [
        "error" => $message,
        "code" => $error_code,
        "timestamp" => gmdate('Y-m-d\TH:i:s\Z'),
        "requestId" => $request_id
    ];
    
    // Log error if debug mode enabled
    if (defined('APP_DEBUG') && APP_DEBUG) {
        error_log("[API ERROR] [$http_status] [$error_code] $message (RequestID: $request_id)");
    }
    
    // Output JSON
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// =============================================================================
// SUCCESS/DATA RESPONSE
// =============================================================================

/**
 * Send success response with data payload and exit
 * 
 * JSON Schema:
 * {
 *   "success": true,
 *   "data": { ...payload... },
 *   "timestamp": "2026-03-19T12:34:56Z",
 *   "requestId": "optional-uuid-for-debugging"
 * }
 * 
 * Usage:
 *   sendSuccess([
 *     "id" => 123,
 *     "name" => "Main Event"
 *   ]);
 * 
 * @param mixed $data Payload to return (array, object, string, etc.)
 * @param int $http_status HTTP status code (default: 200 OK)
 * @param string|null $request_id Optional request ID for debugging
 * @return void (exits after output)
 */
function sendSuccess(
    $data,
    int $http_status = HTTP_OK,
    ?string $request_id = null
): void {
    // Set headers
    setJsonResponseHeaders();
    http_response_code($http_status);
    
    // Generate request ID if not provided
    if ($request_id === null) {
        $request_id = uniqid('req_', true);
    }
    
    // Build response
    $response = [
        "success" => true,
        "data" => $data,
        "timestamp" => gmdate('Y-m-d\TH:i:s\Z'),
        "requestId" => $request_id
    ];
    
    // Output JSON
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// =============================================================================
// VALIDATION ERROR RESPONSE (Special Case)
// =============================================================================

/**
 * Send validation error response
 * Extends error response with detailed field-level errors
 * 
 * JSON Schema:
 * {
 *   "error": "Validation failed",
 *   "code": "INVALID_INPUT",
 *   "timestamp": "2026-03-19T12:34:56Z",
 *   "requestId": "...",
 *   "validation_errors": [
 *     "Room name exceeds 100 characters",
 *     "Timer #1: Duration must be a number"
 *   ]
 * }
 * 
 * Usage:
 *   sendValidationError([
 *     "Room name exceeds 100 characters",
 *     "Timer #1: Duration exceeds 36000 seconds"
 *   ]);
 * 
 * @param array $errors Array of error messages
 * @param string|null $request_id Optional request ID
 * @return void (exits after output)
 */
function sendValidationError(
    array $errors,
    ?string $request_id = null
): void {
    // Set headers
    setJsonResponseHeaders();
    http_response_code(HTTP_BAD_REQUEST);
    
    // Generate request ID if not provided
    if ($request_id === null) {
        $request_id = uniqid('req_', true);
    }
    
    // Build response with validation details
    $response = [
        "error" => "Request validation failed",
        "code" => ERROR_INVALID_INPUT,
        "timestamp" => gmdate('Y-m-d\TH:i:s\Z'),
        "requestId" => $request_id,
        "validation_errors" => $errors
    ];
    
    // Log validation errors if debug mode enabled
    if (defined('APP_DEBUG') && APP_DEBUG) {
        error_log("[VALIDATION ERROR] RequestID: $request_id - " . count($errors) . " errors");
        foreach ($errors as $error) {
            error_log("  - $error");
        }
    }
    
    // Output JSON
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// =============================================================================
// NOT FOUND RESPONSE (Common Pattern)
// =============================================================================

/**
 * Send "resource not found" error (404 Not Found)
 * Convenience wrapper for common 404 responses
 * 
 * @param string $resource_type Type of resource (e.g. "Room", "Timer")
 * @param int|string $id Resource ID that was not found
 * @param string|null $request_id Optional request ID
 * @return void (exits after output)
 */
function sendNotFound(
    string $resource_type,
    $id,
    ?string $request_id = null
): void {
    $error_code = 'ERROR_' . strtoupper($resource_type) . '_NOT_FOUND';
    if (!defined($error_code)) {
        $error_code = ERROR_ROOM_NOT_FOUND; // Fallback
    }
    
    sendError(
        $error_code,
        ucfirst($resource_type) . " with ID '$id' not found",
        HTTP_NOT_FOUND,
        $request_id
    );
}

// =============================================================================
// DATABASE ERROR RESPONSE (Error Handling)
// =============================================================================

/**
 * Send database error response (500 Internal Server Error)
 * Logs full error details, returns generic message to client
 * 
 * @param string $operation Operation that failed (e.g. "fetch room", "insert timer")
 * @param \Throwable|null $exception Optional exception for logging
 * @param string|null $request_id Optional request ID
 * @return void (exits after output)
 */
function sendDatabaseError(
    string $operation,
    ?\Throwable $exception = null,
    ?string $request_id = null
): void {
    // Generate request ID if not provided
    if ($request_id === null) {
        $request_id = uniqid('req_', true);
    }
    
    // Log full error details (debug mode)
    if (defined('APP_DEBUG') && APP_DEBUG && $exception) {
        error_log("[DATABASE ERROR] RequestID: $request_id");
        error_log("  Operation: $operation");
        error_log("  Exception: " . $exception->getMessage());
        error_log("  Stack: " . $exception->getTraceAsString());
    }
    
    // Return generic message to client (never expose internal DB details)
    sendError(
        ERROR_DB_ERROR,
        "Database operation failed: $operation. Please try again later.",
        HTTP_INTERNAL_SERVER_ERROR,
        $request_id
    );
}

// =============================================================================
// CREATED RESPONSE (Status 201)
// =============================================================================

/**
 * Send resource created response (201 Created)
 * Convenience wrapper for successful resource creation
 * 
 * @param array $resource Created resource object
 * @param string|null $request_id Optional request ID
 * @return void (exits after output)
 */
function sendCreated(
    array $resource,
    ?string $request_id = null
): void {
    sendSuccess($resource, HTTP_CREATED, $request_id);
}

?>

# Task 1.5 Implementation Guide: Error Response Handler

**Task**: Create Error Response Handler  
**Phase**: 1 (Database Infrastructure)  
**Files Created**: `api/utils/error-handler.php`  
**Dependencies**: None (standalone utility)  
**Integration**: Used by all API endpoints (Tasks 2.1–2.9 and beyond)  

---

## Overview

Task 1.5 creates a centralized response formatting library that:
- **Formats all JSON responses** with consistent structure
- **Sets HTTP status codes** correctly (200, 201, 400, 404, 500, etc.)
- **Logs errors securely** (debug mode only, never exposed to client)
- **Complies with Constitution v1.1.0** Section V (Backend API Standards)

All API endpoints call these functions instead of manually building responses—ensures consistency across the application.

---

## File: `api/utils/error-handler.php` (Production-Ready)

### Purpose
Centralized JSON response formatting with proper HTTP headers and status codes.

**Key Features**:
- Single source of truth for response format
- Automatic timestamp (ISO8601) on all responses
- Request ID for debugging/tracing
- Secure error logging (debug mode only)
- Consistent HTTP status code usage

---

## Response Functions

### 1. `sendSuccess($data, $http_status = 200, $request_id = null)`
**Purpose**: Send successful API response with data payload

**JSON Schema**:
```json
{
  "success": true,
  "data": { ...payload... },
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_1234567890abcdef"
}
```

**Usage Examples**:

**Example 1: Fetch Single Room**
```php
<?php
$room = ["id" => 1, "name" => "Main Event", "created_at" => "2026-03-19T12:00:00Z"];
sendSuccess($room);  // HTTP 200 OK
?>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Main Event",
    "created_at": "2026-03-19T12:00:00Z"
  },
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

**Example 2: Fetch Room List**
```php
<?php
$rooms = [
  ["id" => 1, "name" => "Main Event"],
  ["id" => 2, "name" => "Breakout Room"]
];
sendSuccess($rooms);  // HTTP 200 OK
?>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "Main Event"},
    {"id": 2, "name": "Breakout Room"}
  ],
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

---

### 2. `sendCreated($resource, $request_id = null)`
**Purpose**: Send "resource created" response (HTTP 201)

**Usage**:
```php
<?php
$new_room = ["id" => 3, "name" => "New Room"];
sendCreated($new_room);  // HTTP 201 Created
?>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "New Room"
  },
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

**HTTP Status**: `201 Created` (standard for resource creation)

---

### 3. `sendError($error_code, $message, $http_status, $request_id = null)`
**Purpose**: Send error response

**JSON Schema**:
```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE_CONSTANT",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

**Usage Examples**:

**Example 1: 404 Not Found**
```php
<?php
sendError(
  ERROR_ROOM_NOT_FOUND,
  "Room with ID 999 does not exist",
  HTTP_NOT_FOUND
);
?>
```

**Response** (HTTP 404):
```json
{
  "error": "Room with ID 999 does not exist",
  "code": "ERROR_ROOM_NOT_FOUND",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

**Example 2: 500 Internal Server Error**
```php
<?php
sendError(
  ERROR_INTERNAL_ERROR,
  "An unexpected error occurred. Please try again later.",
  HTTP_INTERNAL_SERVER_ERROR
);
?>
```

**Response** (HTTP 500):
```json
{
  "error": "An unexpected error occurred. Please try again later.",
  "code": "ERROR_INTERNAL_ERROR",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

---

### 4. `sendValidationError($errors, $request_id = null)`
**Purpose**: Send validation failure response (400 Bad Request)

**Extended JSON Schema** (includes field-level errors):
```json
{
  "error": "Request validation failed",
  "code": "INVALID_INPUT",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_...",
  "validation_errors": [
    "Room name exceeds 100 characters",
    "Timer #1: Duration must be a number"
  ]
}
```

**Usage**:
```php
<?php
require_once 'middleware/validate.php';

$room_result = validateRoomName($request['name'] ?? '');
if (!$room_result['valid']) {
    sendValidationError($room_result['errors']);  // HTTP 400
}
?>
```

**Response** (HTTP 400):
```json
{
  "error": "Request validation failed",
  "code": "INVALID_INPUT",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_...",
  "validation_errors": [
    "Room name is required",
    "Room name contains invalid characters. Use only letters, numbers, spaces, and hyphens."
  ]
}
```

---

### 5. `sendNotFound($resource_type, $id, $request_id = null)`
**Purpose**: Convenience wrapper for 404 "resource not found"

**Usage**:
```php
<?php
sendNotFound("Room", 999);  // Generates ERROR_ROOM_NOT_FOUND, HTTP 404
sendNotFound("Timer", 42);  // Generates ERROR_TIMER_NOT_FOUND, HTTP 404
?>
```

**Response**:
```json
{
  "error": "Room with ID '999' not found",
  "code": "ERROR_ROOM_NOT_FOUND",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

---

### 6. `sendDatabaseError($operation, $exception = null, $request_id = null)`
**Purpose**: Send database error response (500 Internal Server Error)

**Security**: Logs full exception details (debug mode only), returns generic message to client

**Usage**:
```php
<?php
try {
    // Database operation
    $stmt = executePreparedStatement($pdo, 'SELECT * FROM timer_rooms WHERE id = ?', [999]);
} catch (Exception $e) {
    sendDatabaseError("fetch room", $e);  // HTTP 500
}
?>
```

**Client Response** (never exposes DB details):
```json
{
  "error": "Database operation failed: fetch room. Please try again later.",
  "code": "DATABASE_ERROR",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

**Server Log** (debug mode, never sent to client):
```
[DATABASE ERROR] RequestID: req_...
  Operation: fetch room
  Exception: SQLSTATE[42S02]: Table 'b1g_timer_dev.timer_rooms' doesn't exist
  Stack: ...full stack trace...
```

---

## HTTP Status Codes

The handler supports all standard HTTP status codes:

| Code | Constant | Usage |
|------|----------|-------|
| **200** | `HTTP_OK` | Default for successful GET/PUT/DELETE |
| **201** | `HTTP_CREATED` | Resource created (POST) |
| **400** | `HTTP_BAD_REQUEST` | Validation failed |
| **401** | `HTTP_UNAUTHORIZED` | Authentication required (future) |
| **403** | `HTTP_FORBIDDEN` | Permission denied (future) |
| **404** | `HTTP_NOT_FOUND` | Resource not found |
| **409** | `HTTP_CONFLICT` | Resource conflict (future) |
| **500** | `HTTP_INTERNAL_SERVER_ERROR` | Server error (catch-all) |
| **503** | `HTTP_SERVICE_UNAVAILABLE` | Service unavailable (DB down) |

---

## Error Code Constants

All error responses use one of these predefined error codes:

| Constant | Usage |
|----------|-------|
| `ERROR_INVALID_INPUT` | Validation failed (400) |
| `ERROR_ROOM_NOT_FOUND` | Room ID doesn't exist (404) |
| `ERROR_TIMER_NOT_FOUND` | Timer ID doesn't exist (404) |
| `ERROR_DB_ERROR` | Database operation failed (500) |
| `ERROR_INTERNAL_ERROR` | Unexpected error (500) |
| `ERROR_UNAUTHORIZED` | Auth required (401) |
| `ERROR_FORBIDDEN` | Permission denied (403) |
| `ERROR_SERVICE_UNAVAILABLE` | Service down (503) |

---

## Integration Pattern (for API Endpoints)

### Complete Endpoint Example

**File: `api/v1/rooms.php` (GET single room)**

```php
<?php
/**
 * GET /api/v1/rooms/{id}
 * Fetch single room with timers
 */

require_once dirname(__DIR__, 2) . '/config/db.php';
require_once dirname(__DIR__, 2) . '/utils/error-handler.php';

try {
    // Extract room ID from URL
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $parts = explode('/', $path);
    $room_id = end($parts);
    
    // Fetch room
    $room = getRoomById(getPDOInstance(), $room_id);
    if (!$room) {
        sendNotFound("Room", $room_id);
    }
    
    // Fetch timers for room
    $timers = getRoomTimers(getPDOInstance(), $room_id);
    $room['timers'] = $timers;
    
    // Return success
    sendSuccess($room);
    
} catch (Exception $e) {
    // Database error
    sendDatabaseError("fetch room", $e);
}
?>
```

### Error Response Flow

```
Request: GET /api/v1/rooms/999
         ↓
Try block: getRoomById() returns null
         ↓
Check: if (!$room)
         ↓
sendNotFound("Room", 999)
         ↓
HTTP 404 + JSON:
{
  "error": "Room with ID '999' not found",
  "code": "ERROR_ROOM_NOT_FOUND",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_..."
}
```

---

## Request ID Tracking

Each response includes a unique `requestId` for debugging:

**Automatic Generation**:
```php
// If not provided, generates: req_1234567890.1234
$request_id = uniqid('req_', true);
```

**Manual Specification**:
```php
// Caller provides request ID from header or session
$request_id = $_SERVER['HTTP_X_REQUEST_ID'] ?? null;
sendSuccess($data, HTTP_OK, $request_id);
```

**Server Log** can trace all errors by request ID:
```
[API ERROR] [404] [ERROR_ROOM_NOT_FOUND] Room not found (RequestID: req_123abc)
```

---

## Constitution v1.1.0 Compliance

| Principle | Requirement | Implementation |
|-----------|-------------|-----------------|
| Section V | RESTful design + explicit status codes | ✅ 200, 201, 400, 404, 500, etc. |
| Section V | Consistent JSON error schema | ✅ standard { error, code, timestamp, requestId } |
| Section V | 400 Bad Request on validation | ✅ sendValidationError() |
| Section III | Error logging without exposure | ✅ Debug mode only, generic message to client |
| Dev Philosophy | Readability over cleverness | ✅ Comprehensive comments |

---

## Testing Procedures

### Test 1: Success Response (200 OK)
**Objective**: Verify structure and HTTP status

**Code**:
```php
ob_start();
sendSuccess(["id" => 1, "name" => "Test"]);
$output = ob_get_clean();

$response = json_decode($output, true);
assert(http_response_code() === 200);
assert($response['success'] === true);
assert($response['data']['id'] === 1);
assert(!empty($response['timestamp']));
assert(!empty($response['requestId']));
```

### Test 2: Created Response (201 Created)
**Objective**: Verify HTTP 201 on resource creation

**Code**:
```php
ob_start();
sendCreated(["id" => 3, "name" => "New Room"]);
$output = ob_get_clean();

$response = json_decode($output, true);
assert(http_response_code() === 201);
assert($response['success'] === true);
```

### Test 3: Validation Error (400 Bad Request)
**Objective**: Verify validation errors are reported

**Code**:
```php
ob_start();
sendValidationError(["Field X is required", "Field Y exceeds max length"]);
$output = ob_get_clean();

$response = json_decode($output, true);
assert(http_response_code() === 400);
assert($response['code'] === 'INVALID_INPUT');
assert(count($response['validation_errors']) === 2);
```

### Test 4: Not Found Error (404 Not Found)
**Objective**: Verify 404 for missing resources

**Code**:
```php
ob_start();
sendNotFound("Room", 999);
$output = ob_get_clean();

$response = json_decode($output, true);
assert(http_response_code() === 404);
assert($response['code'] === 'ERROR_ROOM_NOT_FOUND');
assert(strpos($response['error'], '999') !== false);
```

### Test 5: Database Error (500 Internal Server Error)
**Objective**: Verify DB errors return generic message

**Code**:
```php
$exception = new Exception("SQLSTATE[42S02]: Table doesn't exist");
ob_start();
sendDatabaseError("fetch room", $exception);
$output = ob_get_clean();

$response = json_decode($output, true);
assert(http_response_code() === 500);
assert($response['code'] === 'DATABASE_ERROR');
// Generic message (doesn't expose SQL details)
assert(strpos($response['error'], 'SQLSTATE') === false);
```

### Test 6: JSON Encoding (UTF-8MB4 + Emoji)
**Objective**: Verify emoji and special chars are encoded correctly

**Code**:
```php
ob_start();
sendSuccess(["title" => "🎉 Opening Ceremony 🎊"]);
$output = ob_get_clean();

$response = json_decode($output, true);
assert($response['data']['title'] === "🎉 Opening Ceremony 🎊");
// Verify emoji not escaped (JSON_UNESCAPED_UNICODE)
assert(strpos($output, "🎉") !== false);
```

---

## Key Design Decisions

### 1. Exit After Response
All functions `exit;` after output—ensures no accidental duplicate responses.

### 2. Automatic Request ID
If caller doesn't provide `$request_id`, generates unique one automatically for debugging.

### 3. Debug Mode Only Logging
Full exception details logged only if `APP_DEBUG == true`; production never exposes internals.

### 4. Consistent Timestamp Format
All responses use ISO8601 timestamps (`Y-m-d\TH:i:s\Z`), parsed identically by all clients.

### 5. JSON_UNESCAPED_UNICODE
Emoji and international characters preserved in JSON (not escaped as `\uxxxx`).

---

## Next Steps (Phase 2 Integration)

All Phase 2 endpoints use these functions:

1. **Task 2.1–2.5**: Room CRUD endpoints
   - sendSuccess() for GET/PUT
   - sendCreated() for POST
   - sendNotFound() for 404s
   - sendValidationError() for bad inputs

2. **Task 2.6**: Pusher broadcaster endpoint
   - sendSuccess() on event broadcast
   - sendError() on Pusher failures

3. **Task 2.7**: Health check endpoint
   - sendSuccess() for healthy status
   - sendDatabaseError() for connection failures

---

## Security Checklist

- ✅ Never expose internal error details to client
- ✅ Debug mode only for detailed logs
- ✅ All responses validated as JSON
- ✅ Request ID for audit trailing
- ✅ HTTP status codes used correctly
- ✅ Content-Type header set to JSON
- ✅ UTF-8MB4 support for international characters

---

**Status**: ✅ Task 1.5 Complete  
**Quality**: Production-ready, security-hardened, fully documented  
**Previous Task**: Task 1.4 (Input Validation)  
**Next Phase**: Phase 2 (Backend API)

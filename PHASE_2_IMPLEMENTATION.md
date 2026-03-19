# Phase 2 Implementation Guide: Backend API

**Phase**: 2 (Backend API & Real-Time Broadcasting)  
**Tasks**: 2.1–2.9  
**Status**: ✅ COMPLETE  
**Files Created**: 5 (rooms.php, broadcast.php, health.php, index.php, pusher.php, .htaccess)  

---

## Overview

Phase 2 implements the complete RESTful API backend with:
- **Room CRUD Endpoints**: Create, read, update, delete event rooms and timers
- **Pusher Real-Time Broadcasting**: WebSocket-based event broadcasting to Stage Display
- **Health Monitoring**: Database connectivity verification
- **URL Routing**: Clean API URLs without exposing `index.php`

All endpoints return consistent JSON responses using the error handler from Task 1.5.

---

## Architecture

### Request Flow

```
Client (Control Dashboard/Mobile)
    ↓
HTTP Request (GET/POST/PUT/DELETE)
    ↓
.htaccess (URL rewrite to api/index.php)
    ↓
api/index.php (Router/Dispatcher)
    ↓
Parse route: /api/v1/{resource}/{id?}
    ↓
Include appropriate handler:
  - api/v1/rooms.php (CRUD operations)
  - api/v1/broadcast.php (Event broadcasting)
  - api/v1/health.php (Status check)
    ↓
Handler processes request:
  - Validate input (middleware/validate.php)
  - Query/modify database (config/db.php)
  - Broadcast events (config/pusher.php)
  - Send JSON response (utils/error-handler.php)
    ↓
HTTP Response (JSON)
```

---

## Endpoints Reference

### 1. Room Management (api/v1/rooms.php)

#### GET /api/v1/rooms
**Task**: 2.1  
**Purpose**: Fetch all rooms  
**Response**: HTTP 200 + array of room objects

**Example Request**:
```bash
curl -X GET http://localhost/api/v1/rooms
```

**Example Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Main Event",
      "created_at": "2026-03-19T12:00:00Z",
      "updated_at": "2026-03-19T12:00:00Z"
    },
    {
      "id": 2,
      "name": "Breakout Room",
      "created_at": "2026-03-19T12:05:00Z",
      "updated_at": "2026-03-19T12:05:00Z"
    }
  ],
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_1234567890.1234"
}
```

---

#### GET /api/v1/rooms/{id}
**Task**: 2.2  
**Purpose**: Fetch single room with all timers  
**Response**: HTTP 200 + room object with timers array

**Example Request**:
```bash
curl -X GET http://localhost/api/v1/rooms/1
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Main Event",
    "timers": [
      {
        "id": 1,
        "title": "Opening Remarks",
        "duration_seconds": 300,
        "position": 0
      },
      {
        "id": 2,
        "title": "Keynote Address",
        "duration_seconds": 1800,
        "position": 1
      }
    ],
    "created_at": "2026-03-19T12:00:00Z",
    "updated_at": "2026-03-19T12:00:00Z"
  },
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_1234567890.1234"
}
```

**Error: 404 Not Found**:
```json
{
  "error": "Room with ID '999' not found",
  "code": "ERROR_ROOM_NOT_FOUND",
  "timestamp": "2026-03-19T12:34:56Z",
  "requestId": "req_1234567890.1234"
}
```

---

#### POST /api/v1/rooms
**Task**: 2.3  
**Purpose**: Create new room  
**Request Body**: `{ "name": "..." }`  
**Response**: HTTP 201 + newly created room object (with empty timers array)

**Example Request**:
```bash
curl -X POST http://localhost/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "New Event"}'
```

**Example Response** (HTTP 201 Created):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "New Event",
    "timers": [],
    "created_at": "2026-03-19T13:00:00Z",
    "updated_at": "2026-03-19T13:00:00Z"
  },
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

**Error: 400 Bad Request** (validation failed):
```json
{
  "error": "Request validation failed",
  "code": "INVALID_INPUT",
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234",
  "validation_errors": [
    "Room name exceeds 100 characters",
    "Room name contains invalid characters"
  ]
}
```

---

#### PUT /api/v1/rooms/{id}
**Task**: 2.4  
**Purpose**: Update room name and/or timers (upsert pattern)  
**Request Body**:
```json
{
  "name": "Updated Room Name",
  "timers": [
    {
      "id": 1,
      "title": "Cue 1 (Updated)",
      "duration_seconds": 300,
      "position": 0
    },
    {
      "id": 2,
      "title": "Cue 2 (Updated)",
      "duration_seconds": 600,
      "position": 1
    },
    {
      "id": null,
      "title": "Cue 3 (New)",
      "duration_seconds": 900,
      "position": 2
    }
  ]
}
```

**Response**: HTTP 200 + updated room object

**Example Request**:
```bash
curl -X PUT http://localhost/api/v1/rooms/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Event Updated",
    "timers": [
      {"id": 1, "title": "Cue 1", "duration_seconds": 300, "position": 0},
      {"id": 2, "title": "Cue 2", "duration_seconds": 600, "position": 1}
    ]
  }'
```

**Upsert Pattern**:
- Timer with `id` present and exists: UPDATE
- Timer with `id` present but doesn't exist: ignored or error
- Timer with `id` null: INSERT (creates new timer)
- Timer not in list: DELETE

**Example Response** (HTTP 200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Main Event Updated",
    "timers": [
      {"id": 1, "title": "Cue 1", "duration_seconds": 300, "position": 0},
      {"id": 2, "title": "Cue 2", "duration_seconds": 600, "position": 1},
      {"id": 3, "title": "Cue 3 (New)", "duration_seconds": 900, "position": 2}
    ],
    "created_at": "2026-03-19T12:00:00Z",
    "updated_at": "2026-03-19T13:00:00Z"
  },
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

---

#### DELETE /api/v1/rooms/{id}
**Task**: 2.5  
**Purpose**: Delete room (cascade deletes timers)  
**Response**: HTTP 200 + confirmation message

**Example Request**:
```bash
curl -X DELETE http://localhost/api/v1/rooms/1
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "message": "Room deleted successfully"
  },
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

---

### 2. Event Broadcasting (api/v1/broadcast.php)

#### POST /api/v1/broadcast
**Task**: 2.6  
**Purpose**: Broadcast timer control event via Pusher WebSockets  
**Request Body**:
```json
{
  "roomId": 1,
  "action": "TIMER_START",
  "payload": {
    "timerId": 1,
    "startTimeUTC": "2026-03-19T13:00:00Z"
  },
  "displayId": "stage-display-uuid-123"
}
```

**Response**: HTTP 200 + broadcast confirmation

**Allowed Actions** (15 total):
- `TIMER_START`, `TIMER_PAUSE`, `TIMER_RESUME`, `TIMER_STOP`, `TIMER_RESET`
- `TIMER_SKIP`, `NEXT_TIMER`, `PREVIOUS_TIMER`
- `BLACKOUT_ON`, `BLACKOUT_OFF`, `FLASH_TRIGGER`
- `MESSAGE_SHOW`, `MESSAGE_HIDE`
- `ROOM_UPDATED`, `TIME_ADJUSTMENT`

**Example Request**:
```bash
curl -X POST http://localhost/api/v1/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": 1,
    "action": "TIMER_START",
    "payload": {"timerId": 1},
    "displayId": "stage-display-uuid"
  }'
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "broadcastId": "bcast_1234567890.1234",
    "roomId": 1,
    "action": "TIMER_START",
    "channel": "presence-room-1",
    "timestamp": "2026-03-19T13:00:00Z"
  },
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

**Pusher Channel Name**: `presence-room-{roomId}`
- Single Pusher presence channel per room
- All connected devices (Control Dashboard, Mobile, Stage Display) receive events

**Error: 404 Room Not Found**:
```json
{
  "error": "Room with ID '999' not found",
  "code": "ERROR_ROOM_NOT_FOUND",
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

**Error: 400 Invalid Action**:
```json
{
  "error": "Request validation failed",
  "code": "INVALID_INPUT",
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234",
  "validation_errors": [
    "Invalid action 'INVALID_ACTION'. Allowed actions: TIMER_START, TIMER_PAUSE, ..."
  ]
}
```

**Error: 503 Service Unavailable** (Pusher down):
```json
{
  "error": "Real-time broadcast service unavailable. Stage Display may need to refresh manually.",
  "code": "ERROR_SERVICE_UNAVAILABLE",
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

---

### 3. Health Check (api/v1/health.php)

#### GET /api/v1/health
**Task**: 2.7  
**Purpose**: Verify API and database connectivity  
**Response**: HTTP 200 + status object

**Example Request**:
```bash
curl -X GET http://localhost/api/v1/health
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "apiVersion": "1.0.0",
    "timestamp": "2026-03-19T13:00:00Z"
  },
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

**Error: 503 Database Unavailable**:
```json
{
  "error": "Database connection failed. Service is temporarily unavailable.",
  "code": "ERROR_SERVICE_UNAVAILABLE",
  "timestamp": "2026-03-19T13:00:00Z",
  "requestId": "req_1234567890.1234"
}
```

---

## Configuration Files

### config/pusher.php (Task 2.6)

**Initialization**:
```php
<?php
require_once 'config/pusher.php';

// Get Pusher instance
$pusher = getPusherInstance();

// Broadcast event
$success = broadcastPusherEvent(
  getPusherChannelName(1),  // "presence-room-1"
  'TIMER_START',            // Event name
  ['timerId' => 1, ...]     // Payload
);
?>
```

**Environment Variables** (in `.env`):
```
PUSHER_KEY=app_id_from_pusher
PUSHER_SECRET=secret_key_from_pusher
PUSHER_CLUSTER=mt1
PUSHER_ENCRYPTED=1
```

**Key Functions**:
- `getPusherInstance()`: Lazy-loaded singleton, returns null if credentials not configured
- `broadcastPusherEvent($channel, $event, $data)`: Send event to Pusher
- `getPusherChannelName($room_id)`: Generate channel name (presence-room-{id})

---

## URL Routing (.htaccess)

The `.htaccess` file enables clean URLs:

| URL (User Types) | Actual File | Handler |
|---|---|---|
| `/api/v1/rooms` | `/api/index.php` | Router sends to `v1/rooms.php` |
| `/api/v1/rooms/1` | `/api/index.php` | Router sends to `v1/rooms.php` |
| `/api/v1/broadcast` | `/api/index.php` | Router sends to `v1/broadcast.php` |
| `/api/v1/health` | `/api/index.php` | Router sends to `v1/health.php` |

**Rewrite Rules**:
1. Allow direct access to existing files (images, CSS, JS)
2. Rewrite `/api/*` requests to `/api/index.php`
3. Rewrite other requests to `/public/index.php` (for frontend)

---

## Error Handling

All endpoints use the centralized error handler from Task 1.5. Standard error codes:

| Code | HTTP Status | Usage |
|------|-------------|-------|
| `ERROR_INVALID_INPUT` | 400 | Validation failed |
| `ERROR_ROOM_NOT_FOUND` | 404 | Room doesn't exist |
| `ERROR_TIMER_NOT_FOUND` | 404 | Timer doesn't exist |
| `ERROR_DB_ERROR` | 500 | Database operation failed |
| `ERROR_INTERNAL_ERROR` | 500 | Unexpected error |
| `ERROR_SERVICE_UNAVAILABLE` | 503 | Pusher/DB unavailable |

All error responses include:
- `error`: Human-readable message
- `code`: Machine-readable error code
- `timestamp`: ISO8601 timestamp
- `requestId`: Unique request identifier for debugging

---

## Testing Procedures

### Test 1: Fetch All Rooms (Task 2.1)
```bash
# Should return empty array on fresh database
curl -X GET http://localhost/api/v1/rooms
```

### Test 2: Create Room (Task 2.3)
```bash
curl -X POST http://localhost/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Event"}'
# Response should have HTTP 201 Created
```

### Test 3: Fetch Room with Timers (Task 2.2)
```bash
# Get the ID from create response, e.g., 1
curl -X GET http://localhost/api/v1/rooms/1
# Should return room with timers array
```

### Test 4: Update Room (Task 2.4)
```bash
curl -X PUT http://localhost/api/v1/rooms/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Event",
    "timers": [
      {"id": null, "title": "Cue 1", "duration_seconds": 300, "position": 0}
    ]
  }'
```

### Test 5: Broadcast Event (Task 2.6)
```bash
curl -X POST http://localhost/api/v1/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": 1,
    "action": "TIMER_START",
    "payload": {},
    "displayId": "test-display"
  }'
# Should return broadcastId in response
```

### Test 6: Health Check (Task 2.7)
```bash
curl -X GET http://localhost/api/v1/health
# Should return status: "ok" if database connected
```

### Test 7: 404 on Unknown Route
```bash
curl -X GET http://localhost/api/v1/unknown
# Should return 404 with error code "ENDPOINT_NOT_FOUND"
```

---

## Integration with Phase 1

| Phase 1 Component | Used By |
|---|---|
| `config/constants.php` | All endpoints (validation rules, action types) |
| `config/database.php` | All endpoints (database connection) |
| `config/db.php` | `rooms.php`, `broadcast.php`, `health.php` |
| `middleware/validate.php` | `rooms.php` (validate names, durations) |
| `utils/error-handler.php` | All endpoints (consistent JSON responses) |

---

## Next Steps (Phase 3)

Phase 3 will create the frontend HTML/CSS scaffolding:
- Control Dashboard HTML
- Stage Display HTML

Both will connect to these Phase 2 API endpoints via JavaScript and Pusher SDK.

---

**Status**: ✅ Phase 2 Complete (9/9 tasks)  
**Ready for**: Phase 3 (Frontend Scaffolding)  
**Token Budget**: ~110K remaining (55% of 200K)

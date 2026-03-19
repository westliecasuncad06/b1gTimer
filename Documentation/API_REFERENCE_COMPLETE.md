# B1G Timer - Complete API Reference

**Version**: 1.0  
**Base URL**: `https://yourdomain.com/api/v1`  
**Authentication**: None (public API for MVP)  
**Response Format**: JSON  

---

## Table of Contents

1. [Health Check](#health-check)
2. [Rooms](#rooms)
3. [Timers](#timers)
4. [Broadcast](#broadcast)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [WebSocket Events](#websocket-events)

---

## Health Check

### GET /health

Check system status and database connectivity.

**Request**:
```bash
curl https://yourdomain.com/api/v1/health
```

**Response** (200 OK):
```json
{
    "success": true,
    "status": "ok",
    "database": "connected",
    "pusher": "connected",
    "timestamp": "2026-03-19T12:00:00Z",
    "version": "1.0"
}
```

**Use Case**: 
- Monitor system health
- Verify API connectivity
- Pre-flight test before using other endpoints

---

## Rooms

### GET /rooms

Get all rooms.

**Request**:
```bash
curl https://yourdomain.com/api/v1/rooms
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "rooms": [
            {
                "id": 1,
                "name": "Tech Conference 2026",
                "created_at": "2026-03-19T10:00:00Z",
                "updated_at": "2026-03-19T10:15:00Z",
                "timer_count": 5
            },
            {
                "id": 2,
                "name": "Annual Meetup",
                "created_at": "2026-03-19T14:30:00Z",
                "updated_at": "2026-03-19T14:30:00Z",
                "timer_count": 3
            }
        ],
        "total": 2
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Parameters**: None

**Response Codes**:
- **200**: Success
- **500**: Database error

---

### GET /rooms/{id}

Get specific room with all timers.

**Request**:
```bash
curl https://yourdomain.com/api/v1/rooms/1
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "room": {
            "id": 1,
            "name": "Tech Conference 2026",
            "created_at": "2026-03-19T10:00:00Z",
            "updated_at": "2026-03-19T10:15:00Z"
        },
        "timers": [
            {
                "id": 1,
                "room_id": 1,
                "title": "Registration",
                "duration_seconds": 1800,
                "order_index": 0,
                "created_at": "2026-03-19T10:00:00Z"
            },
            {
                "id": 2,
                "room_id": 1,
                "title": "Keynote",
                "duration_seconds": 2700,
                "order_index": 1,
                "created_at": "2026-03-19T10:00:30Z"
            }
        ]
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Parameters**:
- `id` (required): Room ID

**Response Codes**:
- **200**: Success
- **404**: Room not found
- **500**: Database error

---

### POST /rooms

Create new room.

**Request**:
```bash
curl -X POST https://yourdomain.com/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Event"
  }'
```

**Request Body**:
```json
{
    "name": "New Event"
}
```

**Response** (201 Created):
```json
{
    "success": true,
    "data": {
        "id": 3,
        "name": "New Event",
        "created_at": "2026-03-19T12:00:00Z",
        "updated_at": "2026-03-19T12:00:00Z"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Validation**:
- `name` required, max 100 characters
- Cannot be empty or whitespace-only

**Response Codes**:
- **201**: Created
- **400**: Invalid input (missing name, too long, etc.)
- **500**: Database error

---

### PUT /rooms/{id}

Update room (name and/or timers).

**Request**:
```bash
curl -X PUT https://yourdomain.com/api/v1/rooms/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "timers": [
      {
        "id": 1,
        "title": "Registration",
        "duration_seconds": 1800,
        "order_index": 0
      },
      {
        "id": 2,
        "title": "Keynote",
        "duration_seconds": 2700,
        "order_index": 1
      }
    ]
  }'
```

**Request Body**:
```json
{
    "name": "Updated Name",
    "timers": [
        {
            "id": 1,
            "title": "Registration",
            "duration_seconds": 1800,
            "order_index": 0
        }
    ]
}
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "id": 1,
        "name": "Updated Name",
        "updated_at": "2026-03-19T12:05:00Z",
        "timers_updated": 1
    },
    "timestamp": "2026-03-19T12:05:00Z"
}
```

**Validation**:
- `name` optional, max 100 chars if provided
- `timers` optional array
- Each timer must have `title` (max 100), `duration_seconds` (0-36000), `order_index`

**Response Codes**:
- **200**: Updated
- **400**: Invalid input
- **404**: Room not found
- **500**: Database error

---

### DELETE /rooms/{id}

Delete room and all associated timers.

**Request**:
```bash
curl -X DELETE https://yourdomain.com/api/v1/rooms/1
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "id": 1,
        "deleted": true,
        "timers_deleted": 5
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Note**: Cascade delete removes all timers for this room

**Response Codes**:
- **200**: Deleted
- **404**: Room not found
- **500**: Database error

---

## Timers

### GET /rooms/{roomId}/timers

Get all timers for a room (alternative to GET /rooms/{id}).

**Request**:
```bash
curl https://yourdomain.com/api/v1/rooms/1/timers
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "room_id": 1,
        "timers": [
            {
                "id": 1,
                "title": "Registration",
                "duration_seconds": 1800,
                "order_index": 0
            },
            {
                "id": 2,
                "title": "Keynote",
                "duration_seconds": 2700,
                "order_index": 1
            }
        ]
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Response Codes**:
- **200**: Success
- **404**: Room not found
- **500**: Database error

---

### POST /rooms/{roomId}/timers

Add timer to room.

**Request**:
```bash
curl -X POST https://yourdomain.com/api/v1/rooms/1/timers \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Session 1",
    "duration_seconds": 3600,
    "order_index": 2
  }'
```

**Request Body**:
```json
{
    "title": "Session 1",
    "duration_seconds": 3600,
    "order_index": 2
}
```

**Response** (201 Created):
```json
{
    "success": true,
    "data": {
        "id": 3,
        "room_id": 1,
        "title": "Session 1",
        "duration_seconds": 3600,
        "order_index": 2,
        "created_at": "2026-03-19T12:00:00Z"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Validation**:
- `title` required, max 100 characters
- `duration_seconds` required, 0-36000 range (0-600 minutes)
- `order_index` required, non-negative integer

**Response Codes**:
- **201**: Created
- **400**: Invalid input
- **404**: Room not found
- **500**: Database error

---

### PUT /rooms/{roomId}/timers/{timerId}

Update timer.

**Request**:
```bash
curl -X PUT https://yourdomain.com/api/v1/rooms/1/timers/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Registration (Updated)",
    "duration_seconds": 2400,
    "order_index": 0
  }'
```

**Request Body**:
```json
{
    "title": "Registration (Updated)",
    "duration_seconds": 2400,
    "order_index": 0
}
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "id": 1,
        "room_id": 1,
        "title": "Registration (Updated)",
        "duration_seconds": 2400,
        "order_index": 0,
        "updated_at": "2026-03-19T12:05:00Z"
    },
    "timestamp": "2026-03-19T12:05:00Z"
}
```

**Response Codes**:
- **200**: Updated
- **400**: Invalid input
- **404**: Timer or room not found
- **500**: Database error

---

### DELETE /rooms/{roomId}/timers/{timerId}

Delete timer.

**Request**:
```bash
curl -X DELETE https://yourdomain.com/api/v1/rooms/1/timers/1
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "id": 1,
        "deleted": true
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Response Codes**:
- **200**: Deleted
- **404**: Timer or room not found
- **500**: Database error

---

## Broadcast

### POST /broadcast/message

Send message to all displays in a room via Pusher.

**Request**:
```bash
curl -X POST https://yourdomain.com/api/v1/broadcast/message \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "text": "Next up: Keynote!",
    "color": "#FF0000",
    "is_bold": true,
    "font_size": 48
  }'
```

**Request Body**:
```json
{
    "room_id": 1,
    "text": "Next up: Keynote!",
    "color": "#FF0000",
    "is_bold": true,
    "font_size": 48
}
```

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "broadcasted": true,
        "displays_count": 2,
        "timestamp_sent": "2026-03-19T12:00:00Z"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Validation**:
- `room_id` required
- `text` required, max 255 characters
- `color` optional, hex color code (e.g., "#FF0000")
- `is_bold` optional, boolean
- `font_size` optional, integer 24-64

**Response Codes**:
- **200**: Broadcast sent
- **400**: Invalid input
- **404**: Room not found
- **500**: Broadcast service error

---

### POST /broadcast/action

Send action (timer control) to all displays.

**Request**:
```bash
curl -X POST https://yourdomain.com/api/v1/broadcast/action \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "action": "TIMER_START",
    "payload": {
      "timer_id": 1,
      "duration_seconds": 2700
    }
  }'
```

**Request Body**:
```json
{
    "room_id": 1,
    "action": "TIMER_START",
    "payload": {
        "timer_id": 1,
        "duration_seconds": 2700
    }
}
```

**Supported Actions**:

| Action | Payload | Meaning |
|--------|---------|---------|
| TIMER_START | {timer_id, duration_seconds} | Start countdown |
| TIMER_PAUSE | {} | Pause countdown |
| TIMER_RESUME | {} | Resume countdown |
| TIMER_STOP | {} | Stop timer |
| TIME_ADJUST | {adjustment_seconds} | Add/subtract time |
| BLACKOUT_ON | {} | Dark screen |
| BLACKOUT_OFF | {} | Normal screen |
| FLASH_TRIGGER | {duration_ms} | Brief white flash |
| NEXT_TIMER | {} | Advance to next |
| TIMERS_REORDERED | {timers: []} | Timers reordered |

**Response** (200 OK):
```json
{
    "success": true,
    "data": {
        "action": "TIMER_START",
        "broadcasted": true,
        "displays_count": 2
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Response Codes**:
- **200**: Action broadcast
- **400**: Invalid action or payload
- **404**: Room not found
- **500**: Broadcast service error

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
    "success": false,
    "error": "Error message describing what went wrong",
    "code": "ERROR_CODE",
    "details": {
        "field": "message"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|------------|---------|
| VALIDATION_ERROR | 400 | Invalid input (missing/malformed data) |
| NOT_FOUND | 404 | Resource doesn't exist |
| DATABASE_ERROR | 500 | Database connection or query failed |
| BROADCAST_ERROR | 500 | Pusher broadcast failed |
| INVALID_REQUEST | 400 | Request format invalid (not JSON, etc.) |
| UNAUTHORIZED | 401 | Authentication required (future) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |

### Example Error Responses

**Missing Required Field**:
```json
{
    "success": false,
    "error": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
        "name": "Name is required"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Resource Not Found**:
```json
{
    "success": false,
    "error": "Room not found",
    "code": "NOT_FOUND",
    "details": {
        "room_id": "1"
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

**Database Error**:
```json
{
    "success": false,
    "error": "Database connection failed",
    "code": "DATABASE_ERROR",
    "timestamp": "2026-03-19T12:00:00Z"
}
```

---

## Rate Limiting

### Rate Limits (Per Minute)

| Endpoint | Limit | Window |
|----------|-------|--------|
| GET /rooms | 60 | 1 minute |
| POST /rooms | 10 | 1 minute |
| PUT /rooms/{id} | 30 | 1 minute |
| POST /broadcast/* | 100 | 1 minute |
| GET /health | 120 | 1 minute |

### Rate Limit Headers

Responses include rate limit info:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1647700200
```

### Rate Limited Response (429)

```json
{
    "success": false,
    "error": "Rate limit exceeded",
    "code": "RATE_LIMITED",
    "details": {
        "limit": 60,
        "reset_in_seconds": 30
    },
    "timestamp": "2026-03-19T12:00:00Z"
}
```

---

## WebSocket Events (Pusher)

### Channel Name

```
presence-room-{room_id}
```

**Example**: `presence-room-1` for room with ID 1

### Events Sent to Clients

**TIMER_STARTED**:
```json
{
    "event": "TIMER_STARTED",
    "data": {
        "timer_id": 1,
        "duration_seconds": 2700,
        "started_at": "2026-03-19T12:00:00Z"
    }
}
```

**MESSAGE_SHOWN**:
```json
{
    "event": "MESSAGE_SHOWN",
    "data": {
        "text": "Next up: Keynote!",
        "color": "#FF0000",
        "is_bold": true,
        "font_size": 48,
        "shown_at": "2026-03-19T12:00:00Z"
    }
}
```

**BLACKOUT_ON**:
```json
{
    "event": "BLACKOUT_ON",
    "data": {
        "enabled": true,
        "timestamp": "2026-03-19T12:00:00Z"
    }
}
```

**DISPLAY_CONNECTED**:
```json
{
    "event": "DISPLAY_CONNECTED",
    "data": {
        "display_id": "unique_id",
        "timestamp": "2026-03-19T12:00:00Z",
        "total_displays": 2
    }
}
```

**DISPLAY_DISCONNECTED**:
```json
{
    "event": "DISPLAY_DISCONNECTED",
    "data": {
        "display_id": "unique_id",
        "timestamp": "2026-03-19T12:00:00Z",
        "total_displays": 1
    }
}
```

---

## Request/Response Examples

### Complete Workflow Example

**1. Create Room**:
```bash
curl -X POST https://yourdomain.com/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "My Conference"}'
```

Response: `{"id": 1, ...}`

**2. Add Timers**:
```bash
curl -X POST https://yourdomain.com/api/v1/rooms/1/timers \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Keynote",
    "duration_seconds": 2700,
    "order_index": 0
  }'
```

Response: `{"id": 1, ...}`

**3. Start Timer**:
```bash
curl -X POST https://yourdomain.com/api/v1/broadcast/action \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "action": "TIMER_START",
    "payload": {"timer_id": 1, "duration_seconds": 2700}
  }'
```

Response: `{"broadcasted": true, ...}`

**4. Send Message**:
```bash
curl -X POST https://yourdomain.com/api/v1/broadcast/message \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": 1,
    "text": "Welcome everyone!",
    "color": "#0000FF",
    "is_bold": true,
    "font_size": 48
  }'
```

Response: `{"broadcasted": true, ...}`

---

## Testing the API

### Using cURL

```bash
# Test health endpoint
curl https://yourdomain.com/api/v1/health

# Get all rooms (verbose)
curl -v https://yourdomain.com/api/v1/rooms

# Create room (with headers)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}' \
  https://yourdomain.com/api/v1/rooms
```

### Using Postman

1. Create new request in Postman
2. Set method: `GET`, `POST`, `PUT`, or `DELETE`
3. Set URL: `https://yourdomain.com/api/v1/rooms`
4. Add header: `Content-Type: application/json`
5. Add request body (for POST/PUT)
6. Click "Send"

### Using JavaScript (Frontend)

```javascript
// Make API request
fetch('https://yourdomain.com/api/v1/rooms', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: 'My Event'
    })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

---

**API Reference Version**: 1.0  
**Last Updated**: March 19, 2026  
**Status**: Production Ready


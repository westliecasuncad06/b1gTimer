# Task 1.4 Implementation Guide: Input Validation Utility

**Task**: Create Input Validation Utility  
**Phase**: 1 (Database Infrastructure)  
**Files Created**: `api/middleware/validate.php`  
**Dependencies**: None (standalone utility)  
**Integration**: Used by all Phase 2 API endpoints (Tasks 2.1–2.9)  

---

## Overview

Task 1.4 creates a centralized validation library that:
- **Validates input** from all API requests (room names, timer titles, durations, messages)
- **Sanitizes** HTML/script tags and dangerous content (XSS prevention)
- **Returns consistent format**: `{ valid: bool, errors: array, sanitized: data }`
- **Complies with Constitution v1.1.0** Section III (Security & Data Integrity)

This module prevents invalid data from reaching the database and provides clear error messages to API clients.

---

## File: `api/middleware/validate.php` (Production-Ready)

### Purpose
Defensive input validation with attack prevention.

**Security Features**:
- Strip HTML/script tags via `strip_tags()`
- Escape HTML entities for display
- Regex pattern matching (alphanumeric constraints)
- UTF-8MB4 support for emoji and international characters
- Defense-in-depth (multiple layers of checks)

---

## Validation Functions

### 1. `validateRoomName($name)`
**Purpose**: Validate room names for creation/update

**Rules**:
- Required (not empty)
- Max 100 characters
- Alphanumeric + spaces + hyphens only
- No HTML/script tags

**Input**:
```php
validateRoomName("Main Event Hall");
```

**Output (Valid)**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => "Main Event Hall"
]
```

**Output (Invalid)**:
```php
[
  "valid" => false,
  "errors" => [
    "Room name contains invalid characters. Use only letters, numbers, spaces, and hyphens."
  ]
]
```

**Attack Defense**:
- Input: `"<script>alert('xss')</script>Main Event"`
- Output errors: `["Room name contains HTML/script tags which have been removed"]`

### 2. `validateTimerTitle($title)`
**Purpose**: Validate timer titles (more permissive than room names)

**Rules**:
- Required (not empty)
- Max 100 characters (supporting emoji)
- Allow most printable characters except HTML/script tags
- Support emoji (UTF-8MB4)

**Input**:
```php
validateTimerTitle("🎉 Opening Ceremony 🎊");
```

**Output (Valid)**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => "🎉 Opening Ceremony 🎊"
]
```

**Difference from Room Name**:
- Room name: Restricted to alphanumeric + spaces/hyphens
- Timer title: Any printable character (except HTML/script tags)

### 3. `validateDurationSeconds($seconds)`
**Purpose**: Validate timer duration in seconds

**Rules**:
- Required
- Must be integer (no floats)
- Range: 0–36000 seconds (0–10 hours)
- Non-negative

**Input Variations**:
```php
validateDurationSeconds(600);        // Integer → valid
validateDurationSeconds("600");      // String "600" → valid (converted)
validateDurationSeconds("600.5");    // Float string → invalid
validateDurationSeconds(-100);       // Negative → invalid
validateDurationSeconds(50000);      // Exceeds max → invalid
```

**Output (Valid)**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => 600
]
```

**Output (Invalid)**:
```php
[
  "valid" => false,
  "errors" => ["Duration exceeds maximum of 36000 seconds (10 hours). Provided: 50000"]
]
```

### 4. `validateMessageText($text)`
**Purpose**: Validate message text for display on stage

**Rules**:
- Optional (empty is allowed)
- Max 255 characters
- Support emoji and special characters
- Strip HTML/script tags

**Input**:
```php
validateMessageText("Next speaker: Jane Doe");
```

**Output (Valid)**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => "Next speaker: Jane Doe"
]
```

**Empty Input**:
```php
validateMessageText("");  // Valid (empty message is OK)
```

---

## Advanced Validation Functions

### 5. `validateTimerObject($timer)`
**Purpose**: Validate a single timer object (for PUT operations)

**Input Schema**:
```php
$timer = [
  "id" => 1,                    // Optional (omitted on create)
  "title" => "Opening",         // Required
  "duration_seconds" => 600,    // Required
  "position" => 1               // Optional (auto-generated if missing)
];
```

**Output**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => [
    "id" => 1,
    "title" => "Opening",
    "duration_seconds" => 600,
    "position" => 1
  ]
]
```

**Use Case**: Validating a single timer before database insert/update

### 6. `validateTimerArray($timers, $max_timers = 100)`
**Purpose**: Validate array of timers (for room updates)

**Input**:
```php
$timers = [
  ["title" => "Opening", "duration_seconds" => 600],
  ["title" => "Session 1", "duration_seconds" => 900],
  ["title" => "Break", "duration_seconds" => 300]
];
$result = validateTimerArray($timers, 100);
```

**Output (Valid)**:
```php
[
  "valid" => true,
  "errors" => [],
  "sanitized" => [
    ["title" => "Opening", "duration_seconds" => 600, ...],
    ["title" => "Session 1", "duration_seconds" => 900, ...],
    ["title" => "Break", "duration_seconds" => 300, ...]
  ]
]
```

**Output (Invalid)**:
```php
[
  "valid" => false,
  "errors" => [
    "Timer #1: Timer title is required",
    "Timer #2: Duration exceeds maximum of 36000 seconds (10 hours). Provided: 50000"
  ]
]
```

**Use Case**: Validating multiple timers in a PUT request to update a room

---

## Integration Pattern (for API Endpoints)

### Pattern: Validate Before Save

**Example: POST /api/v1/rooms (create room)**

```php
<?php
require_once dirname(__DIR__) . '/middleware/validate.php';
require_once dirname(__DIR__) . '/utils/error-handler.php';
require_once dirname(__DIR__) . '/config/db.php';

$request = json_decode(file_get_contents('php://input'), true);

// 1. VALIDATE
$name_result = validateRoomName($request['name'] ?? '');
if (!$name_result['valid']) {
    sendValidationError($name_result['errors']);
}

// 2. SANITIZE
$room_name = $name_result['sanitized'];

// 3. SAVE (using sanitized data)
try {
    $room_id = createRoom(getPDOInstance(), $room_name);
    sendCreated(["id" => $room_id, "name" => $room_name]);
} catch (Exception $e) {
    sendDatabaseError("create room", $e);
}
?>
```

### Pattern: Batch Validation

**Example: PUT /api/v1/rooms/{id} (update room + timers)**

```php
<?php
require_once dirname(__DIR__) . '/middleware/validate.php';

$request = json_decode(file_get_contents('php://input'), true);

// Validate room name
$room_result = validateRoomName($request['name'] ?? '');
if (!$room_result['valid']) {
    sendValidationError($room_result['errors']);
}

// Validate timer array
$timers_result = validateTimerArray($request['timers'] ?? [], 100);
if (!$timers_result['valid']) {
    sendValidationError($timers_result['errors']);
}

// Both valid → proceed to save
$sanitized_timers = $timers_result['sanitized'];
// ... database operations ...
?>
```

---

## Constitution v1.1.0 Compliance

| Principle | Requirement | Implementation |
|-----------|-------------|-----------------|
| Section III | Validate & sanitize all POST/GET data | ✅ strip_tags(), regex, XSS checks |
| Section V | 400 Bad Request on validation failure | ✅ sendValidationError() → HTTP 400 |
| Dev Philosophy | Readability over cleverness | ✅ Comprehensive comments per function |
| Backend API | Consistent error schema | ✅ validation_errors array in response |

---

## Testing Procedures

### Test 1: Valid Room Name
**Objective**: Confirm valid room names pass

**Code**:
```php
$result = validateRoomName("Main Event Hall");
assert($result['valid'] === true);
assert(empty($result['errors']));
assert($result['sanitized'] === "Main Event Hall");
```

### Test 2: Invalid Room Name (Too Long)
**Objective**: Reject oversized room names

**Code**:
```php
$long_name = str_repeat("A", 101);
$result = validateRoomName($long_name);
assert($result['valid'] === false);
assert(count($result['errors']) > 0);
assert(strpos($result['errors'][0], "exceeds 100 characters") !== false);
```

### Test 3: Room Name with HTML Tags (XSS Attack)
**Objective**: Strip HTML and flag as error

**Code**:
```php
$result = validateRoomName("<script>alert('xss')</script>Room");
assert($result['valid'] === false);
assert(strpos($result['errors'][0], "HTML/script tags") !== false);
```

### Test 4: Valid Duration (Integer)
**Objective**: Accept integer seconds

**Code**:
```php
$result = validateDurationSeconds(600);
assert($result['valid'] === true);
assert($result['sanitized'] === 600);
```

### Test 5: Valid Duration (String)
**Objective**: Convert numeric string to integer

**Code**:
```php
$result = validateDurationSeconds("600");
assert($result['valid'] === true);
assert($result['sanitized'] === 600);
assert(is_int($result['sanitized']));
```

### Test 6: Invalid Duration (Float)
**Objective**: Reject float values

**Code**:
```php
$result = validateDurationSeconds("600.5");
assert($result['valid'] === false);
assert(strpos($result['errors'][0], "whole number") !== false);
```

### Test 7: Invalid Duration (Exceeds Max)
**Objective**: Reject durations > 36000 seconds

**Code**:
```php
$result = validateDurationSeconds(50000);
assert($result['valid'] === false);
assert(strpos($result['errors'][0], "exceeds maximum") !== false);
```

### Test 8: Valid Timer Array
**Objective**: Accept array of valid timers

**Code**:
```php
$timers = [
  ["title" => "Opening", "duration_seconds" => 600],
  ["title" => "Break", "duration_seconds" => 300]
];
$result = validateTimerArray($timers, 100);
assert($result['valid'] === true);
assert(count($result['sanitized']) === 2);
```

### Test 9: Timer Array Exceeds Limit
**Objective**: Reject array with too many timers

**Code**:
```php
$timers = array_fill(0, 101, ["title" => "Timer", "duration_seconds" => 600]);
$result = validateTimerArray($timers, 100);
assert($result['valid'] === false);
assert(strpos($result['errors'][0], "exceeds maximum") !== false);
```

### Test 10: Emoji Support (UTF-8MB4)
**Objective**: Accept emoji in timer titles

**Code**:
```php
$result = validateTimerTitle("🎉 Opening Ceremony 🎊");
assert($result['valid'] === true);
assert(strpos($result['sanitized'], "🎉") !== false);
```

---

## Key Design Decisions

### 1. Consistent Return Format
All functions return `{ valid: bool, errors: array, sanitized: ? }` for predictable integration.

### 2. Defense-in-Depth
Multiple checks (length, pattern, strip_tags, XSS patterns) ensure no attack vectors slip through.

### 3. UTF-8MB4 Support
Using `mb_strlen()` for character counting ensures emoji is counted correctly (1 emoji = 1 character, not 4 bytes).

### 4. Separate Sanitization
`sanitized` field provides cleaned data—always use this for database operations, never the original input.

### 5. Batch Validation
`validateTimerArray()` validates multiple items with per-item error reporting, critical for room updates.

---

## Next Steps (Phase 2 Integration)

All Phase 2 endpoints now validate before saving:

1. **Task 2.1**: GET /api/v1/rooms (no validation needed)
2. **Task 2.2**: GET /api/v1/rooms/{id} (no validation needed)
3. **Task 2.3**: POST /api/v1/rooms → validateRoomName()
4. **Task 2.4**: PUT /api/v1/rooms/{id} → validateRoomName() + validateTimerArray()
5. **Task 2.5**: DELETE /api/v1/rooms/{id} (no validation needed)
6. **Task 2.6**: POST /api/v1/broadcast → validate action type + payload
7. **Task 4.2–4.8**: Frontend validation mirrors these rules (client-side duplicate)

---

## Security Checklist

- ✅ HTML/script tags stripped (strip_tags())
- ✅ XSS patterns detected and flagged (regex checks)
- ✅ All string inputs validated for length
- ✅ Type checking enforced (integers vs strings)
- ✅ Range checking enforced (duration boundaries)
- ✅ UTF-8MB4 support (emoji, internationalization)
- ✅ Error messages never expose internals

---

**Status**: ✅ Task 1.4 Complete  
**Quality**: Production-ready, security-hardened, fully documented  
**Next Task**: Task 1.5 (Error Response Handler)

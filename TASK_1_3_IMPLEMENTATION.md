# Task 1.3 Implementation Guide: PDO Database Connection Setup

**Task**: Set Up PDO Database Connection  
**Phase**: 1 (Database Infrastructure)  
**Files Created**: `api/config/db.php`  
**Dependencies**: Tasks 1.1, 1.2  
**Integration**: Used by all Phase 2 API endpoints (Tasks 2.1–2.9)  

---

## Overview

Task 1.3 creates a centralized PDO (PHP Data Objects) connection module that:
- **Lazy-loads** a single database connection (singleton pattern)
- **Wraps prepared statements** for SQL injection prevention
- **Provides helper functions** for common queries
- **Handles errors gracefully** with debug logging
- **Integrates** with Tasks 1.1 (.env) and 1.2 (database schema)

This is the foundation for all backend API endpoints—no direct SQL queries bypass this layer.

---

## File: `api/config/db.php` (Production-Ready)

### Purpose
Centralizes PDO initialization and query execution with safety features:
- **Prepared statements mandatory** (parameterized, SQL injection-safe)
- **Singleton pattern** prevents connection leaks
- **UTF-8MB4 charset** set at connection level
- **Exception error mode** ensures errors are caught
- **Debug logging** helps troubleshoot issues

### Key Functions

#### 1. `getPDOInstance()`
Returns the singleton PDO connection. Call this from API endpoints:

```php
$pdo = getPDOInstance(); // Returns cached connection
$pdo = getPDOInstance(); // Same instance, no new connection
```

**How It Works**:
- On first call: `createDatabaseConnection()` initializes
- On subsequent calls: returns cached `$_pdo_instance`
- Saves resources: only 1 connection per request

**Error Handling**:
- Throws `Exception` if connection fails
- Catch in API endpoints and return 500 error response

#### 2. `executePreparedStatement($connection, $sql, $params)`
Safely executes parameterized queries:

```php
$stmt = executePreparedStatement(
  getPDOInstance(),
  'SELECT * FROM timer_rooms WHERE id = ?',
  [123]
);
$room = $stmt->fetch(PDO::FETCH_ASSOC);
```

**Security**:
- `?` placeholders auto-bound to `$params` array
- No string concatenation = zero SQL injection risk
- Consistent error logging

**Return Value**:
- `PDOStatement` object (caller fetches rows)
- Caller chooses fetch mode: `fetch()`, `fetchAll()`, etc.

#### 3. Helper Functions
Convenience wrappers for common operations:

| Function | Purpose | Return |
|----------|---------|--------|
| `getAllRooms($pdo, $limit, $offset)` | Fetch paginated rooms | Array of room objects |
| `getRoomById($pdo, $room_id)` | Fetch single room | Room object or null |
| `getRoomTimers($pdo, $room_id)` | Fetch room's timers (sorted) | Array of timer objects |
| `createRoom($pdo, $name)` | Insert new room | Room ID or FALSE |
| `createTimer($pdo, $room_id, $title, $duration, $position)` | Insert timer | Timer ID or FALSE |

**Example**:
```php
$room_id = createRoom(getPDOInstance(), "Main Event");
if ($room_id) {
  error_log("Room created: $room_id");
} else {
  error_log("Room creation failed");
}
```

---

## Configuration & Connection Details

### Environment Variables (from `.env`)
```
DB_HOST=localhost       # MySQL server address
DB_PORT=3306           # MySQL port
DB_USER=root           # Database user
DB_PASSWORD=           # Database password (empty for local dev)
DB_NAME=b1g_timer_dev  # Database name
```

### Connection Settings
| Setting | Value | Reason |
|---------|-------|--------|
| **Charset** | `utf8mb4` | Supports emoji, special characters |
| **Error Mode** | `PDOException` | Throws on error (catch with try-catch) |
| **Timeout** | 30 seconds | Prevents hanging on slow/unavailable servers |
| **Emulate Prepares** | `false` | Real prepared statements (InfinityFree compatible) |

### DSN (Data Source Name) Example
For local development:
```
mysql:host=localhost;port=3306;dbname=b1g_timer_dev;charset=utf8mb4
```

For production (InfinityFree):
```
mysql:host=pro.hosting.server;port=3306;dbname=cpXXXXXX_b1g_timer;charset=utf8mb4
```

---

## Integration with Phase 1 Tasks

### Task 1.1 (Config)
- **Provides**: `config/database.php` (env loader)
- **Uses**: `.env` file with credentials
- **Output**: Foundation for `db.php` to load

### Task 1.2 (Schema)
- **Provides**: `database/schema.sql` (table definitions)
- **Uses**: `db.php` to connect and create tables
- **Verification**: `executePreparedStatement()` queries schema

### Task 1.3 (This File)
- **Depends on**: Tasks 1.1, 1.2 setup complete
- **Provides**: PDO connection to all Phase 2 endpoints
- **Quality**: Syntax-valid, security-hardened, production-ready

---

## Quick Start Guide

### Step 1: Verify Prerequisites
- `.env` file created and filled with credentials (Task 1.1) ✅
- MySQL database created and schema imported (Task 1.2) ✅

### Step 2: Load the Connection Module in Your API Endpoint
```php
<?php
// In any API endpoint file (e.g., api/v1/rooms.php)

require_once dirname(__DIR__) . '/config/db.php';

// Get the singleton connection
$pdo = getPDOInstance();

// Now use it
$rooms = getAllRooms($pdo, 50, 0); // Fetch first 50 rooms
?>
```

### Step 3: Handle Errors Gracefully
```php
try {
  $pdo = getPDOInstance();
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => 'Database connection failed']);
  exit;
}
```

---

## Testing Procedures

### Test 1: Connection Initialization
**Objective**: Verify PDO instance is created without errors

**Steps**:
1. Create test file: `test-db-connection.php`
   ```php
   <?php
   require_once 'api/config/db.php';
   try {
     $pdo = getPDOInstance();
     echo "✅ Connection successful\n";
     echo "Driver: " . $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) . "\n";
   } catch (Exception $e) {
     echo "❌ Connection failed: " . $e->getMessage() . "\n";
   }
   ?>
   ```
2. Run: `php test-db-connection.php`
3. Expected output: `✅ Connection successful` + driver info

### Test 2: Prepared Statement Execution
**Objective**: Verify parameterized queries work

**Steps**:
1. Extend test file:
   ```php
   $result = executePreparedStatement(
     $pdo,
     'SELECT COUNT(*) as count FROM timer_rooms',
     []
   );
   $row = $result->fetch(PDO::FETCH_ASSOC);
   echo "Rooms in database: " . $row['count'] . "\n";
   ```
2. Run: `php test-db-connection.php`
3. Expected output: Room count from database

### Test 3: Helper Function Usage
**Objective**: Test convenience wrapper functions

**Steps**:
1. Add test helpers:
   ```php
   // Test create room
   $room_id = createRoom($pdo, "Test Room");
   if ($room_id) {
     echo "✅ Created room: $room_id\n";
     
     // Test retrieve
     $room = getRoomById($pdo, $room_id);
     echo "✅ Retrieved room: " . $room['name'] . "\n";
   }
   ```
2. Run and verify output
3. Cleanup: Delete test data from database

### Test 4: Singleton Pattern Verification
**Objective**: Confirm only one connection per request

**Steps**:
```php
$conn1 = getPDOInstance();
$conn2 = getPDOInstance();
if ($conn1 === $conn2) {
  echo "✅ Singleton pattern works\n";
} else {
  echo "❌ Multiple connections created\n";
}
```

### Test 5: UTF-8MB4 Charset Verification
**Objective**: Ensure emoji and special chars work

**Steps**:
```php
$emoji_title = "🎉 Opening Ceremony 🎊";
$timer_id = createTimer($pdo, 1, $emoji_title, 600, 1);
$timer = executePreparedStatement(
  $pdo,
  'SELECT title FROM timer_items WHERE id = ?',
  [$timer_id]
)->fetch(PDO::FETCH_ASSOC);
if ($timer['title'] === $emoji_title) {
  echo "✅ UTF-8MB4 working (emoji preserved)\n";
}
```

---

## Key Design Decisions

### 1. Singleton Pattern
**Why**: Single connection per request conserves MySQL connections (especially on shared hosting)

**Trade-off**: All code in one request shares same connection state (acceptable for MVP)

### 2. Emulate Prepares = False
**Why**: Use real database-level prepared statements (safe even on InfinityFree)

**Safety**: Protects against SQL injection at database level, not just application level

### 3. Exception Error Mode
**Why**: Errors throw exceptions (fail-fast), easy to catch and handle

**Alternative**: Silent mode (error_info() required) is harder to debug

### 4. Helper Functions
**Why**: Standardize common queries, reduce duplication

**Trade-off**: Not every query can use helpers—complex queries use raw `executePreparedStatement()`

---

## Next Steps (Phase 2 Dependencies)

All Phase 2 tasks now depend on `db.php`:

1. **Task 2.1**: GET /api/v1/rooms → calls `getAllRooms()`
2. **Task 2.2**: GET /api/v1/rooms/{id} → calls `getRoomById()` + `getRoomTimers()`  
3. **Task 2.3**: POST /api/v1/rooms → calls `createRoom()`
4. **Task 2.4**: PUT /api/v1/rooms/{id} → uses `executePreparedStatement()` for update/upsert
5. **Task 2.5**: DELETE /api/v1/rooms/{id} → uses `executePreparedStatement()` for delete

Each endpoint loads `db.php` and calls appropriate functions.

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connection refused" | Wrong host/port in .env | Verify DB_HOST and DB_PORT match MySQLprocess |
| "Access denied for user" | Wrong credentials | Check DB_USER and DB_PASSWORD in .env |
| "Unknown database" | DB not created | Run `database/schema.sql` via phpMyAdmin or CLI |
| "Charset error" | Old MySQL version | Upgrade to MySQL 5.7+ (InfinityFree usually has 5.7+) |
| "Call to undefined function" | db.php not loaded | Add `require_once 'api/config/db.php'` at top of endpoint |
| Slow queries | Missing indexes | Verify composite index (room_id, position) created in schema |

---

## Security Checklist

- ✅ All queries use prepared statements (no string concatenation)
- ✅ Parameters bound safely via PDO::bindValue()
- ✅ Charset set to UTF-8MB4 (emoji, special characters)
- ✅ Connection timeout prevents hanging
- ✅ Error logging in debug mode only
- ✅ Exception mode ensures errors are caught
- ✅ No raw SQL exposed in error messages (logged, not returned to client)

---

## Production Deployment Notes

### On InfinityFree
1. Update `.env` with production credentials:
   - `DB_HOST`: Usually provided by InfinityFree (e.g., `sql123.eu.org`)
   - `DB_NAME`: Database name (e.g., `cpXXXXXX_b1g_timer`)
   - `DB_USER`: Database user (often matches DB_NAME)
   - `DB_PASSWORD`: InfinityFree provides this
2. Verify MySQL version: `SELECT VERSION()` (need 5.7+)
3. Run schema import script
4. Test connection: `php test-db-connection.php`

### Connection Pooling (Optional)
For high-traffic deployments, consider:
- **Separate read/write connections** (load balancing)
- **Connection pooling middleware** (e.g., ProxySQL)
- **Query caching** (Redis for repeated reads)

For MVP: Single connection per request is sufficient.

---

## Appendix: Full Function Reference

### `getPDOInstance()`
```php
/**
 * @return PDO Singleton connection
 * @throws Exception If connection fails
 */
$pdo = getPDOInstance();
```

### `executePreparedStatement($connection, $sql, $params)`
```php
/**
 * @param PDO $connection
 * @param string $sql           SQL with ? placeholders
 * @param array $params         Values to bind
 * @return PDOStatement         (caller fetches rows)
 * @throws PDOException         On execution failure
 */
$stmt = executePreparedStatement($pdo, "SELECT * FROM timer_rooms WHERE id = ?", [1]);
$room = $stmt->fetch(PDO::FETCH_ASSOC);
```

### Helper Functions
All return `null` or empty array on no results. Exceptions thrown on DB errors.

```php
getAllRooms($pdo, $limit = 100, $offset = 0)      // → Array of rooms
getRoomById($pdo, $room_id)                        // → Room or null
getRoomTimers($pdo, $room_id)                      // → Array of timers
createRoom($pdo, $name)                            // → Room ID or FALSE
createTimer($pdo, $room_id, $title, $duration, $position) // → Timer ID or FALSE
```

---

**Status**: ✅ Task 1.3 Complete  
**Quality**: Production-ready, security-hardened, fully documented  
**Next Task**: Task 1.4 (Input Validation Utility)

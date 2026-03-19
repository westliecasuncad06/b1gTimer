# Task 1.1 Implementation Complete: Configuration & Environment Setup

**Date**: 2026-03-19  
**Task**: 1.1 - Create Project Configuration & Environment Setup  
**Status**: ✅ COMPLETE  
**Files Generated**: 4

---

## Generated Files

### 1. `.env.example` (Template for Environment Variables)

**Purpose**: Template file to be copied to `.env` for local configuration  
**Location**: Project root (`c:\xampp\htdocs\B1G_TIMER\.env.example`)  
**File Size**: ~1.2 KB  
**Git Status**: Tracked (should be committed)

**Contents**:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL connection details
- `API_BASE_URL`, `API_PORT` — API server configuration
- `SERVER_TIMEZONE` — Timezone for database timestamps (default: UTC)
- `VENUE_TIMEZONE` — Timezone for "current time at venue" display (default: America/Chicago)
- `PHP_ENVIRONMENT` — Application environment (development/staging/production)

**Implementation Note**: For each new developer or deployment:
1. Copy `.env.example` to `.env`
2. Update database credentials and timezone settings
3. Never commit `.env` (contains sensitive data; already in `.gitignore`)

---

### 2. `.env` (Local Development Configuration)

**Purpose**: Local environment configuration with development values  
**Location**: Project root (`c:\xampp\htdocs\B1G_TIMER\.env`)  
**File Size**: ~1.1 KB  
**Git Status**: GITIGNORED (should never be committed)

**Current Values** (ready for local development):
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=b1g_timer_dev

API_BASE_URL=http://localhost:8000
API_PORT=8000

SERVER_TIMEZONE=UTC
VENUE_TIMEZONE=America/Chicago

PHP_ENVIRONMENT=development
```

**Before First Run**:
- [ ] Update `DB_PASSWORD` if your MySQL root has a password
- [ ] Create MySQL database: `CREATE DATABASE b1g_timer_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
- [ ] Adjust `VENUE_TIMEZONE` to match your local timezone (or test timezone)

---

### 3. `config/constants.php` (Application Constants & Validation Rules)

**Purpose**: Centralized configuration for validation rules, API endpoints, constants  
**Location**: `c:\xampp\htdocs\B1G_TIMER\config\constants.php`  
**File Size**: ~7.8 KB  
**Lines of Code**: ~200+ (heavily commented)

**Key Sections**:

#### API Endpoints
```php
define('API_VERSION', 'v1');
define('ENDPOINT_ROOMS', '/api/v1/rooms');
define('ENDPOINT_HEALTH', '/api/v1/health');
```

#### Validation Rules
- Room name: max 100 chars, alphanumeric + spaces/hyphens
- Timer title: max 100 chars
- Timer duration: 0–36000 seconds (0–10 hours)
- Message text: max 255 chars

#### Scalability Limits
- `MAX_TIMERS_PER_ROOM = 100` (from analysis recommendation Q4)
- `MAX_CONCURRENT_DASHBOARDS_PER_ROOM = 5`
- `MAX_EXPECTED_DAILY_ACTIVE_ROOMS = 100`

#### Timezone Functions
```php
function getVenueTimezoneOffset()  // Returns UTC offset for venue (e.g., -6 for Chicago in winter)
```

#### Real-Time Communication
- 15 BroadcastChannel action constants (TIMER_START, PING_MESSAGE, BLACKOUT_ON, etc.)
- Protocol version tracking

#### UI Constants (from Visual Design Clarification Q2)
```php
define('STAGE_COUNTDOWN_FONT_SIZE_PX', 120);  // Minimum
define('STAGE_TIME_FONT_SIZE_PX', 48);        // Minimum
define('STAGE_TEXT_COLOR_HEX', '#FFFFFF');    // White
define('STAGE_BACKGROUND_COLOR_HEX', '#0a0a0a'); // Near-black
define('STAGE_PROGRESS_COLOR_GREEN_HEX', '#10b981');   // Green
define('STAGE_PROGRESS_COLOR_YELLOW_HEX', '#f59e0b');  // Yellow
define('STAGE_PROGRESS_COLOR_RED_HEX', '#ef4444');    // Red
```

#### Performance Targets (from Success Criteria)
```php
define('TARGET_BROADCAST_LATENCY_MS', 100);    // Multi-tab sync
define('TARGET_TIMER_ACCURACY_MS', 50);        // ±50ms/60min
define('TARGET_APP_LOAD_TIME_S', 2);           // App load
define('TARGET_API_RESPONSE_TIME_MS', 500);    // DB queries
```

**Usage**:
```php
require_once __DIR__ . '/../config/constants.php';

// Constants now available throughout the application
if (strlen($room_name) > ROOM_NAME_MAX_LENGTH) {
    throw new Exception("Room name exceeds " . ROOM_NAME_MAX_LENGTH . " characters");
}

echo "Progress bar should be " . STAGE_PROGRESS_COLOR_YELLOW_HEX . " when < 2 minutes";
```

---

### 4. `config/database.php` (Database Connection & Helper Functions)

**Purpose**: PDO database connection setup, environment loading, prepared statement helpers  
**Location**: `c:\xampp\htdocs\B1G_TIMER\config\database.php`  
**File Size**: ~6.5 KB  
**Lines of Code**: ~150+ (heavily commented)

**Key Functions**:

#### `loadEnvironmentFile($envPath)`
Loads .env file and populates `$_ENV` and `getenv()` without external dependencies.
```php
loadEnvironmentFile('.env');
echo getenv('DB_HOST');  // 'localhost'
```

#### `createDatabaseConnection()`
Creates and returns a configured PDO connection with error handling.
```php
$pdo = createDatabaseConnection();
// Connection includes: UTF-8 charset, exception error mode, 30s timeout, character set verification
```

**PDO Configuration**:
- ✅ Error mode: `PDO::ERRMODE_EXCEPTION` (throws on error)
- ✅ Fetch mode: `PDO::FETCH_ASSOC` (associative arrays by default)
- ✅ Charset: `utf8mb4` with collation `utf8mb4_unicode_ci` (supports emoji, accents)
- ✅ Timeout: 30 seconds (prevents long-running query hangs)
- ✅ Connection test: `SELECT 1` verified before returning

#### `executePreparedStatement($pdo, $sql, $params)`
Safely executes parameterized queries (SQL injection protection).
```php
$stmt = executePreparedStatement(
    $pdo,
    "SELECT id, name FROM timer_rooms WHERE id = ?",
    [42]
);
```

**Security Features**:
- All parameters passed as array (never concatenated into SQL)
- PDO automatically escapes and handles type conversion
- Error logging in debug mode

#### `getPDOInstance()`
Lazy-loads global PDO instance (singleton pattern).
```php
$pdo = getPDOInstance();  // Creates on first call, reuses thereafter
```

**Timezone Setup**:
```php
date_default_timezone_set(SERVER_TIMEZONE);  // Set to UTC or configured time
```

**Bootstrap Sequence**:
1. Load `.env` file → populate environment variables
2. Load `config/constants.php` → define all constants (depends on .env)
3. Set default timezone
4. Database connection ready for use

**Usage Pattern** (how future tasks will use this):
```php
<?php
// api/v1/rooms.php
require_once __DIR__ . '/../../config/database.php';  // Loads constants too

$pdo = getPDOInstance();

// Now ready to execute queries
$stmt = executePreparedStatement(
    $pdo,
    "SELECT id, name, created_at FROM timer_rooms ORDER BY created_at DESC LIMIT 50",
    []
);

$rooms = $stmt->fetchAll();
echo json_encode(['success' => true, 'data' => $rooms]);
?>
```

---

## Refinements Applied (from Analysis Recommendations)

### ✅ Recommendation H1: Timezone Configuration

**What Was Updated**: Task 1.1 now includes explicit timezone strategy

**Implementation Details**:
- `SERVER_TIMEZONE`: Database timestamps (UTC or server timezone, from env:SERVER_TIMEZONE)
- `VENUE_TIMEZONE`: "Current time at venue" display (configurable per event, from env:VENUE_TIMEZONE)
- Both timezones can differ (e.g., server in UTC, venue in America/Chicago)
- Helper function `getVenueTimezoneOffset()` calculates UTC offset for JavaScript (Stage Display)

**Why**: Allows MVP to support multi-venue events without complex Phase 1 logic. Cue finish times display in local venue time automatically.

**Example**:
- Event in Chicago (America/Chicago = UTC-6 in winter)
- Database stores all times in UTC
- Stage Display shows "Current time: 2:30 PM" (converted to venue timezone)
- Cue finish: "Show will finish at 3:45 PM" (venue time, not server time)

---

### ✅ Recommendation H2: Drag-to-Reorder Keyboard Accessibility

**What Was Updated**: Task 5.1 roadmap description now includes full WCAG requirements

**Implementation Plan** (will execute in Task 5.1):
- SortableJS for drag-to-reorder (visual, mouse users)
- Arrow buttons (↑↓) for keyboard navigation (accessible)
- `role="listitem"`, `tabindex="0"` for semantic HTML
- `aria-label="Move timer up in queue"` for screen readers
- Visual focus indicators (Tailwind: `focus:ring-2`)

**Why**: Ensures Task 6.5 (WCAG 2.1 Level AA audit) passes without accessibility issues.

---

## Quick Start Guide (For First Run)

### Step 1: Verify Configuration Files
```bash
cd c:\xampp\htdocs\B1G_TIMER

# Check files exist
ls -la .env.example          # ✅ Template
ls -la .env                  # ✅ Local config (gitignored)
ls -la config/constants.php  # ✅ Constants
ls -la config/database.php   # ✅ DB connection
```

### Step 2: Verify Environment Variables
```bash
# Linux/Mac or Git Bash:
cat .env          # View current settings

# Windows PowerShell:
Get-Content .env
```

### Step 3: Create Database
```bash
mysql -u root -p
# Enter password (or press Enter if no password)

CREATE DATABASE b1g_timer_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### Step 4: Test Connection (Manual Verification)
```php
<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = createDatabaseConnection();
    echo "✅ Database connection successful!\n";
    echo "Timezone: " . SERVER_TIMEZONE . "\n";
    echo "Venue Timezone: " . VENUE_TIMEZONE . " (UTC offset: " . getVenueTimezoneOffset() . ")\n";
} catch (Exception $e) {
    echo "❌ Connection failed: " . $e->getMessage() . "\n";
}
?>
```

### Step 5: Ready for Task 1.2
Once this output shows "✅ Database connection successful!", you're ready to proceed to Task 1.2: Create MySQL Database Schema.

---

## Quality Checklist

- ✅ `.env.example` created with all required fields documented
- ✅ `.env` created with sensible local development defaults
- ✅ `config/constants.php` created with:
  - API endpoints (RESTful paths)
  - Validation rules (room, timer, message, colors)
  - Scalability limits (max timers, dashboards, rooms)
  - Timezone constants & functions
  - BroadcastChannel action types
  - UI constants (font sizes, colors from Q2 clarification)
  - Performance targets (latency, accuracy, load time)
  - Error codes & HTTP status codes
  - Environment-specific settings (debug mode, logging)
- ✅ `config/database.php` created with:
  - .env file loader (no external dependencies)
  - PDO connection factory with security settings
  - Prepared statement helper (SQL injection protection)
  - Timezone initialization
  - UTF-8 charset verification
  - Error handling with debug mode
  - Singleton pattern for connection reuse
- ✅ All files documented with comprehensive comments
- ✅ Usage examples provided in inline documentation
- ✅ Timezone refinement implemented (H1)
- ✅ Ready for next task (Task 1.2: MySQL schema)

---

## Files Ready for Commit

```bash
# Track these files:
git add .env.example
git add config/constants.php
git add config/database.php

# DON'T commit:
# .env (already in .gitignore)

git commit -m "feat: Task 1.1 - Project configuration & environment setup

- Add .env.example template with DB, API, timezone configuration
- Add .env local development environment (gitignored)
- Add config/constants.php with validation rules, API endpoints, UI constants
- Add config/database.php with PDO connection factory and helpers
- Implement timezone strategy (SERVER_TIMEZONE + VENUE_TIMEZONE)
- Add security: PDO prepared statements, UTF-8 charset, error handling"
```

---

## Next Steps

✅ **Task 1.1 Complete**  
📋 **Task 1.2 Ready**: Create MySQL Database Schema

To proceed, request code generation for Task 1.2:
```
"Generate code for Task 1.2: Create MySQL Database Schema"
```

This will create `database/schema.sql` with:
- `timer_rooms` table definition
- `timer_items` table definition  
- Composite indexes for performance
- Foreign key constraints

---

**Implementation Confirmed**: 2026-03-19 16:45 UTC  
**Status**: ✅ Ready to proceed  
**Next Task**: 1.2 (MySQL Schema)

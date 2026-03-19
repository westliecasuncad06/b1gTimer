# B1G Timer MVP - Implementation Roadmap

**Project**: Dual-Screen Stage Timer (001-dual-screen-timer)  
**Specification**: [specs/001-dual-screen-timer/spec.md](specs/001-dual-screen-timer/spec.md)  
**Status**: Ready for implementation  
**Approval Date**: 2026-03-19

---

## Overview

This roadmap breaks the approved technical plan into 31 sequential, manageable coding tasks organized across 5 phases. Each task specifies:
- **Title**: Clear, actionable task name
- **Files**: Files to create or modify
- **Description**: What code/configuration needs to be written (not the actual code)
- **Dependencies**: Prior tasks that must complete first

**Total Estimated Duration**: 7–10 days (1 developer, 8 hours/day)

---

# PHASE 1: Database Infrastructure (Days 1–1.5)

## Task 1.1: Create Project Configuration & Environment Setup

**Files Created**:
- `.env.example`
- `.env` (gitignored)
- `config/constants.php`
- `config/database.php`

**Description**:
- Define `.env.example` template with placeholders: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `API_BASE_URL`, `TIMEZONE`, `VENUE_TIMEZONE`
  - **NEW**: Add Pusher credentials: `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `PUSHER_ENCRYPTED`
- Create `.env` with local development values (MySQL on localhost, etc.)
  - Set `TIMEZONE` = "UTC" (server timezone for database timestamps)
  - Set `VENUE_TIMEZONE` = "Asia/Manila" (venue timezone, used for "current time" display in Stage Display)
  - Note: These can be different (e.g., server in UTC, venue in local timezone)
  - **NEW**: Add empty Pusher credentials (user fills in after signup at https://pusher.com)
- Create `config/constants.php` with validation rules, API endpoints, timezone constants, and venue timezone offset calculation
  - **NEW**: Define Pusher configuration constants: `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
  - **NEW**: Define Pusher channel naming convention: `presence-room-{roomId}` for all real-time control
  - Keep all 15 action type constants (TIMER_START, BLACKOUT_ON, etc.) - same actions, different transport
- Create `config/database.php` that loads `.env` values and sets up PDO configuration object
- **Timezone Strategy** (answers analysis report recommendation H1):
  - All database timestamps use server timezone (UTC)
  - "Current time at venue" display in Stage Display uses `VENUE_TIMEZONE` (Asia/Manila by default, configurable per event)
  - Cue finish calculations use `VENUE_TIMEZONE` to show projected finish time in local venue time
  - This allows multi-timezone event support in Phase 1 MVP without extra complexity
- **Real-Time Architecture Change** (NEW):
  - **Architecture**: Switched from BroadcastChannel API (same-origin multi-tab only) to **Pusher (internet-accessible)**
  - **Reason**: Supports mobile phone control over the internet (required for InfinityFree hosting + mobile deployment scenario)
  - **Benefit**: Control Dashboard on desktop can be controlled by mobile phone, Stage Display updates all connected devices in real-time
  - **Channel Strategy**: Single presence channel per room (`presence-room-{roomId}`) acts as control bus for that event

**Dependencies**: None

---

## Task 1.2: Create MySQL Database Schema

**Files Created**:
- `database/schema.sql`

**Description**:
- Define `timer_rooms` table: `id` (PK, auto-increment), `name` (VARCHAR 100), `created_at`, `updated_at` (TIMESTAMP)
- Define `timer_items` table: `id` (PK), `room_id` (FK to timer_rooms), `title` (VARCHAR 100), `duration_seconds` (INT), `position` (INT), `created_at`, `updated_at` (TIMESTAMP)
- Add composite index on `(room_id, position)` for efficient sorted queries
- Add single index on `room_id` for lookup performance
- Set collation: `utf8mb4_unicode_ci` (supports emoji, special chars)
- Set engine: InnoDB (transaction support, FK constraints)
- Add ON DELETE CASCADE for FK relationship

**Dependencies**: Task 1.1

---

## Task 1.3: Set Up PDO Database Connection

**Files Created**:
- `api/config/db.php`

**Description**:
- Create PDO instance using DSN from `config/database.php`
- Set error mode to PDOException (throw on error)
- Set charset to utf8mb4
- Create helper function `executePreparedStatement($connection, $sql, $params)` to wrap prepared statement execution
- Add basic error logging (log connection failures)

**Dependencies**: Tasks 1.1, 1.2

---

## Task 1.4: Create Input Validation Utility

**Files Created**:
- `api/middleware/validate.php`

**Description**:
- Create validation functions:
  - `validateRoomName($name)` — max 100 chars, alphanumeric + spaces/hyphens, XSS-safe
  - `validateTimerTitle($title)` — max 100 chars, no script tags, XSS-safe
  - `validateDurationSeconds($seconds)` — positive int, 0–36000 range
  - `validateMessageText($text)` — max 255 chars, no HTML tags
- Return object: `{ valid: bool, errors: array }`
- Use `strip_tags()`, `htmlspecialchars()`, `filter_var()` PHP functions

**Dependencies**: Task 1.1

---

## Task 1.5: Create Error Response Handler

**Files Created**:
- `api/utils/error-handler.php`

**Description**:
- Create function `sendError($code, $message, $httpStatus)` that outputs consistent JSON:
  ```
  { "error": "message", "code": "ERROR_CODE", "timestamp": "ISO8601" }
  ```
- Create function `sendSuccess($data)` that outputs: `{ "success": true, "data": {...}, "timestamp": "ISO8601" }`
- Set appropriate HTTP status codes
- Ensure all responses are JSON (header: `Content-Type: application/json`)

**Dependencies**: None

---

# PHASE 2: Backend API (Days 1.5–3)

## Task 2.1: Create Room List Endpoint (GET /api/v1/rooms)

**Files Created/Modified**:
- `api/v1/rooms.php` (new)

**Description**:
- Implement `GET /api/v1/rooms` endpoint
- Query all rooms from `timer_rooms` table, sorted by `created_at DESC`
- Return array of room objects: `{ id, name, created_at, updated_at }`
- Handle errors (DB unavailable) → 500 error response

**Dependencies**: Tasks 1.3, 1.5

---

## Task 2.2: Create Room Detail Endpoint with Timers (GET /api/v1/rooms/{roomId})

**Files Created/Modified**:
- `api/v1/rooms.php` (modify)

**Description**:
- Implement `GET /api/v1/rooms/{roomId}` endpoint
- Query single room from `timer_rooms` where `id = roomId`
- Query all timers from `timer_items` where `room_id = roomId`, sorted by `position ASC`
- Return object: `{ id, name, timers: [ { id, title, duration_seconds, position }, ... ], created_at, updated_at }`
- Return 404 if room not found

**Dependencies**: Tasks 1.3, 1.5

---

## Task 2.3: Create Room Creation Endpoint (POST /api/v1/rooms)

**Files Created/Modified**:
- `api/v1/rooms.php` (modify)

**Description**:
- Implement `POST /api/v1/rooms` endpoint
- Accept JSON body: `{ "name": "..." }`
- Validate room name using Task 1.4
- Insert into `timer_rooms` table
- Return newly created room object with auto-generated `id`
- Return 400 if validation fails, 500 if DB error

**Dependencies**: Tasks 1.3, 1.4, 1.5

---

## Task 2.4: Create Room Update Endpoint (PUT /api/v1/rooms/{roomId})

**Files Created/Modified**:
- `api/v1/rooms.php` (modify)

**Description**:
- Implement `PUT /api/v1/rooms/{roomId}` endpoint
- Accept JSON body: `{ "name": "...", "timers": [ { id, title, duration_seconds, position }, ... ] }`
- Validate room name and all timer data
- Start transaction
- Update room `name` and `updated_at` in `timer_rooms`
- For each timer in the list: UPDATE or INSERT (upsert pattern)
  - For existing timers (id exists): update `title`, `duration_seconds`, `position`
  - For new timers (id missing): INSERT with new `id`
  - For deleted timers (not in list): DELETE from `timer_items`
- Commit transaction
- Return updated room + timers
- Rollback transaction on error

**Dependencies**: Tasks 1.3, 1.4, 1.5

---

## Task 2.5: Create Room Delete Endpoint (DELETE /api/v1/rooms/{roomId})

**Files Created/Modified**:
- `api/v1/rooms.php` (modify)

**Description**:
- Implement `DELETE /api/v1/rooms/{roomId}` endpoint
- Delete room from `timer_rooms` (FK CASCADE will delete associated timers)
- Return 200 with confirmation message if success
- Return 404 if room not found, 500 if DB error

**Dependencies**: Tasks 1.3, 1.5

---

## Task 2.6: Create Pusher Event Broadcaster Endpoint (POST /api/v1/broadcast)

**Files Created/Modified**:
- `api/v1/broadcast.php` (new)
- `config/pusher.php` (new, Pusher SDK initialization)

**Description**:
- Create server-side Pusher event broadcaster:
  - Initialize Pusher PHP SDK using credentials from `config/constants.php`
  - Create `POST /api/v1/broadcast` endpoint that accepts JSON: `{ "roomId": 123, "action": "TIMER_START", "payload": {...}, "displayId": "uuid" }`
  - Validate action is one of the 15 allowed actions (from `config/constants.php`)
  - Validate roomId exists in database
  - Authenticate request origin (could be Control Dashboard or Stage Display)
  - Broadcast event to `presence-room-{roomId}` channel with event name = action type
  - Return response: `{ "success": true, "broadcastId": "uuid", "timestamp": "ISO8601" }`
  - Return 403 if invalid action, 404 if room not found, 500 on Pusher API failure
- Create `config/pusher.php`:
  - Initialize Pusher instance with credentials from .env
  - Export singleton function `getPusherInstance()`
  - Handle errors gracefully (Pusher API down shouldn't crash app)
- **Pusher Free Tier**: Supports 100 concurrent connections per instance (sufficient for MVP)
- Test: Verify event appears in Pusher debug console

**Dependencies**: Tasks 1.1, 2.1, 1.5

---

## Task 2.7: Create Health Check Endpoint (GET /api/v1/health)

**Files Created/Modified**:
- `api/v1/health.php` (new)

**Description**:
- Implement simple health check endpoint
- Test database connection by executing `SELECT 1`
- Return: `{ "status": "ok", "database": "connected", "timestamp": "ISO8601" }`
- Return 503 if DB connection fails (Service Unavailable)
- Used by frontend for connection monitoring

**Dependencies**: Tasks 1.3, 1.5

---

## Task 2.7: Create Router/Dispatcher for API

**Files Created/Modified**:
- `api/index.php` (new)

**Description**:
- Create entry point that routes all `/api/v1/*` requests to appropriate handler
- Parse request method (GET, POST, PUT, DELETE)
- Parse URL path: extract `{roomId}` parameters
- Route to appropriate endpoint file (`rooms.php`, `health.php`)
- Handle 404 (unknown route)
- Ensure all responses have correct CORS headers (if needed for development)

**Dependencies**: Tasks 2.1–2.6

---

## Task 2.8: Create .htaccess for URL Rewriting (Optional for Apache)

**Files Created**:
- `public/.htaccess`
- `api/.htaccess` (if needed)

**Description**:
- Create `.htaccess` rules to rewrite "/" to `index.php`
- Ensure direct access to `.php` files is allowed (needed for API endpoints)
- Test that routes like `/api/v1/rooms` work correctly

**Dependencies**: Task 2.7

---

# PHASE 3: Frontend - Static UI & Scaffolding (Days 3–4)

## Task 3.1: Create Control Dashboard HTML

**Files Created**:
- `public/index.html`

**Description**:
- Create HTML5 structure with three columns (not using CSS Grid yet, just divs)
- Column 1 (left, ~25%): Dashboard & Preview section placeholder
  - Live preview window (placeholder div)
  - Current time display (HH:MM AM/PM)
  - Playback controls: Restart button, Play/Pause toggle, Next Timer button, -1m/-m+1 buttons
  - Metadata display: Cue Finish, Over/Under (placeholders)
- Column 2 (center, ~50%): Timers section
  - Room selector dropdown (no JS logic yet)
  - Global action buttons: Blackout, Flash
  - Timer list container with id="timer-list" (will be populated by JS)
  - Add Timer button
  - Save button
- Column 3 (right, ~25%): Messages section
  - Message text input
  - Color picker (placeholder div)
  - Bold checkbox, Font Size input
  - Show button, Hide button
  - Queued messages list (placeholder)
  - Focus, Flash buttons
- Include Tailwind CDN in `<head>`
- Include semantic HTML5 tags (`<main>`, `<section>`, `<header>`, `<button>`, `<input>`)
- Add data attributes for JS (e.g., `data-action="play"`, `data-timer-id="123"`)

**Dependencies**: None

---

## Task 3.2: Create Stage Display HTML

**Files Created**:
- `public/stage.html`

**Description**:
- Create full-screen, dark HTML structure
- Background: near-black (#0a0a0a)
- Top section: Countdown display
  - Large div with id="countdown" (text content: "00:00", font: ≥120px, white, monospace)
- Middle section: Progress bar
  - Container with id="progress-bar-container" (100% width, ~50px height)
  - Inner bar with id="progress-bar" (will animate width via JS)
  - Color will be set dynamically (green/yellow/red)
- Bottom-left: Time of day
  - Div with id="time-of-day" (font: ≥48px, white)
- Footer: Message ribbon
  - Div with id="message-ribbon" (initially hidden, display flex, white text, height: ~80px)
- Include Tailwind CDN
- Semantic HTML structure (`<main>`, `<section>`)

**Dependencies**: None

---

## Task 3.3: Style Control Dashboard with Tailwind

**Files Created/Modified**:
- `public/index.html` (modify)
- `public/css/app.css` (new, if custom CSS needed beyond Tailwind)

**Description**:
- Apply Tailwind utility classes for three-column layout:
  - Container: `flex h-screen`
  - Column 1: `w-1/4 bg-gray-900 p-4 overflow-y-auto`
  - Column 2: `w-1/2 bg-gray-800 p-4 overflow-y-auto`
  - Column 3: `w-1/4 bg-gray-900 p-4 overflow-y-auto`
- Style each section with consistent spacing, colors, borders
- Apply theme colors: text-white, bg-gray-800/900, borders: gray-700
- Ensure form inputs have proper padding and focus states
- Button styles: `bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded`
- No custom CSS; all Tailwind utilities

**Dependencies**: Task 3.1

---

## Task 3.4: Style Stage Display with Tailwind

**Files Created/Modified**:
- `public/stage.html` (modify)

**Description**:
- Apply Tailwind utilities for full-screen layout:
  - Body: `w-screen h-screen bg-gray-950 text-white overflow-hidden flex flex-col items-center justify-center`
- Countdown: Large centered text
  - Apply: `text-9xl font-mono font-bold text-white`
- Progress bar:
  - Container: `w-4/5 h-12 bg-gray-700 rounded`
  - Inner bar: `h-full rounded transition-all duration-300`
- Time-of-day:
  - Position: bottom-left corner
  - Apply: `absolute bottom-4 left-4 text-6xl font-mono text-white`
- Message ribbon:
  - Position: bottom
  - Apply: `absolute bottom-0 w-full h-20 bg-gray-800 flex items-center justify-center text-white text-2xl`

**Dependencies**: Task 3.2

---

## Task 3.5: Create Placeholder Timer List Item HTML

**Files Created/Modified**:
- `public/index.html` (modify)

**Description**:
- Add example timer item HTML to Column 2 (will be replaced by JS loop)
- Timer item structure:
  ```html
  <div class="timer-item" data-timer-id="123">
    <input type="text" class="timer-title" value="Opening Ceremony" />
    <input type="text" class="timer-duration" value="10:00" />
    <button data-action="delete">Delete</button>
  </div>
  ```
- Add drag handle icon/class for SortableJS
- Style with Tailwind: border, padding, hover effects
- Each item should have minimal styling (SortableJS will handle visual feedback)

**Dependencies**: Task 3.1

---

## Task 3.6: Create Placeholder Preview Window HTML

**Files Created/Modified**:
- `public/index.html` (modify)

**Description**:
- Add a placeholder preview window in Column 1
- Preview window: `<div id="preview-window">` that mirrors the Stage Display layout at small scale
- Include: countdown, progress bar, time-of-day, message ribbon
- Size: responsive to container (~400px wide × 300px height, maintain aspect ratio)
- Border: subtle gray border to separate from Stage Display
- Style: same colors as Stage Display (near-black background, white text)
- Content: initially show "Preview" placeholder text

**Dependencies**: Task 3.1

---

# PHASE 4: Frontend - JavaScript Logic & Real-Time (Days 4–6)

## Task 4.1: Set Up Pusher SDK & Real-Time Messaging

**Files Created**:
- `public/js/pusher-client.js`
- `public/index.html` (modify, add Pusher script)
- `public/stage.html` (modify, add Pusher script)

**Description**:
- **ARCHITECTURE CHANGE**: Implements Pusher-based real-time communication (replacing BroadcastChannel)
  - BroadcastChannel: limited to same-origin, multi-tab only
  - **Pusher**: internet-accessible, supports mobile phone control, works on InfinityFree hosts
- Include pusher-js from CDN: `<script src="https://js.pusher.com/7.0/pusher.min.js"></script>` in both HTML files
- Create `public/js/pusher-client.js` module that exports:
  - `initialize(roomId, displayId)` — Initializes Pusher instance and subscribes to `presence-room-{roomId}` channel
  - `subscribe(eventHandler)` — Subscribes to all action events on the channel
  - `publish(action, payload)` — Sends request to server's `/api/v1/broadcast` endpoint to broadcast event
  - `onMemberAdded(callback)` — Called when a new display connects (presence tracking)
  - `onMemberRemoved(callback)` — Called when display disconnects
  - `disconnect()` — Closes connection
  - `getConnectedDisplayCount()` — Returns number of connected displays in the room (from presence channel)
- On startup:
  - Generate unique `displayId` (UUID) for this browser tab/device
  - Broadcast DISPLAY_CONNECTED event to notify Control Dashboard
  - Listen for all 15 action types (TIMER_START, BLACKOUT_ON, etc.)
- Error handling:
  - If Pusher connection fails: show "Connection lost" UI, queue actions locally
  - On reconnection: retry queued actions
  - Don't crash the app on Pusher errors (graceful degradation)
- **Pusher Public Channels** (free tier):
  - Use `presence-room-{roomId}` for presence tracking (who's connected)
  - All connected devices see all events on that channel
- Test: Verify events broadcast and received within target <100ms latency

**Dependencies**: None

---

## Task 4.2: Create Timer Logic Module (Pure Functions)

**Files Created**:
- `public/js/timer-logic.js`

**Description**:
- Create pure functions (no side effects) for timer calculations:
  - `calculateTimeRemaining(currentTime, startTime, totalDuration)` → returns seconds (can be negative)
  - `formatTimerDisplay(seconds)` → returns "MM:SS" or "-MM:SS" string
  - `getProgressBarState(remainingSeconds, totalSeconds)` → returns `{ width: "X%", color: "#xxxxxx" }`
  - `calculateCueFinish(currentTime, remainingSeconds)` → returns projected finish time string (HH:MM AM/PM)
  - `calculateOverUnder(elapsedSeconds, totalSeconds)` → returns "+XXs" or "-XXs" string
  - `getTimerColor(remainingSeconds)` → returns color hex based on time thresholds (green/yellow/red)
- Export as module
- Include comprehensive JSDoc comments

**Dependencies**: None

---

## Task 4.3: Create UI Components Module

**Files Created**:
- `public/js/ui-components.js`

**Description**:
- Create reusable render functions (pure, return HTML strings or update DOM):
  - `renderPreview(state)` — Updates preview window with countdown, progress bar, time, message
  - `renderTimerList(timers, currentTimerId)` — Renders timer list items with titles, durations, delete buttons, drag handles
  - `renderMetadata(currentTime, cueFinish, overUnder)` — Renders metadata display
  - `updateProgressBar(percentage, color)` — Updates progress bar width and color in DOM
  - `updateCountdown(timeString)` — Updates countdown text in DOM
  - `showConnectionStatus(count)` — Shows "X displays connected" indicator
  - `showError(message)` — Shows error notification to user
  - `hideError()` — Hides error notification
- Use minimal DOM manipulation (batch updates where possible)
- No external dependencies

**Dependencies**: Task 4.2

---

## Task 4.4: Create Control Dashboard App Logic

**Files Created**:
- `public/js/app.js`

**Description**:
- Initialize app on page load:
  - Fetch room list from `GET /api/v1/rooms`
  - Populate room selector dropdown
  - On room selection change: fetch room details (`GET /api/v1/rooms/{roomId}`), load timers
- Create in-memory state object: `{ currentRoomId, currentTimerId, timers: [], isPlaying, blackoutActive, currentMessage }`
- Implement event listeners:
  - **Room selector**: On change, load room timers
  - **Add Timer button**: Create new timer object locally, add to list, re-render
  - **Delete button** (per timer): Remove from list, mark for deletion
  - **Play button**: Broadcast TIMER_START via BroadcastChannel
  - **Pause button**: Broadcast TIMER_PAUSE via BroadcastChannel
  - **Restart button**: Broadcast TIMER_RESTART via BroadcastChannel
  - **+1m / -1m buttons**: Broadcast TIMER_ADJUST via BroadcastChannel
  - **Next Timer button**: Broadcast NEXT_TIMER via Pusher
  - **Blackout button**: Toggle blackout state, broadcast BLACKOUT_ON/OFF
  - **Flash button**: Broadcast FLASH_SCREEN
  - **Save button**: POST updated timers to `PUT /api/v1/rooms/{roomId}`
  - **Message Show button**: Broadcast SHOW_MESSAGE with text/color/bold/fontSize
  - **Message Hide button**: Broadcast HIDE_MESSAGE
- Listen to Pusher presence channel for sync updates (SYNC_RESPONSE, display count changes)
- Handle API errors gracefully (show error UI, retry logic)
- Auto-save on interval (e.g., every 30 seconds if changes detected)

**Dependencies**: Tasks 4.1, 4.3

---

## Task 4.5: Create Stage Display App Logic

**Files Created**:
- `public/js/stage.js`

**Description**:
- Initialize on page load:
  - Parse URL query param for roomId (e.g., `stage.html?room=123`) or default to first room
  - Initialize Pusher connection via `pusher-client.js`
  - Generate unique displayId (UUID) for this browser session
  - Subscribe to `presence-room-{roomId}` channel
  - Broadcast DISPLAY_CONNECTED event to notify Control Dashboard
  - Request full sync via SYNC_REQUEST
  - Start listening on Pusher channel for all 15 action types
- Create in-memory state: `{ currentRoomId, currentTimerId, startTime, isPlaying, elapsedSeconds, isBlackout, currentMessage }`
- Implement `updateLoop()` using `requestAnimationFrame()`:
  - Calculate current timer remaining time using `timer-logic.js`
  - Update countdown display
  - Update progress bar (color based on remaining time)
  - Update time-of-day
  - Re-render until timer finishes or paused
- Implement Pusher message handlers (same action types, different transport):
  - TIMER_START: Set state, start animation loop
  - TIMER_PAUSE: Stop animation, save elapsed time
  - TIMER_RESTART: Reset to full duration, start loop
  - TIMER_ADJUST: Update duration, recalculate remaining
  - NEXT_TIMER: Load next timer, start loop
  - BLACKOUT_ON: Hide all content, show black screen
  - BLACKOUT_OFF: Resume showing content
  - FLASH_SCREEN: Briefly fill with white, fade back to normal (500ms)
  - SHOW_MESSAGE: Display message ribbon at bottom
  - HIDE_MESSAGE: Hide message ribbon
  - SYNC_RESPONSE: Update full state
- Handle disconnection gracefully: show "Connection Lost" message, retry Pusher connection
- On window unload: Broadcast DISPLAY_DISCONNECTED via Pusher

**Dependencies**: Tasks 4.1, 4.2, 4.3

---

## Task 4.6: Implement Multi-Device Sync via Pusher Presence

**Files Created/Modified**:
- `public/js/pusher-client.js` (modify)
- `public/js/app.js` (modify)
- `public/js/stage.js` (modify)

**Description**:
- Implement SYNC_REQUEST/SYNC_RESPONSE handshake:
  - Stage Display (on load) sends: `{ action: "SYNC_REQUEST", payload: { displayId: uuid() } }` via broadcast endpoint
  - Control Dashboard (on receive SYNC_REQUEST) responds: `{ action: "SYNC_RESPONSE", payload: { currentTimerId, isPlaying, startTime, elapsedSeconds, isBlackout, currentMessage, displayConnectedCount } }` via broadcast endpoint
- Implement DISPLAY_CONNECTED/DISCONNECTED presence tracking:
  - Each Display tab assigns itself a unique `displayId` (UUID)
  - On connect: broadcast DISPLAY_CONNECTED with displayId
  - Control Dashboard maintains connection count from Pusher presence channel
  - Pusher presence channel automatically tracks members: get member count via `channel.members.count`
  - When Display closes: broadcast DISPLAY_DISCONNECTED, Control Dashboard updates count
  - Update connection count UI in real-time
  - **Multi-Device Support**: Works across any internet-connected device (mobile, tablet, laptop)
- Test: Verify <100ms sync latency between Control Dashboard/mobile changes and Stage Display updates

**Dependencies**: Tasks 4.1, 4.4, 4.5

---

## Task 4.7: Integrate Timer Math with Animation Loop

**Files Created/Modified**:
- `public/js/stage.js` (modify)

**Description**:
- Replace placeholder timer display with actual calculations:
  - Use `calculateTimeRemaining()` from `timer-logic.js` in requestAnimationFrame loop
  - Update countdown text, progress bar, and metadata every frame
  - Ensure smooth 60 FPS updates (no lag)
- Handle timer transitions:
  - When remaining time crosses 2:00 threshold: change progress bar color to yellow
  - When remaining time reaches 00:00: change to red, allow negative display
  - When timer finishes (operator manually advances): smooth transition to next timer
- Test drift over 60+ minute session (target: ±50ms accuracy)

**Dependencies**: Tasks 4.2, 4.5

---

## Task 4.8: Implement Error Handling & Reconnection

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/js/stage.js` (modify)
- `public/js/pusher-client.js` (modify)

**Description**:
- Add error state management:
  - Track API/network errors and Pusher connection errors
  - On Pusher disconnect: show error banner to operator ("Connection Lost - Retrying...")
  - Retain local state (timers, current playback state) in memory
  - Allow continued local timer adjustments (play/pause/adjust) while reconnecting
  - Queue actions locally (don't lose TIMER_START, BLACKOUT_ON, etc. commands)
- Implement Pusher auto-reconnect:
  - Pusher SDK handles automatic reconnection (built-in, configurable)
  - On Pusher disconnect: set `isPusherConnected = false`, show offline UI
  - On Pusher reconnect: set `isPusherConnected = true`, flush queued actions
  - Retry failed broadcast requests with exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Implement API error handling:
  - Periodically poll health endpoint (`GET /api/v1/health`) to detect API server failure
  - If health check fails: show "API Server Unavailable" warning
  - On recovery: retry pending operations (e.g., unsaved room changes)
  - Merge local changes back to database on successful connection
  - Notify operator: "Reconnected - Syncing..."
- Handle edge cases:
  - Mobile phone loses internet: queue actions, resume when connection returns
  - InfinityFree server down: graceful failover message
  - Pusher service down: fallback to polling health endpoint (limited real-time)
- Test: Simulate network failure (dev tools), verify local operation, verify reconnection and sync

**Dependencies**: Tasks 4.4, 4.5

---

# PHASE 5: Frontend - Advanced Features & Integration (Days 6–7)

## Task 5.1: Implement Drag-to-Reorder with SortableJS

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/index.html` (modify)

**Description**:
- Install SortableJS: `npm install sortablejs` or use CDN
- Include SortableJS script in index.html: `<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>`
- In app.js, after timer list renders:
  - Initialize Sortable on timer list: `Sortable.create(timerListElement, { animation: 150, ghostClass: 'opacity-50', onEnd: handleReorder })`
  - Implement `handleReorder(evt)`: 
    - Extract new order from DOM (evt.oldIndex to evt.newIndex)
    - Update local state with new positions
    - Broadcast TIMERS_REORDERED to Stage Display
    - Save to database
  - Add drag handle styling: `cursor-grab` on hover, `cursor-grabbing` while dragging
- **WCAG 2.1 Level AA Keyboard Support** (answers analysis report recommendation H2):
  - Implement arrow buttons (↑↓) alongside drag handles for reordering
  - Up/Down buttons should `tabIndex="0"` and respond to Enter key
  - Each timer item must be keyboard accessible: `<div role="listitem" tabindex="0">`
  - Arrow buttons update position and broadcast TIMERS_REORDERED same as drag-end
  - Provide visual focus indicator (Tailwind: `focus:ring-2 focus:ring-blue-500`)
  - Aria labels: button="#up-arrow" should have `aria-label="Move timer up in queue"` and similar for down
- Test: Verify keyboard navigation (Tab through buttons, arrow keys navigate, Enter reorders)

**Dependencies**: Tasks 4.4, 3.5

---

## Task 5.2: Implement Message Formatting Controls

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/index.html` (modify)

**Description**:
- Add message column interactivity:
  - Text input field for message content
  - Color picker (Vue's native `<input type="color">` or custom picker)
  - Bold checkbox
  - Font size input (number, range: 12–48px)
  - Show button: validates input, broadcasts SHOW_MESSAGE with formatting
  - Hide button: broadcasts HIDE_MESSAGE
  - Queued messages list: display pre-composed messages with quick-show buttons
  - Focus/Flash buttons: broadcast FOCUS and FLASH actions (these override message, draw attention)
- Add preview of message styling in real-time (show how message will look on stage)
- Validate message text (max 255 chars, no HTML)

**Dependencies**: Tasks 4.4, 3.1

---

## Task 5.3: Implement Blackout & Flash Controls

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/js/stage.js` (modify)

**Description**:
- Blackout toggle button:
  - On click: broadcast BLACKOUT_ON, set local state `{ isBlackout: true }`
  - UI shows "Unblackout" label
  - Stage Display: transition to full black screen (hide countdown, progress, time, message)
  - Note: timer continues running in background (state unchanged)
  - On second click: broadcast BLACKOUT_OFF, Stage Display returns to normal
- Flash button:
  - On click: broadcast FLASH_SCREEN with 500ms duration
  - Stage Display: briefly fill screen with white, fade back to normal over 500ms
  - Use CSS transition for smooth fade
- Test: Verify blackout doesn't pause timer, verify flash pulse is visible

**Dependencies**: Tasks 4.4, 4.5

---

## Task 5.4: Implement Live Preview Window

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/js/ui-components.js` (modify)
- `public/index.html` (modify)

**Description**:
- Create exact miniature replica of Stage Display in Control Dashboard's left column
- Mirror all elements: countdown, progress bar, time-of-day, message ribbon
- Update preview in real-time with every SYNC message from Stage Display
- Scale to fit container (~400px × 300px)
- Use CSS transform: scale() to maintain aspect ratio
- Add border/styling to distinguish from main display

**Dependencies**: Tasks 4.3, 4.4

---

## Task 5.5: Implement Connection Status Indicator

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/index.html` (modify)
- `public/js/stage.js` (modify)

**Description**:
- Control Dashboard:
  - Add UI element in header: "Live Connections: X displays"
  - Track connected displays from DISPLAY_CONNECTED/DISCONNECTED messages
  - Show real-time count (update on each connection change)
  - If count is 0: show red warning indicator "No displays connected"
- Stage Display:
  - Add small indicator at top-right: "Connected" (green dot) or "Disconnected" (red dot)
  - Based on successful message reception and health checks
- Test: Open multiple Stage Display tabs, verify count updates correctly

**Dependencies**: Tasks 4.6, 3.1

---

## Task 5.6: Implement Room Save/Load from Database

**Files Created/Modified**:
- `public/js/app.js` (modify)

**Description**:
- On room selection change:
  - Detect if current room has unsaved changes
  - Show confirmation dialog: "Save changes before switching rooms?"
  - Options: Save, Discard, Cancel
- Save button click:
  - POST current room state to `PUT /api/v1/rooms/{roomId}` with all timers
  - On success: show "Saved" confirmation
  - On failure: show error, allow retry
- Auto-save on interval:
  - Periodically save without user interaction (every 30 seconds if changes detected)
  - Don't annoy user with notifications on auto-save success
- On app load:
  - Restore last selected room from localStorage
  - Load timers from database for that room
- Test: Create room with 3 timers, save, close browser, reopen, verify timers restored

**Dependencies**: Tasks 2.4, 4.4

---

## Task 5.7: Implement Input Validation & Feedback

**Files Created/Modified**:
- `public/js/app.js` (modify)
- `public/index.html` (modify)

**Description**:
- Client-side validation:
  - Room name: max 100 chars, show char counter
  - Timer title: max 100 chars, show char counter
  - Timer duration: validate format "MM:SS" (0:00 to 10:00), convert to seconds
  - Message text: max 255 chars
- On validation error: show inline error message (red text below input)
- Disable Save button if any validation fails
- Prevent submission of invalid data
- On server-side validation failure: display error message to user "Invalid room name: too long"

**Dependencies**: Tasks 4.4, 3.1

---

## Task 5.8: Implement Unsaved Changes Warning

**Files Created/Modified**:
- `public/js/app.js` (modify)

**Description**:
- Track local changes to timers (title, duration, order)
- On any change: mark state as "dirty" (unsaved)
- Show visual indicator: "(unsaved changes)" label next to Save button
- On leaving page without saving: show browser confirmation dialog
- On room switch without saving: show custom dialog
- Clear dirty flag after successful save

**Dependencies**: Task 4.4

---

# PHASE 6: Testing & Refinement (Days 7–10)

## Task 6.1: End-to-End Workflow Testing

**Files Created/Modified**:
- Manual test checklist (document in README.md or test file)

**Description**:
- Test complete operator workflow:
  - Load Control Dashboard
  - Create new room "Test Event"
  - Add 5 timers: "Opening" (10min), "Session 1" (15min), "Break" (5min), "Session 2" (15min), "Closing" (5min)
  - Open Stage Display in separate tab
  - Start first timer, verify countdown on Stage Display
  - Pause, verify Stage Display stops
  - Adjust ±1m, verify Stage Display updates
  - Complete first timer, check negative overage display
  - Click Next Timer, verify Stage Display shows Session 1
  - Test message: send "5 MINS TO BREAK", verify appears on Stage Display
  - Test blackout: click Blackout, verify Stage Display turns black
  - Test flash: click Flash, verify Stage Display pulses white
  - Save room, close browser, reopen, verify timers restored
- Document pass/fail for each scenario

**Dependencies**: All Phase 4–5 tasks

---

## Task 6.2: Timer Accuracy Testing

**Files Created/Modified**:
- Manual test script (document methodology)

**Description**:
- Run timer for 60+ minutes
- Periodically record remaining time from Stage Display
- Compare against actual elapsed time
- Measure drift: should be ±50ms over full runtime
- Test with multiple Stage Display tabs open (verify sync variance <100ms)
- Document results

**Dependencies**: Tasks 4.7, 4.6

---

## Task 6.3: Multi-Tab Sync Testing

**Files Created/Modified**:
- Manual test script

**Description**:
- Open Control Dashboard on Tab A
- Open Stage Display on Tab B
- Open second Stage Display on Tab C
- Make timer change on Control Dashboard (play/pause/adjust)
- Measure time to update on Tab B and Tab C
- Target: <100ms between tabs
- Verify connection count shows correct number
- Close Tab C, verify connection count decrements

**Dependencies**: Tasks 4.6, 5.5

---

## Task 6.4: Error Handling Testing

**Files Created/Modified**:
- Manual test script

**Description**:
- Simulate API failure:
  - Stop MySQL server
  - Try to Save room
  - Verify error message displayed
  - Verify local state retained
  - Verify can still play/pause timers locally
  - Restart MySQL
  - Verify "Connection Restored" message
  - Verify local changes can be saved once reconnected
- Test network latency:
  - Use browser DevTools to throttle network
  - Verify UI remains responsive
  - Verify no console errors

**Dependencies**: Tasks 4.8, 5.6

---

## Task 6.5: Accessibility (WCAG 2.1 Level AA) Audit

**Files Created/Modified**:
- Accessibility compliance checklist (document in README.md)

**Description**:
- Run control Dashboard and Stage Display through:
  - axe DevTools browser extension
  - WAVE browser extension
  - Manual keyboard navigation testing
- Verify:
  - All buttons have proper `aria-label` attributes
  - Color contrast ratios meet WCAG AA standards (4.5:1 for text)
  - Keyboard shortcuts work (Tab to navigate, Enter to activate)
  - Focus indicators are visible
  - No content solely dependent on color
- Document any exclusions with rationale
- Fix high-priority issues

**Dependencies**: All Phase 3–5 tasks

---

## Task 6.6: Performance Audit

**Files Created/Modified**:
- Performance testing script

**Description**:
- Measure load times:
  - Control Dashboard load to interactive: target <2 seconds
  - Stage Display load to interactive: target <2 seconds
  - Room list fetch: target <500ms
  - Room details + timers fetch: target <200ms
- Use browser DevTools Performance tab to identify bottlenecks
- Verify no console errors or warnings
- Test with simulated slow network (3G throttle)
- Document baseline metrics

**Dependencies**: All implementation tasks

---

## Task 6.7: Documentation & Deployment Prep

**Files Created**:
- `README.md`
- `DEPLOYMENT.md`
- `API_DOCUMENTATION.md`

**Description**:
- Write comprehensive README:
  - Project overview
  - Architecture summary
  - File structure explanation
  - Development setup (clone, npm install, start MySQL, etc.)
  - Running the application
  - Known limitations (Phase 1 vs. Phase 2)
- Write DEPLOYMENT.md:
  - Production deployment checklist
  - Environment setup (production .env)
  - Database migration steps
  - HTTPS/SSL requirements
  - Monitoring & error logging recommendations
- Write API_DOCUMENTATION.md:
  - All endpoint specifications
  - Request/response examples
  - Error codes
  - Rate limiting notes (if added)

**Dependencies**: All tasks complete

---

## Task 6.8: Final QA & Launch Checklist

**Files Created**:
- `QA_CHECKLIST.md`
- `LAUNCH_CHECKLIST.md`

**Description**:
- QA Checklist:
  - All 7 user stories verified (acceptance scenarios pass)
  - All 12 success criteria verified
  - No console errors in Chrome, Firefox, Safari, Edge
  - Responsive layout on 1920×1080, 2560×1440, etc.
  - Database schema indexed for performance
  - Error handling covers edge cases
- Launch Checklist:
  - Production database created
  - Environment variables set
  - SSL certificate configured
  - Monitoring/logging enabled
  - Backup strategy in place
  - Team trained on operation
  - Initial event scheduled for testing

**Dependencies**: All QA tasks (6.1–6.7)

---

# Summary by Phase

| Phase | Tasks | Files | Est. Duration |
|-------|-------|-------|-----------------|
| **Phase 1: Database** | 1.1–1.5 | 8 files | 1–1.5 days |
| **Phase 2: Backend API** | 2.1–2.8 | 5 files | 1.5–2 days |
| **Phase 3: Frontend UI** | 3.1–3.6 | 2 files | 1–1.5 days |
| **Phase 4: JS Logic** | 4.1–4.8 | 4 files | 1.5–2 days |
| **Phase 5: Features** | 5.1–5.8 | 4 files (modified) | 1–1.5 days |
| **Phase 6: Testing** | 6.1–6.8 | 3 doc files | 1.5–2 days |
| **TOTAL** | **31 tasks** | **~20 files** | **7–10 days** |

---

# File Count Summary

**New Files to Create**: ~20  
**Total Tasks**: 31  
**Estimated Dev Time**: 7–10 days (1 developer, 8 hrs/day)

---

# Task Dependency Graph

```
Phase 1 (Database)
├── 1.1 Config & Env
├── 1.2 MySQL Schema (depends: 1.1)
├── 1.3 PDO Connection (depends: 1.1, 1.2)
├── 1.4 Validation Utility (depends: 1.1)
└── 1.5 Error Handler

Phase 2 (Backend)
├── 2.1 GET /rooms (depends: 1.3, 1.5)
├── 2.2 GET /rooms/{id} (depends: 1.3, 1.5)
├── 2.3 POST /rooms (depends: 1.3, 1.4, 1.5)
├── 2.4 PUT /rooms/{id} (depends: 1.3, 1.4, 1.5)
├── 2.5 DELETE /rooms/{id} (depends: 1.3, 1.5)
├── 2.6 Health endpoint (depends: 1.3, 1.5)
├── 2.7 Router (depends: 2.1–2.6)
└── 2.8 .htaccess (depends: 2.7)

Phase 3 (Frontend UI)
├── 3.1 index.html
├── 3.2 stage.html
├── 3.3 Style index.html (depends: 3.1)
├── 3.4 Style stage.html (depends: 3.2)
├── 3.5 Timer item placeholder (depends: 3.1)
└── 3.6 Preview window (depends: 3.1)

Phase 4 (JS Logic)
├── 4.1 BroadcastChannel wrapper
├── 4.2 Timer logic (pure functions)
├── 4.3 UI components (depends: 4.2)
├── 4.4 Control app logic (depends: 4.1, 4.3)
├── 4.5 Stage app logic (depends: 4.1, 4.2, 4.3)
├── 4.6 Multi-tab sync (depends: 4.1, 4.4, 4.5)
├── 4.7 Timer math + animation (depends: 4.2, 4.5)
└── 4.8 Error handling (depends: 4.4, 4.5)

Phase 5 (Advanced Features)
├── 5.1 SortableJS (depends: 4.4, 3.5)
├── 5.2 Message formatting (depends: 4.4, 3.1)
├── 5.3 Blackout & flash (depends: 4.4, 4.5)
├── 5.4 Live preview (depends: 4.3, 4.4, 3.1)
├── 5.5 Connection status (depends: 4.6, 3.1)
├── 5.6 Room save/load (depends: 2.4, 4.4)
├── 5.7 Input validation (depends: 4.4, 3.1)
└── 5.8 Unsaved changes warning (depends: 4.4)

Phase 6 (Testing & Refinement)
├── 6.1 E2E workflow (depends: all Phase 4–5)
├── 6.2 Timer accuracy (depends: 4.7, 4.6)
├── 6.3 Multi-tab sync (depends: 4.6, 5.5)
├── 6.4 Error handling (depends: 4.8, 5.6)
├── 6.5 Accessibility (depends: all Phase 3–5)
├── 6.6 Performance (depends: all tasks)
├── 6.7 Documentation (depends: all tasks)
└── 6.8 Final QA (depends: 6.1–6.7)
```

---

# Next Steps

1. **Review & Approve**: Confirm this roadmap matches your vision and constraints
2. **Assign Tasks**: Distribute tasks to developer(s) using this roadmap
3. **Track Progress**: Mark tasks complete as code is written; update completion status
4. **Iterate**: If task scope changes, update roadmap and re-estimate remaining time

**Ready to start coding?** Ask for specific code implementation for any task (e.g., "Task 1.2: Create MySQL schema" → generates actual SQL).

---

**Roadmap Status**: ✅ **APPROVED & READY FOR DEVELOPMENT**  
**Generated**: 2026-03-19  
**Next Update**: Upon task completion or scope change

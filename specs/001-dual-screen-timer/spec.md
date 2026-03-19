# Feature Specification: Dual-Screen Stage Timer (MVP)

**Feature Branch**: `001-dual-screen-timer`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: Core application MVP specification

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator Controls Live Timer (Priority: P1)

An A/V operator sits at the Control Dashboard and manages a live countdown timer for a B1G event on stage. The operator needs to start, pause, skip, and adjust timers in real time, with all changes instantly visible on the Stage Display without any perceptible latency.

**Why this priority**: This is the core value proposition—the operator's experience determines the product's usability and reliability for live events.

**Independent Test**: Operator can start a 10:00 timer, pause it mid-countdown, restart it, and adjust it by ±1 minute. The Stage Display reflects every change in under 100ms with no lag. This can be tested independently with a laptop + external monitor as stage display.

**Acceptance Scenarios**:

1. **Given** a timer exists in the agenda, **When** operator clicks Play, **Then** the timer counts down on Stage Display and the running timer is highlighted (blue background) in the Control Dashboard
2. **Given** a timer is running, **When** operator clicks Pause, **Then** the timer freezes on Stage Display and resumes from the same point when Play is clicked again
3. **Given** a timer is running, **When** operator clicks Restart (|◀), **Then** the timer resets to its original duration and continues counting
4. **Given** a timer is running, **When** operator clicks -1m or +1m, **Then** the duration updates instantly on Stage Display (adjustment increments by exactly 60 seconds)
5. **Given** a timer is running, **When** it reaches 00:00, **Then** it continues counting as negative numbers (e.g., -00:01, -00:02) to show overage
6. **Given** a timer reaches 2:00 remaining, **When** stage display is visible, **Then** the countdown text and progress bar change from green to yellow
7. **Given** a timer reaches 00:00, **When** stage display is visible, **Then** the countdown text and progress bar change to red

---

### User Story 2 - View Live Preview & Event Metadata (Priority: P1)

The operator needs a live preview window in the Control Dashboard showing exactly what is displayed on stage, along with real-time metadata: current local time at the venue, projected finish time ("Cue finish"), and running total overage ("Over/Under"). This provides the operator with immediate confidence that the stage display is correctly formatted and the timers are on track.

**Why this priority**: Live preview is essential for risk mitigation during live events. Without it, the operator is flying blind and cannot catch display errors before they appear on stage.

**Independent Test**: With a timer running, the Control Dashboard preview window matches the Stage Display output exactly. The preview updates every timer tick (sub-millisecond precision). "Cue finish" time is calculated by adding current timer duration to current time of day and remains accurate through timer manipulations.

**Acceptance Scenarios**:

1. **Given** a timer is running on stage, **When** viewing the Control Dashboard, **Then** the live preview window displays the exact same countdown, progress bar color, and time of day as the Stage Display
2. **Given** multiple timers are queued, **When** current timer is running, **Then** "Cue finish" displays the projected end time (current time + remaining duration) and updates in real time
3. **Given** a timer finishes (reaches overage), **When** viewing the preview, **Then** "Over/Under" clearly shows how much time has elapsed past the original duration
4. **Given** the operator adjusts a timer by ±1m, **When** the preview refreshes, **Then** "Cue finish" time recalculates immediately
5. **Given** timers are queued, **When** preview is visible, **Then** the operator can see what the first queued timer will display when it becomes active (preview of upcoming timers optional but encouraged)

---

### User Story 3 - Manage & Queue Timers (Priority: P1)

The operator builds an event rundown by adding, ordering, and configuring individual timer segments in the Control Dashboard. Each segment is a distinct timer with a title (e.g., "Opening Ceremony") and duration (e.g., 10:00). The operator must be able to add new timers, reorder them, delete them, and save the rundown to the database.

**Why this priority**: Event rundowns are the foundation of the application. Without a way to manage the agenda, the timer is unusable.

**Independent Test**: Operator creates a 3-timer rundown, saves it to database, closes the browser, reopens, and the rundown is restored with all timers intact.

**Acceptance Scenarios**:

1. **Given** the Control Dashboard is open, **When** operator clicks "Add Timer" button, **Then** a new blank timer row appears at the bottom of the Timers list with default values (e.g., Title: "Timer X", Duration: "0:00")
2. **Given** a timer row exists, **When** operator edits the title field and duration field, **Then** the changes update immediately in the list (no save required for in-memory state)
3. **Given** multiple timers are in the list, **When** operator clicks "Save" button, **Then** the entire rundown is persisted to MySQL database associated with the current Room
4. **Given** timers are saved to database, **When** operator closes the browser and reopens the application (to the same Room), **Then** the previous rundown is restored with all timers intact
5. **Given** a timer row is selected, **When** operator clicks delete/remove button, **Then** the timer is removed from the list
6. **Given** a timer row exists, **When** operator drags/reorders it, **Then** the position in the queue updates and the calculated start times recalculate
7. **Given** multiple timers are queued, **When** current timer finishes, **When** operator clicks Next Timer (▶|), **Then** playback automatically starts on the next timer in the list

---

### User Story 4 - Send Messages to Stage (Priority: P2)

The operator can compose formatted messages (text color, bold, font size) and send them to a ribbon at the bottom of the Stage Display. Messages can be queued and appear/disappear on command. This enables the operator to communicate visual cues to talent (e.g., "5 MINS TO SHOWTIME").

**Why this priority**: Event coordination often requires text alerts beyond the timer. This feature adds operational flexibility for live event management.

**Independent Test**: Operator composes a white, bold "30 SECONDS TO AIR" message and sends it. The message appears in the Stage Display ribbon, respects the formatting, and can be dismissed from the Control Dashboard.

**Acceptance Scenarios**:

1. **Given** the Messages column is open, **When** operator types text in the input field, **Then** a preview of the message updates in real time (reflecting selected color, bold, font size)
2. **Given** a message is composed, **When** operator clicks "Show", **Then** the message appears in the ribbon at the bottom of the Stage Display
3. **Given** a message is displayed on stage, **When** operator clicks "Hide" or composes a new message, **Then** the current message is removed
4. **Given** the Messages column is open, **When** operator clicks "Add Message" button, **Then** a pre-written message is queued (stored in local memory) and can be quickly shown with a single button press
5. **Given** a message is queued, **When** operator clicks the precomposed message button, **Then** it instantly replaces the current message (if any) on the Stage Display
6. **Given** a message is visible, **When** operator clicks "Focus" or "Flash" buttons, **Then** the Stage Display flashes (full-screen brightness pulse) to grab attention (distinct from message dismiss)

---

### User Story 5 - Blackout & Flash Controls (Priority: P2)

The operator can instantly hide the Stage Display ("Blackout"—fills screen with black) or trigger a flash (brief brightness pulse) to grab talent attention. These are global controls that override any timer or message display.

**Why this priority**: Live event operators need rapid, reliable ways to control what's visible on stage in emergency situations (unexpected pauses, audio issues, talent errors).

**Independent Test**: Operator clicks "Blackout"; Stage Display turns black. Operator clicks "Unblackout" (or equivalent); display resumes normal content. Operator clicks "Flash"; Stage Display pulses white for 500ms then returns to normal.

**Acceptance Scenarios**:

1. **Given** the Stage Display is showing normal content, **When** operator clicks "Blackout", **Then** the entire Stage Display fills with black and all content (timer, time, message) is hidden
2. **Given** the Stage Display is blacked out, **When** operator clicks the Blackout button again (or "Unblackout"), **Then** the display reverts to showing the current timer/message state
3. **Given** the Stage Display is showing content, **When** operator clicks "Flash", **Then** the display briefly pulses white (on for ~500ms) to grab attention, then resumes normal display
4. **Given** a Blackout control is pressed, **When** a timer is still ticking in the background, **Then** the timer state remains active (only the display is hidden; clicking Unblackout shows the timer at its current running time, not frozen)
5. **Given** Blackout is active, **When** operator manually adjusts a timer via Control Dashboard, **Then** the Stage Display remains blacked out (Blackout state is not automatically dismissed)

---

### User Story 6 - Multi-Tab Live Connections (Priority: P2)

The operator can open the Stage Display in a separate browser tab/window or on a different monitor (or send output to a projector via AirPlay/HDMI). The system detects how many Stage Display tabs are actively connected and shows a live connection count in the Control Dashboard. All connected displays stay perfectly in sync via BroadcastChannel API.

**Why this priority**: Flexibility in display deployment (second monitor, projector, separate laptop) is critical for event venues. Connection status visibility helps operators diagnose display failures.

**Independent Test**: Operator opens Control Dashboard on Laptop A and Stage Display on Laptop B over the same network. Timer changes on A appear instantly on B (under 100ms). Connection count in Control Dashboard shows "2 displays connected". Operator closes display tab on B; connection count updates to "1".

**Acceptance Scenarios**:

1. **Given** Control Dashboard is open in one browser tab, **When** operator opens Stage Display in a second tab/window (same browser or different), **Then** both tabs are automatically synchronized via BroadcastChannel API (no manual setup required)
2. **Given** Stage Display is open on a separate tab/window, **When** operator manipulates timers on Control Dashboard, **Then** the Stage Display updates in real time with no perceptible lag (target: <100ms)
3. **Given** multiple Stage Display tabs are open, **When** Blackout is triggered on Control Dashboard, **Then** ALL connected Stage Display tabs turn black simultaneously
4. **Given** Stage Display tabs are connected, **When** a new tab is opened or a tab is closed, **Then** the "Live Connections" counter in Control Dashboard updates in real time
5. **Given** Control Dashboard is open, **When** all Stage Display tabs are closed, **Then** "Live Connections" shows "0" and operator receives visual feedback (e.g., red warning indicator)

---

### User Story 7 - Save & Load Rooms (Priority: P1)

The operator selects or creates a "Room" (a distinct event/venue session) from a dropdown. Each Room has its own timer rundown, saved to the database. The operator can save the current configuration to the database and later reload it. Multiple operators can work with the same Room (with eventual consistency via BroadcastChannel).

**Why this priority**: Persistence is foundational. Without saving rooms, the application is demo-only and unusable for real events.

**Independent Test**: Operator creates a room called "B1G Basketball Final", builds a rundown, clicks "Save". Operator closes the browser. Operator reopens the application, selects "B1G Basketball Final" from the Room dropdown. The rundown is restored exactly as saved.

**Acceptance Scenarios**:

1. **Given** the application loads, **When** operator views the top header, **Then** a "Room" dropdown is visible showing all saved rooms from the database
2. **Given** a room is selected from the dropdown, **When** the page loads/switches rooms, **Then** the timer rundown for that room is loaded and displayed in the Timers column
3. **Given** timers are edited, **When** operator clicks "Save", **Then** the current configuration (all timers, titles, durations) is persisted to the database for the selected room
4. **Given** changes are made to a room, **When** operator selects a different room from the dropdown, **Then** a prompt appears asking to confirm unsaved changes before leaving (or auto-save is triggered)
5. **Given** the Room dropdown is visible, **When** operator enters a new room name and clicks a "Create Room" button, **Then** a new room is created in the database and immediately selected
6. **Given** multiple browser tabs are editing the same room, **When** one tab saves changes, **Then** unsaved changes in other tabs are retained locally (BroadcastChannel notifies other tabs of updates; operator can merge or discard)

---

## Functional Requirements *(mandatory)*

### Frontend Rendering & Interaction

1. **Control Dashboard must display a three-column layout**:
   - Column 1 (Dashboard & Preview): Live preview window, playback controls (Restart, Play/Pause, Next Timer, -1m, +1m), event metadata (current time, "Cue finish", "Over/Under")
   - Column 2 (Timers): Global actions (Blackout, Flash), timer list with inline controls, "Add Timer" button
   - Column 3 (Messages): Text input with formatting options (color, bold, font size), "Show" button, queued message list, "Focus" and "Flash" buttons

2. **Stage Display must be full-screen, dark mode, distraction-free**:
   - Top section: Massive MM:SS countdown (≥120px font, white #FFFFFF on near-black #0a0a0a background)
   - Middle: Progress bar (color: green #10b981 → yellow #f59e0b at 2:00 → red #ef4444 at 00:00)
   - Bottom: Current time of day (≥48px font, HH:MM AM/PM format, white on dark background)
   - Footer ribbon: Message area (appears only when message is active)

3. **All styling must use Tailwind CSS utility classes exclusively**. No inline styles except dynamically calculated dimensions (e.g., progress bar width percentage via JavaScript).

4. **Semantic HTML5 required**: Use `<button>`, `<input>`, `<section>`, `<main>` where appropriate. Accessibility attributes (`aria-label`, `role`) where semantic HTML alone is insufficient.

5. **Real-time sync via BroadcastChannel API**: Timers, blackout state, messages, connection count all broadcast to connected tabs/windows. No polling; event-driven updates only.

### Backend API & Database

6. **PHP endpoints serve JSON only** (never render HTML). RESTful URL structure:
   - `POST /api/v1/rooms` – Create a new room
   - `GET /api/v1/rooms` – List all rooms
   - `GET /api/v1/rooms/{roomId}` – Get room details + timers
   - `PUT /api/v1/rooms/{roomId}` – Update room (save timers)
   - `DELETE /api/v1/rooms/{roomId}` – Delete a room (optional)

7. **All database queries must use PDO prepared statements**. Never concatenate variables into SQL strings (SQL injection prevention).

8. **Input validation**: All incoming data (room names, timer titles, durations, message text) must be validated (length checks, type checks, XSS prevention) and return explicit `400 Bad Request` with error details if invalid.

9. **MySQL schema**:
   - `timer_rooms` table: `id`, `name`, `created_at`, `updated_at`
   - `timer_items` table: `id`, `room_id` (FK), `title`, `duration_seconds`, `position`, `created_at`, `updated_at`
   - Proper indexing on `room_id` and `position` for efficient queries

10. **Error responses must be consistent JSON format**:
    ```json
    {
      "error": "Room not found",
      "code": "ROOM_NOT_FOUND",
      "timestamp": "2026-03-19T14:30:45Z"
    }
    ```

### Performance & Accuracy

11. **Timer accuracy**: JavaScript's `setInterval()` / `setTimeout()` / `requestAnimationFrame()` must be tested for drift over 1+ hour sessions. Target: sub-millisecond precision (native browser limits).

12. **BroadcastChannel latency**: Synchronized updates across tabs must complete in <100ms (browser-native limits, not network-dependent since all tabs are same-origin).

13. **DOM updates**: Minimize reflows by batching updates. Use `requestAnimationFrame()` for smooth visual updates (60 FPS target).

14. **Database queries**: Room + timers fetch should complete in <200ms (single indexed query; N+1 prevented).

### Data Validation & Security

15. **Room names**: Max 100 characters, no special characters except spaces/hyphens, XSS-safe (sanitized before storage and display).

16. **Timer titles**: Max 100 characters, no script tags, XSS-safe.

17. **Timer durations**: Positive integers only (seconds), max value 10 hours (36000 seconds). Validation on both client and server.

18. **Message text**: Max 255 characters, no HTML tags (plain text or basic Markdown), XSS-safe.

19. **Authentication (Phase 2 scope, noted for planning)**: Rooms are not protected by authentication in Phase 1 MVP. All rooms are publicly accessible (same-origin only via BroadcastChannel).

### Error Handling & Resilience

20. **API/Database failure resilience**: When API requests fail or database is unavailable:
    - Display clear error notification on Control Dashboard (e.g., "Connection Lost - Retrying...")
    - Stage Display shows stored state (last known timer, message, blackout state)
    - Allow operator to continue local adjustments (play/pause/adjust timers in memory)
    - Auto-retry connection with exponential backoff
    - Once connection restored, sync local state back to database

21. **Client-side state preservation**: Application maintains in-memory state of all timers, current playback state, blackout status, and messages. On reconnection, operator can choose to: (a) save changes to database, or (b) discard and reload from database.

22. **Network error messages**: Errors to operator must be human-readable and actionable (e.g., "Database connection lost. Local timers will resume when connection is restored."), not cryptic HTTP status codes.

---

## Success Criteria *(mandatory)*

All criteria must be met for MVP launch.

1. **Operator completes a 5-timer event workflow in <2 minutes** from app load to first timer playback (measures ease of use).

2. **Stage Display timer accuracy is within ±50ms over a 60-minute runtime** (measures core product reliability).

3. **Multiple connected Stage Display tabs remain in perfect sync** with <100ms maximum variance between tabs (measures real-time reliability).

4. **Room save/load cycle preserves all timer data with 100% fidelity** (no data corruption, truncation, or loss on reload).

5. **Control Dashboard live preview matches Stage Display output pixel-perfectly** in real time (measures operator confidence).

6. **Operator can trigger Blackout/Flash in <500ms from button click to visual change** on Stage Display (measures responsiveness for emergency situations).

7. **Application loads to fully functional state in <2 seconds** (measures user experience / perceived performance).

8. **All API endpoints return responses within <500ms** for typical operations (create room, get timers, save timers).

9. **Database schema supports 1000+ rooms with no performance degradation** (measures scalability baseline).

10. **No JavaScript errors in console** during any user workflow (measures code quality).

11. **Accessibility: Control Dashboard and Stage Display pass WCAG 2.1 Level AA** (or documented exclusions with rationale).

12. **Operators report >90% confidence that the application is "ready for live events"** (measures subjective readiness; captured via feedback interviews).

---

## Key Entities

### Room
- **ID**: Unique identifier (UUID or auto-increment)
- **Name**: Event/venue session name (string, max 100 chars)
- **TimerItems**: Collection of timer segments
- **CreatedAt, UpdatedAt**: Timestamps

### TimerItem
- **ID**: Unique identifier
- **RoomID**: Foreign key to Room
- **Title**: Segment name (string, max 100 chars)
- **DurationSeconds**: Timer duration (integer, 0–36000)
- **Position**: Order in queue (integer, auto-calculated)
- **CreatedAt, UpdatedAt**: Timestamps

### Session State (in-memory, BroadcastChannel synced)
- **CurrentTimerID**: Which timer is playing (if any)
- **ElapsedSeconds**: Time elapsed in current timer
- **IsPlaying**: Boolean
- **BlackoutActive**: Boolean
- **CurrentMessage**: String (if any)
- **MessageFormatting**: { color, bold, fontSize }
- **ConnectedDisplayCount**: Integer

---

## Clarifications

### Session 2026-03-19

- Q: When multiple browser tabs have the Stage Display open or multiple Control Dashboards connect, how should timer control conflicts be resolved? → A: All connected tabs/dashboards can control timers; last command wins (broadcast to all).
- Q: What are the exact font sizes and color scheme targets for the Stage Display (venue projection scenarios)? → A: Countdown font >=120px, time-of-day font >=48px; text white (#FFFFFF), background near-black (#0a0a0a), progress bar: green (#10b981) -> yellow (#f59e0b) at 2:00 -> red (#ef4444) at 00:00.
- Q: When a critical failure occurs (e.g., database unavailable, API returns 500), what should the application display and behavior? → A: Display error notification; retain last known state in memory; allow local timer adjustments; auto-reconnect when available.
- Q: What are the practical scalability limits for timers per room, concurrent dashboards, and daily active rooms? → A: 100 timers max/room, 5 concurrent dashboards/room, 100 daily active rooms MVP baseline.
- Q: Should MVP implement full drag-to-reorder or simplified arrow button reordering? → A: Full drag-to-reorder support (HTML5 drag-drop or SortableJS library).

---

## Assumptions

- **Same-origin deployment**: Control Dashboard and Stage Display are on the same domain (or subdomain supporting BroadcastChannel). Cross-origin scenarios (e.g., different domain) are out of scope for Phase 1.
- **Concurrent dashboard control**: Multiple Control Dashboard tabs can connect and issue commands simultaneously. The most recent command takes effect and broadcasts to all connected displays. Collision handling is on the operator (intent is to support backup control in live event scenarios).
- **Timer drift tolerance**: Sub-millisecond precision is not achievable; ±50ms is the acceptable ceiling (native browser limitations).
- **Persistent connection assumed**: Network connectivity is stable for the duration of an event. Offline-first / reconnection strategies are Phase 2 scope.
- **Modern browser stack**: ES6+ support, BroadcastChannel API support (Chrome/Firefox/Safari/Edge all support; IE11 not supported).
- **No authentication in Phase 1**: Rooms are not password-protected. Security is left to network/deployment (VPN, firewall).
- **Message text is plain text only**: No embedded images, videos, or complex formatting (color/bold/size only).
- **Timer reordering UX**: Full drag-to-reorder support using HTML5 drag-drop API or SortableJS library (not simplified to arrow buttons). Improves event workflow efficiency.
- **MVP scalability targets**: Maximum 100 timers per room, 5 concurrent dashboards per room, baseline of 100 daily active rooms. These constraints ensure reasonable performance without over-engineering Phase 1.

---

## Out of Scope (Phase 2+)

- Authentication / multi-user authorization
- Persistent message templates library
- Timer presets / templates
- Event recording / playback / analytics
- Mobile responsive UI (desktop-first in MVP)
- Network reconnection / offline mode
- Timer sound effects / audio cues
- Webhook integration with external systems
- Branding customization per event

---

**Status**: Ready for specification validation and planning.

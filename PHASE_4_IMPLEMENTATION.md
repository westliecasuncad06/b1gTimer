# Phase 4 Implementation Guide: JavaScript Logic & Real-Time Integration

**Phase**: 4 (JavaScript Logic & Real-Time Integration)  
**Tasks**: 4.1–4.8  
**Status**: ✅ COMPLETE  
**Files Created**: 9 JavaScript modules + HTML script tag updates  

---

## Overview

Phase 4 implements the complete JavaScript application layer, connecting the frontend UI (Phase 3) to the backend API (Phase 2) with real-time WebSocket updates via Pusher. All modules are globally accessible and work together through a publish-subscribe event system.

---

## Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ Application Layer                                               │
│ ├─ ControlDashboard (Event handlers, UI logic)   [control-dashboard.js]
│ └─ StageDisplay (Real-time updates, rendering)   [stage-display.js]
├─────────────────────────────────────────────────────────────────┤
│ Business Logic Layer                                            │
│ ├─ RoomManager (CRUD operations)                 [room-manager.js]
│ ├─ TimerEngine (Countdown + playback controls)   [timer-engine.js]
│ ├─ MessageManager (Show/hide/style messages)     [message-manager.js]
│ └─ PusherManager (WebSocket connection)          [pusher-manager.js]
├─────────────────────────────────────────────────────────────────┤
│ State & Utilities Layer                                         │
│ ├─ StateManager (App state tree + events)        [state-manager.js]
│ ├─ TimerMath (Countdown math, transformations)   [timer-math.js]
│ └─ APIClient (HTTP wrapper for REST endpoints)   [api-client.js]
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Reference

### 1. api-client.js (Task 4.1)

**Purpose**: HTTP wrapper for all backend API calls

**Global**: `window.APIClient`

**Methods**:
- `APIClient.getRooms()` – Fetch all rooms
- `APIClient.getRoom(roomId)` – Fetch room with timers
- `APIClient.createRoom(name)` – Create new room
- `APIClient.updateRoom(roomId, name, timers)` – Update room
- `APIClient.deleteRoom(roomId)` – Delete room
- `APIClient.broadcastEvent(roomId, action, payload, displayId)` – Send event via Pusher
- `APIClient.getHealth()` – Health check

**Example**:
```javascript
const rooms = await APIClient.getRooms();
console.log(rooms);  // Array of room objects

await APIClient.broadcastEvent(1, 'TIMER_START', {timerId: 1});
```

---

### 2. timer-math.js (Tasks 4.2, 4.7)

**Purpose**: Timer calculations, time formatting, venue timezone handling

**Global**: `window.TimerMath`

**Key Methods**:
- `TimerMath.formatTime(seconds)` → "05:30"
- `TimerMath.parseTime("05:30")` → 330 (seconds)
- `TimerMath.getNowInVenue()` → Date object in venue timezone (Asia/Manila)
- `TimerMath.formatVenueTime(date?)` → "12:34 PM"
- `TimerMath.calculateProgress(remaining, duration)` → 0–100
- `TimerMath.getProgressColor(progress)` → "#4ade80" (green) | "#facc15" (yellow) | "#ef4444" (red)
- `TimerMath.formatDuration(seconds)` → "5m 30s"

**Venue Timezone Logic**:
```javascript
// All countdown math uses server time (UTC)
// Display always shows venue time (Asia/Manila)
const venueTime = TimerMath.getNowInVenue();  // Returns date in Manila time
const display = TimerMath.formatVenueTime(venueTime);  // "3:45 PM"
```

---

### 3. state-manager.js (Task 4.8)

**Purpose**: Centralized application state tree + pub-sub event system

**Global**: `window.StateManager`

**State Tree**:
```javascript
StateManager.state = {
  // UI
  selectedRoomId: 1,
  selectedTimerId: 3,
  isBlackedOut: false,
  
  // Data
  rooms: [],
  currentRoom: {...},
  timers: [{id, title, duration_seconds, position}, ...],
  
  // Timer Runtime
  isRunning: false,
  currentTimerIndex: 0,
  currentTimerStartTime: "2026-03-19T13:00:00Z",
  currentTimerRemainingSeconds: 300,
  
  // Messages
  activeMessage: {text, color, bold, fontSize, shownAt},
  messageQueue: [...],
  messageStyle: {color, bold, fontSize}
}
```

**Events**:
```javascript
// Subscribe to state changes
StateManager.on('room-selected', (data) => {
  console.log('Room selected:', data.roomId);
});

StateManager.on('timer-started', (data) => {
  console.log('Timer started:', data.timerIndex, data.remainingSeconds);
});

// Emit events
StateManager.emit('room-selected', {roomId: 1});
```

**All Events**:
- `room-selected`, `timer-list-changed`, `timer-started`, `timer-stopped`, `timer-updated`
- `message-shown`, `message-hidden`, `blackout-toggled`

---

### 4. pusher-manager.js (Task 4.3)

**Purpose**: WebSocket connection management and event routing

**Global**: `window.PusherManager`

**Methods**:
- `PusherManager.initialize()` – Initialize Pusher SDK (async)
- `PusherManager.subscribeToRoom(roomId, onEventCallback)` – Subscribe to room channel
- `PusherManager.unsubscribeFromRoom()` – Disconnect from room
- `PusherManager.getStatus()` → {isConnected, hasRoom, roomId, channel}

**Example**:
```javascript
// Initialize Pusher
await PusherManager.initialize();

// Subscribe to room 1
PusherManager.subscribeToRoom(1, (action, data) => {
  console.log(`Event: ${action}`, data);
});

// Check connection
console.log(PusherManager.getStatus());
// {isConnected: true, hasRoom: true, roomId: 1, channel: "presence-room-1"}
```

**Connection Indicator**: Updates `#connection-status` element color (red = disconnected, green = connected)

---

### 5. room-manager.js (Task 4.1)

**Purpose**: Room CRUD operations and timer list management

**Global**: `window.RoomManager`

**Methods**:
- `RoomManager.loadRooms()` – Fetch all rooms, populate selector
- `RoomManager.loadRoom(roomId)` – Load room and subscribe to updates
- `RoomManager.createRoom(name)` – Create new room
- `RoomManager.updateRoom(roomId, name, timers)` – Save room changes
- `RoomManager.deleteRoom(roomId)` – Delete room
- `RoomManager.renderTimerList(timers)` – Render timers in DOM

**Example**:
```javascript
// Load all rooms
const rooms = await RoomManager.loadRooms();

// Load specific room
const room = await RoomManager.loadRoom(1);
// Automatically subscribes to Pusher for real-time updates

// Create room
const newRoom = await RoomManager.createRoom("My Event");

// Save changes
await RoomManager.updateRoom(1, "Updated Name", [
  {id: 1, title: "Cue 1", duration_seconds: 300, position: 0},
  {id: null, title: "New Cue", duration_seconds: 600, position: 1}
]);
```

---

### 6. timer-engine.js (Task 4.2)

**Purpose**: Timer countdown, playback controls (play/pause/stop/reset), time adjustment

**Global**: `window.TimerEngine`

**Methods** (all broadcast events via Pusher):
- `TimerEngine.start(timerIndex, remainingSeconds?)` – Start countdown
- `TimerEngine.pause()` – Pause running timer
- `TimerEngine.resume()` – Resume paused timer
- `TimerEngine.stop()` – Stop timer completely
- `TimerEngine.reset()` – Reset to full duration
- `TimerEngine.skipToNext()` – Advance to next timer
- `TimerEngine.skipToPrevious()` – Go back to previous timer
- `TimerEngine.adjustTime(deltaSeconds)` – Add/subtract time

**Countdown Tick**:
- Runs every 100ms for smooth display
- Automatic time calculation based on start time
- Stops automatically when reaching zero

**Example**:
```javascript
// Start timer (index 0)
TimerEngine.start(0);

// Adjust time
TimerEngine.adjustTime(60);  // Add 1 minute
TimerEngine.adjustTime(-30);  // Subtract 30 seconds

// Play / Pause toggle
if (StateManager.state.isRunning) {
  TimerEngine.pause();
} else {
  TimerEngine.resume();
}

// Skip to next
TimerEngine.skipToNext();
```

---

### 7. message-manager.js (Task 4.6)

**Purpose**: Message show/hide/style/queue on Stage Display

**Global**: `window.MessageManager`

**Methods**:
- `MessageManager.showMessage(text, color, bold, fontSize)` – Display message
- `MessageManager.hideMessage()` – Hide message
- `MessageManager.flashMessage(text, color, bold, fontSize)` – Show + flash animation
- `MessageManager.updateMessageStyle(color, bold, fontSize)` – Update UI controls
- `MessageManager.renderMessageQueue()` – Display message history
- `MessageManager.displayMessageOnStage(data)` – Internal: render on Stage Display
- `MessageManager.hideMessageOnStage()` – Internal: hide message ribbon

**Color Support**: white, yellow, red, green, blue, magenta, cyan, black

**Example**:
```javascript
// Show message on Stage Display
await MessageManager.showMessage(
  "Welcome to the Event!",
  "yellow",        // color
  true,            // bold
  48               // fontSize (px)
);

// Flash message
await MessageManager.flashMessage("STOP!", "red", true, 64);

// Hide message
await MessageManager.hideMessage();
```

---

### 8. state-manager.js (Task 4.8)

*(See above - full documentation provided in section 3)*

---

## Application Modules

### ControlDashboard (control-dashboard.js) – Task 4.4

**Purpose**: Control Dashboard event handlers and UI updates

**Global**: `window.ControlDashboard` (auto-initializes on page load)

**Init Flow**:
1. Initialize Pusher connection
2. Load all rooms into selector
3. Setup event listeners on buttons
4. Setup state change listeners
5. Start time display update (every 1s)
6. Start health check (every 30s)

**Button Event Handlers**:
- **Playback**: Restart, Play/Pause, Next, Previous
- **Time Adjustment**: -1m, +1m
- **Global**: Blackout On/Off, Flash
- **Timer Mgmt**: Add Timer, Save Changes
- **Messages**: Show, Hide, Focus, Flash
- **Color Picker**: 8 color swatches
- **Style Options**: Bold checkbox, Font Size dropdown

**Event Flow**:
```
User clicks "Play" button
  ↓
ControlDashboard.togglePlayPause()
  ↓
TimerEngine.start(timerIndex, initialSeconds)
  ↓
APIClient.broadcastEvent(roomId, 'TIMER_START', {...})
  ↓
Pusher broadcasts to all connected clients
  ↓
StageDisplay receives event and starts countdown
  ↓
State updates propagate to all subscribers
```

---

### StageDisplay (stage-display.js) – Task 4.5

**Purpose**: Receive real-time updates and render on projection display

**Global**: `window.StageDisplay` (auto-initializes on page load with room ID from URL)

**Initialization**:
```javascript
// Access room ID from query parameter
// http://localhost/stage.html?room=1
const roomId = getStageRoomId();  // Returns 1
StageDisplay.init(roomId);
```

**Display Elements**:
- `#countdown` – Large timer display (MM:SS)
- `#progress-bar` – Animated progress bar (0–100%)
- `#time-of-day` – Venue time (HH:MM AM/PM)
- `#message-ribbon` – Message display overlay
- `#blackout-overlay` – Full-screen black overlay
- `#connection-status` – Connection indicator (red/green dot)

**Event Handlers** (receives from Pusher):
```javascript
StageDisplay.handleRoomEvent('TIMER_START', {
  timerIndex: 0,
  remainingSeconds: 300
});
// → Starts countdown animation
// → Updates progress bar

StageDisplay.handleRoomEvent('BLACKOUT_ON', {});
// → Shows black overlay

StageDisplay.handleRoomEvent('MESSAGE_SHOW', {
  text: "Welcome!",
  color: "white",
  bold: false,
  fontSize: 36
});
// → Displays message in ribbon at bottom
```

---

## Data Flow Diagrams

### User Action → All Clients

```
Control Dashboard User
    ↓
(Clicks "Play" button)
    ↓
ControlDashboard event listener
    ↓
TimerEngine.start(timerIndex, seconds)
    ↓
APIClient.broadcastEvent(roomId, 'TIMER_START', {data})
    ↓
HTTP POST /api/v1/broadcast
    ↓
Backend broadcasts to Pusher channel "presence-room-{roomId}"
    ↓
Pusher distributes to all subscribed clients:
├─ Control Dashboard (sees UI update from StateManager)
└─ Stage Display (receives event, starts countdown animation)
```

### Real-Time Event Propagation

```
Pusher sends 'TIMER_START' event
    ↓
Control Dashboard receives (PusherManager)
    ↓
Triggers TimerEngine.handleRemoteEvent('TIMER_START', data)
    ↓
Updates StateManager.state
    ↓
StateManager emits 'timer-started' event
    ↓
All listeners updated:
├─ Update countdown display
├─ Update progress bar
└─ Update play button UI
```

---

## Error Handling & Recovery

All modules include error handling:

```javascript
// API errors
try {
  await APIClient.getRooms();
} catch (error) {
  console.error('API Error:', error);
  RoomManager.showError('Failed to load rooms');
}

// Pusher connection issues
PusherManager.pusher.connection.bind('error', (err) => {
  console.error('Pusher Error:', err);
  PusherManager.updateConnectionStatus(false);
});

// State mutation safety
StateManager.on('any-event', (data) => {
  try {
    // Handle state change
  } catch (error) {
    console.error('State handler error:', error);
  }
});
```

---

## Integration with Phase 2 API

All 5 endpoints (from Phase 2) are consumed:

| Endpoint | Called By | Trigger |
|----------|-----------|---------|
| GET /api/v1/rooms | RoomManager.loadRooms() | Page load, after room creation |
| GET /api/v1/rooms/{id} | RoomManager.loadRoom(id) | Room selector change |
| POST /api/v1/rooms | RoomManager.createRoom(name) | Create button (Phase 5) |
| PUT /api/v1/rooms/{id} | RoomManager.updateRoom() | Save button |
| DELETE /api/v1/rooms/{id} | RoomManager.deleteRoom(id) | Delete button (Phase 5) |
| POST /api/v1/broadcast | APIClient.broadcastEvent(...) | Any timer/message/display event |
| GET /api/v1/health | ControlDashboard health check | Every 30 seconds |

---

## Integration with Phase 1 Configuration

**Timezone Handling**:
- All database timestamps: UTC (SERVER_TIMEZONE)
- All display calculations: Asia/Manila (VENUE_TIMEZONE)
- Automatic via `TimerMath.getNowInVenue()`

**Validation**:
- Input validation happens client-side before API calls
- Backend validates again (defense in depth)
- Errors caught and displayed to user

---

## Usage Examples

### Complete User Session

```javascript
// 1. Page loads
// → ControlDashboard.init() executes
// → Rooms loaded from API
// → Pusher connected

// 2. User selects room from dropdown
// → RoomManager.loadRoom(1)
// → Timers rendered in list
// → Subscribed to room events

// 3. User clicks "Play" button
// → ControlDashboard.togglePlayPause()
// → TimerEngine.start(0, 300)
// → Event broadcasts to Pusher
// → Stage Display receives and starts countdown

// 4. User adjusts time
// → TimerEngine.adjustTime(60)
// → Event broadcasts
// → All clients updated

// 5. User sends message
// → MessageManager.showMessage("Hello", "yellow", true, 48)
// → Event broadcasts
// → Appears on Stage Display with styling

// 6. User stops timer
// → TimerEngine.stop()
// → Event broadcasts
// → All clients stop countdown
```

---

## Testing & Debugging

**Browser Console Commands**:
```javascript
// Check app state
console.log(StateManager.getState());

// Check Pusher connection
console.log(PusherManager.getStatus());

// List all rooms
console.log(StateManager.state.rooms);

// Manually trigger event
StateManager.emit('timer-started', {timerIndex: 0, remainingSeconds: 300});

// Test time formatting
console.log(TimerMath.formatTime(125));     // "02:05"
console.log(TimerMath.formatVenueTime());   // "1:23 PM"
```

---

## Next Steps (Phase 5+)

Planned enhancements:
- **Phase 5**: Toast notifications, keyboard shortcuts, preset messages
- **Phase 6**: Unit tests (Jest), integration tests (Cypress), E2E tests
- **Future**: Analytics, event scheduling, multi-room orchestration

---

**Status**: ✅ Phase 4 Complete (8/8 tasks)  
**Integration**: Full backend-to-frontend connection with real-time WebSockets  
**Ready for**: Phase 5 (Advanced Features & Polish)  
**Token Budget**: ~70K remaining (35% of 200K)

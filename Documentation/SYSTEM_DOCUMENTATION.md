# B1G Timer - Complete System Documentation

**Version**: 1.0 MVP  
**Last Updated**: March 19, 2026  
**Status**: Production Ready  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [User Guides](#user-guides)
5. [API Documentation](#api-documentation)
6. [Database Documentation](#database-documentation)
7. [JavaScript Modules](#javascript-modules)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance](#maintenance)

---

## System Overview

### What is B1G Timer?

B1G Timer is a **real-time event timer and display system** designed for conferences, events, and presentations. It enables a single operator to control multiple large-screen countdown displays from a central Control Dashboard.

**Key Features**:
- Real-time synchronized countdowns across unlimited displays
- Rich messaging with color, formatting, and styling options
- Special display effects (blackout, flash)
- Multi-timer event management
- Web-based (no installation needed)
- Mobile-responsive
- WCAG 2.1 Level AA Accessible
- <150ms real-time synchronization

### Use Cases

1. **Conference Management**: Schedule multiple sessions with automatic transitions
2. **Event Countdown**: Display countdown to event start
3. **Session Timer**: Keep presentations on schedule
4. **Breakout Sessions**: Run parallel timed activities
5. **Live Events**: Real-time audience engagement

### Who Uses It?

- **Event Operators**: Create and manage timers
- **Audience**: View countdown and messages on displays
- **Technicians**: Deploy and maintain displays

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CONTROL DASHBOARD                     │
│  Browser (Chrome/Firefox/Safari)  - Operator Controls   │
│  ├─ Room Management                                      │
│  ├─ Timer Control (Play/Pause/Adjust)                  │
│  ├─ Message Display                                      │
│  ├─ Connection Status                                    │
│  └─ Live Preview Window                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP REST API
                   ↓
┌─────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                        │
│  PHP 8+ REST API  - Data Management & Broadcasting      │
│  ├─ Room CRUD (Create/Read/Update/Delete)              │
│  ├─ Timer CRUD                                           │
│  ├─ Message Broadcast                                    │
│  ├─ Pusher Broadcaster                                   │
│  └─ Database Connection (PDO)                           │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ↓          ↓          ↓
    ┌────────┐ ┌────────┐ ┌────────┐
    │ MySQL  │ │ Pusher │ │ Pusher │
    │Database│ │ Cloud  │ │ Auth   │
    └────────┘ └────────┘ └────────┘
        │          ↑
        └──────────┤
                   │ WebSocket (Pusher)
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ↓              ↓              ↓
┌─────────┐  ┌─────────┐  ┌─────────┐
│STAGE    │  │STAGE    │  │STAGE    │
│DISPLAY 1│  │DISPLAY 2│  │DISPLAY 3│
│Browser  │  │Browser  │  │Browser  │
│(iPad)   │  │(TV)     │  │(Laptop) │
│         │  │         │  │         │
│Countdown│  │Countdown│  │Countdown│
│Progress │  │Progress │  │Progress │
│Message  │  │Message  │  │Message  │
└─────────┘  └─────────┘  └─────────┘
```

### Technology Stack

**Backend**:
- **Language**: PHP 8.0+
- **Web Server**: Apache 2.4+
- **Database**: MySQL 5.7+ / MariaDB 10.3+
- **Real-Time**: Pusher WebSocket API
- **Pattern**: REST API + MVC

**Frontend**:
- **HTML**: HTML5 Semantic
- **CSS**: Tailwind CSS 3.0+
- **JavaScript**: Vanilla ES6+ (13 modules)
- **Real-Time**: Pusher JavaScript Client
- **Icons**: Font Awesome 6.0+

**Infrastructure**:
- **Hosting**: Any PHP-capable web host (e.g., InfinityFree, Bluehost)
- **SSL**: HTTPS required (Let's Encrypt)
- **DNS**: Domain required
- **CDN**: Optional (CloudFlare)

### Data Flow

```
1. Operator creates room in Control Dashboard
   ↓
2. Room saved to MySQL database via REST API
   ↓
3. Operator adds timers to room
   ↓
4. Timers saved to database (timer_items table)
   ↓
5. Operator clicks "Play" button
   ↓
6. Control Dashboard sends action to backend API (/api/broadcast/action)
   ↓
7. Backend broadcasts action via Pusher to all Stage Displays
   ↓
8. Stage Display receives WebSocket message
   ↓
9. Stage Display updates countdown display
   ↓
10. Timer continues until 00:00 (all Stage Displays synchronized)
```

---

## Installation & Setup

### Prerequisites

**Server Requirements**:
- PHP 8.0 or higher
- MySQL 5.7 or MariaDB 10.3 (or higher)
- Apache 2.4+ with mod_rewrite enabled
- OpenSSL (for HTTPS)
- Git (recommended for deployment)

**Pusher Account**:
- Create Pusher account at https://pusher.com
- Create a new Channels App
- Note: app_id, key, secret, cluster

**Development Tools**:
- Terminal/Command Prompt
- Text Editor (VS Code recommended)
- Browser (Chrome, Firefox, Safari, Edge)

### Step 1: Clone/Download Repository

```bash
# Clone repository (if using Git)
git clone https://github.com/yourusername/b1g-timer.git
cd b1g-timer

# Or download ZIP and extract to web root
# Example: /var/www/html/b1g-timer or C:\xampp\htdocs\b1g-timer
```

### Step 2: Create Environment Configuration

```bash
# Copy example environment file
cp config/.env.example config/.env.production

# Edit configuration
nano config/.env.production
# or open with text editor
```

**Configuration File** (`config/.env.production`):

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=b1g_timer
DB_USER=b1g_user
DB_PASSWORD=strong_password_here

# Pusher Configuration
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=mt1

# Application
APP_URL=https://yourdomain.com
APP_ENV=production
LOG_LEVEL=ERROR

# Timezone (for display - database stores UTC)
DISPLAY_TIMEZONE=Asia/Manila
```

### Step 3: Create Database

```bash
# Connect to MySQL
mysql -u root -p

# Create database
mysql> CREATE DATABASE b1g_timer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create user
mysql> CREATE USER 'b1g_user'@'localhost' IDENTIFIED BY 'strong_password_here';

# Grant permissions
mysql> GRANT ALL PRIVILEGES ON b1g_timer.* TO 'b1g_user'@'localhost';

# Apply changes
mysql> FLUSH PRIVILEGES;

# Exit MySQL
mysql> EXIT;
```

### Step 4: Run Database Migration

```bash
# Connect to database and run schema
mysql -u b1g_user -p b1g_timer < schema/001-initial-schema.sql

# Verify tables created
mysql -u b1g_user -p b1g_timer
mysql> SHOW TABLES;
```

**Expected Output**:
```
+------------------------+
| Tables_in_b1g_timer    |
+------------------------+
| timer_items            |
| timer_rooms            |
+------------------------+
```

### Step 5: Configure Web Server

**Apache Virtual Host** (`/etc/apache2/sites-available/b1g-timer.conf`):

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    DocumentRoot /var/www/b1g-timer/public
    
    # Redirect HTTP to HTTPS
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    DocumentRoot /var/www/b1g-timer/public
    
    # SSL Certificate
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/yourdomain.pem
    SSLCertificateKeyFile /etc/ssl/private/yourdomain.key
    
    # Enable mod_rewrite
    <Directory /var/www/b1g-timer/public>
        AllowOverride All
        Require all granted
    </Directory>
    
    # PHP Handler
    <FilesMatch \.php$>
        SetHandler "proxy:unix:/run/php/php8.0-fpm.sock|fcgi://localhost"
    </FilesMatch>
    
    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
</VirtualHost>
```

**Enable Configuration**:
```bash
sudo a2ensite b1g-timer.conf
sudo systemctl restart apache2
```

### Step 6: Set File Permissions

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/b1g-timer

# Set file permissions
sudo chmod -R 755 /var/www/b1g-timer
sudo chmod -R 644 /var/www/b1g-timer/*.{php,html}
sudo chmod 600 config/.env.production

# Set writable directories (if needed)
sudo chmod -R 775 /var/www/b1g-timer/logs
sudo chmod -R 775 /var/www/b1g-timer/cache
```

### Step 7: Test Installation

```bash
# Health check
curl https://yourdomain.com/api/health

# Expected response:
{
    "status": "ok",
    "timestamp": "2026-03-19T12:00:00Z",
    "database": "connected",
    "version": "1.0"
}
```

### Step 8: Access Application

- **Control Dashboard**: https://yourdomain.com/index.html
- **Stage Display**: https://yourdomain.com/stage.html
- **API Documentation**: https://yourdomain.com/API_DOCUMENTATION.md

---

## User Guides

### Part 1: Control Dashboard User Guide

**URL**: `https://yourdomain.com/index.html`

#### 1. Creating a New Room

1. Click **"Room Selector"** dropdown at the top
2. Click **"+ New Room"** button
3. Enter room name (max 100 characters):
   - Example: "Tech Conference 2026"
4. Click **"Create"** button
5. Room is created and automatically selected

**Success Indicators**:
- Green checkmark appears
- Room name appears in dropdown
- (unsaved changes) indicator shown

#### 2. Adding Timers

1. In the timer list (center), click **"+ Add Timer"** button
2. Enter timer details:
   - **Title**: Name of this segment (e.g., "Keynote")
   - **Duration**: Time in MM:SS format (e.g., 45:00 = 45 minutes)
3. Click **"Add"** button
4. Timer appears in list
5. Repeat for each segment of your event

**Example Event Setup**:
```
Timer 1: Registration (30:00)
Timer 2: Keynote     (45:00)
Timer 3: Break       (15:00)
Timer 4: Sessions    (60:00)
Timer 5: Closing     (15:00)
```

#### 3. Reordering Timers

**Method 1: Drag and Drop**
1. Hover over timer to reveal drag handle (::)
2. Click and drag to new position
3. Release to drop
4. Timer reorders instantly

**Method 2: Arrow Buttons**
1. Click **↑** button to move timer up one position
2. Click **↓** button to move timer down one position
3. Repeat until in correct order

**Method 3: Keyboard Navigation**
1. Click on timer to focus
2. Use **↑/↓** arrow keys to reorder
3. Press **Enter** to confirm

#### 4. Saving Your Setup

1. After adding/reordering timers, click **"Save Changes"** button
2. Wait for confirmation (usually <1 second)
3. "Saved successfully" message appears (green)
4. Unsaved indicator (orange dot) disappears

**Auto-Save**: Changes auto-save every 30 seconds if you don't click Save

#### 5. Starting a Timer

1. Click **"Play"** button in the left column (under "Actions")
2. Timer begins countdown
3. All connected Stage Displays show synchronized countdown
4. Play button changes to **"Pause"**
5. Progress bar appears (green, fills from right to left)

**Live Preview**: Watch the countdown in the preview window (left column)

#### 6. Controlling Timer Playback

**Pause**: Click **"Pause"** button to pause countdown
- Timer stops on all displays
- Click **"Play"** to resume

**Adjust Time**:
- Click **"-1m"** to subtract 1 minute
- Click **"+1m"** to add 1 minute
- Changes instantly on all displays

**Next Timer**: Click **"Next Timer"** button to advance to next segment
- Current timer stops
- Next timer (e.g., "Keynote") becomes active
- Countdown resets to full duration (e.g., 45:00)
- If playing, continues automatically

#### 7. Sending Messages

**Basic Message**:
1. Type message in **"Message Text"** field (max 255 characters)
2. Click **"Show"** button
3. Message appears on all Stage Displays

**Formatted Message**:
1. Type message in text field
2. Select **Color** (click color swatch):
   - 8 preset colors: Red, Orange, Yellow, Green, Cyan, Blue, Purple, White
3. Check **"Bold"** checkbox to make text bold
4. Select **"Font Size"**:
   - Small (24px), Medium (32px), Large (48px), Extra Large (64px)
5. Click **"Show"** button
6. Formatted message appears on all displays

**Message Preview**: 
- Preview window shows how message will appear on Stage Display
- Updates in real-time as you adjust formatting

**Hiding Message**:
- Click **"Hide"** button
- Message disappears from all displays

**Message History**:
- Recent messages shown in "Message Queue" list
- Click message to quick-show without re-typing

#### 8. Special Effects

**Blackout**:
1. Click **"Blackout"** button
2. All Stage Displays go completely black
3. Timer continues running (behind the scenes)
4. Click **"Unblackout"** to restore display

**Flash Signal** (brief white pulse):
1. Click **"Flash"** button
2. All Stage Displays flash white for 500ms
3. Useful for getting attention during presentations

#### 9. Connection Status

**Header Indicators**:
- **Green Dot + "Connected"**: System connected to all displays
- **Red Dot + "Connecting..."**: Attempting to reconnect
- **Red Dot + "Disconnected"**: No connection (temporary)

**Display Counter**:
- Shows "Live Connections: X displays"
- Updates in real-time as displays connect/disconnect
- Helps verify all projectors are connected

#### 10. Switching Rooms

1. Click **"Room Selector"** dropdown
2. Select different room from list
3. If unsaved changes, confirmation dialog appears:
   - **Save**: Save current room, then switch
   - **Discard**: Discard changes, switch immediately
   - **Cancel**: Don't switch, continue editing

**Keyboard Shortcut**: Press **Spacebar** to toggle Play/Pause

---

### Part 2: Stage Display User Guide

**URL**: `https://yourdomain.com/stage.html`

**For Full-Screen Display**:
1. Open stage.html in browser
2. Press **F11** (full screen) or **Cmd+Ctrl+F** (Mac)
3. Display fills entire screen

#### Display Elements

**1. Countdown Timer** (Large, center)
- Shows remaining time in **HH:MM:SS** format
- Updates every 1 second during countdown
- Examples:
  - 45:00 (45 minutes)
  - 05:23 (5 minutes, 23 seconds)
  - 00:15 (15 seconds)

**2. Progress Bar** (Top of screen)
- Green bar shows progress of current timer
- Fills from left to right as timer counts down
- Disappears when timer reaches 00:00

**3. Time of Day** (Bottom right)
- Shows current venue time (Asia/Manila timezone)
- Updates every 10 seconds
- Format: HH:MM (24-hour or 12-hour based on browser locale)

**4. Message Ribbon** (Center, below countdown)
- Displays operator messages
- Shows formatted text (color, bold, size)
- Auto-hides when hidden by operator

**5. Connection Indicator** (Top right)
- **Green Dot + "Connected"**: Online and synced
- **Red Dot + "Disconnected"**: Offline
- **Pulsing Animation**: Attempting to reconnect

#### What to Expect

**When Timer Starts**:
- Countdown appears (e.g., 45:00)
- Progress bar appears (green)
- Numbers change every second
- Stage Display stays in sync with all other displays

**When Timer Ends** (reaches 00:00):
- Countdown shows 00:00
- Progress bar disappears
- Next timer message may appear (if broadcast)

**During Blackout**:
- Screen goes completely black
- Timer still running (behind the scenes)
- All elements hidden

**During Flash**:
- Screen briefly flashes white
- Returns to countdown display
- Useful attention signal

#### Tips for Best Display

1. **Full Screen**: Always use full-screen mode (F11)
2. **Brightness**: Adjust display brightness for venue lighting
3. **Distance**: Position 15+ feet from audience
4. **Refresh**: Reload page if display gets stuck:
   - Press **F5** or **Cmd+R**
   - Or add `?v=1` to URL to force cache refresh

---

## API Documentation

### Base URL

```
https://yourdomain.com/api/v1
```

### Authentication

**Current Version**: No authentication required (public API)

**Future Versions**: JWT Bearer Token or API Key

### Response Format

All responses are JSON:

```json
{
    "success": true,
    "data": {...},
    "timestamp": "2026-03-19T12:00:00Z"
}
```

### Error Response

```json
{
    "success": false,
    "error": "Error message here",
    "code": "ERROR_CODE",
    "timestamp": "2026-03-19T12:00:00Z"
}
```

---

## Database Documentation

### Table: timer_rooms

Stores event rooms.

```sql
CREATE TABLE timer_rooms (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_created_at (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4;
```

**Columns**:

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Unique room identifier |
| name | VARCHAR(100) | Room/event name |
| created_at | TIMESTAMP | Creation time (UTC) |
| updated_at | TIMESTAMP | Last modification time (UTC) |

**Example Data**:
```
id: 1, name: "Tech Conference 2026", created_at: "2026-03-19 10:00:00"
id: 2, name: "Annual Meetup", created_at: "2026-03-19 14:30:00"
```

---

### Table: timer_items

Stores timers within each room.

```sql
CREATE TABLE timer_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id INT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    duration_seconds INT UNSIGNED NOT NULL,
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES timer_rooms(id) ON DELETE CASCADE,
    KEY idx_room_id (room_id),
    KEY idx_order (order_index)
) ENGINE=InnoDB CHARACTER SET utf8mb4;
```

**Columns**:

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Unique timer identifier |
| room_id | INT | Parent room ID |
| title | VARCHAR(100) | Timer name (e.g., "Keynote") |
| duration_seconds | INT | Duration in seconds (e.g., 2700 = 45:00) |
| order_index | INT | Sort order within room |
| created_at | TIMESTAMP | Creation time (UTC) |
| updated_at | TIMESTAMP | Last modification time (UTC) |

**Example Data**:
```
id: 1, room_id: 1, title: "Registration", duration_seconds: 1800, order_index: 0
id: 2, room_id: 1, title: "Keynote", duration_seconds: 2700, order_index: 1
id: 3, room_id: 1, title: "Break", duration_seconds: 900, order_index: 2
```

---

## JavaScript Modules

### Module Architecture

B1G Timer uses 13 modular JavaScript files with clear separation of concerns:

```
public/js/
├── Phase 4 Core Modules (9 files)
│   ├── api-client.js              - HTTP request wrapper
│   ├── timer-math.js              - Time calculations
│   ├── state-manager.js           - Application state
│   ├── pusher-manager.js          - WebSocket connection
│   ├── room-manager.js            - Room CRUD + UI
│   ├── timer-engine.js            - Timer countdown logic
│   ├── message-manager.js         - Message display queue
│   ├── control-dashboard.js       - Operator dashboard
│   └── stage-display.js           - Event display UI
└── Phase 5 Feature Modules (4 files)
    ├── sortable-handler.js        - Drag-to-reorder
    ├── validation-handler.js      - Input validation
    ├── phase-5-enhancements.js    - Feature integration
    └── stage-display-enhancements.js - Stage features
```

### Load Order

JavaScript files load in this order (see index.html and stage.html):

```html
<!-- CDN Libraries -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
<script src="https://js.pusher.com/7.0/pusher.min.js"></script>

<!-- Tailwind CSS -->
<link href="https://cdn.tailwindcss.com" rel="stylesheet">

<!-- Font Awesome Icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

<!-- Phase 4 Core Modules (load order matters!) -->
<script src="public/js/api-client.js"></script>
<script src="public/js/timer-math.js"></script>
<script src="public/js/state-manager.js"></script>
<script src="public/js/pusher-manager.js"></script>
<script src="public/js/message-manager.js"></script>
<script src="public/js/room-manager.js"></script>
<script src="public/js/timer-engine.js"></script>

<!-- Phase 5 Feature Modules -->
<script src="public/js/sortable-handler.js"></script>
<script src="public/js/validation-handler.js"></script>
<script src="public/js/phase-5-enhancements.js"></script>
<script src="public/js/control-dashboard.js"></script>
```

### Core Module Descriptions

#### 1. api-client.js (85 lines)

**Purpose**: Wrapper for HTTP requests to backend

**Key Functions**:
```javascript
APIClient.get(endpoint)              // GET request
APIClient.post(endpoint, data)       // POST request
APIClient.put(endpoint, data)        // PUT request
APIClient.delete(endpoint)           // DELETE request
APIClient.handleError(error)         // Error handler
APIClient.setBaseURL(url)            // Configure API URL
```

**Example Usage**:
```javascript
// Get all rooms
APIClient.get('/rooms').then(data => {
    console.log(data.rooms);
});

// Create new room
APIClient.post('/rooms', { name: 'My Event' }).then(room => {
    console.log('Room created:', room.id);
});
```

---

#### 2. timer-math.js (42 lines)

**Purpose**: Time calculations and formatting

**Key Functions**:
```javascript
TimerMath.secondsToDisplay(seconds)     // 120 → "02:00"
TimerMath.displayToSeconds(display)     // "02:00" → 120
TimerMath.formatTime(seconds, format)   // Format time strings
TimerMath.calculateProgress(elapsed, total) // 0-100 %
TimerMath.parseMMSS(input)              // "45:30" → 2730
```

**Example Usage**:
```javascript
// Convert seconds to display
TimerMath.secondsToDisplay(2730)  // Returns "45:30"

// Convert display to seconds
TimerMath.displayToSeconds("45:30")  // Returns 2730

// Calculate progress bar percentage
const progress = TimerMath.calculateProgress(30, 120);  // 25%
```

---

#### 3. state-manager.js (156 lines)

**Purpose**: Central application state management with Pusher sync

**Key Functions**:
```javascript
StateManager.setState(key, value)        // Update state
StateManager.getState(key)               // Read state
StateManager.subscribeToChanges(callback)  // Listen for changes
StateManager.broadcast(action)           // Send to Pusher
StateManager.handleRemoteUpdate(data)    // Receive from Pusher
```

**Global State Tracked**:
```javascript
{
    currentRoom: { id, name, timers: [] },
    currentTimer: { id, title, duration, elapsed },
    isPlaying: false,
    isBlackedOut: false,
    message: { text, color, isBold, fontSize },
    connectedDisplays: 2,
    isDirty: false
}
```

---

#### 4. pusher-manager.js (78 lines)

**Purpose**: WebSocket connection to Pusher Cloud

**Key Functions**:
```javascript
PusherManager.initialize(config)     // Initialize connection
PusherManager.subscribe(channel)     // Subscribe to channel
PusherManager.trigger(event, data)   // Send event
PusherManager.on(event, callback)    // Listen for event
PusherManager.disconnect()           // Close connection
```

**Events Handled**:
```javascript
TIMER_STARTED, TIMER_PAUSED, TIMER_STOPPED,
TIME_ADJUSTED, TIMER_COMPLETED,
MESSAGE_SHOWN, MESSAGE_HIDDEN,
BLACKOUT_ON, BLACKOUT_OFF, FLASH_TRIGGER,
TIMERS_REORDERED, ROOM_UPDATED,
DISPLAY_CONNECTED, DISPLAY_DISCONNECTED
```

---

#### 5. room-manager.js (92 lines)

**Purpose**: Room CRUD operations and UI management

**Key Functions**:
```javascript
RoomManager.createRoom(name)         // Create new room
RoomManager.loadRoom(id)             // Load room + timers
RoomManager.saveRoom()               // Save current room
RoomManager.deleteRoom(id)           // Delete room
RoomManager.renderRoomSelector()     // Update dropdown UI
RoomManager.renderTimerList()        // Render timers in UI
RoomManager.addTimer(title, duration)  // Add timer to room
RoomManager.deleteTimer(timerId)     // Delete timer
```

---

#### 6. timer-engine.js (87 lines)

**Purpose**: Timer countdown logic

**Key Functions**:
```javascript
TimerEngine.start(duration)          // Start countdown
TimerEngine.pause()                  // Pause timer
TimerEngine.resume()                 // Resume timer
TimerEngine.stop()                   // Stop timer
TimerEngine.adjustTime(seconds)      // Add/subtract time
TimerEngine.onTick(callback)         // Subscribe to tick
TimerEngine.isRunning()              // Check if running
```

---

#### 7. message-manager.js (64 lines)

**Purpose**: Message display and queue management

**Key Functions**:
```javascript
MessageManager.showMessage(text, options)  // Display message
MessageManager.hideMessage()               // Hide message
MessageManager.queueMessage(msg)           // Add to history
MessageManager.getQueue()                  // Get message history
MessageManager.renderQueue()               // Update queue UI
```

**Options**:
```javascript
{
    color: '#FF0000',      // Red
    isBold: true,          // Bold text
    fontSize: 48,          // 48px
    duration: 5000         // Auto-hide after 5s (0 = manual)
}
```

---

#### 8. control-dashboard.js (423 lines)

**Purpose**: Operator dashboard UI and controls

**Key Components**:
- Room selector dropdown
- Timer list with add/delete/reorder
- Play/Pause/Next buttons
- Time adjustment (-1m, +1m)
- Message input with formatting
- Blackout/Flash buttons
- Live preview window
- Connection status display

**Initialization**:
```javascript
window.addEventListener('DOMContentLoaded', () => {
    ControlDashboard.init();
});
```

---

#### 9. stage-display.js (187 lines)

**Purpose**: Event display screen rendering

**Key Components**:
- Large countdown timer
- Progress bar
- Time-of-day display
- Message ribbon
- Connection indicator
- Blackout overlay
- Flash animation

---

#### 10-13. Phase 5 Modules

See [PHASE_5_IMPLEMENTATION.md](PHASE_5_IMPLEMENTATION.md) for details on:
- **sortable-handler.js**: Drag-to-reorder with keyboard support
- **validation-handler.js**: Input validation with live feedback
- **phase-5-enhancements.js**: Feature orchestration
- **stage-display-enhancements.js**: Stage-specific features

---

## Configuration

### Environment Variables (.env.production)

```env
# Database
DB_HOST=localhost              # Database server
DB_PORT=3306                   # MySQL port (default 3306)
DB_NAME=b1g_timer              # Database name
DB_USER=b1g_user               # Database user
DB_PASSWORD=strong_pass        # Database password

# Pusher Configuration
PUSHER_APP_ID=1234567          # Your Pusher app ID
PUSHER_KEY=your_key            # Your Pusher key
PUSHER_SECRET=your_secret      # Your Pusher secret
PUSHER_CLUSTER=mt1             # Cluster (mt1, us2, eu, ap1, ap4, etc.)

# Application
APP_URL=https://yourdomain.com # Application URL
APP_ENV=production             # Environment (development/production)
LOG_LEVEL=ERROR                # Log level (DEBUG, INFO, WARNING, ERROR)

# Timezone
DISPLAY_TIMEZONE=Asia/Manila   # Venue timezone for display
```

### Pusher Configuration

1. Sign up at https://pusher.com
2. Create new Channels App
3. Copy credentials:
   - App ID
   - Key
   - Secret
   - Note preferred cluster
4. Add to `.env.production`

### Apache .htaccess

Located in `/public/.htaccess`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Skip rewriting for existing files or directories
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]
    
    # Route all requests to index.php
    RewriteRule ^(.*)$ index.php?$1 [QSA,L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Cache control
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/html "access plus 1 hour"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType text/css "access plus 1 month"
</IfModule>
```

---

## Troubleshooting

### Connection Issues

**Problem**: "Disconnected" indicator, messages not syncing

**Solutions**:
1. Check internet connection
2. Verify Pusher credentials in .env
3. Check if HTTPS certificate is valid
4. Reload page (F5)
5. Check browser console for errors:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for red error messages

**If Still Not Working**:
```bash
# Test Pusher connection
curl -X POST https://api.pusher.com/apps/[APP_ID]/events \
  -u [KEY]:[SECRET] \
  -H "Content-Type: application/json" \
  -d '{"name":"test","channels":["test"],"data":{}}'
```

---

### Database Issues

**Problem**: "Database connection failed" error

**Solutions**:
1. Verify database server is running:
   ```bash
   mysql -u b1g_user -p -e "SELECT VERSION();"
   ```

2. Check credentials in .env.production:
   ```bash
   mysql -u b1g_user -p -h localhost b1g_timer
   ```

3. Verify database permissions:
   ```sql
   SHOW GRANTS FOR 'b1g_user'@'localhost';
   ```

4. Restart MySQL:
   ```bash
   sudo systemctl restart mysql
   ```

5. Check PHP PDO extension:
   ```bash
   php -m | grep pdo
   ```

---

### Performance Issues

**Problem**: Slow countdown updates, laggy UI

**Solutions**:
1. Check server load:
   ```bash
   top
   uptime
   ```

2. Check network latency:
   ```bash
   ping yourdomain.com
   ```

3. Reduce number of open Stage Displays
4. Close other applications on Control Dashboard
5. Check browser console for JavaScript errors
6. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)

---

### Timer Not Counting Down

**Problem**: Start button clicked but timer doesn't count

**Solutions**:
1. Check connection indicator (should be green)
2. Verify all Stage Display windows are open
3. Refresh page (F5)
4. Check browser console for errors
5. Verify timer duration > 0 seconds
6. Check system time is correct

**Debug**:
```javascript
// In browser console
console.log(StateManager.getState('currentTimer'));
console.log(StateManager.getState('isPlaying'));
```

---

### Message Not Appearing

**Problem**: Typed message but doesn't appear on displays

**Solutions**:
1. Check connection indicator
2. Verify "Show" button was clicked (not just Enter)
3. Ensure Stage Display tabs are active (not minimized)
4. Check if display counter shows > 0
5. Try hiding then showing again
6. Refresh Stage Display (F5)

---

## Maintenance

### Daily Checks

```bash
# Check system status
systemctl status apache2 mysql

# Check error logs
tail -f /var/log/apache2/error.log
tail -f /var/log/mysql/error.log

# Monitor disk space
df -h

# Check CPU/Memory
top
```

### Weekly Tasks

```bash
# Backup database
mysqldump -u root -p b1g_timer > b1g_timer_backup_$(date +%Y%m%d).sql

# Review logs for errors
grep -i error /var/log/apache2/error.log | tail -20

# Check SSL certificate expiration
openssl x509 -enddate -noout -in /etc/ssl/certs/yourdomain.pem

# Optimize database
mysql -u root -p b1g_timer << EOF
ANALYZE TABLE timer_rooms;
ANALYZE TABLE timer_items;
OPTIMIZE TABLE timer_rooms;
OPTIMIZE TABLE timer_items;
EOF
```

### Monthly Tasks

```bash
# Full database backup
mysqldump -u root -p --all-databases > full_backup_$(date +%Y%m%d).sql

# Update dependencies (if using composer)
composer update --no-dev

# Review and rotate logs
logrotate -f /etc/logrotate.d/apache2

# Performance analysis
# Check page load times, API response times
# Review error logs for patterns
```

### Security Updates

```bash
# Update system packages
sudo apt update
sudo apt upgrade

# Update PHP security packages
sudo apt install php8.0-{dev,curl,mysql,gd}

# Restart services
sudo systemctl restart apache2 php8.0-fpm
```

---

## Support & Escalation

### Getting Help

1. **Check Documentation**: Start with this guide
2. **Review Error Logs**: Check `/var/log/apache2/error.log`
3. **Test Connection**: Use `curl` to test API endpoints
4. **Browser Console**: Press F12, check for errors
5. **Contact Support**: See contact info below

### Emergency Troubleshooting

**System Down**:
```bash
# 1. Check what's running
pgrep apache2      # Should return PID
pgrep mysql        # Should return PID

# 2. Restart services
sudo systemctl restart apache2
sudo systemctl restart mysql

# 3. Check status
sudo systemctl status apache2
sudo systemctl status mysql

# 4. Check logs
tail -50 /var/log/apache2/error.log
```

**If Still Down**:
1. Check disk space: `df -h`
2. Check inode usage: `df -i`
3. Check if iptables is blocking ports:
   ```bash
   sudo ufw status
   ```
4. Test connectivity:
   ```bash
   curl -v https://yourdomain.com/api/health
   ```

---

## Additional Resources

- **Pusher Documentation**: https://pusher.com/docs
- **PHP Documentation**: https://www.php.net/docs.php
- **MySQL Documentation**: https://dev.mysql.com/doc/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **MDN Web Docs**: https://developer.mozilla.org

---

**Document Version**: 1.0  
**Last Updated**: March 19, 2026  
**Status**: Production Ready  

For questions or issues, refer to DEPLOYMENT_CHECKLIST.md or contact technical support.


# B1G Timer - Developer Guide & Architecture

**Version**: 1.0 MVP  
**Target Audience**: Developer contributing to B1G Timer  
**Updated**: March 19, 2026  

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [Development Setup](#development-setup)
4. [Adding Features](#adding-features)
5. [Code Organization](#code-organization)
6. [Testing Guidelines](#testing-guidelines)
7. [Deployment](#deployment)
8. [Debugging Tips](#debugging-tips)

---

## Getting Started

### Prerequisites

- PHP 8.0+
- MySQL 5.7+
- Git
- Node.js 14+ (optional, for build tools in future)
- VS Code (recommended)

### Clone Repository

```bash
git clone https://github.com/yourusername/b1g-timer.git
cd b1g-timer
```

### Install Development Environment

```bash
# Copy environment file
cp config/.env.example config/.env.development

# Edit for development
nano config/.env.development

# Create database
mysql -u root -p < schema/001-initial-schema.sql

# Start PHP development server
php -S localhost:8000 -t public

# Application available at: http://localhost:8000
```

---

## Project Structure

```
b1g-timer/
├── backend/
│   ├── api/
│   │   ├── health.php          # Health check endpoint
│   │   ├── rooms.php           # Room CRUD endpoints
│   │   └── broadcast.php       # Message/action broadcast
│   ├── config/
│   │   ├── database.php        # PDO config
│   │   ├── pusher.php          # Pusher config
│   │   ├── .env.example        # Environment template
│   │   └── .env.production     # Production config (not in git)
│   └── middleware/
│       ├── cors.php            # CORS headers
│       └── error-handler.php   # Error handling
├── public/
│   ├── index.html              # Control Dashboard
│   ├── stage.html              # Stage Display
│   ├── css/
│   │   └── tailwind.config.js  # CSS config
│   └── js/
│       ├── api-client.js       # HTTP wrapper (Phase 4)
│       ├── timer-math.js       # Time utilities (Phase 4)
│       ├── state-manager.js    # State management (Phase 4)
│       ├── pusher-manager.js   # WebSocket client (Phase 4)
│       ├── room-manager.js     # Room UI (Phase 4)
│       ├── timer-engine.js     # Countdown logic (Phase 4)
│       ├── message-manager.js  # Message UI (Phase 4)
│       ├── control-dashboard.js # Operator UI (Phase 4)
│       ├── stage-display.js    # Display UI (Phase 4)
│       ├── sortable-handler.js # Drag-drop (Phase 5)
│       ├── validation-handler.js # Input validation (Phase 5)
│       ├── phase-5-enhancements.js # Features (Phase 5)
│       └── stage-display-enhancements.js # Stage features (Phase 5)
├── schema/
│   └── 001-initial-schema.sql  # Database schema
├── .htaccess                    # Apache routing
├── index.php                    # API router
├── Documentation/
│   ├── SYSTEM_DOCUMENTATION.md
│   ├── API_REFERENCE_COMPLETE.md
│   ├── PROJECT_COMPLETION_REPORT.md
│   └── ... (other guides)
└── README.md
```

---

## Development Setup

### Local Development Server

```bash
# Start PHP development server
cd b1g-timer
php -S localhost:8000 -t public

# In another terminal, watch for file changes
# (Use your editor's live reload feature)
```

### Database Setup

```bash
# Create database
mysql -u root -p
mysql> CREATE DATABASE b1g_timer_dev CHARACTER SET utf8mb4;
mysql> CREATE USER 'b1g_dev'@'localhost' IDENTIFIED BY 'dev_password';
mysql> GRANT ALL ON b1g_timer_dev.* TO 'b1g_dev'@'localhost';
mysql> FLUSH PRIVILEGES;
mysql> EXIT;

# Run schema
mysql -u b1g_dev -p b1g_timer_dev < schema/001-initial-schema.sql

# Verify
mysql -u b1g_dev -p b1g_timer_dev
mysql> SHOW TABLES;
```

### Configure Development Environment

```env
# config/.env.development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=b1g_timer_dev
DB_USER=b1g_dev
DB_PASSWORD=dev_password

PUSHER_APP_ID=your_dev_app_id
PUSHER_KEY=your_dev_key
PUSHER_SECRET=your_dev_secret
PUSHER_CLUSTER=mt1

APP_URL=http://localhost:8000
APP_ENV=development
LOG_LEVEL=DEBUG
DISPLAY_TIMEZONE=Asia/Manila
```

### Test the Setup

```bash
# Test health endpoint
curl http://localhost:8000/api/v1/health

# Expected response:
{
    "success": true,
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-03-19T12:00:00Z"
}
```

---

## Adding Features

### Example: Add "Quick Timer" Feature

#### Step 1: Create Backend Endpoint

**File**: `backend/api/quick-timers.php`

```php
<?php
// Get 10 most common timer durations

require_once 'middleware/cors.php';

$pdo = new PDO(getenv('DB_DSN'), getenv('DB_USER'), getenv('DB_PASSWORD'));

try {
    $query = "
        SELECT duration_seconds, COUNT(*) as usage_count
        FROM timer_items
        GROUP BY duration_seconds
        ORDER BY usage_count DESC
        LIMIT 10
    ";
    
    $stmt = $pdo->query($query);
    $quickTimers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    response([
        'success' => true,
        'data' => ['quick_timers' => $quickTimers]
    ]);
    
} catch (PDOException $e) {
    response([
        'success' => false,
        'error' => 'Database error',
        'code' => 'DATABASE_ERROR'
    ], 500);
}
?>
```

#### Step 2: Update Router

**File**: `index.php`

```php
// Add this route:
case 'quick-timers':
    require 'backend/api/quick-timers.php';
    break;
```

#### Step 3: Add Frontend UI Component

**File**: `public/js/quick-timers.js`

```javascript
const QuickTimers = (() => {
    
    const init = () => {
        loadQuickTimers();
        setupEventListeners();
    };
    
    const loadQuickTimers = async () => {
        try {
            const response = await APIClient.get('/quick-timers');
            renderQuickTimers(response.data.quick_timers);
        } catch (err) {
            console.error('Failed to load quick timers:', err);
        }
    };
    
    const renderQuickTimers = (timers) => {
        const container = document.getElementById('quick-timers-container');
        
        const html = timers.map(timer => `
            <button 
                class="quick-timer-btn" 
                data-duration="${timer.duration_seconds}"
            >
                ${TimerMath.secondsToDisplay(timer.duration_seconds)}
                <span class="usage">(${timer.usage_count}x)</span>
            </button>
        `).join('');
        
        container.innerHTML = html;
    };
    
    const setupEventListeners = () => {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-timer-btn')) {
                const duration = parseInt(e.target.dataset.duration);
                addQuickTimer(duration);
            }
        });
    };
    
    const addQuickTimer = (duration) => {
        RoomManager.addTimer('Quick Timer', duration);
    };
    
    return { init };
})();

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    QuickTimers.init();
});
```

#### Step 4: Add HTML UI

**File**: `public/index.html`

```html
<!-- Add in Control Dashboard section -->
<section id="quick-timers-container" class="quick-timers">
    <!-- Populated by JavaScript -->
</section>

<!-- Include new module -->
<script src="public/js/quick-timers.js"></script>
```

#### Step 5: Test the Feature

1. Open http://localhost:8000/index.html
2. Create room with several timers
3. Note which durations you use
4. See "Quick Timers" buttons based on usage
5. Click button to add timer with that duration

---

## Code Organization

### Module Pattern

All JavaScript modules follow the IIFE (Immediately Invoked Function Expression) pattern:

```javascript
const MyModule = (() => {
    
    // Private variables
    let privateVar = 0;
    
    // Private functions
    const privateFunction = () => {
        console.log('Private function');
    };
    
    // Public methods
    const publicMethod = () => {
        privateFunction();
    };
    
    // Initialization
    const init = () => {
        // Setup on page load
    };
    
    // Return public API
    return {
        init,
        publicMethod
    };
})();

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    MyModule.init();
});
```

### Naming Conventions

**Files**:
- Lowercase with hyphens: `my-module.js`
- One module per file
- Descriptive names

**Functions**:
- camelCase: `getTimerById()`
- Prefix private with underscore: `_privateFunction()`
- Action verbs: `create`, `update`, `delete`, `render`, `load`

**Variables**:
- camelCase: `currentRoom`, `isPlaying`
- Boolean prefix with `is` or `has`: `isConnected`, `hasError`
- Constants: UPPERCASE: `MAX_MESSAGE_LENGTH`

**CSS Classes**:
- Kebab-case: `.timer-item`, `.control-dashboard`
- Prefix with component: `.message-input`, `.room-selector`
- Modifiers: `.is-active`, `.is-disabled`

### Error Handling

```javascript
try {
    const response = await APIClient.post('/rooms', { name: 'Test' });
    // Success path
    room = response.data;
} catch (error) {
    // Error path
    console.error('Failed to create room:', error.message);
    showErrorMessage('Could not create room. Please try again.');
    
    // Log to server (future)
    // ErrorLogger.log(error);
}
```

---

## Testing Guidelines

### Unit Tests (Manual)

```javascript
// In browser console:

// Test TimerMath
TimerMath.secondsToDisplay(2730)  // Should return "45:30"
TimerMath.displayToSeconds("45:30")  // Should return 2730

// Test StateManager
StateManager.setState('currentRoom', { id: 1, name: 'Test' });
StateManager.getState('currentRoom')  // Should return the room
```

### Integration Tests

```bash
# Test complete workflow
1. Create room via API
2. Add timers via API
3. Open Control Dashboard
4. Open Stage Display
5. Start timer
6. Verify sync on Stage Display
7. Send message
8. Verify message appears
9. Test blackout/flash
10. Stop and verify cleanup
```

### Browser DevTools Testing

```javascript
// Open Console (F12)

// Test API
fetch('http://localhost:8000/api/v1/health')
    .then(r => r.json())
    .then(d => console.log(d));

// Test State
console.log(StateManager.getState('currentRoom'));

// Test Timer Math
console.log(TimerMath.secondsToDisplay(3661));  // "01:01:01"

// Monitor Events
StateManager.subscribeToChanges(state => {
    console.log('State changed:', state);
});
```

### Performance Testing

```bash
# Open DevTools → Performance tab
1. Click Record
2. Perform action (e.g., start timer)
3. Wait 3 seconds
4. Click Stop
5. Review timeline

# Acceptable metrics:
- Page load: <2s
- Timer update: <100ms
- Message send: <200ms
```

---

## Deployment

### Pre-Deployment Checklist

```bash
# 1. Run tests
npm run test  # (if tests configured)

#  2. Check for console errors
# Open browser console (F12)
# Should show 0 errors (warnings OK)

# 3. Verify all features
# Follow test checklist in PHASE_6_TEST_PLAN.md

# 4. Update version
# Edit VERSION file (if exists)
git tag -a v1.0.1 -m "Release version 1.0.1"

# 5. Commit changes
git add .
git commit -m "Prepared for deployment v1.0.1"
git push origin main

# 6. Create production branch
git checkout -b production
git push origin production
```

### Deploy to Production

```bash
# 1. SSH into production server
ssh deploy@yourdomain.com

# 2. Navigate to web root
cd /var/www/b1g-timer

# 3. Pull latest code
git fetch origin
git checkout production
git pull origin production

# 4. Copy production environment
cp config/.env.production config/.env

# 5. Install dependencies (if any)
composer install --no-dev  # if using Composer

# 6. Run database migrations
php migrate.php  # if migration script exists

# 7. Clear caches
php -r "if (file_exists('cache')) { array_map('unlink', glob('cache/*')); }"

# 8. Set permissions
sudo chown -R www-data:www-data .
sudo chmod -R 755 .

# 9. Restart web server
sudo systemctl restart apache2

# 10. Verify deployment
curl https://yourdomain.com/api/v1/health
```

---

## Debugging Tips

### Enable Debug Mode

In `config/.env.development`:
```env
APP_ENV=development
LOG_LEVEL=DEBUG
```

### Check Server Logs

```bash
# PHP errors
tail -f /var/log/apache2/error.log
tail -f /var/log/php-fpm.log

# MySQL errors
tail -f /var/log/mysql/error.log
```

### Browser Console Debugging

```javascript
// Check API connection
fetch('http://localhost:8000/api/v1/health').then(r => r.json()).then(console.log);

// Check Pusher connection
console.log(PusherManager);  // Should show Pusher instance

// Monitor state changes
StateManager.subscribeToChanges(state => console.table(state));

// Check module loading
console.log(window.APIClient);      // Should exist
console.log(window.StateManager);   // Should exist
console.log(window.TimerEngine);    // Should exist
```

### Common Issues

**Problem**: Module not defined
```javascript
// Check if loaded in correct order
// APIClient must load before StateManager
// StateManager must load before others
```

**Problem**: Pusher not connecting
```javascript
// Check credentials
console.log(window.PusherManager.config);

// Test connection
PusherManager.subscribe('test').bind('test-event', (data) => console.log(data));
```

**Problem**: Timer not counting
```javascript
// Check if playing
console.log(StateManager.getState('isPlaying'));

// Check timer status
console.log(StateManager.getState('currentTimer'));

// Check Pusher events
console.log('Recent events:', window.PusherManager.eventLog);
```

### Enable Detailed Logging

```javascript
// Add logging to modules
const DebugLogger = (() => {
    const logs = [];
    
    const log = (message, data = null) => {
        const entry = {
            timestamp: new Date().toISOString(),
            message,
            data
        };
        logs.push(entry);
        console.log(`[${entry.timestamp}] ${message}`, data);
    };
    
    const getLogs = () => logs;
    const clearLogs = () => logs.length = 0;
    
    return { log, getLogs, clearLogs };
})();

// Use in modules
DebugLogger.log('Timer started', { duration: 2700 });
```

---

## Contributing Guidelines

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# Edit files, test locally

# 3. Commit changes
git add .
git commit -m "Add my feature

- Description of what was added
- Any breaking changes
- Related issue #123"

# 4. Push branch
git push origin feature/my-feature

# 5. Create Pull Request
# Go to GitHub, create PR from feature branch to main
# Describe changes, link issues

# 6. Code review
# Wait for approval

# 7. Merge
# After approval, merge via GitHub UI

# 8. Cleanup
git checkout main
git pull origin main
git branch -d feature/my-feature
git push origin --delete feature/my-feature
```

### Commit Message Format

```
type(scope): subject

description

- bullet point 1
- bullet point 2

fixes #123
relates to #456
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style
- `refactor`: Code refactor
- `perf`: Performance
- `test`: Tests
- `chore`: Maintenance

---

## Resources

- **PHP**: https://www.php.net/manual/en/
- **MySQL**: https://dev.mysql.com/doc/
- **JavaScript**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/
- **Pusher**: https://pusher.com/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Git**: https://git-scm.com/doc

---

**Developer Guide Version**: 1.0  
**Last Updated**: March 19, 2026


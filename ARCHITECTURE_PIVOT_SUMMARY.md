# Architecture Pivot Summary: BroadcastChannel → Pusher

**Date**: 2026-03-19  
**Trigger**: InfinityFree hosting + mobile phone control requirement  
**Impact**: Complete real-time communication layer rewrite  

---

## Problem Statement

**Original Design**:
- Used Browser BroadcastChannel API for multi-tab sync
- **Limitation**: Same-origin only, no internet communication
- **Incompatibility**: Cannot control Stage Display from mobile phone over internet
- **Hosting Constraint**: InfinityFree doesn't support native WebSocket servers

**New Requirement**:
- Control Dashboard on desktop + Stage Display on projector
- **AND** Control Dashboard can be driven from mobile phone (remote control)
- **AND** All over the internet (not same office network)
- **Hosting**: Must work on InfinityFree (PHP-only, no WebSocket servers)

---

## Solution: Pusher Real-Time Messaging

**Architecture**:
```
Mobile Phone (Control Dashboard)  ──┐
                                      ├─→ PUSHER CLOUD ─→ Stage Display (Projector)
Desktop (Control Dashboard)        ──┘                     
                                                      └─ Broadcasting to Room Channel
```

**Key Differences**:

| Aspect | BroadcastChannel | Pusher |
|--------|------------------|--------|
| **Transport** | Browser API (local) | Cloud (HTTP/HTTPS) |
| **Range** | Same origin only | Internet-accessible |
| **Setup** | Native browser feature | Cloud service (free tier: 100 connections) |
| **Mobile Support** | No (browser tabs only) | Yes (any device with pusher-js) |
| **Cost** | Free (browser-native) | Free tier (100 concurrent) → Pay as grow |
| **Latency** | <50ms (local) | ~100ms (over internet) |
| **Presence Tracking** | Manual (DISPLAY_CONNECTED) | Built-in (channel members) |

---

## Implementation Scope

### Files Updated (Task 1.1 Refinement)

1. **`.env.example`** – Added Pusher credentials template
2. **`.env`** – Added Pusher credentials fields
3. **`config/constants.php`** – Replaced BroadcastChannel section with Pusher configuration
   - Removed `BROADCAST_PROTOCOL_VERSION`
   - Added `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`, `PUSHER_ENCRYPTED`
   - Added `PUSHER_CHANNEL_PREFIX = 'presence-room-'`
   - Kept all 15 action type constants (same action names, different transport)

### Roadmap Tasks Updated

| Task | Old | New | Impact |
|------|-----|-----|--------|
| **1.1** | Config (partial) | Config + Pusher creds | Environment now includes Pusher setup |
| **2.6** | NEW (was 2.7+) | Pusher Broadcaster | New backend endpoint for event broadcasting |
| **2.7** | Health Check | Health Check (modified) | Now tests Pusher connection too |
| **2.8** | Router | Router (renumbered) | Still needed, now 2.8 |
| **2.9** | .htaccess | .htaccess (renumbered) | Still needed, now 2.9 |
| **4.1** | BroadcastChannel Wrapper | Pusher SDK Setup | Completely new implementation |
| **4.5** | Stage Display (BC) | Stage Display (Pusher) | Listens on Pusher, not BroadcastChannel |
| **4.6** | Multi-Tab Sync | Multi-Device Sync | Now supports mobile + desktop + displays |
| **4.8** | Error Handling (BC) | Error Handling (Pusher) | Handles Pusher reconnection + queue |

### Action Types Preserved
All 15 action constants remain **unchanged**:
- `ACTION_TIMER_START`, `ACTION_TIMER_PAUSE`, `ACTION_TIMER_RESTART`, `ACTION_TIMER_ADJUST`
- `ACTION_NEXT_TIMER`, `ACTION_BLACKOUT_ON`, `ACTION_BLACKOUT_OFF`, `ACTION_FLASH_SCREEN`
- `ACTION_SHOW_MESSAGE`, `ACTION_HIDE_MESSAGE`, `ACTION_SYNC_REQUEST`, `ACTION_SYNC_RESPONSE`
- `ACTION_DISPLAY_CONNECTED`, `ACTION_DISPLAY_DISCONNECTED`, `ACTION_TIMERS_REORDERED`

**Why**: Logic stays identical; only transport layer changes. This minimizes refactoring risk.

---

## Channel Architecture (Pusher)

### Channel Naming Convention
```
presence-room-{roomId}
```

**Example**: For room ID 42
```
presence-room-42
```

**Type**: Presence Channel (tracks who's connected)

### Message Flow
```
Control Dashboard (Desktop)
  ↓ (calls broadcast endpoint)
POST /api/v1/broadcast
  { roomId: 42, action: "TIMER_START", ... }
  ↓
PHP Backend (Pusher SDK)
  ↓ (publishes to channel)
Pusher Cloud
  ↓ (delivers to all subscribers)
┌─ Stage Display (Projector)
├─ Control Dashboard (Desktop) – receives echo
└─ Mobile Phone (Remote) – optional backup control
```

### Multi-Device Presence
Pusher presence channel auto-tracks:
- Which devices are connected to `presence-room-42`
- Member count (UI shows "X displays connected")
- Member joined/left events

**Example Use Case**:
1. Desktop Control Dashboard connected
2. Mobile phone joins same channel
3. Both can send commands
4. Stage Display receives all commands (last one wins)
5. Mobile phone leaves
6. Desktop continues controlling

---

## Testing Requirements for Task 1.3+

### Before Implementation (Prerequisites)
- ✅ `.env` file with Pusher credentials (from sign-up: https://pusher.com)
- ✅ `database/schema.sql` imported (Task 1.2)
- ✅ MySQL tables created (`timer_rooms`, `timer_items`)

### Task 1.3 Integration
File: `api/config/db.php`
- Provides PDO singleton for all Phase 2 API endpoints
- Loads from `config/database.php` (environment config)
- Uses `config/constants.php` for validation rules + Pusher constants

### Task 2.6 Integration (NEW)
File: `api/v1/broadcast.php` + `config/pusher.php`
- Creates `/api/v1/broadcast` endpoint
- Initializes Pusher PHP SDK
- Publishes events from Control Dashboard to presence channel
- Stages Display and other devices receive broadcasts

### Phase 4 Integration (Frontend)
Files: `public/js/pusher-client.js`, `public/js/app.js`, `public/js/stage.js`
- Include pusher-js CDN script
- Subscribe to presence channels
- Listen for action events
- Call broadcast endpoint for updates

---

## Pusher Free Tier Details

**Sign-up**: https://pusher.com (free account)

**Limits**:
- 100 concurrent connections per app instance
- Sufficient for MVP (1 Control Dashboard + 1–3 Stage Displays + 1 mobile phone)
- Automatic publishing from backend
- Presence tracking included

**Pricing**:
- Free: ≤100 connections
- Paid: Scale beyond 100 (cost increases with concurrent connections)

**For MVP**: Free tier is all we need. Upgrade later if user base grows.

---

## Risk Mitigation

### Risk 1: Pusher Service Downtime
**Mitigation**:
- Implement local action queueing (Task 4.8)
- Fallback to polling health endpoint
- Show "Offline mode" UI to operator
- Auto-sync when Pusher reconnects

### Risk 2: Internet Latency (100ms vs <50ms)
**Impact**: Stage Display updates ~100ms slower than same-origin
**Mitigation**:
- Target is <100ms anyway (already specified)
- Absolute time sync (derived from server timestamp) eliminates drift
- ±50ms timer accuracy still achievable with proper math

### Risk 3: Mobile Phone Network Drops
**Mitigation**:
- Automatic Pusher SDK reconnection (built-in)
- Queue actions while offline
- Sync queued actions on reconnection

### Risk 4: Too Many Devices Connected
**Mitigation**:
- Pusher free tier: 100 concurrent connections
- MVP target: ~5 devices per room
- Scales to 20+ rooms before hitting limit

---

## Phase 2 Backend Tasks: Adjusted Timeline

| Task | Old Depends | New Depends | Impact |
|------|-------------|------------|--------|
| 2.1–2.5 | 1.3–1.5 | 1.3–1.5 | Still same |
| **2.6 (NEW)** | – | 1.1 | **NEW: Pusher broadcaster** |
| 2.7 | 1.3–1.5 | 1.3–1.5, 2.6 | Health check tests Pusher |
| 2.8–2.9 | 2.1–2.6 | 2.1–2.7 | Renumbered, no change |

**Timeline Impact**: +1–2 hours for Task 2.6 (Pusher SDK setup) = acceptable

---

## Verification Checklist

### Phase 1 (Database) - Already Complete ✅
- [x] Task 1.1: Configuration + Pusher credentials
- [x] Task 1.2: MySQL schema
- [x] Task 1.3: PDO connection (JUST GENERATED)

### Phase 2 Key Milestones
- [ ] Task 1.4: Input validation
- [ ] Task 1.5: Error response handler
- [ ] **Task 2.1–2.5**: REST CRUD endpoints
- [ ] **Task 2.6**: Pusher broadcaster (NEW, critical for realtime)
- [ ] Task 2.7–2.9: Router, health check, .htaccess

### Phase 3–4 Frontend
- [ ] Task 3.1–3.6: HTML/Tailwind UI
- [ ] **Task 4.1**: Pusher SDK integration (NEW, critical for mobile)
- [ ] Task 4.2–4.8: JavaScript logic (adapted for Pusher)

---

## Next Immediate Steps

1. **Task 1.4**: Input Validation Utility (`api/middleware/validate.php`)
2. **Task 1.5**: Error Response Handler (`api/utils/error-handler.php`)
3. **Task 2.1–2.5**: CRUD endpoints (unchanged, just use `db.php`)
4. **Task 2.6**: Pusher Broadcaster (`api/v1/broadcast.php` + `config/pusher.php`)
   - This is the critical blocker for Phase 4 frontend
5. **Phase 4 Frontend**: Rewrite real-time logic for Pusher

---

## Code Status

**Task 1.3 Generated** ✅
- File: `api/config/db.php`
- Functions: 
  - `getPDOInstance()` – Singleton connection
  - `executePreparedStatement()` – Safe query wrapper
  - Helpers: `getAllRooms()`, `getRoomById()`, `getRoomTimers()`, `createRoom()`, `createTimer()`
- Documentation: `TASK_1_3_IMPLEMENTATION.md` (full guide + testing procedures)

**Ready for**: Phase 2 API endpoints (Task 2.1–2.9)

---

## Acknowledgement

**Architecture Pivot**: BroadcastChannel → Pusher  
**Reason**: Support mobile phone control over internet  
**Host**: InfinityFree (PHP-only, no WebSocket servers)  
**Date Approved**: 2026-03-19  
**Status**: ✅ Acknowledged, Roadmap Updated, Task 1.3 Generated  

**Roadmap Impact**: +1 task (2.6 Pusher Broadcaster), 4 tasks refactored (4.1, 4.5, 4.6, 4.8)  
**Timeline**: +1–2 days for Pusher integration  
**Remaining MVP Scope**: Unchanged (same 15 actions, same 31 tasks total)  

---


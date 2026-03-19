/**
 * B1G Timer - Stage Display Application
 * Receives real-time timer/event updates and displays on projection screen
 * 
 * Phase 4 Task: 4.5 (Stage Display Real-Time Updates)
 */

const StageDisplay = {
    currentRoomId: null,
    displayId: null,
    updateInterval: null,
    startTime: null,
    broadcastChannel: null,
    stageStyle: {
        timerColor: '#ffffff',
        clockColor: 'rgba(255,255,255,.5)'
    },
    
    /**
     * Initialize Stage Display
     */
    async init(roomId) {
        console.log('[StageDisplay] Initializing for room', roomId);
        
        try {
            // Generate display ID for tracking
            this.displayId = localStorage.getItem('displayId') || 
                           ('stage-' + Math.random().toString(36).substr(2, 9));
            localStorage.setItem('displayId', this.displayId);
            
            this.currentRoomId = roomId;
            
            // Fetch and display room name
            try {
                const room = await APIClient.getRoom(roomId);
                if (room && room.name) {
                    const roomNameEl = document.getElementById('room-name');
                    if (roomNameEl) roomNameEl.textContent = room.name;
                }
            } catch (e) {
                console.warn('[StageDisplay] Could not fetch room name:', e.message);
            }

            // Start time display immediately (regardless of Pusher)
            this.startTimeDisplay();
            
            // Setup BroadcastChannel fallback (works on same browser/machine without Pusher)
            this.setupBroadcastChannel(roomId);
            
            // Initialize Pusher
            let pusherReady = false;
            try {
                pusherReady = await PusherManager.initialize();
            } catch (e) {
                console.warn('[StageDisplay] Pusher init error (non-fatal):', e.message);
            }
            
            if (!pusherReady) {
                console.warn('[StageDisplay] Pusher not available - using local BroadcastChannel fallback');
                this.showWaiting();
                return;
            }
            
            // Subscribe to room events
            PusherManager.subscribeToRoom(roomId, (action, data) => {
                this.handleRoomEvent(action, data);
            });
            
            // Mark connected
            const statusEl = document.getElementById('connection-status');
            if (statusEl) statusEl.classList.add('connected');
            
            // Request sync from dashboard after subscribing
            this.requestSync(roomId);
            
            console.log('[StageDisplay] Ready (Display ID: ' + this.displayId + ')');
        } catch (error) {
            console.error('[StageDisplay] Initialization error:', error);
            this.showWaiting();
        }
    },
    
    /**
     * Setup BroadcastChannel for same-machine communication (no Pusher needed)
     */
    setupBroadcastChannel(roomId) {
        try {
            this.broadcastChannel = new BroadcastChannel('b1g-timer-room-' + roomId);
            this.broadcastChannel.onmessage = (event) => {
                const { action, data } = event.data || {};
                if (action) {
                    console.log('[StageDisplay] BroadcastChannel event:', action);
                    this.handleRoomEvent(action, data);
                    // Mark as connected when we receive local events
                    const statusEl = document.getElementById('connection-status');
                    if (statusEl) statusEl.classList.add('connected');
                }
            };
            console.log('[StageDisplay] BroadcastChannel ready for room', roomId);

            // Request sync via BroadcastChannel
            this.requestSync(roomId);
        } catch (e) {
            console.warn('[StageDisplay] BroadcastChannel not supported:', e.message);
        }
    },

    /**
     * Request current timer state from dashboard (sync on join)
     */
    requestSync(roomId) {
        // Method 1: Send SYNC_REQUEST via BroadcastChannel for dashboard to respond
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage({ action: 'SYNC_REQUEST', data: { displayId: this.displayId } });
                console.log('[StageDisplay] Sent SYNC_REQUEST via BroadcastChannel');
            } catch (e) { /* ignore */ }
        }

        // Method 2: Read from localStorage as immediate fallback (same origin)
        try {
            const raw = localStorage.getItem('b1g_timer_state');
            if (raw) {
                const persisted = JSON.parse(raw);
                if (persisted && String(persisted.selectedRoomId) === String(roomId)) {
                    console.log('[StageDisplay] Restoring state from localStorage:', persisted);
                    // Restore stage style if available
                    if (persisted.stageStyle) {
                        this.applyStageStyle(persisted.stageStyle);
                    }
                    if (persisted.isRunning && persisted.savedAt) {
                        const elapsed = (Date.now() - new Date(persisted.savedAt).getTime()) / 1000;
                        const remaining = persisted.currentTimerRemainingSeconds - elapsed;
                        this.startCountdown({
                            startedAt: new Date().toISOString(),
                            remainingSeconds: remaining,
                            timerTitle: persisted.timerTitle || ''
                        });
                    } else if (persisted.currentTimerRemainingSeconds != null) {
                        // Paused - show static remaining time
                        this.displayCountdown(persisted.currentTimerRemainingSeconds);
                        const nameEl = document.getElementById('timer-name');
                        if (nameEl && persisted.timerTitle) nameEl.textContent = persisted.timerTitle;
                    }
                }
            }
        } catch (e) {
            console.warn('[StageDisplay] Could not read persisted state:', e.message);
        }
    },
    
    /**
     * Handle real-time events from Pusher or BroadcastChannel
     */
    handleRoomEvent(action, rawData) {
        console.log('[StageDisplay] Event:', action);
        
        // Normalize data: Pusher wraps payload inside .payload, BroadcastChannel sends directly
        const data = rawData.payload || rawData;
        
        switch (action) {
            case 'TIMER_START':
                this.startCountdown(data);
                break;
                
            case 'TIMER_PAUSE':
                this.pauseCountdown();
                break;
                
            case 'TIMER_RESUME':
                this.resumeCountdown(data);
                break;
                
            case 'TIMER_STOP':
                this.stopCountdown();
                break;
                
            case 'TIMER_RESET':
                this.resetCountdown(data);
                break;
                
            case 'NEXT_TIMER':
            case 'PREVIOUS_TIMER':
                // These start a new timer - handled via TIMER_START that follows
                this.updateCountdown(data.remainingSeconds);
                break;
                
            case 'TIME_ADJUSTMENT':
                // Restart the countdown interval with the adjusted remaining time
                this.adjustRunningCountdown(data);
                break;
                
            case 'BLACKOUT_ON':
                this.setBlackout(true);
                break;
                
            case 'BLACKOUT_OFF':
                this.setBlackout(false);
                break;
                
            case 'FLASH_TRIGGER':
                this.flashDisplay();
                break;
                
            case 'MESSAGE_SHOW':
                MessageManager.displayMessageOnStage(data);
                break;
                
            case 'MESSAGE_HIDE':
                MessageManager.hideMessageOnStage();
                break;
                
            case 'STAGE_STYLE_UPDATE':
                this.applyStageStyle(data);
                break;
                
            case 'ROOM_NAME_UPDATE':
                const roomNameEl = document.getElementById('room-name');
                if (roomNameEl && data.roomName) roomNameEl.textContent = data.roomName;
                break;
        }
    },
    
    /**
     * Start countdown animation
     */
    startCountdown(data) {
        this.startTime = new Date(data.startedAt || new Date().toISOString());
        const initialSeconds = data.remainingSeconds || 0;
        
        // Remove waiting state
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.classList.remove('waiting');
        
        // Show timer name if available
        const nameEl = document.getElementById('timer-name');
        if (nameEl && data.timerTitle) nameEl.textContent = data.timerTitle;
        
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Start countdown loop (100ms precision)
        this.updateInterval = setInterval(() => {
            const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
            let remaining = initialSeconds - elapsed;
            
            // Continue into negative (overtime) - don't stop at zero
            this.displayCountdown(remaining);
        }, 100);
        
        this.displayCountdown(initialSeconds);
    },
    
    /**
     * Pause countdown
     */
    pauseCountdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    },
    
    /**
     * Resume countdown with current remaining time
     */
    resumeCountdown(data) {
        const remaining = (data && data.remainingSeconds != null) ? data.remainingSeconds : 0;
        this.startCountdown({
            startedAt: (data && data.resumedAt) || new Date().toISOString(),
            remainingSeconds: remaining,
            timerTitle: (data && data.timerTitle) || ''
        });
    },
    
    /**
     * Stop countdown
     */
    stopCountdown() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.displayCountdown(0);
    },
    
    /**
     * Reset countdown to full duration
     */
    resetCountdown(data) {
        this.displayCountdown(data.duration || 0);
    },
    
    /**
     * Update countdown display (static, non-running)
     */
    updateCountdown(seconds) {
        this.displayCountdown(seconds);
    },

    /**
     * Adjust a running countdown in-place (for +1m/-1m buttons)
     * Restarts the interval with new remaining seconds so it keeps ticking
     */
    adjustRunningCountdown(data) {
        const newRemaining = data.newRemaining != null ? data.newRemaining : (data.remainingSeconds || 0);
        const adjustedAt = data.adjustedAt || new Date().toISOString();

        // If countdown is currently running, restart the interval with new values
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.startTime = new Date(adjustedAt);

            this.updateInterval = setInterval(() => {
                const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
                let remaining = newRemaining - elapsed;
                this.displayCountdown(remaining);
            }, 100);
        }

        this.displayCountdown(newRemaining);
    },
    
    /**
     * Apply stage style updates (timer color, clock color)
     */
    applyStageStyle(data) {
        if (data.timerColor) {
            this.stageStyle.timerColor = data.timerColor;
            const countdownEl = document.getElementById('countdown');
            if (countdownEl && !countdownEl.classList.contains('negative')) {
                countdownEl.style.color = data.timerColor;
            }
        }
        if (data.clockColor) {
            this.stageStyle.clockColor = data.clockColor;
            const timeEl = document.getElementById('time-of-day');
            if (timeEl) timeEl.style.color = data.clockColor;
        }
        console.log('[StageDisplay] Stage style updated:', data);
    },

    /**
     * Display countdown value
     */
    displayCountdown(totalSeconds) {
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = TimerMath.formatTime(totalSeconds);
            // Show red when negative (overtime), otherwise use stage style color
            if (totalSeconds < 0) {
                countdownEl.classList.add('negative');
                countdownEl.style.color = '';
            } else {
                countdownEl.classList.remove('negative');
                countdownEl.style.color = this.stageStyle.timerColor || '';
            }
        }
    },
    
    /**
     * Show animation when countdown completes
     */
    animateCountdownComplete() {
        const countdown = document.getElementById('countdown');
        if (countdown) {
            countdown.style.animation = 'pulse 0.5s ease-in-out';
            setTimeout(() => {
                countdown.style.animation = '';
            }, 500);
        }
    },
    
    /**
     * Toggle blackout overlay
     */
    setBlackout(isBlackedOut) {
        const overlay = document.getElementById('blackout-overlay');
        if (!overlay) return;
        
        if (isBlackedOut) {
            overlay.classList.add('active');
            console.log('[StageDisplay] Blackout ON');
        } else {
            overlay.classList.remove('active');
            console.log('[StageDisplay] Blackout OFF');
        }
    },
    
    /**
     * Flash display - blink the countdown text rapidly
     */
    flashDisplay() {
        const countdown = document.getElementById('countdown');
        if (!countdown) return;
        
        let flashes = 0;
        const maxFlashes = 6;
        const interval = setInterval(() => {
            countdown.style.opacity = countdown.style.opacity === '0' ? '1' : '0';
            flashes++;
            if (flashes >= maxFlashes) {
                clearInterval(interval);
                countdown.style.opacity = '1';
            }
        }, 150);
        
        console.log('[StageDisplay] Flash');
    },
    
    /**
     * Start time of day display update
     */
    startTimeDisplay() {
        const updateTime = () => {
            const timeEl = document.getElementById('time-of-day');
            if (timeEl) {
                const now = new Date();
                const h = now.getHours();
                const m = String(now.getMinutes()).padStart(2, '0');
                const s = String(now.getSeconds()).padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                timeEl.textContent = `${h12}:${m}:${s} ${ampm}`;
            }
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    },
    
    /**
     * Show waiting state (Pusher not connected, using local fallback)
     */
    showWaiting() {
        const countdown = document.getElementById('countdown');
        if (countdown) {
            countdown.textContent = '0:00';
            countdown.classList.add('waiting');
        }
        console.log('[StageDisplay] Waiting for timer events (local BroadcastChannel active)...');
    },

    /**
     * Show error message on display
     */
    showError(message) {
        const countdown = document.getElementById('countdown');
        if (countdown) {
            countdown.textContent = '0:00';
            countdown.classList.add('waiting');
        }
        console.error('[StageDisplay]', message);
    }
};

/**
 * Get room ID from URL parameter, or fetch first available room from API
 */
async function getStageRoomId() {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) return urlRoom;
    
    // No room specified — try to get the first available room
    try {
        const rooms = await APIClient.getRooms();
        if (rooms && rooms.length > 0) {
            console.log('[StageDisplay] No room param — using first room:', rooms[0].id, rooms[0].name);
            return rooms[0].id;
        }
    } catch (e) {
        console.warn('[StageDisplay] Could not fetch rooms:', e.message);
    }
    return 1;  // Final fallback
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const roomId = await getStageRoomId();
    StageDisplay.init(roomId);
});

// Add pulse animation keyframes
if (!document.getElementById('stage-display-styles')) {
    const style = document.createElement('style');
    style.id = 'stage-display-styles';
    style.textContent = `
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(style);
}

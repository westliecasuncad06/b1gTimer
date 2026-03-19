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
        } catch (e) {
            console.warn('[StageDisplay] BroadcastChannel not supported:', e.message);
        }
    },
    
    /**
     * Handle real-time events from Pusher or BroadcastChannel
     */
    handleRoomEvent(action, data) {
        console.log('[StageDisplay] Event:', action);
        
        switch (action) {
            case 'TIMER_START':
                this.startCountdown(data);
                break;
                
            case 'TIMER_PAUSE':
                this.pauseCountdown();
                break;
                
            case 'TIMER_RESUME':
                this.resumeCountdown();
                break;
                
            case 'TIMER_STOP':
                this.stopCountdown();
                break;
                
            case 'TIMER_RESET':
                this.resetCountdown(data);
                break;
                
            case 'NEXT_TIMER':
            case 'PREVIOUS_TIMER':
            case 'TIME_ADJUSTMENT':
                // Reset countdown to new timer
                this.updateCountdown(data.remainingSeconds);
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
            
            if (remaining <= 0) {
                this.displayCountdown(0);
                this.animateCountdownComplete();
                clearInterval(this.updateInterval);
                return;
            }
            
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
     * Resume countdown
     */
    resumeCountdown() {
        // Resume will be called via startCountdown with new times
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
     * Update countdown display
     */
    updateCountdown(seconds) {
        this.displayCountdown(seconds);
    },
    
    /**
     * Display countdown value
     */
    displayCountdown(totalSeconds) {
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) {
            countdownEl.textContent = TimerMath.formatTime(totalSeconds);
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
 * Get room ID from URL parameter or default
 */
function getStageRoomId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 1;  // Default to room 1
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const roomId = getStageRoomId();
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

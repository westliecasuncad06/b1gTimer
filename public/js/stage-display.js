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
    pollInterval: null,
    lastEventTime: 0,          // tracks when we last received a real-time event
    stageStyle: {
        timerColor: '#ffffff',
        clockColor: 'rgba(255,255,255,.5)',
        timerFont: "'Courier New', monospace",
        timerFontSize: 22,
        clockFont: "'Courier New', monospace",
        clockFontSize: 6,
        bgColor: '#000000'
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
                this.setupTransportControls();
                await this.syncFromServer(roomId);
                this.startPolling(roomId);
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
            
            // Setup transport controls
            this.setupTransportControls();

            // Initial sync from server (works across any browser / device)
            await this.syncFromServer(roomId);

            // Start polling fallback in case Pusher + BroadcastChannel both fail
            this.startPolling(roomId);

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
                    if (persisted.isRunning && persisted.deadlineTimestamp) {
                        // Use absolute deadline from localStorage
                        const remaining = persisted.deadlineTimestamp - Math.floor(Date.now() / 1000);
                        this.startCountdownFromDeadline(persisted.deadlineTimestamp, persisted.timerTitle || '');
                        // Mark as recent so syncFromServer doesn't override with stale data
                        this.lastEventTime = Date.now();
                    } else if (persisted.isRunning && persisted.savedAt) {
                        // Legacy fallback
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
        
        // Track real-time event time so polling does not override recent updates
        this.lastEventTime = Date.now();
        
        // Normalize data: Pusher wraps payload inside .payload, BroadcastChannel sends directly
        const data = rawData.payload || rawData;
        
        switch (action) {
            case 'TIMER_START':
                // Prefer deadline from server if available
                if (data.deadlineTimestamp) {
                    this.startCountdownFromDeadline(data.deadlineTimestamp, data.timerTitle || '');
                } else {
                    this.startCountdown(data);
                }
                this.updateStagePlayButton(true);
                break;
                
            case 'TIMER_PAUSE':
                this.pauseCountdown(data);
                this.updateStagePlayButton(false);
                break;
                
            case 'TIMER_RESUME':
                if (data.deadlineTimestamp) {
                    this.startCountdownFromDeadline(data.deadlineTimestamp, data.timerTitle || '');
                } else {
                    this.resumeCountdown(data);
                }
                this.updateStagePlayButton(true);
                break;
                
            case 'TIMER_STOP':
                this.stopCountdown();
                this.updateStagePlayButton(false);
                break;
                
            case 'TIMER_RESET':
                if (data.deadlineTimestamp) {
                    this.startCountdownFromDeadline(data.deadlineTimestamp, data.timerTitle || '');
                } else {
                    this.resetCountdown(data);
                }
                break;
                
            case 'NEXT_TIMER':
            case 'PREVIOUS_TIMER':
                // Skip/prev now triggers TIMER_STOP + TIMER_START automatically.
                // If a legacy NEXT/PREV event arrives, use deadline if available,
                // otherwise show remaining seconds (fallback).
                if (data.deadlineTimestamp) {
                    this.startCountdownFromDeadline(data.deadlineTimestamp, data.timerTitle || '');
                } else if (data.remainingSeconds != null) {
                    this.updateCountdown(data.remainingSeconds);
                }
                break;
                
            case 'TIME_ADJUSTMENT':
                if (data.deadlineTimestamp) {
                    this.startCountdownFromDeadline(data.deadlineTimestamp, '');
                } else {
                    this.adjustRunningCountdown(data);
                }
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
     * Start countdown using an absolute Unix deadline.
     * remaining = deadline - now  on every tick.  Perfect sync across devices.
     */
    startCountdownFromDeadline(deadlineTimestamp, timerTitle) {
        this.deadlineTimestamp = deadlineTimestamp;
        
        // Remove waiting state
        const countdownEl = document.getElementById('countdown');
        if (countdownEl) countdownEl.classList.remove('waiting');
        
        // Show timer name if available
        const nameEl = document.getElementById('timer-name');
        if (nameEl && timerTitle) nameEl.textContent = timerTitle;
        
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Start countdown loop — purely deadline-based
        this.updateInterval = setInterval(() => {
            const remaining = this.deadlineTimestamp - Date.now() / 1000;
            this.displayCountdown(remaining);
        }, 100);
        
        this.displayCountdown(deadlineTimestamp - Date.now() / 1000);
        this.updateStagePlayButton(true);
    },
    
    /**
     * Pause countdown
     */
    pauseCountdown(data) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.deadlineTimestamp = null;
        // Show the paused remaining time if provided
        if (data && data.remainingSeconds != null) {
            this.displayCountdown(data.remainingSeconds);
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
     * Reset countdown to full duration — stops the running interval
     */
    resetCountdown(data) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.deadlineTimestamp = null;
        const nameEl = document.getElementById('timer-name');
        if (nameEl && data.timerTitle) nameEl.textContent = data.timerTitle;
        this.displayCountdown(data.duration || 0);
        this.updateStagePlayButton(false);
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
     * Apply stage style updates (timer color, clock color, fonts, background)
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
        if (data.timerFont) {
            this.stageStyle.timerFont = data.timerFont;
            const countdownEl = document.getElementById('countdown');
            if (countdownEl) countdownEl.style.fontFamily = data.timerFont;
        }
        if (data.timerFontSize) {
            this.stageStyle.timerFontSize = data.timerFontSize;
            const countdownEl = document.getElementById('countdown');
            if (countdownEl) countdownEl.style.fontSize = data.timerFontSize + 'vw';
        }
        if (data.clockFont) {
            this.stageStyle.clockFont = data.clockFont;
            const timeEl = document.getElementById('time-of-day');
            if (timeEl) timeEl.style.fontFamily = data.clockFont;
        }
        if (data.clockFontSize) {
            this.stageStyle.clockFontSize = data.clockFontSize;
            const timeEl = document.getElementById('time-of-day');
            if (timeEl) timeEl.style.fontSize = data.clockFontSize + 'vw';
        }
        if (data.bgColor) {
            this.stageStyle.bgColor = data.bgColor;
            document.body.style.backgroundColor = data.bgColor;
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
            // Apply font family and size from stage style
            if (this.stageStyle.timerFont) {
                countdownEl.style.fontFamily = this.stageStyle.timerFont;
            }
            if (this.stageStyle.timerFontSize) {
                countdownEl.style.fontSize = this.stageStyle.timerFontSize + 'vw';
            }
        }
        this.updatePiP();
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
    },

    /**
     * Setup transport control buttons on stage display
     */
    setupTransportControls() {
        const prevBtn = document.getElementById('stage-btn-previous');
        const playBtn = document.getElementById('stage-btn-play-pause');
        const nextBtn = document.getElementById('stage-btn-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.sendCommand('STAGE_COMMAND', { command: 'PREVIOUS_TIMER' });
            });
        }
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.sendCommand('STAGE_COMMAND', { command: 'PLAY_PAUSE' });
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.sendCommand('STAGE_COMMAND', { command: 'NEXT_TIMER' });
            });
        }

        // Fullscreen button
        const fsBtn = document.getElementById('stage-btn-fullscreen');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => this.toggleFullscreen());
        }
        document.addEventListener('fullscreenchange', () => this.updateFullscreenIcon());

        // Picture-in-Picture button
        const pipBtn = document.getElementById('stage-btn-pip');
        if (pipBtn) {
            pipBtn.addEventListener('click', () => this.togglePiP());
        }
    },

    /**
     * Send a command back to the dashboard via BroadcastChannel
     */
    sendCommand(action, data) {
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage({ action, data });
                console.log('[StageDisplay] Sent command:', action, data);
            } catch (e) {
                console.warn('[StageDisplay] Could not send command:', e.message);
            }
        }
    },

    /**
     * Toggle browser fullscreen mode
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('[StageDisplay] Fullscreen failed:', err.message);
            });
        } else {
            document.exitFullscreen();
        }
    },

    /**
     * Update fullscreen button icon
     */
    updateFullscreenIcon() {
        const btn = document.getElementById('stage-btn-fullscreen');
        if (!btn) return;
        if (document.fullscreenElement) {
            btn.innerHTML = '<i class="fas fa-compress"></i>';
            btn.title = 'Exit Fullscreen';
        } else {
            btn.innerHTML = '<i class="fas fa-expand"></i>';
            btn.title = 'Toggle Fullscreen';
        }
    },

    /**
     * Toggle Document Picture-in-Picture mode
     */
    async togglePiP() {
        // Use Document PiP API if available
        if ('documentPictureInPicture' in window) {
            try {
                if (window.documentPictureInPicture.window) {
                    window.documentPictureInPicture.window.close();
                    return;
                }
                const pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: 400,
                    height: 200
                });
                // Copy styles
                const style = pipWindow.document.createElement('style');
                style.textContent = `
                    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
                    body { background:#000; color:#fff; font-family:'Courier New',monospace;
                           display:flex; flex-direction:column; align-items:center; justify-content:center;
                           height:100vh; width:100vw; overflow:hidden; gap:0; }
                    .pip-countdown { font-weight:700; font-variant-numeric:tabular-nums;
                                     line-height:1; white-space:nowrap; text-align:center; }
                    .pip-countdown.negative { color:#ef4444; }
                    .pip-clock { color:rgba(255,255,255,.5); white-space:nowrap;
                                 text-align:center; line-height:1; }
                `;
                pipWindow.document.head.appendChild(style);

                const countdownEl = pipWindow.document.createElement('div');
                countdownEl.className = 'pip-countdown';
                countdownEl.id = 'pip-countdown';
                countdownEl.textContent = document.getElementById('countdown').textContent;

                const clockEl = pipWindow.document.createElement('div');
                clockEl.className = 'pip-clock';
                clockEl.id = 'pip-clock';
                clockEl.textContent = document.getElementById('time-of-day').textContent;

                pipWindow.document.body.appendChild(countdownEl);
                pipWindow.document.body.appendChild(clockEl);

                // Responsive font sizing based on PiP window dimensions
                const resizeFonts = () => {
                    const w = pipWindow.innerWidth;
                    const h = pipWindow.innerHeight;
                    const countdownSize = Math.min(w * 0.2, h * 0.52);
                    const clockSize = Math.min(w * 0.06, h * 0.16);
                    countdownEl.style.fontSize = Math.max(16, countdownSize) + 'px';
                    clockEl.style.fontSize = Math.max(10, clockSize) + 'px';
                };
                resizeFonts();
                pipWindow.addEventListener('resize', resizeFonts);

                this._pipWindow = pipWindow;
                pipWindow.addEventListener('pagehide', () => { this._pipWindow = null; });
                console.log('[StageDisplay] Document PiP opened');
            } catch (err) {
                console.warn('[StageDisplay] Document PiP failed:', err.message);
            }
            return;
        }

        // Fallback: use Video PiP API with a canvas capture
        if (!this._pipVideo) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 200;
            const video = document.createElement('video');
            video.srcObject = canvas.captureStream(30);
            video.muted = true;
            video.style.display = 'none';
            document.body.appendChild(video);
            await video.play();
            this._pipVideo = video;
            this._pipCanvas = canvas;
        }

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await this._pipVideo.requestPictureInPicture();
            }
        } catch (err) {
            console.warn('[StageDisplay] Video PiP failed:', err.message);
        }
    },

    /**
     * Update PiP window content (called from countdown update)
     */
    updatePiP() {
        if (this._pipWindow) {
            const el = this._pipWindow.document.getElementById('pip-countdown');
            const clockEl = this._pipWindow.document.getElementById('pip-clock');
            const srcCountdown = document.getElementById('countdown');
            const srcClock = document.getElementById('time-of-day');
            if (el && srcCountdown) {
                el.textContent = srcCountdown.textContent;
                el.className = 'pip-countdown' + (srcCountdown.classList.contains('negative') ? ' negative' : '');
            }
            if (clockEl && srcClock) clockEl.textContent = srcClock.textContent;
        }
        if (this._pipCanvas) {
            const ctx = this._pipCanvas.getContext('2d');
            const cw = this._pipCanvas.width;
            const ch = this._pipCanvas.height;
            const countdown = document.getElementById('countdown');
            const srcClock = document.getElementById('time-of-day');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, cw, ch);

            // Responsive countdown font
            const countdownFontSize = Math.max(16, Math.min(cw * 0.2, ch * 0.52));
            ctx.fillStyle = countdown && countdown.classList.contains('negative') ? '#ef4444' : '#fff';
            ctx.font = `bold ${Math.round(countdownFontSize)}px Courier New`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(countdown ? countdown.textContent : '0:00', cw / 2, ch * 0.4);

            // Responsive clock font
            const clockFontSize = Math.max(10, Math.min(cw * 0.06, ch * 0.16));
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `${Math.round(clockFontSize)}px Courier New`;
            const clockText = srcClock ? srcClock.textContent : '';
            if (clockText) {
                ctx.fillText(clockText, cw / 2, ch * 0.72);
            }
        }
    },

    /**
     * Update play/pause button state on stage
     */
    updateStagePlayButton(isRunning) {
        const btn = document.getElementById('stage-btn-play-pause');
        if (!btn) return;
        if (isRunning) {
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            btn.classList.add('running');
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i>';
            btn.classList.remove('running');
        }
    },

    /**
     * Fetch current timer state from server and apply it.
     * Handles the "stage opened while timer already running on another browser" case.
     */
    async syncFromServer(roomId) {
        try {
            const state = await APIClient.getState(roomId);
            if (!state) return;
            
            console.log('[StageDisplay] Server state:', state);
            
            // Apply timer state if available
            if (state.action) {
                this.applyServerState(state);
            }
            
            // Apply active message from server (works even without timer action)
            if (state.activeMessage) {
                MessageManager.displayMessageOnStage(state.activeMessage);
            }
            // Apply stage style from server
            if (state.stageStyle) {
                this.applyStageStyle(state.stageStyle);
            }
        } catch (e) {
            console.warn('[StageDisplay] Server sync failed:', e.message);
        }
    },

    /**
     * Apply a server-sourced timer state to the display.
     * Prefers deadlineTimestamp for perfect sync across devices.
     * Always applies stop/pause from server; re-syncs running state if deadline differs.
     */
    applyServerState(state) {
        if (!state) return;
        
        const countdownEl = document.getElementById('countdown');
        
        if (state.isRunning && state.deadlineTimestamp) {
            // Start countdown OR re-sync if running with a different/stale deadline
            const deadlineDiff = Math.abs(state.deadlineTimestamp - (this.deadlineTimestamp || 0));
            if (!this.updateInterval || deadlineDiff > 2) {
                this.startCountdownFromDeadline(state.deadlineTimestamp, state.timerTitle || '');
                if (countdownEl) countdownEl.classList.remove('waiting');
            }
        } else if (state.isRunning && state.startedAt) {
            // Legacy fallback (no deadline stored yet)
            const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
            const remaining = (state.remainingSeconds || 0) - elapsed;
            if (!this.updateInterval) {
                this.startCountdown({
                    startedAt: new Date().toISOString(),
                    remainingSeconds: remaining,
                    timerTitle: state.timerTitle || ''
                });
                this.updateStagePlayButton(true);
                if (countdownEl) countdownEl.classList.remove('waiting');
            }
        } else if (!state.isRunning) {
            // Server says stopped/paused/reset.
            // BUT if we have a running countdown from a recent BroadcastChannel event
            // or localStorage restore, the server data is likely stale — don't override.
            if (this.updateInterval && this.deadlineTimestamp && (Date.now() - this.lastEventTime < 10000)) {
                console.log('[StageDisplay] Ignoring stale server !isRunning — local countdown is more recent');
                return;
            }
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            this.deadlineTimestamp = null;
            if (state.remainingSeconds != null) {
                this.displayCountdown(state.remainingSeconds);
            }
            const nameEl = document.getElementById('timer-name');
            if (nameEl && state.timerTitle) nameEl.textContent = state.timerTitle;
            if (countdownEl) countdownEl.classList.remove('waiting');
            this.updateStagePlayButton(false);
            // Apply stage style if returned from server
            if (state.stageStyle) {
                this.applyStageStyle(state.stageStyle);
            }
        }

        // Always apply stage style from server when available
        if (state.stageStyle) {
            this.applyStageStyle(state.stageStyle);
        }

        // Apply active message from server (cross-browser sync)
        if (state.activeMessage) {
            MessageManager.displayMessageOnStage(state.activeMessage);
        } else if (state.activeMessage === null) {
            // Explicitly null means message was hidden
            MessageManager.hideMessageOnStage();
        }
    },

    /**
     * Start background polling as a fallback when Pusher and BroadcastChannel are unavailable.
     * Polls every 4 seconds but skips if a real-time event was received recently.
     */
    startPolling(roomId) {
        if (this.pollInterval) clearInterval(this.pollInterval);
        
        this.pollInterval = setInterval(async () => {
            // If we received a real-time event in the last 6 seconds, trust that data
            if (Date.now() - this.lastEventTime < 6000) return;
            
            try {
                const state = await APIClient.getState(roomId);
                if (!state) return;
                
                if (state.isRunning && state.deadlineTimestamp) {
                    if (!this.updateInterval) {
                        // Stage is not counting yet — start the countdown
                        this.startCountdownFromDeadline(state.deadlineTimestamp, state.timerTitle || '');
                        const el = document.getElementById('countdown');
                        if (el) el.classList.remove('waiting');
                    } else if (Math.abs(state.deadlineTimestamp - (this.deadlineTimestamp || 0)) > 2) {
                        // Server deadline differs by >2s (e.g. after TIME_ADJUSTMENT) — re-sync
                        this.startCountdownFromDeadline(state.deadlineTimestamp, state.timerTitle || '');
                    }
                } else if (state.isRunning && state.startedAt) {
                    // Legacy fallback
                    const elapsed = (Date.now() - new Date(state.startedAt).getTime()) / 1000;
                    const remaining = (state.remainingSeconds || 0) - elapsed;
                    
                    if (!this.updateInterval) {
                        this.startCountdown({
                            startedAt: new Date().toISOString(),
                            remainingSeconds: remaining,
                            timerTitle: state.timerTitle || ''
                        });
                        this.updateStagePlayButton(true);
                        const el = document.getElementById('countdown');
                        if (el) el.classList.remove('waiting');
                    }
                } else if (!state.isRunning) {
                    // Server says paused/stopped/reset — always stop the countdown
                    if (this.updateInterval) {
                        clearInterval(this.updateInterval);
                        this.updateInterval = null;
                        this.deadlineTimestamp = null;
                    }
                    if (state.remainingSeconds != null) this.displayCountdown(state.remainingSeconds);
                    const nameEl = document.getElementById('timer-name');
                    if (nameEl && state.timerTitle) nameEl.textContent = state.timerTitle;
                    this.updateStagePlayButton(false);
                }
                // Always apply stage style on each poll if present
                if (state.stageStyle) this.applyStageStyle(state.stageStyle);
                // Apply active message from server poll
                if (state.activeMessage) {
                    MessageManager.displayMessageOnStage(state.activeMessage);
                } else if (state.activeMessage === null) {
                    MessageManager.hideMessageOnStage();
                }
            } catch (e) { /* ignore poll errors */ }
        }, 4000);
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

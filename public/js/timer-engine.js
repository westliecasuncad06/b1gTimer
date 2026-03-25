/**
 * B1G Timer - Timer Countdown Engine
 * Manages timer countdown loop, updates, and state synchronization
 * 
 * Uses ABSOLUTE DEADLINE logic: when a timer starts the engine computes
 * deadlineTimestamp = Date.now()/1000 + remainingSeconds.  Every tick just
 * calculates: remaining = deadline - now.  The server stores the same
 * deadline so that ANY client (dashboard, stage, different browser) can
 * recover perfectly after a refresh.
 */

const TimerEngine = {
    intervalId: null,
    updateFrequency: 100,  // Update every 100ms for smooth display
    
    /**
     * Start timer countdown
     * @param {number} timerIndex
     * @param {number|null} remainingSeconds  – null = use full duration
     * @param {number|null} deadlineTimestamp – absolute Unix epoch; if provided we skip computing it
     * @param {boolean} silent – true = restore quietly without re-broadcasting (used on page refresh)
     */
    start(timerIndex, remainingSeconds = null, deadlineTimestamp = null, silent = false) {
        // Stop any running timer first (silent — avoid broadcasting TIMER_STOP
        // right before the TIMER_START that follows; the stage only needs TIMER_START)
        this.stop(true);
        
        const timers = StateManager.state.timers;
        if (!timers || !timers[timerIndex]) {
            console.error('[TimerEngine] Invalid timer index:', timerIndex);
            return;
        }
        
        // Use provided remaining time or full duration
        if (remainingSeconds === null) {
            remainingSeconds = timers[timerIndex].duration_seconds;
        }
        
        // Compute or accept absolute deadline
        if (deadlineTimestamp) {
            StateManager.state.deadlineTimestamp = deadlineTimestamp;
        } else {
            StateManager.state.deadlineTimestamp = Math.floor(Date.now() / 1000) + remainingSeconds;
        }
        
        // Start timer in state
        StateManager.startTimer(timerIndex, remainingSeconds);
        
        console.log(`[TimerEngine] Starting timer: ${timers[timerIndex].title} (${TimerMath.formatTime(remainingSeconds)}) deadline=${StateManager.state.deadlineTimestamp}`);
        
        // Persist state immediately
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();

        // Start countdown loop
        this.intervalId = setInterval(() => {
            this.tick();
        }, this.updateFrequency);
        
        // Broadcast event to other clients (server will compute its own deadline from remainingSeconds).
        // Skip when silently restoring on page refresh to avoid overwriting the authoritative deadline.
        if (!silent) {
            APIClient.broadcastEvent(
                StateManager.state.selectedRoomId,
                'TIMER_START',
                {
                    timerIndex,
                    timerTitle: timers[timerIndex].title,
                    remainingSeconds,
                    deadlineTimestamp: StateManager.state.deadlineTimestamp,
                    startedAt: new Date().toISOString()
                }
            );
        }
    },
    
    /**
     * Pause timer
     */
    pause() {
        if (!StateManager.state.isRunning) return;
        
        clearInterval(this.intervalId);
        
        // Snapshot remaining from deadline before stopping
        if (StateManager.state.deadlineTimestamp) {
            const remaining = StateManager.state.deadlineTimestamp - Date.now() / 1000;
            StateManager.state.currentTimerRemainingSeconds = remaining;
        }
        StateManager.state.deadlineTimestamp = null;
        
        StateManager.stopTimer();
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
        
        console.log('[TimerEngine] Timer paused');
        
        const timerIndex = StateManager.state.currentTimerIndex;
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_PAUSE',
            {
                timerIndex,
                remainingSeconds: StateManager.state.currentTimerRemainingSeconds,
                deadlineTimestamp: StateManager.state.deadlineTimestamp,   // server uses this for accuracy
                pausedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Resume paused timer
     */
    resume() {
        if (StateManager.state.isRunning) return;
        
        if (!StateManager.state.currentTimerStartTime) {
            console.error('[TimerEngine] No timer to resume');
            return;
        }
        
        const remaining = StateManager.state.currentTimerRemainingSeconds;
        
        // Compute new absolute deadline from remaining seconds
        StateManager.state.deadlineTimestamp = Math.floor(Date.now() / 1000) + remaining;
        StateManager.state.currentTimerStartTime = new Date().toISOString();
        StateManager.state.isRunning = true;
        
        // Persist now so a page refresh after resume correctly restores running state
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
        
        // Emit timer-started so the play button updates to show pause icon
        StateManager.emit('timer-started', {
            timerIndex: StateManager.state.currentTimerIndex,
            remainingSeconds: remaining,
            timer: StateManager.state.timers[StateManager.state.currentTimerIndex]
        });

        this.intervalId = setInterval(() => {
            this.tick();
        }, this.updateFrequency);
        
        console.log('[TimerEngine] Timer resumed, deadline=' + StateManager.state.deadlineTimestamp);
        
        const timerIndex = StateManager.state.currentTimerIndex;
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_RESUME',
            {
                timerIndex,
                remainingSeconds: remaining,
                deadlineTimestamp: StateManager.state.deadlineTimestamp,
                resumedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Stop timer completely
     * @param {boolean} silent – true = stop locally without broadcasting (used during skip operations)
     */
    stop(silent = false) {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (!StateManager.state.isRunning) return;
        
        const timerIndex = StateManager.state.currentTimerIndex;
        StateManager.state.deadlineTimestamp = null;
        StateManager.stopTimer();
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
        
        console.log('[TimerEngine] Timer stopped');
        
        if (!silent) {
            APIClient.broadcastEvent(
                StateManager.state.selectedRoomId,
                'TIMER_STOP',
                {
                    timerIndex,
                    stoppedAt: new Date().toISOString()
                }
            );
        }
    },
    
    /**
     * Reset timer to full duration.
     * Always stops the countdown (consistent with server-side TIMER_RESET state).
     * After reset the user presses Play to start fresh.
     */
    reset() {
        const timerIndex = StateManager.state.currentTimerIndex;
        const timers = StateManager.state.timers;
        
        if (!timers || !timers[timerIndex]) {
            console.error('[TimerEngine] Invalid timer index:', timerIndex);
            return;
        }
        
        // Stop interval and mark not-running
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        const fullDuration = timers[timerIndex].duration_seconds;
        StateManager.state.isRunning = false;
        StateManager.state.deadlineTimestamp = null;
        StateManager.state.currentTimerStartTime = null;
        StateManager.state.currentTimerRemainingSeconds = fullDuration;
        
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
        
        console.log('[TimerEngine] Timer reset to', fullDuration, 's');
        
        // Emit stopped so play button and card icon revert to ▶
        StateManager.emit('timer-stopped', {
            timerIndex,
            remainingSeconds: fullDuration
        });
        
        // Emit updated so preview display shows full duration
        StateManager.emit('timer-updated', {
            timerIndex,
            remainingSeconds: fullDuration
        });
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_RESET',
            {
                timerIndex,
                timerTitle: timers[timerIndex].title,
                duration: fullDuration,
                resetAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Skip to next timer
     */
    skipToNext() {
        const currentIndex = StateManager.state.currentTimerIndex;
        const timers = StateManager.state.timers;
        
        if (!timers || currentIndex >= timers.length - 1) {
            console.warn('[TimerEngine] No next timer available');
            return;
        }
        
        this.stop(true);  // silent stop — don't broadcast TIMER_STOP to stage
        this.start(currentIndex + 1);
    },
    
    /**
     * Skip to previous timer
     */
    skipToPrevious() {
        const currentIndex = StateManager.state.currentTimerIndex;
        
        if (currentIndex <= 0) {
            console.warn('[TimerEngine] No previous timer available');
            return;
        }
        
        this.stop(true);  // silent stop — don't broadcast TIMER_STOP to stage
        this.start(currentIndex - 1);
    },
    
    /**
     * Adjust timer by specified seconds
     */
    adjustTime(deltaSeconds) {
        let newRemaining = StateManager.state.currentTimerRemainingSeconds + deltaSeconds;
        
        StateManager.state.currentTimerRemainingSeconds = newRemaining;
        
        // Recompute deadline if running
        if (StateManager.state.isRunning) {
            StateManager.state.deadlineTimestamp = Math.floor(Date.now() / 1000) + newRemaining;
            StateManager.state.currentTimerStartTime = new Date().toISOString();
        }
        
        console.log(`[TimerEngine] Adjusted time by ${deltaSeconds}s, new remaining: ${TimerMath.formatTime(newRemaining)}`);
        
        StateManager.emit('timer-updated', {
            timerIndex: StateManager.state.currentTimerIndex,
            remainingSeconds: newRemaining
        });
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIME_ADJUSTMENT',
            {
                timerIndex: StateManager.state.currentTimerIndex,
                deltaSeconds,
                newRemaining,
                adjustedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Main countdown tick (called every 100ms)
     * Uses absolute deadline: remaining = deadline - now
     */
    tick() {
        if (!StateManager.state.isRunning) return;
        
        const deadline = StateManager.state.deadlineTimestamp;
        if (!deadline) return;
        
        const now = Date.now() / 1000;
        const remaining = deadline - now;
        
        // Allow negative (overtime) - don't clamp to 0
        StateManager.updateTimerRemaining(remaining);

        // Persist state for refresh recovery (deadline doesn't change, but remaining does for paused-snapshot)
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
    },
    
    /**
     * Called when timer reaches zero (now only used if we want to auto-stop)
     */
    onTimerFinished() {
        // Timer continues into negative (overtime) - do not stop
        console.log('[TimerEngine] Timer reached zero - entering overtime');
    },
    
    /**
     * Handle external timer events from Pusher
     */
    handleRemoteEvent(action, data) {
        console.log('[TimerEngine] Remote event:', action, data);
        
        switch (action) {
            case 'TIMER_START':
                if (data.timerIndex !== StateManager.state.currentTimerIndex ||
                    data.displayId === StateManager.get('displayId')) {
                    // Don't re-apply our own events
                    break;
                }
                this.start(data.timerIndex, data.remainingSeconds);
                break;
                
            case 'TIMER_PAUSE':
                if (StateManager.state.isRunning) {
                    this.pause();
                }
                break;
                
            case 'TIMER_RESUME':
                if (!StateManager.state.isRunning) {
                    this.resume();
                }
                break;
                
            case 'TIMER_STOP':
                this.stop();
                break;
                
            case 'TIMER_RESET':
                this.reset();
                break;
                
            case 'NEXT_TIMER':
                this.skipToNext();
                break;
                
            case 'PREVIOUS_TIMER':
                this.skipToPrevious();
                break;
                
            case 'TIME_ADJUSTMENT':
                this.adjustTime(data.deltaSeconds);
                break;
        }
    }
};

// Make TimerEngine globally available
window.TimerEngine = TimerEngine;

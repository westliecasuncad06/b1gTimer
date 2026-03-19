/**
 * B1G Timer - Timer Countdown Engine
 * Manages timer countdown loop, updates, and state synchronization
 * 
 * Phase 4 Task: 4.2 (Timer Countdown Logic)
 */

const TimerEngine = {
    intervalId: null,
    updateFrequency: 100,  // Update every 100ms for smooth display
    
    /**
     * Start timer countdown
     */
    start(timerIndex, remainingSeconds = null) {
        // Stop any running timer first
        this.stop();
        
        const timers = StateManager.state.timers;
        if (!timers || !timers[timerIndex]) {
            console.error('[TimerEngine] Invalid timer index:', timerIndex);
            return;
        }
        
        // Use provided remaining time or full duration
        if (remainingSeconds === null) {
            remainingSeconds = timers[timerIndex].duration_seconds;
        }
        
        // Start timer in state
        StateManager.startTimer(timerIndex, remainingSeconds);
        
        console.log(`[TimerEngine] Starting timer: ${timers[timerIndex].title} (${TimerMath.formatTime(remainingSeconds)})`);
        
        // Persist state immediately
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();

        // Start countdown loop
        this.intervalId = setInterval(() => {
            this.tick();
        }, this.updateFrequency);
        
        // Broadcast event to other clients
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_START',
            {
                timerIndex,
                timerTitle: timers[timerIndex].title,
                remainingSeconds,
                startedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Pause timer
     */
    pause() {
        if (!StateManager.state.isRunning) return;
        
        clearInterval(this.intervalId);
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
        
        // Reset start time to now so tick() calculates from current remaining
        StateManager.state.currentTimerStartTime = new Date().toISOString();
        StateManager.state.isRunning = true;
        
        // Emit timer-started so the play button updates to show pause icon
        StateManager.emit('timer-started', {
            timerIndex: StateManager.state.currentTimerIndex,
            remainingSeconds: StateManager.state.currentTimerRemainingSeconds,
            timer: StateManager.state.timers[StateManager.state.currentTimerIndex]
        });

        this.intervalId = setInterval(() => {
            this.tick();
        }, this.updateFrequency);
        
        console.log('[TimerEngine] Timer resumed');
        
        const timerIndex = StateManager.state.currentTimerIndex;
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_RESUME',
            {
                timerIndex,
                remainingSeconds: StateManager.state.currentTimerRemainingSeconds,
                resumedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Stop timer completely
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        if (!StateManager.state.isRunning) return;
        
        const timerIndex = StateManager.state.currentTimerIndex;
        StateManager.stopTimer();
        if (typeof StateManager.persistTimerState === 'function') StateManager.persistTimerState();
        
        console.log('[TimerEngine] Timer stopped');
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_STOP',
            {
                timerIndex,
                stoppedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Reset timer to full duration
     */
    reset() {
        const timerIndex = StateManager.state.currentTimerIndex;
        const timers = StateManager.state.timers;
        
        if (!timers || !timers[timerIndex]) {
            console.error('[TimerEngine] Invalid timer index:', timerIndex);
            return;
        }
        
        const fullDuration = timers[timerIndex].duration_seconds;
        StateManager.state.currentTimerRemainingSeconds = fullDuration;
        
        // Reset start time if running
        if (StateManager.state.isRunning) {
            StateManager.state.currentTimerStartTime = new Date().toISOString();
        }
        
        console.log('[TimerEngine] Timer reset');
        
        StateManager.emit('timer-updated', {
            timerIndex,
            remainingSeconds: fullDuration
        });
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMER_RESET',
            {
                timerIndex,
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
        
        this.stop();
        this.start(currentIndex + 1);
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'NEXT_TIMER',
            {
                fromIndex: currentIndex,
                toIndex: currentIndex + 1,
                skippedAt: new Date().toISOString()
            }
        );
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
        
        this.stop();
        this.start(currentIndex - 1);
        
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'PREVIOUS_TIMER',
            {
                fromIndex: currentIndex,
                toIndex: currentIndex - 1,
                skippedAt: new Date().toISOString()
            }
        );
    },
    
    /**
     * Adjust timer by specified seconds
     */
    adjustTime(deltaSeconds) {
        let newRemaining = StateManager.state.currentTimerRemainingSeconds + deltaSeconds;
        
        StateManager.state.currentTimerRemainingSeconds = newRemaining;
        
        // Update start time if running to keep countdown accurate
        if (StateManager.state.isRunning) {
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
     */
    tick() {
        if (!StateManager.state.isRunning) return;
        
        const now = Date.now();
        const startTime = new Date(StateManager.state.currentTimerStartTime).getTime();
        const elapsed = (now - startTime) / 1000;  // seconds
        let remaining = StateManager.state.currentTimerRemainingSeconds - elapsed;
        
        // Reset reference point to now so next tick doesn't double-count
        StateManager.state.currentTimerStartTime = new Date(now).toISOString();
        
        // Allow negative (overtime) - don't clamp to 0
        StateManager.updateTimerRemaining(remaining);

        // Persist state for refresh recovery
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

/**
 * B1G Timer - Local State Manager
 * Maintains UI state, current room, active timer, messages, etc.
 * 
 * Phase 4 Task: 4.8 (Local State Management)
 */

const StateManager = {
    /**
     * Current state tree
     */
    state: {
        // UI state
        selectedRoomId: null,
        selectedTimerId: null,
        
        // Data
        rooms: [],
        currentRoom: null,
        timers: [],
        
        // Timer runtime state
        isRunning: false,
        currentTimerIndex: 0,
        currentTimerStartTime: null,  // ISO8601 when current timer started
        currentTimerRemainingSeconds: 0,
        deadlineTimestamp: null,       // Absolute Unix epoch when timer reaches 0
        
        // Message state
        activeMessage: null,
        messageQueue: [],
        messageStyle: {
            color: 'white',
            bold: false,
            fontSize: 36
        },
        
        // Display state
        isBlackedOut: false,
        
        // Stage style
        stageStyle: {
            timerColor: '#ffffff',
            clockColor: '#808080',
            timerFont: "'Courier New', monospace",
            timerFontSize: 22,
            clockFont: "'Courier New', monospace",
            clockFontSize: 6,
            bgColor: '#000000'
        }
    },
    
    /**
     * Event listeners for state changes
     */
    listeners: {
        'room-selected': [],
        'timer-list-changed': [],
        'timer-started': [],
        'timer-stopped': [],
        'timer-updated': [],
        'message-shown': [],
        'message-hidden': [],
        'blackout-toggled': []
    },
    
    /**
     * Subscribe to state changes
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    },
    
    /**
     * Emit state change event
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in listener for "${event}":`, error);
                }
            });
        }
    },
    
    /**
     * Set selected room
     */
    setSelectedRoom(roomId) {
        this.state.selectedRoomId = roomId;
        this.emit('room-selected', { roomId });
    },
    
    /**
     * Update rooms list
     */
    setRooms(rooms) {
        this.state.rooms = rooms;
        this.emit('rooms-loaded', { rooms });
    },
    
    /**
     * Set current room with timers
     */
    setCurrentRoom(room) {
        this.state.currentRoom = room;
        this.state.timers = room.timers || [];
        this.emit('timer-list-changed', { timers: this.state.timers });
    },
    
    /**
     * Update timers list
     */
    setTimers(timers) {
        this.state.timers = timers;
        this.emit('timer-list-changed', { timers });
    },
    
    /**
     * Start timer countdown
     */
    startTimer(timerIndex, remainingSeconds) {
        this.state.currentTimerIndex = timerIndex;
        this.state.currentTimerRemainingSeconds = remainingSeconds;
        this.state.currentTimerStartTime = new Date().toISOString();
        this.state.isRunning = true;
        
        this.emit('timer-started', {
            timerIndex,
            remainingSeconds,
            timer: this.state.timers[timerIndex]
        });
    },
    
    /**
     * Stop/pause timer
     */
    stopTimer() {
        this.state.isRunning = false;
        this.emit('timer-stopped', {
            timerIndex: this.state.currentTimerIndex,
            remainingSeconds: this.state.currentTimerRemainingSeconds
        });
    },
    
    /**
     * Update timer remaining seconds (called during countdown)
     */
    updateTimerRemaining(remainingSeconds) {
        this.state.currentTimerRemainingSeconds = remainingSeconds;
        this.emit('timer-updated', {
            timerIndex: this.state.currentTimerIndex,
            remainingSeconds
        });
    },
    
    /**
     * Show message
     */
    showMessage(text, color = 'white', bold = false, fontSize = 36) {
        this.state.activeMessage = {
            text,
            color,
            bold,
            fontSize,
            shownAt: new Date().toISOString()
        };
        
        this.state.messageQueue.push(this.state.activeMessage);
        this.emit('message-shown', { message: this.state.activeMessage });
    },
    
    /**
     * Hide message
     */
    hideMessage() {
        this.state.activeMessage = null;
        this.emit('message-hidden', {});
    },
    
    /**
     * Update message style
     */
    setMessageStyle(color, bold, fontSize) {
        this.state.messageStyle = { color, bold, fontSize };
    },
    
    /**
     * Toggle blackout
     */
    setBlackedOut(isBlackedOut) {
        this.state.isBlackedOut = isBlackedOut;
        this.emit('blackout-toggled', { isBlackedOut });
    },
    
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    },
    
    /**
     * Get specific state value
     */
    get(path) {
        const parts = path.split('.');
        let value = this.state;
        for (let part of parts) {
            value = value?.[part];
        }
        return value;
    },

    /**
     * Persist running timer state to localStorage (called frequently)
     */
    persistTimerState() {
        try {
            const data = {
                selectedRoomId: this.state.selectedRoomId,
                currentTimerIndex: this.state.currentTimerIndex,
                isRunning: this.state.isRunning,
                currentTimerRemainingSeconds: this.state.currentTimerRemainingSeconds,
                currentTimerStartTime: this.state.currentTimerStartTime,
                deadlineTimestamp: this.state.deadlineTimestamp,
                timerTitle: (this.state.timers[this.state.currentTimerIndex] || {}).title || '',
                stageStyle: this.state.stageStyle,
                savedAt: new Date().toISOString(),
                // Cache timers array so we can restore without a successful API call
                cachedTimers: this.state.timers || []
            };
            localStorage.setItem('b1g_timer_state', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    },

    /**
     * Restore timer state from localStorage
     */
    getPersistedTimerState() {
        try {
            const raw = localStorage.getItem('b1g_timer_state');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    },

    /**
     * Clear persisted timer state
     */
    clearPersistedTimerState() {
        try { localStorage.removeItem('b1g_timer_state'); } catch (e) { /* ignore */ }
    }
};

// Make StateManager globally available
window.StateManager = StateManager;

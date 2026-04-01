/**
 * B1G Timer - Shared API Client Library
 * Provides methods to call backend REST API endpoints
 * 
 * Phase 4 Task: 4.1 (Room Management)
 */

const APIClient = {
    // Resolve relative to the public/ folder → go up one level to hit project root /api/v1
    baseURL: '../api/v1',
    
    /**
     * Generic HTTP request handler
     */
    async request(method, endpoint, data = null) {
        try {
            const url = `${this.baseURL}${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            const responseData = await response.json();
            
            // Check for error response
            if (!response.ok) {
                throw new Error(responseData.error || `HTTP ${response.status}`);
            }
            
            return responseData;
            
        } catch (error) {
            console.error(`API Error [${method} ${endpoint}]:`, error);
            throw error;
        }
    },
    
    /**
     * Fetch all rooms
     */
    async getRooms() {
        const response = await this.request('GET', '/rooms');
        return response.data || [];
    },
    
    /**
     * Fetch single room with timers
     */
    async getRoom(roomId) {
        const response = await this.request('GET', `/rooms/${roomId}`);
        return response.data;
    },
    
    /**
     * Create new room
     */
    async createRoom(name) {
        const response = await this.request('POST', '/rooms', { name });
        return response.data;
    },
    
    /**
     * Update room name and timers
     */
    async updateRoom(roomId, name, timers) {
        const response = await this.request('PUT', `/rooms/${roomId}`, {
            name,
            timers
        });
        return response.data;
    },
    
    /**
     * Delete room
     */
    async deleteRoom(roomId) {
        const response = await this.request('DELETE', `/rooms/${roomId}`);
        return response.data;
    },
    
    // BroadcastChannel for same-machine stage display communication
    _broadcastChannels: {},

    _getLocalChannel(roomId) {
        if (!this._broadcastChannels[roomId]) {
            try {
                this._broadcastChannels[roomId] = new BroadcastChannel('b1g-timer-room-' + roomId);
                // Listen for SYNC_REQUEST from stage displays
                this._broadcastChannels[roomId].onmessage = (event) => {
                    const { action, data } = event.data || {};
                    if (action === 'SYNC_REQUEST' && typeof StateManager !== 'undefined') {
                        const state = StateManager.state;
                        if (state.selectedRoomId != null) {
                            const syncData = {
                                isRunning: state.isRunning,
                                currentTimerIndex: state.currentTimerIndex,
                                remainingSeconds: state.currentTimerRemainingSeconds,
                                deadlineTimestamp: state.deadlineTimestamp || null,
                                startedAt: state.currentTimerStartTime,
                                timerTitle: (state.timers[state.currentTimerIndex] || {}).title || ''
                            };
                            try {
                                this._broadcastChannels[roomId].postMessage({
                                    action: state.isRunning ? 'TIMER_START' : 'TIMER_PAUSE',
                                    data: syncData
                                });
                                // Also send stage style
                                if (state.stageStyle) {
                                    this._broadcastChannels[roomId].postMessage({
                                        action: 'STAGE_STYLE_UPDATE',
                                        data: state.stageStyle
                                    });
                                }
                                // Also send room name
                                if (state.currentRoom && state.currentRoom.name) {
                                    this._broadcastChannels[roomId].postMessage({
                                        action: 'ROOM_NAME_UPDATE',
                                        data: { roomName: state.currentRoom.name }
                                    });
                                }
                                // Also send active message if any
                                if (state.activeMessage) {
                                    this._broadcastChannels[roomId].postMessage({
                                        action: 'MESSAGE_SHOW',
                                        data: state.activeMessage
                                    });
                                }
                                // Also send active Bible verse if any
                                if (state.activeBible) {
                                    this._broadcastChannels[roomId].postMessage({
                                        action: 'BIBLE_VERSE_UPDATE',
                                        data: state.activeBible
                                    });
                                }
                                console.log('[APIClient] Responded to SYNC_REQUEST with current state');
                            } catch (e) { /* ignore */ }
                        }
                    }
                    // Handle commands from stage display transport controls
                    if (action === 'STAGE_COMMAND' && data && data.command && typeof TimerEngine !== 'undefined') {
                        console.log('[APIClient] Received STAGE_COMMAND:', data.command);
                        switch (data.command) {
                            case 'PREVIOUS_TIMER':
                                TimerEngine.skipToPrevious();
                                break;
                            case 'NEXT_TIMER':
                                TimerEngine.skipToNext();
                                break;
                            case 'PLAY_PAUSE':
                                if (typeof ControlDashboard !== 'undefined') {
                                    ControlDashboard.togglePlayPause();
                                } else if (StateManager.state.isRunning) {
                                    TimerEngine.pause();
                                } else if (StateManager.state.currentTimerStartTime) {
                                    TimerEngine.resume();
                                } else {
                                    TimerEngine.start(StateManager.state.currentTimerIndex || 0);
                                }
                                break;
                        }
                    }
                };
            } catch (e) {
                // BroadcastChannel not supported
            }
        }
        return this._broadcastChannels[roomId];
    },

    /**
     * Update only the dashboard name for a room
     */
    async updateDashboardName(roomId, dashboardName) {
        const response = await this.request('PUT', `/rooms/${roomId}`, { dashboard_name: dashboardName });
        return response.data;
    },

    /**
     * Broadcast timer control event via Pusher and local BroadcastChannel
     */
    async broadcastEvent(roomId, action, payload = {}, displayId = null) {
        // Always send via local BroadcastChannel (works without Pusher)
        const channel = this._getLocalChannel(roomId);
        if (channel) {
            try {
                channel.postMessage({ action, data: payload });
            } catch (e) {
                // ignore
            }
        }

        // Also send via API/Pusher if available
        try {
            const response = await this.request('POST', '/broadcast', {
                roomId,
                action,
                payload,
                displayId
            });
            return response.data;
        } catch (e) {
            // API broadcast failed (Pusher not configured) - local channel is the fallback
            console.warn('[APIClient] Broadcast API failed (Pusher likely not configured):', e.message);
            return null;
        }
    },
    
    /**
     * Health check
     */
    async getHealth() {
        const response = await this.request('GET', '/health');
        return response.data;
    },

    /**
     * Get current live timer state for a room (used by Stage for cross-browser sync / polling fallback)
     */
    async getState(roomId) {
        try {
            const response = await this.request('GET', `/state?room=${encodeURIComponent(roomId)}`);
            return response.data || null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Broadcast a Bible verse to the Stage Display
     * Uses a SEPARATE BroadcastChannel ('b1g-bible-room-{id}') so that
     * the timer stage and bible stage never cross-contaminate each other.
     */
    async broadcastBibleVerse(roomId, verseData, styleData) {
        return this.broadcastBibleEvent(roomId, 'BIBLE_VERSE_UPDATE', {
            ...verseData,
            style: styleData,
            displayId: localStorage.getItem('displayId') || 'unknown'
        });
    },

    /**
     * Clear Bible verse from Stage Display
     */
    async clearBibleVerse(roomId) {
        return this.broadcastBibleEvent(roomId, 'BIBLE_VERSE_CLEAR', {
            displayId: localStorage.getItem('displayId') || 'unknown'
        });
    },

    /**
     * Broadcast a Bible-specific event via the dedicated bible BroadcastChannel.
     * This keeps Bible events isolated from timer events so both stages can run
     * simultaneously without interfering with each other.
     */
    async broadcastBibleEvent(roomId, action, payload = {}) {
        // Send via dedicated Bible BroadcastChannel (timer stage never sees this)
        const channel = this._getBibleLocalChannel(roomId);
        if (channel) {
            try { channel.postMessage({ action, data: payload }); } catch (e) { /* ignore */ }
        }
        // Also push via API/Pusher for cross-browser bible-stage support
        try {
            const response = await this.request('POST', '/broadcast', {
                roomId, action, payload,
                displayId: localStorage.getItem('displayId') || 'unknown'
            });
            return response.data;
        } catch (e) {
            console.warn('[APIClient] Bible broadcast API failed (Pusher likely not configured):', e.message);
            return null;
        }
    },

    /**
     * Get (or create) the dedicated BroadcastChannel for Bible events.
     * Named 'b1g-bible-room-{id}' — distinct from the timer channel 'b1g-timer-room-{id}'.
     */
    _getBibleLocalChannel(roomId) {
        const key = 'bible-' + roomId;
        if (!this._broadcastChannels[key]) {
            try {
                this._broadcastChannels[key] = new BroadcastChannel('b1g-bible-room-' + roomId);
            } catch (e) { /* not supported */ }
        }
        return this._broadcastChannels[key];
    },

    // ===== BIBLE PRESETS =====

    async getBiblePresets(roomId) {
        const response = await this.request('GET', `/bible-presets?room=${encodeURIComponent(roomId)}`);
        return response.data || [];
    },

    async createBiblePreset(data) {
        const response = await this.request('POST', '/bible-presets', data);
        return response.data;
    },

    async updateBiblePreset(id, data) {
        const response = await this.request('PUT', `/bible-presets/${id}`, data);
        return response.data;
    },

    async deleteBiblePreset(id) {
        const response = await this.request('DELETE', `/bible-presets/${id}`);
        return response.data;
    },

    async reorderBiblePresets(items) {
        const response = await this.request('PUT', '/bible-presets/reorder', { items });
        return response.data;
    },

    // ===== BIBLE BACKGROUNDS =====

    async listBibleBackgrounds() {
        const response = await this.request('GET', '/bible-bg');
        return response.data || [];
    },

    async uploadBibleBackground(file) {
        const formData = new FormData();
        formData.append('image', file);
        const url = `${this.baseURL}/bible-bg`;
        const resp = await fetch(url, { method: 'POST', body: formData });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        return data.data;
    },

    async deleteBibleBackground(filename) {
        const response = await this.request('DELETE', `/bible-bg/${encodeURIComponent(filename)}`);
        return response.data;
    }
};

// Make APIClient globally available
window.APIClient = APIClient;

/**
 * B1G Timer - Room Management Module
 * Handles room CRUD operations and selection
 * 
 * Phase 4 Task: 4.1 (Room Management)
 */

const RoomManager = {
    /**
     * Load all rooms and populate selector
     */
    async loadRooms() {
        try {
            const rooms = await APIClient.getRooms();
            StateManager.setRooms(rooms);
            this.populateRoomSelector(rooms);
            return rooms;
        } catch (error) {
            console.error('[RoomManager] Error loading rooms:', error);
            this.showError('Failed to load rooms. Check connection.');
            return [];
        }
    },
    
    /**
     * Load specific room with timers
     */
    async loadRoom(roomId) {
        try {
            // Stop any running timer before switching rooms
            if (StateManager.state.isRunning) {
                TimerEngine.stop();
            }

            // Close old BroadcastChannel for previous room
            const oldRoomId = StateManager.state.selectedRoomId;
            if (oldRoomId && oldRoomId !== roomId && APIClient._broadcastChannels[oldRoomId]) {
                try { APIClient._broadcastChannels[oldRoomId].close(); } catch(e) {}
                delete APIClient._broadcastChannels[oldRoomId];
            }

            const room = await APIClient.getRoom(roomId);
            StateManager.setCurrentRoom(room);
            StateManager.setSelectedRoom(roomId);

            // Reset timer index and remaining seconds for new room
            StateManager.state.currentTimerIndex = 0;
            StateManager.state.currentTimerStartTime = null;
            StateManager.state.currentTimerRemainingSeconds = 0;
            StateManager.state.isRunning = false;

            // Update preview display with first timer of new room
            if (room.timers && room.timers.length > 0) {
                const firstDuration = room.timers[0].duration_seconds || 0;
                StateManager.state.currentTimerRemainingSeconds = firstDuration;
                if (typeof ControlDashboard !== 'undefined' && ControlDashboard.updatePreviewDisplay) {
                    ControlDashboard.updatePreviewDisplay(firstDuration);
                    ControlDashboard.updatePlayButton(false);
                }
            } else {
                if (typeof ControlDashboard !== 'undefined' && ControlDashboard.updatePreviewDisplay) {
                    ControlDashboard.updatePreviewDisplay(0);
                    ControlDashboard.updatePlayButton(false);
                }
            }

            if (typeof StateManager.persistTimerState === 'function') {
                StateManager.persistTimerState();
            }
            this.renderTimerList(room.timers);
            
            // Subscribe to real-time updates for this room
            PusherManager.subscribeToRoom(roomId, (action, data) => {
                this.handleRoomEvent(action, data);
            });
            
            // Initialize BroadcastChannel early so SYNC_REQUEST from stage is heard
            APIClient._getLocalChannel(roomId);
            
            return room;
        } catch (error) {
            console.error('[RoomManager] Error loading room:', error);
            this.showError('Failed to load room details.');
            return null;
        }
    },
    
    /**
     * Create new room
     */
    async createRoom(name) {
        try {
            if (!name || name.trim() === '') {
                this.showError('Room name cannot be empty.');
                return null;
            }
            
            const room = await APIClient.createRoom(name);
            
            // Reload rooms list
            await this.loadRooms();
            
            // Select newly created room
            await this.loadRoom(room.id);
            
            this.showSuccess(`Room "${name}" created successfully.`);
            return room;
        } catch (error) {
            console.error('[RoomManager] Error creating room:', error);
            this.showError(`Failed to create room: ${error.message}`);
            return null;
        }
    },
    
    /**
     * Update room and timers
     */
    async updateRoom(roomId, name, timers) {
        try {
            const room = await APIClient.updateRoom(roomId, name, timers);
            StateManager.setCurrentRoom(room);
            this.renderTimerList(room.timers);
            this.showSuccess('Room updated successfully.');
            
            // Broadcast room update to other clients
            await APIClient.broadcastEvent(roomId, 'ROOM_UPDATED', {
                room,
                updatedAt: new Date().toISOString()
            });
            
            return room;
        } catch (error) {
            console.error('[RoomManager] Error updating room:', error);
            this.showError(`Failed to update room: ${error.message}`);
            return null;
        }
    },
    
    /**
     * Delete room
     */
    async deleteRoom(roomId) {
        try {
            const confirmed = await ControlDashboard.showConfirm('Delete Room', 'Are you sure you want to delete this room and all its timers?', true);
            if (!confirmed) {
                return false;
            }
            
            await APIClient.deleteRoom(roomId);
            
            // Reload rooms list
            await this.loadRooms();
            
            // Unsubscribe from room
            PusherManager.unsubscribeFromRoom();
            StateManager.setCurrentRoom(null);
            
            this.showSuccess('Room deleted successfully.');
            return true;
        } catch (error) {
            console.error('[RoomManager] Error deleting room:', error);
            this.showError(`Failed to delete room: ${error.message}`);
            return false;
        }
    },
    
    /**
     * Populate room selector dropdown
     */
    populateRoomSelector(rooms) {
        const selector = document.getElementById('room-selector');
        if (!selector) return;
        
        // Keep the default option
        selector.innerHTML = '<option value="">-- Select Room --</option>';
        
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            selector.appendChild(option);
        });
        
        // Add change listener
        selector.addEventListener('change', async (e) => {
            const roomId = e.target.value;
            if (roomId) {
                await this.loadRoom(roomId);
            }
        });
    },
    
    /**
     * Render timers in the new professional card layout
     */
    renderTimerList(timers) {
        const timerList = document.getElementById('timer-list');
        if (!timerList) return;

        if (!timers || timers.length === 0) {
            timerList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    No timers yet. Click "+ Add Timer" to create one.
                </div>
            `;
            return;
        }

        const activeIndex = StateManager.state.currentTimerIndex || 0;

        timerList.innerHTML = timers.map((timer, index) => {
            const dur = timer.duration_seconds || 600;
            const h = Math.floor(dur / 3600);
            const m = Math.floor((dur % 3600) / 60);
            const s = dur % 60;
            const durStr = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
            const isActive = index === activeIndex;
            const appearance = timer.appearance || 'countdown';
            const startTime = ControlDashboard.calculateStartTime(index);
            const title = this.escapeHtml(timer.title || 'Untitled');

            return `
                <div class="timer-card ${isActive ? 'active' : ''}" data-timer-index="${index}">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <input type="checkbox" class="tc-checkbox" data-sel-index="${index}">
                        <span class="tc-drag drag-handle"><i class="fas fa-grip-lines"></i></span>
                        <span class="tc-number">${isActive ? '' : index + 1}</span>
                    </div>
                    ${isActive ? '<div style="font-size:.6rem;color:#7ba3ff;text-align:center;"><div style="font-size:.55rem;color:#5580cc;">Start</div>' + this.escapeHtml(startTime) + '</div>' : '<div class="tc-start-time" data-start-click="' + index + '">' + this.escapeHtml(startTime) + '</div>'}
                    <div class="tc-duration" data-dur-click="${index}">${durStr}</div>
                    <div class="tc-info">
                        <div class="tc-title-row">
                            <span class="tc-title">${title}</span>
                            <button class="tc-edit-btn" data-edit-title="${index}" title="Edit title"><i class="fas fa-pen"></i></button>
                        </div>
                        <span class="tc-type" data-type-click="${index}">${this.escapeHtml(appearance.charAt(0).toUpperCase() + appearance.slice(1))} &#9662;</span>
                    </div>
                    <div class="tc-controls">
                        <button class="tc-ctrl-btn" data-reset-timer="${index}" title="Reset"><i class="fas fa-${isActive ? 'step-backward' : 'hourglass-start'}"></i></button>
                        <button class="tc-ctrl-btn" data-open-settings="${index}" title="Settings"><i class="fas fa-cog"></i></button>
                        <button class="tc-ctrl-btn play-green" data-play-timer="${index}" title="Play"><i class="fas fa-play"></i></button>
                        <button class="tc-ctrl-btn" data-ctx="${index}" title="More"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events on timer cards
        this._bindTimerCardEvents(timerList);

        // Setup sortable drag-and-drop
        if (typeof SortableHandler !== 'undefined' && SortableHandler.initialize) {
            SortableHandler.initialize(timerList, (oldIdx, newIdx) => {
                const moved = StateManager.state.timers.splice(oldIdx, 1)[0];
                StateManager.state.timers.splice(newIdx, 0, moved);
                this.renderTimerList(StateManager.state.timers);
            });
        }
    },

    /**
     * Bind events to timer card elements
     */
    _bindTimerCardEvents(container) {
        // Click to select timer
        container.querySelectorAll('.timer-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.tc-start-time') || e.target.closest('.tc-duration')) return;
                const idx = parseInt(card.dataset.timerIndex, 10);
                this.selectTimer(idx);
            });
        });

        // Play button
        container.querySelectorAll('[data-play-timer]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.playTimer, 10);
                StateManager.state.currentTimerIndex = idx;
                TimerEngine.start(idx);
                this.renderTimerList(StateManager.state.timers);
            });
        });

        // Reset button
        container.querySelectorAll('[data-reset-timer]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.resetTimer, 10);
                StateManager.state.currentTimerIndex = idx;
                TimerEngine.reset();
            });
        });

        // Settings button
        container.querySelectorAll('[data-open-settings]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.openSettings, 10);
                ControlDashboard.openSettingsModal(idx);
            });
        });

        // 3-dot context menu
        container.querySelectorAll('[data-ctx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.ctx, 10);
                ControlDashboard.showContextMenu(e, idx);
            });
        });

        // Edit title inline
        container.querySelectorAll('[data-edit-title]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.editTitle, 10);
                const timer = StateManager.state.timers[idx];
                if (!timer) return;
                const newTitle = await ControlDashboard.showPrompt('Edit Timer Title', '', timer.title, 'Timer title');
                if (newTitle !== null && newTitle.trim()) {
                    timer.title = newTitle.trim();
                    this.renderTimerList(StateManager.state.timers);
                }
            });
        });

        // Start time popover
        container.querySelectorAll('[data-start-click]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(el.dataset.startClick, 10);
                ControlDashboard.showStartPopover(e, idx);
            });
        });

        // Duration popover
        container.querySelectorAll('[data-dur-click]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(el.dataset.durClick, 10);
                ControlDashboard.showDurationPopover(e, idx);
            });
        });

        // Checkbox for selection mode
        container.querySelectorAll('.tc-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(cb.dataset.selIndex, 10);
                if (cb.checked) ControlDashboard.selectedTimers.add(idx);
                else ControlDashboard.selectedTimers.delete(idx);
                ControlDashboard.updateSelectionInfo();
            });
        });
    },
    
    /**
     * Select timer in list
     */
    selectTimer(timerIndex) {
        const cards = document.querySelectorAll('.timer-card');
        cards.forEach(card => card.classList.remove('active'));

        if (cards[timerIndex]) {
            cards[timerIndex].classList.add('active');
        }

        StateManager.state.currentTimerIndex = timerIndex;

        // Update preview display with selected timer's duration (if not running)
        if (!StateManager.state.isRunning) {
            const timer = StateManager.state.timers[timerIndex];
            if (timer) {
                StateManager.state.currentTimerRemainingSeconds = timer.duration_seconds || 0;
                StateManager.state.currentTimerStartTime = null;
                if (typeof ControlDashboard !== 'undefined' && ControlDashboard.updatePreviewDisplay) {
                    ControlDashboard.updatePreviewDisplay(timer.duration_seconds || 0);
                }
            }
        }

        this.renderTimerList(StateManager.state.timers);
    },
    
    /**
     * Handle Pusher events
     */
    handleRoomEvent(action, data) {
        console.log('[RoomManager] Event:', action, data);
        
        switch (action) {
            case 'ROOM_UPDATED':
                // Reload room if updated by another client
                if (StateManager.state.selectedRoomId === data.room.id) {
                    this.loadRoom(data.room.id);
                }
                break;
        }
    },
    
    /**
     * Show error message
     */
    showError(message) {
        console.error('[RoomManager]', message);
        if (typeof ControlDashboard !== 'undefined' && ControlDashboard.showToast) {
            ControlDashboard.showToast(message, 'error');
        }
    },
    
    /**
     * Show success message
     */
    showSuccess(message) {
        console.log('[RoomManager]', message);
        if (typeof ControlDashboard !== 'undefined' && ControlDashboard.showToast) {
            ControlDashboard.showToast(message, 'success');
        }
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make RoomManager globally available
window.RoomManager = RoomManager;

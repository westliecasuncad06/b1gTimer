/**
 * Phase 5 Enhancements Module
 * Integrates all Phase 5 features (Tasks 5.1–5.8) into Control Dashboard
 * 
 * Features:
 * - Task 5.1: Drag-to-Reorder with SortableJS
 * - Task 5.2: Message Formatting Controls
 * - Task 5.3: Blackout & Flash Controls
 * - Task 5.4: Live Preview Window
 * - Task 5.5: Connection Status Indicator  
 * - Task 5.6: Room Save/Load from Database
 * - Task 5.7: Input Validation & Feedback
 * - Task 5.8: Unsaved Changes Warning
 * 
 * Global: window.Phase5Enhancements
 */

window.Phase5Enhancements = (() => {
    let isDirty = false;
    let lastSavedState = null;
    let connectedDisplayCount = 0;

    /**
     * Initialize all Phase 5 enhancements
     */
    const init = async () => {
        console.log('[Phase5Enhancements] Initializing...');
        
        try {
            setupMessageCharCounter();          // Task 5.2
            setupTextAreaValidation();          // Task 5.7
            setupRoomSelector();                // Task 5.6
            setupConnectionStatusIndicator();    // Task 5.5
            setupDirtyTracking();                // Task 5.8
            setupPreviewWindow();                // Task 5.4
            
            // Hook into RoomManager's renderTimerList to add sortable
            const originalRenderTimerList = RoomManager.renderTimerList;
            RoomManager.renderTimerList = function(timers) {
                originalRenderTimerList.call(this, timers);
                setupTimerDragAndDrop();         // Task 5.1
            };
            
            console.log('[Phase5Enhancements] Ready');
        } catch (error) {
            console.error('[Phase5Enhancements] Init error:', error);
        }
    };

    /**
     * Task 5.2: Setup message character counter
     */
    const setupMessageCharCounter = () => {
        const textarea = document.getElementById('message-text');
        const counter = document.getElementById('message-char-count');
        
        if (!textarea || !counter) return;

        const updateCounter = () => {
            const length = textarea.value.length;
            counter.textContent = length;
            
            if (length > ValidationHandler.MESSAGE_TEXT_MAX) {
                counter.style.color = '#ef4444';
                textarea.style.borderColor = '#ef4444';
            } else if (length > ValidationHandler.MESSAGE_TEXT_MAX * 0.8) {
                counter.style.color = '#f59e0b';
                textarea.style.borderColor = '#f59e0b';
            } else {
                counter.style.color = '#9ca3af';
                textarea.style.borderColor = '#d1d5db';
            }
        };

        textarea.addEventListener('input', updateCounter);
        textarea.addEventListener('change', updateCounter);
        updateCounter();
    };

    /**
     * Task 5.7: Setup textarea live validation
     */
    const setupTextAreaValidation = () => {
        const textarea = document.getElementById('message-text');
        if (!textarea) return;

        ValidationHandler.setupLiveValidation(
            textarea,
            (value) => ValidationHandler.validateMessageText(value),
            500
        );

        textarea.addEventListener('blur', () => {
            const result = ValidationHandler.validateMessageText(textarea.value);
            if (!result.valid) {
                ValidationHandler.showError(textarea, result.message);
            }
        });

        textarea.addEventListener('focus', () => {
            ValidationHandler.clearError(textarea);
        });
    };

    /**
     * Task 5.1: Setup timer drag-and-drop with SortableJS
     */
    const setupTimerDragAndDrop = () => {
        const timerList = document.getElementById('timer-list');
        if (!timerList) return;

        const timers = timerList.querySelectorAll('.timer-list-item');
        if (timers.length === 0) return;

        // Add drag handles and keyboard navigation to each timer
        timers.forEach((timerItem, index) => {
            SortableHandler.addDragHandle(timerItem);
            
            // Add keyboard move support
            const moveUpCallback = () => {
                if (index > 0) {
                    const item = timerItem;
                    const prevItem = item.previousElementSibling;
                    prevItem.parentNode.insertBefore(item, prevItem);
                    handleTimerReorder(index, index - 1);
                }
            };
            
            const moveDownCallback = () => {
                if (index < timers.length - 1) {
                    const item = timerItem;
                    const nextItem = item.nextElementSibling;
                    item.parentNode.insertBefore(nextItem, item);
                    handleTimerReorder(index, index + 1);
                }
            };
            
            SortableHandler.addMoveUpButton(timerItem, moveUpCallback);
            SortableHandler.addMoveDownButton(timerItem, moveDownCallback);
        });

        // Initialize SortableJS
        SortableHandler.initialize(timerList, handleTimerReorder);
    };

    /**
     * Handle timer reordering callback
     */
    const handleTimerReorder = (oldIndex, newIndex) => {
        // Update state with new positions
        const timer = StateManager.state.timers[oldIndex];
        StateManager.state.timers.splice(oldIndex, 1);
        StateManager.state.timers.splice(newIndex, 0, timer);

        // Broadcast reorder event
        APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'TIMERS_REORDERED',
            { timers: StateManager.state.timers.map((t, i) => ({ ...t, position: i })) }
        );

        // Mark as dirty
        markDirty();
    };

    /**
     * Task 5.5: Setup connection status indicator
     */
    const setupConnectionStatusIndicator = () => {
        const statusUI = document.getElementById('connection-status-indicator');
        if (!statusUI) return;

        // Listen to Pusher connection changes
        const originalPusherInit = PusherManager.initialize;
        PusherManager.initialize = async function() {
            const result = await originalPusherInit.call(this);
            updateConnectionStatus();
            return result;
        };

        // Track display connections
        StateManager.on('display-connected', () => {
            connectedDisplayCount++;
            updateConnectedDisplayCount();
        });

        StateManager.on('display-disconnected', () => {
            connectedDisplayCount = Math.max(0, connectedDisplayCount - 1);
            updateConnectedDisplayCount();
        });

        updateConnectionStatus();
    };

    /**
     * Update connection status indicator UI
     */
    const updateConnectionStatus = () => {
        const statusUI = document.getElementById('connection-status-indicator');
        if (!statusUI) return;

        const pusherStatus = PusherManager.getStatus();
        const isConnected = pusherStatus?.isConnected ?? false;

        const statusDot = statusUI.querySelector('.status-dot');
        if (statusDot) {
            statusDot.style.background = isConnected ? '#10b981' : '#ef4444';
        }

        const statusText = statusUI.querySelector('span:not(.status-dot)');
        if (statusText) {
            statusText.textContent = isConnected ? 'Connected' : 'Connecting...';
        }
    };

    /**
     * Update connected displays count
     */
    const updateConnectedDisplayCount = () => {
        const displayCount = document.getElementById('display-count');
        if (displayCount) {
            displayCount.textContent = connectedDisplayCount;
            
            // Show warning if no displays
            const container = document.getElementById('connections-display');
            if (container) {
                if (connectedDisplayCount === 0) {
                    container.style.background = '#fee2e2';
                    container.style.borderColor = '#fecaca';
                } else {
                    container.style.background = '#f0fdf4';
                    container.style.borderColor = '#dcfce7';
                }
            }
        }
    };

    /**
     * Task 5.8: Setup dirty state tracking
     */
    const setupDirtyTracking = () => {
        // Track changes to message inputs
        document.getElementById('message-text')?.addEventListener('change', markDirty);
        document.getElementById('message-bold')?.addEventListener('change', markDirty);
        document.getElementById('message-font-size')?.addEventListener('change', markDirty);
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', markDirty);
        });

        // Warn on page leave if dirty
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        });

        // Warn on room change if dirty
        const originalRoomChange = RoomManager.loadRoom;
        RoomManager.loadRoom = async function(roomId) {
            if (isDirty) {
                const confirmed = confirm('You have unsaved changes. Save before switching rooms?');
                if (confirmed) {
                    await ControlDashboard.saveTimers();
                } else if (!confirm('Discard changes and switch rooms anyway?')) {
                    return; // Cancel room change
                }
            }
            return originalRoomChange.call(this, roomId);
        };
    };

    /**
     * Mark state as dirty (unsaved changes)
     */
    const markDirty = () => {
        isDirty = true;
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'inline';
        }
    };

    /**
     * Mark state as clean (saved)
     */
    const markClean = () => {
        isDirty = false;
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    };

    /**
     * Task 5.6: Setup room selector with localStorage persistence
     */
    const setupRoomSelector = () => {
        const selector = document.getElementById('room-selector');
        if (!selector) return;

        // Hook into room change
        selector.addEventListener('change', async (e) => {
            const roomId = parseInt(e.target.value, 10);
            if (!roomId) return;

            // Save selection to localStorage
            localStorage.setItem('lastSelectedRoomId', roomId);

            // Load the room
            await RoomManager.loadRoom(roomId);
        });

        // Restore last selected room on page load
        const lastRoomId = localStorage.getItem('lastSelectedRoomId');
        if (lastRoomId) {
            selector.value = lastRoomId;
            // Trigger load
            setTimeout(() => {
                const event = new Event('change', { bubbles: true });
                selector.dispatchEvent(event);
            }, 500);
        }
    };

    /**
     * Task 5.4: Setup live preview window
     */
    const setupPreviewWindow = () => {
        const previewWindow = document.getElementById('preview-window');
        if (!previewWindow) return;

        // Listen to state changes and update preview
        StateManager.on('timer-updated', (data) => {
            updatePreviewCountdown(data.remainingSeconds);
        });

        StateManager.on('message-shown', (data) => {
            updatePreviewMessage(data.text, data.color, data.bold, data.fontSize);
        });

        StateManager.on('message-hidden', () => {
            clearPreviewMessage();
        });

        StateManager.on('blackout-toggled', (data) => {
            updatePreviewBlackout(data.isBlackedOut);
        });
    };

    /**
     * Update preview countdown display
     */
    const updatePreviewCountdown = (seconds) => {
        const display = document.querySelector('#preview-window div:first-child');
        if (display) {
            const countdownDiv = display.querySelector('div:first-child');
            if (countdownDiv) {
                countdownDiv.textContent = TimerMath.formatTime(seconds);
            }
        }
    };

    /**
     * Update preview message
     */
    const updatePreviewMessage = (text, color, bold, fontSize) => {
        let messageDiv = document.querySelector('#preview-window .preview-message');
        if (!messageDiv) {
            const display = document.querySelector('#preview-window div:first-child');
            messageDiv = document.createElement('div');
            messageDiv.className = 'preview-message';
            display.appendChild(messageDiv);
        }

        messageDiv.textContent = text;
        messageDiv.style.color = color;
        messageDiv.style.fontWeight = bold ? 'bold' : 'normal';
        messageDiv.style.fontSize = fontSize + 'px';
        messageDiv.style.marginTop = '1rem';
    };

    /**
     * Clear preview message
     */
    const clearPreviewMessage = () => {
        const messageDiv = document.querySelector('#preview-window .preview-message');
        if (messageDiv) {
            messageDiv.remove();
        }
    };

    /**
     * Update preview blackout state
     */
    const updatePreviewBlackout = (isBlackedOut) => {
        const previewWindow = document.getElementById('preview-window');
        if (!previewWindow) return;

        if (isBlackedOut) {
            previewWindow.style.opacity = '0.2';
            previewWindow.style.pointerEvents = 'none';
        } else {
            previewWindow.style.opacity = '1';
            previewWindow.style.pointerEvents = 'auto';
        }
    };

    /**
     * Handle save with dirty flag
     */
    const handleSave = async () => {
        try {
            await ControlDashboard.saveTimers();
            markClean();
            lastSavedState = JSON.parse(JSON.stringify(StateManager.state));
        } catch (error) {
            console.error('[Phase5Enhancements] Save error:', error);
        }
    };

    // Hook into ControlDashboard.saveTimers if it exists
    if (window.ControlDashboard && window.ControlDashboard.saveTimers) {
        const originalSaveTimers = window.ControlDashboard.saveTimers;
        window.ControlDashboard.saveTimers = async function() {
            const result = await originalSaveTimers.call(this);
            markClean();
            return result;
        };
    }

    return {
        init,
        markDirty,
        markClean,
        isDirty: () => isDirty,
        updateConnectedDisplayCount,
    };
})();

// Auto-initialize when DOM and dependencies are ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Phase 4 modules to be ready
    setTimeout(() => {
        if (window.SortableHandler && window.ValidationHandler && window.StateManager) {
            Phase5Enhancements.init();
        }
    }, 1000);
});

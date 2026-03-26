/**
 * B1G Timer - Control Dashboard Application
 * Professional dark-themed dashboard with full timer management
 */

const ControlDashboard = {
    // State
    selectMode: false,
    selectedTimers: new Set(),
    messages: [{ id: 1, text: '', color: 'white', bold: false, fontSize: 'normal', visible: false, fontStyle: 'sans-serif', scrollEnabled: false, scrollDirection: 'left', scrollSpeed: 10, msgBgType: 'default', msgBgColor: '#000000' }],
    editingTimerIndex: null,
    activePopover: null,
    blackoutActive: false,

    // ===== TOAST NOTIFICATIONS =====

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    // ===== DIALOG SYSTEM (replaces alert/prompt/confirm) =====

    _dialogResolve: null,

    showDialog({ title, message, input, inputValue, placeholder, confirmText, cancelText, danger }) {
        return new Promise((resolve) => {
            this._dialogResolve = resolve;
            const overlay = document.getElementById('dialog-overlay');
            const titleEl = document.getElementById('dialog-title');
            const bodyEl = document.getElementById('dialog-body');
            const footerEl = document.getElementById('dialog-footer');
            if (!overlay) { resolve(null); return; }

            titleEl.textContent = title || '';
            let bodyHtml = message ? `<div>${this.escapeHtml(message)}</div>` : '';
            if (input) {
                bodyHtml += `<input type="text" id="dialog-input" value="${this.escapeHtml(inputValue || '')}" placeholder="${this.escapeHtml(placeholder || '')}">`;
            }
            bodyEl.innerHTML = bodyHtml;

            let footerHtml = '';
            if (cancelText !== false) {
                footerHtml += `<button class="dialog-btn cancel" id="dialog-cancel-btn">${cancelText || 'Cancel'}</button>`;
            }
            footerHtml += `<button class="dialog-btn ${danger ? 'danger' : 'confirm'}" id="dialog-confirm-btn">${confirmText || 'OK'}</button>`;
            footerEl.innerHTML = footerHtml;

            overlay.classList.add('show');

            const inp = document.getElementById('dialog-input');
            if (inp) { inp.focus(); inp.select(); }

            const confirmBtn = document.getElementById('dialog-confirm-btn');
            const cancelBtn = document.getElementById('dialog-cancel-btn');

            const cleanup = (val) => {
                overlay.classList.remove('show');
                confirmBtn?.removeEventListener('click', onConfirm);
                cancelBtn?.removeEventListener('click', onCancel);
                inp?.removeEventListener('keydown', onKey);
                resolve(val);
            };
            const onConfirm = () => cleanup(input ? (inp?.value ?? '') : true);
            const onCancel = () => cleanup(input ? null : false);
            const onKey = (e) => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); };
            confirmBtn?.addEventListener('click', onConfirm);
            cancelBtn?.addEventListener('click', onCancel);
            inp?.addEventListener('keydown', onKey);
        });
    },

    async showAlert(title, message) {
        return this.showDialog({ title, message, cancelText: false, confirmText: 'OK' });
    },

    async showConfirm(title, message, danger = false) {
        return this.showDialog({ title, message, confirmText: danger ? 'Delete' : 'OK', cancelText: 'Cancel', danger });
    },

    async showPrompt(title, message, inputValue = '', placeholder = '') {
        return this.showDialog({ title, message, input: true, inputValue, placeholder, confirmText: 'OK', cancelText: 'Cancel' });
    },

    /**
     * Initialize dashboard
     */
    async init() {
        console.log('[ControlDashboard] Initializing...');
        try {
            const pusherReady = await PusherManager.initialize();
            if (!pusherReady) {
                console.warn('[ControlDashboard] Pusher not available');
            }
            await RoomManager.loadRooms();

            // Setup event listeners and state listeners BEFORE restore
            // so that timer-started / timer-updated events update the UI immediately
            this.setupEventListeners();
            this.setupStateListeners();

            // Restore last selected room and timer state from localStorage
            const persisted = typeof StateManager.getPersistedTimerState === 'function'
                ? StateManager.getPersistedTimerState() : null;
            if (persisted && persisted.selectedRoomId) {
                const selector = document.getElementById('room-selector');
                if (selector) {
                    selector.value = persisted.selectedRoomId;
                    // restoreMode: true — load room data WITHOUT resetting timer state
                    await RoomManager.loadRoom(persisted.selectedRoomId, { restoreMode: true });
                }
                // If loadRoom failed (API error), fall back to cached timers from localStorage
                if (StateManager.state.timers.length === 0 && persisted.cachedTimers && persisted.cachedTimers.length > 0) {
                    console.log('[ControlDashboard] API unavailable - restoring timers from cache');
                    StateManager.state.timers = persisted.cachedTimers;
                    StateManager.state.selectedRoomId = persisted.selectedRoomId;
                    RoomManager.renderTimerList(StateManager.state.timers);
                }
                // Restore running timer state — PREFER server deadline, fall back to localStorage
                if (persisted.currentTimerIndex != null && StateManager.state.timers.length > persisted.currentTimerIndex) {
                    StateManager.state.currentTimerIndex = persisted.currentTimerIndex;

                    // Try to fetch authoritative state from server first
                    let serverState = null;
                    try {
                        serverState = await APIClient.getState(persisted.selectedRoomId);
                    } catch (e) { /* offline – use localStorage */ }

                    if (serverState && serverState.deadlineTimestamp && serverState.isRunning) {
                        // Server has an active deadline — use it directly.
                        // silent=true: do NOT re-broadcast; the authoritative deadline is already in DB.
                        const deadline = serverState.deadlineTimestamp;
                        const remaining = deadline - Math.floor(Date.now() / 1000);
                        const idx = serverState.timerIndex != null ? serverState.timerIndex : persisted.currentTimerIndex;
                        TimerEngine.start(idx, remaining, deadline, true);
                        console.log('[ControlDashboard] Restored from server deadline, remaining:', remaining.toFixed(1) + 's');
                    } else if (serverState && !serverState.isRunning) {
                        // Server says paused/stopped — but localStorage might have a more recent running state.
                        // Trust localStorage if it has a valid future deadline (written every 100ms by the tick loop).
                        if (persisted.isRunning && persisted.deadlineTimestamp && persisted.deadlineTimestamp > Math.floor(Date.now() / 1000)) {
                            const remaining = persisted.deadlineTimestamp - Math.floor(Date.now() / 1000);
                            TimerEngine.start(persisted.currentTimerIndex, remaining, persisted.deadlineTimestamp, true);
                            console.log('[ControlDashboard] Server stale (!running) but localStorage has future deadline, remaining:', remaining.toFixed(1) + 's');
                        } else if (serverState.remainingSeconds != null) {
                            // Both agree not running — show static remaining
                            const idx = serverState.timerIndex != null ? serverState.timerIndex : persisted.currentTimerIndex;
                            StateManager.state.currentTimerIndex = idx;
                            StateManager.state.currentTimerRemainingSeconds = serverState.remainingSeconds;
                            StateManager.state.currentTimerStartTime = persisted.currentTimerStartTime;
                            StateManager.state.deadlineTimestamp = null;
                            this.updatePreviewDisplay(serverState.remainingSeconds);
                        }
                    } else if (persisted.isRunning && persisted.deadlineTimestamp) {
                        // Offline fallback — use persisted deadline from localStorage (silent)
                        const remaining = persisted.deadlineTimestamp - Math.floor(Date.now() / 1000);
                        TimerEngine.start(persisted.currentTimerIndex, remaining, persisted.deadlineTimestamp, true);
                        console.log('[ControlDashboard] Restored from localStorage deadline, remaining:', remaining.toFixed(1) + 's');
                    } else if (persisted.isRunning && persisted.savedAt) {
                        // Legacy fallback — compute from savedAt (pre-deadline data)
                        const elapsed = (Date.now() - new Date(persisted.savedAt).getTime()) / 1000;
                        const remaining = persisted.currentTimerRemainingSeconds - elapsed;
                        TimerEngine.start(persisted.currentTimerIndex, remaining, null, true);
                        console.log('[ControlDashboard] Restored from legacy savedAt, remaining:', remaining.toFixed(1) + 's');
                    } else if (persisted.currentTimerRemainingSeconds != null) {
                        // Paused state - restore remaining time and display
                        StateManager.state.currentTimerRemainingSeconds = persisted.currentTimerRemainingSeconds;
                        StateManager.state.currentTimerStartTime = persisted.currentTimerStartTime;
                        StateManager.state.deadlineTimestamp = null;
                        this.updatePreviewDisplay(persisted.currentTimerRemainingSeconds);
                    }
                    // Re-render timer list with correct active timer highlighted
                    RoomManager.renderTimerList(StateManager.state.timers);
                }
            }

            // Restore stage style from persisted state
            if (persisted && persisted.stageStyle) {
                StateManager.state.stageStyle = persisted.stageStyle;
                const timerColorEl = document.getElementById('stage-timer-color');
                const clockColorEl = document.getElementById('stage-clock-color');
                const timerFontEl = document.getElementById('stage-timer-font');
                const timerFontSizeEl = document.getElementById('stage-timer-font-size');
                const clockFontEl = document.getElementById('stage-clock-font');
                const clockFontSizeEl = document.getElementById('stage-clock-font-size');
                const bgColorEl = document.getElementById('stage-bg-color');
                if (timerColorEl && persisted.stageStyle.timerColor) timerColorEl.value = persisted.stageStyle.timerColor;
                if (clockColorEl && persisted.stageStyle.clockColor) clockColorEl.value = persisted.stageStyle.clockColor;
                if (timerFontEl && persisted.stageStyle.timerFont) timerFontEl.value = persisted.stageStyle.timerFont;
                if (timerFontSizeEl && persisted.stageStyle.timerFontSize) timerFontSizeEl.value = persisted.stageStyle.timerFontSize;
                if (clockFontEl && persisted.stageStyle.clockFont) clockFontEl.value = persisted.stageStyle.clockFont;
                if (clockFontSizeEl && persisted.stageStyle.clockFontSize) clockFontSizeEl.value = persisted.stageStyle.clockFontSize;
                if (bgColorEl && persisted.stageStyle.bgColor) bgColorEl.value = persisted.stageStyle.bgColor;
            }

            this.loadMessages();
            this.startTimeDisplay();
            this.startHealthCheck();
            this.renderMessages();
            this.updateTimezone();
            console.log('[ControlDashboard] Ready');
        } catch (error) {
            console.error('[ControlDashboard] Init error:', error);
        }
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Transport controls
        this.on('#btn-play-pause', 'click', () => this.togglePlayPause());
        this.on('#btn-reset', 'click', () => TimerEngine.reset());
        this.onAll('[data-action="previous-timer"]', 'click', () => TimerEngine.skipToPrevious());
        this.onAll('[data-action="next-timer"]', 'click', () => TimerEngine.skipToNext());
        this.onAll('[data-action="adjust-time"]', 'click', (e) => {
            const btn = e.currentTarget;
            const adj = parseInt(btn.dataset.adjust, 10);
            TimerEngine.adjustTime(adj);
        });

        // Timeline scrubber on progress bar
        this.setupScrubber();

        // Blackout / Flash
        this.on('#btn-blackout', 'click', () => this.toggleBlackout());
        this.on('#btn-flash', 'click', () => this.flashDisplay());

        // Timer management
        this.on('#btn-add-timer', 'click', () => this.addTimer());
        this.on('#btn-save', 'click', () => this.saveTimers());

        // Room
        this.on('#btn-create-room', 'click', () => this.createRoom());
        this.on('#btn-delete-room', 'click', () => this.deleteRoom());

        // Select mode
        this.on('#btn-select-mode', 'click', () => this.toggleSelectMode());
        this.on('#sel-close-btn', 'click', () => this.toggleSelectMode(false));
        this.on('#sel-all-check', 'change', (e) => this.selectAll(e.target.checked));
        this.on('#sel-delete-btn', 'click', () => this.deleteSelected());
        this.on('#sel-duplicate-btn', 'click', () => this.duplicateSelected());

        // Settings modal
        this.on('#settings-modal-close', 'click', () => this.closeSettingsModal());
        this.on('#settings-cancel', 'click', () => this.closeSettingsModal());
        this.on('#settings-confirm', 'click', () => this.saveSettings());

        // Output links
        // Dashboard naming
        this.on('#btn-edit-dashboard-name', 'click', () => this.renameDashboard());
        this.on('#dashboard-title', 'dblclick', () => this.renameDashboard());
        this.restoreDashboardName();

        this.on('#btn-output-links', 'click', () => this.showOutputLinks());
        this.on('#output-modal-close', 'click', () => this.closeOutputLinks());
        this.on('#copy-stage-link', 'click', () => this.copyStageLink());

        // Open stage display
        this.on('#btn-open-stage', 'click', () => {
            const roomId = StateManager.state.selectedRoomId || 1;
            window.open('stage.html?room=' + roomId, '_blank');
        });

        // Stage style controls
        this.on('#btn-toggle-stage-style', 'click', () => {
            const panel = document.getElementById('stage-style-panel');
            if (panel) panel.classList.toggle('show');
        });
        this.on('#stage-style-apply', 'click', () => this.applyStageStyle());
        this.on('#stage-timer-color-reset', 'click', () => {
            const el = document.getElementById('stage-timer-color');
            if (el) el.value = '#ffffff';
        });
        this.on('#stage-clock-color-reset', 'click', () => {
            const el = document.getElementById('stage-clock-color');
            if (el) el.value = '#808080';
        });
        this.on('#stage-bg-color-reset', 'click', () => {
            const el = document.getElementById('stage-bg-color');
            if (el) el.value = '#000000';
        });
        this.on('#stage-timer-font-reset', 'click', () => {
            const fontEl = document.getElementById('stage-timer-font');
            const sizeEl = document.getElementById('stage-timer-font-size');
            if (fontEl) fontEl.value = "'Courier New', monospace";
            if (sizeEl) sizeEl.value = '22';
        });
        this.on('#stage-clock-font-reset', 'click', () => {
            const fontEl = document.getElementById('stage-clock-font');
            const sizeEl = document.getElementById('stage-clock-font-size');
            if (fontEl) fontEl.value = "'Courier New', monospace";
            if (sizeEl) sizeEl.value = '6';
        });
        this.on('#stage-style-reset-all', 'click', () => {
            const defaults = {
                'stage-timer-color': '#ffffff',
                'stage-clock-color': '#808080',
                'stage-bg-color': '#000000',
                'stage-timer-font': "'Courier New', monospace",
                'stage-timer-font-size': '22',
                'stage-clock-font': "'Courier New', monospace",
                'stage-clock-font-size': '6'
            };
            Object.entries(defaults).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            });
            this.showToast('All stage settings reset to defaults.', 'info');
        });

        // Popovers - cancel buttons
        this.on('#pop-start-cancel', 'click', () => this.closePopovers());
        this.on('#pop-dur-cancel', 'click', () => this.closePopovers());
        this.on('#pop-start-save', 'click', () => this.saveStartPopover());
        this.on('#pop-dur-save', 'click', () => this.saveDurationPopover());

        // Messages
        this.on('#btn-add-message', 'click', () => this.addMessage());
        this.on('#btn-msg-focus', 'click', () => this.toggleMsgFocus());
        this.on('#btn-msg-flash', 'click', () => this.flashMessage());

        // Context menu - close on outside click
        document.addEventListener('click', (e) => {
            const ctx = document.getElementById('timer-ctx-menu');
            if (ctx && !ctx.contains(e.target) && !e.target.closest('.tc-ctrl-btn[data-ctx]')) {
                ctx.classList.remove('show');
            }
            // Close popovers on outside click
            if (this.activePopover && !e.target.closest('.popover') && !e.target.closest('.tc-start-time') && !e.target.closest('.tc-duration')) {
                this.closePopovers();
            }
            // Close "Add time" popups on outside click
            if (!e.target.closest('.tc-add-time-wrap')) {
                document.querySelectorAll('.tc-add-popup.show').forEach(p => p.classList.remove('show'));
            }
        });

        // Context menu actions
        this.on('#ctx-delete', 'click', () => this.ctxDelete());
        this.on('#ctx-clone', 'click', () => this.ctxClone());

        // Settings modal - update hints on duration changes
        ['setting-dur-h', 'setting-dur-m', 'setting-dur-s'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateDurationHint());
        });

        // Popover - update hints on duration changes
        ['pop-dur-h', 'pop-dur-m', 'pop-dur-s'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updatePopoverDurationHint());
        });
    },

    /**
     * Helper: attach event listener
     */
    on(selector, event, handler) {
        const el = document.querySelector(selector);
        if (el) el.addEventListener(event, handler);
    },

    /**
     * Helper: attach event listener to all matching elements
     */
    onAll(selector, event, handler) {
        document.querySelectorAll(selector).forEach(el => el.addEventListener(event, handler));
    },

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        StateManager.on('timer-updated', (data) => {
            this.updatePreviewDisplay(data.remainingSeconds);
        });
        StateManager.on('timer-started', () => {
            this.updatePlayButton(true);
            this.updateActiveTimerCard();
        });
        StateManager.on('timer-stopped', () => {
            this.updatePlayButton(false);
            this.updateActiveTimerCard();
        });
        StateManager.on('timer-list-changed', () => {
            // Timer list is rendered by RoomManager.renderTimerList
        });
        StateManager.on('blackout-toggled', (data) => {
            this.updateBlackoutUI(data.isBlackedOut);
        });
    },

    // ===== TIMER LIST RENDERING =====

    /**
     * Calculate start time for a timer based on position
     */
    calculateStartTime(timerIndex) {
        const timers = StateManager.state.timers;
        if (!timers || !timers[timerIndex]) return '--:-- --';

        let accumulatedSeconds = 0;
        for (let i = 0; i < timerIndex; i++) {
            accumulatedSeconds += (timers[i].duration_seconds || 600);
        }

        const now = new Date();
        const startDate = new Date(now.getTime() + accumulatedSeconds * 1000);

        const h = startDate.getHours();
        const m = String(startDate.getMinutes()).padStart(2, '0');
        const s = String(startDate.getSeconds()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${m}:${s} ${ampm}`;
    },

    /**
     * Format seconds to HH:MM:SS
     */
    formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    },

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ===== PREVIEW DISPLAY =====

    updatePreviewDisplay(remainingSeconds) {
        const countdown = document.getElementById('preview-countdown');
        if (!countdown) return;

        const isNegative = remainingSeconds < 0;
        const absSeconds = Math.abs(remainingSeconds);
        const totalSec = Math.ceil(absSeconds);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        const prefix = isNegative ? '-' : '';

        // Smart format: only show hours when > 0
        if (hours > 0) {
            countdown.innerHTML = `<span class="hr">${prefix}${hours}</span><span class="colon">:</span><span class="min">${String(minutes).padStart(2, '0')}</span><span class="colon">:</span><span class="sec">${String(seconds).padStart(2, '0')}</span>`;
        } else {
            countdown.innerHTML = `<span class="min">${prefix}${minutes}</span><span class="colon">:</span><span class="sec">${String(seconds).padStart(2, '0')}</span>`;
        }

        // Red color when negative (overtime)
        countdown.style.color = isNegative ? '#ef4444' : '';

        // Update ON AIR time with smart format
        const onAirTime = document.getElementById('on-air-time');
        if (onAirTime) {
            const tenths = Math.floor((absSeconds % 1) * 10);
            if (hours > 0) {
                onAirTime.textContent = `${prefix}${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
            } else {
                onAirTime.textContent = `${prefix}${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
            }
        }

        // Progress bar
        const currentTimer = StateManager.state.timers[StateManager.state.currentTimerIndex];
        if (currentTimer) {
            const duration = currentTimer.duration_seconds;
            const progress = duration > 0 ? (remainingSeconds / duration) * 100 : 0;
            const progressBar = document.getElementById('preview-progress-bar');
            if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, progress)) + '%';

            // Color states
            const pct = progress / 100;
            const onAirBadge = document.getElementById('on-air-badge');
            const onAirDot = document.getElementById('on-air-dot');
            const previewDisplay = document.getElementById('preview-display');

            if (pct <= 0.025) {
                // Danger - at zero
                if (onAirBadge) { onAirBadge.className = 'on-air-badge danger'; }
                if (onAirDot) { onAirDot.className = 'on-air-dot red'; }
                if (onAirTime) { onAirTime.style.color = '#ef4444'; }
            } else if (pct <= 0.1) {
                // Red zone
                if (onAirBadge) { onAirBadge.className = 'on-air-badge danger'; }
                if (onAirDot) { onAirDot.className = 'on-air-dot red'; }
                if (onAirTime) { onAirTime.style.color = '#ef4444'; }
            } else {
                if (onAirBadge) { onAirBadge.className = 'on-air-badge'; }
                if (onAirDot) { onAirDot.className = 'on-air-dot green'; }
                if (onAirTime) { onAirTime.style.color = '#ccc'; }
            }

            // Update timer name in preview
            const timerName = document.getElementById('preview-timer-name');
            if (timerName) timerName.textContent = currentTimer.title || 'Timer';

            // Update cue finish
            if (StateManager.state.currentTimerStartTime) {
                const finishTime = TimerMath.calculateFinishTime(
                    StateManager.state.currentTimerStartTime,
                    remainingSeconds
                );
                const cueEl = document.getElementById('cue-finish-display');
                if (cueEl) cueEl.textContent = finishTime;
            }

            // Update time markers based on current timer duration
            this.updateTimeMarkers(duration);

            // Update active timer card danger state
            this.updateTimerCardDanger(pct);
        }
    },

    updateTimeMarkers(duration) {
        const markers = document.getElementById('time-markers');
        if (!markers) return;
        const d = duration;
        const q1 = this.formatDuration(d);
        const q2 = this.formatDuration(Math.floor(d * 0.75));
        const q3 = this.formatDuration(Math.floor(d * 0.5));
        const q4 = this.formatDuration(Math.floor(d * 0.25));
        markers.innerHTML = `<span>${q1}</span><span>${q2}</span><span>${q3}</span><span>${q4}</span>`;
    },

    updateTimerCardDanger(pct) {
        const cards = document.querySelectorAll('.timer-card');
        const activeIndex = StateManager.state.currentTimerIndex;
        cards.forEach((card, i) => {
            if (i === activeIndex && StateManager.state.isRunning && pct <= 0.1) {
                card.classList.add('running-danger');
            } else {
                card.classList.remove('running-danger');
            }
        });
    },

    updateActiveTimerCard() {
        const cards = document.querySelectorAll('.timer-card');
        const activeIndex = StateManager.state.currentTimerIndex;
        const isRunning = StateManager.state.isRunning;
        cards.forEach((card, i) => {
            const isActive = i === activeIndex;
            card.classList.toggle('active', isActive);
            // Update play/pause toggle button icon
            const toggleBtn = card.querySelector('[data-toggle-timer]');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    if (isActive) {
                        icon.className = isRunning ? 'fas fa-pause' : 'fas fa-play';
                        toggleBtn.classList.toggle('play-green', isRunning);
                    } else {
                        icon.className = 'fas fa-hourglass-start';
                        toggleBtn.classList.remove('play-green');
                    }
                }
            }
        });
    },

    // ===== TIMELINE SCRUBBER =====

    setupScrubber() {
        const wrap = document.getElementById('preview-progress-wrap');
        const hoverLine = document.getElementById('scrub-hover-line');
        const tooltip = document.getElementById('scrub-tooltip');
        if (!wrap || !hoverLine || !tooltip) return;

        wrap.addEventListener('mousemove', (e) => {
            const currentTimer = StateManager.state.timers[StateManager.state.currentTimerIndex];
            if (!currentTimer) return;
            const rect = wrap.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const pct = x / rect.width;
            const duration = currentTimer.duration_seconds;
            const timeAtPos = Math.round(pct * duration);

            hoverLine.style.left = x + 'px';
            hoverLine.style.display = 'block';
            tooltip.textContent = this.formatDuration(timeAtPos);
            tooltip.style.left = x + 'px';
            tooltip.style.display = 'block';
        });

        wrap.addEventListener('mouseleave', () => {
            hoverLine.style.display = 'none';
            tooltip.style.display = 'none';
        });

        wrap.addEventListener('click', (e) => {
            const currentTimer = StateManager.state.timers[StateManager.state.currentTimerIndex];
            if (!currentTimer) return;
            const rect = wrap.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            const pct = x / rect.width;
            const duration = currentTimer.duration_seconds;
            const targetRemaining = Math.round(pct * duration);
            const current = StateManager.state.currentTimerRemainingSeconds;
            const delta = targetRemaining - current;
            if (delta !== 0) {
                TimerEngine.adjustTime(delta);
            }
        });
    },

    // ===== PLAY / PAUSE =====

    togglePlayPause() {
        if (StateManager.state.isRunning) {
            TimerEngine.pause();
        } else {
            if (!StateManager.state.currentTimerStartTime) {
                const idx = StateManager.state.currentTimerIndex || 0;
                TimerEngine.start(idx);
            } else {
                TimerEngine.resume();
            }
        }
    },

    async renameDashboard() {
        const titleEl = document.getElementById('dashboard-title');
        const currentName = titleEl ? titleEl.textContent : 'Dashboard';
        const newName = await this.showPrompt('Rename Dashboard', 'Enter a name for this dashboard:', currentName, 'Dashboard name');
        if (newName !== null && newName.trim()) {
            const name = newName.trim();
            if (titleEl) titleEl.textContent = name;
            const roomId = StateManager.state.selectedRoomId;
            if (roomId) {
                try {
                    await APIClient.updateDashboardName(roomId, name);
                    // Update local room data
                    if (StateManager.state.currentRoom) {
                        StateManager.state.currentRoom.dashboard_name = name;
                    }
                } catch (e) {
                    console.warn('[ControlDashboard] Failed to save dashboard name to DB:', e.message);
                }
            }
            this.showToast('Dashboard name saved!', 'success');
        }
    },

    restoreDashboardName() {
        const roomId = StateManager.state.selectedRoomId;
        const titleEl = document.getElementById('dashboard-title');
        if (!titleEl) return;
        if (roomId && StateManager.state.currentRoom && StateManager.state.currentRoom.dashboard_name) {
            titleEl.textContent = StateManager.state.currentRoom.dashboard_name;
        } else {
            titleEl.textContent = 'Dashboard';
        }
    },

    updatePlayButton(isRunning) {
        const btn = document.getElementById('btn-play-pause');
        if (!btn) return;
        if (isRunning) {
            btn.innerHTML = '<i class="fas fa-pause"></i>';
            btn.classList.add('running');
        } else {
            btn.innerHTML = '<i class="fas fa-play"></i>';
            btn.classList.remove('running');
        }
        // Also sync the per-card toggle button
        this.updateActiveTimerCard();
    },

    // ===== BLACKOUT / FLASH =====

    async toggleBlackout() {
        this.blackoutActive = !this.blackoutActive;
        StateManager.setBlackedOut(this.blackoutActive);
        await APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            this.blackoutActive ? 'BLACKOUT_ON' : 'BLACKOUT_OFF',
            {}
        ).catch(() => {});
    },

    updateBlackoutUI(isBlackedOut) {
        const btn = document.getElementById('btn-blackout');
        if (btn) btn.classList.toggle('active', isBlackedOut);
    },

    async flashDisplay() {
        const btn = document.getElementById('btn-flash');
        if (btn) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 300);
        }
        await APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'FLASH_TRIGGER',
            {}
        ).catch(() => {});
    },

    // ===== STAGE STYLE =====

    async applyStageStyle() {
        const timerColor = document.getElementById('stage-timer-color')?.value || '#ffffff';
        const clockColor = document.getElementById('stage-clock-color')?.value || '#808080';
        const timerFont = document.getElementById('stage-timer-font')?.value || "'Courier New', monospace";
        const timerFontSize = parseFloat(document.getElementById('stage-timer-font-size')?.value) || 22;
        const clockFont = document.getElementById('stage-clock-font')?.value || "'Courier New', monospace";
        const clockFontSize = parseFloat(document.getElementById('stage-clock-font-size')?.value) || 6;
        const bgColor = document.getElementById('stage-bg-color')?.value || '#000000';
        
        const stageStyle = { timerColor, clockColor, timerFont, timerFontSize, clockFont, clockFontSize, bgColor };
        StateManager.state.stageStyle = stageStyle;
        if (typeof StateManager.persistTimerState === 'function') {
            StateManager.persistTimerState();
        }
        
        await APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'STAGE_STYLE_UPDATE',
            stageStyle
        ).catch(() => {});
        
        this.showToast('Stage style applied!', 'success');
    },

    // ===== CREATE ROOM =====

    async createRoom() {
        const name = await this.showPrompt('Create Room', 'Enter room name:', '', 'Room name');
        if (!name || !name.trim()) return;
        await RoomManager.createRoom(name.trim());
    },

    async deleteRoom() {
        const roomId = StateManager.state.selectedRoomId;
        if (!roomId) {
            this.showAlert('No Room Selected', 'Please select a room first.');
            return;
        }
        await RoomManager.deleteRoom(roomId);
        // Reset preview after deletion
        this.updatePreviewDisplay(0);
        this.updatePlayButton(false);
    },

    // ===== ADD TIMER =====

    addTimer() {
        if (!StateManager.state.selectedRoomId) {
            this.showAlert('No Room Selected', 'Please select or create a room first.');
            return;
        }
        const newTimer = {
            id: null,
            title: `Timer ${StateManager.state.timers.length + 1}`,
            duration_seconds: 600,
            position: StateManager.state.timers.length,
            speaker: '',
            notes: '',
            appearance: 'countdown',
            start_type: 'manual',
            wrap_yellow_m: 1,
            wrap_yellow_s: 0,
            wrap_red_m: 0,
            wrap_red_s: 15
        };
        StateManager.state.timers.push(newTimer);
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    // ===== SAVE =====

    async saveTimers() {
        const roomId = StateManager.state.selectedRoomId;
        if (!roomId) { this.showAlert('No Room Selected', 'Select a room first.'); return; }
        const roomName = StateManager.state.currentRoom?.name || 'Room';
        const timers = StateManager.state.timers.map((t, i) => ({
            id: t.id,
            title: t.title,
            duration_seconds: t.duration_seconds,
            position: i
        }));
        const result = await RoomManager.updateRoom(roomId, roomName, timers);
        if (result) {
            this.showToast('Timers saved successfully!', 'success');
        }
    },

    // ===== SELECT MODE =====

    toggleSelectMode(force) {
        this.selectMode = force !== undefined ? force : !this.selectMode;
        this.selectedTimers.clear();

        const toolbar = document.getElementById('selection-toolbar');
        if (toolbar) toolbar.classList.toggle('active', this.selectMode);

        document.querySelectorAll('.timer-card').forEach(card => {
            card.classList.toggle('select-mode', this.selectMode);
            const cb = card.querySelector('.tc-checkbox');
            if (cb) cb.checked = false;
        });
        this.updateSelectionInfo();
    },

    selectAll(checked) {
        document.querySelectorAll('.timer-card .tc-checkbox').forEach((cb, i) => {
            cb.checked = checked;
            if (checked) this.selectedTimers.add(i);
            else this.selectedTimers.delete(i);
        });
        this.updateSelectionInfo();
    },

    updateSelectionInfo() {
        const info = document.getElementById('sel-info');
        if (info) {
            info.textContent = `${this.selectedTimers.size} of ${StateManager.state.timers.length} selected`;
        }
    },

    async deleteSelected() {
        if (this.selectedTimers.size === 0) return;
        const confirmed = await this.showConfirm('Delete Timers', `Delete ${this.selectedTimers.size} timer(s)?`, true);
        if (!confirmed) return;
        const indices = Array.from(this.selectedTimers).sort((a, b) => b - a);
        indices.forEach(i => StateManager.state.timers.splice(i, 1));
        this.selectedTimers.clear();
        this.toggleSelectMode(false);
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    duplicateSelected() {
        if (this.selectedTimers.size === 0) return;
        const indices = Array.from(this.selectedTimers).sort((a, b) => a - b);
        const clones = indices.map(i => ({
            ...StateManager.state.timers[i],
            id: null,
            title: StateManager.state.timers[i].title + ' (copy)'
        }));
        StateManager.state.timers.push(...clones);
        this.toggleSelectMode(false);
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    // ===== CONTEXT MENU (3-dot) =====

    showContextMenu(event, timerIndex) {
        event.stopPropagation();
        this.editingTimerIndex = timerIndex;
        const ctx = document.getElementById('timer-ctx-menu');
        if (!ctx) return;

        const rect = event.currentTarget.getBoundingClientRect();
        ctx.style.left = rect.left + 'px';
        ctx.style.top = (rect.bottom + 4) + 'px';
        ctx.classList.add('show');
    },

    ctxDelete() {
        if (this.editingTimerIndex === null) return;
        StateManager.state.timers.splice(this.editingTimerIndex, 1);
        RoomManager.renderTimerList(StateManager.state.timers);
        document.getElementById('timer-ctx-menu')?.classList.remove('show');
    },

    ctxClone() {
        if (this.editingTimerIndex === null) return;
        const orig = StateManager.state.timers[this.editingTimerIndex];
        const clone = { ...orig, id: null, title: orig.title + ' (copy)' };
        StateManager.state.timers.splice(this.editingTimerIndex + 1, 0, clone);
        RoomManager.renderTimerList(StateManager.state.timers);
        document.getElementById('timer-ctx-menu')?.classList.remove('show');
    },

    // ===== SETTINGS MODAL =====

    openSettingsModal(timerIndex) {
        this.editingTimerIndex = timerIndex;
        const timer = StateManager.state.timers[timerIndex];
        if (!timer) return;

        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // Populate fields
        document.getElementById('settings-modal-title').textContent =
            `Settings for Timer ${timerIndex + 1} \u00BB${this.escapeHtml(timer.title)}\u00AB`;
        document.getElementById('setting-title').value = timer.title || '';
        document.getElementById('setting-speaker').value = timer.speaker || '';
        document.getElementById('setting-notes').value = timer.notes || '';
        document.getElementById('setting-start-type').value = timer.start_type || 'manual';
        document.getElementById('setting-start-time').value = timer.start_time || '';
        document.getElementById('setting-start-date').value = timer.start_date || '';

        const dur = timer.duration_seconds || 600;
        document.getElementById('setting-dur-h').value = String(Math.floor(dur / 3600)).padStart(2, '0');
        document.getElementById('setting-dur-m').value = String(Math.floor((dur % 3600) / 60)).padStart(2, '0');
        document.getElementById('setting-dur-s').value = String(dur % 60).padStart(2, '0');

        document.getElementById('setting-appearance').value = timer.appearance || 'countdown';
        document.getElementById('setting-yellow-m').value = timer.wrap_yellow_m ?? 1;
        document.getElementById('setting-yellow-s').value = timer.wrap_yellow_s ?? 0;
        document.getElementById('setting-red-m').value = timer.wrap_red_m ?? 0;
        document.getElementById('setting-red-s').value = timer.wrap_red_s ?? 15;

        this.updateDurationHint();
        modal.classList.add('show');
    },

    closeSettingsModal() {
        document.getElementById('settings-modal')?.classList.remove('show');
        this.editingTimerIndex = null;
    },

    saveSettings() {
        if (this.editingTimerIndex === null) return;
        const timer = StateManager.state.timers[this.editingTimerIndex];
        if (!timer) return;

        timer.title = document.getElementById('setting-title').value.trim() || 'Untitled';
        timer.speaker = document.getElementById('setting-speaker').value.trim();
        timer.notes = document.getElementById('setting-notes').value.trim();
        timer.start_type = document.getElementById('setting-start-type').value;
        timer.start_time = document.getElementById('setting-start-time').value;
        timer.start_date = document.getElementById('setting-start-date').value;
        timer.appearance = document.getElementById('setting-appearance').value;

        const h = parseInt(document.getElementById('setting-dur-h').value, 10) || 0;
        const m = parseInt(document.getElementById('setting-dur-m').value, 10) || 0;
        const s = parseInt(document.getElementById('setting-dur-s').value, 10) || 0;
        timer.duration_seconds = h * 3600 + m * 60 + s;

        timer.wrap_yellow_m = parseInt(document.getElementById('setting-yellow-m').value, 10) || 0;
        timer.wrap_yellow_s = parseInt(document.getElementById('setting-yellow-s').value, 10) || 0;
        timer.wrap_red_m = parseInt(document.getElementById('setting-red-m').value, 10) || 0;
        timer.wrap_red_s = parseInt(document.getElementById('setting-red-s').value, 10) || 0;

        this.closeSettingsModal();
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    updateDurationHint() {
        const h = parseInt(document.getElementById('setting-dur-h')?.value, 10) || 0;
        const m = parseInt(document.getElementById('setting-dur-m')?.value, 10) || 0;
        const s = parseInt(document.getElementById('setting-dur-s')?.value, 10) || 0;
        const total = h * 3600 + m * 60 + s;
        const hint = document.getElementById('setting-duration-hint');
        if (hint) {
            const mins = Math.floor(total / 60);
            hint.textContent = `Counting down from ${mins} min${mins !== 1 ? 's' : ''}.`;
        }
    },

    updatePopoverDurationHint() {
        const h = parseInt(document.getElementById('pop-dur-h')?.value, 10) || 0;
        const m = parseInt(document.getElementById('pop-dur-m')?.value, 10) || 0;
        const s = parseInt(document.getElementById('pop-dur-s')?.value, 10) || 0;
        const total = h * 3600 + m * 60 + s;
        const hint = document.getElementById('pop-dur-hint');
        if (hint) {
            const mins = Math.floor(total / 60);
            hint.textContent = `Counting down from ${mins} min${mins !== 1 ? 's' : ''}.`;
        }
    },

    // ===== POPOVERS (inline start/duration editing) =====

    showStartPopover(event, timerIndex) {
        event.stopPropagation();
        this.editingTimerIndex = timerIndex;
        this.closePopovers();

        const timer = StateManager.state.timers[timerIndex];
        const pop = document.getElementById('start-popover');
        if (!pop || !timer) return;

        document.getElementById('pop-start-type').value = timer.start_type || 'manual';
        document.getElementById('pop-start-time').value = timer.start_time || '';
        document.getElementById('pop-start-date').value = timer.start_date || '';

        const rect = event.currentTarget.getBoundingClientRect();
        pop.style.left = rect.left + 'px';
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.classList.add('show');
        this.activePopover = pop;
    },

    showDurationPopover(event, timerIndex) {
        event.stopPropagation();
        this.editingTimerIndex = timerIndex;
        this.closePopovers();

        const timer = StateManager.state.timers[timerIndex];
        const pop = document.getElementById('duration-popover');
        if (!pop || !timer) return;

        const dur = timer.duration_seconds || 600;
        document.getElementById('pop-dur-h').value = String(Math.floor(dur / 3600)).padStart(2, '0');
        document.getElementById('pop-dur-m').value = String(Math.floor((dur % 3600) / 60)).padStart(2, '0');
        document.getElementById('pop-dur-s').value = String(dur % 60).padStart(2, '0');
        document.getElementById('pop-appearance').value = timer.appearance || 'countdown';
        this.updatePopoverDurationHint();

        const rect = event.currentTarget.getBoundingClientRect();
        pop.style.left = rect.left + 'px';
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.classList.add('show');
        this.activePopover = pop;
    },

    closePopovers() {
        document.querySelectorAll('.popover').forEach(p => p.classList.remove('show'));
        this.activePopover = null;
    },

    saveStartPopover() {
        if (this.editingTimerIndex === null) return;
        const timer = StateManager.state.timers[this.editingTimerIndex];
        if (!timer) return;
        timer.start_type = document.getElementById('pop-start-type').value;
        timer.start_time = document.getElementById('pop-start-time').value;
        timer.start_date = document.getElementById('pop-start-date').value;
        this.closePopovers();
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    saveDurationPopover() {
        if (this.editingTimerIndex === null) return;
        const timer = StateManager.state.timers[this.editingTimerIndex];
        if (!timer) return;
        const h = parseInt(document.getElementById('pop-dur-h').value, 10) || 0;
        const m = parseInt(document.getElementById('pop-dur-m').value, 10) || 0;
        const s = parseInt(document.getElementById('pop-dur-s').value, 10) || 0;
        timer.duration_seconds = h * 3600 + m * 60 + s;
        timer.appearance = document.getElementById('pop-appearance').value;
        this.closePopovers();
        RoomManager.renderTimerList(StateManager.state.timers);
    },

    // ===== MESSAGES =====

    renderMessages() {
        const list = document.getElementById('messages-list');
        if (!list) return;

        list.innerHTML = this.messages.map((msg, i) => `
            <div class="message-card" data-msg-index="${i}">
                <div class="msg-number">${i + 1}</div>
                <div class="message-input-wrap">
                    <textarea placeholder="Enter message ..."
                        data-msg-input="${i}"
                        id="msg-text-${i}">${this.escapeHtml(msg.text)}</textarea>
                    <div class="emoji-btns">
                        <button class="emoji-btn" title="Emoji">&#x1F7E2;</button>
                        <button class="emoji-btn" title="Timer">&#x1F554;</button>
                    </div>
                </div>
                <div class="msg-format-row">
                    <button class="msg-delete-btn" data-msg-delete="${i}" title="Delete message"><i class="fas fa-trash"></i></button>
                    <button class="msg-color-btn c-white ${msg.color === 'white' ? 'selected' : ''}" data-msg-color="${i}" data-color="white">A</button>
                    <button class="msg-color-btn c-green ${msg.color === 'green' ? 'selected' : ''}" data-msg-color="${i}" data-color="green">A</button>
                    <button class="msg-color-btn c-red ${msg.color === 'red' ? 'selected' : ''}" data-msg-color="${i}" data-color="red">A</button>
                    <button class="msg-bold-btn ${msg.bold ? 'active' : ''}" data-msg-bold="${i}">B</button>
                    <button class="msg-size-btn" data-msg-size="${i}">aA</button>
                    <div class="msg-show-toggle ${msg.visible ? 'active' : ''}">
                        <span class="dot"></span>
                        <label data-msg-show="${i}">Show</label>
                    </div>
                </div>
                <div class="msg-settings-row" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 0;border-top:1px solid #1a1a2a;margin-top:4px;">
                    <select data-msg-fontstyle="${i}" style="background:#1a1a2e;color:#ccc;border:1px solid #2a2a3e;border-radius:4px;padding:2px 4px;font-size:.7rem;width:90px;" title="Font style">
                        <option value="sans-serif" ${msg.fontStyle === 'sans-serif' ? 'selected' : ''}>Sans-serif</option>
                        <option value="serif" ${msg.fontStyle === 'serif' ? 'selected' : ''}>Serif</option>
                        <option value="monospace" ${msg.fontStyle === 'monospace' ? 'selected' : ''}>Monospace</option>
                        <option value="cursive" ${msg.fontStyle === 'cursive' ? 'selected' : ''}>Cursive</option>
                    </select>
                    <select data-msg-fontsize="${i}" style="background:#1a1a2e;color:#ccc;border:1px solid #2a2a3e;border-radius:4px;padding:2px 4px;font-size:.7rem;width:70px;" title="Font size">
                        <option value="small" ${msg.fontSize === 'small' ? 'selected' : ''}>Small</option>
                        <option value="normal" ${msg.fontSize === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="large" ${msg.fontSize === 'large' ? 'selected' : ''}>Large</option>
                        <option value="xlarge" ${msg.fontSize === 'xlarge' ? 'selected' : ''}>X-Large</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:3px;font-size:.7rem;color:#888;cursor:pointer;" title="Enable scrolling">
                        <input type="checkbox" data-msg-scroll="${i}" ${msg.scrollEnabled ? 'checked' : ''} style="accent-color:#3b82f6;width:12px;height:12px;">
                        Scroll
                    </label>
                    <select data-msg-scrolldir="${i}" style="background:#1a1a2e;color:#ccc;border:1px solid #2a2a3e;border-radius:4px;padding:2px 4px;font-size:.7rem;width:56px;" title="Scroll direction" ${!msg.scrollEnabled ? 'disabled' : ''}>
                        <option value="left" ${msg.scrollDirection === 'left' ? 'selected' : ''}>Left</option>
                        <option value="right" ${msg.scrollDirection === 'right' ? 'selected' : ''}>Right</option>
                    </select>
                    <label style="display:flex;align-items:center;gap:2px;font-size:.65rem;color:#888;" title="Scroll speed (seconds for one cycle)">
                        <input type="number" data-msg-scrollspeed="${i}" value="${msg.scrollSpeed || 10}" min="2" max="60" step="1" style="width:36px;background:#1a1a2e;color:#ccc;border:1px solid #2a2a3e;border-radius:3px;padding:2px;font-size:.65rem;text-align:center;" ${!msg.scrollEnabled ? 'disabled' : ''}>
                        s
                    </label>
                </div>
                <div class="msg-settings-row" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 0;border-top:1px solid #1a1a2a;margin-top:2px;">
                    <span style="font-size:.65rem;color:#666;min-width:20px;">BG:</span>
                    <select data-msg-bgtype="${i}" style="background:#1a1a2e;color:#ccc;border:1px solid #2a2a3e;border-radius:4px;padding:2px 4px;font-size:.7rem;width:90px;" title="Message background">
                        <option value="default" ${(msg.msgBgType || 'default') === 'default' ? 'selected' : ''}>Default</option>
                        <option value="transparent" ${msg.msgBgType === 'transparent' ? 'selected' : ''}>Transparent</option>
                        <option value="custom" ${msg.msgBgType === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                    <input type="color" data-msg-bgcolor="${i}" value="${msg.msgBgColor || '#000000'}" style="width:24px;height:24px;border:1px solid #3a3a50;border-radius:4px;background:transparent;cursor:pointer;padding:0;${msg.msgBgType !== 'custom' ? 'opacity:.3;pointer-events:none;' : ''}" title="Background color">
                </div>
            </div>
        `).join('');

        // Bind message events
        list.querySelectorAll('[data-msg-input]').forEach(ta => {
            ta.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.msgInput, 10);
                if (this.messages[idx]) this.messages[idx].text = e.target.value;
            });
        });
        list.querySelectorAll('[data-msg-delete]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.msgDelete, 10);
                if (this.messages.length > 1) {
                    this.messages.splice(idx, 1);
                    this.renderMessages();
                }
            });
        });
        list.querySelectorAll('[data-msg-color]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.msgColor, 10);
                const color = e.currentTarget.dataset.color;
                if (this.messages[idx]) {
                    this.messages[idx].color = color;
                    this.renderMessages();
                }
            });
        });
        list.querySelectorAll('[data-msg-bold]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.msgBold, 10);
                if (this.messages[idx]) {
                    this.messages[idx].bold = !this.messages[idx].bold;
                    this.renderMessages();
                }
            });
        });
        list.querySelectorAll('[data-msg-fontstyle]').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgFontstyle, 10);
                if (this.messages[idx]) this.messages[idx].fontStyle = e.target.value;
            });
        });
        list.querySelectorAll('[data-msg-fontsize]').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgFontsize, 10);
                if (this.messages[idx]) this.messages[idx].fontSize = e.target.value;
            });
        });
        list.querySelectorAll('[data-msg-scroll]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgScroll, 10);
                if (this.messages[idx]) {
                    this.messages[idx].scrollEnabled = e.target.checked;
                    this.renderMessages();
                }
            });
        });
        list.querySelectorAll('[data-msg-scrolldir]').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgScrolldir, 10);
                if (this.messages[idx]) this.messages[idx].scrollDirection = e.target.value;
            });
        });
        list.querySelectorAll('[data-msg-scrollspeed]').forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgScrollspeed, 10);
                if (this.messages[idx]) this.messages[idx].scrollSpeed = parseInt(e.target.value, 10) || 10;
            });
        });
        list.querySelectorAll('[data-msg-bgtype]').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.msgBgtype, 10);
                if (this.messages[idx]) {
                    this.messages[idx].msgBgType = e.target.value;
                    this.renderMessages();
                }
            });
        });
        list.querySelectorAll('[data-msg-bgcolor]').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.msgBgcolor, 10);
                if (this.messages[idx]) this.messages[idx].msgBgColor = e.target.value;
            });
        });
        list.querySelectorAll('[data-msg-show]').forEach(lbl => {
            lbl.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.msgShow, 10);
                const msg = this.messages[idx];
                if (!msg) return;
                msg.visible = !msg.visible;
                if (msg.visible && msg.text.trim()) {
                    MessageManager.showMessage(msg.text, msg.color, msg.bold, msg.fontSize, msg.fontStyle, msg.scrollEnabled, msg.scrollDirection, msg.scrollSpeed, msg.msgBgType, msg.msgBgColor);
                } else {
                    MessageManager.hideMessage();
                }
                this.renderMessages();
            });
        });

        // Save messages to localStorage
        this.saveMessages();
    },

    addMessage() {
        this.messages.push({
            id: Date.now(),
            text: '',
            color: 'white',
            bold: false,
            fontSize: 'normal',
            fontStyle: 'sans-serif',
            scrollEnabled: false,
            scrollDirection: 'left',
            scrollSpeed: 10,
            msgBgType: 'default',
            msgBgColor: '#000000',
            visible: false
        });
        this.renderMessages();
    },

    async toggleMsgFocus() {
        const btn = document.getElementById('btn-msg-focus');
        const isActive = btn ? btn.classList.toggle('active') : false;
        // Broadcast FLASH_TRIGGER to stage to grab audience attention
        await APIClient.broadcastEvent(
            StateManager.state.selectedRoomId,
            'FLASH_TRIGGER',
            {}
        ).catch(() => {});
    },

    async flashMessage() {
        const btn = document.getElementById('btn-msg-flash');
        if (btn) { btn.classList.add('active'); setTimeout(() => btn.classList.remove('active'), 300); }
        const visMsg = this.messages.find(m => m.visible);
        if (visMsg) {
            await MessageManager.flashMessage(visMsg.text, visMsg.color, visMsg.bold, visMsg.fontSize, visMsg.fontStyle, visMsg.scrollEnabled, visMsg.scrollDirection, visMsg.scrollSpeed, visMsg.msgBgType, visMsg.msgBgColor);
        }
    },

    // ===== MESSAGE PERSISTENCE =====

    saveMessages() {
        try {
            localStorage.setItem('b1g_timer_messages', JSON.stringify(this.messages));
        } catch (e) { /* ignore */ }
    },

    loadMessages() {
        try {
            const raw = localStorage.getItem('b1g_timer_messages');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.messages = parsed.map(m => ({
                        id: m.id || Date.now(),
                        text: m.text || '',
                        color: m.color || 'white',
                        bold: !!m.bold,
                        fontSize: m.fontSize || 'normal',
                        fontStyle: m.fontStyle || 'sans-serif',
                        scrollEnabled: !!m.scrollEnabled,
                        scrollDirection: m.scrollDirection || 'left',
                        scrollSpeed: m.scrollSpeed || 10,
                        msgBgType: m.msgBgType || 'default',
                        msgBgColor: m.msgBgColor || '#000000',
                        visible: false // Always start hidden on load
                    }));
                }
            }
        } catch (e) { /* ignore */ }
    },

    // ===== OUTPUT LINKS =====

    showOutputLinks() {
        const link = document.getElementById('stage-link');
        const roomId = StateManager.state.selectedRoomId || 1;
        if (link) {
            const base = window.location.href.replace(/\/[^/]*$/, '/');
            const stageUrl = base + 'stage.html?room=' + roomId;
            link.href = stageUrl;
            link.textContent = stageUrl;
        }
        document.getElementById('output-modal')?.classList.add('show');
    },

    closeOutputLinks() {
        document.getElementById('output-modal')?.classList.remove('show');
    },

    copyStageLink() {
        const link = document.getElementById('stage-link');
        if (link) {
            navigator.clipboard.writeText(link.href).then(() => {
                const btn = document.getElementById('copy-stage-link');
                if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
            }).catch(() => {});
        }
    },

    // ===== TIME DISPLAY =====

    startTimeDisplay() {
        const update = () => {
            const display = document.getElementById('current-time-display');
            if (display) {
                const now = new Date();
                const h = now.getHours();
                const m = String(now.getMinutes()).padStart(2, '0');
                const s = String(now.getSeconds()).padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                display.textContent = `${h12}:${m}:${s}  ${ampm}`;
            }
        };
        update();
        setInterval(update, 1000);
    },

    updateTimezone() {
        const label = document.getElementById('timezone-label');
        if (label) {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                label.textContent = tz;
            } catch (e) {}
        }
    },

    startHealthCheck() {
        setInterval(async () => {
            try { await APIClient.getHealth(); } catch (e) {}
        }, 30000);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ControlDashboard.init();
});

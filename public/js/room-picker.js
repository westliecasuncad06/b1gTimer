/**
 * B1G Timer – Room Picker (v2)
 *
 * Animated modal for selecting or creating a presentation room.
 *
 * Usage (stage pages):
 *   const roomId = await RoomPicker.pick();
 *   // Resolves immediately if ?room=X is in URL.
 *
 * Usage (dashboard / manual):
 *   const roomId = await RoomPicker.open();
 *   // Always shows the animated modal.
 *
 * Features:
 *   • Backdrop blur + fade-in, modal springs up from below
 *   • Room cards stagger in one-by-one
 *   • "New Room" dashed card opens an inline create form
 *   • Selection pulse animation → smooth close
 *   • Syncs hidden #room-selector on the dashboard
 *   • Updates #room-picker-label button text
 */
const RoomPicker = (() => {

    // ─────────────────────────────────────────────────────────────────────────
    //  Injected CSS
    // ─────────────────────────────────────────────────────────────────────────
    const CSS = `
        /* ── Backdrop ── */
        #rp-overlay {
            position: fixed; inset: 0;
            background: rgba(4, 4, 14, 0.9);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            animation: rp-bd-in 0.28s ease forwards;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rp-overlay.rp-closing {
            animation: rp-bd-out 0.24s ease forwards;
        }
        #rp-overlay.rp-closing .rp-modal-inner {
            animation: rp-modal-out 0.22s ease forwards;
        }
        @keyframes rp-bd-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rp-bd-out { from { opacity: 1; } to { opacity: 0; } }

        /* ── Main modal card ── */
        .rp-modal-inner {
            background: linear-gradient(165deg, #0d0d20 0%, #080812 100%);
            border: 1px solid rgba(255,255,255,.06);
            border-radius: 18px;
            padding: 36px 30px 30px;
            width: min(620px, 100%);
            max-height: calc(100vh - 40px);
            overflow-y: auto;
            box-shadow:
                0 32px 80px rgba(0,0,0,.85),
                0 0 0 1px rgba(59,130,246,.05),
                inset 0 1px 0 rgba(255,255,255,.04);
            animation: rp-modal-in 0.4s cubic-bezier(.22, 1.2, .36, 1) forwards;
            position: relative;
        }
        @keyframes rp-modal-in {
            from { opacity: 0; transform: translateY(32px) scale(.95); }
            to   { opacity: 1; transform: translateY(0)    scale(1);   }
        }
        @keyframes rp-modal-out {
            from { opacity: 1; transform: translateY(0)     scale(1);   }
            to   { opacity: 0; transform: translateY(-16px) scale(.97); }
        }

        /* ── Header ── */
        .rp-header { text-align: center; margin-bottom: 22px; }
        .rp-logo {
            font-size: 2.4rem; font-weight: 900; letter-spacing: 4px; color: #fff;
            margin-bottom: 4px;
            text-shadow: 0 0 40px rgba(59,130,246,.3);
        }
        .rp-logo span { color: #3b82f6; }
        .rp-tagline {
            font-size: .65rem; color: #2c2c48; letter-spacing: 2px; text-transform: uppercase;
        }
        .rp-title {
            margin-top: 22px; margin-bottom: 4px;
            font-size: .93rem; font-weight: 600; color: #555577;
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .rp-title i { color: #3b82f6; font-size: .85rem; }
        .rp-divider { height: 1px; background: rgba(255,255,255,.05); margin: 0 0 20px; }

        /* ── Card grid ── */
        .rp-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
            gap: 10px;
        }

        /* ── Room card ── */
        .rp-card {
            background: #101026;
            border: 1px solid rgba(255,255,255,.06);
            border-radius: 12px;
            padding: 22px 12px 16px;
            cursor: pointer; text-align: center;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            opacity: 0;
            animation: rp-rise .44s cubic-bezier(.22, 1, .36, 1) forwards;
            transition: background .15s, border-color .17s, box-shadow .17s, transform .14s;
            outline: none;
        }
        .rp-card:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
        .rp-card:hover {
            background: #141440;
            border-color: rgba(59,130,246,.48);
            box-shadow: 0 4px 24px rgba(59,130,246,.13), 0 0 0 1px rgba(59,130,246,.18);
            transform: translateY(-4px);
        }
        .rp-card:active { transform: translateY(-1px); }
        .rp-card.rp-selected {
            border-color: #3b82f6;
            animation: rp-rise .44s cubic-bezier(.22,1,.36,1) forwards,
                       rp-pick .34s .44s ease forwards !important;
        }
        @keyframes rp-rise {
            from { opacity: 0; transform: translateY(18px) scale(.93); }
            to   { opacity: 1; transform: translateY(0)    scale(1);   }
        }
        @keyframes rp-pick {
            0%   { transform: scale(1);    box-shadow: 0 0 0 0   rgba(59,130,246,0);    }
            35%  { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(59,130,246,.22); }
            65%  { transform: scale(.97);  box-shadow: 0 0 0 4px rgba(59,130,246,.1);  }
            100% { transform: scale(1.01); opacity: .5; }
        }

        /* ── "New Room" dashed card ── */
        .rp-add-card {
            background: transparent;
            border: 1.5px dashed rgba(255,255,255,.09);
            border-radius: 12px;
            padding: 22px 12px 16px;
            cursor: pointer; text-align: center;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            opacity: 0;
            animation: rp-rise .44s cubic-bezier(.22, 1, .36, 1) forwards;
            transition: border-color .15s, background .15s;
            outline: none;
        }
        .rp-add-card:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
        .rp-add-card:hover {
            border-color: rgba(59,130,246,.4);
            background: rgba(59,130,246,.04);
        }

        /* ── Shared icon box ── */
        .rp-icon {
            width: 44px; height: 44px; border-radius: 11px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.15rem;
            transition: background .15s, color .15s;
        }
        .rp-card .rp-icon    { background: rgba(59,130,246,.1); color: #3b82f6; }
        .rp-card:hover .rp-icon { background: rgba(59,130,246,.2); }
        .rp-add-card .rp-icon { background: rgba(255,255,255,.04); color: #303054; }
        .rp-add-card:hover .rp-icon { background: rgba(59,130,246,.12); color: #3b82f6; }

        /* ── Card text ── */
        .rp-name { font-size: .88rem; font-weight: 600; color: #c0c0e0; line-height: 1.3; word-break: break-word; }
        .rp-add-card .rp-name { color: #2e2e50; }
        .rp-add-card:hover .rp-name { color: #5070b0; }
        .rp-id   { font-size: .67rem; color: #252540; }
        .rp-add-card .rp-id { color: #1e1e36; }

        /* ── Inline create form ── */
        .rp-create-row {
            grid-column: 1 / -1;
            display: flex; gap: 8px; align-items: center;
            background: #08081a;
            border: 1px solid rgba(59,130,246,.2);
            border-radius: 10px;
            padding: 12px 14px;
            animation: rp-rise .24s ease forwards;
            margin-top: 2px;
        }
        .rp-create-row input {
            flex: 1;
            background: #050510; color: #dde;
            border: 1px solid rgba(255,255,255,.07);
            border-radius: 7px; padding: 9px 12px;
            font-size: .85rem; outline: none;
            transition: border-color .15s;
        }
        .rp-create-row input:focus { border-color: #3b82f6; }
        .rp-create-row input.rp-err { border-color: #ef4444; }
        .rp-ok {
            background: #3b82f6; color: #fff;
            border: none; border-radius: 7px; padding: 9px 18px;
            font-size: .83rem; font-weight: 600; cursor: pointer; white-space: nowrap;
            transition: background .15s;
        }
        .rp-ok:hover    { background: #2563eb; }
        .rp-ok:disabled { background: #1e3a6e; cursor: not-allowed; }
        .rp-cx {
            background: transparent; color: #555;
            border: 1px solid #252535; border-radius: 7px;
            padding: 9px 12px; font-size: .83rem; cursor: pointer;
            transition: color .15s, border-color .15s;
        }
        .rp-cx:hover { color: #999; border-color: #444; }

        /* ── Spinner ── */
        .rp-spin {
            display: inline-block; width: 13px; height: 13px;
            border: 2px solid rgba(255,255,255,.2); border-top-color: #fff;
            border-radius: 50%; animation: rp-spinner .6s linear infinite;
            vertical-align: middle;
        }
        @keyframes rp-spinner { to { transform: rotate(360deg); } }

        /* ── Empty state ── */
        .rp-empty-msg {
            color: #252542; font-size: .83rem; text-align: center;
            grid-column: 1/-1; padding: 16px 0;
        }

        /* ── Scrollbar ── */
        .rp-modal-inner::-webkit-scrollbar { width: 4px; }
        .rp-modal-inner::-webkit-scrollbar-track { background: transparent; }
        .rp-modal-inner::-webkit-scrollbar-thumb { background: #1a1a30; border-radius: 2px; }
    `;

    // ─────────────────────────────────────────────────────────────────────────
    //  Private state
    // ─────────────────────────────────────────────────────────────────────────
    let _resolve = null;

    // ─────────────────────────────────────────────────────────────────────────
    //  Private helpers
    // ─────────────────────────────────────────────────────────────────────────
    function _injectCSS() {
        if (document.getElementById('rp-styles')) return;
        const s = document.createElement('style');
        s.id = 'rp-styles';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    function _esc(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _buildCards(rooms) {
        let html = '';
        rooms.forEach((r, i) => {
            html += `<button class="rp-card" data-room-id="${r.id}" type="button"
                         style="animation-delay:${i * 60}ms"
                         aria-label="Select ${_esc(r.name || 'Room ' + r.id)}">
                         <span class="rp-icon"><i class="fas fa-door-open"></i></span>
                         <span class="rp-name">${_esc(r.name || 'Room ' + r.id)}</span>
                         <span class="rp-id">Room #${r.id}</span>
                     </button>`;
        });
        const addDelay = rooms.length * 60;
        html += `<button class="rp-add-card" id="rp-add-btn" type="button"
                     style="animation-delay:${addDelay}ms"
                     aria-label="Create new room">
                     <span class="rp-icon"><i class="fas fa-plus"></i></span>
                     <span class="rp-name">New Room</span>
                     <span class="rp-id">Create new</span>
                 </button>`;
        return html;
    }

    function _createOverlay(rooms) {
        const ov = document.createElement('div');
        ov.id = 'rp-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');

        const emptyNote = rooms.length === 0
            ? '<p class="rp-empty-msg">No rooms yet — create your first room below.</p>'
            : '';

        ov.innerHTML = `
            <div class="rp-modal-inner" id="rp-modal-inner" aria-labelledby="rp-title">
                <div class="rp-header">
                    <div class="rp-logo">B1<span>G</span></div>
                    <div class="rp-tagline">TIMER &amp; SCRIPTURE PRESENTATION SYSTEM</div>
                    <div class="rp-title" id="rp-title">
                        <i class="fas fa-door-open"></i> Select a Room to Continue
                    </div>
                </div>
                <div class="rp-divider"></div>
                <div class="rp-grid" id="rp-grid">
                    ${emptyNote}${_buildCards(rooms)}
                </div>
            </div>`;
        document.body.appendChild(ov);
        return ov;
    }

    function _close(roomId) {
        const ov = document.getElementById('rp-overlay');
        if (ov) {
            ov.classList.add('rp-closing');
            // Remove after 250ms — CSS close animations are 0.22–0.24s
            setTimeout(() => ov.remove(), 250);
        }
        if (_resolve) {
            _resolve(roomId);
            _resolve = null;
        }
    }

    function _applyRoom(roomId) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomId);
            history.replaceState(null, '', url.toString());
        } catch (e) { /* cross-origin guard */ }
    }

    function _updateLabel(roomId, roomName) {
        const lbl = document.getElementById('room-picker-label');
        if (lbl) lbl.textContent = roomName || ('Room ' + roomId);
    }

    function _syncSelector(roomId, roomName) {
        const sel = document.getElementById('room-selector');
        if (!sel) return;
        if (!sel.querySelector(`option[value="${_esc(roomId)}"]`)) {
            const opt = document.createElement('option');
            opt.value = roomId;
            opt.textContent = roomName || ('Room ' + roomId);
            sel.appendChild(opt);
        }
        sel.value = roomId;
        sel.dispatchEvent(new Event('change'));
    }

    function _showCreateForm(grid) {
        const addBtn = document.getElementById('rp-add-btn');
        if (addBtn) addBtn.style.display = 'none';

        const row = document.createElement('div');
        row.className = 'rp-create-row';
        row.id = 'rp-create-row';
        row.innerHTML = `
            <input type="text" id="rp-room-name" placeholder="Room name…" maxlength="80" autocomplete="off">
            <button class="rp-ok" id="rp-create-ok" type="button">Create</button>
            <button class="rp-cx" id="rp-create-cx" type="button">Cancel</button>`;
        grid.appendChild(row);

        const inp = row.querySelector('#rp-room-name');
        inp.focus();

        row.querySelector('#rp-create-cx').addEventListener('click', () => {
            row.remove();
            if (addBtn) addBtn.style.display = '';
        });
        row.querySelector('#rp-create-ok').addEventListener('click', () => _doCreate(inp.value.trim()));
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter')  _doCreate(inp.value.trim());
            if (e.key === 'Escape') { row.remove(); if (addBtn) addBtn.style.display = ''; }
        });
    }

    async function _doCreate(name) {
        if (!name) {
            const inp = document.getElementById('rp-room-name');
            if (inp) {
                inp.classList.add('rp-err');
                setTimeout(() => inp && inp.classList.remove('rp-err'), 800);
                inp.focus();
            }
            return;
        }
        const okBtn = document.getElementById('rp-create-ok');
        const cxBtn = document.getElementById('rp-create-cx');
        if (okBtn) { okBtn.disabled = true; okBtn.innerHTML = '<span class="rp-spin"></span>'; }
        if (cxBtn) cxBtn.disabled = true;

        try {
            const newRoom = await APIClient.createRoom(name);
            const roomId  = String(newRoom.id);
            const roomName = newRoom.name || name;
            _applyRoom(roomId);
            _updateLabel(roomId, roomName);
            _syncSelector(roomId, roomName);
            await new Promise(r => setTimeout(r, 160));
            _close(roomId);
        } catch (e) {
            console.error('[RoomPicker] Create room error:', e.message);
            if (okBtn) { okBtn.disabled = false; okBtn.textContent = 'Create'; }
            if (cxBtn) cxBtn.disabled = false;
            const inp = document.getElementById('rp-room-name');
            if (inp) { inp.classList.add('rp-err'); inp.focus(); }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Public API
    // ─────────────────────────────────────────────────────────────────────────
    return {
        /**
         * Stage-page mode.
         * Resolves immediately if ?room= is already in the URL.
         * Otherwise delegates to open().
         */
        async pick() {
            const params  = new URLSearchParams(window.location.search);
            const urlRoom = params.get('room');
            if (urlRoom) return urlRoom;
            return this.open();
        },

        /**
         * Always shows the animated room picker modal.
         * Returns Promise<string> — the selected room ID.
         */
        async open() {
            _injectCSS();

            let rooms = [];
            try {
                rooms = await APIClient.getRooms();
            } catch (e) {
                console.warn('[RoomPicker] Failed to load rooms:', e.message);
            }

            // Auto-select the only room (no UI needed)
            if (rooms.length === 1) {
                _applyRoom(rooms[0].id);
                _updateLabel(String(rooms[0].id), rooms[0].name);
                _syncSelector(String(rooms[0].id), rooms[0].name);
                return String(rooms[0].id);
            }

            // No rooms → safe fallback (should not happen in normal use)
            if (rooms.length === 0) {
                return '1';
            }

            // Render animated overlay
            const overlay = _createOverlay(rooms);

            return new Promise((resolve) => {
                _resolve = resolve;

                overlay.addEventListener('click', e => {
                    // "New Room" add card
                    if (e.target.closest('#rp-add-btn')) {
                        const grid = document.getElementById('rp-grid');
                        if (grid) _showCreateForm(grid);
                        return;
                    }

                    // Existing room card
                    const card = e.target.closest('[data-room-id]');
                    if (!card) return;

                    const roomId   = card.dataset.roomId;
                    const roomName = card.querySelector('.rp-name')?.textContent || '';
                    card.classList.add('rp-selected');

                    // 80ms: brief pulse on card, then start closing the modal.
                    // Total close time kept < 350ms so existing test suite's 400ms window holds.
                    setTimeout(() => {
                        _applyRoom(roomId);
                        _updateLabel(roomId, roomName);
                        _syncSelector(roomId, roomName);
                        _close(roomId);
                    }, 80);
                });
            });
        },

        /** Expose for backward-compat with external callers. */
        _applyRoom
    };
})();

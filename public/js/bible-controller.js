/**
 * B1G Timer - Bible Controller v4
 * Full-page Bible controller with 40 designs, transitions, present mode, save verse, mobile nav
 */

const BibleController = {
    // State
    roomId: null,
    currentView: 'books',
    currentBook: null,
    currentChapter: null,
    selectedVerse: null,
    _searchTimeout: null,
    _searchEnterMode: false,
    _presets: [],
    _recentVerses: [],
    _bgImages: [],
    _selectedBgImage: null,
    _blackoutActive: false,
    _selectedDesign: 'classic',
    _transition: 'fade',
    _modalSelectedDesign: null,
    _modalSelectedTransition: null,
    _presentWindow: null,
    _readerFontSize: 14,
    _presetSortable: null,

    // Style state
    _style: {
        preset: 'classic',
        fontFamily: "'Georgia', serif",
        fontSize: '5vw',
        refFontSize: '2.5vw',
        textColor: '#ffffff',
        bgType: 'solid',
        bgColor: '#000000',
        textAlign: 'center',
        refPosition: 'bottom-center',
        bgImage: null,
        transition: 'fade'
    },

    // Use presets from BibleDisplay once loaded
    get PRESETS() { return typeof BibleDisplay !== 'undefined' ? BibleDisplay.PRESETS : {}; },
    get TRANSITIONS() { return typeof BibleDisplay !== 'undefined' ? BibleDisplay.TRANSITIONS : {}; },

    FONT_SIZE_MAP: { small: '3vw', normal: '4vw', large: '5vw', xlarge: '6.5vw' },
    REF_SIZE_MAP: { small: '1.5vw', normal: '2vw', large: '2.5vw', xlarge: '3vw' },

    async init() {
        // RoomPicker resolves instantly when ?room= is in the URL;
        // otherwise it shows a full-screen room selection overlay.
        const pickedRoom = typeof RoomPicker !== 'undefined'
            ? await RoomPicker.pick()
            : (new URLSearchParams(window.location.search).get('room') || 1);
        this.roomId = pickedRoom;
        this._loadRoomName();
        this._restoreStyle();
        this._restoreRecent();
        this._restoreReaderFontSize();
        this._setupEventListeners();
        this._renderDesignGallery();
        this._renderTransitionGallery();
        this._renderDesignModal();
        this._renderTransitionModal();
        await BibleData.load();
        this._showBooks();
        this._loadPresets();
        this._loadBgImages();
        this._setupBroadcastChannel();
        this._updateConnectionDot(true);
        this._updateStagePreview();
        console.log('[BibleController] Initialized for room', this.roomId);
    },

    async _loadRoomName() {
        try {
            const room = await APIClient.getRoom(this.roomId);
            const el = document.getElementById('room-name');
            if (el && room) el.textContent = room.name || `Room ${this.roomId}`;
        } catch (e) {
            const el = document.getElementById('room-name');
            if (el) el.textContent = `Room ${this.roomId}`;
        }
    },

    _setupEventListeners() {
        // Version select
        const versionSelect = document.getElementById('version-select');
        if (versionSelect) versionSelect.addEventListener('change', () => this._onVersionChange(versionSelect.value));

        // Navigation
        document.getElementById('btn-back')?.addEventListener('click', () => this._navigateBack());
        document.getElementById('btn-prev-ch')?.addEventListener('click', () => this._prevChapter());
        document.getElementById('btn-next-ch')?.addEventListener('click', () => this._nextChapter());
        document.getElementById('btn-prev-verse')?.addEventListener('click', () => this._prevVerse());
        document.getElementById('btn-next-verse')?.addEventListener('click', () => this._nextVerse());
        document.getElementById('chapter-jump')?.addEventListener('change', (e) => {
            const ch = parseInt(e.target.value, 10);
            if (ch && this.currentBook) this._showReader(this.currentBook, ch);
        });

        // Action buttons
        document.getElementById('btn-clear')?.addEventListener('click', () => this._clearVerse());
        document.getElementById('btn-blackout')?.addEventListener('click', () => this._toggleBlackout());
        document.getElementById('btn-copy')?.addEventListener('click', () => this._copyVerse());

        // Open Bible Stage
        document.getElementById('btn-open-stage')?.addEventListener('click', () => {
            this._storeCurrentVerse();
            window.open(`bible-stage.html?room=${this.roomId}`, '_blank');
        });

        // Present button
        document.getElementById('btn-present')?.addEventListener('click', () => this._startPresentation());

        // Save Current Verse (header bar + sidebar button)
        document.getElementById('btn-save-verse')?.addEventListener('click', () => this._addPreset());
        document.getElementById('btn-add-preset')?.addEventListener('click', () => this._addPreset());

        // Apply Design button
        document.getElementById('btn-apply-design')?.addEventListener('click', () => this._applyCurrentDesign());

        // Apply Transition button
        document.getElementById('btn-apply-transition')?.addEventListener('click', () => this._applyCurrentTransition());

        // Browse more designs/transitions
        document.getElementById('btn-browse-designs')?.addEventListener('click', () => this._openDesignModal());
        document.getElementById('btn-browse-transitions')?.addEventListener('click', () => this._openTransitionModal());

        // Design modal
        document.getElementById('design-modal-apply')?.addEventListener('click', () => this._applyDesignFromModal());
        document.getElementById('design-modal-apply-mobile')?.addEventListener('click', () => this._applyDesignFromModal());
        document.getElementById('transition-modal-apply')?.addEventListener('click', () => this._applyTransitionFromModal());
        document.getElementById('transition-modal-apply-mobile')?.addEventListener('click', () => this._applyTransitionFromModal());
        document.getElementById('transition-preview-play')?.addEventListener('click', () => this._previewTransitionAnimation());

        // Close modals
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.closeModal;
                document.getElementById(modalId)?.classList.remove('open');
            });
        });

        // Close modal on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('open');
            });
        });

        // Search
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._searchEnterMode = false;
                clearTimeout(this._searchTimeout);
                this._searchTimeout = setTimeout(() => this._onSearch(searchInput.value, false), 300);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(this._searchTimeout);
                    this._onSearch(searchInput.value, true);
                }
            });
        }
        document.getElementById('search-btn')?.addEventListener('click', () => {
            this._onSearch(document.getElementById('search-input')?.value || '', true);
        });

        // Reader font size
        document.getElementById('reader-font-size')?.addEventListener('change', (e) => {
            this._setReaderFontSize(parseInt(e.target.value, 10));
        });

        // Sidebar tabs
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => this._switchSidebarTab(tab.dataset.tab));
        });

        // Sidebar toggle (legacy for tablet)
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('mobile-open');
        });

        // Mobile bottom nav
        document.querySelectorAll('[data-mobile-tab]').forEach(btn => {
            btn.addEventListener('click', () => this._onMobileTab(btn.dataset.mobileTab));
        });

        // Custom style controls
        const styleFields = ['style-font-family','style-font-size','style-text-color',
            'style-bg-type','style-bg-color','style-text-align','style-ref-position'];
        styleFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this._updateStyleFromControls());
            if (el && el.type === 'color') el.addEventListener('input', () => this._updateStyleFromControls());
        });

        // Background image upload
        document.getElementById('bg-upload-input')?.addEventListener('change', (e) => {
            if (e.target.files.length) this._uploadBgImage(e.target.files[0]);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this._onKeydown(e));
    },

    // ===== MOBILE BOTTOM NAV =====

    _onMobileTab(tab) {
        // Don't toggle active state for action buttons (clear/black)
        if (tab === 'clear') {
            this._clearVerse();
            return;
        }
        if (tab === 'black') {
            this._toggleBlackout();
            return;
        }

        document.querySelectorAll('[data-mobile-tab]').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-mobile-tab="${tab}"]`)?.classList.add('active');

        const sidebar = document.getElementById('sidebar');

        if (tab === 'reader') {
            sidebar?.classList.remove('mobile-open');
        } else if (tab === 'search' || tab === 'saved' || tab === 'style') {
            sidebar?.classList.add('mobile-open');
            this._switchSidebarTab(tab);
        } else if (tab === 'more') {
            // Toggle more actions
            this._showMobileMoreMenu();
        }
    },

    _showMobileMoreMenu() {
        // Create a simple action sheet
        const existing = document.getElementById('mobile-more-sheet');
        if (existing) { existing.remove(); return; }

        const sheet = document.createElement('div');
        sheet.id = 'mobile-more-sheet';
        sheet.style.cssText = `position:fixed;bottom:56px;left:0;right:0;background:var(--bg-secondary);border-top:1px solid var(--border);z-index:300;padding:12px;display:flex;flex-wrap:wrap;gap:8px;`;

        const actions = [
            { label: 'Stage', icon: 'fa-tv', action: () => { this._storeCurrentVerse(); window.open(`bible-stage.html?room=${this.roomId}`, '_blank'); } },
            { label: 'Present', icon: 'fa-display', action: () => this._startPresentation() },
            { label: 'Clear Text', icon: 'fa-eraser', action: () => this._clearVerse() },
            { label: 'Blackout', icon: 'fa-moon', action: () => this._toggleBlackout() },
            { label: 'Copy', icon: 'fa-copy', action: () => this._copyVerse() },
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'header-icon-btn';
            btn.innerHTML = `<i class="fas ${a.icon}"></i> ${a.label}`;
            btn.addEventListener('click', () => { a.action(); sheet.remove(); });
            sheet.appendChild(btn);
        });

        document.body.appendChild(sheet);
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!sheet.contains(e.target) && !e.target.closest('[data-mobile-tab="more"]')) {
                    sheet.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 50);
    },

    // ===== KEYBOARD SHORTCUTS =====

    _onKeydown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); this._prevChapter(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this._nextChapter(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this._prevVerse(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); this._nextVerse(); }
        else if (e.key === 'Escape') { e.preventDefault(); this._clearVerse(); }
    },

    // ===== VERSION CHANGE =====

    async _onVersionChange(version) {
        this._showToast(`Switching to ${version}...`, 'info');
        await BibleData.setVersion(version);
        if (this.currentView === 'reader' && this.currentBook && this.currentChapter) {
            await this._showReader(this.currentBook, this.currentChapter, this.selectedVerse?.verse);
        }
        if (this.selectedVerse) {
            const text = await BibleData.getVerse(this.selectedVerse.book, this.selectedVerse.chapter, this.selectedVerse.verse);
            if (text) {
                this.selectedVerse.text = text;
                this.selectedVerse.version = version;
                this._broadcastVerse(this.selectedVerse);
            }
        }
        this._showToast(`Switched to ${version}`, 'success');
    },

    // ===== NAVIGATION =====

    async _showBooks() {
        this.currentView = 'books';
        this.currentBook = null;
        this.currentChapter = null;
        this._updateBreadcrumb();
        this._updateChapterNav();

        const content = document.getElementById('reader-content');
        if (!content) return;

        const books = await BibleData.getBooks();
        let html = '';
        html += '<div class="books-section-header">Old Testament</div><div class="books-grid">';
        books.slice(0, BibleData.OT_COUNT).forEach(b => {
            html += `<button class="book-btn" data-book="${this._esc(b)}" title="${this._esc(b)}">${this._esc(this._abbrev(b))}</button>`;
        });
        html += '</div>';
        html += '<div class="books-section-header">New Testament</div><div class="books-grid">';
        books.slice(BibleData.OT_COUNT).forEach(b => {
            html += `<button class="book-btn" data-book="${this._esc(b)}" title="${this._esc(b)}">${this._esc(this._abbrev(b))}</button>`;
        });
        html += '</div>';
        content.innerHTML = html;
        content.querySelectorAll('.book-btn').forEach(btn => {
            btn.addEventListener('click', () => this._showChapters(btn.dataset.book));
        });
    },

    async _showChapters(book) {
        this.currentView = 'chapters';
        this.currentBook = book;
        this.currentChapter = null;
        this._updateBreadcrumb();
        this._updateChapterNav();
        const content = document.getElementById('reader-content');
        if (!content) return;
        const chapters = await BibleData.getChapters(book);
        let html = '<div class="chapters-grid">';
        chapters.forEach(ch => { html += `<button class="chapter-btn" data-ch="${ch}">${ch}</button>`; });
        html += '</div>';
        content.innerHTML = html;
        content.querySelectorAll('.chapter-btn').forEach(btn => {
            btn.addEventListener('click', () => this._showReader(book, parseInt(btn.dataset.ch, 10)));
        });
    },

    async _showReader(book, chapter, highlightVerse) {
        this.currentView = 'reader';
        this.currentBook = book;
        this.currentChapter = chapter;
        this._updateBreadcrumb();
        this._updateChapterNav();
        const content = document.getElementById('reader-content');
        if (!content) return;
        const verses = await BibleData.getVerses(book, chapter);
        const version = BibleData.getVersion();
        let html = `<div class="verse-reader">`;
        html += `<div class="verse-reader-header">${this._esc(book)} ${chapter} <small style="color:var(--text-secondary);">(${version})</small></div>`;
        for (const v of verses) {
            const text = await BibleData.getVerse(book, chapter, v);
            const isHL = highlightVerse && String(v) === String(highlightVerse);
            html += `<div class="verse-line${isHL ? ' highlighted' : ''}" data-verse="${v}" data-book="${this._esc(book)}" data-chapter="${chapter}">`;
            html += `<span class="verse-num">${v}</span>`;
            html += `<span class="verse-text" style="font-size:${this._readerFontSize}px">${this._esc(text || '')}</span>`;
            html += `</div>`;
        }
        html += '</div>';
        content.innerHTML = html;
        content.querySelectorAll('.verse-line').forEach(line => {
            line.addEventListener('click', () => this._onVerseClick(line));
        });
        if (highlightVerse) {
            const hlEl = content.querySelector('.verse-line.highlighted');
            if (hlEl) setTimeout(() => hlEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        }
    },

    async _onVerseClick(lineEl) {
        const v = lineEl.dataset.verse;
        const book = lineEl.dataset.book;
        const chapter = parseInt(lineEl.dataset.chapter, 10);
        const text = await BibleData.getVerse(book, chapter, parseInt(v, 10));
        const version = BibleData.getVersion();

        // Toggle: clicking the same verse again = unclear/deselect
        if (this.selectedVerse && this.selectedVerse.book === book &&
            this.selectedVerse.chapter === chapter &&
            this.selectedVerse.verse === String(v) &&
            lineEl.classList.contains('live-sent')) {
            // Unclear: deselect and clear from stage
            lineEl.classList.remove('highlighted', 'live-sent');
            this.selectedVerse = null;
            this._clearVerse();
            this._updateStagePreview();
            this._updateVerseNavButtons();
            return;
        }

        this.selectedVerse = { book, chapter, verse: String(v), verseEnd: null, text, version };
        document.querySelectorAll('.verse-line.highlighted, .verse-line.live-sent').forEach(el => {
            el.classList.remove('highlighted', 'live-sent');
        });
        lineEl.classList.add('highlighted', 'live-sent');
        this._broadcastVerse(this.selectedVerse);
        this._addToRecent(this.selectedVerse);
        this._storeCurrentVerse();
        this._updateStagePreview();
        this._updateVerseNavButtons();
    },

    // ===== VERSE NAVIGATION =====

    async _prevVerse() {
        if (!this.selectedVerse || this.currentView !== 'reader') return;
        const curV = parseInt(this.selectedVerse.verse, 10);
        if (curV <= 1) return;
        const prevLine = document.querySelector(`.verse-line[data-verse="${curV - 1}"]`);
        if (prevLine) {
            await this._onVerseClick(prevLine);
            prevLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    async _nextVerse() {
        if (!this.selectedVerse || this.currentView !== 'reader') return;
        const curV = parseInt(this.selectedVerse.verse, 10);
        const nextLine = document.querySelector(`.verse-line[data-verse="${curV + 1}"]`);
        if (nextLine) {
            await this._onVerseClick(nextLine);
            nextLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    _updateVerseNavButtons() {
        const prevBtn = document.getElementById('btn-prev-verse');
        const nextBtn = document.getElementById('btn-next-verse');
        if (!prevBtn || !nextBtn) return;
        if (!this.selectedVerse || this.currentView !== 'reader') {
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        const curV = parseInt(this.selectedVerse.verse, 10);
        prevBtn.disabled = curV <= 1;
        nextBtn.disabled = !document.querySelector(`.verse-line[data-verse="${curV + 1}"]`);
    },

    _storeCurrentVerse() {
        if (!this.selectedVerse) return;
        const data = { ...this.selectedVerse, style: this._style, roomId: this.roomId, timestamp: Date.now() };
        localStorage.setItem('b1g_bible_current_verse', JSON.stringify(data));
    },

    _navigateBack() {
        if (this.currentView === 'reader') this._showChapters(this.currentBook);
        else if (this.currentView === 'chapters') this._showBooks();
    },

    async _prevChapter() {
        if (!this.currentBook || !this.currentChapter) return;
        const chapters = await BibleData.getChapters(this.currentBook);
        const idx = chapters.indexOf(this.currentChapter);
        if (idx > 0) {
            this._showReader(this.currentBook, chapters[idx - 1]);
        } else {
            const books = await BibleData.getBooks();
            const bookIdx = books.indexOf(this.currentBook);
            if (bookIdx > 0) {
                const prevBook = books[bookIdx - 1];
                const prevChapters = await BibleData.getChapters(prevBook);
                if (prevChapters.length) this._showReader(prevBook, prevChapters[prevChapters.length - 1]);
            }
        }
    },

    async _nextChapter() {
        if (!this.currentBook || !this.currentChapter) return;
        const chapters = await BibleData.getChapters(this.currentBook);
        const idx = chapters.indexOf(this.currentChapter);
        if (idx < chapters.length - 1) {
            this._showReader(this.currentBook, chapters[idx + 1]);
        } else {
            const books = await BibleData.getBooks();
            const bookIdx = books.indexOf(this.currentBook);
            if (bookIdx < books.length - 1) {
                const nextBook = books[bookIdx + 1];
                const nextChapters = await BibleData.getChapters(nextBook);
                if (nextChapters.length) this._showReader(nextBook, nextChapters[0]);
            }
        }
    },

    _updateBreadcrumb() {
        const el = document.getElementById('breadcrumb');
        if (!el) return;
        let html = '<span data-nav="books">Books</span>';
        if (this.currentBook) {
            html += '<span class="sep"> &rsaquo; </span>';
            html += `<span data-nav="chapters">${this._esc(this.currentBook)}</span>`;
        }
        if (this.currentChapter !== null) {
            html += '<span class="sep"> &rsaquo; </span>';
            html += `<span class="active">Chapter ${this.currentChapter}</span>`;
        }
        el.innerHTML = html;
        el.querySelectorAll('span[data-nav]').forEach(s => {
            s.addEventListener('click', () => {
                if (s.dataset.nav === 'books') this._showBooks();
                else if (s.dataset.nav === 'chapters') this._showChapters(this.currentBook);
            });
        });
    },

    async _updateChapterNav() {
        const prevBtn = document.getElementById('btn-prev-ch');
        const nextBtn = document.getElementById('btn-next-ch');
        const jumpSel = document.getElementById('chapter-jump');
        if (this.currentView !== 'reader') {
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            if (jumpSel) jumpSel.style.display = 'none';
            return;
        }
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
        if (jumpSel && this.currentBook) {
            jumpSel.style.display = '';
            const chapters = await BibleData.getChapters(this.currentBook);
            jumpSel.innerHTML = chapters.map(ch =>
                `<option value="${ch}"${ch === this.currentChapter ? ' selected' : ''}>Ch ${ch}</option>`
            ).join('');
        }
    },

    // ===== SEARCH =====

    async _onSearch(query, isEnter = false) {
        const trimmed = query.trim();
        const resultsEl = document.getElementById('sidebar-search-results');
        if (!resultsEl) return;
        if (!trimmed) { resultsEl.innerHTML = ''; return; }
        resultsEl.innerHTML = '<div class="search-empty">Searching...</div>';

        const refResult = await BibleData.searchByReference(trimmed);
        if (refResult && !refResult.isChapter) {
            if (isEnter) {
                // Auto-navigate and flash the verse
                resultsEl.innerHTML = '';
                await this._showReader(refResult.book, refResult.chapter, parseInt(refResult.verse, 10));
                this.selectedVerse = refResult;
                this._updateStagePreview();
                this._updateVerseNavButtons();
                this._flashVerse(refResult.book, refResult.chapter, refResult.verse);
                return;
            }
            resultsEl.innerHTML = '';
            resultsEl.appendChild(this._createSearchResultEl(refResult));
            return;
        }
        if (refResult && refResult.isChapter) {
            this._showReader(refResult.book, refResult.chapter);
            resultsEl.innerHTML = '';
            return;
        }
        const results = await BibleData.searchByKeyword(trimmed);
        if (results.length === 0) { resultsEl.innerHTML = '<div class="search-empty">No results found</div>'; return; }
        resultsEl.innerHTML = '';
        results.forEach(r => resultsEl.appendChild(this._createSearchResultEl(r)));
    },

    _flashVerse(book, chapter, verse) {
        const selector = `.verse-line[data-verse="${verse}"][data-book="${this._esc(book)}"][data-chapter="${chapter}"]`;
        const el = document.querySelector(selector);
        if (!el) return;
        // Remove previous flash classes
        document.querySelectorAll('.verse-line.flash-highlight').forEach(x => x.classList.remove('flash-highlight'));
        el.classList.add('highlighted', 'live-sent', 'flash-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove flash-highlight after animation
        setTimeout(() => el.classList.remove('flash-highlight'), 1500);
    },

    _createSearchResultEl(result) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const ref = BibleData.formatReference(result.book, result.chapter, result.verse, result.verseEnd, result.version);
        const text = result.snippet || (result.text ? result.text.substring(0, 120) + (result.text.length > 120 ? '...' : '') : '');
        item.innerHTML = `<div class="search-result-ref">${this._esc(ref)}</div><div class="search-result-text">${this._esc(text)}</div>`;
        item.addEventListener('click', () => {
            const verse = result.verse ? parseInt(result.verse, 10) : null;
            this._showReader(result.book, result.chapter, verse);
            this.selectedVerse = result;
        });
        return item;
    },

    // ===== DISPLAY / CLEAR / COPY =====

    async _clearVerse() {
        try {
            await APIClient.clearBibleVerse(this.roomId);
            this._showToast('Text cleared from stage', 'info');
        } catch (e) {
            console.error('[BibleController] Clear error:', e);
        }
    },

    async _toggleBlackout() {
        this._blackoutActive = !this._blackoutActive;
        const btn = document.getElementById('btn-blackout');
        if (btn) btn.classList.toggle('active', this._blackoutActive);
        try {
            const action = this._blackoutActive ? 'BLACKOUT_ON' : 'BLACKOUT_OFF';
            // Use broadcastBibleEvent so the blackout only reaches the bible stage,
            // NOT the timer stage (which has its own independent blackout control).
            await APIClient.broadcastBibleEvent(this.roomId, action, {});
            this._showToast(this._blackoutActive ? 'Black screen ON' : 'Black screen OFF', 'info');
        } catch (e) {
            console.error('[BibleController] Blackout error:', e);
        }
    },

    _copyVerse() {
        if (!this.selectedVerse) { this._showToast('Select a verse first', 'error'); return; }
        const ref = BibleData.formatReference(this.selectedVerse.book, this.selectedVerse.chapter, this.selectedVerse.verse, this.selectedVerse.verseEnd, this.selectedVerse.version);
        const text = `"${this.selectedVerse.text}"\n— ${ref}`;
        navigator.clipboard.writeText(text).then(() => this._showToast('Copied to clipboard', 'success')).catch(() => this._showToast('Copy failed', 'error'));
    },

    async _broadcastVerse(verse) {
        try {
            await APIClient.broadcastBibleVerse(this.roomId, {
                book: verse.book, chapter: verse.chapter, verse: verse.verse,
                verseEnd: verse.verseEnd, text: verse.text, version: verse.version
            }, { ...this._style, transition: this._transition });
        } catch (e) {
            console.error('[BibleController] Broadcast error:', e);
        }
    },

    // ===== PRESENT MODE =====

    _startPresentation() {
        this._storeCurrentVerse();
        // Open a fullscreen popup window for presentation
        const width = screen.width;
        const height = screen.height;
        const features = `width=${width},height=${height},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes`;
        this._presentWindow = window.open(`bible-stage.html?room=${this.roomId}&present=1`, 'BiblePresent', features);
        if (this._presentWindow) {
            // Try to go fullscreen after a short delay
            setTimeout(() => {
                try {
                    if (this._presentWindow.document && this._presentWindow.document.documentElement) {
                        this._presentWindow.document.documentElement.requestFullscreen?.();
                    }
                } catch (e) { /* cross-origin or timing issues */ }
            }, 1000);
            this._showToast('Presentation started', 'success');
        } else {
            this._showToast('Popup blocked - allow popups for this site', 'error');
        }
    },

    // ===== APPLY DESIGN =====

    _applyCurrentDesign() {
        if (this.selectedVerse) {
            this._broadcastVerse(this.selectedVerse);
            this._storeCurrentVerse();
            this._showToast('Design applied to stage', 'success');
        } else {
            this._showToast('Select a verse first', 'error');
        }
    },

    _applyCurrentTransition() {
        this._saveStyle();
        if (this.selectedVerse) {
            this._broadcastVerse(this.selectedVerse);
            this._storeCurrentVerse();
        }
        this._showToast(`Transition "${this.TRANSITIONS[this._transition]?.name || this._transition}" applied`, 'success');
    },

    // ===== SAVED VERSES (was Presets) =====

    async _loadPresets() {
        try {
            this._presets = await APIClient.getBiblePresets(this.roomId);
            // Restore custom order from localStorage
            const savedOrder = this._loadPresetOrder();
            if (savedOrder.length) {
                this._presets.sort((a, b) => {
                    const ai = savedOrder.indexOf(String(a.id));
                    const bi = savedOrder.indexOf(String(b.id));
                    return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
                });
            }
            this._renderPresets();
        } catch (e) { console.error('[BibleController] Load presets error:', e); }
    },

    _loadPresetOrder() {
        try { return JSON.parse(localStorage.getItem('b1g_preset_order') || '[]'); } catch (e) { return []; }
    },

    _savePresetOrder() {
        const ids = this._presets.map(p => String(p.id));
        localStorage.setItem('b1g_preset_order', JSON.stringify(ids));
    },

    _renderPresets() {
        const list = document.getElementById('preset-list');
        if (!list) return;
        if (this._presets.length === 0) {
            list.innerHTML = '<li style="padding:12px;text-align:center;color:var(--text-secondary);font-size:.8rem;">No saved verses yet. Click "+ Save Current Verse" to add one.</li>';
            if (this._presetSortable) { this._presetSortable.destroy(); this._presetSortable = null; }
            return;
        }
        list.innerHTML = '';
        this._presets.forEach(p => {
            const li = document.createElement('li');
            li.className = 'preset-item';
            li.dataset.id = p.id;
            const ref = `${p.book} ${p.chapter}:${p.verse_start}${p.verse_end ? '-' + p.verse_end : ''} (${p.version})`;
            li.innerHTML = `<span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span><span class="label">${this._esc(p.label)}</span><span class="ref">${this._esc(ref)}</span><button class="delete-btn" title="Delete"><i class="fas fa-trash"></i></button>`;
            li.addEventListener('click', (e) => {
                if (e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) return;
                this._showReader(p.book, parseInt(p.chapter, 10), parseInt(p.verse_start, 10));
            });
            li.querySelector('.delete-btn').addEventListener('click', async () => {
                try {
                    await APIClient.deleteBiblePreset(p.id);
                    this._presets = this._presets.filter(x => x.id !== p.id);
                    this._savePresetOrder();
                    this._renderPresets();
                    this._showToast('Verse removed', 'info');
                } catch (e) { this._showToast('Delete failed', 'error'); }
            });
            list.appendChild(li);
        });

        // Init SortableJS for drag-to-reorder
        if (this._presetSortable) this._presetSortable.destroy();
        if (typeof Sortable !== 'undefined') {
            this._presetSortable = Sortable.create(list, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: () => {
                    // Re-sync _presets array to match new DOM order
                    const newOrder = Array.from(list.querySelectorAll('.preset-item[data-id]'))
                        .map(el => String(el.dataset.id));
                    this._presets.sort((a, b) => {
                        return newOrder.indexOf(String(a.id)) - newOrder.indexOf(String(b.id));
                    });
                    this._savePresetOrder();
                    this._showToast('Order saved', 'success');
                }
            });
        }
    },

    async _addPreset() {
        if (!this.selectedVerse) { this._showToast('Select a verse first', 'error'); return; }
        const v = this.selectedVerse;
        const label = BibleData.formatReference(v.book, v.chapter, v.verse, v.verseEnd, v.version);
        try {
            const created = await APIClient.createBiblePreset({
                room_id: this.roomId, label, book: v.book, chapter: v.chapter,
                verse_start: parseInt(v.verse, 10), verse_end: v.verseEnd ? parseInt(v.verseEnd, 10) : null, version: v.version
            });
            this._presets.push(created);
            this._renderPresets();
            this._showToast('Verse saved!', 'success');
        } catch (e) { this._showToast('Save failed', 'error'); }
    },

    // ===== READER FONT SIZE =====

    _restoreReaderFontSize() {
        const saved = parseInt(localStorage.getItem('b1g_reader_font_size') || '14', 10);
        this._readerFontSize = saved;
        const sel = document.getElementById('reader-font-size');
        if (sel) sel.value = String(saved);
        this._applyReaderFontSize();
    },

    _setReaderFontSize(size) {
        this._readerFontSize = size;
        localStorage.setItem('b1g_reader_font_size', String(size));
        this._applyReaderFontSize();
    },

    _applyReaderFontSize() {
        // Update all currently-rendered verse-text elements
        document.querySelectorAll('#reader-content .verse-text').forEach(el => {
            el.style.fontSize = this._readerFontSize + 'px';
        });
    },

    // ===== RECENT VERSES =====

    _restoreRecent() {
        try {
            this._recentVerses = JSON.parse(localStorage.getItem('b1g_bible_recent') || '[]').slice(0, 10);
            this._renderRecent();
        } catch (e) { this._recentVerses = []; }
    },

    _addToRecent(verse) {
        const ref = BibleData.formatReference(verse.book, verse.chapter, verse.verse, verse.verseEnd, verse.version);
        this._recentVerses = this._recentVerses.filter(r => r.ref !== ref);
        this._recentVerses.unshift({ ...verse, ref });
        if (this._recentVerses.length > 10) this._recentVerses.pop();
        localStorage.setItem('b1g_bible_recent', JSON.stringify(this._recentVerses));
        this._renderRecent();
    },

    _renderRecent() {
        const el = document.getElementById('recent-list');
        if (!el) return;
        if (this._recentVerses.length === 0) {
            el.innerHTML = '<div style="font-size:.75rem;color:var(--text-secondary);">No recent verses</div>';
            return;
        }
        el.innerHTML = '';
        this._recentVerses.forEach(r => {
            const div = document.createElement('div');
            div.className = 'recent-item';
            div.textContent = r.ref;
            div.addEventListener('click', () => {
                this._showReader(r.book, r.chapter, r.verse ? parseInt(r.verse, 10) : null);
                this.selectedVerse = r;
            });
            el.appendChild(div);
        });
    },

    // ===== STYLE MANAGEMENT =====

    _restoreStyle() {
        try {
            const saved = localStorage.getItem('b1g_bible_style_controller');
            if (saved) {
                const parsed = JSON.parse(saved);
                this._style = parsed;
                this._selectedDesign = parsed.preset || 'classic';
                this._transition = parsed.transition || 'fade';
                this._syncStyleControls();
            }
        } catch (e) { /* defaults */ }
    },

    _saveStyle() {
        localStorage.setItem('b1g_bible_style_controller', JSON.stringify(this._style));
    },

    // ===== DESIGN GALLERY (sidebar) =====

    _renderDesignGallery() {
        const gallery = document.getElementById('design-gallery');
        if (!gallery) return;
        gallery.innerHTML = '';
        const sampleVerse = '"For God so loved the world..."';
        const sampleRef = 'John 3:16';
        // Show first 6 in sidebar
        const designKeys = Object.keys(this.PRESETS).slice(0, 6);
        designKeys.forEach(key => {
            const preset = this.PRESETS[key];
            const card = this._createDesignCard(key, preset, sampleVerse, sampleRef, 'design-card');
            card.addEventListener('click', () => this._selectDesign(key));
            gallery.appendChild(card);
        });
    },

    _createDesignCard(key, preset, sampleVerse, sampleRef, className) {
        const card = document.createElement('div');
        card.className = className + (key === this._selectedDesign ? ' active' : '');
        card.dataset.design = key;
        const p = preset.preview;
        const bgStyle = `background:${p.bg};`;
        card.innerHTML = `
            <div class="${className === 'modal-tile' ? 'tile-thumb' : 'design-thumb'}" style="${bgStyle}">
                <span class="${className === 'modal-tile' ? 't-verse' : 'thumb-verse'}" style="color:${p.text};font-family:${p.font};">${sampleVerse}</span>
                <span class="${className === 'modal-tile' ? 't-ref' : 'thumb-ref'}" style="color:${p.text};font-family:${p.font};">${sampleRef}</span>
            </div>
            <div class="${className === 'modal-tile' ? 'tile-label' : 'design-label'}">${preset.name}</div>
        `;
        return card;
    },

    // ===== TRANSITION GALLERY (sidebar) =====

    _renderTransitionGallery() {
        const gallery = document.getElementById('transition-gallery');
        if (!gallery) return;
        gallery.innerHTML = '';
        const transKeys = Object.keys(this.TRANSITIONS).slice(0, 4);
        transKeys.forEach(key => {
            const t = this.TRANSITIONS[key];
            const card = document.createElement('div');
            card.className = 'transition-card' + (key === this._transition ? ' active' : '');
            card.dataset.transition = key;
            card.innerHTML = `
                <div class="transition-thumb"><i class="fas ${t.icon}"></i></div>
                <div class="transition-label">${t.name}</div>
            `;
            card.addEventListener('click', () => {
                this._transition = key;
                this._style.transition = key;
                this._saveStyle();
                document.querySelectorAll('.transition-card').forEach(c => c.classList.toggle('active', c.dataset.transition === key));
            });
            gallery.appendChild(card);
        });
    },

    // ===== DESIGN MODAL =====

    _openDesignModal() {
        this._modalSelectedDesign = this._selectedDesign;
        this._updateDesignModalPreview(this._selectedDesign);
        document.querySelectorAll('#design-modal-grid .modal-tile').forEach(t =>
            t.classList.toggle('active', t.dataset.design === this._selectedDesign));
        document.getElementById('design-modal')?.classList.add('open');
    },

    _renderDesignModal() {
        const grid = document.getElementById('design-modal-grid');
        if (!grid) return;
        grid.innerHTML = '';
        const sampleVerse = '"For God so loved the world..."';
        const sampleRef = 'John 3:16';
        Object.entries(this.PRESETS).forEach(([key, preset]) => {
            const card = this._createDesignCard(key, preset, sampleVerse, sampleRef, 'modal-tile');
            card.addEventListener('click', () => {
                this._modalSelectedDesign = key;
                document.querySelectorAll('#design-modal-grid .modal-tile').forEach(t =>
                    t.classList.toggle('active', t.dataset.design === key));
                this._updateDesignModalPreview(key);
            });
            grid.appendChild(card);
        });
    },

    _updateDesignModalPreview(designKey) {
        const preset = this.PRESETS[designKey];
        if (!preset) return;
        const preview = document.getElementById('design-modal-preview');
        const nameEl = document.getElementById('design-modal-name');
        const descEl = document.getElementById('design-modal-desc');
        if (!preview) return;

        const p = preset.preview;
        preview.style.background = p.bg;
        preview.classList.remove('has-overlay');

        const verseText = this.selectedVerse?.text || '"For God so loved the world, that he gave his only Son..."';
        const refText = this.selectedVerse ?
            BibleData.formatReference(this.selectedVerse.book, this.selectedVerse.chapter, this.selectedVerse.verse, this.selectedVerse.verseEnd, this.selectedVerse.version) :
            'John 3:16 (ESV)';
        const displayText = verseText.length > 80 ? verseText.substring(0, 80) + '...' : verseText;

        preview.innerHTML = `
            <span class="prev-verse" style="color:${p.text};font-family:${p.font};">${this._esc(displayText)}</span>
            <span class="prev-ref" style="color:${p.text};font-family:${p.font};opacity:.6;">${this._esc(refText)}</span>
        `;
        if (nameEl) nameEl.textContent = preset.name;
        if (descEl) descEl.textContent = preset.desc || '';
    },

    _applyDesignFromModal() {
        if (this._modalSelectedDesign) {
            this._selectDesign(this._modalSelectedDesign);
            if (this.selectedVerse) {
                this._broadcastVerse(this.selectedVerse);
                this._storeCurrentVerse();
            }
            this._showToast(`Design "${this.PRESETS[this._modalSelectedDesign]?.name}" applied`, 'success');
        }
        document.getElementById('design-modal')?.classList.remove('open');
    },

    // ===== TRANSITION MODAL =====

    _openTransitionModal() {
        this._modalSelectedTransition = this._transition;
        this._updateTransitionModalPreview(this._transition);
        document.querySelectorAll('#transition-modal-grid .modal-tile').forEach(t =>
            t.classList.toggle('active', t.dataset.transition === this._transition));
        document.getElementById('transition-modal')?.classList.add('open');
    },

    _renderTransitionModal() {
        const grid = document.getElementById('transition-modal-grid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.entries(this.TRANSITIONS).forEach(([key, trans]) => {
            const card = document.createElement('div');
            card.className = 'modal-tile' + (key === this._transition ? ' active' : '');
            card.dataset.transition = key;
            card.innerHTML = `
                <div class="tile-thumb" style="background:var(--bg-card);"><i class="fas ${trans.icon}" style="font-size:1.5em;color:var(--accent);"></i></div>
                <div class="tile-label">${trans.name}</div>
            `;
            card.addEventListener('click', () => {
                this._modalSelectedTransition = key;
                document.querySelectorAll('#transition-modal-grid .modal-tile').forEach(t =>
                    t.classList.toggle('active', t.dataset.transition === key));
                this._updateTransitionModalPreview(key);
            });
            grid.appendChild(card);
        });
    },

    _updateTransitionModalPreview(transKey) {
        const trans = this.TRANSITIONS[transKey];
        if (!trans) return;
        const nameEl = document.getElementById('transition-modal-name');
        const descEl = document.getElementById('transition-modal-desc');
        if (nameEl) nameEl.textContent = trans.name;
        if (descEl) descEl.textContent = trans.desc || '';
        this._previewTransitionAnimation(transKey);
    },

    _previewTransitionAnimation(transKey) {
        const key = transKey || this._modalSelectedTransition || 'fade';
        const preview = document.getElementById('transition-modal-preview');
        if (!preview) return;

        const animText = preview.querySelector('.anim-text');
        if (!animText) return;

        // Reset
        animText.style.animation = 'none';
        animText.style.opacity = '0';

        const animMap = {
            none: 'none',
            fade: 'fadeIn 0.6s ease forwards',
            'slide-up': 'slideUpIn 0.6s ease forwards',
            'slide-down': 'slideDownIn 0.6s ease forwards',
            'slide-left': 'slideLeftIn 0.6s ease forwards',
            'slide-right': 'slideRightIn 0.6s ease forwards',
            'zoom-in': 'zoomInAnim 0.6s ease forwards',
            'zoom-out': 'zoomOutAnim 0.6s ease forwards',
            'flip': 'flipAnim 0.6s ease forwards',
            'blur': 'blurAnim 0.6s ease forwards',
            'typewriter': 'fadeIn 0.6s ease forwards',
            'scale-fade': 'scaleFadeIn 0.6s ease forwards',
        };

        requestAnimationFrame(() => {
            if (key === 'none') {
                animText.style.opacity = '1';
            } else {
                animText.style.animation = animMap[key] || 'fadeIn 0.6s ease forwards';
            }
        });
    },

    _applyTransitionFromModal() {
        if (this._modalSelectedTransition) {
            this._transition = this._modalSelectedTransition;
            this._style.transition = this._transition;
            this._saveStyle();
            // Update sidebar gallery
            document.querySelectorAll('.transition-card').forEach(c =>
                c.classList.toggle('active', c.dataset.transition === this._transition));
            if (this.selectedVerse) {
                this._broadcastVerse(this.selectedVerse);
                this._storeCurrentVerse();
            }
            this._showToast(`Transition "${this.TRANSITIONS[this._transition]?.name}" applied`, 'success');
        }
        document.getElementById('transition-modal')?.classList.remove('open');
    },

    // ===== DESIGN SELECTION =====

    _selectDesign(name) {
        const preset = this.PRESETS[name];
        if (!preset) return;
        this._selectedDesign = name;
        this._style = {
            preset: name, fontFamily: preset.fontFamily, fontSize: preset.fontSize,
            refFontSize: preset.refFontSize, textColor: preset.textColor, bgType: preset.bgType,
            bgColor: preset.bgColor, textAlign: preset.textAlign, refPosition: preset.refPosition,
            bgImage: null, transition: this._transition
        };
        this._selectedBgImage = null;
        this._syncStyleControls();
        this._saveStyle();
        this._updateStagePreview();
        document.querySelectorAll('.design-card').forEach(c =>
            c.classList.toggle('active', c.dataset.design === name));
        document.querySelectorAll('.bg-image-thumb').forEach(t => t.classList.remove('selected'));
    },

    _updateStyleFromControls() {
        const sizeVal = document.getElementById('style-font-size')?.value || 'large';
        this._style = {
            preset: 'custom',
            fontFamily: document.getElementById('style-font-family')?.value || "'Georgia', serif",
            fontSize: this.FONT_SIZE_MAP[sizeVal] || '5vw',
            refFontSize: this.REF_SIZE_MAP[sizeVal] || '2.5vw',
            textColor: document.getElementById('style-text-color')?.value || '#ffffff',
            bgType: document.getElementById('style-bg-type')?.value || 'solid',
            bgColor: document.getElementById('style-bg-color')?.value || '#000000',
            textAlign: document.getElementById('style-text-align')?.value || 'center',
            refPosition: document.getElementById('style-ref-position')?.value || 'bottom-center',
            bgImage: this._selectedBgImage,
            transition: this._transition
        };
        this._selectedDesign = 'custom';
        document.querySelectorAll('.design-card').forEach(c => c.classList.remove('active'));
        const bgColorRow = document.getElementById('bg-color-row');
        if (bgColorRow) bgColorRow.style.display = this._style.bgType === 'image' ? 'none' : '';
        this._saveStyle();
        this._updateStagePreview();
    },

    _syncStyleControls() {
        const s = this._style;
        const el = (id) => document.getElementById(id);
        if (el('style-font-family')) el('style-font-family').value = s.fontFamily || "'Georgia', serif";
        if (el('style-text-color')) el('style-text-color').value = s.textColor || '#ffffff';
        if (el('style-bg-type')) el('style-bg-type').value = s.bgType || 'solid';
        if (el('style-bg-color')) el('style-bg-color').value = (s.bgType === 'solid' && s.bgColor) ? s.bgColor : '#000000';
        if (el('style-text-align')) el('style-text-align').value = s.textAlign || 'center';
        if (el('style-ref-position')) el('style-ref-position').value = s.refPosition || 'bottom-center';
        const sizeMap = { '3vw': 'small', '3.5vw': 'small', '4vw': 'normal', '4.5vw': 'normal', '5vw': 'large', '5.5vw': 'large', '6vw': 'xlarge', '6.5vw': 'xlarge' };
        if (el('style-font-size')) el('style-font-size').value = sizeMap[s.fontSize] || 'large';
        document.querySelectorAll('.design-card').forEach(c =>
            c.classList.toggle('active', c.dataset.design === s.preset));
        const bgColorRow = document.getElementById('bg-color-row');
        if (bgColorRow) bgColorRow.style.display = s.bgType === 'image' ? 'none' : '';
    },

    // ===== STAGE PREVIEW =====

    _updateStagePreview() {
        const preview = document.getElementById('stage-preview');
        if (!preview) return;
        const s = this._style;
        const hasVerse = !!this.selectedVerse;

        if (s.bgType === 'image' && s.bgImage) {
            preview.style.background = `url(../${s.bgImage}) center/cover no-repeat`;
            preview.classList.add('has-overlay');
        } else if (s.bgType === 'gradient') {
            preview.style.background = s.bgColor || 'linear-gradient(135deg, #1a1a2e, #16213e)';
            preview.classList.remove('has-overlay');
        } else {
            preview.style.background = s.bgColor || '#000000';
            preview.classList.remove('has-overlay');
        }

        if (hasVerse) {
            const ref = BibleData.formatReference(this.selectedVerse.book, this.selectedVerse.chapter, this.selectedVerse.verse, this.selectedVerse.verseEnd, this.selectedVerse.version);
            const text = this.selectedVerse.text || '';
            const displayText = text.length > 80 ? text.substring(0, 80) + '...' : text;
            preview.innerHTML = `
                <span class="preview-verse" style="color:${s.textColor};font-family:${s.fontFamily};text-align:${s.textAlign};">${this._esc(displayText)}</span>
                <span class="preview-ref" style="color:${s.textColor};font-family:${s.fontFamily};">${this._esc(ref)}</span>
            `;
        } else {
            preview.innerHTML = '<span class="preview-empty">Select a verse to preview</span>';
        }
    },

    // ===== BACKGROUND IMAGES =====

    async _loadBgImages() {
        try {
            this._bgImages = await APIClient.listBibleBackgrounds();
            this._renderBgImages();
        } catch (e) { /* ignore */ }
    },

    _renderBgImages() {
        const grid = document.getElementById('bg-images-grid');
        if (!grid) return;
        grid.innerHTML = '';
        this._bgImages.forEach(img => {
            const thumb = document.createElement('div');
            thumb.className = 'bg-image-thumb' + (this._selectedBgImage === img.url ? ' selected' : '');
            thumb.style.backgroundImage = `url(../${img.url})`;
            thumb.innerHTML = `<button class="remove-bg" title="Remove"><i class="fas fa-times"></i></button>`;
            thumb.addEventListener('click', (e) => {
                if (e.target.closest('.remove-bg')) return;
                this._selectedBgImage = img.url;
                this._style.bgType = 'image';
                this._style.bgImage = img.url;
                this._selectedDesign = 'custom';
                document.querySelectorAll('.bg-image-thumb').forEach(t => t.classList.remove('selected'));
                thumb.classList.add('selected');
                document.querySelectorAll('.design-card').forEach(c => c.classList.remove('active'));
                const bgType = document.getElementById('style-bg-type');
                if (bgType) bgType.value = 'image';
                this._saveStyle();
                this._updateStagePreview();
            });
            thumb.querySelector('.remove-bg').addEventListener('click', async () => {
                try {
                    await APIClient.deleteBibleBackground(img.filename);
                    this._bgImages = this._bgImages.filter(x => x.filename !== img.filename);
                    if (this._selectedBgImage === img.url) {
                        this._selectedBgImage = null;
                        this._style.bgImage = null;
                        this._saveStyle();
                    }
                    this._renderBgImages();
                    this._showToast('Background removed', 'info');
                } catch (e) { this._showToast('Remove failed', 'error'); }
            });
            grid.appendChild(thumb);
        });
    },

    async _uploadBgImage(file) {
        try {
            this._showToast('Uploading...', 'info');
            const result = await APIClient.uploadBibleBackground(file);
            this._bgImages.push(result);
            this._renderBgImages();
            this._showToast('Background uploaded', 'success');
        } catch (e) { this._showToast(e.message || 'Upload failed', 'error'); }
    },

    // ===== SIDEBAR TABS =====

    _switchSidebarTab(tabName) {
        document.querySelectorAll('.sidebar-tab').forEach(t =>
            t.classList.toggle('active', t.dataset.tab === tabName));
        document.querySelectorAll('.sidebar-panel').forEach(p =>
            p.classList.toggle('active', p.id === `panel-${tabName}`));
    },

    // ===== BROADCAST CHANNEL =====

    _setupBroadcastChannel() {
        try {
            // Uses the dedicated Bible BroadcastChannel, separate from the timer channel.
            // This keeps timer events and bible events fully isolated from each other.
            this._channel = new BroadcastChannel('b1g-bible-room-' + this.roomId);
        } catch (e) { /* not supported */ }
    },

    _updateConnectionDot(connected) {
        const dot = document.getElementById('connection-dot');
        if (dot) { dot.classList.toggle('connected', connected); dot.title = connected ? 'Connected' : 'Disconnected'; }
    },

    // ===== UTILITIES =====

    _esc(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    _abbrev(book) {
        const abbrevs = {
            'Genesis': 'Gen', 'Exodus': 'Exo', 'Leviticus': 'Lev', 'Numbers': 'Num',
            'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg', 'Ruth': 'Ruth',
            '1 Samuel': '1 Sam', '2 Samuel': '2 Sam', '1 Kings': '1 Ki', '2 Kings': '2 Ki',
            '1 Chronicles': '1 Chr', '2 Chronicles': '2 Chr', 'Ezra': 'Ezra', 'Nehemiah': 'Neh',
            'Esther': 'Est', 'Job': 'Job', 'Psalms': 'Ps', 'Proverbs': 'Prov',
            'Ecclesiastes': 'Eccl', 'Song of Solomon': 'Song', 'Isaiah': 'Isa', 'Jeremiah': 'Jer',
            'Lamentations': 'Lam', 'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos',
            'Joel': 'Joel', 'Amos': 'Amos', 'Obadiah': 'Obad', 'Jonah': 'Jonah',
            'Micah': 'Mic', 'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zeph',
            'Haggai': 'Hag', 'Zechariah': 'Zech', 'Malachi': 'Mal',
            'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
            'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1 Cor', '2 Corinthians': '2 Cor',
            'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
            '1 Thessalonians': '1 Thes', '2 Thessalonians': '2 Thes', '1 Timothy': '1 Tim',
            '2 Timothy': '2 Tim', 'Titus': 'Titus', 'Philemon': 'Phlm', 'Hebrews': 'Heb',
            'James': 'Jas', '1 Peter': '1 Pet', '2 Peter': '2 Pet', '1 John': '1 Jn',
            '2 John': '2 Jn', '3 John': '3 Jn', 'Jude': 'Jude', 'Revelation': 'Rev'
        };
        return abbrevs[book] || book;
    },

    _showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this._esc(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
};

window.addEventListener('DOMContentLoaded', () => BibleController.init());
window.BibleController = BibleController;

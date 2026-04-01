/**
 * B1G Timer - Bible Search & Navigation (Dashboard-side)
 * Provides LifeBible-style tiered navigation and search for the control panel
 */

const BibleSearch = {
    _currentBook: null,
    _currentChapter: null,
    _selectedVerse: null,
    _searchTimeout: null,
    _isDisplayed: false,

    /**
     * Initialize Bible panel
     */
    async init() {
        BibleStyleManager.init();

        // Search bar
        const searchInput = document.getElementById('bible-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._searchTimeout);
                this._searchTimeout = setTimeout(() => this._onSearch(searchInput.value), 300);
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(this._searchTimeout);
                    this._onSearch(searchInput.value);
                }
            });
        }

        // Back button
        const backBtn = document.getElementById('bible-nav-back');
        if (backBtn) backBtn.addEventListener('click', () => this._navigateBack());

        // Display button
        const displayBtn = document.getElementById('bible-display-btn');
        if (displayBtn) displayBtn.addEventListener('click', () => this._displayVerse());

        // Clear button
        const clearBtn = document.getElementById('bible-clear-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => this._clearVerse());

        // Load books view
        await this._showBooks();

        console.log('[BibleSearch] Initialized');
    },

    /**
     * Handle search input
     */
    async _onSearch(query) {
        const trimmed = query.trim();
        if (!trimmed) {
            this._clearSearch();
            return;
        }

        const resultsEl = document.getElementById('bible-search-results');
        const navEl = document.getElementById('bible-nav-grid');
        if (!resultsEl || !navEl) return;

        // Show loading
        resultsEl.innerHTML = '<div class="bible-loading">Searching...</div>';
        resultsEl.style.display = 'block';
        navEl.style.display = 'none';

        // Try direct reference first
        const refResult = await BibleData.searchByReference(trimmed);
        if (refResult) {
            if (refResult.isChapter) {
                // Navigate to that chapter
                this._currentBook = refResult.book;
                this._currentChapter = refResult.chapter;
                resultsEl.style.display = 'none';
                navEl.style.display = '';
                await this._showVerses(refResult.book, refResult.chapter);
                return;
            }
            // Direct verse match
            this._selectedVerse = refResult;
            resultsEl.innerHTML = '';
            resultsEl.appendChild(this._createSearchResult(refResult, true));
            this._updatePreview(refResult);
            return;
        }

        // Keyword search
        const results = await BibleData.searchByKeyword(trimmed);
        if (results.length === 0) {
            resultsEl.innerHTML = '<div class="bible-empty">No results found</div>';
            return;
        }

        resultsEl.innerHTML = '';
        results.forEach(r => {
            resultsEl.appendChild(this._createSearchResult(r, false));
        });
    },

    /**
     * Create a search result item element
     */
    _createSearchResult(result, isExact) {
        const item = document.createElement('div');
        item.className = 'bible-search-item' + (isExact ? ' exact' : '');

        const ref = BibleData.formatReference(result.book, result.chapter, result.verse, result.verseEnd, result.version);
        const textPreview = result.snippet || (result.text ? result.text.substring(0, 120) + (result.text.length > 120 ? '...' : '') : '');

        item.innerHTML = `
            <div class="bible-search-ref">${this._escapeHtml(ref)}</div>
            <div class="bible-search-text">${this._escapeHtml(textPreview)}</div>
        `;

        item.addEventListener('click', () => {
            this._selectedVerse = result;
            this._updatePreview(result);
            // Highlight selected
            document.querySelectorAll('.bible-search-item.selected').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
        });

        return item;
    },

    /**
     * Clear search and return to navigation
     */
    _clearSearch() {
        const resultsEl = document.getElementById('bible-search-results');
        const navEl = document.getElementById('bible-nav-grid');
        const searchInput = document.getElementById('bible-search-input');
        if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
        if (navEl) navEl.style.display = '';
        if (searchInput) searchInput.value = '';
    },

    // ─── Tiered Navigation ───────────────────────────────────────────

    /**
     * Show books grid (Level 1)
     */
    async _showBooks() {
        this._currentBook = null;
        this._currentChapter = null;
        this._updateBreadcrumb();

        const grid = document.getElementById('bible-nav-grid');
        if (!grid) return;

        const books = await BibleData.getBooks();
        grid.innerHTML = '';

        // OT header
        const otHeader = document.createElement('div');
        otHeader.className = 'bible-section-header';
        otHeader.textContent = 'Old Testament';
        grid.appendChild(otHeader);

        const otGrid = document.createElement('div');
        otGrid.className = 'bible-books-grid';
        books.slice(0, BibleData.OT_COUNT).forEach(book => {
            otGrid.appendChild(this._createBookBtn(book));
        });
        grid.appendChild(otGrid);

        // NT header
        const ntHeader = document.createElement('div');
        ntHeader.className = 'bible-section-header';
        ntHeader.textContent = 'New Testament';
        grid.appendChild(ntHeader);

        const ntGrid = document.createElement('div');
        ntGrid.className = 'bible-books-grid';
        books.slice(BibleData.OT_COUNT).forEach(book => {
            ntGrid.appendChild(this._createBookBtn(book));
        });
        grid.appendChild(ntGrid);

        // Hide back button at top level
        const backBtn = document.getElementById('bible-nav-back');
        if (backBtn) backBtn.style.display = 'none';
    },

    _createBookBtn(book) {
        const btn = document.createElement('button');
        btn.className = 'bible-book-btn';
        btn.textContent = this._abbreviateBook(book);
        btn.title = book;
        btn.addEventListener('click', () => this._showChapters(book));
        return btn;
    },

    /**
     * Show chapters grid (Level 2)
     */
    async _showChapters(book) {
        this._currentBook = book;
        this._currentChapter = null;
        this._updateBreadcrumb();

        const grid = document.getElementById('bible-nav-grid');
        if (!grid) return;

        const chapters = await BibleData.getChapters(book);
        grid.innerHTML = '';

        const chGrid = document.createElement('div');
        chGrid.className = 'bible-chapters-grid';
        chapters.forEach(ch => {
            const btn = document.createElement('button');
            btn.className = 'bible-chapter-btn';
            btn.textContent = ch;
            btn.addEventListener('click', () => this._showVerses(book, ch));
            chGrid.appendChild(btn);
        });
        grid.appendChild(chGrid);

        // Show back button
        const backBtn = document.getElementById('bible-nav-back');
        if (backBtn) backBtn.style.display = '';
    },

    /**
     * Show verses list (Level 3)
     */
    async _showVerses(book, chapter) {
        this._currentBook = book;
        this._currentChapter = chapter;
        this._updateBreadcrumb();

        const grid = document.getElementById('bible-nav-grid');
        if (!grid) return;

        const verses = await BibleData.getVerses(book, chapter);
        grid.innerHTML = '';

        const verseList = document.createElement('div');
        verseList.className = 'bible-verses-list';

        for (const v of verses) {
            const text = await BibleData.getVerse(book, chapter, v);
            const item = document.createElement('div');
            item.className = 'bible-verse-item';
            item.dataset.verse = v;

            const preview = text ? (text.length > 90 ? text.substring(0, 90) + '...' : text) : '';
            item.innerHTML = `
                <span class="bible-verse-num">${v}</span>
                <span class="bible-verse-preview">${this._escapeHtml(preview)}</span>
            `;

            item.addEventListener('click', async () => {
                const fullText = await BibleData.getVerse(book, chapter, v);
                this._selectedVerse = {
                    book, chapter, verse: String(v), verseEnd: null,
                    text: fullText, version: BibleData.getVersion()
                };
                this._updatePreview(this._selectedVerse);
                // Highlight
                document.querySelectorAll('.bible-verse-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            });

            verseList.appendChild(item);
        }
        grid.appendChild(verseList);

        const backBtn = document.getElementById('bible-nav-back');
        if (backBtn) backBtn.style.display = '';
    },

    /**
     * Navigate back one level
     */
    _navigateBack() {
        if (this._currentChapter !== null) {
            this._showChapters(this._currentBook);
        } else if (this._currentBook !== null) {
            this._showBooks();
        }
    },

    /**
     * Update breadcrumb display
     */
    _updateBreadcrumb() {
        const el = document.getElementById('bible-breadcrumb');
        if (!el) return;

        const parts = ['<span class="bible-crumb" data-level="books">Books</span>'];
        if (this._currentBook) {
            parts.push('<span class="bible-crumb-sep">›</span>');
            parts.push(`<span class="bible-crumb" data-level="chapters">${this._escapeHtml(this._currentBook)}</span>`);
        }
        if (this._currentChapter !== null) {
            parts.push('<span class="bible-crumb-sep">›</span>');
            parts.push(`<span class="bible-crumb active">Chapter ${this._currentChapter}</span>`);
        }
        el.innerHTML = parts.join(' ');

        // Make breadcrumb items clickable
        el.querySelectorAll('.bible-crumb').forEach(crumb => {
            crumb.addEventListener('click', () => {
                const level = crumb.dataset.level;
                if (level === 'books') this._showBooks();
                else if (level === 'chapters') this._showChapters(this._currentBook);
            });
        });
    },

    // ─── Preview & Broadcast ─────────────────────────────────────────

    /**
     * Update the verse preview card
     */
    _updatePreview(verseData) {
        const previewCard = document.getElementById('bible-preview-card');
        const previewText = document.getElementById('bible-preview-text');
        const previewRef = document.getElementById('bible-preview-ref');
        if (!previewCard || !previewText || !previewRef) return;

        if (!verseData) {
            previewCard.style.display = 'none';
            return;
        }

        previewText.textContent = verseData.text || '';
        previewRef.textContent = BibleData.formatReference(
            verseData.book, verseData.chapter, verseData.verse, verseData.verseEnd, verseData.version
        );
        previewCard.style.display = 'block';
    },

    /**
     * Display selected verse on stage
     */
    async _displayVerse() {
        if (!this._selectedVerse) {
            if (typeof ControlDashboard !== 'undefined') {
                ControlDashboard.showToast('Select a verse first', 'warning');
            }
            return;
        }

        const roomId = StateManager.state.selectedRoomId;
        if (!roomId) {
            if (typeof ControlDashboard !== 'undefined') {
                ControlDashboard.showToast('Select a room first', 'warning');
            }
            return;
        }

        const style = BibleStyleManager.getStyle();
        const payload = {
            book: this._selectedVerse.book,
            chapter: this._selectedVerse.chapter,
            verse: this._selectedVerse.verse,
            verseEnd: this._selectedVerse.verseEnd,
            text: this._selectedVerse.text,
            version: this._selectedVerse.version || BibleData.getVersion(),
            style
        };

        try {
            await APIClient.broadcastEvent(roomId, 'BIBLE_VERSE_UPDATE', payload);
            this._isDisplayed = true;
            this._updateDisplayStatus(true);
            if (typeof ControlDashboard !== 'undefined') {
                ControlDashboard.showToast('Verse sent to stage', 'success');
            }
        } catch (e) {
            console.error('[BibleSearch] Display error:', e);
            if (typeof ControlDashboard !== 'undefined') {
                ControlDashboard.showToast('Failed to display verse', 'error');
            }
        }
    },

    /**
     * Clear verse from stage
     */
    async _clearVerse() {
        const roomId = StateManager.state.selectedRoomId;
        if (!roomId) return;

        try {
            await APIClient.broadcastEvent(roomId, 'BIBLE_VERSE_CLEAR', {});
            this._isDisplayed = false;
            this._updateDisplayStatus(false);
            if (typeof ControlDashboard !== 'undefined') {
                ControlDashboard.showToast('Bible cleared from stage', 'info');
            }
        } catch (e) {
            console.error('[BibleSearch] Clear error:', e);
        }
    },

    /**
     * Update display status indicator
     */
    _updateDisplayStatus(isShowing) {
        const indicator = document.getElementById('bible-live-indicator');
        if (indicator) {
            indicator.classList.toggle('active', isShowing);
            indicator.textContent = isShowing ? 'LIVE' : '';
        }
        const clearBtn = document.getElementById('bible-clear-btn');
        if (clearBtn) clearBtn.style.display = isShowing ? 'inline-block' : 'none';
    },

    // ─── Helpers ─────────────────────────────────────────────────────

    _abbreviateBook(name) {
        const abbrevs = {
            'Genesis':'Gen','Exodus':'Exod','Leviticus':'Lev','Numbers':'Num',
            'Deuteronomy':'Deut','Joshua':'Josh','Judges':'Judg','Ruth':'Ruth',
            '1 Samuel':'1 Sam','2 Samuel':'2 Sam','1 Kings':'1 Kgs','2 Kings':'2 Kgs',
            '1 Chronicles':'1 Chr','2 Chronicles':'2 Chr','Ezra':'Ezra','Nehemiah':'Neh',
            'Esther':'Esth','Job':'Job','Psalms':'Ps','Proverbs':'Prov',
            'Ecclesiastes':'Eccl','Song of Solomon':'Song','Isaiah':'Isa','Jeremiah':'Jer',
            'Lamentations':'Lam','Ezekiel':'Ezek','Daniel':'Dan','Hosea':'Hos',
            'Joel':'Joel','Amos':'Amos','Obadiah':'Obad','Jonah':'Jonah',
            'Micah':'Mic','Nahum':'Nah','Habakkuk':'Hab','Zephaniah':'Zeph',
            'Haggai':'Hag','Zechariah':'Zech','Malachi':'Mal',
            'Matthew':'Matt','Mark':'Mark','Luke':'Luke','John':'John','Acts':'Acts',
            'Romans':'Rom','1 Corinthians':'1 Cor','2 Corinthians':'2 Cor',
            'Galatians':'Gal','Ephesians':'Eph','Philippians':'Phil',
            'Colossians':'Col','1 Thessalonians':'1 Thess','2 Thessalonians':'2 Thess',
            '1 Timothy':'1 Tim','2 Timothy':'2 Tim','Titus':'Titus','Philemon':'Phlm',
            'Hebrews':'Heb','James':'Jas','1 Peter':'1 Pet','2 Peter':'2 Pet',
            '1 John':'1 Jn','2 John':'2 Jn','3 John':'3 Jn','Jude':'Jude','Revelation':'Rev'
        };
        return abbrevs[name] || name;
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

window.BibleSearch = BibleSearch;

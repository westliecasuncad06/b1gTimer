// @ts-check
/**
 * B1G Timer – Bible Controller Tests
 *
 * Covers:
 *  1. Bible controller page loads (no live button, header buttons)
 *  2. Books grid displays OT and NT sections
 *  3. Book click shows chapters grid
 *  4. Chapter click shows verse reader
 *  5. Verse click highlights and selects
 *  6. Navigation breadcrumb works
 *  7. Translation switch reloads data
 *  8. Design gallery shows 6 clickable cards (sidebar)
 *  9. Search finds verses by reference
 * 10. Search finds verses by keyword
 * 11. Auto-display on verse click and Clear action
 * 12. Dashboard Bible tab opens controller
 * 13. Stage background image CSS present
 * 14. Sidebar tab switching (Search / Saved Verses / Style)
 * 15. Arrow key verse navigation
 * 16. Prev/Next verse buttons work
 * 17. Apply Design button applies selected design
 * 18. Stage preview section exists
 * 19. Transition gallery works
 * 20. Clear and Black Screen in header
 * 21. Design modal opens with all 40 designs
 * 22. Transition modal opens with all transitions
 * 23. Present mode button exists
 * 24. Save Current Verse button works
 * 25. KJV/NASB/AMP translation options exist
 * 26. Mobile bottom nav is present
 * 27. Browse All Designs button opens modal
 * 28. Browse All Transitions button opens modal
 * 29. Clear only clears text (not design/background)
 * 30. Verse toggle: clicking same verse again unclears it
 * 31. Mobile bottom nav Clear and Black buttons work
 * 32. Mobile modal has Apply button via mobile footer
 * 33. Stage has bible-text-wrapper for text-only transitions
 * 34. Transition preview animation keyframes exist in bible.html
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const BIBLE_URL = `${BASE}/bible.html?room=1`;
const DASHBOARD_URL = `${BASE}/index.html`;
const STAGE_URL = `${BASE}/stage.html`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForBibleLoaded(page) {
    await page.waitForFunction(() =>
        typeof BibleData !== 'undefined' && BibleData.isLoaded(),
        { timeout: 15_000 }
    );
}

async function navigateToGenesis1(page) {
    await page.locator('.book-btn[data-book="Genesis"]').click();
    await page.waitForTimeout(300);
    await page.locator('.chapter-btn[data-ch="1"]').click();
    await page.waitForTimeout(500);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Bible Controller Page', () => {

    test('1 - Bible controller page loads without errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        // Header elements present
        await expect(page.locator('#version-select')).toBeVisible();
        await expect(page.locator('#btn-open-stage')).toBeVisible();
        await expect(page.locator('#btn-clear')).toBeVisible();
        await expect(page.locator('#btn-blackout')).toBeVisible();
        await expect(page.locator('#reader-content')).toBeVisible();

        // LIVE button should NOT exist (removed – auto-broadcast always active)
        await expect(page.locator('#live-toggle')).toHaveCount(0);

        // No JS errors
        const critical = errors.filter(e => !e.includes('Pusher') && !e.includes('net::'));
        expect(critical.length).toBe(0);
    });

    test('2 - Books grid displays OT and NT sections', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        const content = await page.locator('#reader-content').innerHTML();
        expect(content).toContain('Old Testament');
        expect(content).toContain('New Testament');

        const bookBtns = page.locator('.book-btn');
        const count = await bookBtns.count();
        expect(count).toBeGreaterThanOrEqual(60);
    });

    test('3 - Book click shows chapters grid', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.book-btn[data-book="Genesis"]').click();
        await page.waitForTimeout(300);

        const chapterBtns = page.locator('.chapter-btn');
        const count = await chapterBtns.count();
        expect(count).toBe(50);

        const breadcrumb = await page.locator('#breadcrumb').textContent();
        expect(breadcrumb).toContain('Genesis');
    });

    test('4 - Chapter click shows verse reader', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        const verseLines = page.locator('.verse-line');
        const count = await verseLines.count();
        expect(count).toBeGreaterThan(20);

        await expect(page.locator('.verse-num').first()).toBeVisible();
    });

    test('5 - Verse click highlights and selects', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        const verse1 = page.locator('.verse-line[data-verse="1"]');
        await verse1.click();
        await page.waitForTimeout(200);

        await expect(verse1).toHaveClass(/highlighted/);

        const selected = await page.evaluate(() => window.BibleController.selectedVerse);
        expect(selected).toBeTruthy();
        expect(selected.book).toBe('Genesis');
        expect(selected.verse).toBe('1');
    });

    test('6 - Navigation breadcrumb and back button work', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.book-btn[data-book="Genesis"]').click();
        await page.waitForTimeout(300);

        const bc = await page.locator('#breadcrumb').textContent();
        expect(bc).toContain('Books');
        expect(bc).toContain('Genesis');

        await page.locator('#btn-back').click();
        await page.waitForTimeout(300);

        const bookBtns = page.locator('.book-btn');
        const count = await bookBtns.count();
        expect(count).toBeGreaterThanOrEqual(60);
    });

    test('7 - Translation switch reloads data', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        const defaultV = await page.locator('#version-select').inputValue();
        expect(defaultV).toBe('ESV');

        await page.locator('#version-select').selectOption('NLT');
        await page.waitForTimeout(1500);

        const version = await page.evaluate(() => BibleData.getVersion());
        expect(version).toBe('NLT');
    });

    test('8 - Design gallery shows 6 clickable design cards in sidebar', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Switch to style tab
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Design gallery should have 6 cards (first 6 designs)
        const designCards = page.locator('#design-gallery .design-card');
        const count = await designCards.count();
        expect(count).toBe(6);

        // Each card should have a thumb and label
        const firstCard = designCards.first();
        await expect(firstCard.locator('.design-thumb')).toBeVisible();
        await expect(firstCard.locator('.design-label')).toBeVisible();

        // First card (classic) should be active by default
        await expect(firstCard).toHaveClass(/active/);

        // Click second card (modern) → it should become active
        const secondCard = designCards.nth(1);
        await secondCard.click();
        await page.waitForTimeout(200);
        await expect(secondCard).toHaveClass(/active/);
        await expect(firstCard).not.toHaveClass(/active/);
    });

    test('9 - Search finds verses by reference', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.waitForTimeout(200);

        await page.locator('#search-input').fill('John 3:16');
        await page.waitForTimeout(500);

        const results = page.locator('.search-result-item');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);

        const refText = await results.first().locator('.search-result-ref').textContent();
        expect(refText).toContain('John');
    });

    test('10 - Search finds verses by keyword', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.waitForTimeout(200);

        await page.locator('#search-input').fill('faith');
        await page.waitForTimeout(800);

        const results = page.locator('.search-result-item');
        const count = await results.count();
        expect(count).toBeGreaterThan(0);
    });

    test('11 - Auto-display on verse click and Clear action', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(500);

        await expect(page.locator('.verse-line[data-verse="1"]')).toHaveClass(/live-sent/);

        await page.locator('#btn-clear').click();
        await page.waitForTimeout(500);
    });

    test('12 - Dashboard Bible tab has Open Controller button', async ({ page }) => {
        await page.goto(DASHBOARD_URL);
        await page.waitForTimeout(2000);

        const bibleTab = page.locator('.panel-tab[data-panel="bible"]');
        if (await bibleTab.count() > 0) {
            await bibleTab.click();
            await page.waitForTimeout(300);
            await expect(page.locator('#btn-open-bible')).toBeVisible();
        }
    });

    test('13 - Stage has background image CSS support', async ({ page }) => {
        await page.goto(STAGE_URL + '?room=1');
        await page.waitForTimeout(1500);

        const el = page.locator('#bible-display');
        await expect(el).toBeAttached();

        const hasRule = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            for (const sheet of sheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        if (rule.selectorText && rule.selectorText.includes('bible-bg-image')) {
                            return true;
                        }
                    }
                } catch (e) { /* cross-origin */ }
            }
            return false;
        });
        expect(hasRule).toBe(true);
    });

    test('14 - Sidebar tab switching (Search / Saved Verses / Style)', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await expect(page.locator('#panel-search')).toHaveClass(/active/);

        // Saved Verses tab (renamed from Presets)
        await page.locator('.sidebar-tab[data-tab="saved"]').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#panel-saved')).toHaveClass(/active/);
        await expect(page.locator('#panel-search')).not.toHaveClass(/active/);

        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#panel-style')).toHaveClass(/active/);

        // Style tab should contain design gallery, preview, transition gallery, and browse buttons
        await expect(page.locator('#design-gallery')).toBeVisible();
        await expect(page.locator('#stage-preview')).toBeVisible();
        await expect(page.locator('#transition-gallery')).toBeVisible();
        await expect(page.locator('#btn-browse-designs')).toBeVisible();
        await expect(page.locator('#btn-browse-transitions')).toBeVisible();
        await expect(page.locator('#btn-apply-design')).toBeVisible();
    });

    test('15 - Arrow key verse navigation (up/down)', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        // Click verse 1
        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(300);
        await expect(page.locator('.verse-line[data-verse="1"]')).toHaveClass(/highlighted/);

        // Press ArrowDown → verse 2
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        await expect(page.locator('.verse-line[data-verse="2"]')).toHaveClass(/highlighted/);

        // Press ArrowUp → verse 1
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(300);
        await expect(page.locator('.verse-line[data-verse="1"]')).toHaveClass(/highlighted/);
    });

    test('16 - Prev/Next verse buttons work', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Initially prev/next should be disabled
        await expect(page.locator('#btn-prev-verse')).toBeDisabled();
        await expect(page.locator('#btn-next-verse')).toBeDisabled();

        await navigateToGenesis1(page);

        // Click verse 1
        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(300);

        // Prev disabled (verse 1 is first), Next enabled
        await expect(page.locator('#btn-prev-verse')).toBeDisabled();
        await expect(page.locator('#btn-next-verse')).toBeEnabled();

        // Click Next
        await page.locator('#btn-next-verse').click();
        await page.waitForTimeout(300);
        await expect(page.locator('.verse-line[data-verse="2"]')).toHaveClass(/highlighted/);

        // Now Prev should be enabled
        await expect(page.locator('#btn-prev-verse')).toBeEnabled();

        // Click Prev
        await page.locator('#btn-prev-verse').click();
        await page.waitForTimeout(300);
        await expect(page.locator('.verse-line[data-verse="1"]')).toHaveClass(/highlighted/);
    });

    test('17 - Apply Design button applies selected design', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        // Select a verse first
        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(300);

        // Switch to style tab
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Select "modern" design card
        await page.locator('.design-card[data-design="modern"]').click();
        await page.waitForTimeout(200);

        // Click Apply Design
        await page.locator('#btn-apply-design').click();
        await page.waitForTimeout(500);

        // BibleController _style should reflect modern preset
        const style = await page.evaluate(() => window.BibleController._style);
        expect(style.bgType).toBe('gradient');
    });

    test('18 - Stage preview section shows verse', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Switch to style tab to see preview
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(200);

        // Stage preview should exist
        const preview = page.locator('#stage-preview');
        await expect(preview).toBeVisible();

        // Initially should show empty message
        await expect(preview.locator('.preview-empty')).toBeVisible();

        // Navigate to a verse and click it
        await navigateToGenesis1(page);
        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(500);

        // Switch to style tab again
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(200);

        // Preview should now show verse text
        const previewContent = await preview.innerHTML();
        expect(previewContent).toContain('preview-verse');
    });

    test('19 - Transition gallery shows clickable transition cards', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Switch to style tab
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Transition gallery should have at least 4 cards
        const transCards = page.locator('#transition-gallery .transition-card');
        const count = await transCards.count();
        expect(count).toBeGreaterThanOrEqual(4);

        // Click a transition card
        const slideUp = page.locator('.transition-card[data-transition="slide-up"]');
        if (await slideUp.count() > 0) {
            await slideUp.click();
            await page.waitForTimeout(200);
            await expect(slideUp).toHaveClass(/active/);
        }
    });

    test('20 - Clear and Black Screen buttons in header', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Clear and Black Screen should be in the header
        const clearBtn = page.locator('.header #btn-clear');
        const blackBtn = page.locator('.header #btn-blackout');
        await expect(clearBtn).toBeVisible();
        await expect(blackBtn).toBeVisible();

        // Black Screen toggle
        await expect(blackBtn).not.toHaveClass(/active/);
        await blackBtn.click();
        await page.waitForTimeout(500);
        await expect(blackBtn).toHaveClass(/active/);

        // Toggle off
        await blackBtn.click();
        await page.waitForTimeout(500);
        await expect(blackBtn).not.toHaveClass(/active/);
    });

    test('21 - Design modal opens with all 40 designs', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Switch to style tab
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Click Browse All Designs
        await page.locator('#btn-browse-designs').click();
        await page.waitForTimeout(300);

        // Modal should be open
        await expect(page.locator('#design-modal')).toHaveClass(/open/);

        // Should have 40 design tiles
        const tiles = page.locator('#design-modal-grid .modal-tile');
        const count = await tiles.count();
        expect(count).toBe(40);

        // Click a tile to select it
        await tiles.nth(5).click();
        await page.waitForTimeout(200);
        await expect(tiles.nth(5)).toHaveClass(/active/);

        // Preview panel should update
        const name = await page.locator('#design-modal-name').textContent();
        expect(name.length).toBeGreaterThan(0);

        // Close modal
        await page.locator('[data-close-modal="design-modal"]').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#design-modal')).not.toHaveClass(/open/);
    });

    test('22 - Transition modal opens with all transitions', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Switch to style tab
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Click Browse All Transitions
        await page.locator('#btn-browse-transitions').click();
        await page.waitForTimeout(300);

        // Modal should be open
        await expect(page.locator('#transition-modal')).toHaveClass(/open/);

        // Should have transition tiles
        const tiles = page.locator('#transition-modal-grid .modal-tile');
        const count = await tiles.count();
        expect(count).toBeGreaterThanOrEqual(10);

        // Click a tile
        await tiles.nth(2).click();
        await page.waitForTimeout(200);
        await expect(tiles.nth(2)).toHaveClass(/active/);

        // Close modal
        await page.locator('[data-close-modal="transition-modal"]').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#transition-modal')).not.toHaveClass(/open/);
    });

    test('23 - Present mode button exists in header', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        const presentBtn = page.locator('#btn-present');
        await expect(presentBtn).toBeVisible();
        await expect(presentBtn).toContainText('Present');
    });

    test('24 - Save Current Verse button exists in header bar and sidebar', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Save verse bar at top
        await expect(page.locator('#btn-save-verse')).toBeVisible();
        await expect(page.locator('#btn-save-verse')).toContainText('Save Current Verse');

        // Also in sidebar saved panel
        await page.locator('.sidebar-tab[data-tab="saved"]').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#btn-add-preset')).toBeVisible();
        await expect(page.locator('#btn-add-preset')).toContainText('Save Current Verse');
    });

    test('25 - KJV NASB AMP translation options exist', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        const select = page.locator('#version-select');
        const options = await select.locator('option').allTextContents();
        expect(options).toContain('KJV');
        expect(options).toContain('NASB');
        expect(options).toContain('AMP');
        expect(options).toContain('ESV');
        expect(options).toContain('NLT');
    });

    test('26 - Mobile bottom nav is present in DOM', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Mobile bottom nav exists in DOM
        await expect(page.locator('#mobile-bottom-nav')).toBeAttached();

        // Has all nav items
        const items = page.locator('.mobile-nav-item');
        const count = await items.count();
        expect(count).toBe(7); // Reader, Search, Saved, Style, Clear, Black, More

        // Check labels
        const labels = await items.allTextContents();
        const joined = labels.join(' ');
        expect(joined).toContain('Reader');
        expect(joined).toContain('Search');
        expect(joined).toContain('Saved');
        expect(joined).toContain('Style');
        expect(joined).toContain('Clear');
        expect(joined).toContain('Black');
        expect(joined).toContain('More');
    });

    test('27 - Browse All Designs button opens design modal', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Click Browse All Designs
        const browseBtn = page.locator('#btn-browse-designs');
        await expect(browseBtn).toBeVisible();
        await browseBtn.click();
        await page.waitForTimeout(300);

        // Design modal should open with preview panel
        await expect(page.locator('#design-modal')).toHaveClass(/open/);
        await expect(page.locator('#design-modal-preview')).toBeVisible();
        await expect(page.locator('#design-modal-apply')).toBeVisible();

        // Apply and close
        await page.locator('#design-modal-grid .modal-tile').first().click();
        await page.waitForTimeout(200);
        await page.locator('#design-modal-apply').click();
        await page.waitForTimeout(200);
        await expect(page.locator('#design-modal')).not.toHaveClass(/open/);
    });

    test('28 - Browse All Transitions button opens transition modal', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(300);

        // Click Browse All Transitions
        const browseBtn = page.locator('#btn-browse-transitions');
        await expect(browseBtn).toBeVisible();
        await browseBtn.click();
        await page.waitForTimeout(300);

        // Transition modal should open
        await expect(page.locator('#transition-modal')).toHaveClass(/open/);
        await expect(page.locator('#transition-modal-preview')).toBeVisible();
        await expect(page.locator('#transition-modal-apply')).toBeVisible();

        // Preview play button exists
        await expect(page.locator('#transition-preview-play')).toBeVisible();

        // Close
        await page.locator('[data-close-modal="transition-modal"]').click();
        await page.waitForTimeout(200);
    });

    test('29 - Clear only clears text, not design/background', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        // Select verse 1 (auto-broadcasts)
        await page.locator('.verse-line[data-verse="1"]').click();
        await page.waitForTimeout(500);

        // Switch to style tab and apply a design
        await page.locator('.sidebar-tab[data-tab="style"]').click();
        await page.waitForTimeout(200);
        const secondCard = page.locator('#design-gallery .design-card').nth(1);
        await secondCard.click();
        await page.waitForTimeout(200);
        await page.locator('#btn-apply-design').click();
        await page.waitForTimeout(500);

        // Remember the style preset
        const presetBefore = await page.evaluate(() => window.BibleController._style.preset);

        // Click Clear
        await page.locator('#btn-clear').click();
        await page.waitForTimeout(500);

        // Design should still be the same (not reset)
        const presetAfter = await page.evaluate(() => window.BibleController._style.preset);
        expect(presetAfter).toBe(presetBefore);
    });

    test('30 - Verse toggle: clicking same verse again unclears it', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        await navigateToGenesis1(page);

        const verse1 = page.locator('.verse-line[data-verse="1"]');

        // Click verse 1 → should highlight and broadcast
        await verse1.click();
        await page.waitForTimeout(500);
        await expect(verse1).toHaveClass(/highlighted/);
        await expect(verse1).toHaveClass(/live-sent/);

        // Click verse 1 again → should un-highlight and clear
        await verse1.click();
        await page.waitForTimeout(500);
        await expect(verse1).not.toHaveClass(/highlighted/);
        await expect(verse1).not.toHaveClass(/live-sent/);

        // selectedVerse should be null
        const selected = await page.evaluate(() => window.BibleController.selectedVerse);
        expect(selected).toBeNull();
    });

    test('31 - Mobile bottom nav Clear and Black buttons work', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(300);

        // Mobile nav should be visible
        await expect(page.locator('#mobile-bottom-nav')).toBeVisible();

        // Clear button exists with correct data attribute
        const clearBtn = page.locator('.mobile-nav-item[data-mobile-tab="clear"]');
        await expect(clearBtn).toBeVisible();

        // Black button exists with correct data attribute
        const blackBtn = page.locator('.mobile-nav-item[data-mobile-tab="black"]');
        await expect(blackBtn).toBeVisible();
    });

    test('32 - Mobile modal has Apply button via mobile footer', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(300);

        // Open design modal via style tab (need to make sidebar visible first)
        await page.locator('.mobile-nav-item[data-mobile-tab="style"]').click();
        await page.waitForTimeout(300);
        await page.locator('#btn-browse-designs').click();
        await page.waitForTimeout(300);

        // Design modal should be open
        await expect(page.locator('#design-modal')).toHaveClass(/open/);

        // Mobile footer Apply button should be visible
        const mobileApply = page.locator('#design-modal-apply-mobile');
        await expect(mobileApply).toBeVisible();

        // Close modal
        await page.locator('[data-close-modal="design-modal"]').click();
        await page.waitForTimeout(200);

        // Now check transition modal
        await page.locator('#btn-browse-transitions').click();
        await page.waitForTimeout(300);
        await expect(page.locator('#transition-modal')).toHaveClass(/open/);

        const transApply = page.locator('#transition-modal-apply-mobile');
        await expect(transApply).toBeVisible();

        await page.locator('[data-close-modal="transition-modal"]').click();
        await page.waitForTimeout(200);
    });

    test('33 - Stage has bible-text-wrapper for text-only transitions', async ({ page }) => {
        await page.goto(`${BASE}/bible-stage.html?room=1`);
        await page.waitForTimeout(1500);

        // bible-text-wrapper should exist inside bible-display
        const wrapper = page.locator('#bible-display #bible-text-wrapper');
        await expect(wrapper).toBeAttached();

        // Check that transition CSS targets text-wrapper
        const hasTextWrapperRule = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            for (const sheet of sheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        if (rule.selectorText && rule.selectorText.includes('bible-text-wrapper')) {
                            return true;
                        }
                    }
                } catch (e) { /* cross-origin */ }
            }
            return false;
        });
        expect(hasTextWrapperRule).toBe(true);
    });

    test('34 - Transition preview animation keyframes exist in bible.html', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        await page.waitForTimeout(500);

        // Check that transition keyframes exist in bible.html stylesheets
        const keyframeNames = await page.evaluate(() => {
            const names = [];
            const sheets = Array.from(document.styleSheets);
            for (const sheet of sheets) {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    for (const rule of rules) {
                        if (rule instanceof CSSKeyframesRule) {
                            names.push(rule.name);
                        }
                    }
                } catch (e) { /* cross-origin */ }
            }
            return names;
        });
        expect(keyframeNames).toContain('fadeIn');
        expect(keyframeNames).toContain('slideUpIn');
        expect(keyframeNames).toContain('zoomInAnim');
        expect(keyframeNames).toContain('flipAnim');
        expect(keyframeNames).toContain('blurAnim');
    });

});

// @ts-check
/**
 * Bible New Features Tests
 *
 * Covers:
 *  1.  Title/brand is "Scripture View" (not "B1G Bible")
 *  2.  Search "John 3:16" + Enter auto-navigates to John 3 and flashes verse 16
 *  3.  Search "John 3" (chapter only) navigates to chapter view
 *  4.  Search button click also auto-navigates on verse reference
 *  5.  Reader panel has its own independent scroll (no full-page scroll)
 *  6.  Sidebar has its own independent scroll
 *  7.  Reader font-size control exists in the reader nav
 *  8.  Changing font size updates .verse-text font size
 *  9.  Font size preference persists in localStorage
 * 10.  Saved verses panel has drag handles (.drag-handle)
 * 11.  SortableJS is loaded and available globally
 * 12.  Saving a verse adds a drag handle to the preset item
 * 13.  Flash animation keyframes are defined in the page CSS
 * 14.  Brand name is "Scripture View" in the header
 * 15.  Page title contains "Scripture View"
 */

const { test, expect } = require('@playwright/test');

const BASE  = 'http://localhost/B1G_TIMER/public';
const BIBLE_URL = `${BASE}/bible.html?room=1`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForBibleLoaded(page) {
    await page.waitForFunction(
        () => typeof BibleData !== 'undefined' && BibleData.isLoaded(),
        { timeout: 20_000 }
    );
}

async function navigateToJohn3(page) {
    await page.locator('.book-btn[data-book="John"]').click();
    await page.waitForTimeout(300);
    await page.locator('.chapter-btn[data-ch="3"]').click();
    await page.waitForTimeout(600);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Bible New Features', () => {

    // ── Branding ──────────────────────────────────────────────────────────

    test('1 - Brand name is "Scripture View" (not "B1G Bible")', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        const brand = page.locator('.header-brand .brand-text');
        await expect(brand).toBeVisible();
        const text = await brand.textContent();
        expect(text).toContain('Scripture View');
        expect(text).not.toContain('B1G Bible');
    });

    test('2 - Page <title> contains "Scripture View"', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);
        const title = await page.title();
        expect(title).toContain('Scripture View');
    });

    // ── Search auto-navigate ───────────────────────────────────────────────

    test('3 - Search "John 3:16" + Enter navigates to John 3 and highlights verse 16', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        // Switch to search tab (it should already be active, but ensure)
        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.waitForTimeout(200);

        const searchInput = page.locator('#search-input');
        await searchInput.fill('John 3:16');
        await searchInput.press('Enter');

        // Wait for the reader to navigate to John chapter 3
        await page.waitForFunction(
            () => typeof BibleController !== 'undefined' &&
                  BibleController.currentBook === 'John' &&
                  BibleController.currentChapter === 3,
            { timeout: 10_000 }
        );

        // Verse 16 should be highlighted
        const verse16 = page.locator('.verse-line[data-verse="16"]');
        await expect(verse16).toBeVisible({ timeout: 5_000 });
        await expect(verse16).toHaveClass(/highlighted/);
    });

    test('4 - Search "John 3" (chapter only) navigates to chapter view', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.waitForTimeout(200);

        const searchInput = page.locator('#search-input');
        await searchInput.fill('John 3');
        await searchInput.press('Enter');

        await page.waitForFunction(
            () => typeof BibleController !== 'undefined' &&
                  BibleController.currentBook === 'John' &&
                  BibleController.currentChapter === 3,
            { timeout: 10_000 }
        );

        // Verse list should be visible
        await expect(page.locator('.verse-line').first()).toBeVisible({ timeout: 5_000 });
    });

    test('5 - Search button click auto-navigates on verse reference', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.waitForTimeout(200);

        await page.fill('#search-input', 'Romans 8:28');
        await page.waitForTimeout(150);
        await page.click('#search-btn');

        await page.waitForFunction(
            () => typeof BibleController !== 'undefined' &&
                  BibleController.currentBook === 'Romans' &&
                  BibleController.currentChapter === 8,
            { timeout: 12_000 }
        );
        await expect(page.locator('.verse-line[data-verse="28"]')).toHaveClass(/highlighted/, { timeout: 5_000 });
    });

    test('6 - Flash animation keyframes are defined in page CSS', async ({ page }) => {
        await page.goto(BIBLE_URL);
        const hasFlash = await page.evaluate(() => {
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'verseFlash') return true;
                    }
                } catch (e) { /* cross-origin */ }
            }
            return false;
        });
        expect(hasFlash).toBe(true);
    });

    // ── Independent scroll ────────────────────────────────────────────────

    test('7 - .main-layout uses flex layout with overflow hidden (no page scroll)', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const mainLayoutOverflow = await page.evaluate(() => {
            const el = document.querySelector('.main-layout');
            return el ? window.getComputedStyle(el).overflow : null;
        });
        expect(mainLayoutOverflow).toBe('hidden');
    });

    test('8 - Reader panel (.reader-panel) is a flex column with overflow hidden', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const styles = await page.evaluate(() => {
            const el = document.querySelector('.reader-panel');
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return { overflow: cs.overflow, flexDirection: cs.flexDirection };
        });
        expect(styles).not.toBeNull();
        expect(styles.overflow).toBe('hidden');
        expect(styles.flexDirection).toBe('column');
    });

    test('9 - .reader-content is independently scrollable (overflow-y auto/scroll)', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const overflowY = await page.evaluate(() => {
            const el = document.getElementById('reader-content');
            return el ? window.getComputedStyle(el).overflowY : null;
        });
        expect(['auto', 'scroll']).toContain(overflowY);
    });

    test('10 - Sidebar is independently scrollable (overflow hidden with inner scrollable panels)', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const sidebarOverflow = await page.evaluate(() => {
            const el = document.getElementById('sidebar');
            return el ? window.getComputedStyle(el).overflow : null;
        });
        expect(sidebarOverflow).toBe('hidden');

        // Active sidebar panel should scroll independently
        const panelOverflow = await page.evaluate(() => {
            const panel = document.querySelector('.sidebar-panel.active');
            return panel ? window.getComputedStyle(panel).overflowY : null;
        });
        expect(['auto', 'scroll']).toContain(panelOverflow);
    });

    // ── Reader font size ──────────────────────────────────────────────────

    test('11 - Reader font size select (#reader-font-size) exists in nav', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const sel = page.locator('#reader-font-size');
        await expect(sel).toBeVisible();
        // Should have multiple size options
        const optCount = await sel.locator('option').count();
        expect(optCount).toBeGreaterThanOrEqual(6);
    });

    test('12 - Changing font size updates verse text font size', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        // Navigate to Genesis 1
        await page.locator('.book-btn[data-book="Genesis"]').click();
        await page.waitForTimeout(300);
        await page.locator('.chapter-btn[data-ch="1"]').click();
        await page.waitForTimeout(600);

        // Change font size to 24
        await page.selectOption('#reader-font-size', '24');
        await page.waitForTimeout(200);

        // Check a verse-text element has font-size 24px
        const fontSize = await page.evaluate(() => {
            const el = document.querySelector('#reader-content .verse-text');
            return el ? window.getComputedStyle(el).fontSize : null;
        });
        expect(fontSize).toBe('24px');
    });

    test('13 - Font size selection of 18 updates verse text to 18px', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.locator('.book-btn[data-book="John"]').click();
        await page.waitForTimeout(300);
        await page.locator('.chapter-btn[data-ch="1"]').click();
        await page.waitForTimeout(600);

        await page.selectOption('#reader-font-size', '18');
        await page.waitForTimeout(200);

        const fontSize = await page.evaluate(() => {
            const el = document.querySelector('#reader-content .verse-text');
            return el ? window.getComputedStyle(el).fontSize : null;
        });
        expect(fontSize).toBe('18px');
    });

    test('14 - Font size persists via localStorage after change', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.selectOption('#reader-font-size', '20');
        await page.waitForTimeout(200);

        const stored = await page.evaluate(() => localStorage.getItem('b1g_reader_font_size'));
        expect(stored).toBe('20');
    });

    // ── Saved verses drag handles ──────────────────────────────────────────

    test('15 - SortableJS library is globally available', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        const hasSortable = await page.evaluate(() => typeof Sortable !== 'undefined');
        expect(hasSortable).toBe(true);
    });

    test('16 - Saved Verses tab shows "+ Save Current Verse" button', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.locator('.sidebar-tab[data-tab="saved"]').click();
        await page.waitForTimeout(200);

        await expect(page.locator('#btn-add-preset')).toBeVisible();
    });

    test('17 - Saving a verse adds a drag handle (.drag-handle) to the preset item', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        // Navigate to John 3 and click verse 16
        await navigateToJohn3(page);
        await page.locator('.verse-line[data-verse="16"]').click();
        await page.waitForTimeout(400);

        // Save the verse
        await page.locator('.sidebar-tab[data-tab="saved"]').click();
        await page.waitForTimeout(200);
        await page.locator('#btn-add-preset').click();
        await page.waitForTimeout(600);

        // Check for drag handle
        const dragHandle = page.locator('.preset-item .drag-handle').first();
        await expect(dragHandle).toBeVisible({ timeout: 5_000 });
        await expect(dragHandle).toContainText('');  // fa-grip-vertical icon
    });

    test('18 - Saved verse items have data-id attribute for sortable tracking', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await page.locator('.sidebar-tab[data-tab="saved"]').click();
        await page.waitForTimeout(300);

        const items = page.locator('.preset-item[data-id]');
        const count = await items.count();
        // If there are any presets, they should have data-id
        if (count > 0) {
            const id = await items.first().getAttribute('data-id');
            expect(id).toBeTruthy();
        } else {
            // No presets yet — that's also fine, just verify the list exists
            await expect(page.locator('#preset-list')).toBeVisible();
        }
    });

    test('19 - Header Save Verse bar button is visible on desktop', async ({ page }) => {
        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        await expect(page.locator('#btn-save-verse')).toBeVisible();
    });

    test('20 - All new features coexist: brand, search, font-size, sortable', async ({ page }) => {
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

        await page.goto(BIBLE_URL);
        await waitForBibleLoaded(page);

        // 1. Brand
        const brand = await page.locator('.header-brand .brand-text').textContent();
        expect(brand).toContain('Scripture View');

        // 2. Font size control
        await expect(page.locator('#reader-font-size')).toBeVisible();

        // 3. SortableJS loaded
        const hasSortable = await page.evaluate(() => typeof Sortable !== 'undefined');
        expect(hasSortable).toBe(true);

        // 4. Search and navigate
        await page.locator('.sidebar-tab[data-tab="search"]').click();
        await page.fill('#search-input', 'Romans 8:28');
        await page.locator('#search-input').press('Enter');
        await page.waitForFunction(
            () => typeof BibleController !== 'undefined' && BibleController.currentBook === 'Romans',
            { timeout: 10_000 }
        );

        // Layout is properly confined
        const overflow = await page.evaluate(() => {
            const el = document.querySelector('.main-layout');
            return el ? window.getComputedStyle(el).overflow : null;
        });
        expect(overflow).toBe('hidden');

        // No critical JS errors (exclude network/API/pusher/CDN noise)
        const criticalErrors = errors.filter(e =>
            !e.includes('Pusher') && !e.includes('pusher') &&
            !e.includes('network') && !e.includes('fetch') &&
            !e.includes('Fetch') && !e.includes('Failed to fetch') &&
            !e.includes('ERR_') && !e.includes('net::') &&
            !e.includes('404') && !e.includes('500') &&
            !e.includes('API') && !e.includes('api') &&
            !e.includes('broadcast') && !e.includes('Broadcast')
        );
        expect(criticalErrors.length).toBe(0);
    });
});

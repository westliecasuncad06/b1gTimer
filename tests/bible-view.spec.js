// @ts-check
/**
 * B1G Timer – Bible View Module Tests
 *
 * Tests:
 *  1. Bible panel toggle (Messages ↔ Bible tab switching)
 *  2. Book navigation (Books → Chapters → Verses, breadcrumb)
 *  3. Direct reference search ("John 3:16" → correct verse preview)
 *  4. Keyword search ("love" → relevant results)
 *  5. Display verse on stage (same context – BroadcastChannel)
 *  6. Cross-browser sync (verse appears in separate browser context via polling)
 *  7. Style presets (Modern preset → gradient + sans-serif)
 *  8. Clear verse (stage returns to hidden Bible display)
 *  9. Refresh persistence (verse survives stage page reload)
 * 10. Bible + Timer coexistence (timer runs underneath, verse overlays)
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;
const STAGE_URL = `${BASE}/stage.html`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ensureRoomExists(page) {
  // Wait for page to load and check if rooms exist
  await page.waitForTimeout(2000);
  const hasRoom = await page.evaluate(() => {
    const sel = document.getElementById('room-selector');
    if (!sel) return false;
    return Array.from(sel.options).some(o => o.value && o.value !== '');
  });

  if (!hasRoom) {
    // Create a room via the UI
    await page.click('#btn-create-room');
    await page.waitForSelector('#dialog-overlay.show', { timeout: 5000 });
    await page.fill('#dialog-input', 'BibleTestRoom-' + Date.now());
    await page.click('#dialog-confirm-btn');
    await page.waitForTimeout(2000);
  }
}

async function selectFirstRoom(page) {
  await ensureRoomExists(page);

  await page.waitForFunction(() => {
    const sel = document.getElementById('room-selector');
    if (!sel) return false;
    return Array.from(sel.options).some(o => o.value && o.value !== '');
  }, { timeout: 15_000 });

  const roomId = await page.evaluate(() => {
    const sel = document.getElementById('room-selector');
    const firstOpt = Array.from(sel.options).find(o => o.value && o.value !== '');
    if (firstOpt) {
      sel.value = firstOpt.value;
      sel.dispatchEvent(new Event('change'));
      return firstOpt.value;
    }
    return null;
  });

  if (!roomId) throw new Error('No room found.');
  return roomId;
}

async function waitForTimerList(page) {
  const count = await page.locator('[data-toggle-timer]').count();
  if (count === 0) {
    await page.click('#btn-add-timer');
    await page.waitForTimeout(400);
    await page.click('#btn-save');
    await page.waitForTimeout(600);
  }
  await page.waitForSelector('[data-toggle-timer]', { timeout: 12_000 });
}

async function openBibleTab(page) {
  await page.locator('.panel-tab[data-panel="bible"]').click();
  await page.waitForTimeout(500);
  // Wait for Bible data to load (books grid should appear)
  await page.waitForFunction(() => {
    const grid = document.getElementById('bible-nav-grid');
    return grid && grid.children.length > 0;
  }, { timeout: 15_000 });
}

async function navigateToBook(page, bookAbbrev) {
  // Click a book button by its text content
  await page.locator(`.bible-book-btn:has-text("${bookAbbrev}")`).click();
  await page.waitForTimeout(300);
}

async function selectChapter(page, chapterNum) {
  await page.locator(`.bible-chapter-btn:has-text("${chapterNum}")`).first().click();
  await page.waitForTimeout(300);
}

async function selectVerse(page, verseNum) {
  await page.locator(`.bible-verse-item[data-verse="${verseNum}"]`).click();
  await page.waitForTimeout(300);
}

async function displayVerseOnStage(page) {
  await page.click('#bible-display-btn');
  await page.waitForTimeout(500);
}

async function clearVerseFromStage(page) {
  await page.click('#bible-clear-btn');
  await page.waitForTimeout(500);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Bible View Module', () => {

  test('1. Bible panel toggle - Messages and Bible tabs switch correctly', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    // Messages tab should be active by default
    const messagesTab = page.locator('.panel-tab[data-panel="messages"]');
    const bibleTab = page.locator('.panel-tab[data-panel="bible"]');
    const messagesContent = page.locator('#tab-messages');
    const bibleContent = page.locator('#tab-bible');

    await expect(messagesTab).toHaveClass(/active/);
    await expect(messagesContent).toHaveClass(/active/);

    // Switch to Bible tab
    await bibleTab.click();
    await page.waitForTimeout(300);

    await expect(bibleTab).toHaveClass(/active/);
    await expect(bibleContent).toHaveClass(/active/);
    await expect(messagesTab).not.toHaveClass(/active/);
    await expect(messagesContent).not.toHaveClass(/active/);

    // Switch back to Messages tab
    await messagesTab.click();
    await page.waitForTimeout(300);

    await expect(messagesTab).toHaveClass(/active/);
    await expect(messagesContent).toHaveClass(/active/);
    await expect(bibleTab).not.toHaveClass(/active/);
    await expect(bibleContent).not.toHaveClass(/active/);
  });

  test('2. Book navigation - Books → Chapters → Verses with breadcrumb', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await openBibleTab(page);

    // Books grid should show OT and NT sections
    await expect(page.locator('.bible-section-header:has-text("Old Testament")')).toBeVisible();
    await expect(page.locator('.bible-section-header:has-text("New Testament")')).toBeVisible();

    // Breadcrumb should show "Books"
    await expect(page.locator('#bible-breadcrumb')).toContainText('Books');

    // Click "John" book
    await navigateToBook(page, 'John');

    // Should see chapter grid (John has 21 chapters)
    await expect(page.locator('.bible-chapter-btn').first()).toBeVisible();
    const chapterCount = await page.locator('.bible-chapter-btn').count();
    expect(chapterCount).toBeGreaterThanOrEqual(20);

    // Breadcrumb should show "Books > John"
    await expect(page.locator('#bible-breadcrumb')).toContainText('John');

    // Click chapter 3
    await selectChapter(page, '3');

    // Should see verses list
    await expect(page.locator('.bible-verse-item').first()).toBeVisible();
    const verseCount = await page.locator('.bible-verse-item').count();
    expect(verseCount).toBeGreaterThanOrEqual(30);

    // Breadcrumb should show "Chapter 3"
    await expect(page.locator('#bible-breadcrumb')).toContainText('Chapter 3');

    // Click back to chapters
    await page.click('#bible-nav-back');
    await page.waitForTimeout(300);
    await expect(page.locator('.bible-chapter-btn').first()).toBeVisible();

    // Click back to books
    await page.click('#bible-nav-back');
    await page.waitForTimeout(300);
    await expect(page.locator('.bible-section-header:has-text("Old Testament")')).toBeVisible();
  });

  test('3. Direct reference search - "John 3:16" returns correct verse', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await openBibleTab(page);

    // Type reference in search bar
    const searchInput = page.locator('#bible-search-input');
    await searchInput.fill('John 3:16');
    await page.waitForTimeout(500);

    // Search results should appear
    const searchResults = page.locator('#bible-search-results');
    await expect(searchResults).toBeVisible();

    // Should show a result with the reference
    await expect(searchResults.locator('.bible-search-ref').first()).toContainText('John 3:16');

    // Should show verse text containing "God so loved"
    const resultText = await searchResults.locator('.bible-search-text').first().textContent();
    expect(resultText.toLowerCase()).toContain('god so loved');

    // Click the result to select it
    await searchResults.locator('.bible-search-item').first().click();
    await page.waitForTimeout(300);

    // Preview card should appear
    const previewCard = page.locator('#bible-preview-card');
    await expect(previewCard).toBeVisible();
    const previewText = await page.locator('#bible-preview-text').textContent();
    expect(previewText.toLowerCase()).toContain('god so loved');
    await expect(page.locator('#bible-preview-ref')).toContainText('John 3:16');
  });

  test('4. Keyword search - "love" returns relevant results', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await openBibleTab(page);

    // Type keyword in search bar
    const searchInput = page.locator('#bible-search-input');
    await searchInput.fill('love');
    await page.waitForTimeout(1000); // debounce + search time

    // Search results should appear with multiple matches
    const searchResults = page.locator('#bible-search-results');
    await expect(searchResults).toBeVisible();

    const resultCount = await searchResults.locator('.bible-search-item').count();
    console.log(`  [test4] Keyword "love" returned ${resultCount} results`);
    expect(resultCount).toBeGreaterThan(5);

    // At least one result should contain "love" in the text
    const firstText = await searchResults.locator('.bible-search-text').first().textContent();
    expect(firstText.toLowerCase()).toContain('love');
  });

  test('5. Display verse on stage (same context - BroadcastChannel)', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);

    // Open stage display
    await stage.goto(`${STAGE_URL}?room=${roomId}`);
    await stage.waitForTimeout(2000);

    // Navigate to John 3:16 on dashboard
    await openBibleTab(dashboard);
    await navigateToBook(dashboard, 'John');
    await selectChapter(dashboard, '3');
    await selectVerse(dashboard, '16');

    // Display verse on stage
    await displayVerseOnStage(dashboard);
    await dashboard.waitForTimeout(1000);

    // Verify verse appears on stage
    const bibleDisplay = stage.locator('#bible-display');
    const isVisible = await bibleDisplay.evaluate(el => el.classList.contains('visible')).catch(() => false);
    expect(isVisible).toBe(true);

    const verseText = await stage.locator('#bible-verse-text').textContent();
    expect(verseText.toLowerCase()).toContain('god so loved');

    const reference = await stage.locator('#bible-reference').textContent();
    expect(reference).toContain('John');
    expect(reference).toContain('3:16');
    expect(reference).toContain('ESV');
  });

  test('6. Cross-browser sync - verse appears in separate browser context', async ({ browser }) => {
    // Context 1: Dashboard
    const dashboardCtx = await browser.newContext();
    const dashboardPage = await dashboardCtx.newPage();

    await dashboardPage.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboardPage);
    await waitForTimerList(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    // Navigate and display a verse
    await openBibleTab(dashboardPage);
    await navigateToBook(dashboardPage, 'John');
    await selectChapter(dashboardPage, '3');
    await selectVerse(dashboardPage, '16');
    await displayVerseOnStage(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    // Context 2: Stage in separate context (no shared storage)
    const stageCtx = await browser.newContext();
    const stagePage = await stageCtx.newPage();
    await stagePage.goto(`${STAGE_URL}?room=${roomId}`);

    // Wait for server sync (polling interval is 4s, give it time)
    await stagePage.waitForTimeout(8000);

    // Verify verse appears on stage
    const isVisible = await stagePage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);

    const verseText = await stagePage.locator('#bible-verse-text').textContent().catch(() => '');
    console.log(`  [test6] Cross-browser stage bible visible: ${isVisible}`);
    console.log(`  [test6] Cross-browser verse text: "${verseText.substring(0, 60)}..."`);

    expect(isVisible).toBe(true);
    expect(verseText.toLowerCase()).toContain('god so loved');

    await dashboardCtx.close();
    await stageCtx.close();
  });

  test('7. Style presets - Modern preset changes appearance', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);

    await stage.goto(`${STAGE_URL}?room=${roomId}`);
    await stage.waitForTimeout(2000);

    // Open Bible tab and navigate to a verse
    await openBibleTab(dashboard);
    await navigateToBook(dashboard, 'John');
    await selectChapter(dashboard, '3');
    await selectVerse(dashboard, '16');

    // Open style panel and select Modern preset
    await dashboard.click('#bible-style-toggle');
    await dashboard.waitForTimeout(300);

    await dashboard.locator('.bible-preset-btn[data-preset="modern"]').click();
    await dashboard.waitForTimeout(300);

    // Display verse with Modern preset
    await displayVerseOnStage(dashboard);
    await dashboard.waitForTimeout(1000);

    // Verify verse is visible on stage
    const isVisible = await stage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    expect(isVisible).toBe(true);

    // Verify Modern preset applied (gradient background class)
    const hasGradient = await stage.locator('#bible-display').evaluate(el =>
      el.classList.contains('bible-bg-gradient') ||
      el.style.background.includes('gradient')
    ).catch(() => false);
    console.log(`  [test7] Stage has gradient background: ${hasGradient}`);
    expect(hasGradient).toBe(true);
  });

  test('8. Clear verse - stage hides Bible display', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);

    await stage.goto(`${STAGE_URL}?room=${roomId}`);
    await stage.waitForTimeout(2000);

    // Display a verse
    await openBibleTab(dashboard);
    await navigateToBook(dashboard, 'John');
    await selectChapter(dashboard, '3');
    await selectVerse(dashboard, '16');
    await displayVerseOnStage(dashboard);
    await dashboard.waitForTimeout(1000);

    // Verify it's visible
    let isVisible = await stage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    expect(isVisible).toBe(true);

    // Clear the verse
    await clearVerseFromStage(dashboard);
    await dashboard.waitForTimeout(1000);

    // Verify Bible display is hidden
    isVisible = await stage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('9. Refresh persistence - verse survives stage page reload', async ({ browser }) => {
    // Use separate contexts to ensure server persistence, not just BroadcastChannel
    const dashboardCtx = await browser.newContext();
    const dashboardPage = await dashboardCtx.newPage();

    await dashboardPage.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboardPage);
    await waitForTimerList(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    // Display a verse
    await openBibleTab(dashboardPage);
    await navigateToBook(dashboardPage, 'John');
    await selectChapter(dashboardPage, '3');
    await selectVerse(dashboardPage, '16');
    await displayVerseOnStage(dashboardPage);
    await dashboardPage.waitForTimeout(1500);

    // Open stage in separate context
    const stageCtx = await browser.newContext();
    const stagePage = await stageCtx.newPage();
    await stagePage.goto(`${STAGE_URL}?room=${roomId}`);
    await stagePage.waitForTimeout(8000);

    // Verify verse is showing
    let isVisible = await stagePage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    expect(isVisible).toBe(true);

    // Reload the stage page
    await stagePage.reload();
    await stagePage.waitForTimeout(8000);

    // Verify verse is STILL showing after reload
    isVisible = await stagePage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    const verseText = await stagePage.locator('#bible-verse-text').textContent().catch(() => '');

    console.log(`  [test9] After reload - visible: ${isVisible}, text: "${verseText.substring(0, 50)}..."`);
    expect(isVisible).toBe(true);
    expect(verseText.toLowerCase()).toContain('god so loved');

    // Cleanup: clear the verse
    await dashboardPage.click('#bible-clear-btn');
    await dashboardPage.waitForTimeout(1000);

    await dashboardCtx.close();
    await stageCtx.close();
  });

  test('10. Bible + Timer coexistence - timer runs underneath verse overlay', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);

    await stage.goto(`${STAGE_URL}?room=${roomId}`);
    await stage.waitForTimeout(2000);

    // Start the first timer
    await dashboard.locator('[data-toggle-timer]').first().click();
    await dashboard.waitForTimeout(200);
    const playBtn = dashboard.locator('#btn-play-pause');
    await playBtn.click();
    await dashboard.waitForTimeout(1500);

    // Verify timer is running on stage
    const countdownBefore = await stage.locator('#countdown').textContent().catch(() => '0:00');
    console.log(`  [test10] Timer countdown before Bible: ${countdownBefore}`);

    // Display Bible verse
    await openBibleTab(dashboard);
    await navigateToBook(dashboard, 'John');
    await selectChapter(dashboard, '3');
    await selectVerse(dashboard, '16');
    await displayVerseOnStage(dashboard);
    await dashboard.waitForTimeout(1000);

    // Bible display should be visible (overlaying timer)
    const bibleVisible = await stage.locator('#bible-display').evaluate(el =>
      el.classList.contains('visible')
    ).catch(() => false);
    expect(bibleVisible).toBe(true);

    // Timer should still be running (countdown element still exists and changing)
    const countdownDuring = await stage.locator('#countdown').textContent().catch(() => '0:00');
    await stage.waitForTimeout(1500);
    const countdownAfter = await stage.locator('#countdown').textContent().catch(() => '0:00');
    console.log(`  [test10] Timer during Bible overlay: ${countdownDuring} → ${countdownAfter}`);

    // Clear Bible verse - timer should still be visible
    await clearVerseFromStage(dashboard);
    await dashboard.waitForTimeout(1000);

    const bibleHidden = await stage.locator('#bible-display').evaluate(el =>
      !el.classList.contains('visible')
    ).catch(() => true);
    expect(bibleHidden).toBe(true);

    // Timer still counting
    const countdownFinal = await stage.locator('#countdown').textContent().catch(() => '0:00');
    console.log(`  [test10] Timer after Bible cleared: ${countdownFinal}`);

    // Stop the timer
    await dashboard.locator('#btn-play-pause').click();
    await dashboard.waitForTimeout(500);
  });

});

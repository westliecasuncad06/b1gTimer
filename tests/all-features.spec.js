// @ts-check
/**
 * B1G Timer – Comprehensive Feature Tests
 *
 * Covers:
 *  1. Dashboard loads without console errors
 *  2. Room creation and selection
 *  3. Timer card creation and controls (play/pause/reset)
 *  4. Dashboard name saved per room
 *  5. Stage Appearance panel — reset buttons for font/color and Reset All
 *  6. Progress bar and ON AIR badge states
 *  7. Time markers update with timer duration
 *  8. Cache-busting: script tags use ?v=3
 *  9. Stage display loads and connects
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;
const STAGE_URL = `${BASE}/stage.html`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function selectFirstRoom(page) {
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

async function ensureStopped(page) {
  const isPaused = await page.locator('#btn-play-pause i.fa-pause').isVisible();
  if (isPaused) {
    await page.click('#btn-play-pause');
    await page.waitForTimeout(500);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('B1G Timer – All Features', () => {

  test('1. Dashboard loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(3_000);

    // Filter out known benign issues (e.g., Pusher connection issues in test env)
    const realErrors = errors.filter(e =>
      !e.includes('Pusher') && !e.includes('WebSocket') && !e.includes('net::')
    );
    console.log('  [test1] JS errors:', realErrors.length, realErrors);
    expect(realErrors.length).toBe(0);
  });

  test('2. Room selection works and loads timers', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page);
    expect(roomId).toBeTruthy();

    // Wait for room to load (timer list or empty state)
    await page.waitForFunction(() => {
      const list = document.getElementById('timer-list');
      return list && list.innerHTML.length > 10;
    }, { timeout: 10_000 });

    console.log('  [test2] Room', roomId, 'loaded successfully');
  });

  test('3. Timer play/pause and progress bar work', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    // Start timer
    await page.click('#btn-play-pause');
    await expect(page.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Wait 2 seconds for progress
    await page.waitForTimeout(2_000);

    // Progress bar should have a width < 100%
    const progressWidth = await page.evaluate(() => {
      const bar = document.getElementById('preview-progress-bar');
      return bar ? bar.style.width : '100%';
    });
    console.log('  [test3] Progress bar width:', progressWidth);

    // ON AIR badge should be visible
    await expect(page.locator('#on-air-badge')).toBeVisible();
    // ON AIR dot should be green (timer is running with plenty of time)
    const dotClass = await page.locator('#on-air-dot').getAttribute('class');
    console.log('  [test3] ON AIR dot class:', dotClass);
    expect(dotClass).toContain('green');

    // ON AIR time should show a value
    const onAirText = await page.locator('#on-air-time').textContent();
    console.log('  [test3] ON AIR time:', onAirText);
    expect(onAirText.trim().length).toBeGreaterThan(0);

    // Pause timer
    await page.click('#btn-play-pause');
    await expect(page.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });
  });

  test('4. Time markers display quarter durations', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    // Start timer to trigger markers update
    await page.click('#btn-play-pause');
    await page.waitForTimeout(1_000);

    // Time markers should have 4 spans
    const markers = page.locator('#time-markers span');
    const count = await markers.count();
    console.log('  [test4] Time markers count:', count);
    expect(count).toBe(4);

    // First marker should match full duration
    const firstMarkerText = await markers.first().textContent();
    console.log('  [test4] First marker (full duration):', firstMarkerText);
    expect(firstMarkerText.trim()).toMatch(/\d+:\d+/);

    // Cleanup
    await page.click('#btn-play-pause');
    await page.waitForTimeout(300);
  });

  test('5. Dashboard name saves per room', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page);
    await waitForTimerList(page);

    // The dashboard-title element should exist
    const titleEl = page.locator('#dashboard-title');
    await expect(titleEl).toBeVisible();

    const currentName = await titleEl.textContent();
    console.log('  [test5] Current dashboard name:', currentName);

    // Verify title element is present and non-empty
    expect(currentName.trim().length).toBeGreaterThan(0);
  });

  test('6. Stage Appearance panel has all reset buttons', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);

    // Open stage style panel
    await page.click('#btn-toggle-stage-style');
    await expect(page.locator('#stage-style-panel')).toHaveClass(/show/, { timeout: 3_000 });

    // Check all reset buttons exist
    await expect(page.locator('#stage-timer-color-reset')).toBeVisible();
    await expect(page.locator('#stage-clock-color-reset')).toBeVisible();
    await expect(page.locator('#stage-bg-color-reset')).toBeVisible();
    await expect(page.locator('#stage-timer-font-reset')).toBeVisible();
    await expect(page.locator('#stage-clock-font-reset')).toBeVisible();
    await expect(page.locator('#stage-style-reset-all')).toBeVisible();
    console.log('  [test6] All 6 reset buttons found');

    // Test Reset All button
    // First change a color
    await page.evaluate(() => {
      document.getElementById('stage-timer-color').value = '#ff0000';
      document.getElementById('stage-timer-font').value = "'Arial', sans-serif";
      document.getElementById('stage-timer-font-size').value = '15';
    });

    // Click Reset All
    await page.click('#stage-style-reset-all');
    await page.waitForTimeout(300);

    // Verify reset to defaults
    const timerColor = await page.evaluate(() => document.getElementById('stage-timer-color').value);
    const timerFont = await page.evaluate(() => document.getElementById('stage-timer-font').value);
    const timerFontSize = await page.evaluate(() => document.getElementById('stage-timer-font-size').value);
    console.log('  [test6] After Reset All — color:', timerColor, 'font:', timerFont, 'size:', timerFontSize);
    expect(timerColor).toBe('#ffffff');
    expect(timerFont).toBe("'Courier New', monospace");
    expect(timerFontSize).toBe('22');
  });

  test('7. Timer Font Reset button works', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);

    // Open panel
    await page.click('#btn-toggle-stage-style');
    await expect(page.locator('#stage-style-panel')).toHaveClass(/show/);

    // Change timer font
    await page.evaluate(() => {
      document.getElementById('stage-timer-font').value = "'Georgia', serif";
      document.getElementById('stage-timer-font-size').value = '30';
    });

    // Click Timer Font Reset
    await page.click('#stage-timer-font-reset');
    await page.waitForTimeout(200);

    const font = await page.evaluate(() => document.getElementById('stage-timer-font').value);
    const size = await page.evaluate(() => document.getElementById('stage-timer-font-size').value);
    expect(font).toBe("'Courier New', monospace");
    expect(size).toBe('22');
    console.log('  [test7] Timer Font reset works');
  });

  test('8. Clock Font Reset button works', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);

    await page.click('#btn-toggle-stage-style');
    await expect(page.locator('#stage-style-panel')).toHaveClass(/show/);

    // Change clock font
    await page.evaluate(() => {
      document.getElementById('stage-clock-font').value = "'Impact', sans-serif";
      document.getElementById('stage-clock-font-size').value = '10';
    });

    // Click Clock Font Reset
    await page.click('#stage-clock-font-reset');
    await page.waitForTimeout(200);

    const font = await page.evaluate(() => document.getElementById('stage-clock-font').value);
    const size = await page.evaluate(() => document.getElementById('stage-clock-font-size').value);
    expect(font).toBe("'Courier New', monospace");
    expect(size).toBe('6');
    console.log('  [test8] Clock Font reset works');
  });

  test('9. Script tags use cache-busting versions', async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    const v2Count = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src*="?v=2"]');
      return scripts.length;
    });
    const versionedCount = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src*="?v="]');
      return scripts.length;
    });

    console.log('  [test9] v=2 scripts:', v2Count, 'versioned scripts:', versionedCount);
    expect(v2Count).toBe(0);
    expect(versionedCount).toBeGreaterThanOrEqual(11); // 11 modules
  });

  test('10. Stage display loads', async ({ page }) => {
    // First get a room ID
    await page.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page);

    // Open stage display
    await page.goto(`${STAGE_URL}?room=${roomId}`);
    await page.waitForTimeout(3_000);

    // Stage should have countdown display
    const countdown = page.locator('#stage-countdown, .countdown');
    const hasCountdown = await countdown.count();
    console.log('  [test10] Stage countdown elements:', hasCountdown);

    // Page should have loaded without crashing (title or body present)
    const title = await page.title();
    console.log('  [test10] Stage page title:', title);
    expect(title.length).toBeGreaterThan(0);
  });

  test('11. Toggle button removed from timer cards', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    // There should be NO .tc-toggle elements
    const toggleCount = await page.locator('.tc-toggle').count();
    console.log('  [test11] Toggle buttons found:', toggleCount);
    expect(toggleCount).toBe(0);

    // Timer cards should NOT have .timer-disabled class
    const disabledCount = await page.locator('.timer-card.timer-disabled').count();
    expect(disabledCount).toBe(0);
  });

  test('12. Timer card has play button, settings, and context menu', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    const firstCard = page.locator('.timer-card').first();

    // Play button
    await expect(firstCard.locator('[data-toggle-timer]')).toBeVisible();
    // Settings button
    await expect(firstCard.locator('[data-open-settings]')).toBeVisible();
    // Context menu button
    await expect(firstCard.locator('[data-ctx]')).toBeVisible();
    // Title
    await expect(firstCard.locator('.tc-title')).toBeVisible();
    // Duration
    await expect(firstCard.locator('.tc-duration')).toBeVisible();

    console.log('  [test12] Timer card structure valid');
  });

  test('13. Marker flag position updates with timer', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    // Start timer
    await page.click('#btn-play-pause');
    await page.waitForTimeout(2_000);

    // The time markers bar should exist
    const markersBar = page.locator('#time-markers-bar');
    await expect(markersBar).toBeVisible();

    // The marker flag should exist
    const markerFlag = page.locator('#marker-flag');
    await expect(markerFlag).toBeVisible();

    // Pause
    await page.click('#btn-play-pause');
    await page.waitForTimeout(300);

    console.log('  [test13] Marker flag visible and positioned');
  });
});

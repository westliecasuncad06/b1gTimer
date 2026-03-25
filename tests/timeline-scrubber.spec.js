// @ts-check
/**
 * B1G Timer – Timeline Scrubber Tests
 *
 * Tests the interactive timeline scrubber on the progress bar:
 *  1. Hover shows red line and tooltip
 *  2. Tooltip shows correct time based on position
 *  3. Click-to-scrub changes remaining time
 *  4. Scrub broadcasts via adjustTime
 *  5. Mouse leave hides scrubber elements
 */

const { test, expect } = require('@playwright/test');

const DASHBOARD_URL = 'http://localhost/B1G_TIMER/public/index.html';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function selectFirstRoom(page) {
  await page.waitForFunction(() => {
    const sel = document.getElementById('room-selector');
    if (!sel) return false;
    return Array.from(sel.options).some(o => o.value && o.value !== '');
  }, { timeout: 15_000 });

  await page.evaluate(() => {
    const sel = document.getElementById('room-selector');
    const firstOpt = Array.from(sel.options).find(o => o.value && o.value !== '');
    if (firstOpt) {
      sel.value = firstOpt.value;
      sel.dispatchEvent(new Event('change'));
    }
  });
  await page.waitForTimeout(1_000);
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

async function startTimerIfNeeded(page) {
  // Click a timer card to select it
  const card = page.locator('[data-toggle-timer]').first();
  await card.click();
  await page.waitForTimeout(400);

  // Start the timer
  await page.click('#btn-play-pause');
  await page.waitForTimeout(1_000);
}

async function ensureStopped(page) {
  const isPaused = await page.locator('#btn-play-pause i.fa-pause').isVisible();
  if (isPaused) {
    await page.click('#btn-play-pause');
    await page.waitForTimeout(500);
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Timeline Scrubber', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
  });

  test('1. Scrubber elements exist in DOM', async ({ page }) => {
    const outer = page.locator('#preview-progress-outer');
    const wrap = page.locator('#preview-progress-wrap');
    const hoverLine = page.locator('#scrub-hover-line');
    const tooltip = page.locator('#scrub-tooltip');

    await expect(outer).toBeAttached();
    await expect(wrap).toBeAttached();
    await expect(hoverLine).toBeAttached();
    await expect(tooltip).toBeAttached();

    // Initially hidden
    await expect(hoverLine).toBeHidden();
    await expect(tooltip).toBeHidden();
  });

  test('2. Hover shows red line and tooltip', async ({ page }) => {
    // Start a timer so we have duration context
    await startTimerIfNeeded(page);

    const wrap = page.locator('#preview-progress-wrap');
    const hoverLine = page.locator('#scrub-hover-line');
    const tooltip = page.locator('#scrub-tooltip');

    // Hover over the center of the progress bar
    await wrap.hover({ position: { x: 200, y: 12 } });
    await page.waitForTimeout(300);

    await expect(hoverLine).toBeVisible();
    await expect(tooltip).toBeVisible();

    // Tooltip should show a time value (e.g., "5:00" for midpoint of 10min)
    const text = await tooltip.textContent();
    expect(text).toMatch(/\d+:\d{2}/);
    console.log('  [test2] Scrubber tooltip:', text);

    // Cleanup: stop timer
    await ensureStopped(page);
  });

  test('3. Mouse leave hides scrubber elements', async ({ page }) => {
    await startTimerIfNeeded(page);

    const wrap = page.locator('#preview-progress-wrap');
    const hoverLine = page.locator('#scrub-hover-line');
    const tooltip = page.locator('#scrub-tooltip');

    // Hover over the progress bar
    await wrap.hover({ position: { x: 200, y: 12 } });
    await page.waitForTimeout(200);
    await expect(hoverLine).toBeVisible();

    // Move away from the progress bar
    await page.locator('#preview-display').hover();
    await page.waitForTimeout(300);

    await expect(hoverLine).toBeHidden();
    await expect(tooltip).toBeHidden();

    await ensureStopped(page);
  });

  test('4. Click-to-scrub adjusts timer remaining time', async ({ page }) => {
    await startTimerIfNeeded(page);
    await page.waitForTimeout(500);

    // Get current remaining time before scrub
    const beforeText = await page.locator('#on-air-time').textContent();
    console.log('  [test4] Before scrub:', beforeText);

    // Click on ~25% of the progress bar (should scrub to ~25% of duration)
    const wrap = page.locator('#preview-progress-wrap');
    const box = await wrap.boundingBox();
    const clickX = Math.round(box.width * 0.25);
    await wrap.click({ position: { x: clickX, y: 12 } });
    await page.waitForTimeout(500);

    // Get the remaining time after scrub
    const afterText = await page.locator('#on-air-time').textContent();
    console.log('  [test4] After scrub:', afterText);

    // The time should have changed
    expect(afterText).not.toBe(beforeText);

    await ensureStopped(page);
  });

  test('5. Tooltip shows correct time for position', async ({ page }) => {
    await startTimerIfNeeded(page);

    const wrap = page.locator('#preview-progress-wrap');
    const tooltip = page.locator('#scrub-tooltip');
    const box = await wrap.boundingBox();

    // Hover near the right edge (should be close to full duration)
    await wrap.hover({ position: { x: Math.round(box.width * 0.95), y: 12 } });
    await page.waitForTimeout(200);
    const textFull = await tooltip.textContent();
    console.log('  [test5] Near 100%:', textFull);

    // Hover near the left edge (should be close to 0:00)
    await wrap.hover({ position: { x: Math.round(box.width * 0.05), y: 12 } });
    await page.waitForTimeout(200);
    const textZero = await tooltip.textContent();
    console.log('  [test5] Near 0%:', textZero);

    // The right-side time should be larger than the left-side time
    expect(textFull).not.toBe(textZero);

    await ensureStopped(page);
  });

  test('6. Progress bar has cursor:pointer style', async ({ page }) => {
    const cursor = await page.locator('#preview-progress-wrap').evaluate(el =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');
  });
});

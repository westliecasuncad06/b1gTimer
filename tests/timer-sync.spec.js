// @ts-check
/**
 * B1G Timer - End-to-End Sync & Persistence Tests
 *
 * Covers:
 *  1. Stage display starts counting AND continues counting after dashboard starts a timer
 *  2. Dashboard refresh resumes the timer from the correct second (deadline arch.)
 *  3. data-toggle-timer card button toggles play/pause on both screens
 *  4. Stage in a SEPARATE browser context (no BroadcastChannel) syncs via server API
 *
 * Tests 1-3 use the SAME browser context so that the BroadcastChannel API relays
 * events between pages without requiring a live Pusher connection.
 * Test 4 uses TWO SEPARATE contexts to verify the server-polling / API sync path.
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Wait until the room-selector has at least one real room option, then select
 * the first one and return its numeric id.
 * @param {import('@playwright/test').Page} page
 */
async function selectFirstRoom(page) {
  await page.waitForFunction(() => {
    const sel = document.getElementById('room-selector');
    if (!sel) return false;
    const opts = Array.from(sel.options).filter(o => o.value && o.value !== '');
    return opts.length > 0;
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

  if (!roomId) throw new Error('No room found in the selector – ensure the DB has at least one room.');
  console.log('  [helper] selected room', roomId);
  return roomId;
}

/**
 * Wait until the timer list has at least one timer card with a toggle button.
 * If the room is empty, add a default 10-minute timer first.
 * @param {import('@playwright/test').Page} page
 */
async function waitForTimerList(page) {
  const already = await page.locator('[data-toggle-timer]').count();
  if (already === 0) {
    await page.click('#btn-add-timer');
    await page.waitForTimeout(400);
    await page.click('#btn-save');
    await page.waitForTimeout(600);
  }
  await page.waitForSelector('[data-toggle-timer]', { timeout: 12_000 });
}

/**
 * Parse the text content of the stage countdown element into a float (seconds).
 * Accepts formats: "M:SS", "H:MM:SS", optionally negative.
 * @param {string} text
 */
function parseCountdownSeconds(text) {
  const clean = text.trim().replace(/[^0-9:.-]/g, '');
  const neg = clean.startsWith('-');
  const parts = clean.replace('-', '').split(':').map(Number);
  if (parts.length === 2) return (neg ? -1 : 1) * (parts[0] * 60 + parts[1]);
  if (parts.length === 3) return (neg ? -1 : 1) * (parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

/**
 * Ensure the dashboard is in a paused/stopped state (play icon visible).
 * Clicks the play button once if it's currently showing a pause icon.
 * @param {import('@playwright/test').Page} page
 */
async function ensureStopped(page) {
  const isPaused = await page.locator('#btn-play-pause i.fa-pause').isVisible();
  if (isPaused) {
    await page.click('#btn-play-pause');
    await page.waitForTimeout(300);
  }
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('B1G Timer – Persistence & Sync', () => {

  // ── Test 1 ────────────────────────────────────────────────────────────────
  test('Stage display shows AND continues a running countdown after dashboard starts a timer', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();   // same context → BroadcastChannel works

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);
    await ensureStopped(dashboard);

    // Open stage AFTER we know the room id
    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // ── Start the timer via the transport play button ──────────────────────
    await dashboard.click('#btn-play-pause');
    console.log('  [test1] clicked #btn-play-pause');

    // Dashboard: play button should now show a pause icon
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Stage: countdown must leave the static/waiting 0:00 state
    await stage.waitForFunction(() => {
      const el = document.getElementById('countdown');
      if (!el) return false;
      const txt = el.textContent.trim();
      return txt !== '0:00' && txt !== '' && !el.classList.contains('waiting');
    }, { timeout: 10_000 });

    // Read the countdown at T=0 then again after 2.5 s — must be decreasing
    const sec0 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test1] stage countdown at T=0:', sec0.toFixed(1) + 's');
    expect(sec0).toBeGreaterThan(0);

    await stage.waitForTimeout(2_500);

    const sec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test1] stage countdown at T+2.5s:', sec2.toFixed(1) + 's');

    // The countdown must have decreased by at least 1 second (generous tolerance)
    expect(sec0 - sec2).toBeGreaterThan(1);

    // Pause to leave DB in a known state
    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(400);
  });

  // ── Test 2 ────────────────────────────────────────────────────────────────
  test('Dashboard refresh resumes the timer from the correct second (deadline arch.)', async ({ context }) => {
    const dashboard = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);
    await ensureStopped(dashboard);

    // Start timer
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Record time BEFORE reload (run for ~3 s first)
    await dashboard.waitForTimeout(3_000);
    const textBefore = await dashboard.locator('#preview-countdown').textContent();
    const secBefore  = parseCountdownSeconds(textBefore);
    console.log('  [test2] before reload:', textBefore, '→', secBefore.toFixed(1), 's');

    // ── Reload the dashboard ──────────────────────────────────────────────
    await dashboard.reload({ waitUntil: 'domcontentloaded' });

    // After reload, the play button should show a PAUSE icon (timer still running)
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 12_000 });

    // Give the tick-loop one cycle then wait a bit so the timer visibly decreases
    await dashboard.waitForTimeout(2_500);

    const textAfterA = await dashboard.locator('#preview-countdown').textContent();
    const secAfterA  = parseCountdownSeconds(textAfterA);

    // Wait another 2.5 seconds and read again — must be decreasing (not static)
    await dashboard.waitForTimeout(2_500);
    const textAfterB = await dashboard.locator('#preview-countdown').textContent();
    const secAfterB  = parseCountdownSeconds(textAfterB);

    console.log('  [test2] after reload T=0:', textAfterA, '→', secAfterA.toFixed(1), 's');
    console.log('  [test2] after reload T+2.5s:', textAfterB, '→', secAfterB.toFixed(1), 's');

    // 1) Restored time must be LESS than the time before reload (timer counted during reload + wait)
    expect(secAfterA).toBeLessThan(secBefore);
    // 2) Timer must NOT have jumped back to full duration (not reset to 0 or full)
    expect(secAfterA).toBeGreaterThan(0);
    // 3) Timer must STILL be running (countdown continued after reload)
    expect(secAfterA - secAfterB).toBeGreaterThanOrEqual(2);

    // Pause to clean up
    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 3 ────────────────────────────────────────────────────────────────
  test('data-toggle-timer card button toggles play/pause on both screens', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();   // same context → BroadcastChannel works

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await waitForTimerList(dashboard);
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    const firstToggle = dashboard.locator('[data-toggle-timer]').first();

    // ── Click once → should START the timer ───────────────────────────────
    await firstToggle.click();
    console.log('  [test3] clicked toggle (start)');

    // Transport button should switch to pause icon
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Stage countdown should be running (not static 0:00)
    await stage.waitForFunction(() => {
      const el = document.getElementById('countdown');
      return el && el.textContent.trim() !== '0:00' && !el.classList.contains('waiting');
    }, { timeout: 8_000 });

    // Card toggle button itself should show a pause icon
    const toggleIcon = firstToggle.locator('i');
    await expect(toggleIcon).toHaveClass(/fa-pause/, { timeout: 3_000 });

    // ── Click again → should PAUSE the timer ──────────────────────────────
    await firstToggle.click();
    console.log('  [test3] clicked toggle (pause)');

    // Transport button should revert to play icon
    await expect(dashboard.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });

    // Card toggle button should now show play icon
    await expect(toggleIcon).toHaveClass(/fa-play/, { timeout: 3_000 });

    // Stage play button should revert to play icon
    await expect(stage.locator('#stage-btn-play-pause i.fa-play')).toBeVisible({ timeout: 6_000 });

    // ── Click a third time → should RESUME ────────────────────────────────
    await firstToggle.click();
    console.log('  [test3] clicked toggle (resume)');

    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await expect(toggleIcon).toHaveClass(/fa-pause/, { timeout: 3_000 });

    // Pause to leave the DB clean
    await firstToggle.click();
    await dashboard.waitForTimeout(300);
  });

  // ── Test 4 ────────────────────────────────────────────────────────────────
  test('Stage in a different browser context syncs running timer from server API', async ({ browser }) => {
    // Use two completely separate browser contexts — NO shared BroadcastChannel or localStorage
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const dashboard = await ctxA.newPage();
      const stage     = await ctxB.newPage();

      await dashboard.goto(DASHBOARD_URL);
      const roomId = await selectFirstRoom(dashboard);
      await waitForTimerList(dashboard);
      await ensureStopped(dashboard);

      // ── Start the timer on dashboard (context A) ─────────────────────────
      await dashboard.click('#btn-play-pause');
      await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

      // Let it run for a moment so the DB has an authoritative deadline
      await dashboard.waitForTimeout(1_500);
      const dashText = await dashboard.locator('#preview-countdown').textContent();
      const dashSec  = parseCountdownSeconds(dashText);
      console.log('  [test4] dashboard running at:', dashText, '→', dashSec.toFixed(1), 's');

      // ── Open stage in the SEPARATE context (no BroadcastChannel) ─────────
      await stage.goto(`${BASE}/stage.html?room=${roomId}`);
      await stage.waitForSelector('#countdown', { timeout: 10_000 });

      // Stage must sync from server API and display a running countdown
      await stage.waitForFunction(() => {
        const el = document.getElementById('countdown');
        if (!el) return false;
        const txt = el.textContent.trim();
        return txt !== '0:00' && txt !== '' && !el.classList.contains('waiting');
      }, { timeout: 12_000 });

      const stageSec0 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
      console.log('  [test4] stage synced at:', stageSec0.toFixed(1), 's');

      // Synced value must be close to dashboard value (within 5 s)
      expect(Math.abs(dashSec - stageSec0)).toBeLessThan(5);
      expect(stageSec0).toBeGreaterThan(0);

      // Wait 2.5 s and confirm the stage countdown is actively decreasing
      await stage.waitForTimeout(2_500);
      const stageSec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
      console.log('  [test4] stage at T+2.5s:', stageSec2.toFixed(1), 's');
      expect(stageSec0 - stageSec2).toBeGreaterThan(1);

      // ── Pause via dashboard, stage should stop ───────────────────────────
      await dashboard.click('#btn-play-pause');
      await expect(dashboard.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });

      // Stage should eventually show play icon (via polling in ≤6 s)
      await expect(stage.locator('#stage-btn-play-pause i.fa-play')).toBeVisible({ timeout: 10_000 });

    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

});

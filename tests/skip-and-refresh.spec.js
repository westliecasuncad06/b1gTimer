// @ts-check
/**
 * B1G Timer – Skip (Next/Previous) & Page-Refresh Persistence Tests
 *
 * Covers:
 *  1. Next button starts the new timer on the stage display (not 0:00)
 *  2. Previous button starts the previous timer on the stage display
 *  3. Stage refresh while timer is running resumes from correct second
 *  4. Stage refresh while timer is paused shows paused remaining time
 *  5. TIMER_START broadcast includes deadlineTimestamp
 *  6. Next button does NOT broadcast TIMER_STOP (no 0:00 flash)
 *  7. Dashboard refresh while timer is running resumes correctly
 *  8. Multiple rapid next clicks don't break the stage countdown
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;

// ─── helpers ────────────────────────────────────────────────────────────────

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

  if (!roomId) throw new Error('No room found in the selector.');
  return roomId;
}

async function ensureTimerCount(page, minCount) {
  await page.waitForSelector('[data-toggle-timer]', { timeout: 12_000 }).catch(() => {});
  let count = await page.locator('[data-toggle-timer]').count();

  while (count < minCount) {
    await page.click('#btn-add-timer');
    await page.waitForTimeout(400);
    await page.click('#btn-save');
    await page.waitForTimeout(600);
    count = await page.locator('[data-toggle-timer]').count();
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

function parseCountdownSeconds(text) {
  const clean = text.trim().replace(/[^0-9:.-]/g, '');
  const neg = clean.startsWith('-');
  const parts = clean.replace('-', '').split(':').map(Number);
  if (parts.length === 2) return (neg ? -1 : 1) * (parts[0] * 60 + parts[1]);
  if (parts.length === 3) return (neg ? -1 : 1) * (parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

/**
 * Wait for stage countdown to show a positive running value (not 0:00 or waiting)
 */
async function waitForStageCountdown(stage, timeout = 10_000) {
  await stage.waitForFunction(() => {
    const el = document.getElementById('countdown');
    if (!el) return false;
    const txt = el.textContent.trim();
    return txt !== '0:00' && txt !== '' && !el.classList.contains('waiting');
  }, { timeout });
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('B1G Timer – Skip & Refresh', () => {

  // ── Test 1: Next button starts timer on stage ─────────────────────────────
  test('Next button starts the new timer on the stage (not 0:00)', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 2);
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // Start first timer
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(1_500);

    // Click Next
    await dashboard.click('[data-action="next-timer"]');
    console.log('  [test1] clicked Next');

    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Stage must show a running countdown (not 0:00)
    await waitForStageCountdown(stage);

    const sec0 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test1] stage after Next:', sec0.toFixed(1) + 's');
    expect(sec0).toBeGreaterThan(0);

    // Confirm actively counting
    await stage.waitForTimeout(2_500);
    const sec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test1] stage +2.5s:', sec2.toFixed(1) + 's');
    expect(sec0 - sec2).toBeGreaterThanOrEqual(2);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 2: Previous button starts timer on stage ─────────────────────────
  test('Previous button starts the previous timer on the stage', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 2);
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // Start timer and skip to next so we can go back
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(1_000);
    await dashboard.click('[data-action="next-timer"]');
    await dashboard.waitForTimeout(1_500);

    // Click Previous
    await dashboard.click('[data-action="previous-timer"]');
    console.log('  [test2] clicked Previous');

    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    await waitForStageCountdown(stage);

    const sec0 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test2] stage after Previous:', sec0.toFixed(1) + 's');
    expect(sec0).toBeGreaterThan(0);

    await stage.waitForTimeout(2_500);
    const sec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    expect(sec0 - sec2).toBeGreaterThanOrEqual(2);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 3: Stage refresh while running ───────────────────────────────────
  test('Stage refresh while timer is running resumes the countdown', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 1);
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // Start timer
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await waitForStageCountdown(stage);

    // Let it run, record value
    await stage.waitForTimeout(3_000);
    const secBefore = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test3] before refresh:', secBefore.toFixed(1) + 's');

    // Refresh the stage
    await stage.reload({ waitUntil: 'domcontentloaded' });
    await stage.waitForSelector('#countdown', { timeout: 10_000 });
    await waitForStageCountdown(stage, 12_000);

    // Wait so the timer visibly decreases after refresh
    await stage.waitForTimeout(3_000);
    const secAfter = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test3] after refresh +3s:', secAfter.toFixed(1) + 's');

    // Timer must have continued (not reset to full duration or 0)
    expect(secAfter).toBeLessThan(secBefore);
    expect(secAfter).toBeGreaterThan(0);

    // Confirm still actively counting
    await stage.waitForTimeout(2_500);
    const secLater = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test3] after refresh +5.5s:', secLater.toFixed(1) + 's');
    expect(secAfter - secLater).toBeGreaterThanOrEqual(2);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 4: Stage refresh while paused ────────────────────────────────────
  test('Stage refresh while paused shows the paused remaining time', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 1);
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // Start → run → pause
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(2_000);
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(500);

    const dashSec = parseCountdownSeconds(await dashboard.locator('#preview-countdown').textContent());
    console.log('  [test4] paused at:', dashSec.toFixed(1) + 's');

    // Refresh stage
    await stage.reload({ waitUntil: 'domcontentloaded' });
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    await stage.waitForFunction(() => {
      const el = document.getElementById('countdown');
      return el && el.textContent.trim() !== '0:00';
    }, { timeout: 12_000 });

    await stage.waitForTimeout(1_000);
    const stageSec = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test4] stage after refresh:', stageSec.toFixed(1) + 's');

    expect(Math.abs(stageSec - dashSec)).toBeLessThan(3);

    // Confirm frozen (not counting)
    await stage.waitForTimeout(2_000);
    const stageSec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    expect(Math.abs(stageSec - stageSec2)).toBeLessThan(1);
  });

  // ── Test 5: TIMER_START includes deadlineTimestamp ────────────────────────
  test('TIMER_START broadcast includes deadlineTimestamp', async ({ context }) => {
    const dashboard = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 1);
    await ensureStopped(dashboard);

    const receivedDeadline = await dashboard.evaluate(async (rid) => {
      return new Promise((resolve) => {
        const ch = new BroadcastChannel('b1g-timer-room-' + rid);
        ch.onmessage = (event) => {
          const { action, data } = event.data || {};
          if (action === 'TIMER_START') {
            resolve(!!data.deadlineTimestamp);
            ch.close();
          }
        };
        setTimeout(() => document.getElementById('btn-play-pause').click(), 200);
        setTimeout(() => resolve(false), 8_000);
      });
    }, roomId);

    console.log('  [test5] has deadlineTimestamp:', receivedDeadline);
    expect(receivedDeadline).toBe(true);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 6: Next does NOT broadcast TIMER_STOP ────────────────────────────
  test('Next button does not broadcast TIMER_STOP (no 0:00 flash)', async ({ context }) => {
    const dashboard = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 2);
    await ensureStopped(dashboard);

    // Start timer first
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(500);

    // Listen for BroadcastChannel messages, then click Next
    const events = await dashboard.evaluate(async (rid) => {
      return new Promise((resolve) => {
        const ch = new BroadcastChannel('b1g-timer-room-' + rid);
        const captured = [];
        ch.onmessage = (event) => {
          const { action } = event.data || {};
          if (action) captured.push(action);
        };
        // Click next after a short delay
        setTimeout(() => {
          document.querySelector('[data-action="next-timer"]').click();
        }, 200);
        // Collect events for 2 seconds
        setTimeout(() => {
          ch.close();
          resolve(captured);
        }, 2_500);
      });
    }, roomId);

    console.log('  [test6] events after Next:', events);

    // Should have TIMER_START but NOT TIMER_STOP
    expect(events).toContain('TIMER_START');
    expect(events).not.toContain('TIMER_STOP');

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 7: Dashboard refresh while running ───────────────────────────────
  test('Dashboard refresh while timer is running resumes correctly', async ({ context }) => {
    const dashboard = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 1);
    await ensureStopped(dashboard);

    // Start timer
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Let it run 3 seconds
    await dashboard.waitForTimeout(3_000);
    const secBefore = parseCountdownSeconds(await dashboard.locator('#preview-countdown').textContent());
    console.log('  [test7] before refresh:', secBefore.toFixed(1) + 's');

    // Refresh dashboard
    await dashboard.reload({ waitUntil: 'domcontentloaded' });

    // Should resume running (pause icon visible)
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 12_000 });

    // Wait, then confirm timer is counting down
    await dashboard.waitForTimeout(3_000);
    const secAfter = parseCountdownSeconds(await dashboard.locator('#preview-countdown').textContent());
    console.log('  [test7] after refresh +3s:', secAfter.toFixed(1) + 's');

    expect(secAfter).toBeLessThan(secBefore);
    expect(secAfter).toBeGreaterThan(0);

    // Confirm still running
    await dashboard.waitForTimeout(2_500);
    const secLater = parseCountdownSeconds(await dashboard.locator('#preview-countdown').textContent());
    console.log('  [test7] after refresh +5.5s:', secLater.toFixed(1) + 's');
    expect(secAfter - secLater).toBeGreaterThanOrEqual(2);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

  // ── Test 8: Multiple rapid next clicks ────────────────────────────────────
  test('Multiple rapid next clicks leave stage with running countdown', async ({ context }) => {
    const dashboard = await context.newPage();
    const stage     = await context.newPage();

    await dashboard.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboard);
    await ensureTimerCount(dashboard, 4);  // need at least 4 timers
    await ensureStopped(dashboard);

    await stage.goto(`${BASE}/stage.html?room=${roomId}`);
    await stage.waitForSelector('#countdown', { timeout: 10_000 });

    // Start timer
    await dashboard.click('#btn-play-pause');
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    await dashboard.waitForTimeout(500);

    // Click Next 3 times rapidly
    await dashboard.click('[data-action="next-timer"]');
    await dashboard.waitForTimeout(200);
    await dashboard.click('[data-action="next-timer"]');
    await dashboard.waitForTimeout(200);
    await dashboard.click('[data-action="next-timer"]');
    console.log('  [test8] clicked Next 3 times');

    // Dashboard should still be running
    await expect(dashboard.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Stage must be running (not stuck at 0:00)
    await waitForStageCountdown(stage);

    const sec0 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    console.log('  [test8] stage after 3x Next:', sec0.toFixed(1) + 's');
    expect(sec0).toBeGreaterThan(0);

    // Confirm counting
    await stage.waitForTimeout(2_500);
    const sec2 = parseCountdownSeconds(await stage.locator('#countdown').textContent());
    expect(sec0 - sec2).toBeGreaterThanOrEqual(2);

    await dashboard.click('#btn-play-pause');
    await dashboard.waitForTimeout(300);
  });

});

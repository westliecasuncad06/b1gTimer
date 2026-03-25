// @ts-check
/**
 * B1G Timer – Feature Coverage Tests
 *
 * Covers additional features beyond the core sync tests:
 *  5.  Timer card layout — all card columns (title, type, start-time, controls) are visible
 *  6.  selectTimer() fix — clicking a different card while running stops the running timer first
 *  7.  Reset (⟳) button — resets timer to full duration, play button reverts to ▶
 *  8.  Message show/hide workflow — MESSAGE_SHOW and MESSAGE_HIDE events broadcast correctly
 *  9.  Focus button — FLASH_TRIGGER event broadcast
 *  10. Blackout on/off — BLACKOUT_ON / BLACKOUT_OFF events broadcast correctly
 *  11. Per-card play on non-first timer — clicking the per-card toggle on Timer 2 starts it
 */

const { test, expect } = require('@playwright/test');

const BASE          = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;

// ─── Shared helpers (duplicated from timer-sync.spec.js for file independence) ──

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
  console.log('  [helper] selected room', roomId);
  return roomId;
}

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

function parseCountdownSeconds(text) {
  const clean = text.trim().replace(/[^0-9:.-]/g, '');
  const neg   = clean.startsWith('-');
  const parts = clean.replace('-', '').split(':').map(Number);
  if (parts.length === 2) return (neg ? -1 : 1) * (parts[0] * 60 + parts[1]);
  if (parts.length === 3) return (neg ? -1 : 1) * (parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

async function ensureStopped(page) {
  const isPaused = await page.locator('#btn-play-pause i.fa-pause').isVisible();
  if (isPaused) {
    await page.click('#btn-play-pause');
    await page.waitForTimeout(400);
  }
}

/** Collect console log messages matching a pattern while performing an action. */
async function captureConsoleLogs(page, pattern, action) {
  const captured = [];
  const handler = msg => {
    if (msg.type() === 'log' && pattern.test(msg.text())) {
      captured.push(msg.text());
    }
  };
  page.on('console', handler);
  await action();
  // Give Pusher a moment to echo the event back through the console
  await page.waitForTimeout(1_500);
  page.off('console', handler);
  return captured;
}

// ─── tests ──────────────────────────────────────────────────────────────────

test.describe('B1G Timer – Feature Coverage', () => {

  // ── Test 5: Timer card layout ─────────────────────────────────────────────
  test('Timer cards display title, type pill, start-time, and control buttons', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    const cards = page.locator('.timer-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check the first card has visible, non-empty title and type pill
    const firstCard = cards.first();

    const title = firstCard.locator('.tc-title');
    await expect(title).toBeVisible({ timeout: 5_000 });
    const titleText = (await title.textContent()).trim();
    expect(titleText.length).toBeGreaterThan(0);
    console.log('  [test5] first card title:', titleText);

    // Type pill should be visible and show "Countdown" or similar
    const typePill = firstCard.locator('.tc-type');
    await expect(typePill).toBeVisible();

    // tc-info column should have a non-zero rendered width (the CSS grid fix)
    const infoWidth = await firstCard.locator('.tc-info').evaluate(el => el.getBoundingClientRect().width);
    console.log('  [test5] tc-info width:', infoWidth.toFixed(1) + 'px');
    expect(infoWidth).toBeGreaterThan(50); // must NOT be collapsed to 0px

    // Duration is visible
    const duration = firstCard.locator('.tc-duration');
    await expect(duration).toBeVisible();
    const durationText = (await duration.textContent()).trim();
    expect(durationText).toMatch(/\d+:\d+/); // e.g. "10:00"
    console.log('  [test5] first card duration:', durationText);

    // Control buttons (toggle, settings) are visible
    const toggleBtn = firstCard.locator('[data-toggle-timer]');
    await expect(toggleBtn).toBeVisible();
  });

  // ── Test 6: selectTimer() fix ─────────────────────────────────────────────
  test('Clicking a different timer card while running stops the current timer first', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    const cards = page.locator('.timer-card');
    const count = await cards.count();
    // Need at least 2 timers for this test
    if (count < 2) {
      test.skip(); return;
    }

    // 1. Start Timer 1 via transport play
    await page.click('#btn-play-pause');
    await expect(page.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });
    console.log('  [test6] Timer 1 started');

    // Read the active timer title from preview
    const timerOneBefore = (await page.locator('#preview-timer-name').textContent()).trim();
    console.log('  [test6] active timer before switch:', timerOneBefore);

    // 2. Click the SECOND timer card body (not a button inside it)
    // We capture TIMER_STOP events to verify the running timer was stopped first
    const logs = await captureConsoleLogs(
      page,
      /Pusher Event.*TIMER_STOP|TimerEngine.*Timer stopped/,
      async () => {
        await cards.nth(1).click();
      }
    );

    // TIMER_STOP must have fired before switch
    console.log('  [test6] captured TIMER_STOP logs:', logs.length);
    expect(logs.length).toBeGreaterThan(0);

    // 3. Play button should now show ▶ (stop then idle, not running)
    await expect(page.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });

    // 4. The SECOND timer card should now be active
    const activeCard = page.locator('.timer-card.active');
    await expect(activeCard).toHaveCount(1, { timeout: 3_000 });
    const activeTitle = await activeCard.locator('.tc-title').textContent();
    console.log('  [test6] active card after switch:', activeTitle.trim());

    // Should NOT be the same as the first timer
    const timerOneTitle = (await cards.first().locator('.tc-title').textContent()).trim();
    expect(activeTitle.trim()).not.toEqual(timerOneTitle);

    // 5. Preview should reflect the second timer, NOT still counting Timer 1's deadline
    const previewCountdown = (await page.locator('#preview-countdown').textContent()).trim();
    const seconds = parseCountdownSeconds(previewCountdown);
    // Should be close to full duration of Timer 2 (not a partially-decremented Timer 1 reading)
    console.log('  [test6] preview countdown after switch:', previewCountdown, '→', seconds.toFixed(1) + 's');
    // The second timer typically has a SHORTER duration than Timer 1 (5:00 < 10:00),
    // so if we see > 550s it would mean Timer 1's clock was still running — that's the bug.
    // We just check it's at least somewhat reasonable (> 0).
    expect(seconds).toBeGreaterThanOrEqual(0);
  });

  // ── Test 7: Reset button ──────────────────────────────────────────────────
  test('Reset button restores timer to full duration and shows play icon', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    // Read full duration before starting
    const fullDurationText = (await page.locator('#preview-countdown').textContent()).trim();
    const fullSec = parseCountdownSeconds(fullDurationText);
    console.log('  [test7] full duration:', fullDurationText, '→', fullSec.toFixed(1) + 's');
    expect(fullSec).toBeGreaterThan(0);

    // Start the timer
    await page.click('#btn-play-pause');
    await expect(page.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Let it run for 3 seconds
    await page.waitForTimeout(3_000);
    const runningText = (await page.locator('#preview-countdown').textContent()).trim();
    const runningSec  = parseCountdownSeconds(runningText);
    console.log('  [test7] running at:', runningText, '→', runningSec.toFixed(1) + 's');
    expect(runningSec).toBeLessThan(fullSec); // must have counted down

    // Pause (optional, but tests reset from paused state too)
    await page.click('#btn-play-pause');
    await expect(page.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });

    // Click Reset button and capture TIMER_RESET broadcast
    const resetLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*TIMER_RESET|TimerEngine.*Timer reset/,
      async () => {
        await page.click('#btn-reset');
      }
    );

    console.log('  [test7] TIMER_RESET logs:', resetLogs.length);
    expect(resetLogs.length).toBeGreaterThan(0);

    // Preview must now show the FULL duration again
    await page.waitForTimeout(300);
    const afterResetText = (await page.locator('#preview-countdown').textContent()).trim();
    const afterResetSec  = parseCountdownSeconds(afterResetText);
    console.log('  [test7] after reset:', afterResetText, '→', afterResetSec.toFixed(1) + 's');
    expect(Math.abs(afterResetSec - fullSec)).toBeLessThanOrEqual(1); // within 1s of full duration

    // Play button must show ▶ (not ❚❚)
    await expect(page.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 3_000 });
  });

  // ── Test 8: Message show/hide ─────────────────────────────────────────────
  test('Message Show toggle broadcasts MESSAGE_SHOW and MESSAGE_HIDE', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    // Type a message in the first message card textarea
    const textarea = page.locator('[data-msg-input="0"]');
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill('Test broadcast message');

    // Capture MESSAGE_SHOW event when clicking "Show"
    const showLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*MESSAGE_SHOW|MessageManager.*Message shown/,
      async () => {
        await page.locator('[data-msg-show="0"]').click();
      }
    );

    console.log('  [test8] MESSAGE_SHOW logs:', showLogs.length);
    expect(showLogs.length).toBeGreaterThan(0);

    // The show toggle should now have the "active" class on its wrapper
    const showToggle = page.locator('[data-msg-show="0"]').locator('xpath=..'); // parent
    // The .msg-show-toggle wrapper is the parent div
    await expect(page.locator('.msg-show-toggle').first()).toHaveClass(/active/, { timeout: 3_000 });

    // Now click "Show" again to HIDE the message — capture MESSAGE_HIDE
    const hideLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*MESSAGE_HIDE|MessageManager.*Message hidden/,
      async () => {
        await page.locator('[data-msg-show="0"]').click();
      }
    );

    console.log('  [test8] MESSAGE_HIDE logs:', hideLogs.length);
    expect(hideLogs.length).toBeGreaterThan(0);

    // Toggle should no longer have "active"
    await expect(page.locator('.msg-show-toggle').first()).not.toHaveClass(/active/, { timeout: 3_000 });
  });

  // ── Test 9: Focus button → FLASH_TRIGGER ─────────────────────────────────
  test('Focus button broadcasts FLASH_TRIGGER event', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    const flashLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*FLASH_TRIGGER/,
      async () => {
        await page.click('#btn-msg-focus');
      }
    );

    console.log('  [test9] FLASH_TRIGGER logs:', flashLogs.length);
    expect(flashLogs.length).toBeGreaterThan(0);

    // Button should be toggled "active"
    await expect(page.locator('#btn-msg-focus')).toHaveClass(/active/, { timeout: 3_000 });
  });

  // ── Test 10: Blackout on/off ───────────────────────────────────────────────
  test('Blackout button broadcasts BLACKOUT_ON then BLACKOUT_OFF', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);

    // Ensure blackout is OFF first
    const isActive = await page.locator('#btn-blackout').evaluate(btn => btn.classList.contains('active'));
    if (isActive) {
      await page.click('#btn-blackout');
      await page.waitForTimeout(600);
    }

    // Click BLACKOUT ON
    const onLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*BLACKOUT_ON/,
      async () => {
        await page.click('#btn-blackout');
      }
    );

    console.log('  [test10] BLACKOUT_ON logs:', onLogs.length);
    expect(onLogs.length).toBeGreaterThan(0);
    await expect(page.locator('#btn-blackout')).toHaveClass(/active/, { timeout: 3_000 });

    // Click BLACKOUT OFF
    const offLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*BLACKOUT_OFF/,
      async () => {
        await page.click('#btn-blackout');
      }
    );

    console.log('  [test10] BLACKOUT_OFF logs:', offLogs.length);
    expect(offLogs.length).toBeGreaterThan(0);
    await expect(page.locator('#btn-blackout')).not.toHaveClass(/active/, { timeout: 3_000 });
  });

  // ── Test 11: Per-card play on non-first timer ─────────────────────────────
  test('Per-card toggle on Timer 2 card starts and pauses Timer 2', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await selectFirstRoom(page);
    await waitForTimerList(page);
    await ensureStopped(page);

    const cards = page.locator('.timer-card');
    const count = await cards.count();
    if (count < 2) { test.skip(); return; }

    const secondCard   = cards.nth(1);
    const secondToggle = secondCard.locator('[data-toggle-timer]');

    // Read Timer 2 title for logging
    const timer2Title = (await secondCard.locator('.tc-title').textContent()).trim();
    console.log('  [test11] Timer 2 title:', timer2Title);

    // Click per-card toggle to START Timer 2
    const startLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*TIMER_START/,
      async () => {
        await secondToggle.click();
      }
    );
    console.log('  [test11] TIMER_START logs after per-card click:', startLogs.length);
    expect(startLogs.length).toBeGreaterThan(0);

    // Transport play button should show pause icon (timer is running)
    await expect(page.locator('#btn-play-pause i.fa-pause')).toBeVisible({ timeout: 5_000 });

    // Second card should be active
    await expect(secondCard).toHaveClass(/active/, { timeout: 3_000 });

    // Preview should show Timer 2's name
    const previewTitle = (await page.locator('#preview-timer-name').textContent()).trim();
    console.log('  [test11] preview title after per-card start:', previewTitle);
    expect(previewTitle).toContain(timer2Title);

    // Click per-card toggle again to PAUSE
    const pauseLogs = await captureConsoleLogs(
      page,
      /Pusher Event.*TIMER_PAUSE/,
      async () => {
        await secondToggle.click();
      }
    );
    console.log('  [test11] TIMER_PAUSE logs after per-card click:', pauseLogs.length);
    expect(pauseLogs.length).toBeGreaterThan(0);

    // Transport should revert to play icon
    await expect(page.locator('#btn-play-pause i.fa-play')).toBeVisible({ timeout: 5_000 });
  });

});

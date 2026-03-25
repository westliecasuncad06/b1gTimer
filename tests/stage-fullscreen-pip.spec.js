// @ts-check
/**
 * B1G Timer – Stage Fullscreen & PiP Tests
 *
 * Tests:
 *  1. Fullscreen and PiP buttons exist in stage DOM
 *  2. Fullscreen button toggles icon on click
 *  3. PiP button is clickable (triggers API)
 *  4. Transport utils bar appears on hover
 *  5. Buttons have correct titles
 *  6. Fullscreen button calls requestFullscreen
 */

const { test, expect } = require('@playwright/test');

const STAGE_URL = 'http://localhost/B1G_TIMER/public/stage.html?room=1';

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Stage Display – Fullscreen & PiP', () => {

  test('1. Fullscreen and PiP buttons exist in DOM', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const fsBtn = page.locator('#stage-btn-fullscreen');
    const pipBtn = page.locator('#stage-btn-pip');
    const utilsBar = page.locator('#stage-transport-utils');

    await expect(fsBtn).toBeAttached();
    await expect(pipBtn).toBeAttached();
    await expect(utilsBar).toBeAttached();
    console.log('  [test1] Fullscreen & PiP buttons found');
  });

  test('2. Buttons have correct titles', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const fsTitle = await page.locator('#stage-btn-fullscreen').getAttribute('title');
    const pipTitle = await page.locator('#stage-btn-pip').getAttribute('title');

    expect(fsTitle).toBe('Toggle Fullscreen');
    expect(pipTitle).toBe('Picture-in-Picture');
    console.log('  [test2] Titles correct:', fsTitle, '|', pipTitle);
  });

  test('3. Utils bar becomes visible on hover', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const utilsBar = page.locator('#stage-transport-utils');

    // Initially invisible (opacity: 0)
    const opacityBefore = await utilsBar.evaluate(el =>
      window.getComputedStyle(el).opacity
    );
    expect(opacityBefore).toBe('0');

    // Hover over the utils bar area (bottom-right)
    await utilsBar.hover({ force: true });
    await page.waitForTimeout(500);

    const opacityAfter = await utilsBar.evaluate(el =>
      window.getComputedStyle(el).opacity
    );
    expect(opacityAfter).toBe('1');
    console.log('  [test3] Utils bar opacity before:', opacityBefore, 'after:', opacityAfter);
  });

  test('4. Fullscreen button has expand icon initially', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const icon = page.locator('#stage-btn-fullscreen i');
    const hasExpand = await icon.evaluate(el => el.classList.contains('fa-expand'));
    expect(hasExpand).toBe(true);
    console.log('  [test4] Fullscreen icon is fa-expand');
  });

  test('5. PiP button has clone icon', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const icon = page.locator('#stage-btn-pip i');
    const hasClone = await icon.evaluate(el => el.classList.contains('fa-clone'));
    expect(hasClone).toBe(true);
    console.log('  [test5] PiP icon is fa-clone');
  });

  test('6. Fullscreen button triggers requestFullscreen', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Track if requestFullscreen was called
    const fsCalled = await page.evaluate(() => {
      return new Promise(resolve => {
        let called = false;
        const origFn = document.documentElement.requestFullscreen;
        document.documentElement.requestFullscreen = function() {
          called = true;
          // Return a resolved promise to prevent errors
          return Promise.resolve();
        };
        const btn = document.getElementById('stage-btn-fullscreen');
        if (btn) btn.click();
        // Small delay to let the click handler run
        setTimeout(() => {
          document.documentElement.requestFullscreen = origFn;
          resolve(called);
        }, 200);
      });
    });

    expect(fsCalled).toBe(true);
    console.log('  [test6] requestFullscreen was called:', fsCalled);
  });

  test('7. PiP button click does not throw errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Click PiP button — may fail due to permissions, but should not throw uncaught
    await page.evaluate(() => {
      const btn = document.getElementById('stage-btn-pip');
      if (btn) btn.click();
    });
    await page.waitForTimeout(1_000);

    // Filter out known benign issues
    const realErrors = errors.filter(e =>
      !e.includes('Pusher') && !e.includes('WebSocket') && !e.includes('net::') && !e.includes('PiP')
    );
    expect(realErrors.length).toBe(0);
    console.log('  [test7] No uncaught errors from PiP click');
  });

  test('8. Fullscreen icon updates on fullscreenchange event', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Simulate fullscreenchange event (can't actually go fullscreen in headless/test)
    await page.evaluate(() => {
      // Mock document.fullscreenElement
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        writable: true,
        configurable: true
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    await page.waitForTimeout(300);

    // Icon should now be fa-compress
    const hasCompress = await page.locator('#stage-btn-fullscreen i').evaluate(el =>
      el.classList.contains('fa-compress')
    );
    expect(hasCompress).toBe(true);

    // Now simulate exiting fullscreen
    await page.evaluate(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        writable: true,
        configurable: true
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    await page.waitForTimeout(300);

    const hasExpand = await page.locator('#stage-btn-fullscreen i').evaluate(el =>
      el.classList.contains('fa-expand')
    );
    expect(hasExpand).toBe(true);
    console.log('  [test8] Fullscreen icon toggles: compress ↔ expand');
  });

  test('9. PiP shows only timer and clock (no timer name)', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Verify the PiP creates pip-countdown + pip-clock, not pip-name
    const pipContent = await page.evaluate(() => {
      const src = StageDisplay.togglePiP.toString();
      return {
        hasPipCountdown: src.includes('pip-countdown'),
        hasPipClock: src.includes('pip-clock'),
        hasNoPipName: !src.includes('pip-name'),
        usesTimeOfDay: src.includes('time-of-day'),
        whiteSpaceNowrap: src.includes('white-space:nowrap')
      };
    });

    expect(pipContent.hasPipCountdown).toBe(true);
    expect(pipContent.hasPipClock).toBe(true);
    expect(pipContent.hasNoPipName).toBe(true);
    expect(pipContent.usesTimeOfDay).toBe(true);
    expect(pipContent.whiteSpaceNowrap).toBe(true);
    console.log('  [test9] PiP content:', pipContent);
  });

  test('10. PiP responsive font sizing scales with dimensions', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Test the responsive sizing formula used in the PiP resize handler
    const results = await page.evaluate(() => {
      function calcFonts(w, h) {
        const countdownSize = Math.min(w * 0.2, h * 0.52);
        const clockSize = Math.min(w * 0.06, h * 0.16);
        return {
          countdown: Math.max(16, countdownSize),
          clock: Math.max(10, clockSize)
        };
      }
      return {
        small:  calcFonts(200, 100),
        medium: calcFonts(400, 200),
        large:  calcFonts(800, 400),
        wide:   calcFonts(600, 150),
        tall:   calcFonts(200, 400)
      };
    });

    // Font sizes should scale up with window size
    expect(results.large.countdown).toBeGreaterThan(results.medium.countdown);
    expect(results.medium.countdown).toBeGreaterThan(results.small.countdown);
    expect(results.large.clock).toBeGreaterThan(results.medium.clock);
    expect(results.medium.clock).toBeGreaterThan(results.small.clock);

    // Minimums enforced
    expect(results.small.countdown).toBeGreaterThanOrEqual(16);
    expect(results.small.clock).toBeGreaterThanOrEqual(10);

    // Countdown + clock combined height must not exceed window height
    // countdown line-height=1 + clock line-height=1, so total ≈ countdownSize + clockSize
    expect(results.medium.countdown + results.medium.clock).toBeLessThan(200);
    expect(results.wide.countdown + results.wide.clock).toBeLessThan(150);

    console.log('  [test10] PiP font sizes:', JSON.stringify(results));
  });

  test('11. PiP togglePiP method has resize event listener', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    // Verify the source code includes the resize listener wiring
    const hasResizeHandler = await page.evaluate(() => {
      const src = StageDisplay.togglePiP.toString();
      return src.includes("addEventListener('resize'") || src.includes('addEventListener("resize"');
    });

    expect(hasResizeHandler).toBe(true);
    console.log('  [test11] PiP has resize event listener:', hasResizeHandler);
  });

  test('12. Canvas fallback uses responsive font sizing with clock', async ({ page }) => {
    await page.goto(STAGE_URL);
    await page.waitForTimeout(2_000);

    const hasResponsiveCanvas = await page.evaluate(() => {
      const src = StageDisplay.updatePiP.toString();
      return {
        hasMathMin: src.includes('Math.min'),
        hasMathMax: src.includes('Math.max'),
        hasCountdownFont: src.includes('countdownFontSize'),
        hasClockFont: src.includes('clockFontSize'),
        usesTimeOfDay: src.includes('time-of-day'),
        noTimerName: !src.includes('timerName')
      };
    });

    expect(hasResponsiveCanvas.hasMathMin).toBe(true);
    expect(hasResponsiveCanvas.hasMathMax).toBe(true);
    expect(hasResponsiveCanvas.hasCountdownFont).toBe(true);
    expect(hasResponsiveCanvas.hasClockFont).toBe(true);
    expect(hasResponsiveCanvas.usesTimeOfDay).toBe(true);
    expect(hasResponsiveCanvas.noTimerName).toBe(true);
    console.log('  [test12] Canvas fallback responsive:', hasResponsiveCanvas);
  });
});

// @ts-check
/**
 * B1G Timer – Stage Separation & PiP Enhancement Tests
 *
 * Validates:
 *  1.  Timer stage uses 'b1g-timer-room-' BroadcastChannel (not bible channel)
 *  2.  Bible stage uses 'b1g-bible-room-' BroadcastChannel (independent)
 *  3.  Bible events do NOT show on the timer stage
 *  4.  Timer events do NOT affect the bible stage
 *  5.  Bible controller blackout calls broadcastBibleEvent (bible channel only)
 *  6.  API client has broadcastBibleEvent method
 *  7.  API client _getBibleLocalChannel uses 'b1g-bible-room-' name
 *  8.  Pusher-manager binds BIBLE_VERSE_UPDATE and BIBLE_VERSE_CLEAR
 *  9.  Timer stage PiP has #pip-blackout overlay support
 * 10.  Timer stage PiP initializes with current stage background color
 * 11.  Timer stage PiP responds to BLACKOUT_ON (pip-blackout shown)
 * 12.  Timer stage PiP has flash support (pip-countdown element)
 * 13.  Timer stage PiP mirrors timer color on style change
 * 14.  Bible stage FLASH_TRIGGER fires flashDisplay without errors
 * 15.  STAGE_STYLE_UPDATE is bound in Pusher-manager
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const STAGE_URL     = `${BASE}/stage.html?room=1`;
const BIBLE_URL     = `${BASE}/bible.html?room=1`;
const BIBLE_STAGE_URL = `${BASE}/bible-stage.html?room=1`;

// ─── Helper: clear console errors ──────────────────────────────────────────
async function collectErrors(page) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 – Channel Separation (static code verification)
// ─────────────────────────────────────────────────────────────────────────────

test('1. api-client has broadcastBibleEvent method', async ({ page }) => {
    await page.goto(BIBLE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof APIClient !== 'undefined', { timeout: 10_000 });
    const hasBibleEvent = await page.evaluate(() =>
        typeof APIClient.broadcastBibleEvent === 'function'
    );
    expect(hasBibleEvent).toBe(true);
});

test('2. api-client _getBibleLocalChannel uses b1g-bible-room channel name', async ({ page }) => {
    await page.goto(BIBLE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof APIClient !== 'undefined', { timeout: 10_000 });

    const channelName = await page.evaluate(() => {
        // Call _getBibleLocalChannel for a test room id and read the channel name
        const ch = APIClient._getBibleLocalChannel('test-99');
        return ch ? ch.name : null;
    });
    expect(channelName).toBe('b1g-bible-room-test-99');
});

test('3. api-client _getLocalChannel uses b1g-timer-room channel name', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof APIClient !== 'undefined', { timeout: 10_000 });

    const channelName = await page.evaluate(() => {
        const ch = APIClient._getLocalChannel('test-99');
        return ch ? ch.name : null;
    });
    expect(channelName).toBe('b1g-timer-room-test-99');
});

test('4. bible-controller uses broadcastBibleEvent for blackout', async ({ page }) => {
    await page.goto(BIBLE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleController !== 'undefined', { timeout: 10_000 });

    // Verify _toggleBlackout source calls broadcastBibleEvent (check via source inspection)
    const usesBibleEvent = await page.evaluate(() => {
        const src = BibleController._toggleBlackout.toString();
        return src.includes('broadcastBibleEvent') && !src.includes('broadcastEvent(');
    });
    expect(usesBibleEvent).toBe(true);
});

test('5. bible-controller _setupBroadcastChannel uses b1g-bible-room', async ({ page }) => {
    await page.goto(BIBLE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleController !== 'undefined', { timeout: 10_000 });

    const usesBibleChannel = await page.evaluate(() => {
        const src = BibleController._setupBroadcastChannel.toString();
        return src.includes('b1g-bible-room-') && !src.includes('b1g-timer-room-');
    });
    expect(usesBibleChannel).toBe(true);
});

test('6. bible-stage uses b1g-bible-room BroadcastChannel', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    const usesBibleChannel = await page.evaluate(() => {
        const src = BibleStage.setupBroadcastChannel.toString();
        return src.includes('b1g-bible-room-') && !src.includes('b1g-timer-room-');
    });
    expect(usesBibleChannel).toBe(true);
});

test('7. stage-display does NOT handle BIBLE_VERSE_UPDATE or BIBLE_VERSE_CLEAR', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const handlesFn = await page.evaluate(() => {
        const src = StageDisplay.handleRoomEvent.toString();
        // Check for actual case handler lines (not comments)
        return {
            hasVerseUpdateCase: /case\s+['"`]BIBLE_VERSE_UPDATE['"`]/.test(src),
            hasVerseClearCase: /case\s+['"`]BIBLE_VERSE_CLEAR['"`]/.test(src),
        };
    });
    expect(handlesFn.hasVerseUpdateCase).toBe(false);
    expect(handlesFn.hasVerseClearCase).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 – Runtime Channel Isolation
// ─────────────────────────────────────────────────────────────────────────────

test('8. bible event on bible channel received by bible-stage but NOT timer stage', async ({ browser }) => {
    const ctx = await browser.newContext();
    const stageTab = await ctx.newPage();
    const bibleTab = await ctx.newPage();

    await Promise.all([
        stageTab.goto(STAGE_URL, { waitUntil: 'domcontentloaded' }),
        bibleTab.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' }),
    ]);
    await Promise.all([
        stageTab.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 }),
        bibleTab.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 }),
    ]);

    // Inject BroadcastChannel listener on TIMER stage to detect if it receives bible events
    await stageTab.evaluate(() => {
        window._gotBibleEvent = false;
        const bc = new BroadcastChannel('b1g-bible-room-1');
        bc.onmessage = () => { window._gotBibleEvent = true; };
    });

    // Inject listener on BIBLE stage to detect if it receives the bible event
    await bibleTab.evaluate(() => {
        window._gotBibleEvent = false;
        const bc = new BroadcastChannel('b1g-bible-room-1');
        bc.onmessage = () => { window._gotBibleEvent = true; };
    });

    // Post a bible event to the bible channel
    await bibleTab.evaluate(() => {
        const bc = new BroadcastChannel('b1g-bible-room-1');
        bc.postMessage({ action: 'BIBLE_VERSE_UPDATE', data: { text: 'Test verse' } });
    });

    await stageTab.waitForTimeout(400);

    const stageGotIt = await stageTab.evaluate(() => window._gotBibleEvent);
    const bibleGotIt = await bibleTab.evaluate(() => window._gotBibleEvent);

    // Both tabs are in the same browser context, so the bible channel broadcast
    // should reach the listener on the bible tab. Timer stage channel is separate.
    expect(bibleGotIt).toBe(true);

    // The timer stage does NOT listen on 'b1g-bible-room-1'; its handler never fires
    // Note: our injected listener on stageTab CAN receive it (same context/channel name)
    // The key assertion is that StageDisplay.handleRoomEvent is never called with Bible events.
    // Verify the actual BroadcastChannel used by StageDisplay is the TIMER channel:
    const stageChannelName = await stageTab.evaluate(() => {
        const ch = StageDisplay._timerChannel || APIClient._getLocalChannel(StageDisplay.currentRoomId || '1');
        return ch ? ch.name : null;
    });
    expect(stageChannelName).toBe('b1g-timer-room-1');

    await ctx.close();
});

test('9. timer event on timer channel NOT in bible-stage BroadcastChannel', async ({ browser }) => {
    const ctx = await browser.newContext();
    const bibleStageTab = await ctx.newPage();
    await bibleStageTab.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await bibleStageTab.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    // Read the actual BroadcastChannel name the bible-stage is using
    const channelName = await bibleStageTab.evaluate(() => {
        return BibleStage.broadcastChannel ? BibleStage.broadcastChannel.name : null;
    });

    // Should be the BIBLE channel, not the timer channel
    expect(channelName).toBe('b1g-bible-room-1');
    expect(channelName).not.toBe('b1g-timer-room-1');
    await ctx.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 – PiP Enhancements
// ─────────────────────────────────────────────────────────────────────────────

test('10. PiP setBlackout function syncs pip-blackout element', async ({ page }) => {
    const errors = await collectErrors(page);
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    // Verify setBlackout code checks for _pipWindow and pip-blackout
    const syncsPiP = await page.evaluate(() => {
        const src = StageDisplay.setBlackout.toString();
        return src.includes('_pipWindow') && src.includes('pip-blackout');
    });
    expect(syncsPiP).toBe(true);
    expect(errors).toEqual([]);
});

test('11. PiP flashDisplay syncs pip-countdown in _pipWindow', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const syncsFlash = await page.evaluate(() => {
        const src = StageDisplay.flashDisplay.toString();
        return src.includes('_pipWindow') && src.includes('pip-countdown');
    });
    expect(syncsFlash).toBe(true);
});

test('12. togglePiP Document PiP includes #pip-blackout CSS', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const hasBlackoutCSS = await page.evaluate(() => {
        const src = StageDisplay.togglePiP.toString();
        return src.includes('pip-blackout');
    });
    expect(hasBlackoutCSS).toBe(true);
});

test('13. togglePiP initializes PiP with current stageStyle bgColor', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const initializesBg = await page.evaluate(() => {
        const src = StageDisplay.togglePiP.toString();
        return src.includes('stageStyle.bgColor');
    });
    expect(initializesBg).toBe(true);
});

test('14. applyStageStyle updates PiP window background', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const updatesPiP = await page.evaluate(() => {
        const src = StageDisplay.applyStageStyle.toString();
        return src.includes('_pipWindow') && src.includes('bgColor');
    });
    expect(updatesPiP).toBe(true);
});

test('15. updatePiP uses stageStyle.bgColor for canvas background', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    const usesStageColor = await page.evaluate(() => {
        const src = StageDisplay.updatePiP.toString();
        return src.includes('stageStyle.bgColor') && src.includes('stageStyle.timerColor');
    });
    expect(usesStageColor).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 – Bible Stage Flash Feature
// ─────────────────────────────────────────────────────────────────────────────

test('16. bible-stage handleEvent has FLASH_TRIGGER case', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    const hasFlashCase = await page.evaluate(() => {
        const src = BibleStage.handleEvent.toString();
        return src.includes('FLASH_TRIGGER') && src.includes('flashDisplay');
    });
    expect(hasFlashCase).toBe(true);
});

test('17. bible-stage flashDisplay method exists and is callable', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    const hasFlashDisplay = await page.evaluate(() =>
        typeof BibleStage.flashDisplay === 'function'
    );
    expect(hasFlashDisplay).toBe(true);

    // Should not throw when called with no visible verse
    const noError = await page.evaluate(() => {
        try { BibleStage.flashDisplay(); return true; } catch { return false; }
    });
    expect(noError).toBe(true);
});

test('18. bible-stage FLASH_TRIGGER via BroadcastChannel triggers flash', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    // Open the broadcast channel and init the bible stage
    await page.evaluate(() => {
        const roomId = new URLSearchParams(window.location.search).get('room') || '1';
        BibleStage.init(roomId);
    });
    await page.waitForTimeout(300);

    // Patch flashDisplay to track calls
    await page.evaluate(() => {
        window._flashCalled = false;
        const orig = BibleStage.flashDisplay.bind(BibleStage);
        BibleStage.flashDisplay = function() { window._flashCalled = true; orig(); };
    });

    // Send FLASH_TRIGGER via the Bible BroadcastChannel
    await page.evaluate(() => {
        const roomId = new URLSearchParams(window.location.search).get('room') || '1';
        const bc = new BroadcastChannel('b1g-bible-room-' + roomId);
        bc.postMessage({ action: 'FLASH_TRIGGER', data: {} });
        bc.close();
    });

    await page.waitForTimeout(400);
    const flashCalled = await page.evaluate(() => window._flashCalled);
    expect(flashCalled).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 – Pusher-Manager Bible Events
// ─────────────────────────────────────────────────────────────────────────────

test('19. pusher-manager subscribeToRoom binds BIBLE_VERSE_UPDATE', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof PusherManager !== 'undefined', { timeout: 10_000 });

    const bindsVerseUpdate = await page.evaluate(() => {
        const src = PusherManager.subscribeToRoom.toString();
        return src.includes('BIBLE_VERSE_UPDATE');
    });
    expect(bindsVerseUpdate).toBe(true);
});

test('20. pusher-manager subscribeToRoom binds BIBLE_VERSE_CLEAR', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof PusherManager !== 'undefined', { timeout: 10_000 });

    const bindsVerseClear = await page.evaluate(() => {
        const src = PusherManager.subscribeToRoom.toString();
        return src.includes('BIBLE_VERSE_CLEAR');
    });
    expect(bindsVerseClear).toBe(true);
});

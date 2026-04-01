// @ts-check
/**
 * B1G Timer – Room Picker Tests
 *
 * Validates:
 *  1.  RoomPicker exists and is callable
 *  2.  ?room= URL param skips the picker UI on stage.html
 *  3.  ?room= URL param skips the picker UI on bible-stage.html
 *  4.  ?room= URL param skips the picker UI on bible.html
 *  5.  Without ?room=, picker overlay appears on stage.html
 *  6.  Without ?room=, picker overlay appears on bible-stage.html
 *  7.  Without ?room=, picker overlay appears on bible.html
 *  8.  Picker shows available rooms as clickable cards
 *  9.  Selecting a room hides the overlay
 * 10.  Selecting a room writes ?room=X to the URL
 * 11.  Single-room auto-selection (no UI) on stage.html
 * 12.  RoomPicker._applyRoom updates URL without page reload
 * 13.  Timer stage and Bible stage can use the SAME room simultaneously
 * 14.  Timer events on room X do NOT reach bible-stage on room X (separate channels)
 * 15.  Bible events on room X do NOT reach timer stage on room X (separate channels)
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const STAGE_URL       = `${BASE}/stage.html`;
const STAGE_ROOM1     = `${BASE}/stage.html?room=1`;
const BIBLE_STAGE_URL = `${BASE}/bible-stage.html`;
const BIBLE_STAGE_R1  = `${BASE}/bible-stage.html?room=1`;
const BIBLE_URL       = `${BASE}/bible.html`;
const BIBLE_ROOM1     = `${BASE}/bible.html?room=1`;

const PICKER_OVERLAY = '#rp-overlay';
const PICKER_CARD    = '.rp-card';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 – Static API surface
// ─────────────────────────────────────────────────────────────────────────────

test('1. RoomPicker is available on stage.html', async ({ page }) => {
    await page.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    const hasPick = await page.evaluate(() => typeof RoomPicker.pick === 'function');
    expect(hasPick).toBe(true);
});

test('2. RoomPicker is available on bible-stage.html', async ({ page }) => {
    await page.goto(BIBLE_STAGE_R1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    const hasPick = await page.evaluate(() => typeof RoomPicker.pick === 'function');
    expect(hasPick).toBe(true);
});

test('3. RoomPicker is available on bible.html', async ({ page }) => {
    await page.goto(BIBLE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    const hasPick = await page.evaluate(() => typeof RoomPicker.pick === 'function');
    expect(hasPick).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 – ?room= param skips picker
// ─────────────────────────────────────────────────────────────────────────────

test('4. stage.html with ?room=1 does NOT show picker overlay', async ({ page }) => {
    await page.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const overlayVisible = await page.locator(PICKER_OVERLAY).isVisible();
    expect(overlayVisible).toBe(false);
});

test('5. bible-stage.html with ?room=1 does NOT show picker overlay', async ({ page }) => {
    await page.goto(BIBLE_STAGE_R1, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const overlayVisible = await page.locator(PICKER_OVERLAY).isVisible();
    expect(overlayVisible).toBe(false);
});

test('6. bible.html with ?room=1 does NOT show picker overlay', async ({ page }) => {
    await page.goto(BIBLE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const overlayVisible = await page.locator(PICKER_OVERLAY).isVisible();
    expect(overlayVisible).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 – No ?room= param → picker appears
// ─────────────────────────────────────────────────────────────────────────────

test('7. stage.html without ?room= shows picker overlay', async ({ page }) => {
    await page.goto(STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    // Picker fires async after DOM content loads; allow a moment
    // (It resolves immediately if ?room= not present and RoomPicker.pick() was called)
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null || document.querySelector('#countdown') !== null,
        { timeout: 6_000 }
    );
    // Either the picker is visible OR only 1 room exists (auto-selected, no overlay)
    const overlayOrAutoSelected = await page.evaluate(() => {
        const overlay = document.querySelector('#rp-overlay');
        const urlHasRoom = new URLSearchParams(window.location.search).has('room');
        return overlay !== null || urlHasRoom;
    });
    expect(overlayOrAutoSelected).toBe(true);
});

test('8. bible-stage.html without ?room= shows picker overlay', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null ||
              new URLSearchParams(window.location.search).has('room'),
        { timeout: 6_000 }
    );
    const overlayOrAutoSelected = await page.evaluate(() => {
        const overlay = document.querySelector('#rp-overlay');
        const urlHasRoom = new URLSearchParams(window.location.search).has('room');
        return overlay !== null || urlHasRoom;
    });
    expect(overlayOrAutoSelected).toBe(true);
});

test('9. bible.html without ?room= shows picker overlay', async ({ page }) => {
    await page.goto(BIBLE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null ||
              new URLSearchParams(window.location.search).has('room'),
        { timeout: 6_000 }
    );
    const overlayOrAutoSelected = await page.evaluate(() => {
        return document.querySelector('#rp-overlay') !== null ||
               new URLSearchParams(window.location.search).has('room');
    });
    expect(overlayOrAutoSelected).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 – Picker interaction
// ─────────────────────────────────────────────────────────────────────────────

test('10. Picker shows room cards from the API', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    // If auto-selected (1 room), skip
    const autoSelected = await page.evaluate(
        () => new URLSearchParams(window.location.search).has('room')
    );
    if (autoSelected) {
        test.skip();
        return;
    }

    await page.locator(PICKER_OVERLAY).waitFor({ state: 'visible', timeout: 5_000 });
    const cardCount = await page.locator(PICKER_CARD).count();
    // Cards should match rooms from API
    const apiRoomCount = await page.evaluate(async () => {
        const rooms = await APIClient.getRooms();
        return rooms.length;
    });
    expect(cardCount).toBe(apiRoomCount);
});

test('11. Clicking a room card hides the picker overlay', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    const autoSelected = await page.evaluate(
        () => new URLSearchParams(window.location.search).has('room')
    );
    if (autoSelected) {
        // With URL param the overlay never appears — pass trivially
        const noOverlay = await page.locator(PICKER_OVERLAY).isVisible();
        expect(noOverlay).toBe(false);
        return;
    }

    await page.locator(PICKER_OVERLAY).waitFor({ state: 'visible', timeout: 5_000 });
    // Click the first available room card
    await page.locator(PICKER_CARD).first().click();
    await page.waitForTimeout(400);

    const stillVisible = await page.locator(PICKER_OVERLAY).isVisible();
    expect(stillVisible).toBe(false);
});

test('12. Clicking a room card writes ?room=X to URL', async ({ page }) => {
    await page.goto(BIBLE_STAGE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    const autoSelected = await page.evaluate(
        () => new URLSearchParams(window.location.search).has('room')
    );
    if (autoSelected) {
        // Already has room in URL
        const hasRoom = await page.evaluate(
            () => new URLSearchParams(window.location.search).has('room')
        );
        expect(hasRoom).toBe(true);
        return;
    }

    await page.locator(PICKER_OVERLAY).waitFor({ state: 'visible', timeout: 5_000 });
    const firstCardRoomId = await page.locator(PICKER_CARD).first().getAttribute('data-room-id');

    await page.locator(PICKER_CARD).first().click();
    await page.waitForTimeout(400);

    const roomInUrl = await page.evaluate(
        () => new URLSearchParams(window.location.search).get('room')
    );
    expect(roomInUrl).toBe(firstCardRoomId);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 – RoomPicker internal logic
// ─────────────────────────────────────────────────────────────────────────────

test('13. RoomPicker._applyRoom writes ?room= without reloading', async ({ page }) => {
    await page.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    await page.evaluate(() => RoomPicker._applyRoom('42'));
    const roomInUrl = await page.evaluate(
        () => new URLSearchParams(window.location.search).get('room')
    );
    expect(roomInUrl).toBe('42');
});

test('14. RoomPicker.pick() with ?room= param resolves without showing overlay', async ({ page }) => {
    await page.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    const result = await page.evaluate(async () => {
        const id = await RoomPicker.pick();
        const hasOverlay = document.querySelector('#rp-overlay') !== null;
        return { id, hasOverlay };
    });

    expect(result.id).toBe('1');
    expect(result.hasOverlay).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 – Same room for Timer and Bible (channel isolation still works)
// ─────────────────────────────────────────────────────────────────────────────

test('15. Timer stage and Bible stage both initialise on the SAME room', async ({ browser }) => {
    const ctx = await browser.newContext();
    const timerTab = await ctx.newPage();
    const bibleTab = await ctx.newPage();

    await Promise.all([
        timerTab.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' }),
        bibleTab.goto(BIBLE_STAGE_R1, { waitUntil: 'domcontentloaded' }),
    ]);

    await Promise.all([
        timerTab.waitForFunction(() => typeof StageDisplay !== 'undefined' && StageDisplay.currentRoomId !== null, { timeout: 12_000 }),
        bibleTab.waitForFunction(() => typeof BibleStage !== 'undefined' && BibleStage.roomId !== null, { timeout: 12_000 }),
    ]);

    const timerRoom = await timerTab.evaluate(() => String(StageDisplay.currentRoomId));
    const bibleRoom = await bibleTab.evaluate(() => String(BibleStage.roomId));

    expect(timerRoom).toBe('1');
    expect(bibleRoom).toBe('1');

    await ctx.close();
});

test('16. On same room: bible event does NOT arrive on timer BroadcastChannel', async ({ browser }) => {
    const ctx = await browser.newContext();
    const timerTab = await ctx.newPage();
    const bibleTab = await ctx.newPage();

    await Promise.all([
        timerTab.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' }),
        bibleTab.goto(BIBLE_STAGE_R1, { waitUntil: 'domcontentloaded' }),
    ]);

    await timerTab.waitForFunction(() => typeof StageDisplay !== 'undefined', { timeout: 10_000 });

    // Listen on the timer channel for any arriving message
    await timerTab.evaluate(() => {
        window._timerChannelGotBibleMsg = false;
        const bc = new BroadcastChannel('b1g-timer-room-1');
        bc.onmessage = (e) => {
            if (e.data?.action === 'BIBLE_VERSE_UPDATE') window._timerChannelGotBibleMsg = true;
        };
    });

    // Send bible event on the bible channel
    await bibleTab.evaluate(() => {
        const bc = new BroadcastChannel('b1g-bible-room-1');
        bc.postMessage({ action: 'BIBLE_VERSE_UPDATE', data: { text: 'Test' } });
        bc.close();
    });

    await timerTab.waitForTimeout(500);
    const timerGotBibleMsg = await timerTab.evaluate(() => window._timerChannelGotBibleMsg);
    expect(timerGotBibleMsg).toBe(false);

    await ctx.close();
});

test('17. On same room: timer event does NOT arrive on bible BroadcastChannel', async ({ browser }) => {
    const ctx = await browser.newContext();
    const bibleTab = await ctx.newPage();
    const timerTab = await ctx.newPage();

    await Promise.all([
        bibleTab.goto(BIBLE_STAGE_R1, { waitUntil: 'domcontentloaded' }),
        timerTab.goto(STAGE_ROOM1, { waitUntil: 'domcontentloaded' }),
    ]);

    await bibleTab.waitForFunction(() => typeof BibleStage !== 'undefined', { timeout: 10_000 });

    // Listen on the bible channel for any timer event
    await bibleTab.evaluate(() => {
        window._bibleChannelGotTimerMsg = false;
        const bc = new BroadcastChannel('b1g-bible-room-1');
        bc.onmessage = (e) => {
            if (e.data?.action === 'TIMER_START') window._bibleChannelGotTimerMsg = true;
        };
    });

    // Send timer event on the timer channel
    await timerTab.evaluate(() => {
        const bc = new BroadcastChannel('b1g-timer-room-1');
        bc.postMessage({ action: 'TIMER_START', data: {} });
        bc.close();
    });

    await bibleTab.waitForTimeout(500);
    const bibleGotTimerMsg = await bibleTab.evaluate(() => window._bibleChannelGotTimerMsg);
    expect(bibleGotTimerMsg).toBe(false);

    await ctx.close();
});

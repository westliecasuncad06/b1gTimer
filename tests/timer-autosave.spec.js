// @ts-check
/**
 * B1G Timer – Timer Autosave Tests
 *
 * Validates that timers are automatically saved to the server (without
 * requiring the user to click the manual Save button) after each of
 * the following operations:
 *
 *  1.  Adding a new timer  → triggers autosave
 *  2.  Editing title inline → triggers autosave
 *  3.  Editing duration via popover → triggers autosave
 *  4.  Editing start-type via popover → triggers autosave
 *  5.  Editing settings modal → triggers autosave
 *  6.  Add-time buttons (+1m, -10s …) → trigger autosave
 *  7.  Drag-to-reorder → triggers autosave
 *  8.  autoSaveTimers is debounced (rapid calls coalesce)
 *  9.  _performAutoSave syncs server IDs back into client state
 * 10.  Autosave indicator shows "Saving…" then "✓ Autosaved"
 * 11.  Manual Save button still works independently
 * 12.  autoSaveTimers does nothing when no room is selected
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASH_URL = `${BASE}/index.html`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait until a room is loaded and at least one timer card is visible */
async function ensureRoomLoaded(page) {
    await page.waitForFunction(
        () => typeof ControlDashboard !== 'undefined' && typeof RoomManager !== 'undefined',
        { timeout: 12_000 }
    );

    // Wait for populateRoomSelector() to finish filling the hidden <select>
    await page.waitForFunction(() => {
        const sel = document.getElementById('room-selector');
        return sel && [...sel.options].some(o => o.value && o.value !== '');
    }, { timeout: 10_000 });

    // Dismiss the auto-open picker overlay so it doesn't intercept test clicks
    const overlayVisible = await page.locator('#rp-overlay').isVisible();
    if (overlayVisible) {
        const hasCard = await page.locator('.rp-card').count();
        if (hasCard > 0) {
            await page.locator('.rp-card').first().click();
            await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 3_000 });
        }
    }

    // Use evaluate to bypass visibility check — #room-selector is visually hidden but in DOM
    const current = await page.evaluate(() => document.getElementById('room-selector')?.value || '');
    if (!current) {
        // Pick the first available room via JS (avoids selectOption visibility requirement)
        const firstValue = await page.evaluate(() => {
            const sel = document.getElementById('room-selector');
            for (const opt of (sel?.options ?? [])) {
                if (opt.value && opt.value !== '') return opt.value;
            }
            return null;
        });
        if (firstValue) {
            await page.evaluate((roomId) => {
                const sel = document.getElementById('room-selector');
                if (sel && sel.value !== roomId) {
                    sel.value = roomId;
                    sel.dispatchEvent(new Event('change'));
                }
            }, firstValue);
            await page.waitForTimeout(1_000);
        }
    }
}

/** Count timer cards in the list */
async function timerCount(page) {
    return page.locator('.timer-card').count();
}

/** Intercept the PUT /rooms/{id} API call and capture it */
async function waitForSaveRequest(page, fn) {
    let captured = null;
    const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/v1/rooms/') && resp.request().method() === 'PUT',
        { timeout: 5_000 }
    );
    await fn();
    captured = await responsePromise;
    return captured;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 – Static API surface
// ─────────────────────────────────────────────────────────────────────────────

test('1. autoSaveTimers method exists on ControlDashboard', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const exists = await page.evaluate(() => typeof ControlDashboard.autoSaveTimers === 'function');
    expect(exists).toBe(true);
});

test('2. _performAutoSave method exists on ControlDashboard', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const exists = await page.evaluate(() => typeof ControlDashboard._performAutoSave === 'function');
    expect(exists).toBe(true);
});

test('3. addTimer calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const callsAutoSave = await page.evaluate(() => {
        const src = ControlDashboard.addTimer.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

test('4. saveSettings calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const callsAutoSave = await page.evaluate(() => {
        const src = ControlDashboard.saveSettings.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

test('5. saveDurationPopover calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const callsAutoSave = await page.evaluate(() => {
        const src = ControlDashboard.saveDurationPopover.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

test('6. saveStartPopover calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const callsAutoSave = await page.evaluate(() => {
        const src = ControlDashboard.saveStartPopover.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

test('7. _adjustTimerDuration calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomManager !== 'undefined', { timeout: 10_000 });

    const callsAutoSave = await page.evaluate(() => {
        const src = RoomManager._adjustTimerDuration.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

test('8. sortable reorder callback calls autoSaveTimers', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomManager !== 'undefined', { timeout: 10_000 });

    // The SortableHandler callback is inside renderTimerList; check source
    const callsAutoSave = await page.evaluate(() => {
        const src = RoomManager.renderTimerList.toString();
        return src.includes('autoSaveTimers');
    });
    expect(callsAutoSave).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 – Debounce behaviour
// ─────────────────────────────────────────────────────────────────────────────

test('9. autoSaveTimers debounces rapid calls into one save', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const saveCount = await page.evaluate(async () => {
        let count = 0;
        const orig = ControlDashboard._performAutoSave.bind(ControlDashboard);
        ControlDashboard._performAutoSave = async function () { count++; await orig(); };

        // Call 5 times rapidly
        ControlDashboard.autoSaveTimers();
        ControlDashboard.autoSaveTimers();
        ControlDashboard.autoSaveTimers();
        ControlDashboard.autoSaveTimers();
        ControlDashboard.autoSaveTimers();

        // Wait long enough for the debounce to fire
        await new Promise(r => setTimeout(r, 1200));
        ControlDashboard._performAutoSave = orig; // restore
        return count;
    });
    // Should have fired exactly once
    expect(saveCount).toBe(1);
});

test('10. autoSaveTimers does nothing when no room selected', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ControlDashboard !== 'undefined', { timeout: 10_000 });

    const apiCalled = await page.evaluate(async () => {
        let called = false;
        const orig = APIClient.updateRoom.bind(APIClient);
        APIClient.updateRoom = async function (...args) { called = true; return orig(...args); };

        // Clear the selected room
        const prevRoom = StateManager.state.selectedRoomId;
        StateManager.state.selectedRoomId = null;

        ControlDashboard.autoSaveTimers();
        await new Promise(r => setTimeout(r, 1200));

        StateManager.state.selectedRoomId = prevRoom;
        APIClient.updateRoom = orig;
        return called;
    });
    expect(apiCalled).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 – UI indicator
// ─────────────────────────────────────────────────────────────────────────────

test('11. autosave-indicator element exists in the DOM', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    const indicator = page.locator('#autosave-indicator');
    await expect(indicator).toBeAttached();
});

test('12. autosave indicator shows "Saving…" while pending then "✓ Autosaved"', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    // Patch _performAutoSave to be slow (simulate network delay)
    await page.evaluate(() => {
        const orig = ControlDashboard._performAutoSave.bind(ControlDashboard);
        ControlDashboard._performAutoSave = async function () {
            await new Promise(r => setTimeout(r, 300));
            return orig();
        };
    });

    // Trigger autosave
    await page.evaluate(() => ControlDashboard.autoSaveTimers());

    // Indicator should say "Saving…" immediately (indicator has .visible class)
    const indicator = page.locator('#autosave-indicator');
    await expect(indicator).toHaveClass(/visible/, { timeout: 2_000 });
    await expect(indicator).toHaveText(/Saving/);

    // After the save resolves, should say "✓ Autosaved"
    await expect(indicator).toHaveText(/Autosaved/, { timeout: 3_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 – Live integration (real API calls)
// ─────────────────────────────────────────────────────────────────────────────

test('13. Adding a timer triggers a PUT /rooms/{id} API call', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    const before = await timerCount(page);

    const response = await waitForSaveRequest(page, async () => {
        // Click add timer
        await page.locator('#btn-add-timer').click();
        // The debounce fires after 800ms — total wait in waitForResponse is 5s
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    // Timer was added in UI
    const after = await timerCount(page);
    expect(after).toBe(before + 1);
});

test('14. Editing duration popover Save triggers a PUT save', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    // Make sure there is at least one timer
    const count = await timerCount(page);
    if (count === 0) {
        await page.locator('#btn-add-timer').click();
        await page.waitForTimeout(200);
        // Wait for re-render
        await page.locator('.timer-card').first().waitFor({ timeout: 5_000 });
    }

    const response = await waitForSaveRequest(page, async () => {
        // Click the duration cell on first card
        await page.locator('[data-dur-click="0"]').first().click();
        await page.waitForTimeout(200);

        // Change minutes to 7
        await page.locator('#pop-dur-m').fill('07');

        // Click Save in popover
        await page.locator('#pop-dur-save').click();
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
});

test('15. Add-time "+1m" button triggers a PUT save', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    const count = await timerCount(page);
    if (count === 0) {
        await page.locator('#btn-add-timer').click();
        await page.locator('.timer-card').first().waitFor({ timeout: 5_000 });
    }

    const response = await waitForSaveRequest(page, async () => {
        // Open add-time popup for first card
        await page.locator('[data-add-time-toggle="0"]').first().click();
        await page.waitForTimeout(150);

        // Click +1m
        await page.locator('[data-add-time="0"][data-delta="60"]').first().click();
    });

    expect(response.status()).toBe(200);
});

test('16. _performAutoSave syncs server IDs into client state', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    const synced = await page.evaluate(async () => {
        if (!StateManager.state.selectedRoomId) return null;
        // Simulate a new unsaved timer with id=null
        const origLen = StateManager.state.timers.length;
        StateManager.state.timers.push({
            id: null, title: 'AutoSave Test', duration_seconds: 300,
            position: origLen, speaker: '', notes: '',
            appearance: 'countdown', start_type: 'manual',
            wrap_yellow_m: 1, wrap_yellow_s: 0, wrap_red_m: 0, wrap_red_s: 15
        });

        await ControlDashboard._performAutoSave();

        const newTimer = StateManager.state.timers[origLen];
        // Remove test timer
        StateManager.state.timers.splice(origLen, 1);
        return newTimer ? newTimer.id : null;
    });

    // The server should have assigned a numeric id
    expect(synced).not.toBeNull();
    expect(typeof synced).toBe('number');
});

test('17. Manual Save button still shows "Timers saved" toast', async ({ page }) => {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded' });
    await ensureRoomLoaded(page);

    await page.locator('#btn-save').click();
    // Toast with "saved" text should appear
    const toast = page.locator('.toast').filter({ hasText: /saved/i });
    await expect(toast).toBeVisible({ timeout: 5_000 });
});

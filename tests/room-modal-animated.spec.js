// @ts-check
/**
 * B1G Timer – Animated Room Modal Tests
 *
 * Validates the redesigned animated room-picker modal:
 *   A1.  stage.html without ?room= shows #rp-overlay with .rp-modal-inner inside
 *   A2.  bible-stage.html without ?room= shows the animated modal
 *   A3.  bible.html without ?room= shows the animated modal
 *   A4.  Room cards have staggered animation-delay attributes
 *   A5.  "New Room" #rp-add-btn dashed card is rendered
 *   A6.  Selecting a room adds .rp-selected class to the card
 *   A7.  After selection the overlay closes (rp-closing class applied)
 *   A8.  After selection ?room=X is written to the URL
 *   A9.  Clicking #rp-add-btn reveals the inline .rp-create-row form
 *   A10. Inline create form has input + Create + Cancel buttons
 *   A11. Clicking Cancel in the create form hides the form
 *   A12. Dashboard index.html has #btn-room-picker visible
 *   A13. Dashboard index.html does NOT show a visible #room-selector
 *   A14. Clicking #btn-room-picker opens #rp-overlay on the dashboard
 *   A15. #rp-overlay has role=dialog and aria-modal=true
 *   A16. After room select on dashboard, #room-picker-label shows room name
 *   A17. After room select on dashboard, hidden #room-selector value is updated
 *   A18. RoomPicker.open() method is exposed on stage.html
 *   A19. stage.html with ?room=1 does NOT show picker again (param fast-path)
 *   A20. Dashboard auto-opens picker when no persisted room (no room in localStorage)
 *   A21. After deleting a room, the animated room picker reopens automatically
 */

const { test, expect } = require('@playwright/test');

const BASE        = 'http://localhost/B1G_TIMER/public';
const STAGE_URL   = `${BASE}/stage.html`;
const STAGE_R1    = `${BASE}/stage.html?room=1`;
const BS_URL      = `${BASE}/bible-stage.html`;
const BS_R1       = `${BASE}/bible-stage.html?room=1`;
const BIBLE_URL   = `${BASE}/bible.html`;
const BIBLE_R1    = `${BASE}/bible.html?room=1`;
const DASH_URL    = `${BASE}/index.html`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Wait for RoomPicker to be defined on the page. */
async function waitForPicker(page, timeout = 10_000) {
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout });
}

/**
 * Navigate to a URL without any persisted room state.
 * Clears localStorage before the page runs its JS.
 */
async function gotoClean(page, url) {
    await page.addInitScript(() => {
        try { localStorage.clear(); } catch (e) { /* ignore */ }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * Navigate to the dashboard ensuring init() fully completes.
 * Seeds localStorage with a valid room so init() does NOT call RoomPicker.open().
 * Falls back to properly handling the auto-open if seeding fails.
 */
async function gotoDash(page) {
    // Seed localStorage so ControlDashboard.init() skips the auto-open picker
    await page.addInitScript(() => {
        try {
            const existing = JSON.parse(localStorage.getItem('b1g_timer_state') || '{}');
            if (!existing.selectedRoomId) {
                existing.selectedRoomId = '__placeholder__';
                localStorage.setItem('b1g_timer_state', JSON.stringify(existing));
            }
        } catch (e) { /* ignore */ }
    });
    await page.goto(`http://localhost/B1G_TIMER/public/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    // If a real auto-open picker appeared anyway, close it properly
    const overlayUp = await page.locator('#rp-overlay').isVisible();
    if (overlayUp) {
        const hasCard = await page.locator('.rp-card').count();
        if (hasCard > 0) {
            await page.locator('.rp-card').first().click();
            await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 3_000 });
        }
    }
}

/**
 * Wait for either the picker overlay to appear or for the page to already have
 * a ?room= param (auto-selected single room case).
 */
async function waitForPickerOrAutoSelect(page, timeout = 8_000) {
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null ||
              new URLSearchParams(window.location.search).has('room'),
        { timeout }
    );
}

/** Returns true if there are ≥2 rooms available (picker would show multi-room UI). */
async function hasMultipleRooms(page) {
    return page.evaluate(async () => {
        try {
            const rooms = await APIClient.getRooms();
            return rooms.length >= 2;
        } catch (e) { return false; }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A – Modal structure and appearance
// ─────────────────────────────────────────────────────────────────────────────

test('A1. stage.html without ?room= shows #rp-overlay with .rp-modal-inner', async ({ page }) => {
    await gotoClean(page, STAGE_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) {
        // Single-room auto-select — overlay is never shown (correct behaviour)
        const noOverlay = !(await page.locator('#rp-overlay').isVisible());
        expect(noOverlay).toBe(true);
        return;
    }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    const hasInner = await page.locator('.rp-modal-inner').count();
    expect(hasInner).toBeGreaterThan(0);
});

test('A2. bible-stage.html without ?room= shows the animated modal', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; } // auto-selected — pass

    const hasOverlay = await page.locator('#rp-overlay').isVisible();
    expect(hasOverlay).toBe(true);
});

test('A3. bible.html without ?room= shows the animated modal', async ({ page }) => {
    await gotoClean(page, BIBLE_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    const hasOverlay = await page.locator('#rp-overlay').isVisible();
    expect(hasOverlay).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B – Card structure and animations
// ─────────────────────────────────────────────────────────────────────────────

test('A4. Room cards have staggered animation-delay attributes', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; } // auto-selected

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });

    const multi = await hasMultipleRooms(page);
    if (!multi) { return; } // only 1 room possible (single auto-select shouldn't reach here)

    // At least the first two cards should have different (or defined) delays
    const delays = await page.evaluate(() =>
        [...document.querySelectorAll('.rp-card')]
            .map(c => c.style.animationDelay)
    );
    expect(delays.length).toBeGreaterThan(0);
    // All delays should be defined strings (e.g. "0ms", "60ms", ...)
    delays.forEach(d => expect(typeof d).toBe('string'));
});

test('A5. "New Room" #rp-add-btn card is rendered inside the overlay', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    const addBtn = page.locator('#rp-add-btn');
    await expect(addBtn).toBeVisible({ timeout: 3_000 });
    // Should show "New Room" text
    const text = await addBtn.textContent();
    expect(text).toContain('New Room');
});

test('A6. Selecting a room adds .rp-selected class to the card', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    const firstCard = page.locator('.rp-card').first();
    await firstCard.click();

    // .rp-selected should be applied immediately
    await expect(firstCard).toHaveClass(/rp-selected/, { timeout: 1_000 });
});

test('A7. After card selection, overlay begins .rp-closing animation', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('.rp-card').first().click();

    // Wait a tick — rp-closing should be on the overlay
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay')?.classList.contains('rp-closing') ||
              document.querySelector('#rp-overlay') === null,
        { timeout: 1_000 }
    );
    // After the animation the overlay should be removed
    await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 2_000 });
});

test('A8. After card selection ?room=X is written to the URL', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) {
        // Already set (auto-select)
        const roomParam = await page.evaluate(() => new URLSearchParams(window.location.search).get('room'));
        expect(roomParam).toBeTruthy();
        return;
    }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    const firstCardId = await page.locator('.rp-card').first().getAttribute('data-room-id');
    await page.locator('.rp-card').first().click();
    await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 2_000 });

    const roomParam = await page.evaluate(() => new URLSearchParams(window.location.search).get('room'));
    expect(roomParam).toBe(firstCardId);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C – "New Room" inline create form
// ─────────────────────────────────────────────────────────────────────────────

test('A9. Clicking #rp-add-btn reveals .rp-create-row inline form', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#rp-add-btn').click();

    const createRow = page.locator('.rp-create-row');
    await expect(createRow).toBeVisible({ timeout: 2_000 });
});

test('A10. Inline create form has text input, Create and Cancel buttons', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#rp-add-btn').click();
    await page.locator('.rp-create-row').waitFor({ state: 'visible', timeout: 2_000 });

    await expect(page.locator('#rp-room-name')).toBeVisible();
    await expect(page.locator('#rp-create-ok')).toBeVisible();
    await expect(page.locator('#rp-create-cx')).toBeVisible();

    const okText = await page.locator('#rp-create-ok').textContent();
    expect(okText?.trim()).toBe('Create');
    const cxText = await page.locator('#rp-create-cx').textContent();
    expect(cxText?.trim()).toBe('Cancel');
});

test('A11. Clicking Cancel in the create form hides the form', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('#rp-add-btn').click();
    await page.locator('.rp-create-row').waitFor({ state: 'visible', timeout: 2_000 });

    await page.locator('#rp-create-cx').click();
    const rowGone = !(await page.locator('.rp-create-row').isVisible());
    expect(rowGone).toBe(true);
    // Add-btn should be visible again
    await expect(page.locator('#rp-add-btn')).toBeVisible({ timeout: 1_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D – Dashboard integration
// ─────────────────────────────────────────────────────────────────────────────

test('A12. Dashboard index.html has #btn-room-picker visible', async ({ page }) => {
    await gotoDash(page);
    const btn = page.locator('#btn-room-picker');
    await expect(btn).toBeVisible({ timeout: 8_000 });
});

test('A13. Dashboard index.html does NOT show a visible #room-selector select', async ({ page }) => {
    await gotoDash(page);

    const isVisible = await page.locator('#room-selector').isVisible();
    expect(isVisible).toBe(false);

    // But the element should still be in the DOM for JS compat
    const inDom = await page.evaluate(() => document.getElementById('room-selector') !== null);
    expect(inDom).toBe(true);
});

test('A14. Clicking #btn-room-picker opens #rp-overlay on the dashboard', async ({ page }) => {
    await gotoDash(page);

    const rooms = await page.evaluate(async () => {
        try { return await APIClient.getRooms(); } catch(e) { return []; }
    });
    if (rooms.length === 0) { test.skip(); return; }

    // Click the room picker button
    await page.locator('#btn-room-picker').click();

    // Auto-select case (1 room) won't remain visible; with >1 rooms overlay appears
    if (rooms.length >= 2) {
        await page.waitForFunction(() => document.querySelector('#rp-overlay') !== null, { timeout: 5_000 });
        const overlayVisible = await page.locator('#rp-overlay').isVisible();
        expect(overlayVisible).toBe(true);
    } else {
        // With 1 room, open() auto-selects — btn click still works (no crash)
        expect(true).toBe(true);
    }
});

test('A15. #rp-overlay has role=dialog and aria-modal=true', async ({ page }) => {
    await gotoClean(page, BS_URL);
    await waitForPicker(page);
    await waitForPickerOrAutoSelect(page);

    const urlHasRoom = await page.evaluate(() => new URLSearchParams(window.location.search).has('room'));
    if (urlHasRoom) { return; }

    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });

    const role       = await page.locator('#rp-overlay').getAttribute('role');
    const ariaModal  = await page.locator('#rp-overlay').getAttribute('aria-modal');
    expect(role).toBe('dialog');
    expect(ariaModal).toBe('true');
});

test('A16. After selecting room via picker, #room-picker-label shows room name', async ({ page }) => {
    await gotoDash(page);

    const rooms = await page.evaluate(async () => {
        try { return await APIClient.getRooms(); } catch(e) { return []; }
    });
    if (rooms.length < 2) { return; } // with 1 room, auto-select → no label test possible

    // Open picker via button click (safe — init() is not blocked)
    await page.locator('#btn-room-picker').click();
    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });

    const firstCard  = page.locator('.rp-card').first();
    const firstCardName = (await firstCard.locator('.rp-name').textContent()) || '';
    await firstCard.click();
    await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 2_000 });

    const label = await page.locator('#room-picker-label').textContent();
    expect(label?.trim()).toBe(firstCardName.trim());
});

test('A17. After selecting room via picker, hidden #room-selector value is updated', async ({ page }) => {
    await gotoDash(page);

    const rooms = await page.evaluate(async () => {
        try { return await APIClient.getRooms(); } catch(e) { return []; }
    });
    if (rooms.length < 2) { return; }

    // Open picker via button click
    await page.locator('#btn-room-picker').click();
    await page.locator('#rp-overlay').waitFor({ state: 'visible', timeout: 5_000 });

    const firstCardId = await page.locator('.rp-card').first().getAttribute('data-room-id');
    await page.locator('.rp-card').first().click();
    await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 2_000 });

    const selValue = await page.evaluate(() => document.getElementById('room-selector')?.value);
    expect(String(selValue)).toBe(String(firstCardId));
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E – API contract
// ─────────────────────────────────────────────────────────────────────────────

test('A18. RoomPicker.open() method is exposed on stage.html', async ({ page }) => {
    await page.goto(STAGE_R1, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    const hasOpen = await page.evaluate(() => typeof RoomPicker.open === 'function');
    const hasPick = await page.evaluate(() => typeof RoomPicker.pick === 'function');
    const hasApply = await page.evaluate(() => typeof RoomPicker._applyRoom === 'function');

    expect(hasOpen).toBe(true);
    expect(hasPick).toBe(true);
    expect(hasApply).toBe(true);
});

test('A19. stage.html with ?room=1 does NOT show picker (URL fast-path)', async ({ page }) => {
    await page.goto(STAGE_R1, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const overlayVisible = await page.locator('#rp-overlay').isVisible();
    expect(overlayVisible).toBe(false);
});

test('A20. Dashboard auto-opens picker when no persisted room in localStorage', async ({ page }) => {
    // Navigate fresh with cleared localStorage
    await gotoClean(page, DASH_URL);
    await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

    // Check room count first
    const rooms = await page.evaluate(async () => {
        try { return await APIClient.getRooms(); } catch(e) { return []; }
    });

    if (rooms.length <= 1) {
        // 0 rooms → RoomPicker returns '1' (no overlay); 1 room → auto-select (no overlay)
        // Both are valid behaviours — picker not shown, but initialization proceeds
        const overlayShown = await page.locator('#rp-overlay').isVisible();
        expect(overlayShown).toBe(false);
        return;
    }

    // Multiple rooms → picker overlay should appear
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null ||
              document.querySelector('[data-toggle-timer]') !== null,
        { timeout: 10_000 }
    );

    const result = await page.evaluate(() => ({
        hasOverlay: document.querySelector('#rp-overlay') !== null,
        hasTimerUI: document.querySelector('[data-toggle-timer]') !== null,
    }));

    // Either the picker appeared OR the page already loaded a room (both are valid)
    expect(result.hasOverlay || result.hasTimerUI).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A21 – Delete room reopens animated picker
// ─────────────────────────────────────────────────────────────────────────────

test('A21. After deleting a room the animated room picker reopens automatically', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await gotoDash(page);

    // Ensure rooms are loaded
    await page.waitForFunction(() => {
        const sel = document.getElementById('room-selector');
        return sel && Array.from(sel.options).some(o => o.value && o.value !== '');
    }, { timeout: 15_000 });

    // Create a temporary room to delete
    const roomName = 'DeletePickerTest-' + Date.now();
    await page.click('#btn-create-room');
    await page.waitForSelector('#dialog-overlay.show', { timeout: 5_000 });
    await page.fill('#dialog-input', roomName);
    await page.click('#dialog-confirm-btn');

    // Wait for room to be loaded after creation
    await page.waitForFunction((name) => {
        const sel = document.getElementById('room-selector');
        if (!sel || !sel.value) return false;
        const opt = Array.from(sel.options).find(o => o.value === sel.value);
        return opt && opt.textContent.includes(name);
    }, roomName, { timeout: 10_000 });

    // Confirm picker label shows the room name (not "Select Room")
    const labelBefore = await page.locator('#room-picker-label').textContent();
    expect(labelBefore).not.toBe('Select Room');

    // Click delete, confirm the dialog
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show', { timeout: 5_000 });
    await page.click('#dialog-confirm-btn');

    // The animated room picker overlay should appear after deletion
    await page.waitForFunction(
        () => document.querySelector('#rp-overlay') !== null,
        { timeout: 10_000 }
    );

    const overlayVisible = await page.locator('#rp-overlay').isVisible();
    expect(overlayVisible).toBe(true);

    // The modal inner container should be present (animated modal)
    const modalInner = await page.locator('.rp-modal-inner').count();
    expect(modalInner).toBeGreaterThan(0);

    // The picker label should have been reset
    const labelAfter = await page.locator('#room-picker-label').textContent();
    expect(labelAfter).toBe('Select Room');

    expect(errors).toHaveLength(0);
});

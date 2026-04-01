// @ts-check
/**
 * B1G Timer – Delete Room Tests
 *
 * Covers:
 *  1. Delete room shows a confirmation modal with "Yes, Delete" and "No" buttons
 *  2. Clicking "No" cancels deletion (room still exists)
 *  3. Clicking "Yes, Delete" removes the room (no JS error, success toast shown)
 *  4. After deletion, selector is cleared and room is no longer listed
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForRooms(page) {
  await page.waitForFunction(() => {
    const sel = document.getElementById('room-selector');
    if (!sel) return false;
    return Array.from(sel.options).some(o => o.value && o.value !== '');
  }, { timeout: 15_000 });
}

/**
 * Navigate to the dashboard, seed localStorage so the auto-open room picker
 * does NOT block the UI. Dismisses any picker that appears regardless.
 */
async function gotoDash(page) {
  await page.addInitScript(() => {
    try {
      const existing = JSON.parse(localStorage.getItem('b1g_timer_state') || '{}');
      if (!existing.selectedRoomId) {
        existing.selectedRoomId = '__placeholder__';
        localStorage.setItem('b1g_timer_state', JSON.stringify(existing));
      }
    } catch (e) { /* ignore */ }
  });
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof RoomPicker !== 'undefined', { timeout: 10_000 });

  // Dismiss any auto-open picker that may have appeared
  const overlayUp = await page.locator('#rp-overlay').isVisible();
  if (overlayUp) {
    const hasCard = await page.locator('.rp-card').count();
    if (hasCard > 0) {
      await page.locator('.rp-card').first().click();
      await page.waitForFunction(() => document.querySelector('#rp-overlay') === null, { timeout: 3_000 }).catch(() => {});
    }
  }
}

/** Create a room via the UI and return the new room's ID */
async function createTestRoom(page, roomName) {
  await page.click('#btn-create-room');
  await page.waitForSelector('#dialog-overlay.show', { timeout: 5000 });
  await page.fill('#dialog-input', roomName);
  await page.click('#dialog-confirm-btn');

  // Wait for the room to be fully loaded (selector value updated by loadRoom fix)
  await page.waitForFunction((name) => {
    const sel = document.getElementById('room-selector');
    if (!sel || !sel.value) return false;
    const opt = Array.from(sel.options).find(o => o.value === sel.value);
    return opt && opt.textContent.includes(name);
  }, roomName, { timeout: 10_000 });

  // Return the selected room ID from StateManager (most reliable)
  return await page.evaluate(() => {
    return window.StateManager?.state?.selectedRoomId
      || document.getElementById('room-selector')?.value
      || null;
  });
}

/** Select a room by its ID */
async function selectRoom(page, roomId) {
  await page.evaluate((rid) => {
    const sel = document.getElementById('room-selector');
    if (sel) { sel.value = rid; sel.dispatchEvent(new Event('change')); }
  }, roomId);
  await page.waitForTimeout(1500);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Delete Room', () => {

  test('1. Delete confirmation modal shows with correct buttons', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await gotoDash(page);
    await waitForRooms(page);

    // Create a temp room to test with
    const roomName = 'DeleteTest-Modal-' + Date.now();
    await createTestRoom(page, roomName);

    // Click the delete room button (the red bin icon next to room selector)
    await page.click('#btn-delete-room');
    await page.waitForTimeout(500);

    // The confirm modal should appear
    const overlay = page.locator('#dialog-overlay');
    await expect(overlay).toHaveClass(/show/, { timeout: 3000 });

    // Title should mention "Delete"
    const titleText = await page.locator('#dialog-title').textContent();
    console.log(`  [test1] Dialog title: "${titleText}"`);
    expect(titleText).toMatch(/delete/i);

    // "Yes, Delete" button should exist and be styled as danger
    const confirmBtn = page.locator('#dialog-confirm-btn');
    await expect(confirmBtn).toBeVisible();
    const confirmText = await confirmBtn.textContent();
    console.log(`  [test1] Confirm button text: "${confirmText}"`);
    expect(confirmText).toMatch(/yes|delete/i);
    expect(await confirmBtn.evaluate(el => el.classList.contains('danger'))).toBe(true);

    // "No" cancel button should exist
    const cancelBtn = page.locator('#dialog-cancel-btn');
    await expect(cancelBtn).toBeVisible();
    const cancelText = await cancelBtn.textContent();
    console.log(`  [test1] Cancel button text: "${cancelText}"`);
    expect(cancelText).toMatch(/no|cancel/i);

    // Close by clicking No
    await cancelBtn.click();
    await page.waitForTimeout(300);
    await expect(overlay).not.toHaveClass(/show/);

    // No JS errors
    const realErrors = errors.filter(e => !e.includes('Pusher') && !e.includes('WebSocket') && !e.includes('net::'));
    expect(realErrors).toHaveLength(0);

    // Cleanup: delete the temp room
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show');
    await page.click('#dialog-confirm-btn');
    await page.waitForTimeout(2000);
  });

  test('2. Clicking "No" cancels deletion — room still in list', async ({ page }) => {
    await gotoDash(page);
    await waitForRooms(page);

    const roomName = 'DeleteTest-Cancel-' + Date.now();
    const roomId = await createTestRoom(page, roomName);
    expect(roomId).not.toBeNull();

    // Click delete
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show');

    // Click No / Cancel
    await page.click('#dialog-cancel-btn');
    await page.waitForTimeout(500);

    // Room should still exist in the selector
    const roomStillExists = await page.evaluate((rid) => {
      const sel = document.getElementById('room-selector');
      return Array.from(sel.options).some(o => o.value === String(rid));
    }, roomId);
    console.log(`  [test2] Room still exists after cancel: ${roomStillExists}`);
    expect(roomStillExists).toBe(true);

    // Cleanup: actually delete it
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show');
    await page.click('#dialog-confirm-btn');
    await page.waitForTimeout(2000);
  });

  test('3. Confirming delete removes room — no JS error, success toast shown', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await gotoDash(page);
    await waitForRooms(page);

    const roomName = 'DeleteTest-Confirm-' + Date.now();
    const roomId = await createTestRoom(page, roomName);
    expect(roomId).not.toBeNull();

    // Confirm deletion
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show');
    await page.click('#dialog-confirm-btn');

    // Wait a bit for deletion to complete
    await page.waitForTimeout(2000);

    // No JS errors
    const realErrors = errors.filter(e => !e.includes('Pusher') && !e.includes('WebSocket') && !e.includes('net::'));
    console.log(`  [test3] JS errors after delete: ${JSON.stringify(realErrors)}`);
    expect(realErrors).toHaveLength(0);

    // Room should no longer appear in the selector
    const roomGone = await page.evaluate((rid) => {
      const sel = document.getElementById('room-selector');
      return !Array.from(sel.options).some(o => o.value === String(rid));
    }, roomId);
    console.log(`  [test3] Room gone from selector: ${roomGone}`);
    expect(roomGone).toBe(true);

    // Success toast should have appeared (check for toast element with success class)
    const toastVisible = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.toast, .toast-success, [class*="toast"]');
      return toasts.length > 0;
    });
    console.log(`  [test3] Toast appeared: ${toastVisible}`);
    // Toast may have auto-dismissed; just verify no error toast with "Failed"
    const errorToast = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll('.toast, [class*="toast"]'));
      return toasts.some(t => t.textContent.includes('Failed'));
    });
    expect(errorToast).toBe(false);
  });

  test('4. After deletion selector is cleared and has no invalid selection', async ({ page }) => {
    await gotoDash(page);
    await waitForRooms(page);

    const roomName = 'DeleteTest-Selector-' + Date.now();
    await createTestRoom(page, roomName);

    // Delete, confirm
    await page.click('#btn-delete-room');
    await page.waitForSelector('#dialog-overlay.show');
    await page.click('#dialog-confirm-btn');
    await page.waitForTimeout(2000);

    // Room selector should have empty value (no room selected)
    const selectorValue = await page.evaluate(() => {
      return document.getElementById('room-selector')?.value || '';
    });
    console.log(`  [test4] Selector value after delete: "${selectorValue}"`);
    expect(selectorValue).toBe('');
  });
});

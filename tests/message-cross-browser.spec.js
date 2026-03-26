// @ts-check
/**
 * B1G Timer – Message Cross-Browser & Dashboard Name Tests
 *
 * Tests:
 *  1. Message shows on Stage in a separate browser context (simulates incognito)
 *  2. Message hides on Stage cross-browser via server polling
 *  3. Message state persists on Stage after page reload
 *  4-6. Dashboard name saves to DB and restores
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost/B1G_TIMER/public';
const DASHBOARD_URL = `${BASE}/index.html`;
const STAGE_URL = `${BASE}/stage.html`;

// ─── Helpers ────────────────────────────────────────────────────────────────

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

  if (!roomId) throw new Error('No room found.');
  return roomId;
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

/**
 * Type a message and show it on the dashboard
 */
async function showMessageOnDashboard(page, messageText) {
  // Ensure at least one message card exists
  const msgCardCount = await page.locator('.message-card').count();
  if (msgCardCount === 0) {
    await page.click('#btn-add-message');
    await page.waitForTimeout(400);
  }

  // Fill in the first message textarea
  const textarea = page.locator('[data-msg-input="0"]');
  await textarea.fill(messageText);
  await page.waitForTimeout(300);

  // Toggle Show ON — check if it's already active
  const toggleParent = page.locator('.msg-show-toggle').first();
  const isActive = await toggleParent.evaluate(el => el.classList.contains('active')).catch(() => false);
  if (!isActive) {
    await page.locator('[data-msg-show="0"]').click();
    await page.waitForTimeout(500);
  }
}

/**
 * Hide the first message on the dashboard
 */
async function hideMessageOnDashboard(page) {
  const toggleParent = page.locator('.msg-show-toggle').first();
  const isActive = await toggleParent.evaluate(el => el.classList.contains('active')).catch(() => false);
  if (isActive) {
    await page.locator('[data-msg-show="0"]').click();
    await page.waitForTimeout(500);
  }
}

/**
 * Rename the dashboard title using the dialog
 */
async function renameDashboard(page, newName) {
  await page.click('#btn-edit-dashboard-name');
  await page.waitForSelector('#dialog-overlay.show', { timeout: 3000 });
  await page.waitForTimeout(300);

  const input = page.locator('#dialog-input');
  await input.fill(newName);
  await page.click('#dialog-confirm-btn');
  await page.waitForTimeout(1000);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Message Cross-Browser Sync', () => {

  test('1. Message shows on Stage in a separate browser context (incognito-like)', async ({ browser }) => {
    // Context 1: Dashboard (operator)
    const dashboardCtx = await browser.newContext();
    const dashboardPage = await dashboardCtx.newPage();

    await dashboardPage.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboardPage);
    await waitForTimerList(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    const testMessage = 'CROSS-BROWSER-TEST-' + Date.now();
    await showMessageOnDashboard(dashboardPage, testMessage);

    // Wait for the broadcast to reach the server
    await dashboardPage.waitForTimeout(1000);

    // Context 2: Stage Display in a SEPARATE browser context (no shared storage — like incognito)
    const stageCtx = await browser.newContext();
    const stagePage = await stageCtx.newPage();

    await stagePage.goto(`${STAGE_URL}?room=${roomId}`);
    // Wait for stage to load and poll/sync from server (polling interval is 4s)
    await stagePage.waitForTimeout(8000);

    // Check the message ribbon is visible on stage
    const ribbon = stagePage.locator('#message-ribbon');
    const isVisible = await ribbon.evaluate(el => {
      return el.classList.contains('visible') || getComputedStyle(el).display !== 'none';
    }).catch(() => false);

    const messageText = await stagePage.locator('#message-text').textContent().catch(() => '');

    console.log(`  [test1] Stage message ribbon visible: ${isVisible}`);
    console.log(`  [test1] Stage message text: "${messageText}"`);

    expect(isVisible).toBe(true);
    expect(messageText).toContain('CROSS-BROWSER-TEST');

    await dashboardCtx.close();
    await stageCtx.close();
  });

  test('2. Message hide syncs to Stage cross-browser', async ({ browser }) => {
    // Context 1: Dashboard
    const dashboardCtx = await browser.newContext();
    const dashboardPage = await dashboardCtx.newPage();

    await dashboardPage.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboardPage);
    await waitForTimerList(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    // Show a message first
    await showMessageOnDashboard(dashboardPage, 'HIDE-TEST-' + Date.now());
    await dashboardPage.waitForTimeout(1000);

    // Context 2: Stage in separate context
    const stageCtx = await browser.newContext();
    const stagePage = await stageCtx.newPage();
    await stagePage.goto(`${STAGE_URL}?room=${roomId}`);
    await stagePage.waitForTimeout(8000);

    // Verify message is visible
    const ribbonVisible = await stagePage.locator('#message-ribbon').evaluate(el =>
      el.classList.contains('visible') || getComputedStyle(el).display !== 'none'
    ).catch(() => false);
    console.log(`  [test2] Stage message visible before hide: ${ribbonVisible}`);
    expect(ribbonVisible).toBe(true);

    // Now HIDE the message from dashboard
    await hideMessageOnDashboard(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    // Wait for polling to pick up the hidden message
    await stagePage.waitForTimeout(8000);

    const ribbonHidden = await stagePage.locator('#message-ribbon').evaluate(el =>
      !el.classList.contains('visible') || getComputedStyle(el).display === 'none'
    ).catch(() => true);
    console.log(`  [test2] Stage message hidden after toggle: ${ribbonHidden}`);
    expect(ribbonHidden).toBe(true);

    await dashboardCtx.close();
    await stageCtx.close();
  });

  test('3. Message state persists on Stage after page reload (cross-browser)', async ({ browser }) => {
    // Dashboard shows a message
    const dashboardCtx = await browser.newContext();
    const dashboardPage = await dashboardCtx.newPage();

    await dashboardPage.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(dashboardPage);
    await waitForTimerList(dashboardPage);
    await dashboardPage.waitForTimeout(1000);

    const reloadTestMsg = 'RELOAD-TEST-' + Date.now();
    await showMessageOnDashboard(dashboardPage, reloadTestMsg);
    await dashboardPage.waitForTimeout(1000);

    // Stage in separate context — load, then reload
    const stageCtx = await browser.newContext();
    const stagePage = await stageCtx.newPage();
    await stagePage.goto(`${STAGE_URL}?room=${roomId}`);
    await stagePage.waitForTimeout(8000);

    // Reload the stage page (simulates fresh load in a different browser)
    await stagePage.reload();
    await stagePage.waitForTimeout(8000);

    const isVisible = await stagePage.locator('#message-ribbon').evaluate(el =>
      el.classList.contains('visible') || getComputedStyle(el).display !== 'none'
    ).catch(() => false);
    const text = await stagePage.locator('#message-text').textContent().catch(() => '');

    console.log(`  [test3] After reload — ribbon visible: ${isVisible}, text: "${text}"`);
    expect(isVisible).toBe(true);
    expect(text).toContain('RELOAD-TEST');

    await dashboardCtx.close();
    await stageCtx.close();
  });
});

test.describe('Dashboard Name in Database', () => {

  test('4. Dashboard name saves to DB and restores on room switch', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page);
    await waitForTimerList(page);
    await page.waitForTimeout(1000);

    const titleEl = page.locator('#dashboard-title');
    await expect(titleEl).toBeVisible();

    const testName = 'TestDash-' + Date.now();
    await renameDashboard(page, testName);

    // Verify the title was set
    const currentTitle = await titleEl.textContent();
    console.log(`  [test4] Dashboard title after rename: "${currentTitle}"`);
    expect(currentTitle).toBe(testName);

    // Verify the name persists in the database by calling the API directly
    const roomData = await page.evaluate(async (rid) => {
      const resp = await fetch(`../api/v1/rooms/${rid}`);
      const json = await resp.json();
      return json.data;
    }, roomId);

    console.log(`  [test4] Room from API - dashboard_name: "${roomData.dashboard_name}"`);
    expect(roomData.dashboard_name).toBe(testName);
  });

  test('5. Dashboard name persists across page reload', async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page);
    await waitForTimerList(page);
    await page.waitForTimeout(1000);

    const testName = 'ReloadDash-' + Date.now();
    await renameDashboard(page, testName);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(3000);

    // Re-select the same room
    await page.evaluate((rid) => {
      const sel = document.getElementById('room-selector');
      if (sel) {
        sel.value = rid;
        sel.dispatchEvent(new Event('change'));
      }
    }, roomId);
    await page.waitForTimeout(2000);

    const restoredTitle = await page.locator('#dashboard-title').textContent();
    console.log(`  [test5] Dashboard title after reload: "${restoredTitle}"`);
    expect(restoredTitle).toBe(testName);
  });

  test('6. Dashboard name in separate browser context matches DB', async ({ browser }) => {
    // Context 1: Set dashboard name
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await page1.goto(DASHBOARD_URL);
    const roomId = await selectFirstRoom(page1);
    await waitForTimerList(page1);
    await page1.waitForTimeout(1000);

    const testName = 'CrossCtxDash-' + Date.now();
    await renameDashboard(page1, testName);

    // Context 2: Open dashboard in separate context (incognito-like) and select same room
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await page2.goto(DASHBOARD_URL);
    await page2.waitForTimeout(3000);

    // Select the same room
    await page2.evaluate((rid) => {
      const sel = document.getElementById('room-selector');
      if (sel) {
        sel.value = rid;
        sel.dispatchEvent(new Event('change'));
      }
    }, roomId);
    await page2.waitForTimeout(2000);

    const title2 = await page2.locator('#dashboard-title').textContent();
    console.log(`  [test6] Dashboard title in second context: "${title2}"`);
    expect(title2).toBe(testName);

    await ctx1.close();
    await ctx2.close();
  });
});

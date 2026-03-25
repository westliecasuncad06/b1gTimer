// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * B1G Timer - Playwright Test Configuration
 * Tests run against the local XAMPP server serving the project.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,   // Timer tests must run sequentially (shared DB state)
  workers: 1,             // Single worker — prevents cross-file DB interference
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost/B1G_TIMER/public',
    headless: false,
    // Keep a modest viewport so layout doesn't collapse
    viewport: { width: 1280, height: 800 },
    // Accept any origin (Pusher CDN, Google Fonts, etc.)
    ignoreHTTPSErrors: true,
    // Capture screenshot on failure for debugging  
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

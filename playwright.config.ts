import { defineConfig, devices } from '@playwright/test';

const configuredPagesUrl = process.env.PAGES_URL;
if (!configuredPagesUrl) {
  throw new Error('PAGES_URL is required for the live GitHub Pages smoke test.');
}

const pagesUrl = new URL(configuredPagesUrl);
if (pagesUrl.hostname === 'localhost' || pagesUrl.hostname === '127.0.0.1') {
  throw new Error('PAGES_URL must identify the deployed site, not localhost or 127.0.0.1.');
}
if (pagesUrl.protocol !== 'https:') {
  throw new Error('PAGES_URL must use HTTPS.');
}

export default defineConfig({
  testDir: './apps/demo/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: pagesUrl.href.endsWith('/') ? pagesUrl.href : `${pagesUrl.href}/`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

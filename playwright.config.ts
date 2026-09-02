import { defineConfig, devices } from '@playwright/test';

const configuredPagesUrl = process.env.PAGES_URL;
if (!configuredPagesUrl) {
  throw new Error('PAGES_URL is required for the live GitHub Pages smoke test.');
}

const canonicalPagesUrl = 'https://xilovesyu.github.io/comparison-table/';
const acceptedPagesUrls = new Set([
  'https://xilovesyu.github.io/comparison-table',
  canonicalPagesUrl,
]);
if (!acceptedPagesUrls.has(configuredPagesUrl)) {
  throw new Error(
    `PAGES_URL must exactly equal ${canonicalPagesUrl} with an optional trailing slash.`,
  );
}

const pagesUrl = new URL(configuredPagesUrl);
if (pagesUrl.hostname === 'localhost' || pagesUrl.hostname === '127.0.0.1') {
  throw new Error('PAGES_URL must identify the deployed site, not localhost or 127.0.0.1.');
}
if (pagesUrl.pathname === '/comparison-table') {
  pagesUrl.pathname = '/comparison-table/';
}
if (pagesUrl.search || pagesUrl.hash || pagesUrl.href !== canonicalPagesUrl) {
  throw new Error(`PAGES_URL must exactly equal ${canonicalPagesUrl} without a query or hash.`);
}

export default defineConfig({
  testDir: './apps/demo/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 2,
  reporter: 'line',
  use: {
    baseURL: canonicalPagesUrl,
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

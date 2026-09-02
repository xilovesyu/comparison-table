import { expect, test } from '@playwright/test';

const examples = [
  { fragment: '', heading: '基础递归对比', link: '基础递归对比' },
  { fragment: '#example-keyed-array', heading: '业务键数组对齐', link: '业务键数组对齐' },
  {
    fragment: '#example-container-summary',
    heading: '容器摘要',
    link: '容器摘要',
  },
  {
    fragment: '#example-advanced-configuration',
    heading: '综合高级配置',
    link: '综合高级配置',
  },
] as const;

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await page.screenshot({ path: testInfo.outputPath('failure.png'), fullPage: true });
  }
});

for (const example of examples) {
  test(`reloads ${example.heading} from its live Pages URL`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    const assetErrors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('response', (response) => {
      if (!response.ok() && response.url().includes('/comparison-table/')) {
        assetErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(`./${example.fragment}`);
    await page.reload();

    await expect(page.getByRole('heading', { level: 2, name: example.heading })).toBeVisible();
    await expect(page.getByRole('link', { name: example.link })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('region', { name: 'Recursive comparison table' })).toBeVisible();
    expect(assetErrors, 'deployed asset requests').toEqual([]);
    expect(runtimeErrors, 'console and pageerror events').toEqual([]);
  });
}

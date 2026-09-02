import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (relative) => readFile(path.join(root, relative), 'utf8');

test('Pages workflow is main-only, least-privileged, SHA-pinned, and has build/deploy/smoke topology', async () => {
  const workflow = await file('.github/workflows/pages.yml');
  assert.match(workflow, /^on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/m);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:|release:/);
  assert.ok(
    (workflow.match(/if:\s*github\.ref\s*==\s*'refs\/heads\/main'/g) ?? []).length >= 3,
    'build, deploy, and smoke must each guard against non-main refs',
  );
  assert.match(
    workflow,
    /concurrency:[\s\S]*group:\s*pages-production[\s\S]*cancel-in-progress:\s*false/,
  );
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(
    workflow,
    /environment:\s*\n\s*name:\s*github-pages[\s\S]*url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*}}/,
  );
  assert.match(workflow, /configure-pages@[a-f0-9]{40}/);
  assert.match(workflow, /build:[\s\S]*upload-pages-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /deploy:[\s\S]*needs:\s*build[\s\S]*deploy-pages@[a-f0-9]{40}/);
  assert.match(workflow, /smoke:[\s\S]*needs:\s*deploy[\s\S]*page_url/);
  assert.doesNotMatch(workflow, /npm publish|NPM_TOKEN/);
});

test('Pages artifact contains exactly the demo distribution and rejects unsafe payload files', async () => {
  const workflow = await file('.github/workflows/pages.yml');
  assert.match(workflow, /path:\s*apps\/demo\/dist/);
  assert.doesNotMatch(workflow, /path:\s*(?:dist|\.\/dist|\.)\s*$/m);
  assert.match(workflow, /(?:find|tar|artifact).*?(?:\.map|\.env|\.npmrc|^\.)/ims);
});

test('Pages workflow installs Chromium for each smoke run without caching browser binaries', async () => {
  const workflow = await file('.github/workflows/pages.yml');
  const chromiumInstalls = workflow.match(/playwright\s+install\s+chromium/g) ?? [];
  assert.equal(chromiumInstalls.length, 1);
  assert.doesNotMatch(workflow, /actions\/cache|ms-playwright|PLAYWRIGHT_BROWSERS_PATH/);
});

test('CI validates the Pages build and artifact contract but cannot deploy Pages', async () => {
  const ci = await file('.github/workflows/ci.yml');
  assert.match(ci, /pull_request:/);
  assert.match(ci, /push:[\s\S]*main/);
  assert.match(ci, /build:pages/);
  assert.match(ci, /upload-pages-artifact@[a-f0-9]{40}/);
  assert.doesNotMatch(ci, /deploy-pages|github-pages|pages:\s*write|id-token:\s*write/);
});

test('demo has a dedicated Pages build while local build and dev contracts remain unchanged', async () => {
  const packageJson = JSON.parse(await file('apps/demo/package.json'));
  const vite = await file('apps/demo/vite.config.ts');
  assert.equal(packageJson.scripts.dev, 'vite');
  assert.match(packageJson.scripts.build, /vite build/);
  assert.match(packageJson.scripts['build:pages'], /vite build/);
  assert.match(vite, /base:\s*['"]\/comparison-table\//);
});

test('README and Pages operations guide publish live deep links, first-run, rollback, and smoke evidence', async () => {
  const readme = await file('README.md');
  const operations = await file('docs/pages-operations.md');
  for (const fragment of [
    '',
    '#example-keyed-array',
    '#example-container-summary',
    '#example-advanced-configuration',
  ]) {
    assert.match(
      readme,
      new RegExp('https:\\/\\/xilovesyu\\.github\\.io\\/comparison-table\\/' + fragment),
    );
  }
  assert.match(operations, /first[ -]run/i);
  assert.match(operations, /rollback/i);
  assert.match(operations, /Chromium|Playwright/);
});

test('Playwright smoke configuration requires a non-local Pages URL and proves root plus deep-link reloads', async () => {
  const packageJson = JSON.parse(await file('package.json'));
  const config = await file('playwright.config.ts');
  const smoke = await file('apps/demo/e2e/pages-smoke.spec.ts');
  assert.ok(packageJson.devDependencies['@playwright/test']);
  assert.match(config, /PAGES_URL/);
  assert.match(config, /localhost|127\.0\.0\.1/);
  assert.match(config, /throw new Error/);
  for (const fragment of [
    '',
    '#example-keyed-array',
    '#example-container-summary',
    '#example-advanced-configuration',
  ]) {
    assert.match(smoke, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(smoke, /reload\(/);
  assert.match(smoke, /heading|aria-current|Recursive comparison table/);
  assert.match(smoke, /asset|console|pageerror/i);
  assert.match(smoke, /screenshot|trace|video/i);
});

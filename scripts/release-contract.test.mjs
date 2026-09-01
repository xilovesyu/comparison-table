import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readWorkspaceFile(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('release scripts validate, dry-run, and publish the library safely', async () => {
  const packageJson = JSON.parse(await readWorkspaceFile('package.json'));

  assert.match(packageJson.scripts['release:check'], /pnpm run format:check/);
  assert.match(packageJson.scripts['release:check'], /pnpm run build/);
  assert.match(packageJson.scripts['release:check'], /pnpm test/);
  assert.match(packageJson.scripts['release:check'], /pnpm run pack:check/);
  assert.match(packageJson.scripts['release:dry-run'], /pnpm run release:check/);
  assert.match(packageJson.scripts['release:dry-run'], /npm publish/);
  assert.match(packageJson.scripts['release:dry-run'], /--dry-run/);
  assert.match(packageJson.scripts['release:publish'], /pnpm run release:check/);
  assert.match(packageJson.scripts['release:publish'], /npm publish/);
  assert.match(packageJson.scripts['release:publish'], /--provenance/);
  assert.match(packageJson.scripts['release:publish'], /--access public/);
});

test('CI verifies each change without publishing', async () => {
  const workflow = await readWorkspaceFile('.github/workflows/ci.yml');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm run release:check/);
  assert.doesNotMatch(workflow, /npm publish/);
});

test('release workflow uses an explicit trigger and npm trusted publishing', async () => {
  const workflow = await readWorkspaceFile('.github/workflows/publish.yml');

  assert.match(workflow, /release:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pnpm run release:check/);
  assert.match(workflow, /npm publish --provenance --access public/);
  assert.doesNotMatch(workflow, /NPM_TOKEN/);
});

test('README documents public package installation and trusted publishing setup', async () => {
  const readme = await readWorkspaceFile('README.md');
  const packageReadme = await readWorkspaceFile('packages/comparison-table/README.md');

  for (const content of [readme, packageReadme]) {
    assert.match(content, /@jxi\/comparison-table/);
    assert.match(content, /@jxi\/comparison-table\/styles\.css/);
  }
  assert.match(readme, /Trusted Publishing/);
  assert.match(readme, /release:dry-run/);
  assert.match(readme, /release:publish/);
});

test('documentation provides static screenshots and a complete component props reference', async () => {
  const readme = await readWorkspaceFile('README.md');
  const packageReadme = await readWorkspaceFile('packages/comparison-table/README.md');
  const componentSource = await readWorkspaceFile(
    'packages/comparison-table/src/components/RecursiveComparisonTable.tsx',
  );
  const publicPropsSource = componentSource.match(
    /export interface RecursiveComparisonTableProps[\s\S]*?\n}\n\n\/\*\*/,
  )?.[0];
  assert.ok(publicPropsSource, 'public component props interface should be present');
  const propNames = [...(publicPropsSource ?? '').matchAll(/^  (\w+)\??:/gm)].map(
    (match) => match[1],
  );
  const imagePaths = [...readme.matchAll(/\]\((docs\/images\/[^)]+\.png)\)/g)].map(
    (match) => match[1],
  );

  assert.equal(imagePaths.length, 3);
  await Promise.all(imagePaths.map((imagePath) => access(path.join(root, imagePath))));
  assert.match(packageReadme, /## Component props/);
  for (const propName of propNames) {
    assert.match(packageReadme, new RegExp('\\| `' + propName + '`'));
  }
});

test('public documentation and JSDoc specify the display-only container summary contract', async () => {
  const packageReadme = await readWorkspaceFile('packages/comparison-table/README.md');
  const typeSource = await readWorkspaceFile('packages/comparison-table/src/core/types.ts');

  assert.match(packageReadme, /containerSummary/);
  assert.match(packageReadme, /definition.*rule.*table/i);
  assert.match(packageReadme, /undefined.*fallback/i);
  assert.match(packageReadme, /not.*search/i);
  assert.match(typeSource, /containerSummary\??:/);
  assert.match(typeSource, /display-only/i);
  assert.match(typeSource, /undefined.*normal renderer fallback/i);
  assert.match(packageReadme, /null.*false/i);
  assert.match(packageReadme, /not.*search/i);
});

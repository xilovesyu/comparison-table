import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

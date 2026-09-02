import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps', 'demo', 'dist');
const backup = path.join(root, 'apps', 'demo', '.dist-pages-security-backup');
const sensitiveFixture = path.join(root, 'scripts', 'pages-sensitive-fixture');

async function withIsolatedDistribution(t, createFixture) {
  await rm(backup, { recursive: true, force: true });
  try {
    await lstat(dist);
    await cp(dist, backup, { recursive: true, verbatimSymlinks: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await rm(dist, { recursive: true, force: true });
  try {
    await createFixture();
    await assert.rejects(
      execFileAsync(process.execPath, ['scripts/verify-pages-artifact.mjs'], { cwd: root }),
    );
  } finally {
    await rm(dist, { recursive: true, force: true });
    await rm(sensitiveFixture, { recursive: true, force: true });
    try {
      await lstat(backup);
      await cp(backup, dist, { recursive: true, verbatimSymlinks: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await rm(backup, { recursive: true, force: true });
  }
}

async function createJunctionOrSkip(t, target, link) {
  try {
    await symlink(target, link, 'junction');
    assert.equal((await lstat(link)).isSymbolicLink(), true);
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip(
        `Windows denied both file-link-compatible junction creation (${error.code}); this is an environment limitation, not a passing security result`,
      );
      return false;
    }
    throw error;
  }
  return true;
}

test('Pages artifact verifier rejects a root junction even when the target tree looks valid', async (t) => {
  await withIsolatedDistribution(t, async () => {
    await mkdir(path.join(sensitiveFixture, 'assets'), { recursive: true });
    await writeFile(path.join(sensitiveFixture, 'index.html'), '<!doctype html>');
    await writeFile(path.join(sensitiveFixture, 'assets', 'safe.js'), 'export {}');
    if (!(await createJunctionOrSkip(t, sensitiveFixture, dist))) return;
  });
});

test('Pages artifact verifier rejects a recursive asset junction to an external fixture', async (t) => {
  await withIsolatedDistribution(t, async () => {
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<!doctype html>');
    await writeFile(path.join(dist, 'assets', 'safe.js'), 'export {}');
    await mkdir(sensitiveFixture, { recursive: true });
    await writeFile(path.join(sensitiveFixture, 'sensitive.txt'), 'test-only sensitive fixture');
    if (!(await createJunctionOrSkip(t, sensitiveFixture, path.join(dist, 'assets', 'escaped'))))
      return;
  });
});

test('Playwright config restricts the smoke target to the one canonical Pages URL', async () => {
  const config = await readFile(path.join(root, 'playwright.config.ts'), 'utf8');
  assert.match(config, /https:\/\/xilovesyu\.github\.io\/comparison-table\//);
  assert.match(config, /pagesUrl\.href\s*!==?\s*canonicalPagesUrl/);
  assert.match(config, /pagesUrl\.search|configuredPagesUrl.*[?]/s);
  assert.match(config, /pagesUrl\.hash|configuredPagesUrl.*[#]/s);
});

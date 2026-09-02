import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, link, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'apps', 'demo', 'dist');
const backup = path.join(root, 'apps', 'demo', '.dist-pages-security-backup');
const sensitiveFixture = path.join(root, 'scripts', 'pages-sensitive-fixture');

async function withIsolatedDistribution(t, createFixture, mustReject = true) {
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
    const verify = execFileAsync(process.execPath, ['scripts/verify-pages-artifact.mjs'], {
      cwd: root,
    });
    if (mustReject) await assert.rejects(verify);
    else await verify;
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

test('Pages artifact verifier accepts a normal standalone asset file', async (t) => {
  await withIsolatedDistribution(
    t,
    async () => {
      await mkdir(path.join(dist, 'assets'), { recursive: true });
      await writeFile(path.join(dist, 'index.html'), '<!doctype html>');
      await writeFile(path.join(dist, 'assets', 'benign.js'), 'export {}');
    },
    false,
  );
});

test('Pages artifact verifier rejects a hard-linked asset that aliases a sensitive file outside dist', async (t) => {
  await withIsolatedDistribution(t, async () => {
    const outsideFixture = path.join(root, 'scripts', 'pages-sensitive-outside.js');
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<!doctype html>');
    await writeFile(outsideFixture, 'test-only sensitive fixture');
    try {
      await link(outsideFixture, path.join(dist, 'assets', 'benign.js'));
    } finally {
      t.after(() => rm(outsideFixture, { force: true }));
    }
  });
});

test('Playwright config restricts the smoke target to the one canonical Pages URL', async () => {
  const config = await readFile(path.join(root, 'playwright.config.ts'), 'utf8');
  assert.match(config, /https:\/\/xilovesyu\.github\.io\/comparison-table\//);
  assert.match(config, /pagesUrl\.href\s*!==?\s*canonicalPagesUrl/);
  assert.match(config, /pagesUrl\.search|configuredPagesUrl.*[?]/s);
  assert.match(config, /pagesUrl\.hash|configuredPagesUrl.*[#]/s);
});

test('Playwright config load normalizes a missing trailing slash but discovers exactly four smoke routes', async () => {
  const playwrightCli = path.join(path.dirname(require.resolve('@playwright/test')), 'cli.js');
  const listTests = (pagesUrl) => {
    return execFileAsync(process.execPath, [playwrightCli, 'test', '--list'], {
      cwd: root,
      env: { ...process.env, PAGES_URL: pagesUrl },
    });
  };

  for (const accepted of [
    'https://xilovesyu.github.io/comparison-table',
    'https://xilovesyu.github.io/comparison-table/',
  ]) {
    const { stdout } = await listTests(accepted);
    assert.match(stdout, /Total:\s*4 tests in 1 file/);
  }

  for (const invalid of [
    '',
    'http://xilovesyu.github.io/comparison-table/',
    'https://localhost/comparison-table/',
    'https://wrong.github.io/comparison-table/',
    'https://xilovesyu.github.io/wrong/',
    'https://xilovesyu.github.io/comparison-table/?preview=1',
    'https://xilovesyu.github.io/comparison-table/#example-keyed-array',
    'https://xilovesyu.github.io:443/comparison-table/',
    'https://xilovesyu.github.io:0443/comparison-table/',
    'https://xilovesyu.github.io/comparison-table/%2e/',
    'https:////xilovesyu.github.io/comparison-table/',
    'https://viewer@xilovesyu.github.io/comparison-table/',
    'HTTPS://xilovesyu.github.io/comparison-table/',
  ]) {
    await assert.rejects(listTests(invalid), /PAGES_URL|canonical|HTTPS|localhost/i);
  }
});

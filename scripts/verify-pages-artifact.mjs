import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distributionRoot = path.join(workspaceRoot, 'apps', 'demo', 'dist');
const unsafeName = /(?:^|\/)(?:\.|\.env(?:\.|$)|\.npmrc$)|\.map$/i;

async function listFiles(directory, relative = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), entryRelative)));
    } else {
      files.push(entryRelative);
    }
  }
  return files;
}

assert((await stat(distributionRoot)).isDirectory(), 'apps/demo/dist must exist');
const rootEntries = await readdir(distributionRoot);
assert.deepEqual(
  [...rootEntries].sort(),
  ['assets', 'index.html'],
  'Pages artifact root may contain only index.html and assets/',
);

const files = await listFiles(distributionRoot);
assert(files.includes('index.html'), 'Pages artifact must contain index.html');
assert(
  files.some((file) => file.startsWith('assets/')),
  'Pages artifact must contain built assets',
);
assert.deepEqual(
  files.filter((file) => unsafeName.test(file)),
  [],
  'Pages artifact must not contain source maps, secrets, or dotfiles',
);

console.log(`Verified ${files.length} safe files in apps/demo/dist`);

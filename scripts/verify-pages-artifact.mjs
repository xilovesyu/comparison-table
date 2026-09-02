import assert from 'node:assert/strict';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distributionRoot = path.join(workspaceRoot, 'apps', 'demo', 'dist');
const unsafeName = /(?:^|\/)(?:\.|\.env(?:\.|$)|\.npmrc$)|\.map$/i;

async function listFiles(directory, relative = '') {
  const directoryStats = await lstat(directory);
  assert(
    directoryStats.isDirectory() && !directoryStats.isSymbolicLink(),
    `Pages artifact directory must be a real directory: ${relative || 'apps/demo/dist'}`,
  );

  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryRelative = path.posix.join(relative, entry.name);
    const entryPath = path.join(directory, entry.name);
    const entryStats = await lstat(entryPath);
    assert(
      !entry.isSymbolicLink() && !entryStats.isSymbolicLink(),
      `Pages artifact must not contain symbolic links or junctions: ${entryRelative}`,
    );
    if (entry.isDirectory() && entryStats.isDirectory()) {
      files.push(...(await listFiles(entryPath, entryRelative)));
    } else if (entry.isFile() && entryStats.isFile()) {
      assert.equal(
        entryStats.nlink,
        1,
        `Pages artifact regular files must not be hard linked: ${entryRelative}`,
      );
      files.push(entryRelative);
    } else {
      assert.fail(`Pages artifact contains an unsupported filesystem node: ${entryRelative}`);
    }
  }
  return files;
}

const distributionStats = await lstat(distributionRoot);
assert(
  distributionStats.isDirectory() && !distributionStats.isSymbolicLink(),
  'apps/demo/dist must be a real directory, not a symbolic link or junction',
);
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

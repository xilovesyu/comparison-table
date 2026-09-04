import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
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

  assert.equal(imagePaths.length, 4);
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

test('README and manual runbook document the canonical demo directory navigation', async () => {
  const readme = await readWorkspaceFile('README.md');
  const manualRunbook = await readWorkspaceFile('docs/manual-testing/README.md');
  const screenshot = path.join(root, 'docs/images/demo-navigation.png');

  for (const url of [
    'http://localhost:5173/#example-keyed-array',
    'http://localhost:5173/#example-container-summary',
    'http://localhost:5173/#example-advanced-configuration',
  ]) {
    assert.match(readme, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const sourceLink of [
    'apps/demo/src/examples/KeyedArrayExample.tsx',
    'apps/demo/src/examples/ContainerSummaryExample.tsx',
    'apps/demo/src/examples/AdvancedExample.tsx',
  ]) {
    assert.match(
      readme,
      new RegExp('\\]\\(' + sourceLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)'),
    );
  }
  assert.match(readme, /localhost.*before/i);
  assert.match(readme, /!\[[^\]]+\]\(docs\/images\/demo-navigation\.png\)/);
  await access(screenshot);
  assert.ok(
    (await stat(screenshot)).size <= 500 * 1024,
    'navigation screenshot must not exceed 500 KB',
  );
  assert.match(manualRunbook, /1440\s*[×x]\s*1000/);
  assert.match(manualRunbook, /#example-keyed-array/);
  assert.match(manualRunbook, /MT-20/);
  assert.match(manualRunbook, /Chromium/);
  assert.match(manualRunbook, /1440\s*[×x]\s*1000/);
  assert.match(manualRunbook, /#example-keyed-array/);
  assert.match(manualRunbook, /五组|5\s*组/);
  assert.match(manualRunbook, /当前项/);
  assert.match(manualRunbook, /展开表/);
  assert.match(manualRunbook, /demo-navigation\.png/);
  assert.match(manualRunbook, /README.*render|render.*README/i);
  assert.doesNotMatch(manualRunbook, /11\s*张完整表格/);
});

test('both READMEs document the complete opt-in Final merge contract', async () => {
  const readmes = await Promise.all([
    readWorkspaceFile('README.md'),
    readWorkspaceFile('packages/comparison-table/README.md'),
  ]);

  for (const content of readmes) {
    assert.match(content, /merge.*enabled.*true.*Final/is);
    assert.match(content, /controlled.*value.*uncontrolled.*defaultValue/is);
    assert.match(content, /keyed.*presence.*Include.*Exclude/is);
    assert.match(content, /non-keyed.*array.*(?:whole|atomic)/is);
    assert.match(content, /composite.*key.*(?:materiali[sz]e|canonical string)/is);
    assert.match(content, /mergedData.*deep(?:ly)?.*independent.*(?:JSON-like|Date)/is);
    assert.match(content, /(?:cannot|unable|unsupported).*clone.*(?:fail|throw)/is);
    assert.match(content, /onComplete.*user.*incomplete.*complete.*mount.*not/is);
  }
});

test('public Merge API JSDoc records U1 clone and U2 submission boundaries', async () => {
  const typeSource = await readWorkspaceFile('packages/comparison-table/src/core/types.ts');

  for (const publicType of [
    'MergeOptions',
    'MergeResolutions',
    'MergeResolution',
    'MergeResult',
    'MergePatch',
    'MergeScopeEntry',
    'MergeSourceDecision',
  ]) {
    assert.match(typeSource, new RegExp(`export (?:interface|type) ${publicType}`));
  }
  assert.match(typeSource, /Deeply independent.*(?:JSON-like|Date)/is);
  assert.match(typeSource, /(?:cannot|unsupported).*clone.*(?:fail|throw)/is);
  assert.match(typeSource, /onComplete[\s\S]*user.*incomplete.*complete[\s\S]*mount.*not/is);
  assert.match(typeSource, /composite.*key.*canonical string/is);
});

test('manual runbook covers Final merge API modes and U1/U2 edge cases', async () => {
  const manualRunbook = await readWorkspaceFile('docs/manual-testing/README.md');

  assert.match(manualRunbook, /S12[\s\S]*Final.*合并/i);
  assert.match(manualRunbook, /MT-21[\s\S]*Final.*合并/i);
  assert.match(manualRunbook, /默认关闭|default.*off/i);
  assert.match(manualRunbook, /controlled.*uncontrolled|受控.*非受控/i);
  assert.match(manualRunbook, /keyed.*presence.*Include.*Exclude/is);
  assert.match(manualRunbook, /non-keyed.*array.*(?:whole|atomic)|非 keyed.*数组.*整体/is);
  assert.match(manualRunbook, /composite.*key.*canonical|string.*物化|复合.*key.*物化/is);
  assert.match(manualRunbook, /JSON-like.*Date.*deep|深度独立.*Date/is);
  assert.match(manualRunbook, /onComplete.*用户.*incomplete.*complete.*mount/is);
});

test('both READMEs document the source-and-edit merge contract and migration boundary', async () => {
  const readmes = await Promise.all([
    readWorkspaceFile('README.md'),
    readWorkspaceFile('packages/comparison-table/README.md'),
  ]);

  for (const content of readmes) {
    assert.match(content, /Merge resolution is off by default|合并.*默认关闭/i);
    assert.match(content, /merge.*enabled.*true/is);
    assert.match(content, /MergeResolutions.*MergeEdits|source.*edits.*independent/is);
    assert.match(content, /\bedits\b.*\bdefaultEdits\b.*\bonEditsChange\b/is);
    assert.match(content, /container.*source.*inherit.*child.*override.*clear/is);
    assert.match(content, /keyed.*array.*item.*presence/is);
    assert.match(content, /mergeEditor.*(?:Date|decimal|enum|custom)/is);
    assert.match(content, /raw.*(?:renderer|renderValue).*isolation|renderer.*not.*editor/is);
    assert.match(content, /resolvedPatch.*(?:canonical|stable).*non[- ]overlap.*migrat/is);
  }
});

test('public Merge edit JSDoc specifies raw editor isolation and controlled pair echo semantics', async () => {
  const typeSource = await readWorkspaceFile('packages/comparison-table/src/core/types.ts');

  for (const publicType of ['MergeEdit', 'MergeEdits', 'MergeEditor', 'MergeEditorProps']) {
    assert.match(typeSource, new RegExp(`export (?:interface|type) ${publicType}`));
  }
  assert.match(typeSource, /mergeEditor[\s\S]*raw.*(?:not|never).*renderer/is);
  assert.match(typeSource, /\bedits\b[\s\S]*independent.*(?:source|value)/is);
  assert.match(typeSource, /onComplete[\s\S]*(?:value|source).*edits.*(?:pair|both).*echo/is);
  assert.match(typeSource, /resolvedPatch[\s\S]*(?:canonical|stable).*non[- ]overlap.*migrat/is);
});

test('manual runbook covers container inheritance, raw editors, dual modes, and patch migration', async () => {
  const manualRunbook = await readWorkspaceFile('docs/manual-testing/README.md');

  assert.match(manualRunbook, /MT-22[\s\S]*(?:Final|merge).*(?:edit|编辑)/is);
  assert.match(manualRunbook, /Ant Design|AntD/i);
  assert.match(manualRunbook, /container.*source.*inherit.*child.*override.*clear/is);
  assert.match(manualRunbook, /keyed.*array.*item.*presence/is);
  assert.match(manualRunbook, /primitive.*raw.*edit.*mergeEditor/is);
  assert.match(manualRunbook, /controlled.*uncontrolled.*defaultEdits/is);
  assert.match(manualRunbook, /onComplete.*(?:value|source).*edits.*(?:pair|echo)/is);
  assert.match(manualRunbook, /resolvedPatch.*(?:canonical|stable).*non[- ]overlap.*migrat/is);
});

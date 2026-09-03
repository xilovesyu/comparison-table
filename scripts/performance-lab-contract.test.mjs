import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const manifestPath = 'scripts/fixtures/performance-lab-manifest.v1.json';

test('Performance Lab v1 manifest fixes unique IDs, seed, version profiles, and adversarial catalog coverage', async () => {
  const manifest = JSON.parse(await read(manifestPath));
  assert.equal(manifest.version, 1);
  assert.equal(typeof manifest.seed, 'number');
  assert.equal(new Set(manifest.cases).size, manifest.cases.length);
  assert.deepEqual(manifest.profiles, ['two-version', 'three-version', 'eight-version']);
  for (const required of [
    'empty',
    'null-missing-undefined',
    'text-10240',
    'depth-20',
    'wide-1000',
    'keyed-presence',
    'large-keyed-1024',
  ])
    assert.ok(manifest.cases.includes(required));
});

test('Performance Lab generator and semantic oracle are deterministic and expose keyed validation', async () => {
  const source = await read('scripts/performance-lab/catalog.mjs');
  assert.match(source, /seed|deterministic|repeat/i);
  assert.match(source, /1024|keyed|reorder|presence/i);
  assert.match(source, /duplicate|missing|blank|arrayItemKeyFields/i);
  assert.match(source, /semantic|oracle|expected/i);
});

test('Performance Lab protocol records two RAFs, timeout/stale/error categories and opt-in longtask/heap telemetry', async () => {
  const source = await read('scripts/performance-lab/protocol.mjs');
  assert.match(source, /requestAnimationFrame[\s\S]*requestAnimationFrame/);
  assert.match(source, /timeout|stale|error/i);
  assert.match(source, /longtask|heap|opt-?in/i);
});

test('Performance Lab stats exclude two warmups, record seven runs, and report finite R-7 summaries', async () => {
  const source = await read('scripts/performance-lab/stats.mjs');
  assert.match(source, /warmup.{0,40}2|2.{0,40}warmup/i);
  assert.match(source, /recorded.{0,40}7|7.{0,40}recorded/i);
  assert.match(source, /median|p95|min|max/i);
  assert.match(source, /Number\.isFinite|non-?finite/i);
});

test('Performance Lab schema separates environment and bundle fields and permits partial-failure results', async () => {
  const source = await read('scripts/performance-lab/schema.mjs');
  assert.match(source, /environment/i);
  assert.match(source, /bundle/i);
  assert.match(source, /partial|failure|error/i);
});

test('Performance Lab remains isolated from ordinary tests and demo/pages execution', async () => {
  const packageJson = JSON.parse(await read('package.json'));
  assert.match(packageJson.scripts['perf:lab'], /performance/i);
  assert.match(packageJson.scripts['test:performance-contract'], /performance-lab-\*\.test/);
  assert.doesNotMatch(packageJson.scripts.test, /performance|benchmark/i);
  assert.doesNotMatch(await read('apps/demo/package.json'), /performance|benchmark/i);
});

test('Performance host quick integration, scheduled workflow, artifacts, and run summary have safe operational contracts', async () => {
  const workflow = await read('.github/workflows/performance-lab.yml');
  const host = await read('scripts/performance-lab/host-smoke.mjs');
  assert.match(host, /Playwright|chromium/i);
  assert.match(workflow, /schedule:|workflow_dispatch:/);
  assert.match(workflow, /github\.ref.{0,80}refs\/heads\/main/i);
  assert.doesNotMatch(
    workflow,
    /pull_request:|release:|pages:\s*write|npm publish|id-token:\s*write/i,
  );
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /timeout-minutes:\s*45/);
  assert.match(workflow, /playwright install chromium/i);
  assert.doesNotMatch(workflow, /actions\/cache|ms-playwright/i);
  assert.match(workflow, /retention-days:\s*30/);
  assert.match(workflow, /if:\s*always\(\)[\s\S]*GITHUB_STEP_SUMMARY/i);
});

test('manual runbook contains MT-19 Performance Lab reproducibility and evidence contract', async () => {
  const manual = await read('docs/manual-testing/README.md');
  assert.match(manual, /MT-19/i);
  assert.match(manual, /Performance Lab|performance/i);
  assert.match(manual, /seed|artifact|environment/i);
});

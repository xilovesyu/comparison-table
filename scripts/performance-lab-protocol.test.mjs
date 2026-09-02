import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createCatalog, createScenario, verifySemanticOracle } from './performance-lab/catalog.mjs';
import { afterTwoAnimationFrames } from './performance-lab/protocol.mjs';
import { createResultDocument, validateResultDocument } from './performance-lab/schema.mjs';
import { summarizeR7 } from './performance-lab/stats.mjs';
import { runPerformanceLab } from './performance-lab/run.mjs';

test('R-7 uses the specified linear interpolation for p50, p95, min, and max', () => {
  assert.deepEqual(summarizeR7([1, 2, 3, 4, 5, 6, 7]), {
    min: 1,
    median: 4,
    p95: 6.7,
    max: 7,
  });
});

test('malformed measurement marker is converted to a schema-valid measurement partial before persistence', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'comparison-table-marker-partial-'));
  try {
    await assert.rejects(
      runPerformanceLab({
        quick: true,
        output: path.join(directory, 'marker.json'),
        stages: {
          measurement: () => ({
            result: {
              status: 'ok', durationMs: Number.NaN,
              dataBuild: { durationMs: 1, transactionStart: 'browser-event' },
              observation: { tablePresent: true, versionColumns: 2, rowCount: 1, text: '' },
            },
            operations: {},
          }),
        },
      }),
      async (error) => {
        const persisted = JSON.parse(await readFile(error.outputPath, 'utf8'));
        assert.equal(validateResultDocument(persisted).status, 'partial');
        assert.match(persisted.failures[0]?.category ?? '', /protocol|measurement/);
        assert.equal(persisted.results[0]?.status, 'partial');
        return true;
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('two-RAF protocol observes long tasks by default and completes only after two consecutive frames', async () => {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousObserver = globalThis.PerformanceObserver;
  const queued = [];
  let observed = 0;
  globalThis.requestAnimationFrame = (callback) => {
    queued.push(callback);
    return queued.length;
  };
  globalThis.PerformanceObserver = class {
    constructor() {
      observed += 1;
    }
    observe() {}
    disconnect() {}
  };
  try {
    const pending = afterTwoAnimationFrames({ token: 1, currentToken: () => 1 });
    assert.equal(queued.length, 1, 'the first frame is scheduled after React commit');
    queued.shift()(0);
    assert.equal(queued.length, 1, 'the second frame is consecutive, not parallel');
    queued.shift()(16);
    const result = await pending;
    assert.equal(result.status, 'ok');
    assert.ok(observed > 0, 'long-task observation is enabled unless explicitly disabled');
    assert.deepEqual(result.telemetry.longtasks, []);
  } finally {
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.PerformanceObserver = previousObserver;
  }
});

test('catalog provides independently checkable expectations for edge data, keyed presence, and interaction final states', () => {
  const catalog = createCatalog();
  assert.equal(catalog.length, 21);
  for (const caseId of [
    'null-missing-own-undefined',
    'text-10240-query',
    'depth-20',
    'wide-1000',
    'large-keyed-1024',
  ]) {
    assert.ok(
      catalog.some((scenario) => scenario.caseId === caseId),
      `missing ${caseId}`,
    );
  }
  const keyed = createScenario('keyed-presence', 'three-version');
  assert.deepEqual(keyed.expected.keyedIdentity, {
    unchanged: 'SKU-0000',
    modified: 'SKU-0002',
    added: 'ADDED-ALL',
    removed: 'SKU-0001',
    middleMissing: 'SKU-0001',
  });
  assert.deepEqual(keyed.expected.operations, [
    'global-search',
    'only-differences',
    'expand-collapse',
    'node-search',
    'controlled-expansion',
  ]);
});

test('semantic oracle validates each real ARIA operation with raw duration and row/cell evidence', () => {
  const expected = {
    versionColumns: 2,
    semantic: 'populated',
    textIncludes: [],
    operations: ['global-search', 'only-differences'],
  };
  const observation = {
    tablePresent: true,
    versionColumns: 2,
    rowCount: 1,
    text: 'SKU-0000',
    operations: {
      'global-search': { durationMs: 1, rowCount: 1, cellCount: 2, ariaPassed: true },
      'only-differences': { durationMs: 2, rowCount: 1, cellCount: 2, ariaPassed: true },
    },
  };
  assert.equal(verifySemanticOracle(observation, expected), true);
  assert.throws(
    () => verifySemanticOracle({ ...observation, operations: {} }, expected),
    /global-search/,
  );
});

test('result schema rejects incomplete bundle partitions and incomplete runtime environment metadata', () => {
  const result = createResultDocument({
    catalog: { version: 1 },
    seed: 20260902,
    environment: { platform: 'win32' },
    bundle: { host: { raw: 1 } },
    results: [],
    failures: [
      { scenarioId: 'build', category: 'build', error: 'build failed' },
      { scenarioId: 'preview', category: 'preview', error: 'preview failed' },
      { scenarioId: 'goto', category: 'goto', error: 'goto failed' },
      { scenarioId: 'protocol', category: 'protocol', error: 'protocol failed' },
      { scenarioId: 'measurement', category: 'measurement', error: 'measurement failed' },
      { scenarioId: 'report', category: 'report', error: 'report failed' },
      { scenarioId: 'infrastructure', category: 'infrastructure', error: 'infra failed' },
    ],
  });
  assert.throws(
    () => validateResultDocument(result),
    /bundle|environment|gzip|brotli|pnpm|viewport/i,
  );
});

test('production host quick run records ARIA operation metrics before reporting a semantic success', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'comparison-table-performance-'));
  try {
    const { document } = await runPerformanceLab({
      quick: true,
      output: path.join(temporaryDirectory, 'result.json'),
    });
    const result = document.results[0];
    assert.equal(result.start?.source, 'react-event-handler');
    assert.match(result.end?.source ?? '', /two-raf|browser-raf/);
    assert.ok(result.start.at < result.end.at);
    assert.notEqual(result.dataBuild.token, result.phases.render.token);
    assert.notEqual(result.phases.render.token, result.phases.oracle.token);
    assert.notEqual(result.phases.oracle.token, result.phases.twoRaf.token);
    for (const operation of [
      'global-search',
      'only-differences',
      'expand-collapse',
      'node-search',
      'controlled-expansion',
    ]) {
      const metric = result.operations?.[operation];
      assert.equal(metric?.ariaPassed, true, `${operation} ARIA semantic oracle`);
      assert.ok(metric.rowCount >= 0, `${operation} raw row count`);
      assert.ok(metric.cellCount >= 0, `${operation} raw cell count`);
      assert.ok(Number.isFinite(metric.durationMs), `${operation} raw duration`);
      assert.equal(metric.start?.source, 'react-event-handler', `${operation} React start`);
      assert.match(metric.end?.source ?? '', /two-raf|browser-raf/, `${operation} RAF end`);
      assert.ok(metric.start.at < metric.end.at, `${operation} marker order`);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('all manifest pressure profiles schedule browser data-build and the full ARIA operation set', () => {
  const pressureCases = new Set(['wide-1000', 'depth-20', 'large-keyed-1024']);
  const requiredOperations = [
    'global-search',
    'only-differences',
    'expand-collapse',
    'node-search',
    'controlled-expansion',
  ];
  for (const scenario of createCatalog().filter((item) => pressureCases.has(item.caseId))) {
    assert.deepEqual(
      scenario.expected.operations,
      requiredOperations,
      `${scenario.id} must execute every browser operation`,
    );
    assert.equal(scenario.expected.dataBuild?.location, 'browser');
    assert.equal(scenario.expected.dataBuild?.seed, scenario.seed);
  }
});

test('keyed fixture has a real v1-present/v2-missing/v3-present identity and public-oracle expectations', () => {
  const scenario = createScenario('keyed-presence', 'three-version');
  const availability = scenario.versions.map((version) =>
    version.data.lines.some((line) => line.sku === 'SKU-0001'),
  );
  assert.deepEqual(availability, [true, false, true]);
  assert.deepEqual(scenario.expected.publicOracle, {
    ownUndefined: { path: 'undefinedValue', versionId: 'v1', hasOwn: true },
    query: { path: 'longText', value: 'PERFORMANCE-QUERY' },
    keyedIdentity: scenario.expected.keyedIdentity,
    filters: ['search', 'differences'],
  });
});

test('result schema retains seven operation samples and rejects nonfinite operation durations', () => {
  const document = createResultDocument({
    catalog: { version: 1 },
    seed: 20260902,
    environment: {
      platform: 'win32',
      architecture: 'x64',
      release: 'x',
      cpuModel: 'x',
      cpuCount: 1,
      totalMemoryBytes: 1,
      node: 'x',
      pnpm: 'x',
      browser: 'x',
      viewport: { width: 1, height: 1 },
      deviceScaleFactor: 1,
      headless: true,
      commit: 'x',
    },
    bundle: {
      library: { raw: 1, gzip: 1, brotli: 1 },
      demo: { raw: 1, gzip: 1, brotli: 1 },
      host: { raw: 1, gzip: 1, brotli: 1 },
    },
    results: [
      {
        scenarioId: 'wide-1000--eight-version',
        dataBuild: { durationMs: 1, transactionStart: 'browser-event' },
        operationSamples: {
          'global-search': Array.from({ length: 7 }, () => ({
            durationMs: 1,
            rowCount: 1,
            cellCount: 1,
          })),
        },
      },
    ],
    failures: [{ scenarioId: 'fixture', category: 'fixture', error: 'schema partial fixture' }],
  });
  assert.equal(validateResultDocument(document).status, 'partial');
  assert.equal(document.results[0].dataBuild.transactionStart, 'browser-event');
  assert.equal(document.results[0].operationSamples['global-search'].length, 7);
  assert.deepEqual(
    summarizeR7(
      document.results[0].operationSamples['global-search'].map((item) => item.durationMs),
    ),
    {
      min: 1,
      median: 1,
      p95: 1,
      max: 1,
    },
  );
  const nonfinite = structuredClone(document);
  nonfinite.results[0].operationSamples['global-search'][0].durationMs = Number.NaN;
  assert.throws(() => validateResultDocument(nonfinite), /non-?finite|measurement/i);
});

test('runner exposes only stages injection and rejects legacy injection aliases before work starts', async () => {
  await assert.rejects(
    runPerformanceLab({
      quick: true,
      injections: { catalog: () => [] },
    }),
    /stages.*only|injections.*unsupported/i,
  );
});

test('60 operation expectations require event-to-RAF markers and non-overlapping phase tokens', () => {
  const profiles = ['two-version', 'three-version', 'eight-version'];
  const categories = ['depth-20', 'wide-1000', 'large-keyed-1024', 'keyed-presence'];
  const operations = [
    'global-search',
    'only-differences',
    'expand-collapse',
    'node-search',
    'controlled-expansion',
  ];
  const expectedEntries = categories.length * profiles.length * operations.length;
  assert.equal(expectedEntries, 60);
  const matrix = createCatalog().flatMap((scenario) => scenario.expected.operationMarkers ?? []);
  assert.equal(matrix.length, expectedEntries);
  for (const entry of matrix) {
    assert.equal(entry.start.source, 'react-event-handler');
    assert.match(entry.end.source, /two-raf|browser-raf/);
    assert.notEqual(entry.dataBuild.token, entry.render.token);
    assert.notEqual(entry.render.token, entry.oracle.token);
    assert.notEqual(entry.oracle.token, entry.twoRaf.token);
  }
});

test('catalog marker expectations end each operation in the final two-RAF callback', () => {
  const entries = createCatalog().flatMap((scenario) => scenario.expected.operationMarkers ?? []);
  assert.equal(entries.length, 60);
  for (const entry of entries) {
    assert.equal(entry.start.source, 'react-event-handler');
    assert.match(entry.end.source, /two-raf|browser-raf/);
    assert.ok(entry.start.at < entry.end.at);
  }
});

test('stages injection writes an observed schema-valid partial artifact for catalog failure', async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'comparison-table-stage-failure-'),
  );
  try {
    await assert.rejects(
      runPerformanceLab({
        quick: true,
        output: path.join(temporaryDirectory, 'partial.json'),
        stages: {
          catalog: () => {
            throw new Error('catalog injected');
          },
        },
      }),
      (error) =>
        error.document?.status === 'partial' && error.document.failures[0]?.category === 'catalog',
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('the single stages hook observes environment, measurement, and report failures in one atomic partial artifact', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'comparison-table-stages-'));
  let fallbackPath;
  try {
    await assert.rejects(
      runPerformanceLab({
        quick: true,
        output: path.join(temporaryDirectory, 'partial.json'),
        stages: {
          environment: () => {
            throw new Error('environment injected');
          },
          measurement: () => {
            throw new Error('measurement injected');
          },
          report: () => {
            throw new Error('report injected');
          },
        },
      }),
      (error) => {
        fallbackPath = error.outputPath;
        assert.deepEqual(
          error.document?.failures.map((failure) => failure.category),
          ['environment', 'measurement', 'report'],
        );
        return true;
      },
    );
    const artifact = JSON.parse(await readFile(fallbackPath, 'utf8'));
    assert.equal(validateResultDocument(artifact).status, 'partial');
    assert.deepEqual(
      artifact.failures.map((failure) => failure.category),
      ['environment', 'measurement', 'report'],
    );
  } finally {
    if (fallbackPath) await rm(fallbackPath, { force: true });
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

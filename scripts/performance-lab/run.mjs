import { chromium } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { build, preview } from 'vite';
import { createCatalog, performanceLabManifest, verifySemanticOracle } from './catalog.mjs';
import { createResultDocument, validateResultDocument } from './schema.mjs';
import { latinRotation, RECORDED_RUNS, summarizeR7, WARMUP_RUNS } from './stats.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configFile = path.join(root, 'scripts/performance-lab/vite.config.mjs');
const distDirectory = path.join(root, '.performance-lab/dist');
const viewport = { width: 1440, height: 1000 };

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function availablePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) =>
    socket.listen(0, '127.0.0.1', resolve).once('error', reject),
  );
  const address = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  return address.port;
}

async function visitFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else files.push(absolute);
    }
  }
  await visit(directory);
  return files.sort();
}

async function compressedPartition(directory) {
  const contents = await Promise.all((await visitFiles(directory)).map((file) => readFile(file)));
  const combined = Buffer.concat(contents);
  return {
    raw: combined.byteLength,
    gzip: gzipSync(combined).byteLength,
    brotli: brotliCompressSync(combined).byteLength,
  };
}

const emptyBundle = () => ({
  library: { raw: 0, gzip: 0, brotli: 0 },
  demo: { raw: 0, gzip: 0, brotli: 0 },
  host: { raw: 0, gzip: 0, brotli: 0 },
});

async function bundleMetadata() {
  return {
    library: await compressedPartition(path.join(root, 'packages/comparison-table/dist')),
    demo: await compressedPartition(path.join(root, 'apps/demo/dist')),
    host: await compressedPartition(distDirectory),
  };
}

async function runPnpm(args) {
  const pnpmEntrypoint = process.env.npm_execpath;
  const executableEntrypoint = pnpmEntrypoint?.toLowerCase().endsWith('.exe');
  const pnpmHomeExecutable =
    process.platform === 'win32' && process.env.PNPM_HOME
      ? path.join(process.env.PNPM_HOME, 'pnpm.exe')
      : undefined;
  const command = executableEntrypoint
    ? pnpmEntrypoint
    : pnpmHomeExecutable
      ? pnpmHomeExecutable
      : pnpmEntrypoint
        ? process.execPath
        : process.platform === 'win32'
          ? 'pnpm.cmd'
          : 'pnpm';
  const commandArgs = pnpmEntrypoint && !executableEntrypoint ? [pnpmEntrypoint, ...args] : args;
  return execFileAsync(command, commandArgs, {
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}

async function pnpmVersion() {
  try {
    return (await runPnpm(['--version'])).stdout.trim();
  } catch {
    return 'unavailable';
  }
}

async function environmentMetadata(browser = 'unavailable') {
  return {
    platform: process.platform,
    architecture: process.arch,
    release: os.release(),
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    node: process.version,
    pnpm: await pnpmVersion(),
    browser,
    viewport,
    deviceScaleFactor: 1,
    headless: true,
    commit: process.env.GITHUB_SHA ?? 'local',
  };
}

async function atomicWrite(outputPath, document) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, outputPath);
}

async function tableEvidence(page, ariaPassed) {
  const section = page.locator('[aria-label="Recursive comparison table"]');
  return {
    ariaPassed,
    rowCount: await section.locator('tbody tr[data-row-key]').count(),
    cellCount: await section.locator('tbody td').count(),
  };
}

async function measureOperation(page, { action, verify, cleanup }) {
  const startedAt = await page.evaluate(() => performance.now());
  await action();
  const evidence = await tableEvidence(page, await verify());
  await page.evaluate(() => window.performanceLab.settle());
  const finishedAt = await page.evaluate(() => performance.now());
  await cleanup?.();
  if (cleanup) await page.evaluate(() => window.performanceLab.settle());
  return { durationMs: finishedAt - startedAt, ...evidence };
}

async function runOperations(page, expected) {
  const operations = {};
  const search = page.getByLabel('Search comparison');
  const differenceSwitch = page.getByRole('switch', { name: 'Only show differences' });
  const expandButton = () => page.locator('button.ant-table-row-expand-icon').first();
  const nodeSearchButton = page.getByRole('button', {
    name: 'Search within lines[SKU-0000]',
  });
  const nodeSearch = page.getByLabel('Filter lines[SKU-0000] children');

  for (const operation of expected.operations ?? []) {
    if (operation === 'global-search') {
      operations[operation] = await measureOperation(page, {
        action: () => search.fill('SKU-0000'),
        verify: async () =>
          (await search.getAttribute('aria-label')) === 'Search comparison' &&
          (await search.inputValue()) === 'SKU-0000',
        cleanup: () => search.fill(expected.operationFinalState.globalQuery),
      });
    } else if (operation === 'only-differences') {
      operations[operation] = await measureOperation(page, {
        action: () => differenceSwitch.click(),
        verify: async () => (await differenceSwitch.getAttribute('aria-checked')) === 'true',
        cleanup: async () => {
          if ((await differenceSwitch.getAttribute('aria-checked')) === 'true') {
            await differenceSwitch.click();
          }
        },
      });
    } else if (operation === 'expand-collapse') {
      operations[operation] = await measureOperation(page, {
        action: () => expandButton().click(),
        verify: async () => (await expandButton().getAttribute('aria-expanded')) === 'false',
        cleanup: () => expandButton().click(),
      });
    } else if (operation === 'node-search') {
      operations[operation] = await measureOperation(page, {
        action: async () => {
          await nodeSearchButton.click();
          await nodeSearch.fill('quantity');
        },
        verify: async () =>
          (await nodeSearch.getAttribute('aria-label')) === 'Filter lines[SKU-0000] children' &&
          (await nodeSearch.inputValue()) === 'quantity',
        cleanup: async () => {
          await nodeSearch.fill(expected.operationFinalState.nodeQuery);
          await nodeSearchButton.click();
        },
      });
    } else if (operation === 'controlled-expansion') {
      const before = Number(
        (await page.locator('main').getAttribute('data-controlled-expansion-count')) ?? 0,
      );
      operations[operation] = await measureOperation(page, {
        action: () => expandButton().click(),
        verify: async () =>
          Number(
            (await page.locator('main').getAttribute('data-controlled-expansion-count')) ?? 0,
          ) > before && (await expandButton().getAttribute('aria-expanded')) === 'false',
        cleanup: () => expandButton().click(),
      });
    }
  }

  const finalState = expected.operationFinalState;
  if (finalState) {
    const nodeQuery = (await nodeSearch.count()) === 0 ? '' : await nodeSearch.inputValue();
    const controlledExpansion =
      Number((await page.locator('main').getAttribute('data-controlled-expansion-count')) ?? 0) > 0;
    const finalStateMatches =
      (await search.inputValue()) === finalState.globalQuery &&
      ((await differenceSwitch.getAttribute('aria-checked')) === 'true') ===
        finalState.onlyDifferences &&
      ((await expandButton().getAttribute('aria-expanded')) === 'true') ===
        finalState.linesExpanded &&
      nodeQuery === finalState.nodeQuery &&
      controlledExpansion === finalState.controlledExpansion;
    if (!finalStateMatches)
      throw new Error('Operation cleanup did not restore the catalog final state');
  }
  return operations;
}

function failure(scenarioId, category, error) {
  return { scenarioId, category, error };
}

async function measureScenario({ page, scenario, telemetry }) {
  const result = await page.evaluate(
    ({ input, telemetry: browserTelemetry }) =>
      window.performanceLab.run(input, { telemetry: browserTelemetry }),
    {
      input: {
        caseId: scenario.caseId,
        profile: scenario.profile,
        seed: scenario.seed,
      },
      telemetry,
    },
  );
  if (result.status !== 'ok') {
    throw Object.assign(
      new Error(
        `Protocol ${result.category ?? result.status}${result.error ? `: ${result.error}` : ''}`,
      ),
      { category: result.category ?? 'protocol' },
    );
  }
  verifySemanticOracle(result.observation, { ...scenario.expected, operations: [] });
  const operations = await runOperations(page, scenario.expected);
  verifySemanticOracle({ ...result.observation, operations }, scenario.expected);
  if (
    !Number.isFinite(result.dataBuild?.durationMs) ||
    result.dataBuild.transactionStart !== 'browser-event'
  ) {
    throw new Error('Browser data-build transaction did not produce a finite measurement');
  }
  return { operations, result };
}

function validateMeasuredScenario({ operations, result }, scenario) {
  if (!Number.isFinite(result?.durationMs)) {
    throw new Error('Measurement produced a nonfinite render duration');
  }
  if (
    !Number.isFinite(result.dataBuild?.durationMs) ||
    result.dataBuild.transactionStart !== 'browser-event'
  ) {
    throw new Error('Browser data-build transaction did not produce a finite measurement');
  }
  verifySemanticOracle({ ...result.observation, operations }, scenario.expected);
}

function summarizeMeasurements(summarize, values) {
  const summary = summarize(values);
  if (['min', 'median', 'p95', 'max'].some((field) => !Number.isFinite(summary?.[field]))) {
    throw new Error('Measurement summarizer produced a nonfinite R-7 statistic');
  }
  return summary;
}

function stageOverrides(options) {
  return options.stages ?? options.injections ?? options.adapters ?? {};
}

export async function runPerformanceLab(options = {}) {
  const { quick = false, output } = options;
  const overrides = stageOverrides(options);
  const seed = Number(argument('--seed', String(performanceLabManifest.seed)));
  const requestedOutputPath = path.resolve(
    root,
    output ?? argument('--output', '.performance-lab/results/performance-lab.v1.json'),
  );
  const failures = [];
  let catalog = [];
  try {
    const generatedCatalog = await (overrides.catalog ?? createCatalog)(seed);
    catalog = quick
      ? [generatedCatalog.find((scenario) => scenario.id === 'keyed-presence--two-version')].filter(
          Boolean,
        )
      : generatedCatalog;
    if (quick && catalog.length !== 1)
      throw new Error('Quick scenario is missing from the catalog');
  } catch (error) {
    failures.push(failure('catalog', 'catalog', error));
  }
  const telemetry = {
    longtask: !process.argv.includes('--no-longtask'),
    heap: process.argv.includes('--heap'),
  };
  const samples = new Map(catalog.map((scenario) => [scenario.id, []]));
  const operationSamples = new Map(
    catalog.map((scenario) => [
      scenario.id,
      Object.fromEntries((scenario.expected.operations ?? []).map((operation) => [operation, []])),
    ]),
  );
  const dataBuildSamples = new Map(catalog.map((scenario) => [scenario.id, []]));
  const latestDataBuild = new Map();
  const latestOperations = new Map();
  const latestObservations = new Map();
  const telemetryByScenario = new Map(catalog.map((scenario) => [scenario.id, []]));
  let bundle = emptyBundle();
  let environment = await environmentMetadata();
  let server;
  let browser;
  let page;
  let stage = 'build';

  try {
    if (catalog.length === 0)
      throw Object.assign(new Error('Catalog stage failed'), { handled: true });
    await runPnpm(['build']);
    await build({ configFile, logLevel: quick ? 'silent' : 'info' });
    bundle = await bundleMetadata();
    stage = 'preview';
    const port = await availablePort();
    server = await preview({
      configFile,
      preview: { host: '127.0.0.1', port, strictPort: true },
      logLevel: 'silent',
    });
    stage = 'infrastructure';
    browser = await chromium.launch({ headless: true });
    try {
      environment = await (overrides.environment ?? environmentMetadata)(
        `Chromium ${browser.version()}`,
      );
    } catch (error) {
      failures.push(failure('environment', 'environment', error));
      environment = await environmentMetadata(`Chromium ${browser.version()}`);
    }
    page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    stage = 'goto';
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.documentElement.dataset.performanceLabReady === 'true',
    );

    const rounds = quick ? 1 : WARMUP_RUNS + RECORDED_RUNS;
    for (let round = 0; round < rounds; round += 1) {
      for (const scenario of latinRotation(catalog, round)) {
        stage = 'protocol';
        try {
          stage = 'measurement';
          const measured = await (overrides.measurement ?? measureScenario)({
            page,
            scenario,
            telemetry,
          });
          validateMeasuredScenario(measured, scenario);
          const { operations, result } = measured;
          latestObservations.set(scenario.id, result.observation);
          latestOperations.set(scenario.id, operations);
          latestDataBuild.set(scenario.id, result.dataBuild);
          if (!quick && round >= WARMUP_RUNS) {
            samples.get(scenario.id).push(result.durationMs);
            dataBuildSamples.get(scenario.id).push(result.dataBuild.durationMs);
            for (const [name, metric] of Object.entries(operations)) {
              operationSamples.get(scenario.id)[name].push(metric);
            }
          }
          telemetryByScenario.get(scenario.id).push(result.telemetry);
        } catch (error) {
          failures.push(failure(scenario.id, error.category ?? stage, error));
        }
      }
    }
  } catch (error) {
    if (!error.handled) failures.push(failure(stage, stage, error));
  } finally {
    for (const resource of [page, browser, server]) {
      try {
        await resource?.close();
      } catch (error) {
        failures.push(failure('infrastructure', 'infrastructure', error));
      }
    }
  }

  const results = catalog.map((scenario) => {
    const recorded = samples.get(scenario.id);
    if (quick) {
      return {
        scenarioId: scenario.id,
        status: latestOperations.has(scenario.id) ? 'ok' : 'partial',
        quick: true,
        observation: latestObservations.get(scenario.id),
        operations: latestOperations.get(scenario.id),
        dataBuild: latestDataBuild.get(scenario.id),
      };
    }
    if (recorded.length !== RECORDED_RUNS) {
      failures.push(
        failure(
          scenario.id,
          'measurement',
          new Error(`Expected ${RECORDED_RUNS} recorded runs, got ${recorded.length}`),
        ),
      );
      return { scenarioId: scenario.id, status: 'partial', samples: recorded };
    }
    try {
      const summarize = overrides.summarize ?? summarizeR7;
      return {
        scenarioId: scenario.id,
        status: 'ok',
        samples: recorded,
        summary: summarizeMeasurements(summarize, recorded),
        dataBuild: latestDataBuild.get(scenario.id),
        dataBuildSamples: dataBuildSamples.get(scenario.id),
        dataBuildSummary: summarizeMeasurements(summarize, dataBuildSamples.get(scenario.id)),
        operations: latestOperations.get(scenario.id),
        operationSamples: operationSamples.get(scenario.id),
        operationSummaries: Object.fromEntries(
          Object.entries(operationSamples.get(scenario.id)).map(([name, metrics]) => [
            name,
            {
              duration: summarizeMeasurements(
                summarize,
                metrics.map((metric) => metric.durationMs),
              ),
              rowCount: metrics.at(-1)?.rowCount,
              cellCount: metrics.at(-1)?.cellCount,
            },
          ]),
        ),
        telemetry: telemetryByScenario.get(scenario.id),
      };
    } catch (error) {
      failures.push(failure(scenario.id, 'measurement', error));
      return { scenarioId: scenario.id, status: 'partial', samples: recorded };
    }
  });

  const catalogMetadata = {
    version: performanceLabManifest.version,
    profiles: performanceLabManifest.profiles,
    cases: performanceLabManifest.cases,
  };
  let document = createResultDocument({
    catalog: catalogMetadata,
    environment,
    bundle,
    seed,
    results,
    failures,
  });
  let outputPath = requestedOutputPath;
  try {
    validateResultDocument(document);
    await (overrides.report ?? atomicWrite)(outputPath, document);
  } catch (error) {
    failures.push(failure('report', 'report', error));
    document = createResultDocument({
      catalog: catalogMetadata,
      environment,
      bundle,
      seed,
      results,
      failures,
    });
    validateResultDocument(document);
    outputPath = path.join(
      root,
      `.performance-lab/results/report-failure-${process.pid}-${Date.now()}.json`,
    );
    await atomicWrite(outputPath, document);
  }

  if (failures.length > 0) {
    const error = new Error(`Performance Lab recorded ${failures.length} failure(s)`);
    error.document = document;
    error.outputPath = outputPath;
    throw error;
  }
  return { document, outputPath };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { document, outputPath } = await runPerformanceLab();
  process.stdout.write(
    `${JSON.stringify({ status: document.status, scenarios: document.results.length, output: outputPath })}\n`,
  );
}

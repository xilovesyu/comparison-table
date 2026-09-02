import { chromium } from '@playwright/test';
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { createCatalog, performanceLabManifest, verifySemanticOracle } from './catalog.mjs';
import { createResultDocument, validateResultDocument } from './schema.mjs';
import { latinRotation, RECORDED_RUNS, summarizeR7, WARMUP_RUNS } from './stats.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const configFile = path.join(root, 'scripts/performance-lab/vite.config.mjs');
const distDirectory = path.join(root, '.performance-lab/dist');

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, '127.0.0.1', resolve).once('error', reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function bundleMetadata() {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else {
        const details = await stat(absolute);
        files.push({
          path: path.relative(distDirectory, absolute).replaceAll('\\', '/'),
          bytes: details.size,
        });
      }
    }
  }
  await visit(distDirectory);
  return {
    files,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    javascriptBytes: files
      .filter((file) => file.path.endsWith('.js'))
      .reduce((sum, file) => sum + file.bytes, 0),
    cssBytes: files
      .filter((file) => file.path.endsWith('.css'))
      .reduce((sum, file) => sum + file.bytes, 0),
  };
}

function environmentMetadata(browserVersion) {
  return {
    platform: process.platform,
    architecture: process.arch,
    release: os.release(),
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    node: process.version,
    browser: `Chromium ${browserVersion}`,
    commit: process.env.GITHUB_SHA ?? 'local',
  };
}

export async function runPerformanceLab({ quick = false, output } = {}) {
  const seed = Number(argument('--seed', String(performanceLabManifest.seed)));
  const outputPath = path.resolve(
    root,
    output ?? argument('--output', '.performance-lab/results/performance-lab.v1.json'),
  );
  const telemetry = {
    longtask: process.argv.includes('--longtask'),
    heap: process.argv.includes('--heap'),
  };
  const catalog = quick
    ? [createCatalog(seed).find((scenario) => scenario.id === 'keyed-presence--two-version')]
    : createCatalog(seed);
  await build({ configFile, logLevel: quick ? 'silent' : 'info' });
  const bundle = await bundleMetadata();
  const port = await availablePort();
  const server = await preview({
    configFile,
    preview: { host: '127.0.0.1', port, strictPort: true },
    logLevel: 'silent',
  });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const samples = new Map(catalog.map((scenario) => [scenario.id, []]));
  const telemetryByScenario = new Map(catalog.map((scenario) => [scenario.id, []]));
  const failures = [];
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => document.documentElement.dataset.performanceLabReady === 'true',
    );
    const rounds = quick ? 1 : WARMUP_RUNS + RECORDED_RUNS;
    for (let round = 0; round < rounds; round += 1) {
      for (const scenario of latinRotation(catalog, round)) {
        try {
          const result = await page.evaluate(
            ({ scenario, telemetry }) => window.performanceLab.run(scenario, { telemetry }),
            { scenario, telemetry },
          );
          if (result.status !== 'ok')
            throw new Error(`Protocol ${result.category ?? result.status}`);
          verifySemanticOracle(result.observation, scenario.expected);
          if (!quick && round >= WARMUP_RUNS) samples.get(scenario.id).push(result.durationMs);
          telemetryByScenario.get(scenario.id).push(result.telemetry);
        } catch (error) {
          failures.push({ scenarioId: scenario.id, category: 'error', error });
        }
      }
    }
    const results = quick
      ? catalog.map((scenario) => ({ scenarioId: scenario.id, status: 'ok', quick: true }))
      : catalog.map((scenario) => {
          const recorded = samples.get(scenario.id);
          if (recorded.length !== RECORDED_RUNS) {
            failures.push({
              scenarioId: scenario.id,
              category: 'partial',
              error: `Expected ${RECORDED_RUNS} recorded runs, got ${recorded.length}`,
            });
            return { scenarioId: scenario.id, status: 'partial', samples: recorded };
          }
          return {
            scenarioId: scenario.id,
            status: 'ok',
            samples: recorded,
            summary: summarizeR7(recorded),
            telemetry: telemetryByScenario.get(scenario.id),
          };
        });
    const document = validateResultDocument(
      createResultDocument({
        catalog: {
          manifestVersion: performanceLabManifest.version,
          profiles: performanceLabManifest.profiles,
          cases: performanceLabManifest.cases,
        },
        environment: environmentMetadata(browser.version()),
        bundle,
        seed,
        results,
        failures,
      }),
    );
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    if (failures.length > 0)
      throw new Error(`Performance Lab recorded ${failures.length} failure(s)`);
    return { document, outputPath };
  } finally {
    await page.close();
    await browser.close();
    await server.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { document, outputPath } = await runPerformanceLab();
  process.stdout.write(
    `${JSON.stringify({ status: document.status, scenarios: document.results.length, output: outputPath })}\n`,
  );
}

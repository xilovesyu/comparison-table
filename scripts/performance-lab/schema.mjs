export const PERFORMANCE_RESULT_VERSION = 1;

function finiteMeasurement(value, label) {
  if (!Number.isFinite(value)) throw new Error(`Nonfinite measurement: ${label}`);
}

function transactionPhases(marker) {
  return {
    dataBuild: marker?.dataBuild,
    render: marker?.phases?.render ?? marker?.render,
    oracle: marker?.phases?.oracle ?? marker?.oracle,
    twoRaf: marker?.phases?.twoRaf ?? marker?.twoRaf,
  };
}

export function validateTransactionMarker(marker, label = 'transaction') {
  if (marker?.start?.source !== 'react-event-handler') {
    throw new Error(`Invalid transaction start marker: ${label}`);
  }
  if (!['two-raf', 'browser-raf'].includes(marker?.end?.source)) {
    throw new Error(`Invalid transaction end marker: ${label}`);
  }
  finiteMeasurement(marker.start.at, `${label}.start.at`);
  finiteMeasurement(marker.end.at, `${label}.end.at`);
  if (marker.start.at >= marker.end.at) {
    throw new Error(`Invalid transaction marker order: ${label}`);
  }

  const phases = transactionPhases(marker);
  const tokens = Object.values(phases).map((phase) => phase?.token);
  if (tokens.some((token) => typeof token !== 'string') || new Set(tokens).size !== tokens.length) {
    throw new Error(`Invalid transaction phase tokens: ${label}`);
  }
  for (const [name, phase] of Object.entries(phases)) {
    finiteMeasurement(phase?.startedAt, `${label}.phases.${name}.startedAt`);
    finiteMeasurement(phase?.endedAt, `${label}.phases.${name}.endedAt`);
    finiteMeasurement(phase?.durationMs, `${label}.phases.${name}.durationMs`);
    if (phase.startedAt > phase.endedAt || phase.durationMs < 0) {
      throw new Error(`Invalid transaction phase order: ${label}.phases.${name}`);
    }
  }
  if (
    phases.dataBuild.endedAt > phases.render.startedAt ||
    phases.render.endedAt > phases.oracle.startedAt ||
    phases.oracle.endedAt > phases.twoRaf.startedAt ||
    phases.twoRaf.endedAt > marker.end.at
  ) {
    throw new Error(`Invalid transaction phase order: ${label}`);
  }
  return marker;
}

export function validateMetricMarker(metric, label = 'metric', { requireMarker = false } = {}) {
  finiteMeasurement(metric?.durationMs, `${label}.durationMs`);
  if (!Number.isInteger(metric?.rowCount) || metric.rowCount < 0) {
    throw new Error(`Invalid measurement row count: ${label}.rowCount`);
  }
  if (!Number.isInteger(metric?.cellCount) || metric.cellCount < 0) {
    throw new Error(`Invalid measurement cell count: ${label}.cellCount`);
  }
  const hasMarker = Boolean(
    metric?.start || metric?.end || metric?.render || metric?.oracle || metric?.twoRaf,
  );
  if (requireMarker || hasMarker) validateTransactionMarker(metric, label);
  return metric;
}

export function createResultDocument({ catalog, environment, bundle, seed, results, failures }) {
  const partial = failures.length > 0;
  return {
    schemaVersion: PERFORMANCE_RESULT_VERSION,
    status: partial ? 'partial' : 'complete',
    generatedAt: new Date().toISOString(),
    seed,
    catalog,
    protocol: { warmups: 2, recorded: 7, statistic: 'R-7', rotation: 'latin' },
    environment,
    bundle,
    results,
    failures: failures.map((failure) => ({
      scenarioId: failure.scenarioId,
      category: failure.category ?? 'error',
      error: String(failure.error ?? failure.message ?? failure),
    })),
  };
}

export function validateResultDocument(result) {
  if (result.schemaVersion !== PERFORMANCE_RESULT_VERSION) throw new Error('Unsupported schema');
  if (!result.catalog || !result.environment || !result.bundle)
    throw new Error('Missing catalog, environment, or bundle metadata');
  for (const field of [
    'platform',
    'architecture',
    'release',
    'cpuModel',
    'cpuCount',
    'totalMemoryBytes',
    'node',
    'pnpm',
    'browser',
    'viewport',
    'deviceScaleFactor',
    'headless',
    'commit',
  ]) {
    if (result.environment[field] === undefined) {
      throw new Error(`Missing environment field: ${field}`);
    }
  }
  if (
    !Number.isFinite(result.environment.viewport?.width) ||
    !Number.isFinite(result.environment.viewport?.height)
  ) {
    throw new Error('Environment viewport must contain finite width and height');
  }
  for (const partition of ['library', 'demo', 'host']) {
    for (const encoding of ['raw', 'gzip', 'brotli']) {
      const size = result.bundle[partition]?.[encoding];
      if (!Number.isFinite(size) || size < 0) {
        throw new Error(`Bundle ${partition}.${encoding} must be a finite byte count`);
      }
    }
  }
  if (!['complete', 'partial'].includes(result.status))
    throw new Error('Invalid partial result status');
  if (!Array.isArray(result.results) || !Array.isArray(result.failures)) {
    throw new Error('Results and failures must be arrays');
  }
  const validateSummary = (summary, label) => {
    for (const statistic of ['min', 'median', 'p95', 'max']) {
      finiteMeasurement(summary?.[statistic], `${label}.${statistic}`);
    }
  };
  for (const entry of result.results) {
    if (entry.status === 'ok') validateTransactionMarker(entry, entry.scenarioId);
    if (entry.dataBuild) {
      finiteMeasurement(entry.dataBuild.durationMs, `${entry.scenarioId}.dataBuild.durationMs`);
      if (entry.dataBuild.transactionStart !== 'browser-event') {
        throw new Error(`Invalid data-build transaction start: ${entry.scenarioId}`);
      }
    }
    for (const [name, metric] of Object.entries(entry.operations ?? {})) {
      validateMetricMarker(metric, `${entry.scenarioId}.operations.${name}`);
    }
    for (const [name, metrics] of Object.entries(entry.operationSamples ?? {})) {
      if (!Array.isArray(metrics)) {
        throw new Error(`Invalid measurement samples: ${entry.scenarioId}.${name}`);
      }
      metrics.forEach((metric, index) =>
        validateMetricMarker(metric, `${entry.scenarioId}.operationSamples.${name}[${index}]`),
      );
    }
    for (const [name, summary] of Object.entries(entry.operationSummaries ?? {})) {
      validateSummary(summary.duration, `${entry.scenarioId}.operationSummaries.${name}.duration`);
    }
    for (const [index, duration] of (entry.samples ?? []).entries()) {
      finiteMeasurement(duration, `${entry.scenarioId}.samples[${index}]`);
    }
    for (const [index, duration] of (entry.dataBuildSamples ?? []).entries()) {
      finiteMeasurement(duration, `${entry.scenarioId}.dataBuildSamples[${index}]`);
    }
    if (entry.summary) validateSummary(entry.summary, `${entry.scenarioId}.summary`);
    if (entry.dataBuildSummary) {
      validateSummary(entry.dataBuildSummary, `${entry.scenarioId}.dataBuildSummary`);
    }
  }
  return result;
}

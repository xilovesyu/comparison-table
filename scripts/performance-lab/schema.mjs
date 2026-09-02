export const PERFORMANCE_RESULT_VERSION = 1;

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
  if (!['complete', 'partial'].includes(result.status))
    throw new Error('Invalid partial result status');
  if (!Array.isArray(result.results) || !Array.isArray(result.failures)) {
    throw new Error('Results and failures must be arrays');
  }
  return result;
}

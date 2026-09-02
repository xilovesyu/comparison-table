export const WARMUP_RUNS = 2;
export const RECORDED_RUNS = 7;

export function latinRotation(items, round) {
  if (items.length === 0) return [];
  const offset = round % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarizeR7(samples) {
  if (samples.length !== RECORDED_RUNS) {
    throw new Error(`R-7 requires exactly ${RECORDED_RUNS} recorded samples`);
  }
  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error('R-7 cannot summarize a non-finite sample');
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1),
  };
}

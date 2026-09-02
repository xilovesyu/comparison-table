export const WARMUP_RUNS = 2;
export const RECORDED_RUNS = 7;

export function latinRotation(items, round) {
  if (items.length === 0) return [];
  const offset = round % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function percentile(sorted, fraction) {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const interpolated = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  return Number(interpolated.toFixed(12));
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
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1),
  };
}

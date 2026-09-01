import type { ComparisonRow, ContainerSummary } from './types';

const summariesByRows = new WeakMap<readonly ComparisonRow[], Map<string, ContainerSummary>>();

export function registerContainerSummaries(
  rows: readonly ComparisonRow[],
  summaries: Map<string, ContainerSummary>,
): void {
  summariesByRows.set(rows, summaries);
}

export function getContainerSummaries(
  rows: readonly ComparisonRow[],
): Map<string, ContainerSummary> {
  return summariesByRows.get(rows) ?? new Map();
}

export function copyComparisonRow(
  row: ComparisonRow,
  changes: Partial<ComparisonRow>,
): ComparisonRow {
  return { ...row, ...changes };
}

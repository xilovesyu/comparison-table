import type { ComparisonRow, ContainerSummary, MergeEditor } from './types';

const summariesByRows = new WeakMap<readonly ComparisonRow[], Map<string, ContainerSummary>>();
const mergeEditorsByRows = new WeakMap<
  readonly ComparisonRow[],
  Map<string, false | 'text' | 'number' | 'boolean' | MergeEditor>
>();

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

export function registerMergeEditors(
  rows: readonly ComparisonRow[],
  editors: Map<string, false | 'text' | 'number' | 'boolean' | MergeEditor>,
): void {
  mergeEditorsByRows.set(rows, editors);
}

export function getMergeEditors(
  rows: readonly ComparisonRow[],
): Map<string, false | 'text' | 'number' | 'boolean' | MergeEditor> {
  return mergeEditorsByRows.get(rows) ?? new Map();
}

export function copyComparisonRow(
  row: ComparisonRow,
  changes: Partial<ComparisonRow>,
): ComparisonRow {
  return { ...row, ...changes };
}

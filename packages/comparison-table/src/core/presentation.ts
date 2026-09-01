import type { ComparisonRow, ContainerSummary } from './types';

const summariesByRows = new WeakMap<readonly ComparisonRow[], Map<string, ContainerSummary>>();
const privatePresentationRows = new WeakSet<ComparisonRow>();

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

export function markPresentationPrivate(row: ComparisonRow): void {
  privatePresentationRows.add(row);
}

export function isPresentationPrivate(row: ComparisonRow): boolean {
  return privatePresentationRows.has(row);
}

export function copyComparisonRow(
  row: ComparisonRow,
  changes: Partial<ComparisonRow>,
): ComparisonRow {
  const copy = Object.create(Object.getPrototypeOf(row)) as ComparisonRow;
  Object.defineProperties(copy, Object.getOwnPropertyDescriptors(row));
  Object.entries(changes).forEach(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(copy, key);
    if (descriptor && !descriptor.enumerable) {
      Object.defineProperty(copy, key, { ...descriptor, value });
    } else {
      Object.assign(copy, { [key]: value });
    }
  });
  if (privatePresentationRows.has(row)) privatePresentationRows.add(copy);
  return copy;
}

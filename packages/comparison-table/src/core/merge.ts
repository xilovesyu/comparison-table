import { pathId } from './comparison';
import type {
  ComparisonRow,
  ComparisonVersion,
  MergePatch,
  MergeResolution,
  MergeResult,
  MergeSourceDecision,
  PropertyPath,
} from './types';

export function buildMergeResult<T>(
  rows: readonly ComparisonRow[],
  versions: readonly ComparisonVersion<T>[],
  resolutions: readonly MergeResolution[],
  configuredBaselineId?: string,
): MergeResult<T> {
  const baseline = versions.find((version) => version.id === configuredBaselineId) ?? versions[0];
  if (!baseline) throw new Error('Merge mode requires at least one comparison version');

  const leaves = collectLeaves(rows);
  const resolutionsByPath = new Map(
    resolutions.map((resolution) => [pathId(resolution.path), resolution]),
  );
  const versionIds = new Set(versions.map((version) => version.id));
  const mergedData = cloneValue(baseline.data);
  const resolvedPatch: MergePatch[] = [];
  const sourceDecisions: MergeSourceDecision[] = [];
  const unresolvedPaths: PropertyPath[] = [];

  leaves.forEach((row) => {
    const selected = resolutionsByPath.get(row.id);
    const explicit = selected && versionIds.has(selected.versionId) ? selected : undefined;
    const automatic = !row.hasOwnDifference;
    const versionId = explicit?.versionId ?? (automatic ? baseline.id : undefined);
    if (!versionId) {
      unresolvedPaths.push([...row.property.path]);
      return;
    }

    const value = cloneValue(row.values[versionId]);
    assignPath(mergedData, row.property.path, value);
    resolvedPatch.push({ path: [...row.property.path], versionId, value, automatic: !explicit });
    sourceDecisions.push({
      path: [...row.property.path],
      rowId: row.id,
      versionId,
      automatic: !explicit,
    });
  });

  return {
    baseVersionId: baseline.id,
    mergedData,
    resolvedPatch,
    scope: leaves.map((row) => [...row.property.path]),
    unresolvedPaths,
    isComplete: unresolvedPaths.length === 0,
    sourceDecisions,
  };
}

function collectLeaves(rows: readonly ComparisonRow[]): ComparisonRow[] {
  return rows.flatMap((row) => (row.children?.length ? collectLeaves(row.children) : [row]));
}

function assignPath(root: unknown, path: PropertyPath, value: unknown): void {
  if (!path.length || root === null || typeof root !== 'object') return;
  let target = root as Record<string | number, unknown>;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const nextKey = path[index + 1];
    const current = target[key];
    if (current === null || typeof current !== 'object') {
      target[key] = typeof nextKey === 'number' ? [] : {};
    }
    target = target[key] as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

function cloneValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  const cached = seen.get(value);
  if (cached) return cached as T;
  const clone: unknown = Array.isArray(value) ? [] : {};
  seen.set(value, clone);
  Object.entries(value).forEach(([key, child]) => {
    (clone as Record<string, unknown>)[key] = cloneValue(child, seen);
  });
  return clone as T;
}

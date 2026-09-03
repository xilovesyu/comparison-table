import type {
  ComparisonRow,
  ComparisonVersion,
  MergePatch,
  MergeResolutions,
  MergeResult,
  MergeScopeEntry,
  MergeScopeRole,
  MergeSourceDecision,
  PropertyPath,
} from './types';

export function buildMergeResult<T>(
  rows: readonly ComparisonRow[],
  versions: readonly ComparisonVersion<T>[],
  resolutions: MergeResolutions,
  configuredBaselineId?: string,
): MergeResult<T> {
  const baseline = configuredBaselineId
    ? versions.find((version) => version.id === configuredBaselineId)
    : versions[0];
  if (configuredBaselineId && !baseline) {
    throw new Error(`Unknown base version id: ${configuredBaselineId}`);
  }
  if (!baseline) throw new Error('Merge mode requires at least one comparison version');

  const leaves = collectLeaves(rows);
  const versionIds = new Set(versions.map((version) => version.id));
  const mergedData = cloneValue(baseline.data);
  const resolvedPatch: MergePatch[] = [];
  const sourceDecisions: MergeSourceDecision[] = [];
  const unresolvedPaths: PropertyPath[] = [];
  const scope: MergeScopeEntry[] = leaves.map((row) => ({
    resolutionKey: row.id,
    path: [...row.property.path],
    role: roleFor(row),
    allowedSourceVersionIds: versions.map((version) => version.id),
    active: true,
  }));
  const knownResolutionKeys = new Set(scope.map((entry) => entry.resolutionKey));

  leaves.forEach((row) => {
    const role = roleFor(row);
    const resolution = resolutions[row.id];
    if (resolution?.kind === 'exclude') {
      sourceDecisions.push({
        kind: 'stale',
        resolutionKey: row.id,
        reason: 'exclude-not-allowed',
      });
      unresolvedPaths.push([...row.property.path]);
      return;
    }
    if (resolution?.kind === 'source' && !versionIds.has(resolution.versionId)) {
      sourceDecisions.push({
        kind: 'stale',
        resolutionKey: row.id,
        reason: 'source-version-unavailable',
      });
      unresolvedPaths.push([...row.property.path]);
      return;
    }

    const sourceVersionId =
      resolution?.kind === 'source'
        ? resolution.versionId
        : !row.hasOwnDifference
          ? baseline.id
          : undefined;
    if (!sourceVersionId) {
      sourceDecisions.push({
        kind: 'unresolved',
        resolutionKey: row.id,
        path: [...row.property.path],
        role,
      });
      unresolvedPaths.push([...row.property.path]);
      return;
    }

    const value = cloneValue(row.values[sourceVersionId]);
    assignPath(mergedData, row.property.path, value);
    const automatic = resolution?.kind !== 'source';
    resolvedPatch.push(
      value === undefined
        ? {
            op: 'delete',
            resolutionKey: row.id,
            path: [...row.property.path],
            sourceVersionId,
            origin: automatic ? 'automatic-baseline' : 'user-source',
          }
        : {
            op: 'set',
            resolutionKey: row.id,
            path: [...row.property.path],
            value,
            sourceVersionId,
            origin: automatic ? 'automatic-baseline' : 'user-source',
          },
    );
    sourceDecisions.push({
      kind: automatic ? 'automatic-baseline' : 'source',
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
      sourceVersionId,
    });
  });

  Object.keys(resolutions).forEach((resolutionKey) => {
    if (!knownResolutionKeys.has(resolutionKey)) {
      sourceDecisions.push({ kind: 'stale', resolutionKey, reason: 'unknown-row' });
    }
  });

  return {
    baseVersionId: baseline.id,
    mergedData,
    resolvedPatch,
    scope,
    unresolvedPaths,
    isComplete: unresolvedPaths.length === 0,
    sourceDecisions,
  };
}

function roleFor(row: ComparisonRow): Exclude<MergeScopeRole, 'keyed-presence'> {
  const values = Object.values(row.values);
  if (values.some(Array.isArray)) return 'non-keyed-array';
  if (values.some((value) => value !== null && typeof value === 'object')) return 'container';
  return 'value';
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

import type {
  ComparisonRow,
  ComparisonVersion,
  KeyedArrayTarget,
  MergePatch,
  MergeResolutions,
  MergeResult,
  MergeScopeEntry,
  MergeScopeRole,
  MergeSourceDecision,
  PropertyPath,
} from './types';

type KeyFields = ReadonlyMap<string, string>;

interface KeyedItemContext {
  row: ComparisonRow;
  target: KeyedArrayTarget;
  presentVersionIds: readonly string[];
  requiresPresenceDecision: boolean;
}

export function buildMergeResult<T>(
  rows: readonly ComparisonRow[],
  versions: readonly ComparisonVersion<T>[],
  resolutions: MergeResolutions,
  configuredBaselineId?: string,
  arrayItemKeyFields?: Readonly<Record<string, string>>,
): MergeResult<T> {
  const baseline = configuredBaselineId
    ? versions.find((version) => version.id === configuredBaselineId)
    : versions[0];
  if (configuredBaselineId && !baseline) {
    throw new Error(`Unknown base version id: ${configuredBaselineId}`);
  }
  if (!baseline) throw new Error('Merge mode requires at least one comparison version');

  const versionIds = new Set(versions.map((version) => version.id));
  const keyFields = collectKeyFields(arrayItemKeyFields);
  validateKeyedRows(rows, keyFields);
  const mergedData = cloneValue(baseline.data, []);
  const resolvedPatch: MergePatch[] = [];
  const sourceDecisions: MergeSourceDecision[] = [];
  const unresolvedPaths: PropertyPath[] = [];
  const scope: MergeScopeEntry[] = [];
  const knownResolutionKeys = new Set<string>();

  const markUnresolved = (row: ComparisonRow, role: MergeScopeRole) => {
    sourceDecisions.push({
      kind: 'unresolved',
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
    });
    unresolvedPaths.push([...row.property.path]);
  };

  const processLeaf = (
    row: ComparisonRow,
    active: boolean,
    keyedItem?: KeyedItemContext,
    dormant = false,
  ): void => {
    const role = roleFor(row, keyFields);
    const allowedSourceVersionIds = keyedItem
      ? keyedItem.presentVersionIds
      : versions.map((version) => version.id);
    scope.push({
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
      allowedSourceVersionIds,
      active,
      ...(keyedItem?.requiresPresenceDecision ? { parentResolutionKey: keyedItem.row.id } : {}),
    });
    knownResolutionKeys.add(row.id);

    const resolution = resolutions[row.id];
    if (!active && dormant) return;
    if (!active) {
      if (resolution?.kind === 'source') {
        if (!versionIds.has(resolution.versionId)) {
          sourceDecisions.push({
            kind: 'stale',
            resolutionKey: row.id,
            reason: 'source-version-unavailable',
          });
        } else if (keyedItem && !keyedItem.presentVersionIds.includes(resolution.versionId)) {
          sourceDecisions.push({
            kind: 'stale',
            resolutionKey: row.id,
            reason: 'source-not-present',
          });
        }
      } else if (resolution?.kind === 'exclude') {
        sourceDecisions.push({
          kind: 'stale',
          resolutionKey: row.id,
          reason: 'exclude-not-allowed',
        });
      }
      return;
    }

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
    if (
      resolution?.kind === 'source' &&
      keyedItem &&
      !keyedItem.presentVersionIds.includes(resolution.versionId)
    ) {
      sourceDecisions.push({
        kind: 'stale',
        resolutionKey: row.id,
        reason: 'source-not-present',
      });
      unresolvedPaths.push([...row.property.path]);
      return;
    }

    const sourceVersionId =
      resolution?.kind === 'source'
        ? resolution.versionId
        : !(role === 'non-keyed-array' ? row.hasDifference : row.hasOwnDifference)
          ? baseline.id
          : undefined;
    if (!sourceVersionId) {
      markUnresolved(row, role);
      return;
    }

    const value = cloneValue(row.values[sourceVersionId], row.property.path);
    const automatic = resolution?.kind !== 'source';
    if (value === undefined) {
      deletePath(mergedData, row.property.path, keyFields);
      resolvedPatch.push({
        op: 'delete',
        resolutionKey: row.id,
        path: [...row.property.path],
        sourceVersionId,
        origin: automatic ? 'automatic-baseline' : 'user-source',
      });
    } else {
      assignPath(mergedData, row.property.path, value, keyFields);
      resolvedPatch.push({
        op: 'set',
        resolutionKey: row.id,
        path: [...row.property.path],
        value,
        sourceVersionId,
        origin: automatic ? 'automatic-baseline' : 'user-source',
      });
    }
    sourceDecisions.push({
      kind: automatic ? 'automatic-baseline' : 'source',
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
      sourceVersionId,
    });
  };

  const processRows = (
    currentRows: readonly ComparisonRow[],
    active = true,
    parentKeyedItem?: KeyedItemContext,
    dormant = false,
  ): void => {
    currentRows.forEach((row) => {
      const keyedItem = keyedItemContext(row, versions, keyFields);
      if (keyedItem) {
        let childrenActive = active;
        let childrenDormant = dormant || keyedItem.requiresPresenceDecision;
        if (keyedItem.requiresPresenceDecision) {
          scope.push({
            resolutionKey: row.id,
            path: [...row.property.path],
            role: 'keyed-presence',
            allowedSourceVersionIds: keyedItem.presentVersionIds,
            active,
            ...(parentKeyedItem?.requiresPresenceDecision
              ? { parentResolutionKey: parentKeyedItem.row.id }
              : {}),
          });
          knownResolutionKeys.add(row.id);
          childrenActive = false;
          const resolution = resolutions[row.id];
          if (active) {
            if (!resolution) {
              markUnresolved(row, 'keyed-presence');
            } else if (resolution.kind === 'exclude') {
              childrenDormant = true;
              excludeKeyedItem(mergedData, keyedItem.target, keyFields);
              resolvedPatch.push({
                op: 'exclude-keyed-item',
                resolutionKey: row.id,
                target: keyedItem.target,
              });
              sourceDecisions.push({
                kind: 'exclude',
                resolutionKey: row.id,
                path: [...row.property.path],
                role: 'keyed-presence',
              });
            } else if (!versionIds.has(resolution.versionId)) {
              sourceDecisions.push({
                kind: 'stale',
                resolutionKey: row.id,
                reason: 'source-version-unavailable',
              });
              unresolvedPaths.push([...row.property.path]);
            } else if (!keyedItem.presentVersionIds.includes(resolution.versionId)) {
              sourceDecisions.push({
                kind: 'stale',
                resolutionKey: row.id,
                reason: 'source-not-present',
              });
              unresolvedPaths.push([...row.property.path]);
            } else {
              const value = cloneValue(row.values[resolution.versionId], row.property.path);
              includeKeyedItem(mergedData, keyedItem.target, value, keyFields);
              resolvedPatch.push({
                op: 'include-keyed-item',
                resolutionKey: row.id,
                target: keyedItem.target,
                value,
                sourceVersionId: resolution.versionId,
              });
              sourceDecisions.push({
                kind: 'source',
                resolutionKey: row.id,
                path: [...row.property.path],
                role: 'keyed-presence',
                sourceVersionId: resolution.versionId,
              });
              childrenActive = true;
              childrenDormant = false;
            }
          }
        }

        const children = row.children ?? [];
        if (children.length) {
          processRows(
            children.filter(
              (child) => child.property.path.at(-1) !== keyedItem.target.identityField,
            ),
            childrenActive,
            keyedItem,
            childrenDormant,
          );
        } else if (!keyedItem.requiresPresenceDecision) {
          processLeaf(row, active, parentKeyedItem, dormant);
        }
        return;
      }

      const isUnkeyedArray =
        Object.values(row.values).some(Array.isArray) && !keyFields.has(pathKey(row.property.path));
      if (isUnkeyedArray) {
        processLeaf(row, active, parentKeyedItem, dormant);
        return;
      }

      if (row.children?.length) {
        processRows(row.children, active, parentKeyedItem, dormant);
      } else {
        processLeaf(row, active, parentKeyedItem, dormant);
      }
    });
  };

  processRows(rows);

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
    isComplete:
      unresolvedPaths.length === 0 &&
      !sourceDecisions.some((decision) => decision.kind === 'stale'),
    sourceDecisions,
  };
}

function roleFor(
  row: ComparisonRow,
  keyFields: KeyFields,
): Exclude<MergeScopeRole, 'keyed-presence'> {
  const values = Object.values(row.values);
  if (values.some(Array.isArray)) {
    return keyFields.has(pathKey(row.property.path)) ? 'container' : 'non-keyed-array';
  }
  if (values.some((value) => value !== null && typeof value === 'object')) return 'container';
  return 'value';
}

function keyedItemContext(
  row: ComparisonRow,
  versions: readonly ComparisonVersion[],
  keyFields: KeyFields,
): KeyedItemContext | undefined {
  if (row.itemIdentity === undefined || !row.presence) return undefined;
  const arrayPath = row.property.path.slice(0, -1);
  const identityField = keyFields.get(pathKey(arrayPath));
  if (!identityField) {
    throw new Error(
      `Keyed array "${arrayPath.join('.')}" requires an explicit arrayItemKeyFields entry`,
    );
  }
  const presentVersionIds = versions
    .filter((version) => row.presence?.[version.id] === true)
    .map((version) => version.id);
  return {
    row,
    target: { arrayPath, identityField, identity: row.itemIdentity },
    presentVersionIds,
    requiresPresenceDecision: presentVersionIds.length !== versions.length,
  };
}

function collectKeyFields(configured?: Readonly<Record<string, string>>): Map<string, string> {
  const result = new Map<string, string>();
  Object.entries(configured ?? {}).forEach(([path, field]) => {
    result.set(pathKey(path ? path.split('.') : []), field);
  });
  return result;
}

function validateKeyedRows(rows: readonly ComparisonRow[], keyFields: KeyFields): void {
  rows.forEach((row) => {
    if (row.itemIdentity !== undefined && row.presence) {
      const arrayPath = row.property.path.slice(0, -1);
      if (!keyFields.has(pathKey(arrayPath))) {
        throw new Error(
          `Keyed array "${arrayPath.join('.')}" requires an explicit arrayItemKeyFields entry`,
        );
      }
    }
    validateKeyedRows(row.children ?? [], keyFields);
  });
}

function assignPath(root: unknown, path: PropertyPath, value: unknown, keyFields: KeyFields): void {
  const location = locateProperty(root, path, keyFields, true);
  if (location) location.target[location.key] = value;
}

function deletePath(root: unknown, path: PropertyPath, keyFields: KeyFields): void {
  const location = locateProperty(root, path, keyFields, false);
  if (location) delete location.target[location.key];
}

function locateProperty(
  root: unknown,
  path: PropertyPath,
  keyFields: KeyFields,
  create: boolean,
): { target: Record<string | number, unknown>; key: string | number } | undefined {
  if (!path.length || root === null || typeof root !== 'object') return undefined;
  let value: unknown = root;
  let parentPath: PropertyPath = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const part = path[index];
    if (Array.isArray(value) && typeof part === 'string') {
      const identityField = keyFields.get(pathKey(parentPath));
      if (identityField) {
        value = value.find((item) => isRecord(item) && item[identityField] === part);
        if (value === undefined) return undefined;
        parentPath = [...parentPath, part];
        continue;
      }
    }
    if (value === null || typeof value !== 'object') return undefined;
    const target = value as Record<string | number, unknown>;
    let child = target[part];
    if ((child === null || typeof child !== 'object') && create) {
      const nextPart = path[index + 1];
      child = typeof nextPart === 'number' ? [] : {};
      target[part] = child;
    }
    if (child === null || typeof child !== 'object') return undefined;
    value = child;
    parentPath = [...parentPath, part];
  }
  if (value === null || typeof value !== 'object') return undefined;
  return { target: value as Record<string | number, unknown>, key: path.at(-1)! };
}

function includeKeyedItem(
  root: unknown,
  target: KeyedArrayTarget,
  value: unknown,
  keyFields: KeyFields,
): void {
  const array = resolvePath(root, target.arrayPath, keyFields);
  if (!Array.isArray(array)) return;
  const index = array.findIndex(
    (item) => isRecord(item) && item[target.identityField] === target.identity,
  );
  if (index === -1) array.push(value);
  else array[index] = value;
}

function excludeKeyedItem(root: unknown, target: KeyedArrayTarget, keyFields: KeyFields): void {
  const array = resolvePath(root, target.arrayPath, keyFields);
  if (!Array.isArray(array)) return;
  const index = array.findIndex(
    (item) => isRecord(item) && item[target.identityField] === target.identity,
  );
  if (index >= 0) array.splice(index, 1);
}

function resolvePath(root: unknown, path: PropertyPath, keyFields: KeyFields): unknown {
  let value = root;
  let parentPath: PropertyPath = [];
  for (const part of path) {
    if (Array.isArray(value) && typeof part === 'string') {
      const identityField = keyFields.get(pathKey(parentPath));
      if (identityField) {
        value = value.find((item) => isRecord(item) && item[identityField] === part);
        parentPath = [...parentPath, part];
        continue;
      }
    }
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string | number, unknown>)[part];
    parentPath = [...parentPath, part];
  }
  return value;
}

function cloneValue<T>(value: T, path: PropertyPath): T {
  assertCloneable(value, path, new WeakSet<object>());
  try {
    return structuredClone(value);
  } catch {
    const type = value === null ? 'null' : typeof value;
    throw new Error(`Cannot clone merge value at ${displayPath(path)} (${type})`);
  }
}

function assertCloneable(value: unknown, path: PropertyPath, seen: WeakSet<object>): void {
  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(
      `Cannot clone merge value at ${displayPath(path)}: unsupported ${typeof value}`,
    );
  }
  if (value === null || typeof value !== 'object' || value instanceof Date) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) {
    value.forEach((mapValue, mapKey) => {
      assertCloneable(mapKey, [...path, '<map-key>'], seen);
      assertCloneable(mapValue, [...path, '<map-value>'], seen);
    });
    return;
  }
  if (value instanceof Set) {
    value.forEach((child) => assertCloneable(child, [...path, '<set-value>'], seen));
    return;
  }
  Reflect.ownKeys(value).forEach((key) => {
    if (typeof key === 'symbol') {
      throw new Error(`Cannot clone merge value at ${displayPath(path)}: unsupported symbol key`);
    }
    assertCloneable((value as Record<string, unknown>)[key], [...path, key], seen);
  });
}

function pathKey(path: PropertyPath): string {
  return JSON.stringify(path);
}

function displayPath(path: PropertyPath): string {
  return path.length ? path.join('.') : '<root>';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

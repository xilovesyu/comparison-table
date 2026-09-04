import type {
  ComparisonRow,
  ComparisonVersion,
  KeyedArrayTarget,
  MergeEdit,
  MergeEdits,
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
  edits?: MergeEdits,
): MergeResult<T> {
  if (edits !== undefined) {
    return buildEditedMergeResult(
      rows,
      versions,
      resolutions,
      configuredBaselineId,
      arrayItemKeyFields,
      edits,
    );
  }
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

interface EditedMergeContext {
  active: boolean;
  dormant: boolean;
  inheritedVersionId?: string;
  parentResolutionKey?: string;
  keyedItem?: KeyedItemContext;
  suppressPatches: boolean;
}

function buildEditedMergeResult<T>(
  rows: readonly ComparisonRow[],
  versions: readonly ComparisonVersion<T>[],
  resolutions: MergeResolutions,
  configuredBaselineId: string | undefined,
  arrayItemKeyFields: Readonly<Record<string, string>> | undefined,
  edits: MergeEdits,
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

  const addScope = (
    row: ComparisonRow,
    role: MergeScopeRole,
    context: EditedMergeContext,
    allowedSourceVersionIds: readonly string[],
  ) => {
    scope.push({
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
      allowedSourceVersionIds,
      active: context.active && !context.dormant,
      ...(context.parentResolutionKey ? { parentResolutionKey: context.parentResolutionKey } : {}),
    });
    knownResolutionKeys.add(row.id);
  };

  const markUnresolved = (row: ComparisonRow, role: MergeScopeRole) => {
    sourceDecisions.push({
      kind: 'unresolved',
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
    });
    unresolvedPaths.push([...row.property.path]);
  };

  const markInvalidSource = (
    row: ComparisonRow,
    versionId: string,
    keyedItem?: KeyedItemContext,
  ): boolean => {
    const reason = !versionIds.has(versionId)
      ? 'source-version-unavailable'
      : keyedItem && !keyedItem.presentVersionIds.includes(versionId)
        ? 'source-not-present'
        : undefined;
    if (!reason) return false;
    sourceDecisions.push({ kind: 'stale', resolutionKey: row.id, reason });
    unresolvedPaths.push([...row.property.path]);
    return true;
  };

  const pushRelativePatch = (
    row: ComparisonRow,
    value: unknown,
    origin: 'automatic-baseline' | 'user-source' | 'user-edit',
    sourceVersionId: string | undefined,
    suppress: boolean,
  ) => {
    if (suppress) return;
    const baselineValue = resolvePath(baseline.data, row.property.path, keyFields);
    const baselineHasPath = hasPath(baseline.data, row.property.path, keyFields);
    if (value === undefined) {
      if (!baselineHasPath) return;
      resolvedPatch.push(
        origin === 'user-edit'
          ? {
              op: 'delete',
              resolutionKey: row.id,
              path: [...row.property.path],
              origin,
            }
          : {
              op: 'delete',
              resolutionKey: row.id,
              path: [...row.property.path],
              sourceVersionId: sourceVersionId!,
              origin,
            },
      );
      return;
    }
    if (baselineHasPath && valuesEqual(value, baselineValue)) return;
    resolvedPatch.push(
      origin === 'user-edit'
        ? {
            op: 'set',
            resolutionKey: row.id,
            path: [...row.property.path],
            value,
            origin,
          }
        : {
            op: 'set',
            resolutionKey: row.id,
            path: [...row.property.path],
            value,
            sourceVersionId: sourceVersionId!,
            origin,
          },
    );
  };

  const processLeaf = (row: ComparisonRow, context: EditedMergeContext): void => {
    const role = roleFor(row, keyFields);
    const allowedSourceVersionIds = context.keyedItem
      ? context.keyedItem.presentVersionIds
      : versions.map((version) => version.id);
    addScope(row, role, context, allowedSourceVersionIds);
    if (!context.active || context.dormant) return;

    const edit = edits[row.id];
    if (edit) {
      const value = editValue(edit, row.property.path);
      if (value === undefined) deletePath(mergedData, row.property.path, keyFields);
      else assignPath(mergedData, row.property.path, value, keyFields);
      pushRelativePatch(row, value, 'user-edit', undefined, context.suppressPatches);
      return;
    }

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
    const sourceVersionId =
      resolution?.kind === 'source'
        ? resolution.versionId
        : (context.inheritedVersionId ??
          (!(role === 'non-keyed-array' ? row.hasDifference : row.hasOwnDifference)
            ? baseline.id
            : undefined));
    if (!sourceVersionId) {
      markUnresolved(row, role);
      return;
    }
    if (markInvalidSource(row, sourceVersionId, context.keyedItem)) return;

    const value = cloneValue(row.values[sourceVersionId], row.property.path);
    if (value === undefined) deletePath(mergedData, row.property.path, keyFields);
    else assignPath(mergedData, row.property.path, value, keyFields);
    const automatic = resolution?.kind !== 'source' && context.inheritedVersionId === undefined;
    pushRelativePatch(
      row,
      value,
      automatic ? 'automatic-baseline' : 'user-source',
      sourceVersionId,
      context.suppressPatches,
    );
    sourceDecisions.push({
      kind: automatic ? 'automatic-baseline' : 'source',
      resolutionKey: row.id,
      path: [...row.property.path],
      role,
      sourceVersionId,
    });
  };

  const processContainer = (
    row: ComparisonRow,
    context: EditedMergeContext,
    keyedItem: KeyedItemContext | undefined,
    children: readonly ComparisonRow[] = row.children ?? [],
  ): void => {
    const role: Exclude<MergeScopeRole, 'keyed-presence'> = 'container';
    const allowedSourceVersionIds = keyedItem
      ? keyedItem.presentVersionIds
      : versions.map((version) => version.id);
    addScope(row, role, context, allowedSourceVersionIds);
    const resolution = resolutions[row.id];
    let inheritedVersionId = context.inheritedVersionId;
    if (context.active && !context.dormant && resolution) {
      if (resolution.kind === 'exclude') {
        sourceDecisions.push({
          kind: 'stale',
          resolutionKey: row.id,
          reason: 'exclude-not-allowed',
        });
      } else if (!markInvalidSource(row, resolution.versionId, keyedItem)) {
        inheritedVersionId = resolution.versionId;
        sourceDecisions.push({
          kind: 'source',
          resolutionKey: row.id,
          path: [...row.property.path],
          role,
          sourceVersionId: resolution.versionId,
        });
      }
    }
    processRows(children, {
      ...context,
      inheritedVersionId,
      parentResolutionKey: row.id,
      keyedItem: keyedItem ?? context.keyedItem,
    });
  };

  const processKeyedItem = (
    row: ComparisonRow,
    context: EditedMergeContext,
    keyedItem: KeyedItemContext,
  ): void => {
    const children = (row.children ?? []).filter(
      (child) => child.property.path.at(-1) !== keyedItem.target.identityField,
    );
    if (!keyedItem.requiresPresenceDecision) {
      processContainer(row, context, keyedItem, children);
      return;
    }

    addScope(row, 'keyed-presence', context, keyedItem.presentVersionIds);
    const resolution = resolutions[row.id];
    let includeVersionId: string | undefined;
    let excluded = false;
    if (context.active && !context.dormant) {
      if (resolution?.kind === 'exclude') excluded = true;
      else if (resolution?.kind === 'source') includeVersionId = resolution.versionId;
      else if (context.inheritedVersionId) {
        if (keyedItem.presentVersionIds.includes(context.inheritedVersionId)) {
          includeVersionId = context.inheritedVersionId;
        } else excluded = true;
      } else markUnresolved(row, 'keyed-presence');
    }

    if (excluded) {
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
      processRows(children, {
        ...context,
        active: false,
        dormant: true,
        parentResolutionKey: row.id,
        keyedItem,
      });
      return;
    }

    if (!includeVersionId || markInvalidSource(row, includeVersionId, keyedItem)) {
      processRows(children, {
        ...context,
        active: false,
        dormant: true,
        parentResolutionKey: row.id,
        keyedItem,
      });
      return;
    }

    const baselineItemPresent = keyedItem.presentVersionIds.includes(baseline.id);
    if (!baselineItemPresent) {
      includeKeyedItem(
        mergedData,
        keyedItem.target,
        cloneValue(row.values[includeVersionId], row.property.path),
        keyFields,
      );
    }
    sourceDecisions.push({
      kind: 'source',
      resolutionKey: row.id,
      path: [...row.property.path],
      role: 'keyed-presence',
      sourceVersionId: includeVersionId,
    });
    processRows(children, {
      ...context,
      inheritedVersionId: includeVersionId,
      parentResolutionKey: row.id,
      keyedItem,
      suppressPatches: context.suppressPatches || !baselineItemPresent,
    });
    if (!baselineItemPresent) {
      const value = cloneValue(
        resolvePath(mergedData, row.property.path, keyFields),
        row.property.path,
      );
      resolvedPatch.push({
        op: 'include-keyed-item',
        resolutionKey: row.id,
        target: keyedItem.target,
        value,
        sourceVersionId: includeVersionId,
      });
    }
  };

  const processRows = (
    currentRows: readonly ComparisonRow[],
    context: EditedMergeContext,
  ): void => {
    currentRows.forEach((row) => {
      const keyedItem = keyedItemContext(row, versions, keyFields);
      if (keyedItem) {
        processKeyedItem(row, context, keyedItem);
        return;
      }
      const isUnkeyedArray =
        Object.values(row.values).some(Array.isArray) && !keyFields.has(pathKey(row.property.path));
      if (isUnkeyedArray || !row.children?.length) {
        processLeaf(row, context);
        return;
      }
      processContainer(row, context, undefined);
    });
  };

  processRows(rows, {
    active: true,
    dormant: false,
    suppressPatches: false,
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

function editValue(edit: MergeEdit, path: PropertyPath): unknown {
  if (edit.kind === 'delete') return undefined;
  const value = edit.value;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return cloneValue(value, path);
  }
  const type = Array.isArray(value) ? 'array' : value instanceof Date ? 'date' : typeof value;
  throw new Error(`Cannot edit merge value at ${displayPath(path)}: unsupported ${type}`);
}

function hasPath(root: unknown, path: PropertyPath, keyFields: KeyFields): boolean {
  if (!path.length) return true;
  let value = root;
  let parentPath: PropertyPath = [];
  for (const part of path) {
    if (Array.isArray(value) && typeof part === 'string') {
      const identityField = keyFields.get(pathKey(parentPath));
      if (identityField) {
        const item = value.find(
          (candidate) => isRecord(candidate) && candidate[identityField] === part,
        );
        if (item === undefined) return false;
        value = item;
        parentPath = [...parentPath, part];
        continue;
      }
    }
    if (value === null || typeof value !== 'object') return false;
    if (!Object.prototype.hasOwnProperty.call(value, part)) return false;
    value = (value as Record<string | number, unknown>)[part];
    parentPath = [...parentPath, part];
  }
  return true;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) =>
          Object.prototype.hasOwnProperty.call(right, key) && valuesEqual(left[key], right[key]),
      )
    );
  }
  return false;
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

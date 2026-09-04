import type {
  BuildComparisonConfig,
  ContainerSummary,
  ComparisonRow,
  ComparisonVersion,
  DifferenceIndicatorSetting,
  DifferenceOptions,
  DisplayRule,
  PropertyContext,
  PropertyDefinition,
  PropertyMatcher,
  PropertyPath,
  PropertyType,
  SearchOptions,
} from './types';
import { copyComparisonRow, registerContainerSummaries } from './presentation';

/** Serializes a property path into the stable row/expansion key used by the table. */
export const pathId = (path: PropertyPath): string => JSON.stringify(path);
/** Detects the library's supported value kind. */
export function getPropertyType(value: unknown): PropertyType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return ['boolean', 'number', 'string'].includes(typeof value)
    ? (typeof value as PropertyType)
    : 'unknown';
}
/** Builds the normalized recursive row tree consumed by `RecursiveComparisonTable`. */
export function buildComparisonRows(
  versions: readonly ComparisonVersion[],
  config: BuildComparisonConfig = {},
): ComparisonRow[] {
  validateVersions(versions);
  validateDefinitions(config.propertyDefinitions, config.arrayItemKeyFields);
  const keyedArrays = prevalidateKeyedArrays(
    versions,
    config.arrayItemKeyFields,
    config.comparison?.baseVersionId,
  );
  const rows = config.propertyDefinitions
    ? fromDefinitions(config.propertyDefinitions, versions, config, [], undefined, keyedArrays)
    : visit(
        versions.map((v) => v.data),
        versions,
        [],
        config,
        [],
        undefined,
        keyedArrays,
      );
  const containerSummaries = new Map<string, ContainerSummary>();
  collectContainerSummaries(rows, containerSummaries);
  const markedRows = markDifferences(rows, versions, config.comparison, config.arrayItemKeyFields);
  registerContainerSummaries(markedRows, containerSummaries);
  return markedRows;
}
/** Filters rows by label and/or raw version values while retaining matching ancestors. */
export function filterComparisonRows(
  rows: readonly ComparisonRow[],
  query: string,
  options: SearchOptions = {},
): ComparisonRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.flatMap((row) => {
    const children = filterComparisonRows(row.children ?? [], query, options);
    const label =
      options.searchLabels !== false && row.property.label.toLowerCase().includes(needle);
    const value =
      options.searchValues !== false &&
      Object.values(row.values).some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(needle),
      );
    return label || value || children.length
      ? [copyComparisonRow(row, { children: children.length ? children : row.children })]
      : [];
  });
}
/** Removes unchanged branches while retaining the ancestors of changed descendants. */
export function filterDifferenceRows(rows: readonly ComparisonRow[]): ComparisonRow[] {
  return rows.flatMap((row) => {
    const children = filterDifferenceRows(row.children ?? []);
    return row.hasDifference
      ? [copyComparisonRow(row, { children: children.length ? children : undefined })]
      : [];
  });
}
function visit(
  values: unknown[],
  versions: readonly ComparisonVersion[],
  path: (string | number)[],
  config: BuildComparisonConfig,
  ancestors: readonly object[],
  inheritedControls?: RowDisplayControls,
  keyedArrays?: KeyedArrayCache,
): ComparisonRow[] {
  const keyField = keyFieldFor(path, config.arrayItemKeyFields);
  if (keyField) {
    const keyed = getKeyedItems(
      keyedArrays,
      values,
      versions,
      path,
      keyField,
      config.comparison?.baseVersionId,
    );
    return keyed.keys.flatMap((identity) => {
      const nodeValues = keyed.maps.map((map) => map?.get(identity));
      const nodePath = [...path, identity];
      const context = ctx(identity, nodePath, nodeValues[0], values[0]);
      const rule = ruleFor(context, config.rules);
      const controls = resolveRowDisplayControls(config, inheritedControls, rule);
      const expandable =
        nodeValues.some(container) &&
        !nodeValues.some((v) => container(v) && ancestors.includes(v));
      const children =
        expandable && rule?.expand !== false
          ? visit(
              nodeValues,
              versions,
              nodePath,
              config,
              [...ancestors, ...nodeValues.filter(container)],
              controls,
              keyedArrays,
            )
          : undefined;
      if (!selected(context, config.selection) && !children?.length) return [];
      return [
        row(
          identity,
          nodePath,
          nodeValues,
          versions,
          context,
          children,
          rule,
          undefined,
          controls,
          identity,
        ),
      ];
    });
  }
  return unionKeys(values).flatMap((key) => {
    const nodeValues = values.map((value) => child(value, key));
    const nodePath = [...path, key];
    const itemKeyField = keyFieldFor(nodePath, config.arrayItemKeyFields);
    if (itemKeyField) {
      getKeyedItems(
        keyedArrays,
        nodeValues,
        versions,
        nodePath,
        itemKeyField,
        config.comparison?.baseVersionId,
      );
    }
    const context = ctx(String(key), nodePath, nodeValues[0], values[0]);
    const rule = ruleFor(context, config.rules);
    const controls = resolveRowDisplayControls(config, inheritedControls, rule);
    const expandable =
      nodeValues.some(container) && !nodeValues.some((v) => container(v) && ancestors.includes(v));
    const children =
      expandable && rule?.expand !== false
        ? visit(
            nodeValues,
            versions,
            nodePath,
            config,
            [...ancestors, ...nodeValues.filter(container)],
            controls,
            keyedArrays,
          )
        : undefined;
    if (!selected(context, config.selection) && !children?.length) return [];
    return [
      row(
        String(key),
        nodePath,
        nodeValues,
        versions,
        context,
        children,
        rule,
        undefined,
        controls,
      ),
    ];
  });
}
function fromDefinitions(
  defs: readonly PropertyDefinition[],
  versions: readonly ComparisonVersion[],
  config: BuildComparisonConfig,
  parentPath: (string | number)[] = [],
  inheritedControls?: RowDisplayControls,
  keyedArrays?: KeyedArrayCache,
): ComparisonRow[] {
  return defs.flatMap((def) => {
    const path = def.path.length ? [...def.path] : [...parentPath, def.key];
    const values = versions.map((v) => resolvePath(v.data, path, config.arrayItemKeyFields));
    const runtimeContext = ctx(def.key, path, values[0], undefined);
    const context = ctx(def.key, path, values[0], undefined, def);
    const rule = ruleFor(runtimeContext, config.rules);
    const controls = resolveRowDisplayControls(config, inheritedControls, rule, def);
    const itemRows =
      def.itemDefinition && rule?.expand !== false && keyFieldFor(path, config.arrayItemKeyFields)
        ? fromItemDefinition(
            def.itemDefinition,
            values,
            versions,
            path,
            config,
            controls,
            keyedArrays,
          )
        : undefined;
    const children =
      itemRows ??
      (def.children && rule?.expand !== false
        ? fromDefinitions(def.children, versions, config, path, controls, keyedArrays)
        : undefined);
    if (!selected(runtimeContext, config.selection) && !children?.length) return [];
    if (def.flatten && itemRows) return itemRows;
    return [row(def.key, path, values, versions, context, children, rule, def, controls)];
  });
}
function fromItemDefinition(
  template: PropertyDefinition,
  arrays: unknown[],
  versions: readonly ComparisonVersion[],
  arrayPath: PropertyPath,
  config: BuildComparisonConfig,
  inherited: RowDisplayControls,
  keyedArrays?: KeyedArrayCache,
): ComparisonRow[] {
  const field = keyFieldFor(arrayPath, config.arrayItemKeyFields)!;
  const keyed = getKeyedItems(
    keyedArrays,
    arrays,
    versions,
    arrayPath,
    field,
    config.comparison?.baseVersionId,
  );
  return keyed.keys.flatMap((identity) => {
    const values = keyed.maps.map((map) => map?.get(identity));
    const path = [...arrayPath, identity];
    const runtimeContext = ctx(template.key, path, values[0], undefined);
    const context = ctx(template.key, path, values[0], undefined, template);
    const rule = ruleFor(runtimeContext, config.rules);
    const controls = resolveRowDisplayControls(config, inherited, rule, template);
    const children =
      template.children && rule?.expand !== false
        ? fromDefinitions(
            relativeDefinitions(template.children, path),
            versions,
            config,
            path,
            controls,
            keyedArrays,
          )
        : undefined;
    if (!selected(runtimeContext, config.selection) && !children?.length) return [];
    return [
      row(
        template.key,
        path,
        values,
        versions,
        context,
        children,
        rule,
        template,
        controls,
        identity,
      ),
    ];
  });
}
function relativeDefinitions(
  definitions: readonly PropertyDefinition[],
  parentPath: PropertyPath,
): PropertyDefinition[] {
  return definitions.map((definition) => ({
    ...definition,
    path: definition.path.length
      ? [...parentPath, ...definition.path]
      : [...parentPath, definition.key],
    children: definition.children
      ? relativeDefinitions(
          definition.children,
          definition.path.length
            ? [...parentPath, ...definition.path]
            : [...parentPath, definition.key],
        )
      : undefined,
  }));
}
function row(
  key: string,
  path: (string | number)[],
  values: unknown[],
  versions: readonly ComparisonVersion[],
  context: PropertyContext,
  children?: ComparisonRow[],
  displayRule?: DisplayRule,
  def?: PropertyDefinition,
  controls?: RowDisplayControls,
  itemIdentity?: string,
): ComparisonRow {
  const definitionLabel = def?.label ?? displayLabel(key, path, itemIdentity);
  const { containerSummary: definitionSummary, ...definitionMetadata } = def ?? {};
  const property: PropertyDefinition = {
    ...definitionMetadata,
    key,
    label:
      displayRule?.label ??
      (itemIdentity && def?.label && versions.length > 1
        ? `${definitionLabel} [${itemIdentity}]`
        : definitionLabel),
    path,
    level: def?.level ?? path.length - 1,
    type: def?.type ?? context.type,
    renderer: displayRule?.renderer ?? def?.renderer,
  };
  const summary = definitionSummary ?? displayRule?.containerSummary;
  const result: ComparisonRow = {
    id: pathId(path),
    property,
    values: Object.fromEntries(versions.map((v, i) => [v.id, values[i]])),
    children: children?.length ? children : undefined,
    differenceIndicator: controls?.differenceIndicator ?? true,
    nodeSearchable: controls?.nodeSearchable ?? true,
    itemIdentity,
    presence: itemIdentity
      ? Object.fromEntries(
          versions.map((version, index) => [version.id, values[index] !== undefined]),
        )
      : undefined,
  };
  if (summary) rowContainerSummaries.set(result, summary);
  return result;
}
const rowContainerSummaries = new WeakMap<ComparisonRow, ContainerSummary>();
function collectContainerSummaries(
  rows: readonly ComparisonRow[],
  target: Map<string, ContainerSummary>,
): void {
  rows.forEach((current) => {
    const summary = rowContainerSummaries.get(current);
    if (summary) target.set(current.id, summary);
    collectContainerSummaries(current.children ?? [], target);
  });
}
interface RowDisplayControls {
  differenceIndicator: DifferenceOptions['differenceIndicator'];
  nodeSearchable: boolean;
}
function resolveRowDisplayControls(
  config: BuildComparisonConfig,
  inherited: RowDisplayControls | undefined,
  rule?: DisplayRule,
  definition?: PropertyDefinition,
): RowDisplayControls {
  return {
    differenceIndicator:
      definition?.differenceIndicator ??
      rule?.differenceIndicator ??
      inherited?.differenceIndicator ??
      config.comparison?.differenceIndicator ??
      true,
    nodeSearchable:
      definition?.nodeSearchable ??
      rule?.nodeSearchable ??
      inherited?.nodeSearchable ??
      config.nodeSearchable ??
      true,
  };
}
function displayLabel(key: string, path: PropertyPath, keyedIdentity?: string): string {
  if (!/^\d+$/.test(key) && !keyedIdentity) return key;
  return (
    path
      .slice(0, -1)
      .reduce(
        (label, part) =>
          typeof part === 'number' ? `${label}[${part}]` : label ? `${label}.${part}` : part,
        '',
      ) + `[${key}]`
  );
}
function unionKeys(values: unknown[]): (string | number)[] {
  const keys = new Set<string | number>();
  values.forEach((v) =>
    Array.isArray(v)
      ? v.forEach((_, i) => keys.add(i))
      : record(v)
        ? Object.keys(v).forEach((key) => keys.add(key))
        : undefined,
  );
  return [...keys];
}
function child(value: unknown, key: string | number): unknown {
  if (Array.isArray(value)) return typeof key === 'number' ? value[key] : undefined;
  return record(value) ? value[key] : undefined;
}
function keyFieldFor(
  path: PropertyPath,
  fields: BuildComparisonConfig['arrayItemKeyFields'],
): string | undefined {
  return fields?.[path.join('.')];
}
function keyedItems(
  values: unknown[],
  versions: readonly ComparisonVersion[],
  path: PropertyPath,
  field: string,
  baseVersionId?: string,
): { keys: string[]; maps: Array<Map<string, unknown> | undefined> } {
  const maps = values.map((value, index) => {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) {
      throw new Error(
        `Keyed array "${path.join('.')}" in version "${versions[index].id}" must be an array`,
      );
    }
    const map = new Map<string, unknown>();
    value.forEach((item, itemIndex) => {
      const identity = record(item) ? item[field] : undefined;
      if (typeof identity !== 'string' || !identity.trim()) {
        throw new Error(
          `Invalid keyed array "${path.join('.')}" in version "${versions[index].id}": identity field "${field}" is missing or blank at index ${itemIndex}`,
        );
      }
      if (map.has(identity)) {
        throw new Error(
          `Duplicate keyed array "${path.join('.')}" in version "${versions[index].id}" for identity field "${field}": "${identity}" at index ${itemIndex}`,
        );
      }
      map.set(identity, item);
    });
    return map;
  });
  const baseline = baseVersionId
    ? versions.findIndex((version) => version.id === baseVersionId)
    : 0;
  const order = [
    baseline,
    ...versions.map((_, index) => index).filter((index) => index !== baseline),
  ];
  const keys: string[] = [];
  order.forEach((index) =>
    maps[index]?.forEach((_, identity) => {
      if (!keys.includes(identity)) keys.push(identity);
    }),
  );
  return { keys, maps };
}
type KeyedItems = ReturnType<typeof keyedItems>;
type KeyedArrayCache = Map<string, KeyedItems>;
function prevalidateKeyedArrays(
  versions: readonly ComparisonVersion[],
  fields: BuildComparisonConfig['arrayItemKeyFields'],
  baseVersionId?: string,
): KeyedArrayCache {
  const cache: KeyedArrayCache = new Map();
  Object.entries(fields ?? {}).forEach(([configuredPath, field]) => {
    const path = configuredPath.split('.');
    const values = versions.map((version) => path.reduce(child, version.data));
    cache.set(configuredPath, keyedItems(values, versions, path, field, baseVersionId));
  });
  return cache;
}
function getKeyedItems(
  cache: KeyedArrayCache | undefined,
  values: unknown[],
  versions: readonly ComparisonVersion[],
  path: PropertyPath,
  field: string,
  baseVersionId?: string,
): KeyedItems {
  return cache?.get(path.join('.')) ?? keyedItems(values, versions, path, field, baseVersionId);
}
function resolvePath(
  data: unknown,
  path: PropertyPath,
  fields: BuildComparisonConfig['arrayItemKeyFields'],
): unknown {
  let value = data;
  let parentPath: (string | number)[] = [];
  for (const part of path) {
    if (Array.isArray(value) && typeof part === 'string' && keyFieldFor(parentPath, fields)) {
      value = value.find((item) => record(item) && item[keyFieldFor(parentPath, fields)!] === part);
    } else {
      value = child(value, part);
    }
    parentPath = [...parentPath, part];
  }
  return value;
}
function record(value: unknown): value is Record<string | number, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}
function container(value: unknown): value is object {
  return Array.isArray(value) || record(value);
}
function ctx(
  key: string,
  path: PropertyPath,
  value: unknown,
  parent: unknown,
  definition?: PropertyDefinition,
): PropertyContext {
  const valueType = getPropertyType(value);
  return {
    key,
    path,
    value,
    parent,
    level: definition?.level ?? path.length - 1,
    type: definition?.type ?? valueType,
    valueType,
  };
}
function validateVersions(versions: readonly ComparisonVersion[]): void {
  const ids = new Set<string>();
  versions.forEach((v) => {
    if (ids.has(v.id)) throw new Error(`Duplicate version id: ${v.id}`);
    ids.add(v.id);
  });
}
function validateDefinitions(
  definitions: readonly PropertyDefinition[] | undefined,
  fields: BuildComparisonConfig['arrayItemKeyFields'],
  parentPath: PropertyPath = [],
): void {
  definitions?.forEach((definition) => {
    const path = definition.path.length ? definition.path : [...parentPath, definition.key];
    path.forEach((part, index) => {
      if (typeof part === 'number' && keyFieldFor(path.slice(0, index), fields)) {
        throw new Error(
          `Property definition path "${path.join('.')}" conflicts with keyed array "${path.slice(0, index).join('.')}": numeric item indexes are not allowed`,
        );
      }
    });
    validateDefinitions(definition.children, fields, path);
    if (definition.itemDefinition) {
      if (keyFieldFor(path, fields)) validateKeyedItemTemplate(definition.itemDefinition, path);
      validateDefinitions([definition.itemDefinition], fields, path);
    }
  });
}
function validateKeyedItemTemplate(template: PropertyDefinition, arrayPath: PropertyPath): void {
  if (template.path.some((part) => typeof part === 'number')) {
    throw new Error(
      `Keyed array "${arrayPath.join('.')}" item definition cannot use numeric indexes`,
    );
  }
  template.children?.forEach((child) => validateKeyedItemTemplate(child, arrayPath));
  if (template.itemDefinition) validateKeyedItemTemplate(template.itemDefinition, arrayPath);
}
function markDifferences(
  rows: readonly ComparisonRow[],
  versions: readonly ComparisonVersion[],
  options?: DifferenceOptions,
  keyFields?: BuildComparisonConfig['arrayItemKeyFields'],
): ComparisonRow[] {
  const baseIndex = options?.baseVersionId
    ? versions.findIndex((version) => version.id === options.baseVersionId)
    : undefined;
  if (baseIndex === -1) throw new Error(`Unknown base version id: ${options?.baseVersionId}`);
  return rows.map((row) => {
    const children = markDifferences(row.children ?? [], versions, options, keyFields);
    const values = versions.map((version) => row.values[version.id]);
    const context = ctx(row.property.key, row.property.path, values[0], undefined, row.property);
    const detectedDifference = options?.comparator
      ? options.comparator(values, context)
      : values.some(
          (value) => !deepEqual(value, values[baseIndex ?? 0], row.property.path, keyFields),
        );
    const ownDifference = children.length ? false : detectedDifference;
    const descendantDifferenceCount = children.reduce(
      (count, child) =>
        count + Number(child.hasOwnDifference) + (child.descendantDifferenceCount ?? 0),
      0,
    );
    return copyComparisonRow(row, {
      children: children.length ? children : undefined,
      hasDifference: ownDifference || children.some((child) => child.hasDifference),
      hasOwnDifference: ownDifference,
      descendantDifferenceCount,
    });
  });
}
function deepEqual(
  left: unknown,
  right: unknown,
  path: PropertyPath = [],
  keyFields?: BuildComparisonConfig['arrayItemKeyFields'],
): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  if (Array.isArray(left) && Array.isArray(right)) {
    const field = keyFieldFor(path, keyFields);
    if (field) {
      // Validation is performed by the walker. The comparator still needs to be order-insensitive
      // when this container is intentionally not expanded.
      const leftMap = new Map(left.map((item) => [record(item) ? item[field] : undefined, item]));
      const rightMap = new Map(right.map((item) => [record(item) ? item[field] : undefined, item]));
      return (
        leftMap.size === rightMap.size &&
        [...leftMap].every(
          ([key, value]) =>
            rightMap.has(key) &&
            deepEqual(value, rightMap.get(key), [...path, String(key)], keyFields),
        )
      );
    }
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqual(value, right[index], [...path, index], keyFields))
    );
  }
  if (record(left) && record(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key) => key in right && deepEqual(left[key], right[key], [...path, key], keyFields),
      )
    );
  }
  return false;
}
function match(m: PropertyMatcher, c: PropertyContext): boolean {
  if (typeof m === 'function') return m(c);
  const p = c.path.join('.');
  if (typeof m === 'string') return new RegExp(`^${m.split('*').map(escape).join('.*')}$`).test(p);
  m.lastIndex = 0;
  return m.test(p);
}
function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function selected(
  c: PropertyContext,
  selection?: { include?: PropertyMatcher[]; exclude?: PropertyMatcher[] },
): boolean {
  if (!selection) return true;
  if (selection.exclude?.some((m) => match(m, c))) return false;
  return !selection.include?.length || selection.include.some((m) => match(m, c));
}
function ruleFor(c: PropertyContext, rules?: DisplayRule[]): DisplayRule | undefined {
  return rules
    ?.filter(
      (r) =>
        (r.path === undefined ||
          (Array.isArray(r.path)
            ? pathId(r.path) === pathId(c.path)
            : r.path === c.path.join('.'))) &&
        (r.type === undefined || r.type === c.valueType) &&
        (!r.matcher || r.matcher(c)),
    )
    .sort((a, b) => score(a) - score(b))
    .at(-1);
}
function score(r: DisplayRule): number {
  return (
    Number(r.type !== undefined) +
    Number(r.matcher !== undefined) * 2 +
    Number(r.path !== undefined) * 4
  );
}
export type {
  BuildComparisonConfig,
  ComparisonRow,
  ComparisonVersion,
  DifferenceComparator,
  DifferenceIndicatorContext,
  DifferenceIndicatorSetting,
  DifferenceOptions,
  DisplayRule,
  KeyedArrayTarget,
  MergeEdit,
  MergeEdits,
  MergeOptions,
  MergePatch,
  MergeResolution,
  MergeResolutionKey,
  MergeResolutions,
  MergeResult,
  MergeScopeEntry,
  MergeScopeRole,
  MergeSourceDecision,
  PropertyDefinition,
  PropertyMatcher,
  PropertyPath,
  PropertySelection,
  PropertyType,
  SearchOptions,
  ValueRenderer,
} from './types';

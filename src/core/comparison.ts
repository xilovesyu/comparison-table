import type { BuildComparisonConfig, ComparisonRow, ComparisonVersion, DisplayRule, PropertyContext, PropertyDefinition, PropertyMatcher, PropertyPath, PropertyType, SearchOptions } from './types';

export const pathId = (path: PropertyPath): string => JSON.stringify(path);
export function getPropertyType(value: unknown): PropertyType {
  if (value === null) return 'null'; if (value === undefined) return 'undefined'; if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'array'; if (typeof value === 'object') return 'object';
  return ['boolean', 'number', 'string'].includes(typeof value) ? typeof value as PropertyType : 'unknown';
}
export function buildComparisonRows(versions: readonly ComparisonVersion[], config: BuildComparisonConfig = {}): ComparisonRow[] {
  validateVersions(versions);
  return config.propertyDefinitions ? fromDefinitions(config.propertyDefinitions, versions, config) : visit(versions.map((v) => v.data), versions, [], config, []);
}
export function filterComparisonRows(rows: readonly ComparisonRow[], query: string, options: SearchOptions = {}): ComparisonRow[] {
  const needle = query.trim().toLowerCase(); if (!needle) return [...rows];
  return rows.flatMap((row) => { const children = filterComparisonRows(row.children ?? [], query, options); const label = options.searchLabels !== false && row.property.label.toLowerCase().includes(needle); const value = options.searchValues !== false && Object.values(row.values).some((v) => String(v ?? '').toLowerCase().includes(needle)); return label || value || children.length ? [{ ...row, children: children.length ? children : row.children }] : []; });
}
function visit(values: unknown[], versions: readonly ComparisonVersion[], path: (string | number)[], config: BuildComparisonConfig, ancestors: readonly object[]): ComparisonRow[] {
  return unionKeys(values).flatMap((key) => { const nodeValues = values.map((value) => child(value, key)); const nodePath = [...path, key]; const context = ctx(String(key), nodePath, nodeValues[0], values[0]); const rule = ruleFor(context, config.rules); const expandable = nodeValues.some(container) && !nodeValues.some((v) => container(v) && ancestors.includes(v)); const children = expandable && rule?.expand !== false ? visit(nodeValues, versions, nodePath, config, [...ancestors, ...nodeValues.filter(container)]) : undefined; if (!selected(context, config.selection) && !children?.length) return []; return [row(String(key), nodePath, nodeValues, versions, context, children, rule)]; });
}
function fromDefinitions(defs: readonly PropertyDefinition[], versions: readonly ComparisonVersion[], config: BuildComparisonConfig, parentPath: (string | number)[] = []): ComparisonRow[] {
  return defs.flatMap((def) => { const path = def.path.length ? [...def.path] : [...parentPath, def.key]; const values = versions.map((v) => path.reduce(child, v.data)); const context = ctx(def.key, path, values[0], undefined); const rule = ruleFor(context, config.rules); if (!selected(context, config.selection)) return []; const children = def.children && rule?.expand !== false ? fromDefinitions(def.children, versions, config, path) : undefined; return [row(def.key, path, values, versions, context, children, rule, def)]; });
}
function row(key: string, path: (string | number)[], values: unknown[], versions: readonly ComparisonVersion[], context: PropertyContext, children?: ComparisonRow[], displayRule?: DisplayRule, def?: PropertyDefinition): ComparisonRow { const property: PropertyDefinition = { key, label: displayRule?.label ?? def?.label ?? key, path, level: path.length - 1, type: context.type, ...def }; return { id: pathId(path), property, values: Object.fromEntries(versions.map((v, i) => [v.id, values[i]])), children: children?.length ? children : undefined }; }
function unionKeys(values: unknown[]): (string | number)[] { const keys = new Set<string | number>(); values.forEach((v) => Array.isArray(v) ? v.forEach((_, i) => keys.add(i)) : record(v) ? Object.keys(v).forEach((key) => keys.add(key)) : undefined); return [...keys]; }
function child(value: unknown, key: string | number): unknown { if (Array.isArray(value)) return typeof key === 'number' ? value[key] : undefined; return record(value) ? value[key] : undefined; }
function record(value: unknown): value is Record<string | number, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date); }
function container(value: unknown): value is object { return Array.isArray(value) || record(value); }
function ctx(key: string, path: PropertyPath, value: unknown, parent: unknown): PropertyContext { return { key, path, value, parent, level: path.length - 1, type: getPropertyType(value) }; }
function validateVersions(versions: readonly ComparisonVersion[]): void { const ids = new Set<string>(); versions.forEach((v) => { if (ids.has(v.id)) throw new Error(`Duplicate version id: ${v.id}`); ids.add(v.id); }); }
function match(m: PropertyMatcher, c: PropertyContext): boolean { if (typeof m === 'function') return m(c); const p = c.path.join('.'); if (typeof m === 'string') return new RegExp(`^${m.split('*').map(escape).join('.*')}$`).test(p); m.lastIndex = 0; return m.test(p); }
function escape(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function selected(c: PropertyContext, selection?: { include?: PropertyMatcher[]; exclude?: PropertyMatcher[] }): boolean { if (!selection) return true; if (selection.exclude?.some((m) => match(m, c))) return false; return !selection.include?.length || selection.include.some((m) => match(m, c)); }
function ruleFor(c: PropertyContext, rules?: DisplayRule[]): DisplayRule | undefined { return rules?.filter((r) => (r.path === undefined || (Array.isArray(r.path) ? pathId(r.path) === pathId(c.path) : r.path === c.path.join('.'))) && (r.type === undefined || r.type === c.type) && (!r.matcher || r.matcher(c))).sort((a, b) => score(a) - score(b)).at(-1); }
function score(r: DisplayRule): number { return Number(r.type !== undefined) + Number(r.matcher !== undefined) * 2 + Number(r.path !== undefined) * 4; }
export type { BuildComparisonConfig, ComparisonRow, ComparisonVersion, DisplayRule, PropertyDefinition, PropertyMatcher, PropertyPath, PropertySelection, PropertyType, SearchOptions, ValueRenderer } from './types';

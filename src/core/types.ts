export type PropertyPath = readonly (string | number)[];

export type PropertyType =
  'array' | 'boolean' | 'date' | 'null' | 'number' | 'object' | 'string' | 'undefined' | 'unknown';

export interface ComparisonVersion<T = unknown> {
  id: string;
  label: string;
  data: T;
}

export interface PropertyDefinition {
  key: string;
  label: string;
  path: PropertyPath;
  level: number;
  type: PropertyType;
  children?: PropertyDefinition[];
  renderLabel?: (property: PropertyDefinition) => string;
  renderValue?: ValueRenderer;
  expandable?: boolean;
  defaultExpanded?: boolean;
  renderer?: string;
}

export interface PropertyContext {
  key: string;
  path: PropertyPath;
  value: unknown;
  parent?: unknown;
  level: number;
  type: PropertyType;
}
export type PropertyMatcher = string | RegExp | ((context: PropertyContext) => boolean);
export interface PropertySelection {
  include?: PropertyMatcher[];
  exclude?: PropertyMatcher[];
}
export interface DisplayRule {
  path?: PropertyPath | string;
  type?: PropertyType;
  matcher?: (context: PropertyContext) => boolean;
  expand?: boolean;
  label?: string;
  renderer?: string;
}
export interface ValueRenderContext extends PropertyContext {
  version: ComparisonVersion;
  property: PropertyDefinition;
}
export type ValueRenderer = (value: unknown, context: ValueRenderContext) => React.ReactNode;

export interface ComparisonRow {
  id: string;
  property: PropertyDefinition;
  values: Record<string, unknown>;
  children?: ComparisonRow[];
  hasDifference?: boolean;
}

export type DifferenceComparator = (
  values: readonly unknown[],
  context: PropertyContext,
) => boolean;

export interface DifferenceOptions {
  onlyDifferences?: boolean;
  baseVersionId?: string;
  comparator?: DifferenceComparator;
}

export interface BuildComparisonConfig {
  selection?: PropertySelection;
  rules?: DisplayRule[];
  propertyDefinitions?: PropertyDefinition[];
  comparison?: DifferenceOptions;
}
export interface SearchOptions {
  searchLabels?: boolean;
  searchValues?: boolean;
}

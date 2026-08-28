/** A path to a field in a version record. Numeric parts address array items. */
export type PropertyPath = readonly (string | number)[];

/** Value kinds recognized by the recursive walker and built-in renderers. */
export type PropertyType =
  'array' | 'boolean' | 'date' | 'null' | 'number' | 'object' | 'string' | 'undefined' | 'unknown';

/** A named data snapshot rendered as one comparison column. */
export interface ComparisonVersion<T = unknown> {
  /** Stable, unique column identifier. */
  id: string;
  /** Human-readable column title. */
  label: string;
  /** Data inspected recursively by the comparison table. */
  data: T;
}

/** An explicit display-tree node used to control order, labels, and hierarchy. */
export interface PropertyDefinition {
  /** Field identifier used when `path` is omitted. */
  key: string;
  /** Label displayed in the Property column. */
  label: string;
  /** Absolute path in each version's `data`. */
  path: PropertyPath;
  /** Visual nesting level for the supplied display tree. */
  level: number;
  /** Value kind used to select a built-in renderer. */
  type: PropertyType;
  /** Child nodes, which may flatten or reorder the source data tree. */
  children?: PropertyDefinition[];
  /** Optional label formatter for consumers building definitions programmatically. */
  renderLabel?: (property: PropertyDefinition) => string;
  /** Renderer that takes precedence over renderer registry selection. */
  renderValue?: ValueRenderer;
  /** Reserved metadata for consumers describing explicit expandability. */
  expandable?: boolean;
  /** Reserved metadata for consumers describing default expansion. */
  defaultExpanded?: boolean;
  /** Renderer name resolved from the local renderer registry. */
  renderer?: string;
  /** Per-node Diff badge setting that overrides inherited configuration. */
  differenceIndicator?: DifferenceIndicatorSetting;
  /** Per-node subtree-search setting that overrides inherited configuration. */
  nodeSearchable?: boolean;
}

/** Context used to select fields, match rules, and compare values. */
export interface PropertyContext {
  key: string;
  path: PropertyPath;
  value: unknown;
  parent?: unknown;
  level: number;
  type: PropertyType;
}
/** Glob-like path, regular expression, or predicate used to match a field. */
export type PropertyMatcher = string | RegExp | ((context: PropertyContext) => boolean);
/** Include/exclude controls applied while constructing the table rows. */
export interface PropertySelection {
  /** Fields to keep. Omit to retain every non-excluded field. */
  include?: PropertyMatcher[];
  /** Fields to omit. Exclusion takes precedence over inclusion. */
  exclude?: PropertyMatcher[];
}
/** Path, type, or predicate based presentation override. More-specific rules win. */
export interface DisplayRule {
  /** Exact dot path or path tuple to match. */
  path?: PropertyPath | string;
  /** Matches only values of this detected type. */
  type?: PropertyType;
  /** Additional business predicate for matching a property. */
  matcher?: (context: PropertyContext) => boolean;
  /** Set `false` to render a container only at its current level. */
  expand?: boolean;
  /** Replacement Property-column label. */
  label?: string;
  /** Local or built-in renderer name. */
  renderer?: string;
  /** Diff badge inherited by descendants unless they override it. */
  differenceIndicator?: DifferenceIndicatorSetting;
  /** Subtree-search affordance inherited by descendants unless overridden. */
  nodeSearchable?: boolean;
}
/** Context supplied to a custom value renderer. */
export interface ValueRenderContext extends PropertyContext {
  version: ComparisonVersion;
  property: PropertyDefinition;
}
/** Renders one version value in a comparison cell. */
export type ValueRenderer = (value: unknown, context: ValueRenderContext) => React.ReactNode;

/** A normalized recursive row returned by `buildComparisonRows`. */
export interface ComparisonRow {
  id: string;
  property: PropertyDefinition;
  values: Record<string, unknown>;
  children?: ComparisonRow[];
  hasDifference?: boolean;
  hasOwnDifference?: boolean;
  descendantDifferenceCount?: number;
  differenceIndicator?: DifferenceIndicatorSetting;
  nodeSearchable?: boolean;
}

/** Information passed to a custom Diff badge renderer. */
export interface DifferenceIndicatorContext {
  row: ComparisonRow;
  values: readonly unknown[];
  isDirectDifference: boolean;
  descendantDifferenceCount: number;
}
/** Enables, hides, or custom-renders a field's Diff badge. */
export type DifferenceIndicatorSetting =
  boolean | ((context: DifferenceIndicatorContext) => React.ReactNode);

/** Business comparison hook. Return `true` when the values should be considered different. */
export type DifferenceComparator = (
  values: readonly unknown[],
  context: PropertyContext,
) => boolean;

/** Options that control change detection, filtering, and the baseline column. */
export interface DifferenceOptions {
  /** Starts the table with unchanged rows hidden. Users can still toggle the control. */
  onlyDifferences?: boolean;
  /** Version id used as the baseline for default difference comparison. */
  baseVersionId?: string;
  /** Shows the `Base` marker beside the baseline version label. Defaults to `true`. */
  showBaselineBadge?: boolean;
  /** CSS class applied to the baseline header label. */
  baselineHeaderClassName?: string;
  /** CSS class applied to every baseline data cell. */
  baselineCellClassName?: string;
  /** Custom rule used instead of structural deep equality. */
  comparator?: DifferenceComparator;
  /** Default Diff badge setting inherited by all rows. */
  differenceIndicator?: DifferenceIndicatorSetting;
}

/** Data-walking and presentation configuration shared by the component and core builder. */
export interface BuildComparisonConfig {
  /** Selects the fields that take part in the comparison. */
  selection?: PropertySelection;
  /** Path/type based presentation rules. */
  rules?: DisplayRule[];
  /** Explicit field tree used for custom ordering or flattened display. */
  propertyDefinitions?: PropertyDefinition[];
  /** Difference, baseline, and indicator options. */
  comparison?: DifferenceOptions;
  /** Default subtree-search setting inherited by nodes. Defaults to `true`. */
  nodeSearchable?: boolean;
}
/** Options for the component's global property/value search. */
export interface SearchOptions {
  /** Searches Property-column labels unless set to `false`. */
  searchLabels?: boolean;
  /** Searches rendered raw values unless set to `false`. */
  searchValues?: boolean;
}

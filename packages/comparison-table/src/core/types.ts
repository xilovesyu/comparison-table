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
  /** Value kind used to select a built-in or consumer-defined renderer. */
  type: PropertyType | (string & {});
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
  /** Template expanded once for each keyed-array item when this definition addresses that array. */
  itemDefinition?: PropertyDefinition;
  /** Omits this array container while expanding its keyed item template. */
  flatten?: boolean;
}

/** Context used to select fields, match rules, and compare values. */
export interface PropertyContext {
  /** Last path segment of the field. */
  key: string;
  /** Absolute field path from a version's root data object. */
  path: PropertyPath;
  /** Value from the first version, when available. */
  value: unknown;
  /** Parent value from the first version, when available. */
  parent?: unknown;
  /** Zero-based nesting level. */
  level: number;
  /** Detected type of `value`. */
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
  /** Version whose column is currently being rendered. */
  version: ComparisonVersion;
  /** Normalized display definition for the current row. */
  property: PropertyDefinition;
}
/** Renders one version value in a comparison cell. */
export type ValueRenderer = (value: unknown, context: ValueRenderContext) => React.ReactNode;

/** A normalized recursive row returned by `buildComparisonRows`. */
export interface ComparisonRow {
  /** Stable, serialized path key used by Ant Design's row expansion. */
  id: string;
  /** Display metadata for the field. */
  property: PropertyDefinition;
  /** Raw values keyed by `ComparisonVersion.id`. */
  values: Record<string, unknown>;
  /** Recursive child rows when the property is expanded. */
  children?: ComparisonRow[];
  /** Whether this row or one of its descendants differs. */
  hasDifference?: boolean;
  /** Whether the row itself, rather than only descendants, differs. */
  hasOwnDifference?: boolean;
  /** Total differing descendant leaves, used by the default parent Diff badge. */
  descendantDifferenceCount?: number;
  /** Resolved setting used to render this row's Diff badge. */
  differenceIndicator?: DifferenceIndicatorSetting;
  /** Resolved setting that determines whether this row exposes subtree search. */
  nodeSearchable?: boolean;
  /** Business identity for a keyed-array item, when this row belongs to one. */
  itemIdentity?: string;
  /** Whether the keyed item exists in each version. */
  presence?: Record<string, boolean>;
}

/** Information passed to a custom Diff badge renderer. */
export interface DifferenceIndicatorContext {
  /** Current normalized row. */
  row: ComparisonRow;
  /** Values in version-column order. */
  values: readonly unknown[];
  /** `true` when this row itself differs. */
  isDirectDifference: boolean;
  /** Number of changed descendant leaves. */
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
  /** Maps an array's dot path to the field used to align its items between versions. */
  arrayItemKeyFields?: Record<string, string>;
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

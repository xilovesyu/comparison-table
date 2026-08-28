# @jxi/comparison-table

An Ant Design 5 React component for recursively comparing structured data across multiple versions. It renders one version per column and preserves nested context when filtering or showing differences.

## Installation

```bash
pnpm add @jxi/comparison-table antd @ant-design/icons react react-dom
```

`react`, `react-dom`, `antd`, and `@ant-design/icons` are peer dependencies and must be installed by the host application.

## Basic usage

```tsx
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
import '@jxi/comparison-table/styles.css';

const versions = [
  { id: 'draft', label: 'Draft', data: { customer: { name: 'Ava' } } },
  { id: 'final', label: 'Final', data: { customer: { name: 'Ava Lin' } } },
] satisfies ComparisonVersion[];

export function VersionComparison() {
  return <RecursiveComparisonTable versions={versions} />;
}
```

## Component props

`RecursiveComparisonTableProps` includes all options from `BuildComparisonConfig`, followed by these component-specific props.

| Prop                  | Type                           | Default      | Description                                                |
| --------------------- | ------------------------------ | ------------ | ---------------------------------------------------------- |
| `versions`            | `readonly ComparisonVersion[]` | required     | Ordered comparison columns. Each `id` must be unique.      |
| `renderers`           | `RendererOverrides`            | —            | Local renderer additions or overrides for this table only. |
| `searchable`          | `boolean`                      | `true`       | Shows the global property/value search input.              |
| `searchOptions`       | `SearchOptions`                | both enabled | Limits global search to labels and/or values.              |
| `expandAll`           | `boolean`                      | `true`       | Expands visible rows initially in uncontrolled mode.       |
| `defaultExpandedKeys` | `React.Key[]`                  | —            | Initial uncontrolled expansion keys.                       |
| `expandedKeys`        | `React.Key[]`                  | —            | Controlled expansion keys.                                 |
| `onExpandedChange`    | `(keys: React.Key[]) => void`  | —            | Receives expansion changes.                                |

### BuildComparisonConfig

| Prop                  | Type                   | Description                                                                                  |
| --------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `selection`           | `PropertySelection`    | Includes or excludes source fields by glob path, regular expression, or predicate.           |
| `rules`               | `DisplayRule[]`        | Applies path/type/predicate based labels, renderers, expansion, Diff, and node-search rules. |
| `propertyDefinitions` | `PropertyDefinition[]` | Defines the exact display tree; use it to reorder or flatten nested fields.                  |
| `comparison`          | `DifferenceOptions`    | Configures Diff detection, baseline rendering, and Diff badges.                              |
| `nodeSearchable`      | `boolean`              | Default node-level search setting inherited by descendants; defaults to `true`.              |

## Data and display configuration

### Versions and field selection

`ComparisonVersion` is `{ id, label, data }`. The component recursively unions object keys and array indices from every `data` value, so fields that are missing in one version remain visible.

```tsx
<RecursiveComparisonTable
  versions={versions}
  selection={{
    include: ['customer', 'customer.*', 'billing.*'],
    exclude: ['customer.password', 'internal.*'],
  }}
  rules={[
    { path: 'customer', label: 'Customer' },
    { path: 'billing.total', renderer: 'money', expand: false },
  ]}
/>
```

`PropertyMatcher` accepts a dot-path glob such as `lines.*`, a `RegExp`, or a `(context) => boolean` predicate. Exclusions take precedence.

### Explicit order and flattened hierarchy

Use `propertyDefinitions` when the source tree should not determine the table layout. Each definition has `key`, `label`, `path`, `level`, `type`, and optional `children`, `renderer`, `renderValue`, `differenceIndicator`, and `nodeSearchable` fields.

```tsx
const definitions = [
  {
    key: 'firstLine',
    label: 'lines[0]',
    path: ['lines', 0],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 0, 'sku'], level: 1, type: 'string' },
      {
        key: 'quantity',
        label: 'Quantity',
        path: ['lines', 0, 'quantity'],
        level: 1,
        type: 'number',
      },
    ],
  },
  { key: 'note', label: 'Note', path: ['note'], level: 0, type: 'string' },
];

<RecursiveComparisonTable versions={versions} propertyDefinitions={definitions} />;
```

This omits the `lines` container while rendering `lines[0]` and `note` side by side at the top level.

## Renderers

Built-in renderer names are `text`, `number`, `percentage`, `boolean`, `date`, `object`, `array`, and `money`. Select one with `DisplayRule.renderer` or `PropertyDefinition.renderer`.

`renderers` always creates a local view: it can add a new renderer or override one built-in without mutating `builtInRenderers` or affecting other tables.

```tsx
<RecursiveComparisonTable
  versions={versions}
  renderers={{
    localMoney: (value) => {
      const money = value as { amount: number; currency: string };
      return `${money.currency} ${money.amount.toFixed(0)}`;
    },
    money: (value) => `Local: ${String(value)}`,
  }}
  rules={[{ path: 'billing.total', renderer: 'localMoney' }]}
/>
```

For reusable composition, create a `RendererRegistry`, register renderers, and pass it as `renderers`. `createRendererRegistry(overrides)` clones built-ins first and then applies the supplied overrides.

## Diff and baseline options

`comparison` accepts these `DifferenceOptions`:

| Option                    | Type                   | Default             | Description                                                                         |
| ------------------------- | ---------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `onlyDifferences`         | `boolean`              | `false`             | Starts with unchanged rows hidden; parents with changed descendants remain visible. |
| `baseVersionId`           | `string`               | first version       | Compares default differences against this version and highlights its column.        |
| `showBaselineBadge`       | `boolean`              | `true`              | Shows the `Base` badge in the selected baseline header.                             |
| `baselineHeaderClassName` | `string`               | built-in class      | Replaces the header-label class for the baseline column.                            |
| `baselineCellClassName`   | `string`               | built-in class      | Replaces the baseline data-cell class.                                              |
| `comparator`              | `DifferenceComparator` | structural equality | Returns `true` when a field should count as different.                              |
| `differenceIndicator`     | `boolean \| function`  | `true`              | Enables, hides, or custom-renders Diff badges for all rows.                         |

Rules and property definitions can set `differenceIndicator` and `nodeSearchable` per node. Both settings inherit from their parent, so a parent can disable them and a child can explicitly re-enable them.

```tsx
<RecursiveComparisonTable
  versions={versions}
  comparison={{
    baseVersionId: 'draft',
    comparator: (values, context) =>
      context.path.join('.') === 'price'
        ? Math.max(...values.map(Number)) - Math.min(...values.map(Number)) > 10
        : values.some((value, index) => index > 0 && value !== values[0]),
  }}
  rules={[
    { path: 'customer', differenceIndicator: false, nodeSearchable: false },
    { path: 'customer.address', differenceIndicator: true, nodeSearchable: true },
  ]}
/>
```

## Search and expansion

- Global search is enabled by `searchable`; `searchOptions` can set `searchLabels` or `searchValues` to `false`.
- A container shows its search button when its resolved `nodeSearchable` value is `true`.
- Use `defaultExpandedKeys` for initial uncontrolled expansion, or `expandedKeys` plus `onExpandedChange` for controlled expansion. Keys are `JSON.stringify` values of field paths, for example `['lines', 0]` becomes `"[\"lines\",0]"`.

## Public exports

The package exports `RecursiveComparisonTable`, `RecursiveComparisonTableProps`, row-building and filtering helpers, renderer APIs, and the public configuration types: `ComparisonVersion`, `BuildComparisonConfig`, `PropertyDefinition`, `DisplayRule`, `PropertySelection`, `DifferenceOptions`, `SearchOptions`, `ValueRenderer`, and related context types.

For real configurations and the full interactive gallery, see the [repository demo](https://github.com/xilovesyu/comparison-table#readme).

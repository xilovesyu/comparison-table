import { Button, Input, Space, Switch, Table, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import {
  buildComparisonRows,
  filterComparisonRows,
  filterDifferenceRows,
  type BuildComparisonConfig,
  type ComparisonRow,
  type ComparisonVersion,
  type DifferenceOptions,
  type SearchOptions,
} from '../core/comparison';
import {
  createRendererRegistry,
  type RendererOverrides,
  RendererRegistry,
} from '../core/renderers';

export interface RecursiveComparisonTableProps extends BuildComparisonConfig {
  versions: readonly ComparisonVersion[];
  renderers?: RendererOverrides;
  searchable?: boolean;
  searchOptions?: SearchOptions;
  expandAll?: boolean;
  defaultExpandedKeys?: React.Key[];
  expandedKeys?: React.Key[];
  onExpandedChange?: (keys: React.Key[]) => void;
}
export function RecursiveComparisonTable({
  versions,
  renderers,
  searchable = true,
  searchOptions,
  expandAll = true,
  defaultExpandedKeys,
  expandedKeys,
  onExpandedChange,
  ...config
}: RecursiveComparisonTableProps) {
  const [query, setQuery] = useState('');
  const [onlyDifferences, setOnlyDifferences] = useState(
    config.comparison?.onlyDifferences ?? false,
  );
  const [openNodeSearches, setOpenNodeSearches] = useState<React.Key[]>([]);
  const [nodeQueries, setNodeQueries] = useState<Record<string, string>>({});
  const rows = useMemo(() => buildComparisonRows(versions, config), [versions, config]);
  const differenceRows = useMemo(() => filterDifferenceRows(rows), [rows]);
  const locallyFilteredRows = useMemo(
    () => applyNodeFilters(onlyDifferences ? differenceRows : rows, nodeQueries),
    [onlyDifferences, differenceRows, rows, nodeQueries],
  );
  const visibleRows = useMemo(
    () => filterComparisonRows(locallyFilteredRows, query, searchOptions),
    [locallyFilteredRows, query, searchOptions],
  );
  const allKeys = useMemo(() => collectKeys(visibleRows), [visibleRows]);
  const [internalExpanded, setInternalExpanded] = useState<React.Key[]>(
    defaultExpandedKeys ?? (expandAll ? allKeys : []),
  );
  const activeExpanded =
    query || Object.values(nodeQueries).some(Boolean)
      ? allKeys
      : (expandedKeys ?? internalExpanded);
  const registry = useMemo(() => createRendererRegistry(renderers), [renderers]);
  const baselineId = config.comparison?.baseVersionId;
  const columns: ColumnsType<ComparisonRow> = [
    {
      title: 'Property',
      key: 'property',
      width: 300,
      render: (_: unknown, row) => (
        <PropertyCell
          row={row}
          open={openNodeSearches.includes(row.id)}
          query={nodeQueries[row.id] ?? ''}
          differenceIndicator={config.comparison?.differenceIndicator}
          onToggle={() =>
            setOpenNodeSearches((ids) =>
              ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id],
            )
          }
          onQuery={(value) => setNodeQueries((queries) => ({ ...queries, [row.id]: value }))}
        />
      ),
    },
    ...versions.map((version) => {
      const isBaseline = baselineId === version.id;
      const headerClassName = isBaseline
        ? (config.comparison?.baselineHeaderClassName ?? 'comparison-baseline-header')
        : undefined;
      return {
        title: (
          <span className="comparison-version-header">
            <span className={headerClassName}>{version.label}</span>
            {isBaseline && (
              <span className="comparison-baseline-badge" aria-label="Base">
                Base
              </span>
            )}
          </span>
        ),
        key: version.id,
        className: isBaseline
          ? (config.comparison?.baselineCellClassName ?? 'comparison-baseline-cell')
          : undefined,
        render: (_: unknown, row: ComparisonRow) => renderValue(row, version, registry),
      };
    }),
  ];
  return (
    <section aria-label="Recursive comparison table">
      <div className="comparison-toolbar">
        {searchable && (
          <Input
            aria-label="Search comparison"
            allowClear
            placeholder="Search properties and values"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        <Space className="comparison-difference-control">
          <Switch
            aria-label="Only show differences"
            checked={onlyDifferences}
            onChange={setOnlyDifferences}
          />
          <Typography.Text>仅显示差异（{countRows(differenceRows)}）</Typography.Text>
        </Space>
      </div>
      <Table<ComparisonRow>
        rowKey="id"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
        rowClassName={(row) =>
          row.hasOwnDifference
            ? 'comparison-row-difference'
            : row.hasDifference
              ? 'comparison-row-difference-parent'
              : ''
        }
        expandable={{
          expandedRowKeys: activeExpanded,
          onExpandedRowsChange: (keys) => {
            const nextKeys = [...keys];
            if (!expandedKeys) setInternalExpanded(nextKeys);
            onExpandedChange?.(nextKeys);
          },
        }}
      />
    </section>
  );
}
function PropertyCell({
  row,
  open,
  query,
  onToggle,
  onQuery,
  differenceIndicator,
}: {
  row: ComparisonRow;
  open: boolean;
  query: string;
  onToggle: () => void;
  onQuery: (value: string) => void;
  differenceIndicator: DifferenceOptions['differenceIndicator'];
}) {
  const expandable = Boolean(row.children?.length);
  return (
    <div className="comparison-property-cell">
      <span>{row.property.label}</span>
      <DifferenceIndicator row={row} indicator={differenceIndicator} />
      {expandable && (
        <Button
          aria-label={`Search within ${row.property.label}`}
          type="text"
          size="small"
          icon={<SearchOutlined />}
          onClick={onToggle}
        />
      )}
      {open && (
        <Input
          aria-label={`Filter ${row.property.label} children`}
          size="small"
          allowClear
          value={query}
          placeholder={`Filter ${row.property.label}`}
          onChange={(event) => onQuery(event.target.value)}
        />
      )}
    </div>
  );
}
function DifferenceIndicator({
  row,
  indicator,
}: {
  row: ComparisonRow;
  indicator: DifferenceOptions['differenceIndicator'];
}) {
  if (!row.hasDifference || indicator === false) return null;
  const info = {
    row,
    values: Object.values(row.values),
    isDirectDifference: Boolean(row.hasOwnDifference),
    descendantDifferenceCount: row.descendantDifferenceCount ?? 0,
  };
  if (typeof indicator === 'function') return <>{indicator(info)}</>;
  return (
    <span
      className={`comparison-difference-badge ${
        info.isDirectDifference
          ? 'comparison-difference-badge-direct'
          : 'comparison-difference-badge-parent'
      }`}
      aria-label="Diff"
    >
      Diff
      {info.descendantDifferenceCount > 0 && <sup>{info.descendantDifferenceCount}</sup>}
    </span>
  );
}
function renderValue(row: ComparisonRow, version: ComparisonVersion, registry: RendererRegistry) {
  const value = row.values[version.id];
  const context = {
    key: row.property.key,
    path: row.property.path,
    value,
    level: row.property.level,
    type: row.property.type,
    version,
    property: row.property,
  };
  return (
    row.property.renderValue?.(value, context) ??
    (registry.get(row.property.renderer ?? row.property.type) ?? registry.get('text'))?.(
      value,
      context,
    )
  );
}
function collectKeys(rows: readonly ComparisonRow[]): React.Key[] {
  return rows.flatMap((row) => [row.id, ...collectKeys(row.children ?? [])]);
}
function applyNodeFilters(
  rows: readonly ComparisonRow[],
  queries: Readonly<Record<string, string>>,
): ComparisonRow[] {
  return rows.map((row) => {
    const children = row.children ? applyNodeFilters(row.children, queries) : undefined;
    const ownQuery = queries[row.id];
    return {
      ...row,
      children: ownQuery ? filterComparisonRows(children ?? [], ownQuery) : children,
    };
  });
}
function countRows(rows: readonly ComparisonRow[]): number {
  return rows.reduce((count, row) => count + 1 + countRows(row.children ?? []), 0);
}

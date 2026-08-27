import { Button, Input, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import {
  buildComparisonRows,
  filterComparisonRows,
  type BuildComparisonConfig,
  type ComparisonRow,
  type ComparisonVersion,
  type SearchOptions,
} from '../core/comparison';
import { builtInRenderers, RendererRegistry } from '../core/renderers';

export interface RecursiveComparisonTableProps extends BuildComparisonConfig {
  versions: readonly ComparisonVersion[];
  renderers?: RendererRegistry;
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
  const [openNodeSearches, setOpenNodeSearches] = useState<React.Key[]>([]);
  const [nodeQueries, setNodeQueries] = useState<Record<string, string>>({});
  const rows = useMemo(() => buildComparisonRows(versions, config), [versions, config]);
  const locallyFilteredRows = useMemo(
    () => applyNodeFilters(rows, nodeQueries),
    [rows, nodeQueries],
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
  const registry = renderers ?? builtInRenderers;
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
          onToggle={() =>
            setOpenNodeSearches((ids) =>
              ids.includes(row.id) ? ids.filter((id) => id !== row.id) : [...ids, row.id],
            )
          }
          onQuery={(value) => setNodeQueries((queries) => ({ ...queries, [row.id]: value }))}
        />
      ),
    },
    ...versions.map((version) => ({
      title: version.label,
      key: version.id,
      render: (_: unknown, row: ComparisonRow) => renderValue(row, version, registry),
    })),
  ];
  return (
    <section aria-label="Recursive comparison table">
      {searchable && (
        <Input
          aria-label="Search comparison"
          allowClear
          placeholder="Search properties and values"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <Table<ComparisonRow>
        rowKey="id"
        columns={columns}
        dataSource={visibleRows}
        pagination={false}
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
}: {
  row: ComparisonRow;
  open: boolean;
  query: string;
  onToggle: () => void;
  onQuery: (value: string) => void;
}) {
  const expandable = Boolean(row.children?.length);
  return (
    <div className="comparison-property-cell">
      <span>{row.property.label}</span>
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

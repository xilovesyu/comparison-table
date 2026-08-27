import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { buildComparisonRows, filterComparisonRows, type BuildComparisonConfig, type ComparisonRow, type ComparisonVersion, type SearchOptions } from '../core/comparison';
import { builtInRenderers, RendererRegistry } from '../core/renderers';

export interface RecursiveComparisonTableProps extends BuildComparisonConfig { versions: readonly ComparisonVersion[]; renderers?: RendererRegistry; searchable?: boolean; searchOptions?: SearchOptions; expandAll?: boolean; defaultExpandedKeys?: React.Key[]; expandedKeys?: React.Key[]; onExpandedChange?: (keys: React.Key[]) => void; }
export function RecursiveComparisonTable({ versions, renderers, searchable = true, searchOptions, expandAll = true, defaultExpandedKeys, expandedKeys, onExpandedChange, ...config }: RecursiveComparisonTableProps) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => buildComparisonRows(versions, config), [versions, config]);
  const visibleRows = useMemo(() => filterComparisonRows(rows, query, searchOptions), [rows, query, searchOptions]);
  const allKeys = useMemo(() => collectKeys(visibleRows), [visibleRows]);
  const [internalExpanded, setInternalExpanded] = useState<React.Key[]>(defaultExpandedKeys ?? (expandAll ? allKeys : []));
  const activeExpanded = query ? allKeys : expandedKeys ?? internalExpanded;
  const registry = renderers ?? builtInRenderers;
  const columns: ColumnsType<ComparisonRow> = [{ title: 'Property', dataIndex: ['property', 'label'], key: 'property', width: 260 }, ...versions.map((version) => ({ title: version.label, key: version.id, render: (_: unknown, row: ComparisonRow) => renderValue(row, version, registry) }))];
  return <section aria-label="Recursive comparison table">
    {searchable && <Input aria-label="Search comparison" allowClear placeholder="Search properties and values" value={query} onChange={(event) => setQuery(event.target.value)} />}
    <Table<ComparisonRow> rowKey="id" columns={columns} dataSource={visibleRows} pagination={false} expandable={{ expandedRowKeys: activeExpanded, onExpandedRowsChange: (keys) => { const nextKeys = [...keys]; if (!expandedKeys) setInternalExpanded(nextKeys); onExpandedChange?.(nextKeys); } }} />
  </section>;
}
function renderValue(row: ComparisonRow, version: ComparisonVersion, registry: RendererRegistry) { const value = row.values[version.id]; const context = { key: row.property.key, path: row.property.path, value, level: row.property.level, type: row.property.type, version, property: row.property }; return row.property.renderValue?.(value, context) ?? (registry.get(row.property.type) ?? registry.get('text'))?.(value, context); }
function collectKeys(rows: readonly ComparisonRow[]): React.Key[] { return rows.flatMap((row) => [row.id, ...collectKeys(row.children ?? [])]); }

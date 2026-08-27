import source from './FlattenedExample.tsx?raw';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type PropertyDefinition,
} from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const arrayVersions = [
  {
    id: 'a',
    label: '版本 A',
    data: {
      lines: [
        { sku: 'A-1', quantity: 1 },
        { sku: 'B-2', quantity: 2 },
      ],
      note: null,
    },
  },
  {
    id: 'b',
    label: '版本 B',
    data: {
      lines: [
        { sku: 'A-1', quantity: 3 },
        { sku: 'C-3', quantity: 1 },
      ],
      introducedLater: 'available only in B',
    },
  },
] satisfies ComparisonVersion[];
const flattenedLineDefinitions = [
  {
    key: 'line0',
    label: 'lines[0]',
    path: ['lines', 0],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 0, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 0, 'quantity'], level: 1, type: 'number' },
    ],
  },
  { key: 'note', label: '备注', path: ['note'], level: 0, type: 'string' },
  {
    key: 'line1',
    label: 'lines[1]',
    path: ['lines', 1],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 1, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 1, 'quantity'], level: 1, type: 'number' },
    ],
  },
] satisfies PropertyDefinition[];

export function FlattenedExample() {
  return (
    <ExampleCard
      title="自定义顺序与扁平层级"
      description="展示定义决定顺序与层级：数组父级 lines 被移除，数组项和备注提升为顶层。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={arrayVersions}
        propertyDefinitions={flattenedLineDefinitions}
      />
    </ExampleCard>
  );
}

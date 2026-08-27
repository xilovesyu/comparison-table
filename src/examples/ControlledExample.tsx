import source from './ControlledExample.tsx?raw';
import { useState } from 'react';
import { RecursiveComparisonTable } from '../components/RecursiveComparisonTable';
import type { ComparisonVersion } from '../core/comparison';
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

export function ControlledExample() {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['["lines"]']);
  return (
    <ExampleCard
      title="受控展开、数组与缺失值"
      description="数组按索引对齐；空值、缺失字段和新增字段均保持可见。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={arrayVersions}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      />
    </ExampleCard>
  );
}

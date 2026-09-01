import source from './KeyedArrayExample.tsx?raw';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const keyedVersions = [
  {
    id: 'initial',
    label: '初始版',
    data: {
      lines: [
        { sku: 'P-100', quantity: 1 },
        { sku: 'P-200', quantity: 2 },
      ],
    },
  },
  {
    id: 'review',
    label: '复核版',
    data: {
      lines: [
        { sku: 'P-200', quantity: 2 },
        { sku: 'P-100', quantity: 3 },
        { sku: 'P-300', quantity: 1 },
      ],
    },
  },
] satisfies ComparisonVersion[];

export function KeyedArrayExample() {
  return (
    <ExampleCard
      title="业务键数组对齐"
      description="通过 SKU 对齐数组项目；重排不会产生差异，新增、删除和同项目字段修改会按业务项展示。"
      code={source}
    >
      <RecursiveComparisonTable versions={keyedVersions} arrayItemKeyFields={{ lines: 'sku' }} />
    </ExampleCard>
  );
}

import source from './DiffExample.tsx?raw';
import { RecursiveComparisonTable } from '../components/RecursiveComparisonTable';
import type { ComparisonVersion } from '../core/comparison';
import { ExampleCard } from './ExampleCard';

const diffVersions = [
  {
    id: 'baseline',
    label: '基准版',
    data: { product: { name: 'Starter', price: 100, currency: 'USD' }, stable: 'unchanged' },
  },
  {
    id: 'review',
    label: '复核版',
    data: { product: { name: 'Starter', price: 103, currency: 'USD' }, stable: 'unchanged' },
  },
  {
    id: 'final',
    label: '最终版',
    data: { product: { name: 'Starter Plus', price: 135, currency: 'USD' }, stable: 'unchanged' },
  },
] satisfies ComparisonVersion[];

export function DiffExample() {
  return (
    <ExampleCard
      title="自动 Diff 与自定义比较"
      description="自动标记差异、保留父级上下文并隐藏相同字段。此处以基准版比较，价格差异小于 10 时由业务 comparator 视为相同。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={diffVersions}
        comparison={{
          onlyDifferences: true,
          baseVersionId: 'baseline',
          comparator: (values, context) => {
            if (context.path.join('.') !== 'product.price') return false;
            const prices = values.map(Number);
            return Math.max(...prices) - Math.min(...prices) > 10;
          },
        }}
      />
    </ExampleCard>
  );
}

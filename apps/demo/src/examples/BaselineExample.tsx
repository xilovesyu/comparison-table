import source from './BaselineExample.tsx?raw';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
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

export function BaselineExample() {
  return (
    <ExampleCard
      title="基准列高亮"
      description="指定 baseVersionId 后突出基准列并显示 Base 标签；表头与单元格 className 均可按业务主题覆盖。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={diffVersions}
        comparison={{
          baseVersionId: 'baseline',
          baselineHeaderClassName: 'example-baseline-header',
          baselineCellClassName: 'example-baseline-cell',
        }}
      />
    </ExampleCard>
  );
}

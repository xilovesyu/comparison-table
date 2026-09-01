import source from './ContainerSummaryExample.tsx?raw';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const summaryVersions = [
  { id: 'draft', label: '草稿', data: { package: { items: 2, weight: 3.4 } } },
  { id: 'review', label: '复核', data: { package: { items: 3, weight: 4.1 } } },
] satisfies ComparisonVersion[];

export function ContainerSummaryExample() {
  return (
    <ExampleCard title="容器摘要" description="收起的对象和数组可显示自定义摘要。" code={source}>
      <RecursiveComparisonTable
        versions={summaryVersions}
        rules={[{ path: 'package', expand: false }]}
        containerSummary={(value) =>
          typeof value === 'object' && value !== null
            ? `字段数：${Object.keys(value).length}`
            : undefined
        }
      />
    </ExampleCard>
  );
}

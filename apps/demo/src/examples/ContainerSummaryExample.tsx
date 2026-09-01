import source from './ContainerSummaryExample.tsx?raw';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const summaryVersions = [
  {
    id: 'draft',
    label: '草稿',
    data: {
      package: { items: 2, detail: 'x'.repeat(10000) },
      tags: ['fragile', 'express', 'insured'],
      nullable: undefined,
      optional: undefined,
    },
  },
  {
    id: 'review',
    label: '复核',
    data: {
      package: { items: 3, detail: 'x'.repeat(10000) },
      tags: ['fragile', 'express'],
      nullable: null,
      optional: undefined,
    },
  },
] satisfies ComparisonVersion[];

export function ContainerSummaryExample() {
  return (
    <ExampleCard
      title="容器摘要"
      description="收起的对象和数组可显示安全摘要，null 与 undefined 保持原始输出。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={summaryVersions}
        rules={[
          { path: 'package', expand: false },
          { path: 'tags', expand: false },
        ]}
        containerSummary={(value) =>
          typeof value === 'object' && value !== null && !Array.isArray(value)
            ? `字段数：${Object.keys(value).length}`
            : undefined
        }
      />
    </ExampleCard>
  );
}

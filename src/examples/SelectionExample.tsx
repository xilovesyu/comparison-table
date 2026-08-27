import source from './SelectionExample.tsx?raw';
import { RecursiveComparisonTable } from '../components/RecursiveComparisonTable';
import type { ComparisonVersion } from '../core/comparison';
import { ExampleCard } from './ExampleCard';

const restrictedVersions = [
  {
    id: 'old',
    label: '旧版',
    data: {
      customer: { name: 'Ava', email: 'ava@example.com', password: 'hidden' },
      internal: { traceId: 'abc' },
      status: 'ACTIVE',
    },
  },
  {
    id: 'new',
    label: '新版',
    data: {
      customer: { name: 'Ava Lin', email: 'ava.lin@example.com', password: 'changed' },
      internal: { traceId: 'def' },
      status: 'SUSPENDED',
    },
  },
] satisfies ComparisonVersion[];

export function SelectionExample() {
  return (
    <ExampleCard
      title="属性选择与路径覆盖"
      description="只保留 customer 与 status；排除密码和内部追踪字段。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={restrictedVersions}
        selection={{
          include: ['customer.*', 'status'],
          exclude: ['customer.password', 'internal.*'],
        }}
        rules={[{ path: 'customer', label: '客户资料' }]}
      />
    </ExampleCard>
  );
}

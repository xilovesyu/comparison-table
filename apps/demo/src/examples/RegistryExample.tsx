import source from './RegistryExample.tsx?raw';
import { Space, Typography } from 'antd';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const registryVersions = [
  {
    id: 'draft',
    label: '草稿',
    data: { status: 'ACTIVE', money: { amount: 1250, currency: 'USD' } },
  },
  {
    id: 'final',
    label: '最终版',
    data: { status: 'SUSPENDED', money: { amount: 1480, currency: 'USD' } },
  },
] satisfies ComparisonVersion[];
const localRendererDefinitions = {
  statusBadge: (value: unknown) => `状态标记：${String(value)}`,
  money: (value: unknown) => {
    if (typeof value === 'object' && value !== null && 'amount' in value && 'currency' in value) {
      const money = value as { amount: number; currency: string };
      return `本地金额：${money.currency} ${money.amount.toFixed(0)}`;
    }
    return '—';
  },
};

export function RegistryExample() {
  return (
    <ExampleCard
      title="局部 Renderer Registry"
      description="每张表创建独立的 renderer 视图：可新增 statusBadge，也可局部重写 money；右侧默认表继续使用内置 money。"
      code={source}
    >
      <Space direction="vertical" size="middle" className="registry-example">
        <Typography.Text type="secondary">局部配置：新增状态标记并重写金额</Typography.Text>
        <RecursiveComparisonTable
          versions={registryVersions}
          searchable={false}
          renderers={localRendererDefinitions}
          rules={[
            { path: 'status', renderer: 'statusBadge', label: '状态' },
            { path: 'money', renderer: 'money', label: '金额' },
          ]}
        />
        <Typography.Text type="secondary">未传入配置：仍使用内置 money</Typography.Text>
        <RecursiveComparisonTable
          versions={registryVersions}
          searchable={false}
          rules={[{ path: 'money', renderer: 'money', label: '金额' }]}
        />
      </Space>
    </ExampleCard>
  );
}


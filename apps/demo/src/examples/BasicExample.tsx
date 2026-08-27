import source from './BasicExample.tsx?raw';
import { RecursiveComparisonTable, type ComparisonVersion } from '@jxi/comparision-table';
import { ExampleCard } from './ExampleCard';

const peopleVersions = [
  {
    id: 'draft',
    label: '草稿',
    data: {
      user: { name: 'John', age: 20, address: { city: 'Beijing', country: 'China' } },
      money: { amount: 100, currency: 'USD' },
      summaryMoney: { amount: 1200, currency: 'USD' },
      enabled: true,
    },
  },
  {
    id: 'review',
    label: '审核版',
    data: {
      user: { name: 'Jack', age: 21, address: { city: 'Shanghai', country: 'China' } },
      money: { amount: 200, currency: 'USD' },
      summaryMoney: { amount: 1500, currency: 'USD' },
      enabled: false,
    },
  },
  {
    id: 'final',
    label: '最终版',
    data: {
      user: { name: 'John', age: 22, address: { city: 'Shenzhen', country: 'China' } },
      money: { amount: 300, currency: 'USD' },
      summaryMoney: { amount: 1800, currency: 'USD' },
      enabled: true,
    },
  },
] satisfies ComparisonVersion[];

export function BasicExample() {
  return (
    <ExampleCard
      title="基础递归对比"
      description="任意版本数量、递归对象、全局搜索和节点级子树搜索。汇总金额演示只展示第一层级。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={peopleVersions}
        rules={[
          { path: 'money', renderer: 'money', label: '金额' },
          { path: 'summaryMoney', renderer: 'money', expand: false, label: '汇总金额（仅一级）' },
          { path: 'user', label: '用户信息' },
        ]}
      />
    </ExampleCard>
  );
}

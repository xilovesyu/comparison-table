import { Card, ConfigProvider, Space, Typography } from 'antd';
import { useState } from 'react';
import { RecursiveComparisonTable } from './components/RecursiveComparisonTable';
import type { ComparisonVersion } from './core/comparison';

const peopleVersions = [
  { id: 'draft', label: '草稿', data: { user: { name: 'John', age: 20, address: { city: 'Beijing', country: 'China' } }, money: { amount: 100, currency: 'USD' }, enabled: true } },
  { id: 'review', label: '审核版', data: { user: { name: 'Jack', age: 21, address: { city: 'Shanghai', country: 'China' } }, money: { amount: 200, currency: 'USD' }, enabled: false } },
  { id: 'final', label: '最终版', data: { user: { name: 'John', age: 22, address: { city: 'Shenzhen', country: 'China' } }, money: { amount: 300, currency: 'USD' }, enabled: true } },
] satisfies ComparisonVersion[];
const restrictedVersions = [
  { id: 'old', label: '旧版', data: { customer: { name: 'Ava', email: 'ava@example.com', password: 'hidden' }, internal: { traceId: 'abc' }, status: 'ACTIVE' } },
  { id: 'new', label: '新版', data: { customer: { name: 'Ava Lin', email: 'ava.lin@example.com', password: 'changed' }, internal: { traceId: 'def' }, status: 'SUSPENDED' } },
] satisfies ComparisonVersion[];
const orderVersions = [
  { id: 'v1', label: 'V1', data: { order: { money: { amount: 1250, currency: 'USD' }, ratio: 0.125, placedAt: new Date('2026-08-22T10:20:00Z') } } },
  { id: 'v2', label: 'V2', data: { order: { money: { amount: 1450, currency: 'USD' }, ratio: 0.2, placedAt: new Date('2026-08-23T10:20:00Z') } } },
] satisfies ComparisonVersion[];
const arrayVersions = [
  { id: 'a', label: '版本 A', data: { lines: [{ sku: 'A-1', quantity: 1 }, { sku: 'B-2', quantity: 2 }], note: null } },
  { id: 'b', label: '版本 B', data: { lines: [{ sku: 'A-1', quantity: 3 }, { sku: 'C-3', quantity: 1 }], introducedLater: 'available only in B' } },
] satisfies ComparisonVersion[];

export function App() {
  return <ConfigProvider theme={{ token: { colorPrimary: '#155eef', borderRadius: 8 } }}><main>
    <Typography.Title>递归多版本数据对比表</Typography.Title>
    <Typography.Paragraph>面向 Ant Design 风格的组件示例。每个可展开属性旁都有搜索按钮，可仅筛选该属性的子树。</Typography.Paragraph>
    <Space direction="vertical" size="large" className="example-list">
      <Example title="基础递归对比" description="任意版本数量、递归对象、全局搜索和节点级子树搜索。"><RecursiveComparisonTable versions={peopleVersions} rules={[{ path: 'money', expand: false, label: '金额' }, { path: 'user', label: '用户信息' }]} /></Example>
      <Example title="属性选择与路径覆盖" description="只保留 customer 与 status；排除密码和内部追踪字段。"><RecursiveComparisonTable versions={restrictedVersions} selection={{ include: ['customer.*', 'status'], exclude: ['customer.password', 'internal.*'] }} rules={[{ path: 'customer', label: '客户资料' }]} /></Example>
      <Example title="自定义渲染器" description="Property Definition 可独立控制每个字段的展示。"><RecursiveComparisonTable versions={orderVersions} propertyDefinitions={[{ key: 'money', label: '订单金额', path: ['order', 'money'], level: 1, type: 'object', renderValue: (value) => { const money = value as { amount: number; currency: string }; return new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currency }).format(money.amount); } }, { key: 'ratio', label: '完成率', path: ['order', 'ratio'], level: 1, type: 'number', renderValue: (value) => `${Number(value) * 100}%` }, { key: 'placedAt', label: '下单时间', path: ['order', 'placedAt'], level: 1, type: 'date' }]} /></Example>
      <ControlledExample />
    </Space>
  </main></ConfigProvider>;
}
function ControlledExample() { const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['["lines"]']); return <Example title="受控展开、数组与缺失值" description="数组按索引对齐；空值、缺失字段和新增字段均保持可见。"><RecursiveComparisonTable versions={arrayVersions} expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} /></Example>; }
function Example({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <Card className="example-card"><Typography.Title level={2}>{title}</Typography.Title><Typography.Paragraph type="secondary">{description}</Typography.Paragraph>{children}</Card>; }

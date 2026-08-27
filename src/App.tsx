import { Button, Card, ConfigProvider, Space, Typography } from 'antd';
import { useState } from 'react';
import { RecursiveComparisonTable } from './components/RecursiveComparisonTable';
import type { ComparisonVersion, PropertyDefinition } from './core/comparison';

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
const orderVersions = [
  {
    id: 'v1',
    label: 'V1',
    data: {
      order: {
        money: { amount: 1250, currency: 'USD' },
        ratio: 0.125,
        placedAt: new Date('2026-08-22T10:20:00Z'),
      },
    },
  },
  {
    id: 'v2',
    label: 'V2',
    data: {
      order: {
        money: { amount: 1450, currency: 'USD' },
        ratio: 0.2,
        placedAt: new Date('2026-08-23T10:20:00Z'),
      },
    },
  },
] satisfies ComparisonVersion[];
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
const flattenedLineDefinitions = [
  {
    key: 'line0',
    label: 'lines[0]',
    path: ['lines', 0],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 0, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 0, 'quantity'], level: 1, type: 'number' },
    ],
  },
  { key: 'note', label: '备注', path: ['note'], level: 0, type: 'string' },
  {
    key: 'line1',
    label: 'lines[1]',
    path: ['lines', 1],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 1, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 1, 'quantity'], level: 1, type: 'number' },
    ],
  },
] satisfies PropertyDefinition[];
const advancedVersions = [
  {
    id: 'baseline',
    label: '初始版',
    data: {
      customer: { name: 'Mia Chen', tier: 'GOLD', secret: 'baseline-only' },
      billing: {
        money: { amount: 980, currency: 'USD' },
        summaryMoney: { amount: 1200, currency: 'USD' },
      },
      lines: [
        { sku: 'P-100', quantity: 1 },
        { sku: 'P-200', quantity: 2 },
      ],
      note: null,
      internal: { auditId: 'initial-audit' },
    },
  },
  {
    id: 'review',
    label: '复核版',
    data: {
      customer: { name: 'Mia Chen', tier: 'PLATINUM', secret: 'review-only' },
      billing: {
        money: { amount: 1100, currency: 'USD' },
        summaryMoney: { amount: 1500, currency: 'USD' },
      },
      lines: [
        { sku: 'P-100', quantity: 2 },
        { sku: 'P-300', quantity: 1 },
      ],
      note: 'priority shipment',
      availability: 'available in review',
      internal: { auditId: 'review-audit' },
    },
  },
  {
    id: 'final',
    label: '最终版',
    data: {
      customer: { name: 'Mia Chen', tier: 'PLATINUM', secret: 'final-only' },
      billing: {
        money: { amount: 1280, currency: 'USD' },
        summaryMoney: { amount: 1680, currency: 'USD' },
      },
      lines: [
        { sku: 'P-100', quantity: 2 },
        { sku: 'P-300', quantity: 3 },
      ],
      note: 'priority shipment',
      availability: 'available in review',
      internal: { auditId: 'final-audit' },
    },
  },
] satisfies ComparisonVersion[];
const advancedDefinitions = [
  {
    key: 'customer',
    label: '客户信息',
    path: ['customer'],
    level: 0,
    type: 'object',
    children: [
      {
        key: 'name',
        label: '客户名称',
        path: ['customer', 'name'],
        level: 1,
        type: 'string',
        renderValue: (value) => String(value).toUpperCase(),
      },
      { key: 'tier', label: '客户等级', path: ['customer', 'tier'], level: 1, type: 'string' },
      { key: 'secret', label: 'secret', path: ['customer', 'secret'], level: 1, type: 'string' },
    ],
  },
  {
    key: 'billingMoney',
    label: '结算金额（可展开）',
    path: ['billing', 'money'],
    level: 0,
    type: 'object',
    children: [
      {
        key: 'amount',
        label: '金额',
        path: ['billing', 'money', 'amount'],
        level: 1,
        type: 'number',
      },
      {
        key: 'currency',
        label: '币种',
        path: ['billing', 'money', 'currency'],
        level: 1,
        type: 'string',
      },
    ],
  },
  {
    key: 'summaryMoney',
    label: '总计（仅一级）',
    path: ['billing', 'summaryMoney'],
    level: 0,
    type: 'object',
  },
  {
    key: 'line0',
    label: 'lines[0]',
    path: ['lines', 0],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 0, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 0, 'quantity'], level: 1, type: 'number' },
    ],
  },
  { key: 'note', label: '备注', path: ['note'], level: 0, type: 'string' },
  {
    key: 'line1',
    label: 'lines[1]',
    path: ['lines', 1],
    level: 0,
    type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 1, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 1, 'quantity'], level: 1, type: 'number' },
    ],
  },
  { key: 'availability', label: '新增字段', path: ['availability'], level: 0, type: 'string' },
] satisfies PropertyDefinition[];
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
const advancedRendererDefinitions = {
  localMoney: (value: unknown) => {
    if (typeof value === 'object' && value !== null && 'amount' in value && 'currency' in value) {
      const money = value as { amount: number; currency: string };
      return `本地金额：${money.currency} ${money.amount.toFixed(0)}`;
    }
    return '—';
  },
};

export function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#155eef', borderRadius: 8 } }}>
      <main>
        <Typography.Title>递归多版本数据对比表</Typography.Title>
        <Typography.Paragraph>
          面向 Ant Design 风格的组件示例。每个可展开属性旁都有搜索按钮，可仅筛选该属性的子树。
        </Typography.Paragraph>
        <Space direction="vertical" size="large" className="example-list">
          <Example
            title="基础递归对比"
            description="任意版本数量、递归对象、全局搜索和节点级子树搜索。汇总金额演示只展示第一层级。"
            code={basicSource}
          >
            <RecursiveComparisonTable
              versions={peopleVersions}
              rules={[
                { path: 'money', renderer: 'money', label: '金额' },
                {
                  path: 'summaryMoney',
                  renderer: 'money',
                  expand: false,
                  label: '汇总金额（仅一级）',
                },
                { path: 'user', label: '用户信息' },
              ]}
            />
          </Example>
          <Example
            title="属性选择与路径覆盖"
            description="只保留 customer 与 status；排除密码和内部追踪字段。"
            code={selectionSource}
          >
            <RecursiveComparisonTable
              versions={restrictedVersions}
              selection={{
                include: ['customer.*', 'status'],
                exclude: ['customer.password', 'internal.*'],
              }}
              rules={[{ path: 'customer', label: '客户资料' }]}
            />
          </Example>
          <Example
            title="自定义渲染器"
            description="Property Definition 可独立控制每个字段的展示。"
            code={rendererSource}
          >
            <RecursiveComparisonTable
              versions={orderVersions}
              propertyDefinitions={[
                {
                  key: 'money',
                  label: '订单金额',
                  path: ['order', 'money'],
                  level: 1,
                  type: 'object',
                  renderValue: (value) => {
                    const money = value as { amount: number; currency: string };
                    return new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: money.currency,
                    }).format(money.amount);
                  },
                },
                {
                  key: 'ratio',
                  label: '完成率',
                  path: ['order', 'ratio'],
                  level: 1,
                  type: 'number',
                  renderValue: (value) => `${Number(value) * 100}%`,
                },
                {
                  key: 'placedAt',
                  label: '下单时间',
                  path: ['order', 'placedAt'],
                  level: 1,
                  type: 'date',
                },
              ]}
            />
          </Example>
          <ControlledExample />
          <Example
            title="自定义顺序与扁平层级"
            description="展示定义决定顺序与层级：数组父级 lines 被移除，数组项和备注提升为顶层。"
            code={flattenedSource}
          >
            <RecursiveComparisonTable
              versions={arrayVersions}
              propertyDefinitions={flattenedLineDefinitions}
            />
          </Example>
          <RegistryExample />
          <AdvancedExample />
          <DiffExample />
        </Space>
      </main>
    </ConfigProvider>
  );
}
function ControlledExample() {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['["lines"]']);
  return (
    <Example
      title="受控展开、数组与缺失值"
      description="数组按索引对齐；空值、缺失字段和新增字段均保持可见。"
      code={controlledSource}
    >
      <RecursiveComparisonTable
        versions={arrayVersions}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      />
    </Example>
  );
}
function AdvancedExample() {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([
    '["customer"]',
    '["billing","money"]',
    '["lines",0]',
  ]);
  return (
    <Example
      title="综合高级配置"
      description="组合字段筛选、受控展开、路径规则、局部与内置混合金额渲染、扁平数组、空值和新增字段，适合作为复杂业务数据的配置参考。"
      code={advancedSource}
    >
      <RecursiveComparisonTable
        versions={advancedVersions}
        propertyDefinitions={advancedDefinitions}
        renderers={advancedRendererDefinitions}
        selection={{
          include: ['customer', 'customer.*', 'billing.*', 'lines.*', 'note', 'availability'],
          exclude: ['customer.secret', 'internal.*'],
        }}
        rules={[
          { path: 'billing.money', renderer: 'localMoney' },
          { path: 'billing.summaryMoney', renderer: 'money', expand: false },
        ]}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      />
    </Example>
  );
}
function RegistryExample() {
  return (
    <Example
      title="局部 Renderer Registry"
      description="每张表创建独立的 renderer 视图：可新增 statusBadge，也可局部重写 money；右侧默认表继续使用内置 money。"
      code={registrySource}
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
    </Example>
  );
}
function DiffExample() {
  return (
    <Example
      title="自动 Diff 与自定义比较"
      description="自动标记差异、保留父级上下文并隐藏相同字段。此处以基准版比较，价格差异小于 10 时由业务 comparator 视为相同。"
      code={diffSource}
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
    </Example>
  );
}
function Example({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description: string;
  code: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const copy = () => navigator.clipboard?.writeText(code);
  return (
    <Card className="example-card">
      <Typography.Title level={2}>{title}</Typography.Title>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      {children}
      <div className="source-actions">
        <Button type="link" onClick={() => setOpen((value) => !value)}>
          {open ? '收起源代码' : '查看源代码'}
        </Button>
      </div>
      {open && (
        <div className="source-panel">
          <Button size="small" onClick={copy}>
            复制源代码
          </Button>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </Card>
  );
}

const basicSource = `import { RecursiveComparisonTable } from './RecursiveComparisonTable';

<RecursiveComparisonTable
  versions={versions}
  rules={[
    { path: 'money', renderer: 'money', label: '金额' },
    { path: 'summaryMoney', renderer: 'money', expand: false, label: '汇总金额（仅一级）' },
  ]}
/>`;
const selectionSource = `<RecursiveComparisonTable
  versions={versions}
  selection={{ include: ['customer.*', 'status'], exclude: ['customer.password'] }}
  rules={[{ path: 'customer', label: '客户资料' }]}
/>`;
const rendererSource = `<RecursiveComparisonTable
  versions={versions}
  propertyDefinitions={[{
    key: 'money', label: '订单金额', path: ['order', 'money'],
    level: 1, type: 'object',
    renderValue: value => formatMoney(value),
  }]}
/>`;
const controlledSource = `const [expandedKeys, setExpandedKeys] = useState(['["lines"]']);

<RecursiveComparisonTable
  versions={versions}
  expandedKeys={expandedKeys}
  onExpandedChange={setExpandedKeys}
/>`;
const flattenedSource = `const propertyDefinitions = [
  {
    key: 'line0', label: 'lines[0]', path: ['lines', 0], level: 0, type: 'object',
    children: [
      { key: 'sku', label: 'SKU', path: ['lines', 0, 'sku'], level: 1, type: 'string' },
      { key: 'quantity', label: '数量', path: ['lines', 0, 'quantity'], level: 1, type: 'number' },
    ],
  },
  { key: 'note', label: '备注', path: ['note'], level: 0, type: 'string' },
  { key: 'line1', label: 'lines[1]', path: ['lines', 1], level: 0, type: 'object' },
];

<RecursiveComparisonTable
  versions={versions}
  propertyDefinitions={propertyDefinitions}
/>`;
const advancedSource = `const advancedRenderers = {
  localMoney: value => formatLocalMoney(value),
};

const [expandedKeys, setExpandedKeys] = useState([
  '["customer"]',
  '["billing","money"]',
  '["lines",0]',
]);

<RecursiveComparisonTable
  versions={versions}
  propertyDefinitions={propertyDefinitions}
  renderers={advancedRenderers}
  selection={{
    include: ['customer', 'customer.*', 'billing.*', 'lines.*', 'note', 'availability'],
    exclude: ['customer.secret', 'internal.*'],
  }}
  rules={[
    { path: 'billing.money', renderer: 'localMoney' },
    { path: 'billing.summaryMoney', renderer: 'money', expand: false },
  ]}
  expandedKeys={expandedKeys}
  onExpandedChange={setExpandedKeys}
/>`;
const registrySource = `const localRenderers = {
  statusBadge: value => \`状态标记：\${String(value)}\`,
  money: value => formatCompactMoney(value), // 仅覆盖当前表格的 money
};

<RecursiveComparisonTable
  versions={versions}
  renderers={localRenderers}
  rules={[
    { path: 'status', renderer: 'statusBadge' },
    { path: 'money', renderer: 'money' },
  ]}
/>;

// 也可复用链式注册表：
const renderers = new RendererRegistry().register('statusBadge', renderStatus);
<RecursiveComparisonTable versions={versions} renderers={renderers} />;`;
const diffSource = `<RecursiveComparisonTable
  versions={versions}
  comparison={{
    onlyDifferences: true,
    baseVersionId: 'baseline',
    comparator: (values, context) => {
      if (context.path.join('.') !== 'product.price') return false;
      const prices = values.map(Number);
      return Math.max(...prices) - Math.min(...prices) > 10;
    },
  }}
/>`;

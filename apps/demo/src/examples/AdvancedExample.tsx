import source from './AdvancedExample.tsx?raw';
import { useState } from 'react';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type PropertyDefinition,
} from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

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
    differenceIndicator: false,
    nodeSearchable: false,
    children: [
      {
        key: 'name',
        label: '客户名称',
        path: ['customer', 'name'],
        level: 1,
        type: 'string',
        renderValue: (value: unknown) => String(value).toUpperCase(),
      },
      {
        key: 'tier',
        label: '客户等级',
        path: ['customer', 'tier'],
        level: 1,
        type: 'string',
        differenceIndicator: true,
      },
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
    key: 'lines',
    label: 'lines',
    path: ['lines'],
    level: 0,
    type: 'array',
    flatten: true,
    itemDefinition: {
      key: 'line',
      label: '订单行',
      path: [],
      level: 0,
      type: 'object',
      children: [
        { key: 'sku', label: 'SKU', path: ['sku'], level: 1, type: 'string' },
        { key: 'quantity', label: '数量', path: ['quantity'], level: 1, type: 'number' },
      ],
    },
  },
  { key: 'note', label: '备注', path: ['note'], level: 0, type: 'string' },
  { key: 'availability', label: '新增字段', path: ['availability'], level: 0, type: 'string' },
] satisfies PropertyDefinition[];

const advancedRendererDefinitions = {
  localMoney: (value: unknown) => {
    if (typeof value === 'object' && value !== null && 'amount' in value && 'currency' in value) {
      const money = value as { amount: number; currency: string };
      return `本地金额：${money.currency} ${money.amount.toFixed(0)}`;
    }
    return '—';
  },
};

export function AdvancedExample() {
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([
    '["customer"]',
    '["billing","money"]',
    '["lines","P-100"]',
  ]);
  return (
    <ExampleCard
      title="综合高级配置"
      description="组合字段筛选、受控展开、路径规则、基准列 Base 标签、局部与内置混合金额渲染、按 SKU 对齐的扁平数组、空值和新增字段，适合作为复杂业务数据的配置参考。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={advancedVersions}
        propertyDefinitions={advancedDefinitions}
        arrayItemKeyFields={{ lines: 'sku' }}
        renderers={advancedRendererDefinitions}
        selection={{
          include: ['customer', 'customer.*', 'billing.*', 'lines.*', 'note', 'availability'],
          exclude: ['customer.secret', 'internal.*'],
        }}
        rules={[
          { path: 'billing.money', renderer: 'localMoney' },
          { path: 'billing.summaryMoney', renderer: 'money', expand: false },
        ]}
        comparison={{
          baseVersionId: 'baseline',
          showBaselineBadge: true,
          comparator: (values, context) => {
            if (context.path.join('.') === 'billing.money.amount') {
              const amounts = values.map(Number);
              return Math.max(...amounts) - Math.min(...amounts) > 50;
            }
            return values.some((value, index) => index > 0 && value !== values[0]);
          },
        }}
        expandedKeys={expandedKeys}
        onExpandedChange={setExpandedKeys}
      />
    </ExampleCard>
  );
}

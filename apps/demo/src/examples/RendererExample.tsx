import source from './RendererExample.tsx?raw';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type PropertyDefinition,
} from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

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
const propertyDefinitions = [
  {
    key: 'money',
    label: '订单金额',
    path: ['order', 'money'],
    level: 1,
    type: 'object',
    renderValue: (value: unknown) => {
      const money = value as { amount: number; currency: string };
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currency }).format(
        money.amount,
      );
    },
  },
  {
    key: 'ratio',
    label: '完成率',
    path: ['order', 'ratio'],
    level: 1,
    type: 'number',
    renderValue: (value: unknown) => `${Number(value) * 100}%`,
  },
  { key: 'placedAt', label: '下单时间', path: ['order', 'placedAt'], level: 1, type: 'date' },
] satisfies PropertyDefinition[];

export function RendererExample() {
  return (
    <ExampleCard
      title="自定义渲染器"
      description="Property Definition 可独立控制每个字段的展示。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={orderVersions}
        propertyDefinitions={propertyDefinitions}
      />
    </ExampleCard>
  );
}


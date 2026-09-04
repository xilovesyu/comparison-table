import source from './TextOverridesExample.tsx?raw';
import {
  RecursiveComparisonTable,
  type ComparisonTableTextOverrides,
  type ComparisonVersion,
} from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';

const localizedVersions = [
  {
    id: 'draft',
    label: '初始版',
    data: {
      customer: { name: 'Mia Chen' },
      lines: [{ sku: 'P-100', quantity: 1 }],
      amount: 980,
    },
  },
  {
    id: 'review',
    label: '复核版',
    data: {
      customer: { name: 'Mia Zhang' },
      lines: [
        { sku: 'P-100', quantity: 2 },
        { sku: 'P-300', quantity: 1 },
      ],
      amount: 1100,
    },
  },
] satisfies ComparisonVersion[];

const localizedTexts = {
  tableRegionLabel: '本地化递归对比表',
  propertyColumn: '字段',
  globalSearchLabel: '搜索对比内容',
  globalSearchPlaceholder: '搜索属性和值',
  onlyDifferencesLabel: '仅显示差异',
  onlyDifferencesCount: ({ count }) => `共 ${count} 项差异`,
  nodeSearchLabel: ({ propertyLabel, path }) => `搜索 ${propertyLabel}（${path.join('.')}）`,
  nodeFilterLabel: ({ propertyLabel }) => `筛选 ${propertyLabel} 的子项`,
  nodeFilterPlaceholder: ({ propertyLabel }) => `筛选 ${propertyLabel}`,
  finalColumn: '本地化结果',
  sourceChoiceLabel: ({ path, versionLabel }) => `${path.join('.')} 采用${versionLabel}`,
  presenceGroupLabel: ({ path }) => `${path.join('.')} 的存在状态`,
  includeFromLabel: ({ path, versionLabel }) => `${path.join('.')} 从${versionLabel}加入`,
  excludeLabel: ({ path }) => `${path.join('.')} 排除`,
  clearResolutionLabel: ({ path }) => `清除 ${path.join('.')} 的来源`,
  clearEditLabel: ({ path }) => `清除 ${path.join('.')} 的编辑`,
  editValueLabel: ({ path }) => `编辑 ${path.join('.')}`,
  setNullLabel: ({ path }) => `将 ${path.join('.')} 设为空值`,
  deleteValueLabel: ({ path }) => `删除 ${path.join('.')}`,
  validationError: ({ path, error }) => `${path.join('.')} 无效：${error}`,
} satisfies ComparisonTableTextOverrides;

export function TextOverridesExample() {
  return (
    <ExampleCard
      title="内置文案配置与本地化"
      description="每张表可独立覆盖静态文案和带路径、版本上下文的动态文案，不改变原始数据与渲染结果。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={localizedVersions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'customer', label: '客户资料' }]}
        merge={{ enabled: true }}
        texts={localizedTexts}
      />
    </ExampleCard>
  );
}

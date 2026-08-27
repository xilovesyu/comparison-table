import source from './PresentationControlsExample.tsx?raw';
import { RecursiveComparisonTable } from '../components/RecursiveComparisonTable';
import type { ComparisonVersion } from '../core/comparison';
import { ExampleCard } from './ExampleCard';

const controlVersions = [
  {
    id: 'baseline',
    label: '基准版',
    data: { profile: { contact: { city: 'Beijing' }, name: 'Ava' }, status: 'ACTIVE' },
  },
  {
    id: 'next',
    label: '新版',
    data: { profile: { contact: { city: 'Shanghai' }, name: 'Mia' }, status: 'SUSPENDED' },
  },
] satisfies ComparisonVersion[];

export function PresentationControlsExample() {
  return (
    <ExampleCard
      title="显示控制与层级继承"
      description="父级可关闭 Diff 与节点搜索；子级用 true 重新开启。Base 标签也可独立隐藏，且不影响基准列高亮。"
      code={source}
    >
      <RecursiveComparisonTable
        versions={controlVersions}
        comparison={{ baseVersionId: 'baseline', showBaselineBadge: false }}
        rules={[
          { path: 'profile', label: '资料分组', differenceIndicator: false, nodeSearchable: false },
          {
            path: 'profile.contact',
            label: '联系信息（重新开启）',
            differenceIndicator: true,
            nodeSearchable: true,
          },
        ]}
      />
    </ExampleCard>
  );
}

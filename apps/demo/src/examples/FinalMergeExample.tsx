import { useState } from 'react';
import { Button } from 'antd';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type MergeResolutions,
} from '@jxi/comparison-table';
import { ExampleCard } from './ExampleCard';
import source from './FinalMergeExample.tsx?raw';

const mergeVersions = [
  {
    id: 'baseline',
    label: '初始版',
    data: {
      customer: { name: 'Mia Chen', enabled: true },
      lines: [{ sku: 'P-100', quantity: 1 }],
      reviewSteps: ['Submit', 'Review'],
    },
  },
  {
    id: 'review',
    label: '复核版',
    data: {
      customer: { name: 'Mia Zhang', enabled: true },
      lines: [
        { sku: 'P-100', quantity: 2 },
        { sku: 'P-300', quantity: 1 },
      ],
      reviewSteps: ['Submit', 'Legal review', 'Approve'],
    },
  },
  {
    id: 'final',
    label: '最终版',
    data: {
      customer: { name: 'Mia Zhang', enabled: false },
      lines: [{ sku: 'P-100', quantity: 3 }],
      reviewSteps: ['Submit', 'Approve'],
    },
  },
] satisfies ComparisonVersion[];

const defaultValueVersions = [
  { id: 'baseline', label: '初始版', data: { approvalStatus: 'Draft' } },
  { id: 'review', label: '复核版', data: { approvalStatus: 'Approved' } },
  { id: 'final', label: '最终版', data: { approvalStatus: 'Rejected' } },
] satisfies ComparisonVersion[];

const approvalStatusResolutionKey = JSON.stringify(['approvalStatus']);
const defaultResolutions: MergeResolutions = {
  [approvalStatusResolutionKey]: { kind: 'source', versionId: 'review' },
};

export function FinalMergeExample() {
  const [showDefaultValueMode, setShowDefaultValueMode] = useState(false);
  const [resolutions, setResolutions] = useState<MergeResolutions>({});
  const [status, setStatus] = useState('请选择每个差异的来源');

  if (showDefaultValueMode) {
    return (
      <ExampleCard
        title="最终版本合并"
        description="用 uncontrolled defaultValue 预载完整方案；只有清除后重新选择才视为本次完成提交。"
        code={source}
      >
        <Button onClick={() => setShowDefaultValueMode(false)}>返回完整合并示例</Button>
        <p aria-live="polite">{status}</p>
        <RecursiveComparisonTable
          key="default-value-mode"
          versions={defaultValueVersions}
          comparison={{ baseVersionId: 'baseline' }}
          merge={{
            enabled: true,
            defaultValue: defaultResolutions,
            onChange: (_next, result) => {
              setStatus(result.isComplete ? '合并已完成' : '默认方案已清除');
            },
            onComplete: () => setStatus('合并已完成'),
          }}
        />
      </ExampleCard>
    );
  }

  return (
    <ExampleCard
      title="最终版本合并"
      description="在独立的 Final 列中为差异选择原始版本值；业务键数组还可决定新增项目的 Include 或 Exclude。"
      code={source}
    >
      <Button
        onClick={() => {
          setStatus('默认方案已加载，未触发完成提交');
          setShowDefaultValueMode(true);
        }}
      >
        演示 uncontrolled defaultValue
      </Button>
      <p aria-live="polite">{status}</p>
      <RecursiveComparisonTable
        key="complete-merge-mode"
        versions={mergeVersions}
        arrayItemKeyFields={{ lines: 'sku' }}
        comparison={{ baseVersionId: 'baseline' }}
        merge={{
          enabled: true,
          value: resolutions,
          onChange: (next, result) => {
            setResolutions(next);
            setStatus(result.isComplete ? '合并已完成' : '仍有差异待选择');
          },
          onComplete: () => setStatus('合并已完成'),
        }}
      />
    </ExampleCard>
  );
}

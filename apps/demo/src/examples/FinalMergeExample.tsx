import { useState } from 'react';
import { Button, InputNumber } from 'antd';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type MergeEditor,
  type MergeEdits,
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
  {
    id: 'baseline',
    label: '初始版',
    data: { approvalStatus: 'Draft', reviewNote: 'Initial note' },
  },
  {
    id: 'review',
    label: '复核版',
    data: { approvalStatus: 'Approved', reviewNote: 'Review note' },
  },
  {
    id: 'final',
    label: '最终版',
    data: { approvalStatus: 'Rejected', reviewNote: 'Final note' },
  },
] satisfies ComparisonVersion[];

const approvalStatusResolutionKey = JSON.stringify(['approvalStatus']);
const defaultResolutions: MergeResolutions = {
  [approvalStatusResolutionKey]: { kind: 'source', versionId: 'review' },
};
const defaultEdits: MergeEdits = {
  [JSON.stringify(['reviewNote'])]: { kind: 'set', value: 'Manually reviewed' },
};
const defaultLoadedStatus = ['默认方案已加载', '未触发完成提交'].join('，');
const defaultLoadedDetail = ['defaultValue 与 defaultEdits 已加载', '未触发完成提交'].join('，');

const quantityEditor: MergeEditor = ({ path, value, disabled, invalid, onCommit }) => (
  <InputNumber
    aria-label={`Edit ${path.join('.')}`}
    disabled={disabled}
    status={invalid ? 'error' : undefined}
    value={typeof value === 'number' ? value : null}
    onChange={(next) => {
      if (typeof next === 'number' && Number.isFinite(next)) {
        onCommit({ kind: 'set', value: next });
      }
    }}
  />
);

export function FinalMergeExample() {
  const [showDefaultValueMode, setShowDefaultValueMode] = useState(false);
  const [resolutions, setResolutions] = useState<MergeResolutions>({});
  const [edits, setEdits] = useState<MergeEdits>({});
  const [status, setStatus] = useState('请选择每个差异的来源');

  if (showDefaultValueMode) {
    return (
      <ExampleCard
        title="最终版本合并"
        description="用 uncontrolled defaultValue 与 defaultEdits 预载完整方案；只有清除后重新选择才视为本次完成提交。"
        code={source}
        sourceResetKey={showDefaultValueMode}
      >
        <Button onClick={() => setShowDefaultValueMode(false)}>返回完整合并示例</Button>
        <p aria-live="polite">{status}</p>
        {status === defaultLoadedStatus ? <p>{defaultLoadedDetail}</p> : null}
        <RecursiveComparisonTable
          key="default-value-mode"
          versions={defaultValueVersions}
          comparison={{ baseVersionId: 'baseline' }}
          merge={{
            enabled: true,
            defaultValue: defaultResolutions,
            defaultEdits,
            onChange: (_next, result) => {
              setStatus(result.isComplete ? '合并已完成' : '默认方案已清除');
            },
            onEditsChange: (_next, result) => {
              setStatus(result.isComplete ? '合并已完成' : '默认编辑已清除');
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
      sourceResetKey={showDefaultValueMode}
    >
      <Button
        onClick={() => {
          setStatus(defaultLoadedStatus);
          setShowDefaultValueMode(true);
        }}
      >
        演示 uncontrolled defaultValue 与 defaultEdits
      </Button>
      <p aria-live="polite">{status}</p>
      <RecursiveComparisonTable
        key="complete-merge-mode"
        versions={mergeVersions}
        arrayItemKeyFields={{ lines: 'sku' }}
        comparison={{ baseVersionId: 'baseline' }}
        rules={[{ path: 'lines.P-100.quantity', mergeEditor: quantityEditor }]}
        merge={{
          enabled: true,
          value: resolutions,
          edits,
          onChange: (next, result) => {
            setResolutions(next);
            setStatus(result.isComplete ? '合并已完成' : '仍有差异待选择');
          },
          onEditsChange: (next, result) => {
            setEdits(next);
            setStatus(result.isComplete ? '合并已完成' : '仍有差异待选择');
          },
          onComplete: () => setStatus('合并已完成'),
        }}
      />
    </ExampleCard>
  );
}

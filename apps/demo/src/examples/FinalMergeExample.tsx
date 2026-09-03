import { useState } from 'react';
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
    },
  },
  {
    id: 'final',
    label: '最终版',
    data: {
      customer: { name: 'Mia Zhang', enabled: false },
      lines: [{ sku: 'P-100', quantity: 3 }],
    },
  },
] satisfies ComparisonVersion[];

export function FinalMergeExample() {
  const [resolutions, setResolutions] = useState<MergeResolutions>({});
  const [status, setStatus] = useState('请选择每个差异的来源');

  return (
    <ExampleCard
      title="最终版本合并"
      description="在独立的 Final 列中为差异选择原始版本值；业务键数组还可决定新增项目的 Include 或 Exclude。"
      code={source}
    >
      <p aria-live="polite">{status}</p>
      <RecursiveComparisonTable
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

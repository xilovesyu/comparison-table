import { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RecursiveComparisonTable,
  type ComparisonVersion,
  type RecursiveComparisonTableProps,
} from '../../../packages/comparison-table/src/index';
import { afterTwoAnimationFrames, protocolError } from '../protocol.mjs';
import './styles.css';

interface LabScenario {
  id: string;
  versions: ComparisonVersion[];
  config: Omit<RecursiveComparisonTableProps, 'versions'>;
  expected: {
    operations?: string[];
    semantic: 'empty' | 'populated';
    textIncludes: string[];
    versionColumns: number;
  };
}

interface LabOptions {
  timeoutMs?: number;
  telemetry?: { longtask?: boolean; heap?: boolean };
}

let activeToken = 0;
const root = createRoot(document.getElementById('root')!);

function observation() {
  const section = document.querySelector('[aria-label="Recursive comparison table"]');
  return {
    tablePresent: Boolean(section),
    versionColumns: Math.max(0, (section?.querySelectorAll('thead th').length ?? 1) - 1),
    rowCount: section?.querySelectorAll('tbody tr[data-row-key]').length ?? 0,
    cellCount: section?.querySelectorAll('tbody td').length ?? 0,
    text: section?.textContent ?? '',
  };
}

function validateCommittedObservation(
  committed: ReturnType<typeof observation>,
  expected: LabScenario['expected'],
) {
  if (!committed.tablePresent)
    throw new Error('ARIA semantic oracle did not find the comparison table');
  if (committed.versionColumns !== expected.versionColumns) {
    throw new Error(`ARIA semantic oracle found ${committed.versionColumns} version columns`);
  }
  if (expected.semantic === 'populated' && committed.rowCount < 1) {
    throw new Error('ARIA semantic oracle did not find a populated row');
  }
  const missingText = expected.textIncludes.find((value) => !committed.text.includes(value));
  if (missingText) throw new Error(`ARIA semantic oracle did not find text: ${missingText}`);
}

function LabHost({
  scenario,
  token,
  startedAt,
  options,
  resolve,
}: {
  scenario: LabScenario;
  token: number;
  startedAt: number;
  options: LabOptions;
  resolve: (result: unknown) => void;
}) {
  const controlled = Boolean(scenario.expected.operations?.includes('controlled-expansion'));
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['["lines"]']);
  const [controlledChanges, setControlledChanges] = useState(0);

  useLayoutEffect(() => {
    const committedObservation = observation();
    try {
      validateCommittedObservation(committedObservation, scenario.expected);
    } catch (error) {
      resolve(protocolError(error));
      return;
    }
    afterTwoAnimationFrames({
      token,
      currentToken: () => activeToken,
      startedAt,
      timeoutMs: options.timeoutMs,
      telemetry: options.telemetry,
    })
      .then((result) => resolve({ ...result, observation: committedObservation }))
      .catch((error) => resolve(protocolError(error)));
  }, [options, resolve, scenario.expected, startedAt, token]);

  return (
    <main
      aria-labelledby="performance-lab-heading"
      data-controlled-expansion-count={controlledChanges}
    >
      <h1 id="performance-lab-heading">Performance Lab</h1>
      <output role="status">Running {scenario.id}</output>
      <RecursiveComparisonTable
        versions={scenario.versions}
        {...scenario.config}
        expandedKeys={controlled ? expandedKeys : undefined}
        onExpandedChange={
          controlled
            ? (keys) => {
                setExpandedKeys(keys);
                setControlledChanges((count) => count + 1);
              }
            : undefined
        }
      />
    </main>
  );
}

window.performanceLab = {
  run(scenario: LabScenario, options: LabOptions = {}) {
    const token = ++activeToken;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      root.render(
        <LabHost
          key={token}
          scenario={scenario}
          token={token}
          startedAt={startedAt}
          options={options}
          resolve={resolve}
        />,
      );
    });
  },
  settle() {
    return afterTwoAnimationFrames({
      token: activeToken,
      currentToken: () => activeToken,
      telemetry: { longtask: false },
    });
  },
};

document.documentElement.dataset.performanceLabReady = 'true';

declare global {
  interface Window {
    performanceLab: {
      run: (scenario: LabScenario, options?: LabOptions) => Promise<unknown>;
      settle: () => Promise<unknown>;
    };
  }
}

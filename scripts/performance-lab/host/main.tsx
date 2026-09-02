import { useLayoutEffect } from 'react';
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
    text: section?.textContent ?? '',
  };
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
  useLayoutEffect(() => {
    afterTwoAnimationFrames({
      token,
      currentToken: () => activeToken,
      startedAt,
      timeoutMs: options.timeoutMs,
      telemetry: options.telemetry,
    })
      .then((result) => resolve({ ...result, observation: observation() }))
      .catch((error) => resolve(protocolError(error)));
  }, [options, resolve, startedAt, token]);

  return (
    <main aria-labelledby="performance-lab-heading">
      <h1 id="performance-lab-heading">Performance Lab</h1>
      <output role="status">Running {scenario.id}</output>
      <RecursiveComparisonTable versions={scenario.versions} {...scenario.config} />
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
};

document.documentElement.dataset.performanceLabReady = 'true';

declare global {
  interface Window {
    performanceLab: {
      run: (scenario: LabScenario, options?: LabOptions) => Promise<unknown>;
    };
  }
}

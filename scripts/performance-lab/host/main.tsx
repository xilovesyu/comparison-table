import { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildComparisonRows,
  filterComparisonRows,
  filterDifferenceRows,
  pathId,
  RecursiveComparisonTable,
  type ComparisonRow,
  type ComparisonVersion,
  type RecursiveComparisonTableProps,
} from '../../../packages/comparison-table/src/index';
import { createScenario } from '../catalog.mjs';
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
    publicOracle?: {
      ownUndefined: { path: string; versionId: string; hasOwn: boolean };
      query: { path: string; value: string };
      keyedIdentity: { added: string; middleMissing: string; modified: string; unchanged: string };
    };
  };
}

interface LabOptions {
  timeoutMs?: number;
  telemetry?: { longtask?: boolean; heap?: boolean };
}

interface ScenarioInput {
  caseId: string;
  profile: string;
  seed: number;
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

function flatten(rows: readonly ComparisonRow[]): ComparisonRow[] {
  return rows.flatMap((row) => [row, ...flatten(row.children ?? [])]);
}

function runPublicOracle(scenario: LabScenario) {
  const rows = buildComparisonRows(scenario.versions, scenario.config);
  const allRows = flatten(rows);
  const expected = scenario.expected.publicOracle;
  if (!expected) return undefined;

  const undefinedRow = allRows.find(
    (row) => row.property.path.join('.') === expected.ownUndefined.path,
  );
  const ownsUndefined = Boolean(
    undefinedRow &&
    Object.prototype.hasOwnProperty.call(undefinedRow.values, expected.ownUndefined.versionId),
  );
  if (ownsUndefined !== expected.ownUndefined.hasOwn) {
    throw new Error('Public oracle failed own undefined-value presence');
  }

  const queryRows = flatten(filterComparisonRows(rows, expected.query.value));
  if (
    queryRows.length !== 1 ||
    queryRows[0]?.property.path.join('.') !== expected.query.path ||
    !Object.values(queryRows[0]?.values ?? {}).some((value) =>
      String(value).includes(expected.query.value),
    )
  ) {
    throw new Error('Public oracle failed raw-value query filtering');
  }

  const keyedRow = (identity: string) => allRows.find((row) => row.itemIdentity === identity);
  const middle = keyedRow(expected.keyedIdentity.middleMissing);
  const unchanged = keyedRow(expected.keyedIdentity.unchanged);
  const modified = keyedRow(expected.keyedIdentity.modified);
  const added = keyedRow(expected.keyedIdentity.added);
  const expectedMiddlePresence = Object.fromEntries(
    scenario.versions.map((version, index) => [version.id, index % 2 === 0]),
  );
  if (
    !middle ||
    middle.id !== pathId(['lines', expected.keyedIdentity.middleMissing]) ||
    JSON.stringify(middle.presence) !== JSON.stringify(expectedMiddlePresence) ||
    !unchanged ||
    unchanged.hasDifference ||
    !modified?.hasDifference ||
    added?.presence?.[scenario.versions[0].id] !== false
  ) {
    throw new Error('Public oracle failed keyed path, row id, presence, or status semantics');
  }

  const differenceCount = flatten(filterDifferenceRows(rows)).length;
  if (differenceCount < 1) throw new Error('Public oracle failed difference filtering');
  return {
    differenceCount,
    middlePresence: middle.presence,
    middleStatus:
      scenario.versions.length >= 3 && middle.presence?.[scenario.versions[2].id]
        ? 'Present'
        : 'Removed',
    queryResultCount: queryRows.length,
    stableRowId: middle.id,
  };
}

function LabHost({
  scenario,
  token,
  startedAt,
  options,
  dataBuild,
  publicOracle,
  resolve,
}: {
  scenario: LabScenario;
  token: number;
  startedAt: number;
  options: LabOptions;
  dataBuild: { durationMs: number; transactionStart: 'browser-event' };
  publicOracle: ReturnType<typeof runPublicOracle>;
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
      .then((result) =>
        resolve({ ...result, dataBuild, observation: committedObservation, publicOracle }),
      )
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
  run(input: ScenarioInput, options: LabOptions = {}) {
    const token = ++activeToken;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      let scenario: LabScenario;
      let publicOracle: ReturnType<typeof runPublicOracle>;
      try {
        scenario = createScenario(input.caseId, input.profile, input.seed) as LabScenario;
        publicOracle = runPublicOracle(scenario);
      } catch (error) {
        resolve(protocolError(error));
        return;
      }
      const dataBuild = {
        durationMs: performance.now() - startedAt,
        transactionStart: 'browser-event' as const,
      };
      root.render(
        <LabHost
          dataBuild={dataBuild}
          key={token}
          scenario={scenario}
          publicOracle={publicOracle}
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
      run: (scenario: ScenarioInput, options?: LabOptions) => Promise<unknown>;
      settle: () => Promise<unknown>;
    };
  }
}

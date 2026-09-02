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

interface PhaseMarker {
  token: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
}

interface DataBuildMarker extends PhaseMarker {
  transactionStart: 'browser-event';
}

interface PendingOperation {
  operation: string;
  start: { at: number; source: 'react-event-handler' };
  render: { token: string; startedAt: number };
  controlledCallback?: { at: number; source: 'react-controlled-callback'; token: string };
}

let activeToken = 0;
let phaseSequence = 0;
let markerCaptureEnabled = true;
let armedOperation: string | undefined;
let pendingOperation: PendingOperation | undefined;
let activeDataBuild: DataBuildMarker | undefined;
const completedOperations = new Map<string, unknown>();
const operationWaiters = new Map<string, (marker: unknown) => void>();
const root = createRoot(document.getElementById('root')!);

const phaseToken = (name: string) => `${activeToken}:${++phaseSequence}:${name}`;

function completePhase(phase: { token: string; startedAt: number }): PhaseMarker {
  const endedAt = performance.now();
  return { ...phase, endedAt, durationMs: endedAt - phase.startedAt };
}

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

function operationEvidence(operation: string) {
  const committed = observation();
  const search = document.querySelector<HTMLInputElement>('[aria-label="Search comparison"]');
  const differenceSwitch = document.querySelector<HTMLElement>(
    '[role="switch"][aria-label="Only show differences"]',
  );
  const expandButton = document.querySelector<HTMLElement>('button.ant-table-row-expand-icon');
  const nodeSearch = document.querySelector<HTMLInputElement>(
    '[aria-label="Filter lines[SKU-0000] children"]',
  );
  const controlledChanges = Number(
    document.querySelector('main')?.getAttribute('data-controlled-expansion-count') ?? 0,
  );
  const ariaPassed =
    operation === 'global-search'
      ? search?.value === 'SKU-0000'
      : operation === 'only-differences'
        ? differenceSwitch?.getAttribute('aria-checked') === 'true'
        : operation === 'expand-collapse'
          ? expandButton?.getAttribute('aria-expanded') === 'false'
          : operation === 'node-search'
            ? nodeSearch?.value === 'quantity'
            : operation === 'controlled-expansion'
              ? controlledChanges > 0 && expandButton?.getAttribute('aria-expanded') === 'false'
              : false;
  return { ariaPassed, rowCount: committed.rowCount, cellCount: committed.cellCount };
}

function deliverOperation(operation: string, marker: unknown) {
  const waiter = operationWaiters.get(operation);
  if (waiter) {
    operationWaiters.delete(operation);
    waiter(marker);
  } else {
    completedOperations.set(operation, marker);
  }
}

function beginOperation() {
  if (!markerCaptureEnabled || !armedOperation || pendingOperation) return;
  const operation = armedOperation;
  armedOperation = undefined;
  const startedAt = performance.now();
  pendingOperation = {
    operation,
    start: { at: startedAt, source: 'react-event-handler' },
    render: { token: phaseToken(`${operation}:render`), startedAt },
  };
  requestAnimationFrame(() => {
    const pending = pendingOperation;
    if (!pending || pending.operation !== operation) return;
    const render = completePhase(pending.render);
    const oracleStartedAt = performance.now();
    const evidence = operationEvidence(operation);
    const oracle = completePhase({
      token: phaseToken(`${operation}:oracle`),
      startedAt: oracleStartedAt,
    });
    const twoRaf = { token: phaseToken(`${operation}:two-raf`), startedAt: performance.now() };
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const completedTwoRaf = completePhase(twoRaf);
        const endedAt = performance.now();
        deliverOperation(operation, {
          ...evidence,
          durationMs: endedAt - pending.start.at,
          start: pending.start,
          end: { at: endedAt, source: 'react-event-handler' },
          controlledCallback: pending.controlledCallback,
          dataBuild: activeDataBuild,
          render,
          oracle,
          twoRaf: completedTwoRaf,
        });
        pendingOperation = undefined;
      }),
    );
  });
}

function noteControlledCallback() {
  if (pendingOperation?.operation !== 'controlled-expansion') return;
  pendingOperation.controlledCallback = {
    at: performance.now(),
    source: 'react-controlled-callback',
    token: phaseToken('controlled-expansion:callback'),
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
  options,
  dataBuild,
  renderPhase,
  resolve,
}: {
  scenario: LabScenario;
  token: number;
  options: LabOptions;
  dataBuild: DataBuildMarker;
  renderPhase: { token: string; startedAt: number };
  resolve: (result: unknown) => void;
}) {
  const controlled = Boolean(scenario.expected.operations?.includes('controlled-expansion'));
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['["lines"]']);
  const [controlledChanges, setControlledChanges] = useState(0);

  useLayoutEffect(() => {
    const render = completePhase(renderPhase);
    const oracleStartedAt = performance.now();
    const committedObservation = observation();
    let publicOracle: ReturnType<typeof runPublicOracle>;
    try {
      publicOracle = runPublicOracle(scenario);
      validateCommittedObservation(committedObservation, scenario.expected);
    } catch (error) {
      resolve(protocolError(error));
      return;
    }
    const oracle = completePhase({
      token: phaseToken('initial:oracle'),
      startedAt: oracleStartedAt,
    });
    const twoRafStartedAt = performance.now();
    afterTwoAnimationFrames({
      token,
      currentToken: () => activeToken,
      startedAt: twoRafStartedAt,
      timeoutMs: options.timeoutMs,
      telemetry: options.telemetry,
    })
      .then((result) =>
        resolve({
          ...result,
          durationMs: render.durationMs,
          dataBuild,
          observation: committedObservation,
          publicOracle,
          phases: {
            dataBuild,
            render,
            oracle,
            twoRaf: {
              token: phaseToken('initial:two-raf'),
              startedAt: twoRafStartedAt,
              endedAt: twoRafStartedAt + result.durationMs,
              durationMs: result.durationMs,
            },
          },
        }),
      )
      .catch((error) => resolve(protocolError(error)));
  }, [dataBuild, options, renderPhase, resolve, scenario, token]);

  return (
    <main
      aria-labelledby="performance-lab-heading"
      data-controlled-expansion-count={controlledChanges}
      onClickCapture={beginOperation}
      onInputCapture={beginOperation}
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
                noteControlledCallback();
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
    phaseSequence = 0;
    const dataBuildPhase = {
      token: phaseToken('initial:data-build'),
      startedAt: performance.now(),
    };
    return new Promise((resolve) => {
      let scenario: LabScenario;
      try {
        scenario = createScenario(input.caseId, input.profile, input.seed) as LabScenario;
      } catch (error) {
        resolve(protocolError(error));
        return;
      }
      const dataBuild: DataBuildMarker = {
        ...completePhase(dataBuildPhase),
        transactionStart: 'browser-event' as const,
      };
      activeDataBuild = dataBuild;
      const renderPhase = {
        token: phaseToken('initial:render'),
        startedAt: performance.now(),
      };
      root.render(
        <LabHost
          dataBuild={dataBuild}
          key={token}
          scenario={scenario}
          token={token}
          renderPhase={renderPhase}
          options={options}
          resolve={resolve}
        />,
      );
    });
  },
  armOperation(operation: string) {
    if (pendingOperation) throw new Error('An operation transaction is already active');
    completedOperations.delete(operation);
    armedOperation = operation;
  },
  takeOperation(operation: string) {
    const completed = completedOperations.get(operation);
    if (completed) {
      completedOperations.delete(operation);
      return Promise.resolve(completed);
    }
    return new Promise((resolve) => operationWaiters.set(operation, resolve));
  },
  setMarkerCapture(enabled: boolean) {
    markerCaptureEnabled = enabled;
    if (!enabled) armedOperation = undefined;
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
      armOperation: (operation: string) => void;
      takeOperation: (operation: string) => Promise<unknown>;
      setMarkerCapture: (enabled: boolean) => void;
      settle: () => Promise<unknown>;
    };
  }
}

import { describe, expect, it } from 'vitest';
import { buildComparisonRows } from './comparison';
import { buildMergeResult } from './merge';
import type { ComparisonVersion, MergeResolution, MergeResolutions } from './types';

const keyedVersions = [
  {
    id: 'base',
    label: 'Base',
    data: {
      lines: [
        { sku: 'P-100', quantity: 1, note: 'base' },
        { sku: 'P-400', quantity: 4 },
      ],
    },
  },
  {
    id: 'review',
    label: 'Review',
    data: {
      lines: [
        { sku: 'P-300', quantity: 3, note: 'review' },
        { sku: 'P-100', quantity: 1, note: 'base' },
      ],
    },
  },
  {
    id: 'final',
    label: 'Final',
    data: {
      lines: [
        { sku: 'P-100', quantity: 1, note: 'base' },
        { sku: 'P-300', quantity: 30, note: 'final' },
      ],
    },
  },
];

const keyedRows = () =>
  buildComparisonRows(keyedVersions, { arrayItemKeyFields: { lines: 'sku' } });
const keyedId = (sku: string) => JSON.stringify(['lines', sku]);
const childId = (sku: string, field: string) => JSON.stringify(['lines', sku, field]);
const source = (versionId: string): MergeResolution => ({ kind: 'source', versionId });
const exclude = (): MergeResolution => ({ kind: 'exclude' });
const noResolutions: MergeResolutions = {};

function expectUnsupportedValue(field: string, value: unknown, type: 'function' | 'symbol'): void {
  const baseData: Record<string, unknown> = {};
  const reviewData: Record<string, unknown> = {};
  baseData[field] = 'base';
  reviewData[field] = value;
  const versions: readonly ComparisonVersion<Record<string, unknown>>[] = [
    { id: 'base', label: 'Base', data: baseData },
    { id: 'review', label: 'Review', data: reviewData },
  ];
  const resolutions: MergeResolutions = { [JSON.stringify([field])]: source('review') };
  expect(() => buildMergeResult(buildComparisonRows(versions), versions, resolutions)).toThrow(
    new RegExp(`${field}.*${type}|${type}.*${field}`, 'i'),
  );
}

describe('frozen MergeResolutions keyed semantics', () => {
  it('models P-300 include and P-400 exclude as keyed-presence entries before their children', () => {
    const resolutions: MergeResolutions = {
      [keyedId('P-300')]: source('review'),
      [keyedId('P-400')]: exclude(),
      [childId('P-300', 'quantity')]: source('final'),
      [childId('P-300', 'note')]: source('review'),
    };
    const result = buildMergeResult(keyedRows(), keyedVersions, resolutions);

    expect(result.scope).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolutionKey: keyedId('P-300'),
          role: 'keyed-presence',
          path: ['lines', 'P-300'],
          active: true,
          allowedSourceVersionIds: ['review', 'final'],
        }),
        expect.objectContaining({
          resolutionKey: childId('P-300', 'quantity'),
          parentResolutionKey: keyedId('P-300'),
          active: true,
        }),
        expect.objectContaining({
          resolutionKey: childId('P-400', 'quantity'),
          parentResolutionKey: keyedId('P-400'),
          active: false,
        }),
      ]),
    );
    expect(result.scope.some((entry) => entry.path.at(-1) === 'sku')).toBe(false);
    expect(result.unresolvedPaths).toEqual([]);
    expect(result.resolvedPatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'include-keyed-item', resolutionKey: keyedId('P-300') }),
        expect.objectContaining({
          op: 'set',
          resolutionKey: childId('P-300', 'quantity'),
          value: 30,
        }),
        expect.objectContaining({ op: 'exclude-keyed-item', resolutionKey: keyedId('P-400') }),
      ]),
    );
    expect(result.mergedData).toEqual({
      lines: [
        { sku: 'P-100', quantity: 1, note: 'base' },
        { sku: 'P-300', quantity: 30, note: 'review' },
      ],
    });
  });

  it('makes a keyed presence entry unresolved again when clear omits it, and reports each stale record precisely', () => {
    const p300 = keyedId('P-300');
    const p100Quantity = childId('P-100', 'quantity');
    const resolutions: MergeResolutions = {
      [p100Quantity]: exclude(),
      [childId('P-300', 'quantity')]: source('base'),
      ['["lines","unknown"]']: source('review'),
    };
    const result = buildMergeResult(keyedRows(), keyedVersions, resolutions);

    expect(result.unresolvedPaths).toContainEqual(['lines', 'P-300']);
    expect(result.sourceDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolutionKey: p100Quantity,
          kind: 'stale',
          reason: 'exclude-not-allowed',
        }),
        expect.objectContaining({
          resolutionKey: childId('P-300', 'quantity'),
          kind: 'stale',
          reason: 'source-not-present',
        }),
        expect.objectContaining({
          resolutionKey: '["lines","unknown"]',
          kind: 'stale',
          reason: 'unknown-row',
        }),
      ]),
    );
    expect(result.isComplete).toBe(false);
  });

  it('uses a delete patch for undefined while retaining null as a set value and deleting the own property', () => {
    type OptionalData = { optional?: string; nullable: string | null };
    const versions: readonly ComparisonVersion<OptionalData>[] = [
      { id: 'base', label: 'Base', data: { optional: 'present', nullable: 'before' } },
      { id: 'review', label: 'Review', data: { optional: undefined, nullable: null } },
    ];
    const resolutions: MergeResolutions = {
      [JSON.stringify(['optional'])]: source('review'),
      [JSON.stringify(['nullable'])]: source('review'),
    };
    const result = buildMergeResult(buildComparisonRows(versions), versions, resolutions);

    expect(result.resolvedPatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'delete', path: ['optional'], sourceVersionId: 'review' }),
        expect.objectContaining({
          op: 'set',
          path: ['nullable'],
          value: null,
          sourceVersionId: 'review',
        }),
      ]),
    );
    expect(result.mergedData).not.toHaveProperty('optional');
    expect(result.mergedData).toHaveProperty('nullable', null);
  });

  it('clones Date values deeply but rejects function and symbol values with their path and type', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const supported = [
      { id: 'base', label: 'Base', data: { date } },
      { id: 'review', label: 'Review', data: { date: new Date(date) } },
    ];
    const dateResult = buildMergeResult(buildComparisonRows(supported), supported, noResolutions);
    expect(dateResult.mergedData.date).not.toBe(date);

    expectUnsupportedValue('fn', () => undefined, 'function');
    expectUnsupportedValue('token', Symbol('token'), 'symbol');
  });

  it('keeps unkeyed expand:false arrays atomic and auto-resolves comparator-equivalent leaves to baseline', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [{ amount: 1 }], note: null } },
      { id: 'review', label: 'Review', data: { lines: [{ amount: 2 }], note: null } },
    ];
    const rows = buildComparisonRows(versions, {
      rules: [{ path: 'lines', expand: false }],
      comparison: { comparator: (values) => values[0] !== values[1] },
    });
    const resolutions: MergeResolutions = { [JSON.stringify(['lines'])]: source('review') };
    const result = buildMergeResult(rows, versions, resolutions);

    expect(result.scope).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['lines'], role: 'non-keyed-array' }),
        expect.objectContaining({ path: ['note'], role: 'value' }),
      ]),
    );
    expect(
      result.scope.flatMap((entry) => entry.path).some((segment) => typeof segment === 'number'),
    ).toBe(false);
    expect(result.mergedData).toEqual({ lines: [{ amount: 2 }], note: null });
    expect(result.sourceDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['note'], kind: 'automatic-baseline' }),
      ]),
    );
  });

  it('marks a decision stale when its selected source version disappears without remapping it', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { amount: 1 } },
      { id: 'final', label: 'Final', data: { amount: 3 } },
    ];
    const resolutionKey = JSON.stringify(['amount']);
    const result = buildMergeResult(buildComparisonRows(versions), versions, {
      [resolutionKey]: source('review'),
    });

    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        kind: 'stale',
        resolutionKey,
        reason: 'source-version-unavailable',
      }),
    );
    expect(result.unresolvedPaths).toContainEqual(['amount']);
    expect(result.isComplete).toBe(false);
  });

  it('does not migrate a keyed decision when its business identity is renamed', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [{ sku: 'P-200', quantity: 2 }] } },
      { id: 'review', label: 'Review', data: { lines: [{ sku: 'P-300', quantity: 3 }] } },
    ];
    const oldKey = keyedId('P-100');
    const result = buildMergeResult(
      buildComparisonRows(versions, { arrayItemKeyFields: { lines: 'sku' } }),
      versions,
      { [oldKey]: source('base') },
      undefined,
      { lines: 'sku' },
    );

    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({ kind: 'stale', resolutionKey: oldKey, reason: 'unknown-row' }),
    );
    expect(result.unresolvedPaths).toContainEqual(['lines', 'P-300']);
    expect(result.scope.some((entry) => entry.resolutionKey === oldKey)).toBe(false);
  });

  it('keeps keyed child decisions through exclude and restores only still-valid children on re-include', () => {
    const p300 = keyedId('P-300');
    const p400 = keyedId('P-400');
    const selected: MergeResolutions = {
      [p300]: source('review'),
      [p400]: exclude(),
      [childId('P-300', 'quantity')]: source('final'),
      [childId('P-300', 'note')]: source('review'),
    };
    const included = buildMergeResult(keyedRows(), keyedVersions, selected, undefined, {
      lines: 'sku',
    });
    const excluded = buildMergeResult(
      keyedRows(),
      keyedVersions,
      { ...selected, [p300]: exclude() },
      undefined,
      { lines: 'sku' },
    );
    const restored = buildMergeResult(keyedRows(), keyedVersions, selected, undefined, {
      lines: 'sku',
    });

    expect(included).toMatchObject({ isComplete: true, unresolvedPaths: [] });
    expect(excluded.scope).toContainEqual(
      expect.objectContaining({ resolutionKey: childId('P-300', 'quantity'), active: false }),
    );
    expect(excluded.unresolvedPaths).not.toContainEqual(['lines', 'P-300', 'quantity']);
    expect(restored).toMatchObject({ isComplete: true, unresolvedPaths: [] });
  });
});

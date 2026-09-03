import { describe, expect, it } from 'vitest';
import { buildComparisonRows } from './comparison';
import { buildMergeResult } from './merge';
import type { MergeResolutions } from './types';

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

describe('frozen MergeResolutions keyed semantics', () => {
  it('models P-300 include and P-400 exclude as keyed-presence entries before their children', () => {
    const resolutions = {
      [keyedId('P-300')]: { kind: 'source', versionId: 'review' },
      [keyedId('P-400')]: { kind: 'exclude' },
      [childId('P-300', 'quantity')]: { kind: 'source', versionId: 'final' },
      [childId('P-300', 'note')]: { kind: 'source', versionId: 'review' },
    } satisfies MergeResolutions;
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
    const result = buildMergeResult(keyedRows(), keyedVersions, {
      [p100Quantity]: { kind: 'exclude' },
      [childId('P-300', 'quantity')]: { kind: 'source', versionId: 'base' },
      ['["lines","unknown"]']: { kind: 'source', versionId: 'review' },
    } satisfies MergeResolutions);

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
    const versions = [
      { id: 'base', label: 'Base', data: { optional: 'present', nullable: 'before' } },
      { id: 'review', label: 'Review', data: { optional: undefined, nullable: null } },
    ];
    const result = buildMergeResult(buildComparisonRows(versions), versions, {
      [JSON.stringify(['optional'])]: { kind: 'source', versionId: 'review' },
      [JSON.stringify(['nullable'])]: { kind: 'source', versionId: 'review' },
    } satisfies MergeResolutions);

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
    const dateResult = buildMergeResult(
      buildComparisonRows(supported),
      supported,
      {} satisfies MergeResolutions,
    );
    expect(dateResult.mergedData.date).not.toBe(date);

    for (const [field, value] of [
      ['fn', () => undefined],
      ['token', Symbol('token')],
    ] as const) {
      const versions = [
        { id: 'base', label: 'Base', data: { [field]: 'base' } },
        { id: 'review', label: 'Review', data: { [field]: value } },
      ];
      expect(() =>
        buildMergeResult(buildComparisonRows(versions), versions, {
          [JSON.stringify([field])]: { kind: 'source', versionId: 'review' },
        } satisfies MergeResolutions),
      ).toThrow(new RegExp(`${field}.*(function|symbol)|(?:function|symbol).*${field}`, 'i'));
    }
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
    const result = buildMergeResult(rows, versions, {
      [JSON.stringify(['lines'])]: { kind: 'source', versionId: 'review' },
    } satisfies MergeResolutions);

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
});

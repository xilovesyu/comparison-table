import { describe, expect, it } from 'vitest';
import { buildComparisonRows } from './comparison';
import { buildMergeResult } from './merge';
import type {
  BuildComparisonConfig,
  ComparisonVersion,
  MergeResolution,
  MergeResolutions,
  MergeResult,
} from './types';

/** Approved Issue #17 contract mirrored here until the production public types exist. */
type MergeEdit = Readonly<{ kind: 'set'; value: unknown }> | Readonly<{ kind: 'delete' }>;
type MergeEdits = Readonly<Record<string, MergeEdit>>;

type TestData = Record<string, unknown>;

const source = (versionId: string): MergeResolution => ({ kind: 'source', versionId });
const exclude = (): MergeResolution => ({ kind: 'exclude' });
const rowId = (...path: string[]) => JSON.stringify(path);

function buildEditedMerge(
  versions: readonly ComparisonVersion<TestData>[],
  resolutions: MergeResolutions,
  edits: MergeEdits,
  config: BuildComparisonConfig = {},
): MergeResult<TestData> {
  const rows = buildComparisonRows(versions, config);
  return Reflect.apply(buildMergeResult, undefined, [
    rows,
    versions,
    resolutions,
    versions[0]?.id,
    config.arrayItemKeyFields,
    edits,
  ]);
}

function expectCanonicalValuePatches(result: MergeResult<TestData>): void {
  const paths = result.resolvedPatch.flatMap((patch) =>
    patch.op === 'set' || patch.op === 'delete' ? [patch.path] : [],
  );
  paths.forEach((left, leftIndex) => {
    paths.forEach((right, rightIndex) => {
      if (leftIndex === rightIndex) return;
      const sharedPrefix = left.every((segment, index) => right[index] === segment);
      expect(sharedPrefix).toBe(false);
    });
  });
}

describe('Issue #17 container inheritance and independent primitive edits', () => {
  it('inherits an object source only through active visible scope and lets a child override or clear', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: { profile: { name: 'Base name', level: 1, secret: 'baseline secret' } },
      },
      {
        id: 'review',
        label: 'Review',
        data: { profile: { name: 'Review name', level: 2, secret: 'review secret' } },
      },
      {
        id: 'final',
        label: 'Final',
        data: { profile: { name: 'Final name', level: 3, secret: 'final secret' } },
      },
    ] satisfies ComparisonVersion<TestData>[];
    const config = {
      selection: {
        include: ['profile', 'profile.name', 'profile.level'],
        exclude: ['profile.secret'],
      },
    } satisfies BuildComparisonConfig;
    const parent = rowId('profile');
    const name = rowId('profile', 'name');

    const overridden = buildEditedMerge(
      versions,
      { [parent]: source('review'), [name]: source('final') },
      {},
      config,
    );
    expect(overridden.isComplete).toBe(true);
    expect(overridden.mergedData).toEqual({
      profile: { name: 'Final name', level: 2, secret: 'baseline secret' },
    });
    expect(overridden.scope).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolutionKey: parent, role: 'container', active: true }),
        expect.objectContaining({ resolutionKey: name, parentResolutionKey: parent, active: true }),
      ]),
    );
    expectCanonicalValuePatches(overridden);

    const cleared = buildEditedMerge(versions, { [parent]: source('review') }, {}, config);
    expect(cleared.isComplete).toBe(true);
    expect(cleared.mergedData).toEqual({
      profile: { name: 'Review name', level: 2, secret: 'baseline secret' },
    });
  });

  it('applies edit over child source over inherited container source without mutating inputs', () => {
    const base = { profile: { title: 'Base', enabled: false } };
    const review = { profile: { title: 'Review', enabled: true } };
    const final = { profile: { title: 'Final', enabled: false } };
    const versions = [
      { id: 'base', label: 'Base', data: base },
      { id: 'review', label: 'Review', data: review },
      { id: 'final', label: 'Final', data: final },
    ] satisfies ComparisonVersion<TestData>[];
    const parent = rowId('profile');
    const title = rowId('profile', 'title');
    const resolutions = { [parent]: source('review'), [title]: source('final') };
    const edits = { [title]: { kind: 'set', value: 'Edited' } } satisfies MergeEdits;

    const edited = buildEditedMerge(versions, resolutions, edits);
    expect(edited.isComplete).toBe(true);
    expect(edited.mergedData).toEqual({ profile: { title: 'Edited', enabled: true } });
    expect(edited.resolvedPatch).toContainEqual(
      expect.objectContaining({
        op: 'set',
        resolutionKey: title,
        path: ['profile', 'title'],
        value: 'Edited',
        origin: 'user-edit',
      }),
    );
    expect(base).toEqual({ profile: { title: 'Base', enabled: false } });
    expect(review).toEqual({ profile: { title: 'Review', enabled: true } });
    expect(final).toEqual({ profile: { title: 'Final', enabled: false } });
    expect(resolutions).toEqual({ [parent]: source('review'), [title]: source('final') });
    expect(edits).toEqual({ [title]: { kind: 'set', value: 'Edited' } });

    const clearedEdit = buildEditedMerge(versions, resolutions, {});
    expect(clearedEdit.mergedData).toEqual({ profile: { title: 'Final', enabled: true } });
    const clearedChild = buildEditedMerge(versions, { [parent]: source('review') }, {});
    expect(clearedChild.mergedData).toEqual({ profile: { title: 'Review', enabled: true } });
  });

  it('keeps set null distinct from delete and emits raw user-edit patches', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { nullable: 'base', optional: 'present' } },
      { id: 'review', label: 'Review', data: { nullable: 'review', optional: 'review' } },
    ] satisfies ComparisonVersion<TestData>[];
    const nullable = rowId('nullable');
    const optional = rowId('optional');
    const result = buildEditedMerge(
      versions,
      { [nullable]: source('review'), [optional]: source('review') },
      {
        [nullable]: { kind: 'set', value: null },
        [optional]: { kind: 'delete' },
      },
    );

    expect(result.isComplete).toBe(true);
    expect(result.mergedData.nullable).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(result.mergedData, 'optional')).toBe(false);
    expect(result.resolvedPatch).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'set',
          resolutionKey: nullable,
          value: null,
          origin: 'user-edit',
        }),
        expect.objectContaining({
          op: 'delete',
          resolutionKey: optional,
          origin: 'user-edit',
        }),
      ]),
    );
  });

  it.each([
    ['NaN', Number.NaN, 'number'],
    ['positive infinity', Number.POSITIVE_INFINITY, 'number'],
    ['object', { nested: true }, 'object'],
    ['array', ['not', 'primitive'], 'array'],
    ['Date', new Date('2026-09-04T00:00:00.000Z'), 'date'],
    ['function', () => 'not editable', 'function'],
    ['symbol', Symbol('not editable'), 'symbol'],
  ])('rejects unsupported %s edit values with row path and type context', (_label, value, type) => {
    const versions = [
      { id: 'base', label: 'Base', data: { amount: 1 } },
      { id: 'review', label: 'Review', data: { amount: 2 } },
    ] satisfies ComparisonVersion<TestData>[];
    const amount = rowId('amount');

    expect(() => buildEditedMerge(versions, {}, { [amount]: { kind: 'set', value } })).toThrow(
      new RegExp(`amount.*${type}|${type}.*amount`, 'i'),
    );
  });

  it('inherits a keyed array and keyed item source while preserving explicit child precedence', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: { lines: [{ sku: 'P-100', quantity: 1, note: 'base' }] },
      },
      {
        id: 'review',
        label: 'Review',
        data: { lines: [{ sku: 'P-100', quantity: 2, note: 'review' }] },
      },
      {
        id: 'final',
        label: 'Final',
        data: { lines: [{ sku: 'P-100', quantity: 3, note: 'final' }] },
      },
    ] satisfies ComparisonVersion<TestData>[];
    const keyFields = { lines: 'sku' } as const;
    const array = rowId('lines');
    const item = rowId('lines', 'P-100');
    const quantity = rowId('lines', 'P-100', 'quantity');
    const result = buildEditedMerge(
      versions,
      { [array]: source('review'), [item]: source('review'), [quantity]: source('final') },
      {},
      { arrayItemKeyFields: keyFields },
    );

    expect(result.isComplete).toBe(true);
    expect(result.mergedData).toEqual({
      lines: [{ sku: 'P-100', quantity: 3, note: 'review' }],
    });
    expect(result.scope).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolutionKey: array, role: 'container', active: true }),
        expect.objectContaining({ resolutionKey: item, role: 'container', active: true }),
        expect.objectContaining({
          resolutionKey: quantity,
          parentResolutionKey: item,
          active: true,
        }),
      ]),
    );
    expect(result.scope.some((entry) => entry.path.at(-1) === 'sku')).toBe(false);
    expectCanonicalValuePatches(result);
  });

  it('keeps keyed child edits dormant under exclude and applies them only after include', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [] } },
      {
        id: 'review',
        label: 'Review',
        data: { lines: [{ sku: 'P-300', quantity: 3, note: 'review' }] },
      },
      {
        id: 'final',
        label: 'Final',
        data: { lines: [{ sku: 'P-300', quantity: 30, note: 'final' }] },
      },
    ] satisfies ComparisonVersion<TestData>[];
    const keyFields = { lines: 'sku' } as const;
    const item = rowId('lines', 'P-300');
    const quantity = rowId('lines', 'P-300', 'quantity');
    const note = rowId('lines', 'P-300', 'note');
    const edits = { [quantity]: { kind: 'set', value: 9 } } satisfies MergeEdits;

    const excluded = buildEditedMerge(
      versions,
      { [item]: exclude(), [note]: source('final') },
      edits,
      { arrayItemKeyFields: keyFields },
    );
    expect(excluded.isComplete).toBe(true);
    expect(excluded.unresolvedPaths).not.toContainEqual(['lines', 'P-300', 'quantity']);
    expect(excluded.resolvedPatch).toEqual([
      expect.objectContaining({ op: 'exclude-keyed-item', resolutionKey: item }),
    ]);

    const included = buildEditedMerge(
      versions,
      { [item]: source('review'), [note]: source('final') },
      edits,
      { arrayItemKeyFields: keyFields },
    );
    expect(included.isComplete).toBe(true);
    expect(included.mergedData).toEqual({
      lines: [{ sku: 'P-300', quantity: 9, note: 'final' }],
    });
    expect(included.resolvedPatch).toEqual([
      expect.objectContaining({
        op: 'include-keyed-item',
        resolutionKey: item,
        value: { sku: 'P-300', quantity: 9, note: 'final' },
        sourceVersionId: 'review',
      }),
    ]);
    expect(included.resolvedPatch).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolutionKey: quantity }),
        expect.objectContaining({ resolutionKey: note }),
      ]),
    );
  });
});

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ComparisonTableTexts,
  ComparisonTableTextOverrides,
  MergeEdits,
  MergeResolutions,
} from '../index';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

const rowId = (...path: string[]) => JSON.stringify(path);
const overrides = (texts: ComparisonTableTextOverrides) => texts;

const textKeys = [
  'tableRegionLabel',
  'propertyColumn',
  'baselineBadge',
  'baselineBadgeAriaLabel',
  'differenceIndicator',
  'differenceIndicatorAriaLabel',
  'globalSearchLabel',
  'globalSearchPlaceholder',
  'onlyDifferencesLabel',
  'onlyDifferencesCount',
  'nodeSearchLabel',
  'nodeFilterLabel',
  'nodeFilterPlaceholder',
  'finalColumn',
  'sourceChoiceLabel',
  'presenceGroupLabel',
  'includeFromLabel',
  'excludeLabel',
  'clearResolutionLabel',
  'clearEditLabel',
  'editValueLabel',
  'setNullLabel',
  'deleteValueLabel',
  'inheritedSourceStatus',
  'needsSelectionStatus',
  'completeStatus',
  'unresolvedStatus',
  'deletedStatus',
  'addedStatus',
  'removedStatus',
  'missingStatus',
  'validationError',
] as const satisfies readonly (keyof ComparisonTableTexts)[];
type MissingTextKey = Exclude<keyof ComparisonTableTexts, (typeof textKeys)[number]>;
const completeTextInventory: MissingTextKey extends never ? true : never = true;

const versions = [
  { id: 'base', label: 'Base', data: { profile: { name: 'Before' }, title: 'before' } },
  { id: 'review', label: 'Review', data: { profile: { name: 'After' }, title: 'after' } },
];

afterEach(() => cleanup());

describe('Issue #18 local text overrides', () => {
  it('keeps the complete centralized default inventory byte-compatible when texts is omitted', () => {
    expect(completeTextInventory).toBe(true);
    expect(textKeys).toHaveLength(32);
    render(<RecursiveComparisonTable versions={versions} comparison={{ baseVersionId: 'base' }} />);

    expect(screen.getByRole('region', { name: 'Recursive comparison table' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Property' })).toBeInTheDocument();
    expect(screen.getByLabelText('Base')).toHaveTextContent('Base');
    expect(screen.getByRole('textbox', { name: 'Search comparison' })).toHaveAttribute(
      'placeholder',
      'Search properties and values',
    );
    expect(screen.getByRole('switch', { name: 'Only show differences' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Diff')).not.toHaveLength(0);
    expect(screen.getAllByLabelText('Diff')[0]).toHaveTextContent('Diff');
    expect(screen.getByRole('button', { name: 'Search within profile' })).toBeInTheDocument();
  });

  it('applies static partial overrides while every omitted key falls back independently', () => {
    render(
      <RecursiveComparisonTable
        versions={versions}
        comparison={{ baseVersionId: 'base' }}
        texts={overrides({
          tableRegionLabel: 'Localized comparison',
          propertyColumn: 'Field',
          baselineBadge: 'Origin',
          baselineBadgeAriaLabel: 'Baseline version',
          differenceIndicator: 'Changed',
          differenceIndicatorAriaLabel: 'Changed value',
          globalSearchLabel: 'Find rows',
          onlyDifferencesLabel: 'Changed rows only',
        })}
      />,
    );

    expect(screen.getByRole('region', { name: 'Localized comparison' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
    expect(screen.getByLabelText('Baseline version')).toHaveTextContent('Origin');
    expect(screen.getByRole('textbox', { name: 'Find rows' })).toHaveAttribute(
      'placeholder',
      'Search properties and values',
    );
    expect(screen.getByRole('switch', { name: 'Changed rows only' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Changed value')).not.toHaveLength(0);
    expect(screen.getAllByLabelText('Changed value')[0]).toHaveTextContent('Changed');
  });

  it('passes long property paths and version labels to dynamic search and source formatters', () => {
    const property = 'profileWithAnIntentionallyLongPropertyName';
    const versionLabel = 'Review version with an intentionally long label';
    const nodeSearchLabel = vi.fn(
      ({ propertyLabel, path }: { propertyLabel: string; path: readonly (string | number)[] }) =>
        `Open ${propertyLabel} at ${path.join('/')}`,
    );
    const nodeFilterLabel = vi.fn(
      ({ propertyLabel, path }: { propertyLabel: string; path: readonly (string | number)[] }) =>
        `Filter ${propertyLabel} at ${path.join('/')}`,
    );
    const nodeFilterPlaceholder = vi.fn(
      ({ path }: { propertyLabel: string; path: readonly (string | number)[] }) =>
        `Query ${path.join('/')}`,
    );
    const sourceChoiceLabel = vi.fn(
      ({
        path,
        versionLabel: label,
      }: {
        path: readonly (string | number)[];
        versionLabel: string;
      }) => `Choose ${path.join('/')} from ${label}`,
    );
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { [property]: { value: 'before' } } },
          {
            id: 'review',
            label: versionLabel,
            data: { [property]: { value: 'after' } },
          },
        ]}
        merge={{ enabled: true }}
        texts={overrides({
          nodeSearchLabel,
          nodeFilterLabel,
          nodeFilterPlaceholder,
          sourceChoiceLabel,
          onlyDifferencesCount: ({ count }) => `${count} changed rows`,
        })}
      />,
    );

    expect(screen.getByText(/changed rows$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Open ${property} at ${property}` }));
    expect(
      screen.getByRole('textbox', { name: `Filter ${property} at ${property}` }),
    ).toHaveAttribute('placeholder', `Query ${property}`);
    expect(
      screen.getByRole('radio', { name: `Choose ${property} from ${versionLabel}` }),
    ).toBeInTheDocument();
    expect(nodeSearchLabel).toHaveBeenCalledWith({ propertyLabel: property, path: [property] });
    expect(sourceChoiceLabel).toHaveBeenCalledWith({ path: [property], versionLabel });
  });

  it('falls back for an explicit undefined own override but preserves an empty string', () => {
    render(
      <RecursiveComparisonTable
        versions={versions}
        texts={overrides({ tableRegionLabel: undefined, propertyColumn: '' })}
      />,
    );

    expect(screen.getByRole('region', { name: 'Recursive comparison table' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(/^$/);
  });

  it('fails fast when a dynamic formatter returns a non-string value', () => {
    const invalidFormatter: () => string = new Proxy(() => '', {
      apply: () => 42,
    });

    expect(() =>
      render(
        <RecursiveComparisonTable
          versions={versions}
          texts={overrides({ onlyDifferencesCount: invalidFormatter })}
        />,
      ),
    ).toThrow(/onlyDifferencesCount.*string/i);
  });

  it('uses merge.finalLabel before texts.finalColumn and otherwise uses the local Final label', () => {
    const { rerender } = render(
      <RecursiveComparisonTable
        versions={versions}
        merge={{ enabled: true, finalLabel: 'Approved result' }}
        texts={overrides({ finalColumn: 'Localized final' })}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Approved result' })).toBeInTheDocument();

    rerender(
      <RecursiveComparisonTable
        versions={versions}
        merge={{ enabled: true }}
        texts={overrides({ finalColumn: 'Localized final' })}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Localized final' })).toBeInTheDocument();

    rerender(<RecursiveComparisonTable versions={versions} merge={{ enabled: true }} />);
    expect(screen.getByRole('columnheader', { name: 'Final' })).toBeInTheDocument();

    rerender(
      <RecursiveComparisonTable
        versions={versions}
        texts={overrides({ finalColumn: 'Localized final' })}
      />,
    );
    expect(screen.queryByRole('columnheader', { name: 'Localized final' })).not.toBeInTheDocument();
  });

  it('localizes source, clear, edit, validation, and live status text without changing raw controls', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { title: 'before', amount: 1 } },
          { id: 'review', label: 'Review', data: { title: 'after', amount: 2 } },
        ]}
        merge={{
          enabled: true,
          defaultValue: { [rowId('title')]: { kind: 'source', versionId: 'review' } },
          defaultEdits: { [rowId('amount')]: { kind: 'set', value: 7 } },
        }}
        texts={overrides({
          sourceChoiceLabel: ({ path, versionLabel }) =>
            `Source ${path.join('/')} from ${versionLabel}`,
          clearResolutionLabel: ({ path }) => `Reset source ${path.join('/')}`,
          clearEditLabel: ({ path }) => `Reset edit ${path.join('/')}`,
          editValueLabel: ({ path }) => `Edit raw ${path.join('/')}`,
          setNullLabel: ({ path }) => `Null raw ${path.join('/')}`,
          deleteValueLabel: ({ path }) => `Delete raw ${path.join('/')}`,
          completeStatus: 'Everything selected',
          validationError: ({ path, error }) => `Invalid ${path.join('/')}: ${error}`,
        })}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Source title from Review' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Reset source title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset edit amount' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Edit raw amount' })).toHaveValue(7);
    expect(screen.getByRole('button', { name: 'Null raw amount' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete raw amount' })).toBeInTheDocument();
    expect(screen.getByText('Everything selected')).toHaveAttribute('aria-live', 'polite');

    const amount = screen.getByRole('spinbutton', { name: 'Edit raw amount' });
    fireEvent.change(amount, { target: { value: 'not-a-number' } });
    fireEvent.blur(amount);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid amount:/);
  });

  it('localizes inherited, unresolved, and deleted Final states independently', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: { profile: { name: 'Before' }, title: 'before', optional: 'before' },
          },
          {
            id: 'review',
            label: 'Review',
            data: { profile: { name: 'After' }, title: 'after', optional: 'after' },
          },
        ]}
        merge={{
          enabled: true,
          defaultValue: {
            [rowId('profile')]: { kind: 'source', versionId: 'review' },
            [rowId('profile', 'name')]: { kind: 'source', versionId: 'base' },
          },
          defaultEdits: { [rowId('optional')]: { kind: 'delete' } },
        }}
        texts={overrides({
          clearResolutionLabel: ({ path }) => `Reset ${path.join('/')}`,
          inheritedSourceStatus: ({ path, sourcePath, versionLabel }) =>
            `${path.join('/')} inherits ${sourcePath} from ${versionLabel}`,
          needsSelectionStatus: 'Still incomplete',
          unresolvedStatus: 'Waiting for choice',
          deletedStatus: 'Removed value',
        })}
      />,
    );

    expect(screen.getByText('Still incomplete')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Waiting for choice')).toBeInTheDocument();
    expect(screen.getByText('Removed value')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset profile/name' }));
    expect(screen.getByText('profile/name inherits profile from Review')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('localizes keyed presence controls and Added, Removed, and Missing badges', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: {
              lines: [
                { sku: 'P-400', amount: 4 },
                { sku: 'P-500', amount: 5 },
              ],
            },
          },
          {
            id: 'review',
            label: 'Review',
            data: { lines: [{ sku: 'P-300', amount: 3 }] },
          },
          {
            id: 'final',
            label: 'Final version',
            data: {
              lines: [
                { sku: 'P-300', amount: 30 },
                { sku: 'P-400', amount: 40 },
              ],
            },
          },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        merge={{ enabled: true }}
        texts={overrides({
          presenceGroupLabel: ({ path }) => `Presence ${path.join('/')}`,
          includeFromLabel: ({ path, versionLabel }) =>
            `Keep ${path.join('/')} from ${versionLabel}`,
          excludeLabel: ({ path }) => `Drop ${path.join('/')}`,
          clearResolutionLabel: ({ path }) => `Reset ${path.join('/')}`,
          needsSelectionStatus: 'Choose a result',
          completeStatus: 'Resolved',
          addedStatus: 'New item',
          removedStatus: 'Gone item',
          missingStatus: 'Absent',
        })}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: 'Presence lines/P-300' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Keep lines/P-300 from Review' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Drop lines/P-300' })).toBeInTheDocument();
    expect(screen.getByText('Choose a result')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('New item')).toBeInTheDocument();
    expect(screen.getByText('Gone item')).toBeInTheDocument();
    expect(screen.getByText(/Absent.*review/i)).toBeInTheDocument();
  });

  it('keeps text dictionaries isolated between table instances', () => {
    render(
      <>
        <RecursiveComparisonTable
          versions={versions}
          texts={overrides({ tableRegionLabel: 'First table', propertyColumn: 'First field' })}
        />
        <RecursiveComparisonTable
          versions={versions}
          texts={overrides({ tableRegionLabel: 'Second table', propertyColumn: 'Second field' })}
        />
      </>,
    );

    expect(
      within(screen.getByRole('region', { name: 'First table' })).getByRole('columnheader', {
        name: 'First field',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Second table' })).getByRole('columnheader', {
        name: 'Second field',
      }),
    ).toBeInTheDocument();
  });

  it('keeps controlled echo results, raw renderers, patches, and source decisions independent of texts', () => {
    const onChange = vi.fn();
    const onEditsChange = vi.fn();
    const empty: MergeResolutions = {};
    const emptyEdits: MergeEdits = {};
    const localized = overrides({
      sourceChoiceLabel: ({ path, versionLabel }) => `Use ${versionLabel} for ${path.join('/')}`,
      editValueLabel: ({ path }) => `Edit raw ${path.join('/')}`,
      globalSearchLabel: 'Localized search',
      finalColumn: 'Result',
    });
    const propsFor = (value: MergeResolutions, edits: MergeEdits) => ({
      versions: [
        { id: 'base', label: 'Base', data: { title: 'before' } },
        { id: 'review', label: 'Review', data: { title: 'after' } },
      ],
      renderers: { text: (value: unknown) => `rendered:${String(value)}` },
      merge: { enabled: true, value, edits, onChange, onEditsChange },
      texts: localized,
    });
    const { rerender } = render(<RecursiveComparisonTable {...propsFor(empty, emptyEdits)} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Use Review for title' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [proposal, result] = onChange.mock.calls[0] ?? [];
    expect(proposal).toEqual({ [rowId('title')]: { kind: 'source', versionId: 'review' } });
    expect(result).toMatchObject({
      mergedData: { title: 'after' },
      resolvedPatch: [
        expect.objectContaining({
          op: 'set',
          path: ['title'],
          value: 'after',
          sourceVersionId: 'review',
        }),
      ],
      sourceDecisions: [
        expect.objectContaining({
          kind: 'source',
          path: ['title'],
          sourceVersionId: 'review',
        }),
      ],
    });
    expect(screen.getByRole('radio', { name: 'Use Review for title' })).not.toBeChecked();

    rerender(<RecursiveComparisonTable {...propsFor(proposal, emptyEdits)} />);
    expect(screen.getByRole('radio', { name: 'Use Review for title' })).toBeChecked();
    expect(screen.getAllByText('rendered:after')).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Edit raw title' }), {
      target: { value: 'manual raw' },
    });
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    const [editProposal, editedResult] = onEditsChange.mock.calls[0] ?? [];
    expect(editProposal).toEqual({ [rowId('title')]: { kind: 'set', value: 'manual raw' } });
    expect(editedResult).toMatchObject({
      mergedData: { title: 'manual raw' },
      resolvedPatch: [
        expect.objectContaining({
          op: 'set',
          path: ['title'],
          value: 'manual raw',
          origin: 'user-edit',
        }),
      ],
    });
    expect(screen.getAllByText('rendered:after')).toHaveLength(2);

    rerender(<RecursiveComparisonTable {...propsFor(proposal, editProposal)} />);
    expect(screen.getByText('rendered:manual raw')).toBeInTheDocument();
    expect(onEditsChange).toHaveBeenCalledTimes(1);
  });

  it('never treats formatter output as searchable row data or changes difference filtering', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: { profile: { name: 'Before' }, unchanged: 'same' },
          },
          {
            id: 'review',
            label: 'Review',
            data: { profile: { name: 'After' }, unchanged: 'same' },
          },
        ]}
        texts={overrides({
          onlyDifferencesCount: ({ count }) => `OVERRIDE-ONLY ${count}`,
          nodeSearchLabel: ({ propertyLabel }) => `OVERRIDE-ONLY ${propertyLabel}`,
        })}
      />,
    );

    expect(screen.getByText(/OVERRIDE-ONLY \d+/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search comparison' }), {
      target: { value: 'OVERRIDE-ONLY' },
    });
    expect(screen.queryByText('profile')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search comparison' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('switch', { name: 'Only show differences' }));
    expect(screen.getByText('profile')).toBeInTheDocument();
    expect(screen.queryByText('unchanged')).not.toBeInTheDocument();
  });
});

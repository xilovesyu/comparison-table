import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  MergeEdit,
  MergeEdits,
  MergeResolution,
  MergeResolutions,
  MergeResult,
  PropertyPath,
} from '../core/types';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

interface TestMergeEditorContext {
  readonly path: PropertyPath;
  readonly sourceValue: unknown;
  readonly edit?: MergeEdit;
  readonly commit: (edit: MergeEdit) => void;
  readonly reportError: (message: string) => void;
}

type TestMergeEditor = (context: TestMergeEditorContext) => ReactNode;

declare module '../core/types' {
  interface PropertyDefinition {
    /** Test-only placeholder for the approved Issue #17 custom raw editor seam. */
    mergeEditor?: TestMergeEditor;
  }

  interface DisplayRule {
    /** Test-only placeholder for the approved Issue #17 custom raw editor seam. */
    mergeEditor?: TestMergeEditor;
  }
}

const rowId = (...path: string[]) => JSON.stringify(path);
const source = (versionId: string): MergeResolution => ({ kind: 'source', versionId });

const primitiveVersions = [
  { id: 'base', label: 'Base', data: { title: 'before', amount: 1 } },
  { id: 'review', label: 'Review', data: { title: 'after', amount: 2 } },
];

describe('Issue #17 architecture follow-up contracts', () => {
  it('clears a committed edit and falls back to the explicit source without clearing it', () => {
    const title = rowId('title');
    const onChange = vi.fn();
    const onEditsChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={primitiveVersions}
        merge={{
          enabled: true,
          defaultValue: { [title]: source('review') },
          defaultEdits: { [title]: { kind: 'set', value: 'manual title' } },
          onChange,
          onEditsChange,
        }}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Edit title' })).toHaveValue('manual title');
    fireEvent.click(screen.getByRole('button', { name: 'Clear edit title' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    const [nextEdits, nextResult] = onEditsChange.mock.calls[0] ?? [];
    expect(nextEdits).toEqual({});
    expect(nextResult).toMatchObject({
      isComplete: false,
      mergedData: { title: 'after', amount: 1 },
    });
    expect(screen.getByRole('radio', { name: 'title Review' })).toBeChecked();
    expect(screen.getAllByText('after')).toHaveLength(2);
  });

  it('clears a child edit back to its nearest object-container source', () => {
    const profile = rowId('profile');
    const name = rowId('profile', 'name');
    const onEditsChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: { profile: { name: 'Base name', enabled: false } },
          },
          {
            id: 'review',
            label: 'Review',
            data: { profile: { name: 'Review name', enabled: true } },
          },
        ]}
        merge={{
          enabled: true,
          defaultValue: { [profile]: source('review') },
          defaultEdits: { [name]: { kind: 'set', value: 'Manual name' } },
          onEditsChange,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear edit profile.name' }));
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    expect(onEditsChange.mock.calls[0]?.[0]).toEqual({});
    expect(onEditsChange.mock.calls[0]?.[1]).toMatchObject({
      isComplete: true,
      mergedData: { profile: { name: 'Review name', enabled: true } },
    });
    expect(screen.getAllByText('Review name')).toHaveLength(2);
  });

  it('publishes controlled Clear edit as an edit-only proposal and waits for parent echo', () => {
    const title = rowId('title');
    const resolutions = { [title]: source('review') } satisfies MergeResolutions;
    const edits = {
      [title]: { kind: 'set', value: 'controlled title' },
    } satisfies MergeEdits;
    const onChange = vi.fn();
    const onEditsChange = vi.fn();
    const propsFor = (nextEdits: MergeEdits) =>
      ({
        versions: primitiveVersions,
        merge: {
          enabled: true,
          value: resolutions,
          edits: nextEdits,
          onChange,
          onEditsChange,
        },
      }) satisfies React.ComponentProps<typeof RecursiveComparisonTable>;
    const { rerender } = render(<RecursiveComparisonTable {...propsFor(edits)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear edit title' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    expect(onEditsChange.mock.calls[0]?.[0]).toEqual({});
    expect(onEditsChange.mock.calls[0]?.[1]).toMatchObject({
      mergedData: { title: 'after', amount: 1 },
    });
    expect(screen.getByRole('textbox', { name: 'Edit title' })).toHaveValue('controlled title');

    rerender(<RecursiveComparisonTable {...propsFor({})} />);
    expect(screen.getByRole('textbox', { name: 'Edit title' })).toHaveValue('after');
    expect(screen.getByRole('radio', { name: 'title Review' })).toBeChecked();
  });

  it('offers object-container sources only when the path exists with an object value', () => {
    const profile = rowId('profile');
    const versions = [
      { id: 'base', label: 'Base', data: { profile: { name: 'Base name' } } },
      { id: 'missing', label: 'Missing', data: {} },
      { id: 'wrong', label: 'Wrong type', data: { profile: 'not an object' } },
      { id: 'review', label: 'Review', data: { profile: { name: 'Review name' } } },
    ];
    const propsFor = (value: MergeResolutions) =>
      ({
        versions,
        merge: { enabled: true, value, edits: {} },
      }) satisfies React.ComponentProps<typeof RecursiveComparisonTable>;
    const { rerender } = render(
      <RecursiveComparisonTable {...propsFor({ [profile]: source('missing') })} />,
    );

    expect(screen.getByRole('radio', { name: 'profile Base' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'profile Review' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'profile Missing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'profile Wrong type' })).not.toBeInTheDocument();
    expect(screen.getByText('Needs selection')).toHaveAttribute('aria-live', 'polite');

    rerender(<RecursiveComparisonTable {...propsFor({ [profile]: source('wrong') })} />);
    expect(screen.getByText('Needs selection')).toHaveAttribute('aria-live', 'polite');
  });

  it('offers a non-keyed atomic array only from versions where the path is an array', () => {
    const lines = rowId('lines');
    const versions = [
      { id: 'base', label: 'Base', data: { lines: ['base'] } },
      { id: 'missing', label: 'Missing', data: {} },
      { id: 'wrong', label: 'Wrong type', data: { lines: { value: 'not an array' } } },
      { id: 'review', label: 'Review', data: { lines: ['review'] } },
    ];
    render(
      <RecursiveComparisonTable
        versions={versions}
        merge={{ enabled: true, value: { [lines]: source('missing') }, edits: {} }}
      />,
    );

    expect(screen.getByRole('radio', { name: 'lines Base' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'lines Review' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'lines Missing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'lines Wrong type' })).not.toBeInTheDocument();
    expect(screen.getByText('Needs selection')).toHaveAttribute('aria-live', 'polite');
  });

  it('keeps keyed-item source choices limited to versions where that identity is present', () => {
    const item = rowId('lines', 'P-100');
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: { lines: [{ sku: 'P-100', quantity: 1 }] },
          },
          { id: 'missing', label: 'Missing', data: { lines: [] } },
          {
            id: 'review',
            label: 'Review',
            data: { lines: [{ sku: 'P-100', quantity: 2 }] },
          },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        merge={{ enabled: true, value: { [item]: source('missing') }, edits: {} }}
      />,
    );

    expect(
      screen.getByRole('radio', { name: 'lines.P-100 Include from Base' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'lines.P-100 Include from Review' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: 'lines.P-100 Include from Missing' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Needs selection')).toHaveAttribute('aria-live', 'polite');
  });

  it.each(['source-then-edit', 'edit-then-source'] as const)(
    'completes one controlled %s proposal pair only after the parent echoes both records',
    (order) => {
      const title = rowId('title');
      const amount = rowId('amount');
      let sourceProposal: MergeResolutions = {};
      let editProposal: MergeEdits = {};
      const onChange = vi.fn((next: MergeResolutions) => {
        sourceProposal = next;
      });
      const onEditsChange = vi.fn((next: MergeEdits) => {
        editProposal = next;
      });
      const onComplete = vi.fn();
      const propsFor = (value: MergeResolutions, edits: MergeEdits) =>
        ({
          versions: primitiveVersions,
          merge: { enabled: true, value, edits, onChange, onEditsChange, onComplete },
        }) satisfies React.ComponentProps<typeof RecursiveComparisonTable>;
      const { rerender } = render(<RecursiveComparisonTable {...propsFor({}, {})} />);
      const proposeSource = () =>
        fireEvent.click(screen.getByRole('radio', { name: 'amount Review' }));
      const proposeEdit = () =>
        fireEvent.change(screen.getByRole('textbox', { name: 'Edit title' }), {
          target: { value: 'Manual title' },
        });

      if (order === 'source-then-edit') {
        proposeSource();
        proposeEdit();
      } else {
        proposeEdit();
        proposeSource();
      }
      expect(sourceProposal).toEqual({ [amount]: source('review') });
      expect(editProposal).toEqual({ [title]: { kind: 'set', value: 'Manual title' } });
      expect(onComplete).not.toHaveBeenCalled();

      rerender(<RecursiveComparisonTable {...propsFor(sourceProposal, editProposal)} />);
      expect(onComplete).toHaveBeenCalledTimes(1);
      rerender(
        <RecursiveComparisonTable {...propsFor({ ...sourceProposal }, { ...editProposal })} />,
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
    },
  );

  it('does not complete after a one-sided echo, then completes once after the pair echo', () => {
    const title = rowId('title');
    const amount = rowId('amount');
    let sourceProposal: MergeResolutions = {};
    let editProposal: MergeEdits = {};
    const onChange = vi.fn((next: MergeResolutions) => {
      sourceProposal = next;
    });
    const onEditsChange = vi.fn((next: MergeEdits) => {
      editProposal = next;
    });
    const onComplete = vi.fn();
    const propsFor = (value: MergeResolutions, edits: MergeEdits) =>
      ({
        versions: primitiveVersions,
        merge: { enabled: true, value, edits, onChange, onEditsChange, onComplete },
      }) satisfies React.ComponentProps<typeof RecursiveComparisonTable>;
    const { rerender } = render(<RecursiveComparisonTable {...propsFor({}, {})} />);

    fireEvent.click(screen.getByRole('radio', { name: 'amount Review' }));
    rerender(<RecursiveComparisonTable {...propsFor(sourceProposal, {})} />);
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit title' }), {
      target: { value: 'Manual title' },
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(editProposal).toEqual({ [title]: { kind: 'set', value: 'Manual title' } });
    expect(sourceProposal).toEqual({ [amount]: source('review') });

    rerender(<RecursiveComparisonTable {...propsFor(sourceProposal, editProposal)} />);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('uses definition and rule merge editors to validate and commit raw values, never renderer text', () => {
    const reviewedAt = new Date('2026-09-05T10:00:00.000Z');
    const onEditsChange = vi.fn<(edits: MergeEdits, result: MergeResult) => void>();
    const dateEditor: TestMergeEditor = ({ commit }) => (
      <button type="button" onClick={() => commit({ kind: 'set', value: reviewedAt })}>
        Commit reviewed date
      </button>
    );
    const statusEditor: TestMergeEditor = ({ commit }) => (
      <button type="button" onClick={() => commit({ kind: 'set', value: 'approved' })}>
        Commit status enum
      </button>
    );
    const accountEditor: TestMergeEditor = ({ commit }) => (
      <button type="button" onClick={() => commit({ kind: 'set', value: { id: 'C-42', tier: 2 } })}>
        Commit custom account
      </button>
    );
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'base',
            label: 'Base',
            data: {
              reviewedAt: new Date('2026-09-01T00:00:00.000Z'),
              status: 'draft',
              account: 'C-1',
            },
          },
          {
            id: 'review',
            label: 'Review',
            data: {
              reviewedAt: new Date('2026-09-02T00:00:00.000Z'),
              status: 'review',
              account: 'C-2',
            },
          },
        ]}
        propertyDefinitions={[
          {
            key: 'reviewedAt',
            label: 'Reviewed at',
            path: ['reviewedAt'],
            level: 0,
            type: 'date',
            renderValue: () => 'DISPLAY DATE ONLY',
            mergeEditor: dateEditor,
          },
          {
            key: 'status',
            label: 'Status',
            path: ['status'],
            level: 0,
            type: 'string',
            renderValue: () => 'DISPLAY STATUS ONLY',
          },
          {
            key: 'account',
            label: 'Account',
            path: ['account'],
            level: 0,
            type: 'account-ref',
            renderValue: () => 'DISPLAY ACCOUNT ONLY',
            mergeEditor: accountEditor,
          },
        ]}
        rules={[{ path: 'status', mergeEditor: statusEditor }]}
        merge={{ enabled: true, edits: {}, onEditsChange }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Commit reviewed date' }));
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    expect(onEditsChange.mock.calls[0]?.[0]).toEqual({
      [rowId('reviewedAt')]: { kind: 'set', value: reviewedAt },
    });
    expect(onEditsChange.mock.calls[0]?.[1].mergedData).toMatchObject({ reviewedAt });
    expect(onEditsChange.mock.calls[0]?.[1].mergedData).not.toMatchObject({
      reviewedAt: 'DISPLAY DATE ONLY',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Commit status enum' }));
    expect(onEditsChange).toHaveBeenCalledTimes(2);
    expect(onEditsChange.mock.calls[1]?.[0]).toEqual({
      [rowId('status')]: { kind: 'set', value: 'approved' },
    });
    expect(onEditsChange.mock.calls[1]?.[1].mergedData).toMatchObject({ status: 'approved' });
    expect(onEditsChange.mock.calls[1]?.[1].mergedData).not.toMatchObject({
      status: 'DISPLAY STATUS ONLY',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Commit custom account' }));
    expect(onEditsChange).toHaveBeenCalledTimes(3);
    expect(onEditsChange.mock.calls[2]?.[0]).toEqual({
      [rowId('account')]: { kind: 'set', value: { id: 'C-42', tier: 2 } },
    });
    expect(onEditsChange.mock.calls[2]?.[1].mergedData).toMatchObject({
      account: { id: 'C-42', tier: 2 },
    });
    expect(onEditsChange.mock.calls[2]?.[1].mergedData).not.toMatchObject({
      account: 'DISPLAY ACCOUNT ONLY',
    });
  });

  it('keeps a custom invalid draft local until its validator permits a raw commit', () => {
    const onEditsChange = vi.fn();
    const decimalEditor: TestMergeEditor = ({ commit, reportError }) => (
      <div>
        <button type="button" onClick={() => reportError('price must be a decimal')}>
          Reject decimal draft
        </button>
        <button type="button" onClick={() => commit({ kind: 'set', value: '12.34' })}>
          Commit decimal raw value
        </button>
      </div>
    );
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { price: '10.00' } },
          { id: 'review', label: 'Review', data: { price: '11.50' } },
        ]}
        rules={[{ path: 'price', mergeEditor: decimalEditor }]}
        merge={{ enabled: true, edits: {}, onEditsChange }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject decimal draft' }));
    expect(screen.getByRole('alert')).toHaveTextContent('price must be a decimal');
    expect(onEditsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Commit decimal raw value' }));
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    expect(onEditsChange.mock.calls[0]?.[0]).toEqual({
      [rowId('price')]: { kind: 'set', value: '12.34' },
    });
  });
});

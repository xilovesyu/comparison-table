import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MergeEdits, MergeResolutions } from '../core/types';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

const rowId = (...path: string[]) => JSON.stringify(path);

describe('Issue #17 merge controls and independent edit state', () => {
  it('uses keyboard-capable Ant Design source, presence, and clear controls with announced state', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: { title: 'before', lines: [{ sku: 'P-100', quantity: 1 }] },
      },
      {
        id: 'review',
        label: 'Review',
        data: {
          title: 'after',
          lines: [
            { sku: 'P-100', quantity: 2 },
            { sku: 'P-300', quantity: 3 },
          ],
        },
      },
    ];
    render(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        merge={{
          enabled: true,
          defaultValue: {
            [rowId('title')]: { kind: 'source', versionId: 'review' },
            [rowId('lines', 'P-300')]: { kind: 'source', versionId: 'review' },
          },
        }}
      />,
    );

    const sourceRadio = screen.getByRole('radio', { name: /^title Review$/i });
    const presenceRadio = screen.getByRole('radio', {
      name: /^lines\.P-300 Include from Review$/i,
    });
    const sourceClear = screen.getByRole('button', { name: /^Clear title$/i });
    const presenceClear = screen.getByRole('button', { name: /^Clear lines\.P-300$/i });

    for (const radio of [sourceRadio, presenceRadio]) {
      expect(radio).toHaveClass('ant-radio-input');
      expect(radio.closest('label')).toHaveClass('ant-radio-wrapper');
      expect(radio).toHaveAttribute('type', 'radio');
      radio.focus();
      expect(radio).toHaveFocus();
    }
    for (const button of [sourceClear, presenceClear]) {
      expect(button).toHaveClass('ant-btn');
      expect(button).toHaveAttribute('type', 'button');
      button.focus();
      expect(button).toHaveFocus();
    }
    expect(screen.getByText('Complete')).toHaveAttribute('aria-live', 'polite');
  });

  it('lets an object container source resolve visible children while a child overrides and clears to inheritance', () => {
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
        label: 'Final version',
        data: { profile: { name: 'Final name', level: 3, secret: 'final secret' } },
      },
    ];
    const onChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={versions}
        selection={{
          include: ['profile', 'profile.name', 'profile.level'],
          exclude: ['profile.secret'],
        }}
        merge={{
          enabled: true,
          defaultValue: {
            [rowId('profile')]: { kind: 'source', versionId: 'review' },
            [rowId('profile', 'name')]: { kind: 'source', versionId: 'final' },
          },
          onChange,
        }}
      />,
    );

    expect(screen.getByRole('radio', { name: /^profile Review$/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^profile\.name Final version$/i })).toBeChecked();
    expect(screen.getAllByText('Final name')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /^Clear profile\.name$/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, result] = onChange.mock.calls[0] ?? [];
    expect(next).toEqual({ [rowId('profile')]: { kind: 'source', versionId: 'review' } });
    expect(result).toMatchObject({
      isComplete: true,
      mergedData: {
        profile: { name: 'Review name', level: 2, secret: 'baseline secret' },
      },
    });
    expect(screen.getAllByText('Review name')).toHaveLength(2);
    expect(screen.getByText('Inherited from profile: Review')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('supports keyed array and keyed item container sources with explicit child override and clear', () => {
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
        label: 'Final version',
        data: { lines: [{ sku: 'P-100', quantity: 3, note: 'final' }] },
      },
    ];
    const onChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        merge={{
          enabled: true,
          defaultValue: {
            [rowId('lines')]: { kind: 'source', versionId: 'review' },
            [rowId('lines', 'P-100')]: { kind: 'source', versionId: 'review' },
            [rowId('lines', 'P-100', 'quantity')]: { kind: 'source', versionId: 'final' },
          },
          onChange,
        }}
      />,
    );

    expect(screen.getByRole('radio', { name: /^lines Review$/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^lines\.P-100 Review$/i })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /^lines\.P-100\.quantity Final version$/i }),
    ).toBeChecked();
    expect(screen.queryByRole('radio', { name: /\.sku /i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Clear lines\.P-100\.quantity$/i }));
    const [, result] = onChange.mock.calls[0] ?? [];
    expect(result).toMatchObject({
      isComplete: true,
      mergedData: { lines: [{ sku: 'P-100', quantity: 2, note: 'review' }] },
    });
    expect(screen.getByText('Inherited from lines.P-100: Review')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('uses Ant Design primitive editors and publishes raw set/null/delete edits independently', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: { title: 'before', amount: 1, enabled: true, nullable: 'value', optional: 'value' },
      },
      {
        id: 'review',
        label: 'Review',
        data: { title: 'after', amount: 2, enabled: false, nullable: 'other', optional: 'other' },
      },
    ];
    const defaultEdits = {
      [rowId('title')]: { kind: 'set', value: 'Edited' },
      [rowId('amount')]: { kind: 'set', value: 7 },
      [rowId('enabled')]: { kind: 'set', value: false },
      [rowId('nullable')]: { kind: 'set', value: null },
      [rowId('optional')]: { kind: 'delete' },
    } satisfies MergeEdits;
    const onEditsChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={versions}
        merge={{ enabled: true, defaultEdits, onEditsChange }}
      />,
    );

    const title = screen.getByRole('textbox', { name: /^Edit title$/i });
    const amount = screen.getByRole('spinbutton', { name: /^Edit amount$/i });
    const enabled = screen.getByRole('switch', { name: /^Edit enabled$/i });
    expect(title).toHaveClass('ant-input');
    expect(title).toHaveValue('Edited');
    expect(amount).toHaveClass('ant-input-number-input');
    expect(amount).toHaveValue(7);
    expect(enabled).toHaveClass('ant-switch');
    expect(enabled).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: /^Set nullable to null$/i })).toHaveClass('ant-btn');
    expect(screen.getByRole('button', { name: /^Delete optional$/i })).toHaveClass('ant-btn');

    fireEvent.change(title, { target: { value: 'Typed raw value' } });
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    const [nextEdits, result] = onEditsChange.mock.calls[0] ?? [];
    expect(nextEdits).toEqual({
      ...defaultEdits,
      [rowId('title')]: { kind: 'set', value: 'Typed raw value' },
    });
    expect(result.mergedData).toMatchObject({
      title: 'Typed raw value',
      amount: 7,
      enabled: false,
      nullable: null,
    });
    expect(Object.prototype.hasOwnProperty.call(result.mergedData, 'optional')).toBe(false);
  });

  it('keeps controlled sources and edits independent and completes only after the exact pair echo', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { title: 'before', amount: 1 } },
      { id: 'review', label: 'Review', data: { title: 'after', amount: 2 } },
    ];
    const onChange = vi.fn();
    const onEditsChange = vi.fn();
    const onComplete = vi.fn();
    const emptyResolutions: MergeResolutions = {};
    const emptyEdits: MergeEdits = {};
    const propsFor = (value: MergeResolutions, edits: MergeEdits, finalLabel = 'Final') =>
      ({
        versions,
        merge: {
          enabled: true,
          value,
          edits,
          finalLabel,
          onChange,
          onEditsChange,
          onComplete,
        },
      }) satisfies React.ComponentProps<typeof RecursiveComparisonTable>;
    const { rerender } = render(
      <RecursiveComparisonTable {...propsFor(emptyResolutions, emptyEdits)} />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /^Edit title$/i }), {
      target: { value: 'Committed title' },
    });
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    const editProposal: MergeEdits = onEditsChange.mock.calls[0]?.[0];
    expect(screen.getAllByText('Unresolved')).toHaveLength(2);
    expect(onComplete).not.toHaveBeenCalled();

    rerender(<RecursiveComparisonTable {...propsFor(emptyResolutions, editProposal)} />);
    expect(screen.getAllByText('Committed title')).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /^amount Review$/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onEditsChange).toHaveBeenCalledTimes(1);
    const sourceProposal: MergeResolutions = onChange.mock.calls[0]?.[0];
    expect(onComplete).not.toHaveBeenCalled();

    rerender(
      <RecursiveComparisonTable {...propsFor(emptyResolutions, editProposal, 'Approved result')} />,
    );
    expect(onComplete).not.toHaveBeenCalled();
    rerender(
      <RecursiveComparisonTable {...propsFor(sourceProposal, editProposal, 'Approved result')} />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
    rerender(
      <RecursiveComparisonTable
        {...propsFor({ ...sourceProposal }, { ...editProposal }, 'Approved result')}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps invalid numeric drafts local, accessible, and absent from edit callbacks', () => {
    const onEditsChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { amount: 1 } },
          { id: 'review', label: 'Review', data: { amount: 2 } },
        ]}
        merge={{ enabled: true, onEditsChange }}
      />,
    );

    const amount = screen.getByRole('spinbutton', { name: /^Edit amount$/i });
    fireEvent.change(amount, { target: { value: 'not-a-number' } });
    fireEvent.blur(amount);

    expect(onEditsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/amount.*finite number/i);
    expect(amount).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits raw values while source and Final display continue through renderer priority', () => {
    const onEditsChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { title: 'before' } },
          { id: 'review', label: 'Review', data: { title: 'after' } },
        ]}
        propertyDefinitions={[
          {
            key: 'title',
            label: 'Title',
            path: ['title'],
            level: 0,
            type: 'string',
            renderValue: (value) => `rendered:${String(value)}`,
          },
        ]}
        merge={{
          enabled: true,
          defaultEdits: { [rowId('title')]: { kind: 'set', value: 'raw edit' } },
          onEditsChange,
        }}
      />,
    );

    expect(screen.getByText('rendered:before')).toBeInTheDocument();
    expect(screen.getByText('rendered:after')).toBeInTheDocument();
    expect(screen.getByText('rendered:raw edit')).toBeInTheDocument();
    const editor = screen.getByRole('textbox', { name: /^Edit title$/i });
    expect(editor).toHaveValue('raw edit');
    expect(editor).not.toHaveValue('rendered:raw edit');

    fireEvent.change(editor, { target: { value: 'next raw' } });
    expect(onEditsChange.mock.calls[0]?.[0]).toEqual({
      [rowId('title')]: { kind: 'set', value: 'next raw' },
    });
    expect(onEditsChange.mock.calls[0]?.[1]).toMatchObject({
      mergedData: { title: 'next raw' },
    });
  });
});

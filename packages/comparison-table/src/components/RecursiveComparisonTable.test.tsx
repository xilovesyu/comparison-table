import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

describe('RecursiveComparisonTable', () => {
  const versions = [
    { id: 'before', label: 'Before', data: { user: { name: 'John' }, enabled: true } },
    { id: 'after', label: 'After', data: { user: { name: 'Jack' }, enabled: false } },
  ];
  it('renders dynamic version columns and builtin values', () => {
    render(<RecursiveComparisonTable versions={versions} />);
    expect(screen.getByRole('columnheader', { name: 'Before' })).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });
  it('searches values and keeps the matching parent visible', () => {
    render(<RecursiveComparisonTable versions={versions} />);
    fireEvent.change(screen.getByLabelText('Search comparison'), { target: { value: 'Jack' } });
    expect(screen.getByText('user')).toBeInTheDocument();
  });
  it('uses a renderer selected by a path rule', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v1', label: 'V1', data: { money: { amount: 100, currency: 'USD' } } }]}
        rules={[{ path: 'money', renderer: 'money' }]}
      />,
    );
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });
  it('uses an object renderer only for the current table instance', () => {
    const versions = [
      { id: 'v1', label: 'Custom', data: { state: 'ACTIVE' } },
      { id: 'v2', label: 'Builtin', data: { state: 'ACTIVE' } },
    ];
    render(
      <>
        <RecursiveComparisonTable
          versions={[versions[0]]}
          renderers={{ badge: (value) => `Badge: ${value}` }}
          rules={[{ path: 'state', renderer: 'badge' }]}
        />
        <RecursiveComparisonTable
          versions={[versions[1]]}
          rules={[{ path: 'state', renderer: 'badge' }]}
        />
      </>,
    );
    expect(screen.getByText('Badge: ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });
  it('overrides a builtin renderer only for the configured table instance', () => {
    const money = { amount: 100, currency: 'USD' };
    render(
      <>
        <RecursiveComparisonTable
          versions={[{ id: 'custom', label: 'Custom', data: { money } }]}
          renderers={{ money: () => 'Custom money' }}
          rules={[{ path: 'money', renderer: 'money' }]}
        />
        <RecursiveComparisonTable
          versions={[{ id: 'builtin', label: 'Builtin', data: { money } }]}
          rules={[{ path: 'money', renderer: 'money' }]}
        />
      </>,
    );
    expect(screen.getByText('Custom money')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });
  it('filters equal rows while retaining the ancestor of a difference', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'before',
            label: 'Before',
            data: { profile: { name: 'Ava', age: 20 }, stable: 'same' },
          },
          {
            id: 'after',
            label: 'After',
            data: { profile: { name: 'Mia', age: 20 }, stable: 'same' },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('switch', { name: 'Only show differences' }));
    expect(screen.getByText('profile')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('age')).not.toBeInTheDocument();
    expect(screen.queryByText('stable')).not.toBeInTheDocument();
  });
  it('shows a Diff block with a descendant count and allows a custom indicator', () => {
    const versions = [
      { id: 'before', label: 'Before', data: { user: { name: 'Ava', age: 20 } } },
      { id: 'after', label: 'After', data: { user: { name: 'Mia', age: 21 } } },
    ];
    const { rerender } = render(<RecursiveComparisonTable versions={versions} />);

    expect(screen.getAllByText('Diff')).toHaveLength(3);
    expect(screen.getByText('2')).toBeInTheDocument();

    rerender(
      <RecursiveComparisonTable
        versions={versions}
        comparison={{ differenceIndicator: (info) => `Changed ${info.descendantDifferenceCount}` }}
      />,
    );
    expect(screen.getByText('Changed 2')).toBeInTheDocument();
  });
  it('highlights only a configured baseline column and allows class overrides', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { name: 'Ava' } },
      { id: 'next', label: 'Next', data: { name: 'Mia' } },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable
        versions={versions}
        comparison={{
          baseVersionId: 'base',
          baselineHeaderClassName: 'custom-baseline-header',
          baselineCellClassName: 'custom-baseline-cell',
        }}
      />,
    );

    expect(document.querySelector('.custom-baseline-header')).toBeInTheDocument();
    expect(screen.getByLabelText('Base')).toHaveTextContent('Base');
    expect(document.querySelectorAll('.custom-baseline-cell')).toHaveLength(2);

    rerender(<RecursiveComparisonTable versions={versions} />);
    expect(screen.queryByLabelText('Base')).not.toBeInTheDocument();
    expect(document.querySelector('.comparison-baseline-header')).not.toBeInTheDocument();
    expect(document.querySelector('.comparison-baseline-cell')).not.toBeInTheDocument();
  });
  it('inherits display controls while allowing a child to re-enable Diff and node search', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: { profile: { contact: { city: 'Beijing' }, name: 'Ava' } },
      },
      {
        id: 'next',
        label: 'Next',
        data: { profile: { contact: { city: 'Shanghai' }, name: 'Mia' } },
      },
    ];

    render(
      <RecursiveComparisonTable
        versions={versions}
        comparison={{ baseVersionId: 'base', showBaselineBadge: false }}
        rules={[
          { path: 'profile', differenceIndicator: false, nodeSearchable: false },
          { path: 'profile.contact', differenceIndicator: true, nodeSearchable: true },
        ]}
      />,
    );

    const profileCell = screen
      .getByText('profile')
      .closest('.comparison-property-cell') as HTMLElement;
    expect(within(profileCell).queryByLabelText('Diff')).not.toBeInTheDocument();
    expect(
      within(profileCell).queryByRole('button', { name: 'Search within profile' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Diff')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Search within contact' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Base')).not.toBeInTheDocument();
  });
  it('filters only one expandable node from its local search input', () => {
    render(<RecursiveComparisonTable versions={versions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search within user' }));
    fireEvent.change(screen.getByLabelText('Filter user children'), { target: { value: 'Jack' } });
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('enabled')).toBeInTheDocument();
  });

  it('keeps keyed rows usable with renderers, baseline, difference-only and global/local search', () => {
    const versions = [
      {
        id: 'base',
        label: 'Base',
        data: {
          lines: [
            { sku: 'A', quantity: 1 },
            { sku: 'B', quantity: 1 },
          ],
        },
      },
      {
        id: 'next',
        label: 'Next',
        data: {
          lines: [
            { sku: 'B', quantity: 1 },
            { sku: 'A', quantity: 2 },
          ],
        },
      },
    ];
    render(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        comparison={{ baseVersionId: 'base' }}
        rules={[{ path: 'lines.*.quantity', renderer: 'number' }]}
      />,
    );
    expect(screen.getByLabelText('Base')).toBeInTheDocument();
    expect(screen.getByText('lines[A]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Only show differences' }));
    expect(screen.getByText('lines[A]')).toBeInTheDocument();
    expect(screen.queryByText('lines[B]')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search comparison'), { target: { value: '2' } });
    expect(screen.getByText('lines[A]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Search within lines[A]' }));
    fireEvent.change(screen.getByLabelText('Filter lines[A] children'), {
      target: { value: 'quantity' },
    });
    expect(screen.getByText('quantity')).toBeInTheDocument();
  });

  it('honors controlled expansion with stable keyed ids after version reorder', () => {
    const onExpandedChange = vi.fn();
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { lines: [{ sku: 'A', quantity: 1 }] } },
          { id: 'next', label: 'Next', data: { lines: [{ sku: 'A', quantity: 2 }] } },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        expandedKeys={['["lines"]', '["lines","A"]']}
        onExpandedChange={onExpandedChange}
      />,
    );
    expect(screen.getByText('quantity')).toBeInTheDocument();
    fireEvent.click(document.querySelector('.ant-table-row-expand-icon') as HTMLElement);
    expect(onExpandedChange).toHaveBeenCalled();
  });
});

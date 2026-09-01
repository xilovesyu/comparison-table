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

  it('resolves an empty-string renderer from definitions and rules in a local registry', () => {
    const renderers = { '': () => 'empty-key renderer' };
    const versions = [{ id: 'v', label: 'V', data: { defined: 1, ruled: 2 } }];
    render(
      <RecursiveComparisonTable
        versions={versions}
        renderers={renderers}
        propertyDefinitions={[
          {
            key: 'defined',
            label: 'Defined',
            path: ['defined'],
            level: 0,
            type: 'number',
            renderer: '',
          },
          { key: 'ruled', label: 'Ruled', path: ['ruled'], level: 0, type: 'number' },
        ]}
        rules={[{ path: 'ruled', renderer: '' }]}
      />,
    );
    expect(screen.getAllByText('empty-key renderer')).toHaveLength(2);
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

  it('uses a container summary formatter for collapsed keyed Added and Removed object and array cells', () => {
    const summary = (
      value: unknown,
      context: { version: { id: string }; property: { path: readonly unknown[] } },
    ) =>
      `summary:${context.version.id}:${context.property.path.join('.')}:${Array.isArray(value) ? 'array' : 'object'}`;
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { lines: [{ sku: 'old', tags: ['a'] }] } },
          { id: 'next', label: 'Next', data: { lines: [{ sku: 'new', tags: ['b', 'c'] }] } },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
        containerSummary={summary}
      />,
    );
    expect(screen.getByText('summary:base:lines:array')).toBeInTheDocument();
    expect(screen.getByText('summary:next:lines:array')).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('resolves container summary formatter definition, rule, then table and keeps renderer overrides higher', () => {
    const table = () => 'table summary';
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'v1', label: 'V1', data: { defined: { a: 1 }, ruled: { b: 2 }, local: { c: 3 } } },
        ]}
        rules={[
          {
            path: 'ruled',
            expand: false,
            containerSummary: () => 'rule summary',
          },
        ]}
        propertyDefinitions={[
          {
            key: 'defined',
            label: 'Defined',
            path: ['defined'],
            level: 0,
            type: 'object',
            containerSummary: () => 'definition summary',
          },
          { key: 'ruled', label: 'Ruled', path: ['ruled'], level: 0, type: 'object' },
          {
            key: 'local',
            label: 'Local',
            path: ['local'],
            level: 0,
            type: 'object',
            renderer: 'local',
          },
        ]}
        renderers={{ local: () => 'named renderer' }}
        containerSummary={table}
      />,
    );
    expect(screen.getByText('definition summary')).toBeInTheDocument();
    expect(screen.getByText('rule summary')).toBeInTheDocument();
    expect(screen.getByText('named renderer')).toBeInTheDocument();
    expect(screen.queryByText('table summary')).not.toBeInTheDocument();
  });

  it('uses each cell runtime type for summaries, falls back only on undefined, and never searches summary ReactNodes', () => {
    const summary = (value: unknown) =>
      value === undefined ? undefined : value === null ? null : value === false ? (
        false
      ) : (
        <b>SECRET-SUMMARY</b>
      );
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'a',
            label: 'A',
            data: { value: { nested: 1 }, absent: undefined, nullable: null, falsey: false },
          },
          {
            id: 'b',
            label: 'B',
            data: { value: ['x'], absent: undefined, nullable: null, falsey: false },
          },
        ]}
        rules={[{ path: '*', expand: false }]}
        containerSummary={summary}
      />,
    );
    expect(screen.getAllByText('SECRET-SUMMARY')).toHaveLength(2);
    expect(screen.getAllByText('—')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText('Search comparison'), {
      target: { value: 'SECRET-SUMMARY' },
    });
    expect(screen.queryByText('value')).not.toBeInTheDocument();
  });

  it('falls back when an explicit renderValue returns null but renders false explicitly', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v1', label: 'V1', data: { nullable: { a: 1 }, falsey: { b: 2 } } }]}
        rules={[{ path: '*', expand: false }]}
        propertyDefinitions={[
          {
            key: 'nullable',
            label: 'Nullable',
            path: ['nullable'],
            level: 0,
            type: 'object',
            renderValue: () => null,
          },
          {
            key: 'falsey',
            label: 'Falsey',
            path: ['falsey'],
            level: 0,
            type: 'object',
            renderValue: () => false,
          },
        ]}
      />,
    );
    expect(screen.getByText('{ 1 fields }')).toBeInTheDocument();
    expect(screen.queryByText('false')).not.toBeInTheDocument();
  });

  it('keeps a container summary ahead of a table-local text fallback', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v1', label: 'V1', data: { payload: { id: 1 } } }]}
        rules={[{ path: 'payload', expand: false }]}
        renderers={{ text: () => 'local text' }}
        containerSummary={() => 'summary'}
      />,
    );
    expect(screen.getByText('summary')).toBeInTheDocument();
    expect(screen.queryByText('local text')).not.toBeInTheDocument();
  });

  it('does not let a local text renderer hijack typed values while matching local renderers win', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'v1',
            label: 'V1',
            data: {
              text: 'plain',
              number: 1200,
              boolean: true,
              date: new Date('2026-01-02T00:00:00Z'),
              object: { id: 1 },
              array: ['a'],
              money: { amount: 2, currency: 'USD' },
            },
          },
        ]}
        renderers={{ text: () => 'local text', money: () => 'local money' }}
      />,
    );
    expect(screen.getAllByText('local text')).toHaveLength(3);
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('{ 1 fields }')).toBeInTheDocument();
    expect(screen.getByText('[ 1 items ]')).toBeInTheDocument();
    expect(screen.queryByText('local money')).not.toBeInTheDocument();
  });

  it('uses safe built-in summaries for keyed Added containers without a formatter', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { lines: [] } },
          {
            id: 'next',
            label: 'Next',
            data: {
              lines: [
                { sku: 'object', payload: { id: 1 } },
                { sku: 'array', payload: ['a', 'b'] },
              ],
            },
          },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines.*.payload', expand: false }]}
      />,
    );
    expect(screen.getByText('{ 1 fields }')).toBeInTheDocument();
    expect(screen.getAllByText('[ 2 items ]')).toHaveLength(2);
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('summarizes a collapsed keyed-array parent per runtime array cell without a formatter or after undefined', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
      { id: 'next', label: 'Next', data: { lines: [{ sku: 'A' }, { sku: 'B' }] } },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
      />,
    );
    expect(screen.getByText('[ 1 items ]')).toBeInTheDocument();
    expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
        containerSummary={() => undefined}
      />,
    );
    expect(screen.getByText('[ 1 items ]')).toBeInTheDocument();
    expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
  });

  it('keeps default-expanded keyed parents summarized per cell without a formatter or after undefined', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
      { id: 'next', label: 'Next', data: { lines: [{ sku: 'A' }, { sku: 'B' }] } },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable versions={versions} arrayItemKeyFields={{ lines: 'sku' }} />,
    );
    expect(screen.getByText('[ 1 items ]')).toBeInTheDocument();
    expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        containerSummary={() => undefined}
      />,
    );
    expect(screen.getByText('[ 1 items ]')).toBeInTheDocument();
    expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
  });

  it('keeps keyed parent array summaries when expanded items contain nested objects and arrays', () => {
    const versions = [
      { id: 'a', label: 'A', data: { lines: [{ sku: 'A', payload: { id: 1 }, tags: ['x'] }] } },
      {
        id: 'b',
        label: 'B',
        data: { lines: [{ sku: 'A', payload: { id: 2 }, tags: ['x', 'y'] }] },
      },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable versions={versions} arrayItemKeyFields={{ lines: 'sku' }} />,
    );
    expect(screen.getAllByText('[ 1 items ]')).not.toHaveLength(0);
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        containerSummary={() => undefined}
      />,
    );
    expect(screen.getAllByText('[ 1 items ]')).not.toHaveLength(0);
  });

  it('renders each keyed lines parent version cell through summary fallback semantics', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
      { id: 'next', label: 'Next', data: { lines: [{ sku: 'A' }, { sku: 'B' }] } },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
      />,
    );
    const linesRow = screen.getByText('lines').closest('tr')!;
    expect(within(linesRow).getByText('[ 1 items ]')).toBeInTheDocument();
    expect(within(linesRow).getByText('[ 2 items ]')).toBeInTheDocument();
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
        containerSummary={() => undefined}
      />,
    );
    expect(
      within(screen.getByText('lines').closest('tr')!).getByText('[ 1 items ]'),
    ).toBeInTheDocument();
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        arrayItemKeyFields={{ lines: 'sku' }}
        rules={[{ path: 'lines', expand: false }]}
        containerSummary={() => <b>node</b>}
      />,
    );
    expect(within(screen.getByText('lines').closest('tr')!).getAllByText('node')).toHaveLength(2);
  });

  it('uses matching local object and array renderers for expanded containers before table summaries', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v', label: 'V', data: { object: { id: 1 }, array: ['x'] } }]}
        renderers={{ object: () => 'local object', array: () => 'local array' }}
        containerSummary={() => 'summary'}
      />,
    );
    expect(screen.getByText('local object')).toBeInTheDocument();
    expect(screen.getByText('local array')).toBeInTheDocument();
    expect(screen.queryByText('summary')).not.toBeInTheDocument();
  });

  it('uses local text for automatically discovered nested string leaves', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v', label: 'V', data: { outer: { note: 'plain' } } }]}
        renderers={{ text: () => 'local text' }}
      />,
    );
    expect(screen.getByText('local text')).toBeInTheDocument();
  });

  it('routes table summaries and local text only to real text fallback while explicit renderers win', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          {
            id: 'v',
            label: 'V',
            data: {
              nested: { text: 'plain' },
              number: 3,
              boolean: true,
              date: new Date('2026-01-01'),
              explicit: { id: 1 },
              typed: { id: 2 },
            },
          },
        ]}
        renderers={{ text: () => 'local text', object: () => 'local object', named: () => 'named' }}
        rules={[{ path: 'explicit', renderer: 'named' }]}
        propertyDefinitions={[
          {
            key: 'nested',
            label: 'Nested',
            path: ['nested'],
            level: 0,
            type: 'object',
            children: [{ key: 'text', label: 'Text', path: ['text'], level: 1, type: 'string' }],
          },
          { key: 'number', label: 'Number', path: ['number'], level: 0, type: 'number' },
          { key: 'boolean', label: 'Boolean', path: ['boolean'], level: 0, type: 'boolean' },
          { key: 'date', label: 'Date', path: ['date'], level: 0, type: 'date' },
          { key: 'explicit', label: 'Explicit', path: ['explicit'], level: 0, type: 'object' },
          { key: 'typed', label: 'Typed', path: ['typed'], level: 0, type: 'object' },
        ]}
        containerSummary={() => 'summary'}
      />,
    );
    expect(screen.getByText('local text')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('named')).toBeInTheDocument();
    expect(screen.getAllByText('local object')).toHaveLength(2);
  });

  it('keeps renderer legacy routing for summary null false and isolated registries', () => {
    const versions = [
      { id: 'v', label: 'V', data: { text: 'plain', object: { id: 1 }, explicit: { id: 2 } } },
    ];
    const { rerender } = render(
      <RecursiveComparisonTable
        versions={versions}
        renderers={{ text: () => 'local text', object: () => 'local object', named: () => 'named' }}
        rules={[{ path: 'explicit', renderer: 'named' }]}
        containerSummary={() => null}
      />,
    );
    expect(screen.getByText('local text')).toBeInTheDocument();
    expect(screen.getByText('local object')).toBeInTheDocument();
    expect(screen.getByText('named')).toBeInTheDocument();
    rerender(
      <RecursiveComparisonTable
        versions={versions}
        renderers={{ text: () => 'other text' }}
        containerSummary={() => false}
      />,
    );
    expect(screen.getByText('other text')).toBeInTheDocument();
    expect(screen.queryByText('local object')).not.toBeInTheDocument();
  });

  it('falls back to safe object and array summaries when a formatter returns undefined', () => {
    render(
      <RecursiveComparisonTable
        versions={[{ id: 'v1', label: 'V1', data: { object: { id: 1 }, array: ['a', 'b'] } }]}
        rules={[{ path: '*', expand: false }]}
        containerSummary={() => undefined}
      />,
    );
    expect(screen.getByText('{ 1 fields }')).toBeInTheDocument();
    expect(screen.getByText('[ 2 items ]')).toBeInTheDocument();
  });

  it('P1: does not collapse an item that returns after an intermediate absence into Removed', () => {
    render(
      <RecursiveComparisonTable
        versions={[
          { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
          { id: 'mid', label: 'Mid', data: { lines: [] } },
          { id: 'last', label: 'Last', data: { lines: [{ sku: 'A' }] } },
        ]}
        arrayItemKeyFields={{ lines: 'sku' }}
        comparison={{ baseVersionId: 'base' }}
      />,
    );

    expect(screen.getByText('lines[A]')).toBeInTheDocument();
    expect(screen.queryByText('Removed')).not.toBeInTheDocument();
  });
});

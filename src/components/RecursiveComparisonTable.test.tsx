import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

describe('RecursiveComparisonTable', () => {
  const versions = [{ id: 'before', label: 'Before', data: { user: { name: 'John' }, enabled: true } }, { id: 'after', label: 'After', data: { user: { name: 'Jack' }, enabled: false } }];
  it('renders dynamic version columns and builtin values', () => { render(<RecursiveComparisonTable versions={versions} />); expect(screen.getByRole('columnheader', { name: 'Before' })).toBeInTheDocument(); expect(screen.getByText('Yes')).toBeInTheDocument(); expect(screen.getByText('No')).toBeInTheDocument(); });
  it('searches values and keeps the matching parent visible', () => { render(<RecursiveComparisonTable versions={versions} />); fireEvent.change(screen.getByLabelText('Search comparison'), { target: { value: 'Jack' } }); expect(screen.getByText('user')).toBeInTheDocument(); });
  it('uses a renderer selected by a path rule', () => {
    render(<RecursiveComparisonTable versions={[{ id: 'v1', label: 'V1', data: { money: { amount: 100, currency: 'USD' } } }]} rules={[{ path: 'money', renderer: 'money' }]} />);
    expect(screen.getByText('$100.00')).toBeInTheDocument();
  });
  it('filters only one expandable node from its local search input', () => {
    render(<RecursiveComparisonTable versions={versions} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search within user' }));
    fireEvent.change(screen.getByLabelText('Filter user children'), { target: { value: 'Jack' } });
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('enabled')).toBeInTheDocument();
  });
});

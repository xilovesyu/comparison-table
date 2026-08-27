import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecursiveComparisonTable } from './RecursiveComparisonTable';

describe('RecursiveComparisonTable', () => {
  const versions = [{ id: 'before', label: 'Before', data: { user: { name: 'John' }, enabled: true } }, { id: 'after', label: 'After', data: { user: { name: 'Jack' }, enabled: false } }];
  it('renders dynamic version columns and builtin values', () => { render(<RecursiveComparisonTable versions={versions} />); expect(screen.getByRole('columnheader', { name: 'Before' })).toBeInTheDocument(); expect(screen.getByText('Yes')).toBeInTheDocument(); expect(screen.getByText('No')).toBeInTheDocument(); });
  it('searches values and keeps the matching parent visible', () => { render(<RecursiveComparisonTable versions={versions} />); fireEvent.change(screen.getByLabelText('Search comparison'), { target: { value: 'Jack' } }); expect(screen.getByText('user')).toBeInTheDocument(); });
});

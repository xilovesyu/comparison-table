import { describe, expect, it } from 'vitest';
import { buildComparisonRows, filterComparisonRows } from './comparison';

describe('buildComparisonRows', () => {
  it('creates a property row with one value per version', () => {
    const rows = buildComparisonRows([
      { id: 'before', label: 'Before', data: { name: 'John' } },
      { id: 'after', label: 'After', data: { name: 'Jack' } },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: '["name"]',
      property: { key: 'name', label: 'name', path: ['name'], level: 0, type: 'string' },
      values: { before: 'John', after: 'Jack' },
    });
  });

  it('recursively discovers nested keys and preserves missing values', () => {
    const rows = buildComparisonRows([{ id: 'v1', label: 'V1', data: { user: { name: 'John' } } }, { id: 'v2', label: 'V2', data: { user: { age: 21 } } }]);
    expect(rows[0].children).toMatchObject([{ property: { key: 'name' }, values: { v1: 'John', v2: undefined } }, { property: { key: 'age' }, values: { v1: undefined, v2: 21 } }]);
  });

  it('filters a matching descendant while retaining its ancestor', () => {
    const rows = buildComparisonRows([{ id: 'v1', label: 'V1', data: { money: { currency: 'USD', amount: 100 } } }]);
    expect(filterComparisonRows(rows, 'usd')).toMatchObject([{ property: { key: 'money' }, children: [{ property: { key: 'currency' } }] }]);
  });

  it('carries a path-level renderer to the presentation property', () => {
    const rows = buildComparisonRows([{ id: 'v1', label: 'V1', data: { money: { amount: 100, currency: 'USD' } } }], { rules: [{ path: 'money', renderer: 'money' }] });
    expect(rows[0].property.renderer).toBe('money');
  });

  it('uses the parent path to label array index properties', () => {
    const rows = buildComparisonRows([{ id: 'v1', label: 'V1', data: { lines: [{ sku: 'A-1' }, { sku: 'B-2' }] } }]);
    expect(rows[0].children?.map((row) => row.property.label)).toEqual(['lines[0]', 'lines[1]']);
  });
});

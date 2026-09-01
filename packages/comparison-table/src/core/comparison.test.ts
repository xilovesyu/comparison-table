import { describe, expect, it } from 'vitest';
import { buildComparisonRows, filterComparisonRows, filterDifferenceRows } from './comparison';
import type { PropertyContext, PropertyDefinition } from './types';

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
    const rows = buildComparisonRows([
      { id: 'v1', label: 'V1', data: { user: { name: 'John' } } },
      { id: 'v2', label: 'V2', data: { user: { age: 21 } } },
    ]);
    expect(rows[0].children).toMatchObject([
      { property: { key: 'name' }, values: { v1: 'John', v2: undefined } },
      { property: { key: 'age' }, values: { v1: undefined, v2: 21 } },
    ]);
  });

  it('filters a matching descendant while retaining its ancestor', () => {
    const rows = buildComparisonRows([
      { id: 'v1', label: 'V1', data: { money: { currency: 'USD', amount: 100 } } },
    ]);
    expect(filterComparisonRows(rows, 'usd')).toMatchObject([
      { property: { key: 'money' }, children: [{ property: { key: 'currency' } }] },
    ]);
  });

  it('carries a path-level renderer to the presentation property', () => {
    const rows = buildComparisonRows(
      [{ id: 'v1', label: 'V1', data: { money: { amount: 100, currency: 'USD' } } }],
      { rules: [{ path: 'money', renderer: 'money' }] },
    );
    expect(rows[0].property.renderer).toBe('money');
  });

  it('uses the parent path to label array index properties', () => {
    const rows = buildComparisonRows([
      { id: 'v1', label: 'V1', data: { lines: [{ sku: 'A-1' }, { sku: 'B-2' }] } },
    ]);
    expect(rows[0].children?.map((row) => row.property.label)).toEqual(['lines[0]', 'lines[1]']);
  });

  it('marks deep differences and retains their parent while filtering equal rows', () => {
    const rows = buildComparisonRows([
      { id: 'before', label: 'Before', data: { user: { name: 'Ava', age: 20 }, stable: 'same' } },
      { id: 'after', label: 'After', data: { user: { name: 'Mia', age: 20 }, stable: 'same' } },
    ]);

    const differences = filterDifferenceRows(rows);
    expect(differences.map((row) => row.property.key)).toEqual(['user']);
    expect(differences[0].children?.map((row) => row.property.key)).toEqual(['name']);
    expect(differences[0].hasDifference).toBe(true);
  });

  it('supports a base version and a custom difference comparator', () => {
    const versions = [
      { id: 'base', label: 'Base', data: { amount: 100 } },
      { id: 'near', label: 'Near', data: { amount: 103 } },
      { id: 'changed', label: 'Changed', data: { amount: 140 } },
    ];
    const rows = buildComparisonRows(versions, {
      comparison: {
        baseVersionId: 'base',
        comparator: (values) =>
          Math.max(...(values as number[])) - Math.min(...(values as number[])) > 5,
      },
    });

    expect(rows[0].hasDifference).toBe(true);
    expect(
      buildComparisonRows(versions.slice(0, 2), {
        comparison: {
          baseVersionId: 'base',
          comparator: (values) =>
            Math.max(...(values as number[])) - Math.min(...(values as number[])) > 5,
        },
      })[0].hasDifference,
    ).toBe(false);
  });

  it('keeps container summary functions out of the public row and property shape', () => {
    const rows = buildComparisonRows([{ id: 'v1', label: 'V1', data: { payload: { id: 1 } } }], {
      propertyDefinitions: [
        {
          key: 'payload',
          label: 'Payload',
          path: ['payload'],
          level: 0,
          type: 'object',
          containerSummary: () => 'summary',
        },
      ],
    });
    expect(Object.keys(rows[0]).sort()).toEqual([
      'hasDifference',
      'hasOwnDifference',
      'property',
      'values',
    ]);
    expect(Object.keys(rows[0].property).sort()).toEqual(['key', 'label', 'level', 'path', 'type']);
  });

  it('preserves the baseline enumerable row shape and keeps presentation helpers private', async () => {
    const rows = buildComparisonRows(
      [
        { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
        { id: 'next', label: 'Next', data: { lines: [{ sku: 'A' }, { sku: 'B' }] } },
      ],
      { arrayItemKeyFields: { lines: 'sku' } },
    );
    expect(Object.keys(rows[0]).sort()).toEqual([
      'children',
      'differenceIndicator',
      'id',
      'itemIdentity',
      'nodeSearchable',
      'presence',
      'property',
      'values',
    ]);
    const item = rows[0].children?.[0]!;
    expect(Object.keys({ ...item }).sort()).toEqual([
      'children',
      'differenceIndicator',
      'id',
      'itemIdentity',
      'nodeSearchable',
      'presence',
      'property',
      'values',
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/containerSummary|function/);
    const publicApi = await import('../index');
    expect('buildComparisonPresentation' in publicApi).toBe(false);
    expect('copyComparisonRow' in publicApi).toBe(false);
  });

  it('keeps summary configurations out of enumerable difference rows', () => {
    const rows = buildComparisonRows([{ id: 'a', label: 'A', data: { value: { id: 1 } } }, { id: 'b', label: 'B', data: { value: { id: 2 } } }], { rules: [{ path: 'value', containerSummary: () => 'summary' }], comparison: { comparator: () => true } });
    expect(Object.keys(rows[0])).toContain('id');
    expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['hasDifference', 'hasOwnDifference', 'descendantDifferenceCount']));
    expect(JSON.stringify(rows[0])).not.toMatch(/containerSummary|summary/);
  });

  it('preserves explicit property-definition type and level for rows and comparator contexts', () => {
    const contexts: PropertyContext[] = [];
    const rows = buildComparisonRows(
      [{ id: 'v1', label: 'V1', data: { effectiveDate: '2026-09-01' } }],
      {
        propertyDefinitions: [
          {
            key: 'effectiveDate',
            label: 'Effective date',
            path: ['effectiveDate'],
            level: 7,
            type: 'date',
            renderer: 'date',
          },
        ],
        comparison: {
          comparator: (_values, context) => {
            contexts.push(context);
            return false;
          },
        },
      },
    );

    expect(rows[0].property).toMatchObject({ type: 'date', level: 7, renderer: 'date' });
    expect(contexts).toContainEqual(
      expect.objectContaining({
        path: ['effectiveDate'],
        type: 'date',
        level: 7,
      }),
    );
  });

  it('matches DisplayRule.type against the detected runtime type, not the definition display type', () => {
    const definitions: PropertyDefinition[] = [
      {
        key: 'effectiveDate',
        label: 'Effective date',
        path: ['effectiveDate'],
        level: 4,
        type: 'date',
      },
    ];
    const versions = [{ id: 'v1', label: 'V1', data: { effectiveDate: '2026-09-01' } }];

    expect(
      buildComparisonRows(versions, {
        propertyDefinitions: definitions,
        rules: [{ type: 'string', label: 'Detected string' }],
      })[0].property,
    ).toMatchObject({ label: 'Detected string', type: 'date', level: 4 });

    expect(
      buildComparisonRows(versions, {
        propertyDefinitions: definitions,
        rules: [{ type: 'date', label: 'Incorrect display-type match' }],
      })[0].property,
    ).toMatchObject({ label: 'Effective date', type: 'date', level: 4 });
  });

  it('keeps DisplayRule matcher predicates on runtime type when definitions use the opposite display type', () => {
    const cases = [
      {
        value: '2026-09-01',
        displayType: 'date' as const,
        runtimeType: 'string' as const,
      },
      {
        value: new Date('2026-09-01T00:00:00.000Z'),
        displayType: 'string' as const,
        runtimeType: 'date' as const,
      },
    ];

    for (const { value, displayType, runtimeType } of cases) {
      const propertyDefinitions: PropertyDefinition[] = [
        {
          key: 'value',
          label: 'Value',
          path: ['value'],
          level: 3,
          type: displayType,
        },
      ];
      const versions = [{ id: 'v1', label: 'V1', data: { value } }];

      expect(
        buildComparisonRows(versions, {
          propertyDefinitions,
          rules: [{ matcher: (context) => context.type === runtimeType, label: 'Runtime match' }],
        })[0].property,
      ).toMatchObject({ label: 'Runtime match', type: displayType, level: 3 });
    }
  });

  it('keeps selection predicates on runtime type when definitions use the opposite display type', () => {
    const cases = [
      {
        value: '2026-09-01',
        displayType: 'date' as const,
        runtimeType: 'string' as const,
      },
      {
        value: new Date('2026-09-01T00:00:00.000Z'),
        displayType: 'string' as const,
        runtimeType: 'date' as const,
      },
    ];

    for (const { value, displayType, runtimeType } of cases) {
      const propertyDefinitions: PropertyDefinition[] = [
        {
          key: 'value',
          label: 'Value',
          path: ['value'],
          level: 3,
          type: displayType,
        },
      ];
      const versions = [{ id: 'v1', label: 'V1', data: { value } }];

      expect(
        buildComparisonRows(versions, {
          propertyDefinitions,
          selection: { include: [(context) => context.type === runtimeType] },
        }),
      ).toHaveLength(1);
    }
  });

  describe('keyed array alignment', () => {
    const twoVersions = [
      {
        id: 'base',
        label: 'Base',
        data: {
          lines: [
            { sku: 'P-100', quantity: 1 },
            { sku: 'P-200', quantity: 2 },
          ],
        },
      },
      {
        id: 'review',
        label: 'Review',
        data: {
          lines: [
            { sku: 'P-200', quantity: 2 },
            { sku: 'P-100', quantity: 1 },
          ],
        },
      },
    ];

    it('preserves legacy index paths, labels, and differences when no key field is configured', () => {
      const rows = buildComparisonRows(twoVersions);
      expect(
        rows[0].children?.map(({ id, property, hasDifference }) => [
          id,
          property.label,
          hasDifference,
        ]),
      ).toEqual([
        ['["lines",0]', 'lines[0]', true],
        ['["lines",1]', 'lines[1]', true],
      ]);
    });

    it('treats two- and three-version reorder-only keyed arrays as equal, including collapsed arrays', () => {
      const threeVersions = [
        ...twoVersions,
        {
          id: 'final',
          label: 'Final',
          data: {
            lines: [
              { sku: 'P-100', quantity: 1 },
              { sku: 'P-200', quantity: 2 },
            ],
          },
        },
      ];
      for (const versions of [twoVersions, threeVersions]) {
        const rows = buildComparisonRows(versions, { arrayItemKeyFields: { lines: 'sku' } });
        expect(rows[0]).toMatchObject({ hasDifference: false });
        expect(
          rows[0].children?.map((row) => [row.id, row.property.label, row.hasDifference]),
        ).toEqual([
          ['["lines","P-100"]', 'lines[P-100]', false],
          ['["lines","P-200"]', 'lines[P-200]', false],
        ]);
      }
      expect(
        buildComparisonRows(twoVersions, {
          arrayItemKeyFields: { lines: 'sku' },
          rules: [{ path: 'lines', expand: false }],
        })[0],
      ).toMatchObject({ children: undefined, hasDifference: false });
    });

    it('retains stable keyed row ids and detects a changed child under the same business key', () => {
      const changed = [
        twoVersions[0],
        {
          id: 'review',
          label: 'Review',
          data: {
            lines: [
              { sku: 'P-200', quantity: 2 },
              { sku: 'P-100', quantity: 9 },
            ],
          },
        },
      ];
      const reorderedRows = buildComparisonRows(twoVersions, {
        arrayItemKeyFields: { lines: 'sku' },
      });
      const changedRows = buildComparisonRows(changed, { arrayItemKeyFields: { lines: 'sku' } });
      expect(reorderedRows[0].children?.map((row) => row.id)).toEqual(
        changedRows[0].children?.map((row) => row.id),
      );
      expect(changedRows[0].children?.[0]).toMatchObject({
        id: '["lines","P-100"]',
        hasDifference: true,
      });
      expect(
        changedRows[0].children?.[0].children?.find((row) => row.property.key === 'quantity'),
      ).toMatchObject({ values: { base: 1, review: 9 }, hasDifference: true });
    });

    it('orders keys from baseline then later versions, with base-relative add/remove and per-version presence', () => {
      const rows = buildComparisonRows(
        [
          {
            id: 'base',
            label: 'Base',
            data: {
              lines: [
                { sku: 'B', quantity: 1 },
                { sku: 'A', quantity: 1 },
              ],
            },
          },
          { id: 'mid', label: 'Mid', data: { lines: [{ sku: 'C', quantity: 1 }] } },
          {
            id: 'last',
            label: 'Last',
            data: {
              lines: [
                { sku: 'C', quantity: 2 },
                { sku: 'D', quantity: 1 },
              ],
            },
          },
        ],
        { arrayItemKeyFields: { lines: 'sku' }, comparison: { baseVersionId: 'base' } },
      );
      expect(rows[0].children?.map((row) => [row.itemIdentity, row.presence])).toEqual([
        ['B', { base: true, mid: false, last: false }],
        ['A', { base: true, mid: false, last: false }],
        ['C', { base: false, mid: true, last: true }],
        ['D', { base: false, mid: false, last: true }],
      ]);
    });

    it('rejects duplicate, missing, and blank identities with path, version, field and offending value or position', () => {
      const build = (lines: unknown[]) =>
        buildComparisonRows([{ id: 'v1', label: 'V1', data: { lines } }], {
          arrayItemKeyFields: { lines: 'sku' },
        });
      expect(() => build([{ sku: 'A' }, { sku: 'A' }])).toThrow(/lines.*v1.*sku.*A.*(?:0|1)/i);
      expect(() => build([{}])).toThrow(/lines.*v1.*sku.*(?:missing|index 0|0)/i);
      expect(() => build([{ sku: '  ' }])).toThrow(/lines.*v1.*sku.*(?:blank|index 0|0)/i);
    });

    it('uses keyed item-definition templates while rejecting conflicting numeric definitions only for keyed arrays', () => {
      const versions = [{ id: 'v1', label: 'V1', data: { lines: [{ sku: 'A', quantity: 2 }] } }];
      const numericDefinition: PropertyDefinition[] = [
        {
          key: 'line0',
          label: 'lines[0]',
          path: ['lines', 0],
          level: 0,
          type: 'object',
        },
      ];
      expect(
        buildComparisonRows(versions, { propertyDefinitions: numericDefinition }),
      ).toHaveLength(1);
      expect(() =>
        buildComparisonRows(versions, {
          arrayItemKeyFields: { lines: 'sku' },
          propertyDefinitions: numericDefinition,
        }),
      ).toThrow(/keyed.*array.*numeric|numeric.*index/i);
      const rows = buildComparisonRows(versions, {
        arrayItemKeyFields: { lines: 'sku' },
        propertyDefinitions: [
          {
            key: 'lines',
            label: 'Lines',
            path: ['lines'],
            level: 0,
            type: 'array',
            flatten: true,
            itemDefinition: {
              key: 'line',
              label: 'Line item',
              path: [],
              level: 0,
              type: 'object',
              children: [
                {
                  key: 'quantity',
                  label: 'Quantity',
                  path: ['quantity'],
                  level: 1,
                  type: 'number',
                },
              ],
            },
          },
        ],
      });
      expect(rows).toMatchObject([
        {
          id: '["lines","A"]',
          property: { label: 'Line item' },
          children: [{ property: { label: 'Quantity' }, values: { v1: 2 } }],
        },
      ]);
    });

    it('P0: validates configured keyed arrays even when definitions hide them, omit an item template, or collapse them', () => {
      const versions = [
        {
          id: 'v1',
          label: 'V1',
          data: { lines: [{ sku: 'DUP' }, { sku: 'DUP' }], visible: 'ok' },
        },
      ];
      const configurations = [
        {
          propertyDefinitions: [
            { key: 'visible', label: 'Visible', path: ['visible'], level: 0, type: 'string' },
          ],
        },
        {
          propertyDefinitions: [
            { key: 'lines', label: 'Lines', path: ['lines'], level: 0, type: 'array' },
          ],
        },
        { rules: [{ path: 'lines', expand: false }] },
      ];

      for (const config of configurations) {
        expect(() =>
          buildComparisonRows(versions, { ...config, arrayItemKeyFields: { lines: 'sku' } }),
        ).toThrow(/lines.*v1.*sku.*DUP/i);
      }
      expect(() =>
        buildComparisonRows([{ id: 'v1', label: 'V1', data: { lines: [{}] } }], {
          propertyDefinitions: [
            { key: 'visible', label: 'Visible', path: ['visible'], level: 0, type: 'string' },
          ],
          arrayItemKeyFields: { lines: 'sku' },
        }),
      ).toThrow(/lines.*v1.*sku.*(?:missing|index 0|0)/i);
      expect(() =>
        buildComparisonRows([{ id: 'v1', label: 'V1', data: { lines: [{ sku: '  ' }] } }], {
          rules: [{ path: 'lines', expand: false }],
          arrayItemKeyFields: { lines: 'sku' },
        }),
      ).toThrow(/lines.*v1.*sku.*(?:blank|index 0|0)/i);
    });

    it('P1: honors an array rule that collapses a flattened keyed item template', () => {
      const rows = buildComparisonRows(
        [{ id: 'v1', label: 'V1', data: { lines: [{ sku: 'A', quantity: 2 }] } }],
        {
          arrayItemKeyFields: { lines: 'sku' },
          rules: [{ path: 'lines', expand: false }],
          propertyDefinitions: [
            {
              key: 'lines',
              label: 'Lines',
              path: ['lines'],
              level: 0,
              type: 'array',
              flatten: true,
              itemDefinition: {
                key: 'line',
                label: 'Line',
                path: [],
                level: 0,
                type: 'object',
                children: [
                  {
                    key: 'quantity',
                    label: 'Quantity',
                    path: ['quantity'],
                    level: 1,
                    type: 'number',
                  },
                ],
              },
            },
          ],
        },
      );

      expect(rows).toMatchObject([
        { id: '["lines"]', property: { label: 'Lines' }, children: undefined },
      ]);
    });

    it('P1: resolves nested keyed item-template children from their nested path', () => {
      const rows = buildComparisonRows(
        [{ id: 'v1', label: 'V1', data: { lines: [{ sku: 'A', amount: 1, tax: { amount: 7 } }] } }],
        {
          arrayItemKeyFields: { lines: 'sku' },
          propertyDefinitions: [
            {
              key: 'lines',
              label: 'Lines',
              path: ['lines'],
              level: 0,
              type: 'array',
              flatten: true,
              itemDefinition: {
                key: 'line',
                label: 'Line',
                path: [],
                level: 0,
                type: 'object',
                children: [
                  {
                    key: 'tax',
                    label: 'Tax',
                    path: ['tax'],
                    level: 1,
                    type: 'object',
                    children: [
                      {
                        key: 'amount',
                        label: 'Tax amount',
                        path: ['amount'],
                        level: 2,
                        type: 'number',
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      );

      expect(rows[0].children?.[0].children?.[0]).toMatchObject({
        property: { label: 'Tax amount', path: ['lines', 'A', 'tax', 'amount'] },
        values: { v1: 7 },
      });
    });

    it('P1: exposes logical keyed paths and identity labels to row metadata and comparator contexts', () => {
      const contexts: unknown[] = [];
      const rows = buildComparisonRows(
        [
          { id: 'base', label: 'Base', data: { lines: [{ sku: 'A', quantity: 1 }] } },
          { id: 'next', label: 'Next', data: { lines: [{ sku: 'A', quantity: 2 }] } },
        ],
        {
          arrayItemKeyFields: { lines: 'sku' },
          comparison: {
            comparator: (_values, context) => {
              contexts.push(context.path);
              return false;
            },
          },
          propertyDefinitions: [
            {
              key: 'lines',
              label: 'Lines',
              path: ['lines'],
              level: 0,
              type: 'array',
              flatten: true,
              itemDefinition: {
                key: 'line',
                label: 'Order line',
                path: [],
                level: 0,
                type: 'object',
                children: [
                  {
                    key: 'quantity',
                    label: 'Quantity',
                    path: ['quantity'],
                    level: 1,
                    type: 'number',
                  },
                ],
              },
            },
          ],
        },
      );

      expect(rows[0]).toMatchObject({ property: { path: ['lines', 'A'] } });
      expect(rows[0].property.label).toContain('A');
      expect(contexts).toContainEqual(['lines', 'A', 'quantity']);
    });

    it('P1: retains per-version presence when an item disappears in the middle and returns later', () => {
      const rows = buildComparisonRows(
        [
          { id: 'base', label: 'Base', data: { lines: [{ sku: 'A' }] } },
          { id: 'mid', label: 'Mid', data: { lines: [] } },
          { id: 'last', label: 'Last', data: { lines: [{ sku: 'A' }] } },
        ],
        { arrayItemKeyFields: { lines: 'sku' } },
      );

      expect(rows[0].children?.[0]).toMatchObject({
        itemIdentity: 'A',
        presence: { base: true, mid: false, last: true },
      });
    });

    it('P2: rejects numeric relative paths anywhere below a keyed item template', () => {
      expect(() =>
        buildComparisonRows(
          [{ id: 'v1', label: 'V1', data: { lines: [{ sku: 'A', taxes: [{ amount: 3 }] }] } }],
          {
            arrayItemKeyFields: { lines: 'sku' },
            propertyDefinitions: [
              {
                key: 'lines',
                label: 'Lines',
                path: ['lines'],
                level: 0,
                type: 'array',
                flatten: true,
                itemDefinition: {
                  key: 'line',
                  label: 'Line',
                  path: [],
                  level: 0,
                  type: 'object',
                  children: [
                    {
                      key: 'taxes',
                      label: 'Taxes',
                      path: ['taxes'],
                      level: 1,
                      type: 'array',
                      children: [
                        {
                          key: 'firstTax',
                          label: 'First tax',
                          path: [0],
                          level: 2,
                          type: 'object',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ),
      ).toThrow(/keyed.*array.*numeric|numeric.*index/i);
    });
  });
});

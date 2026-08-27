import { describe, expect, it } from 'vitest';
import { builtInRenderers, createRendererRegistry, RendererRegistry } from './renderers';

describe('builtInRenderers', () => {
  it('formats builtin number, percentage and boolean values', () => {
    expect(builtInRenderers.get('number')!(100000, {} as never)).toBe('100,000');
    expect(builtInRenderers.get('percentage')!(0.1523, {} as never)).toBe('15.23%');
    expect(builtInRenderers.get('boolean')!(true, {} as never)).toBe('Yes');
  });
  it('clones registries without mutating the original', () => {
    const clone = builtInRenderers.clone().register('custom', () => 'Custom');
    expect(clone.get('custom')!(null, {} as never)).toBe('Custom');
    expect(builtInRenderers.get('custom')).toBeUndefined();
  });

  it('creates an isolated registry that adds and overrides renderers', () => {
    const registry = createRendererRegistry({
      custom: () => 'Custom',
      money: () => 'Compact money',
    });

    expect(registry.get('custom')!(null, {} as never)).toBe('Custom');
    expect(registry.get('money')!(null, {} as never)).toBe('Compact money');
    expect(builtInRenderers.get('custom')).toBeUndefined();
    expect(builtInRenderers.get('money')!({ amount: 100, currency: 'USD' }, {} as never)).toBe(
      '$100.00',
    );
  });

  it('merges a RendererRegistry with builtins without mutating either registry', () => {
    const localRegistry = new RendererRegistry().register('custom', () => 'Local');
    const registry = createRendererRegistry(localRegistry);

    expect(registry.get('custom')!(null, {} as never)).toBe('Local');
    expect(registry.get('boolean')!(true, {} as never)).toBe('Yes');
    expect(localRegistry.get('boolean')).toBeUndefined();
  });

  it('summarizes compound values without stringifying them as objects', () => {
    expect(builtInRenderers.get('object')!({ amount: 100, currency: 'USD' }, {} as never)).toBe(
      '{ 2 fields }',
    );
    expect(builtInRenderers.get('array')!(['a', 'b'], {} as never)).toBe('[ 2 items ]');
  });
});

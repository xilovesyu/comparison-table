import { describe, expect, it } from 'vitest';
import { builtInRenderers } from './renderers';

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
});

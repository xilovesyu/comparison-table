import type { ValueRenderer } from './types';

export class RendererRegistry {
  private readonly renderers = new Map<string, ValueRenderer>();
  register(name: string, renderer: ValueRenderer): this { this.renderers.set(name, renderer); return this; }
  get(name: string): ValueRenderer | undefined { return this.renderers.get(name); }
  clone(): RendererRegistry { const copy = new RendererRegistry(); this.renderers.forEach((renderer, name) => copy.register(name, renderer)); return copy; }
}

const text: ValueRenderer = (value) => value === undefined ? '—' : value === null ? 'null' : String(value);
export const builtInRenderers = new RendererRegistry()
  .register('text', text)
  .register('number', (value) => typeof value === 'number' ? new Intl.NumberFormat().format(value) : text(value, {} as never))
  .register('percentage', (value) => typeof value === 'number' ? new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(value) : text(value, {} as never))
  .register('boolean', (value) => value === true ? 'Yes' : value === false ? 'No' : text(value, {} as never))
  .register('date', (value) => value instanceof Date ? value.toLocaleString() : text(value, {} as never))
  .register('money', (value) => {
    if (typeof value === 'object' && value !== null && 'amount' in value && 'currency' in value) {
      const money = value as { amount: number; currency: string };
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: money.currency }).format(money.amount);
    }
    return text(value, {} as never);
  });

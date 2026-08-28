import type { ValueRenderer } from './types';

/** Plain-object form used to add or replace renderers for one table instance. */
export type RendererDefinitions = Readonly<Record<string, ValueRenderer>>;
/** A registry instance or plain renderer map accepted by the component. */
export type RendererOverrides = RendererRegistry | RendererDefinitions;

/**
 * Mutable renderer collection. Pass an instance to one table to extend or replace
 * built-ins without mutating the shared `builtInRenderers` registry.
 */
export class RendererRegistry {
  private readonly renderers = new Map<string, ValueRenderer>();
  /** Registers or replaces a renderer and returns this registry for chaining. */
  register(name: string, renderer: ValueRenderer): this {
    this.renderers.set(name, renderer);
    return this;
  }
  /** Looks up a renderer by name. */
  get(name: string): ValueRenderer | undefined {
    return this.renderers.get(name);
  }
  /** Iterates renderer name/function pairs. */
  entries(): IterableIterator<[string, ValueRenderer]> {
    return this.renderers.entries();
  }
  /** Creates an independent copy of this registry. */
  clone(): RendererRegistry {
    const copy = new RendererRegistry();
    this.renderers.forEach((renderer, name) => copy.register(name, renderer));
    return copy;
  }
}

const text: ValueRenderer = (value) =>
  value === undefined ? '—' : value === null ? 'null' : String(value);
/** Shared built-ins: `text`, `number`, `percentage`, `boolean`, `date`, `object`, `array`, and `money`. */
export const builtInRenderers = new RendererRegistry()
  .register('text', text)
  .register('number', (value) =>
    typeof value === 'number' ? new Intl.NumberFormat().format(value) : text(value, {} as never),
  )
  .register('percentage', (value) =>
    typeof value === 'number'
      ? new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 }).format(
          value,
        )
      : text(value, {} as never),
  )
  .register('boolean', (value) =>
    value === true ? 'Yes' : value === false ? 'No' : text(value, {} as never),
  )
  .register('date', (value) =>
    value instanceof Date ? value.toLocaleString() : text(value, {} as never),
  )
  .register('object', (value) =>
    value && typeof value === 'object'
      ? `{ ${Object.keys(value).length} fields }`
      : text(value, {} as never),
  )
  .register('array', (value) =>
    Array.isArray(value) ? `[ ${value.length} items ]` : text(value, {} as never),
  )
  .register('money', (value) => {
    if (typeof value === 'object' && value !== null && 'amount' in value && 'currency' in value) {
      const money = value as { amount: number; currency: string };
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: money.currency,
      }).format(money.amount);
    }
    return text(value, {} as never);
  });

/**
 * Clones built-ins and applies table-local renderer overrides.
 * The original `builtInRenderers` registry is never mutated.
 */
export function createRendererRegistry(overrides?: RendererOverrides): RendererRegistry {
  const registry = builtInRenderers.clone();
  if (!overrides) return registry;
  const entries =
    overrides instanceof RendererRegistry ? overrides.entries() : Object.entries(overrides);
  Array.from(entries).forEach(([name, renderer]) => registry.register(name, renderer));
  return registry;
}

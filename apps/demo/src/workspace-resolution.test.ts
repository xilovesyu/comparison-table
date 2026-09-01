import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('demo workspace package resolution', () => {
  it('maps the package runtime alias to the same workspace source selected by TypeScript', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

    expect(config).toMatch(/'@jxi\/comparison-table':\s*fileURLToPath/);
    expect(config).toContain("new URL('../../packages/comparison-table/src/index.ts', import.meta.url)");
  });
});

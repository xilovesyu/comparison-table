import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
const pagesConfig = { base: '/comparison-table/' } as const;

export default defineConfig(({ mode }) => ({
  ...(mode === 'pages' ? pagesConfig : {}),
  plugins: [react()],
  resolve: {
    alias: {
      '@jxi/comparison-table': fileURLToPath(
        new URL('../../packages/comparison-table/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}));

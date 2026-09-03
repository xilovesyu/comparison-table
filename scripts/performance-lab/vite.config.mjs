import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const labDirectory = path.dirname(fileURLToPath(import.meta.url));
const libraryDependencies = path.join(labDirectory, '../../packages/comparison-table/node_modules');

export default defineConfig({
  root: path.join(labDirectory, 'host'),
  plugins: [react()],
  resolve: {
    alias: {
      react: path.join(libraryDependencies, 'react'),
      'react-dom': path.join(libraryDependencies, 'react-dom'),
    },
  },
  build: {
    outDir: path.join(labDirectory, '../../.performance-lab/dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: { host: '127.0.0.1', strictPort: true },
});

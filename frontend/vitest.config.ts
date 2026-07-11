/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Vitest configuration for unit testing.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: true,
    // A handful of test files (recharts-heavy pages, MSW-backed integration
    // tests) have large module/transform graphs. Vitest's fork pool reuses a
    // worker process across multiple test files by default, so heavy files
    // landing in the same worker accumulate heap until it exceeds Node's
    // ceiling. isolate + singleFork: false with maxForks capped keeps worker
    // count reasonable, and execArgv raises each worker's ceiling well above
    // the ~4-6GB a worst-case combination of heavy files has been observed
    // to need.
    maxWorkers: 2,
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=10240'],
      },
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.storybook/**',
        '**/*.stories.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/store': path.resolve(__dirname, './src/store'),
    },
  },
});
import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config, { configType }) {
    // Ensure Storybook uses the same path aliases as the main app
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      // Mock the realtime provider for Storybook (put these first so they take precedence)
      '@/providers/realtime': path.resolve(__dirname, 'mocks', 'realtime.ts'),
      '@/providers/realtime/index': path.resolve(__dirname, 'mocks', 'realtime.ts'),
      '@/providers/realtime/RealtimeProvider': path.resolve(__dirname, 'mocks', 'realtime.ts'),
      // Standard aliases
      '@': path.resolve(__dirname, '../src'),
      '@/components': path.resolve(__dirname, '../src/components'),
      '@/atoms': path.resolve(__dirname, '../src/atoms'),
      '@/hooks': path.resolve(__dirname, '../src/hooks'),
      '@/utils': path.resolve(__dirname, '../src/utils'),
      '@/types': path.resolve(__dirname, '../src/types'),
      '@/api': path.resolve(__dirname, '../src/api'),
      '@/providers': path.resolve(__dirname, '../src/providers'),
      '@/store': path.resolve(__dirname, '../src/store'),
      '@/pages': path.resolve(__dirname, '../src/pages'),
      '@/styles': path.resolve(__dirname, '../src/styles'),
      '@/test': path.resolve(__dirname, '../src/test'),
    };
    
    // Enable CSS processing with Tailwind v4 (matching main app config)
    config.css = {
      postcss: {
        plugins: [
          require('@tailwindcss/postcss')(),
          require('autoprefixer'),
        ],
      },
    };
    
    // Keep existing aliases only
    config.resolve.alias = {
      ...config.resolve.alias,
      // Only keep the necessary path aliases, remove problematic ones
    };
    
    // Basic configuration - let Tailwind work normally
    config.define = config.define || {};
    config.define['process.env.NODE_ENV'] = '"development"';
    
    return config;
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  core: {
    disableTelemetry: true,
  },
};

export default config;
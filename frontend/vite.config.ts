import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/atoms': path.resolve(__dirname, './src/atoms'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/api': path.resolve(__dirname, './src/api'),
      '@/providers': path.resolve(__dirname, './src/providers'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/test': path.resolve(__dirname, './src/test'),
    },
    // Ensure single React instance
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['msw/node'],
    // Force pre-bundle React to prevent multiple instances
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      usePolling: true, // Required for Docker
    },
    hmr: {
      // For Docker: use host's localhost for WebSocket
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    minify: 'esbuild',
    chunkSizeWarningLimit: 800, // Increase limit for visualization components
    target: 'es2020', // Modern browsers support
    rollupOptions: {
      external: mode === 'production' ? ['msw', 'msw/browser', 'msw/node'] : ['msw/node'],
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: (id) => {
          // Vendor dependencies
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor';
            }
            // TanStack Query
            if (id.includes('@tanstack/react-query')) {
              return 'tanstack-query';
            }
            // Jotai
            if (id.includes('jotai')) {
              return 'jotai';
            }
            // UI components
            if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'ui';
            }
            // Charts
            if (id.includes('recharts') || id.includes('d3')) {
              return 'charts';
            }
            // Testing
            if (id.includes('@testing-library') || id.includes('vitest')) {
              return 'testing';
            }
            // Utilities
            if (id.includes('lodash') || id.includes('date-fns') || id.includes('validator')) {
              return 'utils';
            }
            // WebSocket client
            if (id.includes('websocket') || id.includes('ws')) {
              return 'websocket-client';
            }
            // Everything else in vendor
            return 'vendor-misc';
          }

          // App code chunks
          if (id.includes('/src/api/orval-generated/')) {
            return 'api-client';
          }
          if (id.includes('/src/components/')) {
            return 'components';
          }
          if (id.includes('/src/hooks/')) {
            return 'hooks';
          }
          if (id.includes('/src/atoms/')) {
            return 'atoms';
          }
          if (id.includes('/src/utils/')) {
            return 'utils';
          }
        },
        // Optimize output filenames for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // Enable modern ES features for better compression
        format: 'es',
        // Split CSS into separate files
        exports: 'named',
      },
    },
    // Enable compression
    assetsInclude: ['**/*.woff2', '**/*.woff'],
    cssCodeSplit: true,
    // Tree shaking optimization
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false,
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
}))

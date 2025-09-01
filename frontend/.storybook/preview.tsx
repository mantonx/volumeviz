import type { Preview } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockRealtimeProvider, MockToastProvider } from './MockProviders';
import '../src/index.css'; // Import the actual Tailwind CSS
// Removed styles.css override since Tailwind v4 is now properly configured

// Create a mock QueryClient for Storybook
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
});

const preview: Preview = {
  decorators: [
    (Story, context) => {
      return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          MemoryRouter,
          {},
          React.createElement(
            MockToastProvider,
            {},
            React.createElement(
              MockRealtimeProvider,
              {},
              React.createElement(Story, { ...context })
            )
          )
        )
      );
    },
  ],
  parameters: {
    // Enhanced actions support
    actions: { 
      argTypesRegex: '^on[A-Z].*',
      // Custom action logging
      handles: ['click', 'change', 'submit', 'focus', 'blur'],
    },
    
    // Enhanced controls
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true, // Show controls panel expanded by default
      hideNoControlsWarning: true,
    },
    
    // Background options for testing
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1f2937' },
        { name: 'gray', value: '#f3f4f6' },
      ],
    },
    
    // Viewport options for responsive testing
    viewport: {
      viewports: {
        mobile1: {
          name: 'Mobile',
          styles: { width: '320px', height: '568px' },
        },
        mobile2: {
          name: 'Mobile Large',
          styles: { width: '414px', height: '896px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1024px', height: '768px' },
        },
        wide: {
          name: 'Wide Desktop',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },
    
    // Documentation options
    docs: {
      theme: 'light',
      source: {
        state: 'open', // Show source code by default
      },
    },
    
    // Layout options
    layout: 'centered', // Default layout for stories
  },
  
  // Global types for toolbar controls
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
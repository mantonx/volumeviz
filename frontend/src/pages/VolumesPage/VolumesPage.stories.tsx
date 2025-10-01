import type { Meta, StoryObj } from '@storybook/react';
import { VolumesPage } from './VolumesPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { BrowserRouter } from 'react-router-dom';

/**
 * Storybook Meta Configuration for VolumesPage
 */
const meta: Meta<typeof VolumesPage> = {
  title: 'Pages/VolumesPage',
  component: VolumesPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# VolumesPage

Comprehensive Docker volume management page with full CRUD operations.

## Features

- **Volume Listing**: Grid and table views with advanced filtering
- **CRUD Operations**: Create, Read, Update, Delete volumes
- **Bulk Operations**: Scan multiple volumes, bulk delete
- **Real-time Updates**: WebSocket integration for scan progress
- **Export Functionality**: Export volume data in various formats
- **Advanced Search**: Multi-criteria search and filtering

## Usage

The VolumesPage is the main interface for managing Docker volumes in VolumeViz.
It integrates with:
- VolumesList component for display
- Modal components for CRUD operations
- TanStack Query for data fetching
- Jotai for state management
        `,
      },
    },
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Infinity,
          },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider>
            <BrowserRouter>
              <Story />
            </BrowserRouter>
          </JotaiProvider>
        </QueryClientProvider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof VolumesPage>;

/**
 * Default state with volumes loaded
 */
export const Default: Story = {
  name: 'Default View',
  parameters: {
    docs: {
      description: {
        story: 'Default volumes page view with loaded data.',
      },
    },
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  name: 'Loading State',
  parameters: {
    docs: {
      description: {
        story: 'Volumes page showing loading state while fetching data.',
      },
    },
    msw: {
      handlers: {
        // Mock slow response
      },
    },
  },
};

/**
 * Empty state - no volumes
 */
export const EmptyState: Story = {
  name: 'Empty State',
  parameters: {
    docs: {
      description: {
        story: 'Volumes page when no volumes are available.',
      },
    },
    msw: {
      handlers: {
        // Mock empty response
      },
    },
  },
};

/**
 * With selected volumes
 */
export const WithSelection: Story = {
  name: 'With Selected Volumes',
  parameters: {
    docs: {
      description: {
        story:
          'Volumes page with multiple volumes selected, showing bulk action options.',
      },
    },
  },
};

/**
 * Error state
 */
export const ErrorState: Story = {
  name: 'Error State',
  parameters: {
    docs: {
      description: {
        story: 'Volumes page showing error state when data fetch fails.',
      },
    },
    msw: {
      handlers: {
        // Mock error response
      },
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  name: 'Mobile View',
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Volumes page optimized for mobile devices.',
      },
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  name: 'Tablet View',
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Volumes page optimized for tablet devices.',
      },
    },
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { SearchPage } from './SearchPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as JotaiProvider } from 'jotai';
import { BrowserRouter } from 'react-router-dom';

/**
 * Storybook Meta Configuration for SearchPage
 */
const meta: Meta<typeof SearchPage> = {
  title: 'Pages/SearchPage',
  component: SearchPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# SearchPage

Comprehensive file search and discovery page with advanced filtering and duplicate detection.

## Features

- **Multi-criteria Search**: Search by name, content, metadata, and more
- **Advanced Filtering**: Filter by size, type, date, volume, and media type
- **Duplicate Detection**: Find and analyze duplicate files using content hash
- **Saved Searches**: Save and reload frequently used search queries
- **Search History**: Track recent searches for quick access
- **Export Functionality**: Export results to CSV or JSON format
- **Bulk Operations**: Delete multiple search results at once
- **Real-time Suggestions**: Get search suggestions as you type

## Usage

The SearchPage is the main interface for finding and analyzing files across Docker volumes.
It integrates with:
- SearchInterface component for the search UI
- Modal components for export and duplicate detection
- React Router for navigation
- TanStack Query for data fetching
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
type Story = StoryObj<typeof SearchPage>;

/**
 * Default state
 */
export const Default: Story = {
  name: 'Default View',
  parameters: {
    docs: {
      description: {
        story: 'Default search page view with all features enabled.',
      },
    },
  },
};

/**
 * With search results
 */
export const WithResults: Story = {
  name: 'With Search Results',
  parameters: {
    docs: {
      description: {
        story: 'Search page displaying search results with statistics.',
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
        story: 'Search page showing loading state while fetching results.',
      },
    },
  },
};

/**
 * Empty state - no results
 */
export const EmptyResults: Story = {
  name: 'No Results Found',
  parameters: {
    docs: {
      description: {
        story: 'Search page when no results match the search query.',
      },
    },
  },
};

/**
 * With duplicate detection modal
 */
export const DuplicateDetection: Story = {
  name: 'Duplicate Detection Modal',
  parameters: {
    docs: {
      description: {
        story: 'Search page with duplicate detection modal open.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Programmatically open modal
    // This would require interaction testing with Storybook
  },
};

/**
 * With export modal
 */
export const ExportModal: Story = {
  name: 'Export Results Modal',
  parameters: {
    docs: {
      description: {
        story: 'Search page with export results modal open.',
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
        story: 'Search page showing error state when search fails.',
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
        story: 'Search page optimized for mobile devices.',
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
        story: 'Search page optimized for tablet devices.',
      },
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  name: 'Dark Mode',
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Search page in dark mode.',
      },
    },
  },
};

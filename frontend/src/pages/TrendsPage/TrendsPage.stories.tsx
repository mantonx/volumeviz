/**
 * TrendsPage Storybook Stories
 * Visual documentation for trends analysis page
 */

import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrendsPage } from './TrendsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const meta = {
  title: 'Pages/TrendsPage',
  component: TrendsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Historical storage trends analysis and predictive capacity planning page with interactive charts and visualizations.',
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof TrendsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default view with all trend analysis charts
 */
export const Default: Story = {
  args: {},
};

/**
 * View showing growth trends
 */
export const GrowthTrends: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Displays historical storage growth with area chart visualization.',
      },
    },
  },
};

/**
 * View showing file type distribution
 */
export const FileTypeDistribution: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Shows file type distribution using pie chart with percentages.',
      },
    },
  },
};

/**
 * View showing capacity forecast
 */
export const CapacityForecast: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Displays 90-day capacity forecast with confidence intervals and threshold warnings.',
      },
    },
  },
};

/**
 * View with custom styling
 */
export const CustomStyling: Story = {
  args: {
    className: 'bg-gradient-to-br from-blue-50 to-indigo-50',
  },
  parameters: {
    docs: {
      description: {
        story: 'TrendsPage with custom gradient background styling.',
      },
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Responsive layout optimized for mobile devices.',
      },
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Responsive layout optimized for tablet devices.',
      },
    },
  },
};

/**
 * Desktop viewport
 */
export const Desktop: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    docs: {
      description: {
        story: 'Full desktop layout with all charts and metrics visible.',
      },
    },
  },
};

/**
 * Dark mode compatible
 */
export const DarkMode: Story = {
  args: {},
  parameters: {
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        story: 'TrendsPage styled for dark mode compatibility.',
      },
    },
  },
};

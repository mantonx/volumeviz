import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Sidebar } from './Sidebar';
import { action } from '@/utils/storybook-utils';

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Layout/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The application sidebar providing navigation and quick stats.

## Features
- Hierarchical navigation with primary and secondary sections
- Active route highlighting
- Badge support for navigation items
- Volume statistics panel
- Mobile responsive with backdrop overlay
- Smooth slide animations
- Dark/light theme support
- Proper keyboard navigation

## Usage
\`\`\`tsx
import { Sidebar } from '@/components/layout/Sidebar';
import { action } from '@/utils/storybook-utils';

<Sidebar 
  open={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: { type: 'boolean' },
      description: 'Whether the sidebar is open (mobile)',
    },
    onClose: {
      action: 'sidebar-closed',
      description: 'Callback when sidebar should be closed',
    },
  },
  args: {
    onClose: action('sidebar-closed'),
  },
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-gray-50 dark:bg-gray-900">
        <Story />
        <div className="lg:pl-72 p-8">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Main Content Area
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              This represents the main application content. The sidebar is positioned 
              on the left and pushes content to the right on desktop views.
            </p>
          </div>
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: false,
  },
};

export const MobileOpen: Story = {
  args: {
    open: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Sidebar opened on mobile with backdrop overlay.',
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    open: true,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Sidebar behavior on mobile devices with overlay and close button.',
      },
    },
  },
};

export const Desktop: Story = {
  args: {
    open: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    docs: {
      description: {
        story: 'Sidebar behavior on desktop where it\'s always visible and doesn\'t overlay content.',
      },
    },
  },
};

export const DarkTheme: Story = {
  args: {
    open: false,
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Sidebar appearance in dark theme.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <div className="relative h-screen bg-gray-50 dark:bg-gray-900">
          <Story />
          <div className="lg:pl-72 p-8">
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Dark Theme Content
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                The sidebar automatically adapts to dark theme with appropriate 
                color adjustments for all navigation elements and stats.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  ],
};

export const NavigationStates: Story = {
  render: () => (
    <div className="relative h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar open={false} onClose={() => {}} />
        <div className="lg:pl-72 p-8">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Navigation States Demo
            </h1>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                This demo shows the sidebar with the "Volumes" route active.
                Notice how the active navigation item is highlighted.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Active State Features:
                </h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Blue background and text color</li>
                  <li>Icon color matches active state</li>
                  <li>Proper contrast for accessibility</li>
                  <li>Badges show contextual information</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates active navigation states and visual feedback.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    
    return (
      <div className="relative h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar open={open} onClose={() => setOpen(false)} />
          <div className="lg:pl-72 p-8">
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Interactive Sidebar Demo
              </h1>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setOpen(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open Sidebar
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close Sidebar
                  </button>
                </div>
                <div className="text-gray-600 dark:text-gray-400 space-y-2">
                  <p>Current state: <strong>{open ? 'Open' : 'Closed'}</strong></p>
                  <p>Try the following:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Click the buttons above to toggle sidebar</li>
                    <li>Click navigation items to see route changes</li>
                    <li>On mobile, click the backdrop to close</li>
                    <li>Resize the window to see responsive behavior</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive sidebar with state management and route navigation.',
      },
    },
  },
};

export const StatsPanel: Story = {
  args: {
    open: false,
  },
  decorators: [
    (Story) => (
        <div className="relative h-screen bg-gray-50 dark:bg-gray-900">
          <Story />
          <div className="lg:pl-72 p-8">
            <div className="max-w-4xl">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Quick Stats Panel
              </h1>
              <div className="space-y-4 text-gray-600 dark:text-gray-400">
                <p>
                  The sidebar includes a quick stats panel at the bottom showing:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Total volume count</li>
                  <li>Active volume count</li>
                  <li>Total storage used (when available)</li>
                </ul>
                <p>
                  This provides users with immediate system overview information
                  without needing to navigate to the dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Focus on the quick stats panel functionality at the bottom of the sidebar.',
      },
    },
  },
};

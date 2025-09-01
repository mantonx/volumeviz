import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { MockHeader as Header } from '../../../../.storybook/components/MockHeader';
import { action } from '@/utils/storybook-utils';

const meta: Meta<typeof Header> = {
  title: 'Components/Layout/Header',
  component: Header,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The application header component providing navigation and system status.

## Features
- Mobile sidebar toggle (hamburger menu)
- Real-time API connection status indicator
- Active request counter with loading animation
- Theme switcher (light/dark/system)
- User menu with settings and help links
- Notification bell
- Responsive layout for mobile and desktop

## Usage
\`\`\`tsx
import { Header } from '@/components/layout/Header';
import { action } from '@/utils/storybook-utils';

<Header 
  sidebarOpen={sidebarOpen}
  setSidebarOpen={setSidebarOpen}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    sidebarOpen: {
      control: { type: 'boolean' },
      description: 'Whether the sidebar is currently open',
    },
    setSidebarOpen: {
      action: 'sidebar-toggled',
      description: 'Callback to toggle sidebar state',
    },
  },
  args: {
    setSidebarOpen: action('sidebar-toggled'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    sidebarOpen: false,
  },
};

export const SidebarOpen: Story = {
  args: {
    sidebarOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Header state when sidebar is open, showing the close (X) icon instead of hamburger menu.',
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    sidebarOpen: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Header layout optimized for mobile devices with responsive behavior.',
      },
    },
  },
};

export const Tablet: Story = {
  args: {
    sidebarOpen: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Header layout on tablet-sized screens.',
      },
    },
  },
};

export const Desktop: Story = {
  args: {
    sidebarOpen: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
    docs: {
      description: {
        story: 'Header layout on desktop screens where hamburger menu is hidden.',
      },
    },
  },
};

export const DarkTheme: Story = {
  args: {
    sidebarOpen: false,
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'Header appearance in dark theme with appropriate color adjustments.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  render: () => {
    const [sidebarOpen, setSidebarOpen] = React.useState(false);
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Interactive Header Demo
            </h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                This is an interactive demo of the header component. Try the following:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Click the hamburger menu (on mobile) to toggle the sidebar</li>
                <li>Click the theme toggle to switch between light/dark/system themes</li>
                <li>Observe the API connection status indicator</li>
                <li>Notice how the layout adapts to different screen sizes</li>
              </ul>
              <p className="text-sm">
                Current sidebar state: {sidebarOpen ? 'Open' : 'Closed'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Fully interactive header with real sidebar toggle and theme switching functionality.',
      },
    },
  },
};

export const StatusVariations: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2">Online Status</h3>
        <Header sidebarOpen={false} setSidebarOpen={() => {}} />
      </div>
      
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <p><strong>Status Indicators:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span>Green</span> - Connected/Online</li>
          <li><span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span>Yellow</span> - Connecting/Loading</li>
          <li><span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Red</span> - Disconnected/Error</li>
          <li><span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full"></span>Gray</span> - Unknown/Inactive</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different status indicator states for API and WebSocket connections.',
      },
    },
  },
};

export const ResponsiveBehavior: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-800 p-2 text-sm font-medium text-center">
          Desktop (≥1024px)
        </div>
        <div className="lg:block hidden">
          <Header sidebarOpen={false} setSidebarOpen={() => {}} />
        </div>
        <div className="lg:hidden p-4 text-center text-gray-500">
          Hidden on desktop (hamburger menu not shown)
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-800 p-2 text-sm font-medium text-center">
          Tablet & Mobile (&lt;1024px)
        </div>
        <div className="lg:hidden block">
          <Header sidebarOpen={false} setSidebarOpen={() => {}} />
        </div>
        <div className="lg:block hidden p-4 text-center text-gray-500">
          Visible on tablet/mobile (hamburger menu shown)
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates responsive behavior differences between desktop and mobile viewports.',
      },
    },
  },
};

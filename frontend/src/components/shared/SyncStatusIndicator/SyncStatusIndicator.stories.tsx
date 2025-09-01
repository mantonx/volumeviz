import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SyncStatusIndicator, SyncStatusBadge, SyncStatusPanel } from './SyncStatusIndicator';

const meta: Meta<typeof SyncStatusIndicator> = {
  title: 'Components/Shared/SyncStatusIndicator',
  component: SyncStatusIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A component for displaying synchronization status with the backend API.

## Features
- Online/offline status indication
- Pending operations counter
- Sync progress indication
- Multiple size variants
- Icon-only or labeled versions
- Color-coded status states
- Responsive design

## Variants
- **SyncStatusIndicator**: Basic status indicator with customizable label and size
- **SyncStatusBadge**: Compact badge that auto-hides when online
- **SyncStatusPanel**: Detailed panel with controls for debugging/settings

## Usage
\`\`\`tsx
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';

<SyncStatusIndicator 
  size="md"
  showLabel={true}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the indicator',
    },
    showLabel: {
      control: { type: 'boolean' },
      description: 'Whether to show the status label',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
    showLabel: true,
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <SyncStatusIndicator size="sm" />
        <p className="text-xs text-gray-500 mt-2">Small</p>
      </div>
      <div className="text-center">
        <SyncStatusIndicator size="md" />
        <p className="text-xs text-gray-500 mt-2">Medium</p>
      </div>
      <div className="text-center">
        <SyncStatusIndicator size="lg" />
        <p className="text-xs text-gray-500 mt-2">Large</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different size variants of the sync status indicator.',
      },
    },
  },
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <SyncStatusIndicator size="sm" showLabel={false} />
        <p className="text-xs text-gray-500 mt-2">Small</p>
      </div>
      <div className="text-center">
        <SyncStatusIndicator size="md" showLabel={false} />
        <p className="text-xs text-gray-500 mt-2">Medium</p>
      </div>
      <div className="text-center">
        <SyncStatusIndicator size="lg" showLabel={false} />
        <p className="text-xs text-gray-500 mt-2">Large</p>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Icon-only versions suitable for space-constrained areas.',
      },
    },
  },
};

export const StatusStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Status Examples</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-green-50 border-green-200">
              <div className="h-5 w-5 text-green-500">✓</div>
              <span className="text-sm font-medium text-green-500">Online</span>
            </div>
            <span className="text-sm text-gray-600">Normal operation - all systems connected</span>
          </div>

          <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 border-blue-200">
              <div className="h-5 w-5 text-blue-500">⟳</div>
              <span className="text-sm font-medium text-blue-500">Syncing...</span>
            </div>
            <span className="text-sm text-gray-600">Currently synchronizing data with server</span>
          </div>

          <div className="flex items-center gap-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-orange-50 border-orange-200">
              <div className="h-5 w-5 text-orange-500">!</div>
              <span className="text-sm font-medium text-orange-500">3 pending</span>
            </div>
            <span className="text-sm text-gray-600">Operations queued waiting for sync</span>
          </div>

          <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 border-amber-200">
              <div className="h-5 w-5 text-amber-500">⚠</div>
              <span className="text-sm font-medium text-amber-500">Offline (5 queued)</span>
            </div>
            <span className="text-sm text-gray-600">No connection - operations queued for later</span>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different status states the indicator can display based on connection and sync status.',
      },
    },
  },
};

export const BadgeVariant: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Sync Status Badge</h3>
        <p className="text-xs text-gray-500 mb-4">
          This badge only appears when there are issues (offline or pending operations).
          It automatically hides when everything is online and synchronized.
        </p>
        
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Header/Toolbar:</span>
          <SyncStatusBadge />
          <span className="text-xs text-gray-400">(Hidden when online with no pending operations)</span>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact badge variant that only shows when there are sync issues.',
      },
    },
  },
};

export const StatusPanel: Story = {
  render: () => (
    <div className="max-w-md">
      <SyncStatusPanel />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Detailed status panel with controls for debugging and manual sync operations.',
      },
    },
  },
};

export const LayoutIntegration: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Header Integration</h3>
        <div className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Application Header</h1>
          <div className="flex items-center gap-3">
            <SyncStatusBadge />
            <button className="p-2 text-gray-500 hover:text-gray-700">
              Settings
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Sidebar Footer</h3>
        <div className="w-64 bg-white border rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h2 className="font-medium text-gray-900">Navigation</h2>
          </div>
          <div className="p-4 space-y-2">
            <div className="text-sm text-gray-600">Dashboard</div>
            <div className="text-sm text-gray-600">Settings</div>
          </div>
          <div className="p-4 border-t">
            <SyncStatusIndicator size="sm" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Status Bar</h3>
        <div className="flex items-center justify-between p-2 bg-gray-100 border rounded text-sm">
          <span className="text-gray-600">Ready</span>
          <SyncStatusIndicator size="sm" showLabel={false} />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Examples of how to integrate the sync status indicator into different UI layouts.',
      },
    },
    layout: 'padded',
  },
};

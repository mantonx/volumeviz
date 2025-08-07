import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Badge } from '../Badge';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component: `
Card component used throughout VolumeViz for consistent content containers.

**Primary Use Cases:**
- Volume information cards showing name, driver, size, and status
- Dashboard metric widgets (storage usage, container counts, health status)
- Settings panels and configuration forms
- Container listing cards with details and actions
- Error states and informational messages
- Health check results and system status displays

All cards automatically adapt to light/dark themes and provide consistent elevation and spacing.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// Volume information card example
export const VolumeCard: Story = {
  render: () => (
    <Card className="p-6 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">my-app-data</h3>
        <Badge variant="success">Active</Badge>
      </div>
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex justify-between">
          <span>Driver:</span>
          <span>local</span>
        </div>
        <div className="flex justify-between">
          <span>Size:</span>
          <span>2.4 GB</span>
        </div>
        <div className="flex justify-between">
          <span>Containers:</span>
          <span>3</span>
        </div>
      </div>
    </Card>
  ),
};

// Dashboard metric widget
export const MetricWidget: Story = {
  render: () => (
    <Card className="p-6 max-w-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total Volumes
          </p>
          <p className="text-2xl font-bold">24</p>
        </div>
        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
          <svg
            className="h-6 w-6 text-blue-600 dark:text-blue-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        </div>
      </div>
    </Card>
  ),
};

// Error state card
export const ErrorCard: Story = {
  render: () => (
    <Card className="p-6 max-w-md border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          <Badge variant="error">Error</Badge>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Connection Failed
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            Unable to connect to Docker daemon. Please check your Docker
            installation.
          </p>
        </div>
      </div>
    </Card>
  ),
};

// Settings panel card
export const SettingsPanel: Story = {
  render: () => (
    <Card className="p-6 max-w-lg">
      <h3 className="text-lg font-semibold mb-4">API Configuration</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Base URL</label>
          <input
            type="text"
            defaultValue="http://localhost:8080/api/v1"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Timeout (ms)</label>
          <input
            type="number"
            defaultValue="10000"
            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div className="flex items-center space-x-2">
          <input type="checkbox" id="auto-refresh" defaultChecked />
          <label htmlFor="auto-refresh" className="text-sm">
            Enable auto-refresh
          </label>
        </div>
      </div>
    </Card>
  ),
};

// Basic empty card
export const Basic: Story = {
  args: {
    children: 'Basic card content',
    className: 'p-4',
  },
};

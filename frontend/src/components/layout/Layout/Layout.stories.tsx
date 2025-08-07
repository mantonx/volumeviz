import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'jotai';
import { Layout } from './Layout';

const meta: Meta<typeof Layout> = {
  title: 'Layout/Layout',
  component: Layout,
  decorators: [
    (Story) => (
      <Provider>
        <div style={{ height: '100vh' }}>
          <Story />
        </div>
      </Provider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: `
Main application layout providing the core shell structure for VolumeViz.

**Features:**
- Responsive sidebar navigation (persistent on desktop, overlay on mobile)
- Top header with breadcrumbs and user actions
- Automatic dark/light theme management
- Consistent content spacing and typography
- Mobile-first responsive design

**Layout Structure:**
- Fixed sidebar (288px width on desktop)
- Header bar with mobile menu toggle
- Main content area with responsive padding
- Automatic theme class application to document root

Used as the wrapper for all authenticated application pages.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Layout>;

// Dashboard page example
export const DashboardPage: Story = {
  render: () => (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of your Docker volumes and containers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Volumes
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              24
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Active Containers
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              12
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Storage Used
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              15.2 GB
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Health Status
            </h3>
            <p className="text-2xl font-bold text-green-600">Healthy</p>
          </div>
        </div>
      </div>
    </Layout>
  ),
};

// Volumes page example
export const VolumesPage: Story = {
  render: () => (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Volumes
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your Docker volumes and storage
            </p>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Scan All Volumes
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="p-6">
            <div className="space-y-4">
              {['my-app-data', 'postgres-data', 'redis-cache'].map((volume) => (
                <div
                  key={volume}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {volume}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      local driver • 2.4 GB
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      Scan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  ),
};

// Settings page example
export const SettingsPage: Story = {
  render: () => (
    <Layout>
      <div className="max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configure VolumeViz preferences and API settings
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                API Configuration
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Base URL
                  </label>
                  <input
                    type="text"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    defaultValue="http://localhost:8080/api/v1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    defaultValue="10"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Theme
              </h2>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    className="mr-2"
                  />
                  Light
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    className="mr-2"
                  />
                  Dark
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="theme"
                    value="system"
                    className="mr-2"
                    defaultChecked
                  />
                  System
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  ),
};

// Custom content spacing example
export const CustomSpacing: Story = {
  render: () => (
    <Layout className="py-12">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Custom Spacing Example
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          This layout uses custom padding (py-12) instead of the default py-6
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-lg">
          <p className="text-blue-800 dark:text-blue-200">
            Content with extra vertical spacing for special pages
          </p>
        </div>
      </div>
    </Layout>
  ),
};

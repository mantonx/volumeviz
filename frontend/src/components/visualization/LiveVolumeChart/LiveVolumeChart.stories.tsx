import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
// Using console.log as a replacement for action since @storybook/test has version conflicts
const action =
  (name: string) =>
  (...args: any[]) =>
    console.log(`${name}:`, ...args);
import { Provider } from 'jotai';
import { LiveVolumeChart } from './LiveVolumeChart';
import type { Volume } from '../../../types/api';

const meta: Meta<typeof LiveVolumeChart> = {
  title: 'Visualization/LiveVolumeChart',
  component: LiveVolumeChart,
  decorators: [
    (Story) => (
      <Provider>
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
          <Story />
        </div>
      </Provider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: `
LiveVolumeChart provides real-time visualization of volume sizes with interactive features.

**Key Features:**
- Real-time updates with configurable refresh intervals
- Multiple chart types: donut, pie, and bar charts
- Interactive tooltips with detailed volume information
- Click-to-scan functionality on chart segments
- Automatic color assignment with consistent palette
- Performance optimizations with React.memo and useMemo
- Empty state handling with refresh functionality

**Use Cases:**
- Dashboard overview of volume usage
- Real-time monitoring during scan operations
- Visual comparison of volume sizes
- Interactive volume management interface
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock volume data
const mockVolumes: Volume[] = [
  {
    id: 'vol-1',
    name: 'postgres-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 5368709120, // 5GB
    mount_count: 1,
    labels: { 'com.docker.compose.project': 'database' },
    options: {},
  },
  {
    id: 'vol-2',
    name: 'redis-cache',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-cache/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 1073741824, // 1GB
    mount_count: 2,
    labels: { 'com.docker.compose.project': 'cache' },
    options: {},
  },
  {
    id: 'vol-3',
    name: 'app-logs',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/app-logs/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 2147483648, // 2GB
    mount_count: 3,
    labels: { 'com.docker.compose.project': 'logging' },
    options: {},
  },
  {
    id: 'vol-4',
    name: 'nginx-config',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/nginx-config/_data',
    created_at: '2024-01-12T07:00:00Z',
    size: 52428800, // 50MB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-5',
    name: 'shared-storage',
    driver: 'nfs',
    mount_point: '/mnt/nfs/shared',
    created_at: '2024-01-10T06:00:00Z',
    size: 10737418240, // 10GB
    mount_count: 5,
    labels: { type: 'shared' },
    options: { addr: '192.168.1.100', path: '/export/shared' },
  },
];

const smallDataset = mockVolumes.slice(0, 3);
const largeDataset = [
  ...mockVolumes,
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `vol-extra-${i + 6}`,
    name: `volume-${i + 6}`,
    driver: 'local' as const,
    mount_point: `/var/lib/docker/volumes/volume-${i + 6}/_data`,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    size: Math.floor(Math.random() * 5368709120),
    mount_count: Math.floor(Math.random() * 5),
    labels: {},
    options: {},
  })),
];

export const DonutChart: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'donut',
    size: 'md',
    showLegend: true,
    showTooltip: true,
    enableAnimation: true,
    onVolumeClick: action('volume-clicked'),
    onRefresh: action('refresh-data'),
  },
};

export const PieChart: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'pie',
    size: 'md',
    showLegend: true,
    showTooltip: true,
    enableAnimation: true,
    onVolumeClick: action('volume-clicked'),
    onRefresh: action('refresh-data'),
  },
};

export const BarChart: Story = {
  args: {
    volumes: smallDataset,
    variant: 'bar',
    size: 'md',
    showLegend: false,
    showTooltip: true,
    enableAnimation: true,
    onVolumeClick: action('volume-clicked'),
    onRefresh: action('refresh-data'),
  },
};

export const SmallSize: Story = {
  args: {
    volumes: smallDataset,
    variant: 'donut',
    size: 'sm',
    showLegend: true,
    showTooltip: true,
    onVolumeClick: action('volume-clicked'),
  },
};

export const LargeSize: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'donut',
    size: 'lg',
    showLegend: true,
    showTooltip: true,
    onVolumeClick: action('volume-clicked'),
  },
};

export const WithoutLegend: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'donut',
    size: 'md',
    showLegend: false,
    showTooltip: true,
    onVolumeClick: action('volume-clicked'),
  },
};

export const WithoutTooltip: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'donut',
    size: 'md',
    showLegend: true,
    showTooltip: false,
    onVolumeClick: action('volume-clicked'),
  },
};

export const LargeDataset: Story = {
  args: {
    volumes: largeDataset,
    variant: 'donut',
    size: 'md',
    showLegend: true,
    showTooltip: true,
    maxVolumes: 8,
    onVolumeClick: action('volume-clicked'),
    onRefresh: action('refresh-data'),
  },
};

export const EmptyState: Story = {
  args: {
    volumes: [],
    variant: 'donut',
    size: 'md',
    showLegend: true,
    showTooltip: true,
    onRefresh: action('refresh-data'),
  },
};

export const LiveUpdating: Story = {
  render: () => {
    const [volumes, setVolumes] = React.useState(mockVolumes);
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleRefresh = async () => {
      setIsUpdating(true);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Randomly update volume sizes
      const updatedVolumes = volumes.map((vol) => ({
        ...vol,
        size: vol.size + Math.floor((Math.random() - 0.5) * vol.size * 0.1), // ±10% change
      }));

      setVolumes(updatedVolumes);
      setIsUpdating(false);
    };

    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Live Updating Demo</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This demo shows real-time updates. Volume sizes change randomly when
            refreshed.
            {isUpdating && ' Updating...'}
          </p>
        </div>
        <LiveVolumeChart
          volumes={volumes}
          variant="donut"
          size="md"
          showLegend={true}
          showTooltip={true}
          refreshInterval={0} // Disable auto-refresh for manual demo
          onVolumeClick={action('volume-clicked')}
          onRefresh={handleRefresh}
        />
      </div>
    );
  },
};

export const AutoRefresh: Story = {
  args: {
    volumes: mockVolumes,
    variant: 'donut',
    size: 'md',
    showLegend: true,
    showTooltip: true,
    refreshInterval: 5000, // 5 seconds for demo
    onVolumeClick: action('volume-clicked'),
    onRefresh: action('auto-refresh-triggered'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates auto-refresh functionality with a 5-second interval.',
      },
    },
  },
};

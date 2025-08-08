import type { Meta, StoryObj } from '@storybook/react';
// Using console.log as a replacement for action since @storybook/addon-actions isn't available
const action =
  (name: string) =>
  (...args: any[]) =>
    console.log(`${name}:`, ...args);
import { TopVolumesWidget } from './TopVolumesWidget';
import type { Volume } from './TopVolumesWidget.types';

const meta = {
  title: 'Visualization/TopVolumesWidget',
  component: TopVolumesWidget,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Top volumes widget showing largest volumes with ranking indicators and interactive features.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    volumes: { control: false },
    maxVolumes: { control: 'number' },
    sortBy: {
      control: 'select',
      options: ['size', 'mount_count', 'created_at'],
    },
    sortOrder: {
      control: 'select',
      options: ['asc', 'desc'],
    },
    showIndicators: { control: 'boolean' },
    showDetails: { control: 'boolean' },
    enableRefresh: { control: 'boolean' },
    refreshInterval: { control: 'number' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    onRefresh: { action: 'refreshed' },
    onVolumeClick: { action: 'volume-clicked' },
    onVolumeScan: { action: 'volume-scanned' },
  },
} satisfies Meta<typeof TopVolumesWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock volume data with various sizes
const mockVolumes: Volume[] = [
  {
    id: 'vol-1',
    name: 'database-main',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/database-main/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 107374182400, // 100GB
    mount_count: 3,
    labels: {},
    options: {},
  },
  {
    id: 'vol-2',
    name: 'media-storage',
    driver: 'nfs',
    mount_point: '/mnt/nfs/media',
    created_at: '2024-01-14T09:00:00Z',
    size: 53687091200, // 50GB
    mount_count: 2,
    labels: {},
    options: {},
  },
  {
    id: 'vol-3',
    name: 'backup-archive',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/backup-archive/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 21474836480, // 20GB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-4',
    name: 'app-logs',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/app-logs/_data',
    created_at: '2024-01-12T07:00:00Z',
    size: 5368709120, // 5GB
    mount_count: 4,
    labels: {},
    options: {},
  },
  {
    id: 'vol-5',
    name: 'cache-redis',
    driver: 'tmpfs',
    mount_point: '/tmp/redis-cache',
    created_at: '2024-01-11T06:00:00Z',
    size: 1073741824, // 1GB
    mount_count: 2,
    labels: {},
    options: {},
  },
  {
    id: 'vol-6',
    name: 'config-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/config-data/_data',
    created_at: '2024-01-10T05:00:00Z',
    size: 536870912, // 512MB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-7',
    name: 'temp-workspace',
    driver: 'overlay',
    mount_point: '/var/lib/docker/overlay2/temp-workspace',
    created_at: '2024-01-09T04:00:00Z',
    size: 268435456, // 256MB
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: 'vol-8',
    name: 'small-config',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/small-config/_data',
    created_at: '2024-01-08T03:00:00Z',
    size: 52428800, // 50MB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-9',
    name: 'tiny-meta',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/tiny-meta/_data',
    created_at: '2024-01-07T02:00:00Z',
    size: 10485760, // 10MB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-10',
    name: 'minimal-data',
    driver: 'bind',
    mount_point: '/host/minimal',
    created_at: '2024-01-06T01:00:00Z',
    size: 1048576, // 1MB
    mount_count: 0,
    labels: {},
    options: {},
  },
];

export const Default: Story = {
  args: {
    volumes: mockVolumes,
    maxVolumes: 10,
    sortBy: 'size',
    sortOrder: 'desc',
    showIndicators: true,
    showDetails: true,
    enableRefresh: false,
    size: 'md',
    onRefresh: action('refresh-triggered'),
    onVolumeClick: action('volume-clicked'),
    onVolumeScan: action('volume-scanned'),
  },
};

export const Top5Volumes: Story = {
  args: {
    ...Default.args,
    maxVolumes: 5,
  },
  name: 'Top 5 Volumes',
};

export const SortByMounts: Story = {
  args: {
    ...Default.args,
    sortBy: 'mount_count',
    maxVolumes: 8,
  },
  name: 'Sorted by Mount Count',
};

export const SortByAge: Story = {
  args: {
    ...Default.args,
    sortBy: 'created_at',
    sortOrder: 'asc', // Oldest first
    maxVolumes: 6,
  },
  name: 'Sorted by Creation Date',
};

export const CompactView: Story = {
  args: {
    ...Default.args,
    size: 'sm',
    showDetails: false,
    maxVolumes: 8,
  },
  name: 'Compact Size',
};

export const LargeView: Story = {
  args: {
    ...Default.args,
    size: 'lg',
    maxVolumes: 5,
  },
  name: 'Large Size',
};

export const WithoutIndicators: Story = {
  args: {
    ...Default.args,
    showIndicators: false,
    maxVolumes: 7,
  },
  name: 'No Visual Indicators',
};

export const MinimalDetails: Story = {
  args: {
    ...Default.args,
    showDetails: false,
    showIndicators: false,
    maxVolumes: 6,
  },
  name: 'Minimal Information',
};

export const WithRefresh: Story = {
  args: {
    ...Default.args,
    enableRefresh: true,
    refreshInterval: 10000, // 10 seconds for demo
    maxVolumes: 6,
  },
  name: 'With Auto Refresh',
};

export const SmallVolumesOnly: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes.filter((vol) => (vol.size || 0) < 1073741824), // < 1GB
    maxVolumes: 8,
  },
  name: 'Small Volumes Only',
};

export const LargeVolumesOnly: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes.filter((vol) => (vol.size || 0) > 5368709120), // > 5GB
    maxVolumes: 4,
  },
  name: 'Large Volumes Only',
};

export const UnmountedVolumes: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes.filter((vol) => (vol.mount_count || 0) === 0),
    maxVolumes: 5,
  },
  name: 'Unmounted Volumes',
};

export const MixedDrivers: Story = {
  args: {
    ...Default.args,
    maxVolumes: 8,
  },
  name: 'Multiple Driver Types',
};

export const EmptyState: Story = {
  args: {
    ...Default.args,
    volumes: [],
  },
  name: 'No Volumes',
};

export const SingleVolume: Story = {
  args: {
    ...Default.args,
    volumes: [mockVolumes[0]],
    maxVolumes: 5,
  },
  name: 'Single Volume',
};

export const InteractiveDemo: Story = {
  args: {
    ...Default.args,
    enableRefresh: true,
    refreshInterval: 30000,
    maxVolumes: 7,
    onRefresh: async () => {
      action('refresh-triggered')();
      // Simulate async refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    onVolumeScan: async (volumeId: string) => {
      action('volume-scanned')(volumeId);
      // Simulate async scan
      await new Promise((resolve) => setTimeout(resolve, 2000));
    },
  },
  name: 'Interactive with Callbacks',
};

export const AscendingOrder: Story = {
  args: {
    ...Default.args,
    sortOrder: 'asc',
    maxVolumes: 6,
  },
  name: 'Smallest to Largest',
};

export const ExtendedList: Story = {
  args: {
    ...Default.args,
    maxVolumes: 15, // More than available
  },
  name: 'Extended List (All Volumes)',
};

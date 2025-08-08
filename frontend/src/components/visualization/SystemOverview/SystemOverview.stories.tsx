import type { Meta, StoryObj } from '@storybook/react';
// Using console.log as a replacement for action since @storybook/addon-actions isn't available
const action =
  (name: string) =>
  (...args: any[]) =>
    console.log(`${name}:`, ...args);
import { SystemOverview } from './SystemOverview';
import type { Volume } from './SystemOverview.types';

const meta = {
  title: 'Visualization/SystemOverview',
  component: SystemOverview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'System overview component showing total storage breakdown by drivers and size ranges with interactive charts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    volumes: { control: false },
    showBreakdown: { control: 'boolean' },
    enableRefresh: { control: 'boolean' },
    refreshInterval: { control: 'number' },
    height: { control: 'number' },
    onRefresh: { action: 'refreshed' },
    onDriverClick: { action: 'driver-clicked' },
    onVolumeClick: { action: 'volume-clicked' },
  },
} satisfies Meta<typeof SystemOverview>;

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
    labels: {},
    options: {},
  },
  {
    id: 'vol-2',
    name: 'redis-cache',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-cache/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 536870912, // 512MB
    mount_count: 2,
    labels: {},
    options: {},
  },
  {
    id: 'vol-3',
    name: 'app-logs',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/app-logs/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 104857600, // 100MB
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: 'vol-4',
    name: 'mysql-backup',
    driver: 'nfs',
    mount_point: '/mnt/nfs/mysql-backup',
    created_at: '2024-01-12T07:00:00Z',
    size: 21474836480, // 20GB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: 'vol-5',
    name: 'static-assets',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/static-assets/_data',
    created_at: '2024-01-11T06:00:00Z',
    size: 1073741824, // 1GB
    mount_count: 3,
    labels: {},
    options: {},
  },
  {
    id: 'vol-6',
    name: 'temp-storage',
    driver: 'tmpfs',
    mount_point: '/tmp/docker-temp',
    created_at: '2024-01-10T05:00:00Z',
    size: 268435456, // 256MB
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: 'vol-7',
    name: 'media-files',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/media-files/_data',
    created_at: '2024-01-09T04:00:00Z',
    size: 107374182400, // 100GB
    mount_count: 2,
    labels: {},
    options: {},
  },
];

const largeVolumeSet: Volume[] = [
  ...mockVolumes,
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `vol-${i + 8}`,
    name: `volume-${i + 8}`,
    driver: ['local', 'nfs', 'cifs', 'overlay'][i % 4],
    mount_point: `/var/lib/docker/volumes/volume-${i + 8}/_data`,
    created_at: `2024-01-${String(20 - i).padStart(2, '0')}T10:00:00Z`,
    size: Math.floor(Math.random() * 50 * 1024 * 1024 * 1024), // Random size up to 50GB
    mount_count: Math.floor(Math.random() * 5),
    labels: {},
    options: {},
  })),
];

export const Default: Story = {
  args: {
    volumes: mockVolumes,
    showBreakdown: true,
    enableRefresh: false,
    height: 600,
    onRefresh: action('refresh-triggered'),
    onDriverClick: action('driver-clicked'),
    onVolumeClick: action('volume-clicked'),
  },
};

export const OverviewMode: Story = {
  args: {
    ...Default.args,
  },
  name: 'Overview Mode',
};

export const WithRefresh: Story = {
  args: {
    ...Default.args,
    enableRefresh: true,
    refreshInterval: 10000, // 10 seconds for demo
  },
  name: 'With Auto Refresh',
};

export const CompactView: Story = {
  args: {
    ...Default.args,
    showBreakdown: false,
    height: 300,
  },
  name: 'Compact Statistics Only',
};

export const LargeDataset: Story = {
  args: {
    ...Default.args,
    volumes: largeVolumeSet,
    height: 700,
  },
  name: 'Large Volume Set',
};

export const SingleDriver: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes.filter((vol) => vol.driver === 'local'),
  },
  name: 'Single Driver Type',
};

export const MixedDrivers: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes,
  },
  name: 'Mixed Driver Types',
};

export const EmptyState: Story = {
  args: {
    ...Default.args,
    volumes: [],
  },
  name: 'No Volumes',
};

export const SmallVolumes: Story = {
  args: {
    ...Default.args,
    volumes: [
      {
        id: 'small-1',
        name: 'config-data',
        driver: 'local',
        mount_point: '/config',
        created_at: '2024-01-15T10:00:00Z',
        size: 1048576, // 1MB
        mount_count: 1,
        labels: {},
        options: {},
      },
      {
        id: 'small-2',
        name: 'log-buffer',
        driver: 'tmpfs',
        mount_point: '/tmp/logs',
        created_at: '2024-01-14T09:00:00Z',
        size: 10485760, // 10MB
        mount_count: 1,
        labels: {},
        options: {},
      },
      {
        id: 'small-3',
        name: 'cache',
        driver: 'local',
        mount_point: '/cache',
        created_at: '2024-01-13T08:00:00Z',
        size: 52428800, // 50MB
        mount_count: 2,
        labels: {},
        options: {},
      },
    ],
  },
  name: 'Small Volumes Only',
};

export const LargeVolumes: Story = {
  args: {
    ...Default.args,
    volumes: [
      {
        id: 'large-1',
        name: 'database-archive',
        driver: 'nfs',
        mount_point: '/mnt/nfs/archive',
        created_at: '2024-01-15T10:00:00Z',
        size: 536870912000, // 500GB
        mount_count: 1,
        labels: {},
        options: {},
      },
      {
        id: 'large-2',
        name: 'video-storage',
        driver: 'local',
        mount_point: '/media/videos',
        created_at: '2024-01-14T09:00:00Z',
        size: 1073741824000, // 1TB
        mount_count: 2,
        labels: {},
        options: {},
      },
      {
        id: 'large-3',
        name: 'backup-mirror',
        driver: 'cifs',
        mount_point: '/mnt/backup',
        created_at: '2024-01-13T08:00:00Z',
        size: 214748364800, // 200GB
        mount_count: 0,
        labels: {},
        options: {},
      },
    ],
  },
  name: 'Large Volumes Only',
};

export const InteractiveDemo: Story = {
  args: {
    ...Default.args,
    volumes: mockVolumes,
    enableRefresh: true,
    refreshInterval: 30000,
    onRefresh: async () => {
      action('refresh-triggered')();
      // Simulate async refresh
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
  },
  name: 'Interactive with Callbacks',
};

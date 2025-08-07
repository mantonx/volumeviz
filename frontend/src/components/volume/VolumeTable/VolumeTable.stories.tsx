import type { Meta, StoryObj } from '@storybook/react';
import { VolumeTable } from './VolumeTable';
import { Volume } from '../../../types/api';
import { useState } from 'react';

const meta = {
  title: 'Volume/VolumeTable',
  component: VolumeTable,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VolumeTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockVolumes: Volume[] = [
  {
    id: '1',
    name: 'postgres-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 5368709120, // 5GB
    mount_count: 1,
    labels: { 'com.docker.compose.project': 'myapp' },
    options: {},
  },
  {
    id: '2',
    name: 'redis-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-data/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 268435456, // 256MB
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: '3',
    name: 'shared-nfs',
    driver: 'nfs',
    mount_point: '/mnt/nfs/shared',
    created_at: '2024-01-10T08:00:00Z',
    size: 10737418240, // 10GB
    mount_count: 3,
    labels: {},
    options: { addr: '192.168.1.100', path: '/export/shared' },
  },
  {
    id: '4',
    name: 'backup-volume',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/backup-volume/_data',
    created_at: '2024-01-12T07:00:00Z',
    size: 0,
    mount_count: 0,
    labels: { backup: 'true' },
    options: {},
  },
  {
    id: '5',
    name: 'windows-share',
    driver: 'cifs',
    mount_point: '/mnt/cifs/windows',
    created_at: '2024-01-08T06:00:00Z',
    size: 2147483648, // 2GB
    mount_count: 2,
    labels: {},
    options: { username: 'user', domain: 'WORKGROUP' },
  },
];

export const Default: Story = {
  args: {
    volumes: mockVolumes,
  },
};

export const Loading: Story = {
  args: {
    volumes: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    volumes: [],
  },
};

export const WithSorting: Story = {
  render: () => {
    const [sortBy, setSortBy] = useState<
      'name' | 'size' | 'created' | 'driver' | 'mountCount'
    >('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: typeof sortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortOrder('asc');
      }
    };

    return (
      <VolumeTable
        volumes={mockVolumes}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
    );
  },
};

export const WithSelection: Story = {
  render: () => {
    const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);

    return (
      <div>
        <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded">
          Selected: {selectedVolumes.length} volume(s)
          {selectedVolumes.length > 0 && (
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              [{selectedVolumes.join(', ')}]
            </span>
          )}
        </div>
        <VolumeTable
          volumes={mockVolumes}
          showSelection
          selectedVolumes={selectedVolumes}
          onSelectionChange={setSelectedVolumes}
        />
      </div>
    );
  },
};

export const Interactive: Story = {
  render: () => {
    const [sortBy, setSortBy] = useState<
      'name' | 'size' | 'created' | 'driver' | 'mountCount'
    >('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);

    const handleSort = (column: typeof sortBy) => {
      if (column === sortBy) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(column);
        setSortOrder('asc');
      }
    };

    const handleRowClick = (volume: Volume) => {
      alert(`Clicked on volume: ${volume.name}`);
    };

    return (
      <div>
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Interactive Features:</h3>
          <ul className="text-sm space-y-1">
            <li>• Click column headers to sort</li>
            <li>• Click rows to view details (shows alert)</li>
            <li>• Use checkboxes to select volumes</li>
          </ul>
        </div>
        <VolumeTable
          volumes={mockVolumes}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onRowClick={handleRowClick}
          showSelection
          selectedVolumes={selectedVolumes}
          onSelectionChange={setSelectedVolumes}
        />
      </div>
    );
  },
};

export const LargeDataset: Story = {
  args: {
    volumes: Array.from({ length: 50 }, (_, i) => ({
      id: `vol-${i}`,
      name: `volume-${i.toString().padStart(3, '0')}`,
      driver: ['local', 'nfs', 'cifs'][i % 3] as any,
      mount_point: `/var/lib/docker/volumes/volume-${i}/_data`,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      size: Math.floor(Math.random() * 10737418240),
      mount_count: Math.floor(Math.random() * 10),
      labels: {},
      options: {},
    })),
  },
};

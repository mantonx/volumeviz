import type { Meta, StoryObj } from '@storybook/react';
import { VolumeList } from './VolumeList';
import { Volume } from '../../../types/api';
import { Provider } from 'jotai';
import { useState } from 'react';

const meta = {
  title: 'Volume/VolumeList',
  component: VolumeList,
  parameters: {
    layout: 'fullscreen',
    padding: '2rem',
  },
  decorators: [
    (Story) => (
      <Provider>
        <div className="p-6">
          <Story />
        </div>
      </Provider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof VolumeList>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockVolumes: Volume[] = [
  {
    id: '1',
    name: 'postgres-data',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/postgres-data/_data',
    created_at: '2024-01-15T10:00:00Z',
    size: 5368709120,
    mount_count: 1,
    labels: { 'com.docker.compose.project': 'myapp' },
    options: {},
  },
  {
    id: '2',
    name: 'redis-cache',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/redis-cache/_data',
    created_at: '2024-01-14T09:00:00Z',
    size: 268435456,
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: '3',
    name: 'app-logs',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/app-logs/_data',
    created_at: '2024-01-13T08:00:00Z',
    size: 1073741824,
    mount_count: 0,
    labels: {},
    options: {},
  },
  {
    id: '4',
    name: 'nginx-config',
    driver: 'local',
    mount_point: '/var/lib/docker/volumes/nginx-config/_data',
    created_at: '2024-01-12T07:00:00Z',
    size: 52428800,
    mount_count: 1,
    labels: {},
    options: {},
  },
  {
    id: '5',
    name: 'shared-data',
    driver: 'nfs',
    mount_point: '/mnt/nfs/shared',
    created_at: '2024-01-10T06:00:00Z',
    size: 10737418240,
    mount_count: 3,
    labels: {},
    options: { addr: '192.168.1.100', path: '/export/shared' },
  },
];

const largeVolumeSet = Array.from({ length: 25 }, (_, i) => ({
  id: `vol-${i + 1}`,
  name: `volume-${i + 1}`,
  driver: ['local', 'nfs', 'cifs'][i % 3] as any,
  mount_point: `/var/lib/docker/volumes/volume-${i + 1}/_data`,
  created_at: new Date(Date.now() - i * 86400000).toISOString(),
  size: Math.floor(Math.random() * 10737418240),
  mount_count: Math.floor(Math.random() * 5),
  labels: {},
  options: {},
}));

export const Default: Story = {
  args: {
    volumes: mockVolumes,
  },
};

export const GridLayout: Story = {
  args: {
    volumes: mockVolumes,
    layout: 'grid',
  },
};

export const ListLayout: Story = {
  args: {
    volumes: mockVolumes,
    layout: 'list',
  },
};

export const CompactLayout: Story = {
  args: {
    volumes: mockVolumes,
    layout: 'compact',
  },
};

export const WithPagination: Story = {
  args: {
    volumes: largeVolumeSet,
    pageSize: 8,
    currentPage: 1,
    onPageChange: (page: number) => console.log('Page changed to:', page),
  },
};

export const InteractivePagination: Story = {
  render: () => {
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6;

    return (
      <div>
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Interactive Pagination</h3>
          <p className="text-sm">
            Current page: <strong>{currentPage}</strong> | Page size:{' '}
            <strong>{pageSize}</strong>
          </p>
        </div>
        <VolumeList
          volumes={largeVolumeSet}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onVolumeAction={(action, volumeId) => {
            console.log(`Action: ${action} on volume: ${volumeId}`);
          }}
        />
      </div>
    );
  },
};

export const EmptyState: Story = {
  args: {
    volumes: [],
  },
};

export const EmptyStateWithAction: Story = {
  args: {
    volumes: [],
    emptyStateMessage: 'No volumes match your filters',
    emptyStateAction: (
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Clear Filters
      </button>
    ),
  },
};

export const LoadingState: Story = {
  render: () => {
    // Simulate loading by showing empty volumes with loading from atom
    return (
      <div>
        <p className="mb-4 text-sm text-gray-600">
          Simulated loading state (check VolumeList implementation for actual
          loading from atoms)
        </p>
        <VolumeList volumes={[]} />
      </div>
    );
  },
};

export const SingleVolume: Story = {
  args: {
    volumes: [mockVolumes[0]],
  },
};

export const NoPagination: Story = {
  args: {
    volumes: mockVolumes,
    showPagination: false,
  },
};

export const CustomPageSize: Story = {
  render: () => {
    const [pageSize, setPageSize] = useState(4);
    const [currentPage, setCurrentPage] = useState(1);

    return (
      <div>
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <label className="block text-sm font-medium mb-2">
            Page Size: {pageSize}
          </label>
          <input
            type="range"
            min="2"
            max="10"
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1); // Reset to first page
            }}
            className="w-full"
          />
        </div>
        <VolumeList
          volumes={largeVolumeSet.slice(0, 15)}
          pageSize={pageSize}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
    );
  },
};

export const AllLayouts: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Grid Layout</h3>
        <VolumeList volumes={mockVolumes.slice(0, 4)} layout="grid" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">List Layout</h3>
        <VolumeList volumes={mockVolumes.slice(0, 3)} layout="list" />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Compact Layout</h3>
        <VolumeList volumes={mockVolumes} layout="compact" />
      </div>
    </div>
  ),
};

export const WithActions: Story = {
  args: {
    volumes: mockVolumes,
    onVolumeAction: (action: string, volumeId: string) => {
      switch (action) {
        case 'scan':
          alert(`Scanning volume: ${volumeId}`);
          break;
        case 'manage':
          alert(`Managing volume: ${volumeId}`);
          break;
        case 'details':
          alert(`Viewing details for: ${volumeId}`);
          break;
        default:
          console.log(`Action: ${action} on volume: ${volumeId}`);
      }
    },
  },
};

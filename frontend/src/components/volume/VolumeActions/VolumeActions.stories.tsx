import type { Meta, StoryObj } from '@storybook/react';
import { VolumeActions, VolumeAction } from './VolumeActions';
import { Volume } from '../../../types/api';
import { Eye, Download, Trash2 } from 'lucide-react';

const meta = {
  title: 'Volume/VolumeActions',
  component: VolumeActions,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VolumeActions>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockVolume: Volume = {
  id: 'postgres-data',
  name: 'postgres-data',
  driver: 'local',
  mount_point: '/var/lib/docker/volumes/postgres-data/_data',
  created_at: '2024-01-15T10:00:00Z',
  size: 5368709120,
  mount_count: 1,
  labels: {},
  options: {},
};

export const Default: Story = {
  args: {
    volume: mockVolume,
    onAction: (actionId, volume) => {
      console.log(`Action: ${actionId}`, volume);
    },
  },
};

export const InlineVariant: Story = {
  args: {
    volume: mockVolume,
    variant: 'inline',
    onAction: (actionId, volume) => {
      console.log(`Action: ${actionId}`, volume);
    },
  },
};

export const MenuVariant: Story = {
  args: {
    volume: mockVolume,
    variant: 'menu',
    onAction: (actionId, volume) => {
      console.log(`Action: ${actionId}`, volume);
    },
  },
};

export const CustomActions: Story = {
  args: {
    volume: mockVolume,
    actions: [
      { id: 'view', label: 'View', icon: <Eye className="w-4 h-4" /> },
      {
        id: 'download',
        label: 'Download',
        icon: <Download className="w-4 h-4" />,
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        variant: 'danger',
      },
    ],
    onAction: (actionId, volume) => {
      alert(`Action: ${actionId} on volume: ${volume.name}`);
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div>
        <p className="text-sm text-gray-600 mb-2">Small</p>
        <VolumeActions
          volume={mockVolume}
          size="sm"
          onAction={(actionId) => console.log(actionId)}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Medium</p>
        <VolumeActions
          volume={mockVolume}
          size="md"
          onAction={(actionId) => console.log(actionId)}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Large</p>
        <VolumeActions
          volume={mockVolume}
          size="lg"
          onAction={(actionId) => console.log(actionId)}
        />
      </div>
    </div>
  ),
};

export const WithDisabledActions: Story = {
  args: {
    volume: mockVolume,
    actions: [
      { id: 'view', label: 'View Details', icon: <Eye className="w-4 h-4" /> },
      {
        id: 'download',
        label: 'Export (Coming Soon)',
        icon: <Download className="w-4 h-4" />,
        disabled: true,
      },
      {
        id: 'delete',
        label: 'Delete (Protected)',
        icon: <Trash2 className="w-4 h-4" />,
        variant: 'danger',
        disabled: true,
      },
    ],
    onAction: (actionId, volume) => {
      console.log(`Action: ${actionId}`, volume);
    },
  },
};

export const InVolumeCard: Story = {
  render: () => (
    <div className="w-96 p-4 border rounded-lg">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">postgres-data</h3>
          <p className="text-sm text-gray-600 mt-1">Local driver • 5.0 GB</p>
        </div>
        <VolumeActions
          volume={mockVolume}
          onAction={(actionId) => {
            if (actionId === 'delete') {
              if (confirm('Delete this volume?')) {
                console.log('Deleting volume...');
              }
            } else {
              console.log(`Action: ${actionId}`);
            }
          }}
        />
      </div>
    </div>
  ),
};

export const InTableRow: Story = {
  render: () => (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="text-left p-3">Volume</th>
          <th className="text-left p-3">Size</th>
          <th className="text-left p-3">Driver</th>
          <th className="text-right p-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b hover:bg-gray-50">
          <td className="p-3">postgres-data</td>
          <td className="p-3">5.0 GB</td>
          <td className="p-3">local</td>
          <td className="p-3 text-right">
            <VolumeActions
              volume={mockVolume}
              onAction={(actionId) => console.log(actionId)}
            />
          </td>
        </tr>
      </tbody>
    </table>
  ),
};

export const InlineInToolbar: Story = {
  render: () => (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Volume Details: postgres-data</h2>
        <VolumeActions
          volume={mockVolume}
          variant="inline"
          actions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: <Eye className="w-4 h-4" />,
            },
            {
              id: 'download',
              label: 'Export',
              icon: <Download className="w-4 h-4" />,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4" />,
              variant: 'danger',
            },
          ]}
          onAction={(actionId) => console.log(actionId)}
        />
      </div>
      <div className="space-y-2 text-sm">
        <p>
          <strong>Size:</strong> 5.0 GB
        </p>
        <p>
          <strong>Mount Count:</strong> 1
        </p>
        <p>
          <strong>Created:</strong> 2 days ago
        </p>
      </div>
    </div>
  ),
};

export const MenuInSidebar: Story = {
  render: () => (
    <div className="w-64 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-4">Volume Actions</h3>
      <VolumeActions
        volume={mockVolume}
        variant="menu"
        onAction={(actionId) => {
          switch (actionId) {
            case 'view':
              alert('Opening volume details...');
              break;
            case 'scan':
              alert('Starting volume scan...');
              break;
            case 'delete':
              if (confirm('Delete this volume?')) {
                alert('Volume deleted');
              }
              break;
            default:
              alert(`Action: ${actionId}`);
          }
        }}
      />
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'jotai';
import { VolumeCard } from './VolumeCard';
import type { VolumeData } from './VolumeCard.types';

const meta: Meta<typeof VolumeCard> = {
  title: 'Volume/VolumeCard',
  component: VolumeCard,
  decorators: [
    (Story) => (
      <Provider>
        <div className="max-w-sm">
          <Story />
        </div>
      </Provider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: `
VolumeCard is the primary component for displaying Docker volume information throughout VolumeViz.

**Key Features:**
- Volume identification with name, ID, and driver type
- Real-time size information from scanning operations  
- Status indicators (active/inactive) with appropriate styling
- Container usage count and relationships
- Quick action buttons for common operations
- Metadata labels display with truncation
- Responsive design with hover states
- Size color coding for quick visual assessment

**Usage Patterns:**
- Grid layouts on volumes dashboard
- Search result displays
- Detail page summaries
- Embedded volume references

**Variants:**
- **Default**: Standard information density for most use cases
- **Compact**: Minimal display for dense grids and mobile
- **Detailed**: Full metadata including labels and mount points
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'compact', 'detailed'],
      description: 'Visual variant controlling information density',
    },
    showQuickActions: {
      control: 'boolean',
      description: 'Whether to show action buttons at bottom',
    },
  },
};

export default meta;
type Story = StoryObj<typeof VolumeCard>;

// Sample volume data for stories
const activeVolume: VolumeData = {
  id: 'vol_a1b2c3d4',
  name: 'my-app-data',
  driver: 'local',
  isActive: true,
  containerCount: 3,
  mountpoint: '/var/lib/docker/volumes/my-app-data/_data',
  labels: {
    app: 'myapp',
    environment: 'production',
    version: '1.2.3',
    team: 'backend',
  },
  createdAt: '2024-01-15T10:30:00Z',
};

const inactiveVolume: VolumeData = {
  id: 'vol_x9y8z7w6',
  name: 'old-cache-data',
  driver: 'local',
  isActive: false,
  containerCount: 0,
  mountpoint: '/var/lib/docker/volumes/old-cache-data/_data',
  labels: {
    app: 'legacy-app',
    deprecated: 'true',
  },
  createdAt: '2023-08-22T14:15:00Z',
};

const largeVolume: VolumeData = {
  id: 'vol_l4rg3d4t4',
  name: 'postgres-database',
  driver: 'local',
  isActive: true,
  containerCount: 1,
  mountpoint: '/var/lib/docker/volumes/postgres-database/_data',
  labels: {
    app: 'postgres',
    database: 'production',
    backup: 'enabled',
    retention: '30d',
    encryption: 'enabled',
    replicated: 'true',
  },
  createdAt: '2024-02-01T09:00:00Z',
};

const nfsVolume: VolumeData = {
  id: 'vol_nfs12345',
  name: 'shared-storage',
  driver: 'nfs',
  isActive: true,
  containerCount: 5,
  mountpoint: '/mnt/nfs/shared-storage',
  labels: {
    driver: 'nfs',
    server: '192.168.1.100',
    path: '/exports/shared',
  },
  createdAt: '2024-01-10T16:45:00Z',
};

// Standard active volume
export const Default: Story = {
  args: {
    volume: activeVolume,
  },
};

// Inactive volume with different styling
export const Inactive: Story = {
  args: {
    volume: inactiveVolume,
  },
};

// Compact variant for dense layouts
export const Compact: Story = {
  args: {
    volume: activeVolume,
    variant: 'compact',
  },
};

// Detailed variant showing all metadata
export const Detailed: Story = {
  args: {
    volume: largeVolume,
    variant: 'detailed',
  },
};

// Volume with NFS driver
export const NFSDriver: Story = {
  args: {
    volume: nfsVolume,
  },
};

// Without quick actions
export const NoActions: Story = {
  args: {
    volume: activeVolume,
    showQuickActions: false,
  },
};

// Long volume name truncation
export const LongName: Story = {
  args: {
    volume: {
      ...activeVolume,
      name: 'very-long-volume-name-that-should-be-truncated-in-the-display',
    },
  },
};

// Volume with many labels (detailed view)
export const ManyLabels: Story = {
  args: {
    volume: {
      ...activeVolume,
      labels: {
        app: 'myapp',
        environment: 'production',
        version: '1.2.3',
        team: 'backend',
        service: 'api',
        region: 'us-east-1',
        backup: 'enabled',
        monitoring: 'enabled',
        security: 'high',
        compliance: 'gdpr',
      },
    },
    variant: 'detailed',
  },
};

// Minimal volume with no optional data
export const Minimal: Story = {
  args: {
    volume: {
      id: 'vol_minimal',
      driver: 'local',
    },
  },
};

// Interactive example with all callbacks
export const Interactive: Story = {
  args: {
    volume: activeVolume,
    onScan: () => console.log('Scan clicked'),
    onManage: () => console.log('Manage clicked'),
    onViewDetails: () => console.log('Details clicked'),
  },
};

// Size comparison showcase
export const SizeComparison: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VolumeCard
        volume={{
          ...activeVolume,
          name: 'small-volume',
        }}
      />
      <VolumeCard
        volume={{
          ...activeVolume,
          name: 'large-volume',
        }}
      />
    </div>
  ),
};

// Status states showcase
export const StatusStates: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VolumeCard volume={activeVolume} />
      <VolumeCard volume={inactiveVolume} />
    </div>
  ),
};

// Driver types showcase
export const DriverTypes: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <VolumeCard volume={activeVolume} />
      <VolumeCard volume={nfsVolume} />
      <VolumeCard
        volume={{
          ...activeVolume,
          name: 'ceph-volume',
          driver: 'ceph',
        }}
      />
    </div>
  ),
};

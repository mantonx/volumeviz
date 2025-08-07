import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: {
    docs: {
      description: {
        component: `
Badge component for status indicators and labels throughout VolumeViz.

**Common Usage Patterns:**
- Volume status: Active (success), Inactive (outline)
- Container health: Healthy (success), Unhealthy (error)  
- Scan status: Scanning (warning), Complete (success), Failed (error)
- Docker drivers: local (secondary), nfs (secondary), etc.
- API status: Connected (success), Disconnected (error)
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'success',
        'warning',
        'error',
        'outline',
      ],
      description: 'Visual variant with semantic meaning',
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// Volume status examples
export const VolumeActive: Story = {
  args: {
    variant: 'success',
    children: 'Active',
  },
};

export const VolumeInactive: Story = {
  args: {
    variant: 'outline',
    children: 'Inactive',
  },
};

// Container health examples
export const ContainerHealthy: Story = {
  args: {
    variant: 'success',
    children: 'Healthy',
  },
};

export const ContainerUnhealthy: Story = {
  args: {
    variant: 'error',
    children: 'Unhealthy',
  },
};

// Scan status examples
export const ScanScanning: Story = {
  args: {
    variant: 'warning',
    children: 'Scanning...',
  },
};

export const ScanComplete: Story = {
  args: {
    variant: 'success',
    children: 'Complete',
  },
};

export const ScanFailed: Story = {
  args: {
    variant: 'error',
    children: 'Failed',
  },
};

// Docker driver examples
export const DriverLocal: Story = {
  args: {
    variant: 'secondary',
    children: 'local',
  },
};

export const DriverNFS: Story = {
  args: {
    variant: 'secondary',
    children: 'nfs',
  },
};

// API status examples
export const ApiConnected: Story = {
  args: {
    variant: 'success',
    children: 'Connected',
  },
};

export const ApiDisconnected: Story = {
  args: {
    variant: 'error',
    children: 'Disconnected',
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="space-x-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

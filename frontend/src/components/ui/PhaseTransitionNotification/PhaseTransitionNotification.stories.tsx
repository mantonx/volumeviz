import type { Meta, StoryObj } from '@storybook/react';
import { PhaseTransitionNotification } from './PhaseTransitionNotification';
import {
  createPhaseTransition,
  type PhaseTransition,
} from '../../../utils/phaseTransitionNotifications';

const meta = {
  title: 'UI/PhaseTransitionNotification',
  component: PhaseTransitionNotification,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
**PhaseTransitionNotification** provides beautiful, informative notifications when scan phases transition.

Key features:
- **Visual phase indicators** - Icons and colors for each phase type
- **Contextual messaging** - Clear descriptions of what's happening
- **Performance insights** - Duration and statistics from previous phase
- **Interactive details** - Expandable sections with comprehensive information
- **Auto-dismiss options** - Configurable timeout behavior
- **Multiple variants** - Toast, inline, and modal presentations

Perfect for keeping users informed about scan progress transitions.
        `.trim(),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showDetails: {
      control: 'boolean',
      description: 'Show detailed stats by default',
    },
    autoDismiss: {
      control: 'boolean',
      description: 'Auto-dismiss notification after timeout',
    },
    dismissTimeout: {
      control: 'number',
      description: 'Auto-dismiss timeout in milliseconds',
    },
    variant: {
      control: 'select',
      options: ['toast', 'inline', 'modal'],
      description: 'Presentation variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether notification can be dismissed',
    },
  },
} satisfies Meta<typeof PhaseTransitionNotification>;

export default meta;
type Story = StoryObj<typeof meta>;

const createMockTransition = (
  fromPhase: string | null,
  toPhase: string,
  options: {
    volumeName?: string;
    duration?: number;
    filesProcessed?: number;
    bytesProcessed?: number;
    errorsEncountered?: number;
    averageSpeed?: number;
    peakSpeed?: number;
  } = {},
): PhaseTransition => {
  return createPhaseTransition('scan-123', 'vol-456', fromPhase, toPhase, {
    volumeName: options.volumeName || 'Media Library',
    duration: options.duration,
    metadata: {
      filesProcessed: options.filesProcessed,
      bytesProcessed: options.bytesProcessed,
      errorsEncountered: options.errorsEncountered,
      performance: options.averageSpeed
        ? {
            averageSpeed: options.averageSpeed,
            peakSpeed: options.peakSpeed || options.averageSpeed * 1.5,
          }
        : undefined,
    },
  });
};

export const StartingVolumeScan: Story = {
  args: {
    transition: createMockTransition(null, 'volume_scan', {
      volumeName: 'External Drive',
    }),
    showDetails: false,
    variant: 'toast',
    size: 'md',
    dismissible: true,
    autoDismiss: false,
  },
};

export const VolumeToFilesystemTransition: Story = {
  args: {
    transition: createMockTransition('volume_scan', 'filesystem_indexing', {
      volumeName: 'Media Library',
      duration: 75000, // 1 minute 15 seconds
      filesProcessed: 1,
      bytesProcessed: 2048576000000, // 2TB
    }),
    showDetails: true,
    variant: 'toast',
    size: 'md',
    dismissible: true,
  },
};

export const FilesystemToMediaTransition: Story = {
  args: {
    transition: createMockTransition(
      'filesystem_indexing',
      'media_enrichment',
      {
        volumeName: 'TV Shows Collection',
        duration: 840000, // 14 minutes
        filesProcessed: 125000,
        bytesProcessed: 1843200000000, // 1.84TB
        errorsEncountered: 23,
        averageSpeed: 148.8,
        peakSpeed: 220.5,
      },
    ),
    showDetails: true,
    variant: 'toast',
    size: 'md',
    dismissible: true,
  },
};

export const FastVolumeCompletion: Story = {
  args: {
    transition: createMockTransition('volume_scan', 'filesystem_indexing', {
      volumeName: 'SSD Storage',
      duration: 45000, // 45 seconds - very fast
      filesProcessed: 1,
      bytesProcessed: 512000000000, // 512GB
      averageSpeed: 1000, // Very fast
    }),
    showDetails: true,
    variant: 'toast',
    size: 'md',
  },
};

export const LargeMediaLibraryTransition: Story = {
  args: {
    transition: createMockTransition(
      'filesystem_indexing',
      'media_enrichment',
      {
        volumeName: 'Movie Archive (8TB)',
        duration: 1800000, // 30 minutes - large scan
        filesProcessed: 500000,
        bytesProcessed: 8796093022208, // 8TB
        errorsEncountered: 145,
        averageSpeed: 277.8,
        peakSpeed: 420.2,
      },
    ),
    showDetails: true,
    variant: 'inline',
    size: 'lg',
  },
};

export const TransitionWithErrors: Story = {
  args: {
    transition: createMockTransition('volume_scan', 'filesystem_indexing', {
      volumeName: 'Network Storage',
      duration: 240000, // 4 minutes
      filesProcessed: 1,
      bytesProcessed: 1024000000000, // 1TB
      errorsEncountered: 5,
      averageSpeed: 45.2, // Slower due to network
    }),
    showDetails: true,
    variant: 'toast',
    size: 'md',
  },
};

export const CompactNotification: Story = {
  args: {
    transition: createMockTransition(
      'filesystem_indexing',
      'media_enrichment',
      {
        volumeName: 'Photos',
        duration: 120000, // 2 minutes
        filesProcessed: 25000,
        bytesProcessed: 104857600000, // 100GB
        averageSpeed: 208.3,
      },
    ),
    showDetails: false,
    variant: 'inline',
    size: 'sm',
    dismissible: false,
  },
};

export const AutoDismissingToast: Story = {
  args: {
    transition: createMockTransition('volume_scan', 'filesystem_indexing'),
    autoDismiss: true,
    dismissTimeout: 3000,
    variant: 'toast',
    showDetails: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'This notification will automatically dismiss after 3 seconds.',
      },
    },
  },
};

export const ModalStyleNotification: Story = {
  args: {
    transition: createMockTransition(
      'filesystem_indexing',
      'media_enrichment',
      {
        volumeName: 'Complete Media Collection',
        duration: 900000, // 15 minutes
        filesProcessed: 75000,
        bytesProcessed: 3298534883328, // 3TB
        errorsEncountered: 8,
        averageSpeed: 83.3,
        peakSpeed: 125.7,
      },
    ),
    showDetails: true,
    variant: 'modal',
    size: 'lg',
    dismissible: true,
  },
  parameters: {
    layout: 'centered',
  },
};

export const PerfectScanTransition: Story = {
  args: {
    transition: createMockTransition(
      'filesystem_indexing',
      'media_enrichment',
      {
        volumeName: 'Curated Collection',
        duration: 480000, // 8 minutes
        filesProcessed: 50000,
        bytesProcessed: 2147483648000, // 2TB
        errorsEncountered: 0, // Perfect scan
        averageSpeed: 104.2,
        peakSpeed: 158.3,
      },
    ),
    showDetails: true,
    variant: 'toast',
    size: 'md',
  },
};

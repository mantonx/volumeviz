import type { Meta, StoryObj } from '@storybook/react';
import { TimelineOverlay } from './TimelineOverlay';

const meta = {
  title: 'Domain/Explorer/TimelineOverlay',
  component: TimelineOverlay,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isVisible: {
      control: { type: 'boolean' },
    },
    volumeId: {
      control: { type: 'text' },
    },
    path: {
      control: { type: 'text' },
    },
    timeRangeDays: {
      control: { type: 'number', min: 1, max: 365 },
    },
  },
} satisfies Meta<typeof TimelineOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isVisible: true,
    volumeId: 'project-files',
    path: '/workspace',
    timeRangeDays: 30,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const MediaLibrary: Story = {
  args: {
    isVisible: true,
    volumeId: 'media-library',
    path: '/photos',
    timeRangeDays: 90,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const DocumentStorage: Story = {
  args: {
    isVisible: true,
    volumeId: 'document-storage',
    path: '/documents',
    timeRangeDays: 14,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const BackupDrive: Story = {
  args: {
    isVisible: true,
    volumeId: 'backup-drive',
    path: '/',
    timeRangeDays: 180,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const RecentActivity: Story = {
  args: {
    isVisible: true,
    volumeId: 'work-files',
    path: '/projects',
    timeRangeDays: 7,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const LongTermAnalysis: Story = {
  args: {
    isVisible: true,
    volumeId: 'archive-storage',
    path: '/archive',
    timeRangeDays: 365,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const TempFolder: Story = {
  args: {
    isVisible: true,
    volumeId: 'system-drive',
    path: '/temp',
    timeRangeDays: 3,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const Hidden: Story = {
  args: {
    isVisible: false,
    volumeId: 'project-files',
    path: '/workspace',
    timeRangeDays: 30,
    onClose: () => console.log('Close timeline'),
    onFileClick: (event) => console.log('File clicked:', event),
    onTimeRangeChange: (start, end) =>
      console.log('Time range changed:', { start, end }),
  },
};

export const InteractiveDemo: Story = {
  args: {
    isVisible: true,
    volumeId: 'demo-volume',
    path: '/demo',
    timeRangeDays: 30,
    onClose: () => {
      console.log('Timeline overlay closed');
      // In a real app, this would update state to hide the overlay
    },
    onFileClick: (event) => {
      console.log('Timeline event clicked:', {
        file: event.fileName,
        type: event.type,
        timestamp: event.timestamp,
        path: event.filePath,
      });
      // In a real app, this might navigate to the file or show details
    },
    onTimeRangeChange: (start, end) => {
      console.log('Timeline range changed:', {
        start: start.toISOString(),
        end: end.toISOString(),
        daysSpan: Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        ),
      });
      // In a real app, this would trigger data reload for the new range
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen">
        <div className="p-4 bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Interactive timeline overlay - try the playback controls and
            different views
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

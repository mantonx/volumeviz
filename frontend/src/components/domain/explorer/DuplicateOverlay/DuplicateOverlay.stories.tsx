import type { Meta, StoryObj } from '@storybook/react';
import { DuplicateOverlay } from './DuplicateOverlay';

const meta = {
  title: 'Domain/Explorer/DuplicateOverlay',
  component: DuplicateOverlay,
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
    minSize: {
      control: { type: 'number' },
    },
    maxSize: {
      control: { type: 'number' },
    },
    includeEmpty: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof DuplicateOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isVisible: true,
    volumeId: 'media-library',
    path: '/photos',
    minSize: 0,
    maxSize: 0,
    includeEmpty: false,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const LargeVolume: Story = {
  args: {
    isVisible: true,
    volumeId: 'backup-drive',
    path: '/',
    minSize: 1048576, // 1MB
    maxSize: 0,
    includeEmpty: false,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const PhotoLibrary: Story = {
  args: {
    isVisible: true,
    volumeId: 'photo-library',
    path: '/family-photos',
    minSize: 100000, // 100KB
    maxSize: 50000000, // 50MB
    includeEmpty: false,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const VideoCollection: Story = {
  args: {
    isVisible: true,
    volumeId: 'video-storage',
    path: '/movies',
    minSize: 10485760, // 10MB
    maxSize: 0,
    includeEmpty: false,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const IncludeEmptyFiles: Story = {
  args: {
    isVisible: true,
    volumeId: 'temp-drive',
    path: '/temp',
    minSize: 0,
    maxSize: 0,
    includeEmpty: true,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const DocumentLibrary: Story = {
  args: {
    isVisible: true,
    volumeId: 'document-storage',
    path: '/documents',
    minSize: 1024, // 1KB
    maxSize: 10485760, // 10MB
    includeEmpty: false,
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const Hidden: Story = {
  args: {
    isVisible: false,
    volumeId: 'media-library',
    path: '/photos',
    onClose: () => console.log('Close overlay'),
    onFileAction: (action, files) => console.log(`Action: ${action}`, files),
  },
};

export const InteractiveDemo: Story = {
  args: {
    isVisible: true,
    volumeId: 'demo-volume',
    path: '/demo-files',
    minSize: 0,
    maxSize: 0,
    includeEmpty: false,
    onClose: () => {
      console.log('Overlay closed');
      // In a real app, this would update state to hide the overlay
    },
    onFileAction: (action, files) => {
      console.log(`File action requested: ${action}`);
      console.log(
        'Selected files:',
        files.map((f) => f.path),
      );
      // In a real app, this would trigger the appropriate file operations
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen">
        <div className="p-4 bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Interactive duplicate detection overlay - check the console for
            action logs
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

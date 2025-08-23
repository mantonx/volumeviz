import type { Meta, StoryObj } from '@storybook/react';
import { MultiPhaseProgressBar } from './MultiPhaseProgressBar';
import type { ComprehensiveScanProgress } from './MultiPhaseProgressBar.types';

const meta: Meta<typeof MultiPhaseProgressBar> = {
  title: 'UI/MultiPhaseProgressBar',
  component: MultiPhaseProgressBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A comprehensive progress bar component for displaying multi-phase scan progress with real-time WebSocket updates.',
      },
    },
  },
  argTypes: {
    volumeId: {
      control: 'text',
      description: 'Unique identifier for the volume being scanned',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Display size variant',
    },
    showPhaseDescriptions: {
      control: 'boolean',
      description: 'Whether to show phase descriptions',
    },
    showDetailedMetrics: {
      control: 'boolean',
      description: 'Whether to show detailed progress metrics',
    },
    showErrors: {
      control: 'boolean',
      description: 'Whether to show recent errors',
    },
    animated: {
      control: 'boolean',
      description: 'Whether to animate progress changes',
    },
    compact: {
      control: 'boolean',
      description: 'Compact mode - show only essential information',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiPhaseProgressBar>;

// Mock WebSocket provider for Storybook
const mockWebSocketConnection = {
  isConnected: true,
  on: () => {},
  state: { status: 'connected' },
};

jest.mock('../../../providers/WebSocketProvider', () => ({
  useWebSocket: () => mockWebSocketConnection,
}));

export const Default: Story = {
  args: {
    volumeId: 'test-volume-1',
    size: 'md',
    showPhaseDescriptions: true,
    showDetailedMetrics: false,
    showErrors: true,
    animated: true,
    compact: false,
  },
};

export const VolumeScanning: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-scanning',
  },
  parameters: {
    mockData: {
      scan_id: 'scan-123',
      volume_id: 'volume-scanning',
      overall_status: 'running',
      overall_progress: 15,
      phases: [
        {
          phase_name: 'volume_scan',
          phase_order: 1,
          status: 'running',
          progress: 75,
          items_processed: 1250,
          items_total: 0,
          items_successful: 1245,
          items_failed: 5,
          bytes_processed: 2500000000,
          bytes_total: 0,
          items_per_second: 125.5,
          bytes_per_second: 15000000,
          current_item: '/var/lib/docker/volumes/myvolume/_data/large-file.txt',
          error_count: 5,
          started_at: new Date(Date.now() - 60000).toISOString(),
        },
        {
          phase_name: 'filesystem_indexing',
          phase_order: 2,
          status: 'pending',
          progress: 0,
          items_processed: 0,
          items_total: 0,
          items_successful: 0,
          items_failed: 0,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
        },
        {
          phase_name: 'media_enrichment',
          phase_order: 3,
          status: 'pending',
          progress: 0,
          items_processed: 0,
          items_total: 0,
          items_successful: 0,
          items_failed: 0,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
        },
      ],
      started_at: new Date(Date.now() - 60000).toISOString(),
      estimated_end_time: new Date(Date.now() + 300000).toISOString(),
    } satisfies ComprehensiveScanProgress,
  },
};

export const FilesystemIndexing: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-filesystem',
    showDetailedMetrics: true,
  },
  parameters: {
    mockData: {
      scan_id: 'scan-456',
      volume_id: 'volume-filesystem',
      overall_status: 'running',
      overall_progress: 45,
      phases: [
        {
          phase_name: 'volume_scan',
          phase_order: 1,
          status: 'completed',
          progress: 100,
          items_processed: 1500,
          items_total: 1500,
          items_successful: 1495,
          items_failed: 5,
          bytes_processed: 5000000000,
          bytes_total: 5000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 5,
          started_at: new Date(Date.now() - 180000).toISOString(),
          completed_at: new Date(Date.now() - 120000).toISOString(),
        },
        {
          phase_name: 'filesystem_indexing',
          phase_order: 2,
          status: 'running',
          progress: 35,
          items_processed: 8750,
          items_total: 25000,
          items_successful: 8720,
          items_failed: 30,
          bytes_processed: 12000000000,
          bytes_total: 45000000000,
          items_per_second: 87.5,
          bytes_per_second: 45000000,
          current_item: '/var/lib/docker/volumes/myvolume/_data/photos/IMG_2023_family_vacation.jpg',
          current_depth: 3,
          error_count: 30,
          started_at: new Date(Date.now() - 120000).toISOString(),
        },
        {
          phase_name: 'media_enrichment',
          phase_order: 3,
          status: 'pending',
          progress: 0,
          items_processed: 0,
          items_total: 0,
          items_successful: 0,
          items_failed: 0,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
        },
      ],
      started_at: new Date(Date.now() - 180000).toISOString(),
      estimated_end_time: new Date(Date.now() + 420000).toISOString(),
      performance_stats: {
        elapsed_seconds: 180,
        estimated_remaining_seconds: 420,
        overall_items_per_second: 52.3,
        overall_bytes_per_second: 25000000,
        error_rate: 0.15,
      },
    } satisfies ComprehensiveScanProgress,
  },
};

export const MediaEnrichment: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-media',
    showDetailedMetrics: true,
  },
  parameters: {
    mockData: {
      scan_id: 'scan-789',
      volume_id: 'volume-media',
      overall_status: 'running',
      overall_progress: 92,
      phases: [
        {
          phase_name: 'volume_scan',
          phase_order: 1,
          status: 'completed',
          progress: 100,
          items_processed: 2000,
          items_total: 2000,
          items_successful: 2000,
          items_failed: 0,
          bytes_processed: 8000000000,
          bytes_total: 8000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
          started_at: new Date(Date.now() - 600000).toISOString(),
          completed_at: new Date(Date.now() - 540000).toISOString(),
        },
        {
          phase_name: 'filesystem_indexing',
          phase_order: 2,
          status: 'completed',
          progress: 100,
          items_processed: 15000,
          items_total: 15000,
          items_successful: 14950,
          items_failed: 50,
          bytes_processed: 50000000000,
          bytes_total: 50000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 50,
          started_at: new Date(Date.now() - 540000).toISOString(),
          completed_at: new Date(Date.now() - 120000).toISOString(),
        },
        {
          phase_name: 'media_enrichment',
          phase_order: 3,
          status: 'running',
          progress: 80,
          items_processed: 2400,
          items_total: 3000,
          items_successful: 2380,
          items_failed: 20,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 4.2,
          bytes_per_second: 0,
          current_item: 'vacation_video_4k.mp4',
          error_count: 20,
          started_at: new Date(Date.now() - 120000).toISOString(),
        },
      ],
      started_at: new Date(Date.now() - 600000).toISOString(),
      estimated_end_time: new Date(Date.now() + 30000).toISOString(),
      performance_stats: {
        elapsed_seconds: 600,
        estimated_remaining_seconds: 30,
        overall_items_per_second: 32.5,
        overall_bytes_per_second: 95000000,
        error_rate: 0.4,
      },
    } satisfies ComprehensiveScanProgress,
  },
};

export const CompletedScan: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-completed',
    showDetailedMetrics: true,
    showEstimatedTime: false,
  },
  parameters: {
    mockData: {
      scan_id: 'scan-complete',
      volume_id: 'volume-completed',
      overall_status: 'completed',
      overall_progress: 100,
      phases: [
        {
          phase_name: 'volume_scan',
          phase_order: 1,
          status: 'completed',
          progress: 100,
          items_processed: 1800,
          items_total: 1800,
          items_successful: 1800,
          items_failed: 0,
          bytes_processed: 7200000000,
          bytes_total: 7200000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
          started_at: new Date(Date.now() - 900000).toISOString(),
          completed_at: new Date(Date.now() - 840000).toISOString(),
        },
        {
          phase_name: 'filesystem_indexing',
          phase_order: 2,
          status: 'completed',
          progress: 100,
          items_processed: 12000,
          items_total: 12000,
          items_successful: 11980,
          items_failed: 20,
          bytes_processed: 36000000000,
          bytes_total: 36000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 20,
          started_at: new Date(Date.now() - 840000).toISOString(),
          completed_at: new Date(Date.now() - 300000).toISOString(),
        },
        {
          phase_name: 'media_enrichment',
          phase_order: 3,
          status: 'completed',
          progress: 100,
          items_processed: 1500,
          items_total: 1500,
          items_successful: 1485,
          items_failed: 15,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 15,
          started_at: new Date(Date.now() - 300000).toISOString(),
          completed_at: new Date().toISOString(),
        },
      ],
      started_at: new Date(Date.now() - 900000).toISOString(),
      completed_at: new Date().toISOString(),
      performance_stats: {
        elapsed_seconds: 900,
        estimated_remaining_seconds: 0,
        overall_items_per_second: 17.0,
        overall_bytes_per_second: 48000000,
        error_rate: 0.3,
      },
    } satisfies ComprehensiveScanProgress,
  },
};

export const FailedScan: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-failed',
    showDetailedMetrics: true,
  },
  parameters: {
    mockData: {
      scan_id: 'scan-failed',
      volume_id: 'volume-failed',
      overall_status: 'failed',
      overall_progress: 25,
      phases: [
        {
          phase_name: 'volume_scan',
          phase_order: 1,
          status: 'completed',
          progress: 100,
          items_processed: 500,
          items_total: 500,
          items_successful: 500,
          items_failed: 0,
          bytes_processed: 2000000000,
          bytes_total: 2000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
          started_at: new Date(Date.now() - 300000).toISOString(),
          completed_at: new Date(Date.now() - 240000).toISOString(),
        },
        {
          phase_name: 'filesystem_indexing',
          phase_order: 2,
          status: 'failed',
          progress: 15,
          items_processed: 750,
          items_total: 5000,
          items_successful: 720,
          items_failed: 30,
          bytes_processed: 3000000000,
          bytes_total: 20000000000,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 30,
          error_message: 'Permission denied: Unable to access /protected/sensitive-data/',
          started_at: new Date(Date.now() - 240000).toISOString(),
        },
        {
          phase_name: 'media_enrichment',
          phase_order: 3,
          status: 'pending',
          progress: 0,
          items_processed: 0,
          items_total: 0,
          items_successful: 0,
          items_failed: 0,
          bytes_processed: 0,
          bytes_total: 0,
          items_per_second: 0,
          bytes_per_second: 0,
          error_count: 0,
        },
      ],
      recent_errors: [
        {
          error_type: 'permission_denied',
          error_category: 'filesystem',
          severity: 'error',
          component: 'filesystem_indexer',
          operation: 'read_directory',
          item_path: '/protected/sensitive-data/',
          item_name: 'sensitive-data',
          error_message: 'Permission denied: Unable to access directory',
          technical_details: 'EACCES: permission denied, scandir \'/protected/sensitive-data/\'',
          occurred_at: new Date(Date.now() - 120000).toISOString(),
          retry_count: 3,
        },
        {
          error_type: 'file_not_found',
          error_category: 'filesystem',
          severity: 'warning',
          component: 'filesystem_indexer',
          operation: 'read_file',
          item_path: '/broken/symlink.txt',
          item_name: 'symlink.txt',
          error_message: 'Broken symbolic link detected',
          occurred_at: new Date(Date.now() - 90000).toISOString(),
          retry_count: 1,
        },
      ],
      started_at: new Date(Date.now() - 300000).toISOString(),
      performance_stats: {
        elapsed_seconds: 300,
        estimated_remaining_seconds: 0,
        overall_items_per_second: 4.17,
        overall_bytes_per_second: 16666667,
        error_rate: 6.0,
      },
    } satisfies ComprehensiveScanProgress,
  },
};

export const CompactMode: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-compact',
    compact: true,
    showPhaseDescriptions: false,
    showDetailedMetrics: false,
    showEstimatedTime: false,
  },
};

export const SmallSize: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-small',
    size: 'sm',
    showDetailedMetrics: false,
  },
};

export const LargeSize: Story = {
  args: {
    ...Default.args,
    volumeId: 'volume-large',
    size: 'lg',
    showDetailedMetrics: true,
  },
};
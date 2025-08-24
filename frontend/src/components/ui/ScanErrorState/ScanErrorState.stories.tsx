import type { Meta, StoryObj } from '@storybook/react';
import { ScanErrorState } from './ScanErrorState';
import type { ScanError } from '../../../utils/scanErrorHandling';

const meta = {
  title: 'UI/ScanErrorState',
  component: ScanErrorState,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
**ScanErrorState** provides enhanced, user-friendly error display specifically for scan operations.

Key features:
- **Contextual error messages** - Clear, non-technical explanations
- **Actionable suggestions** - Specific guidance for resolving issues  
- **Batch context** - Shows current batch and progress information
- **Severity-based styling** - Visual hierarchy based on error criticality
- **Technical details** - Expandable section for debugging information
- **Smart actions** - Context-aware retry, skip, and abort options

Perfect for providing meaningful feedback during intensive scan operations.
        `.trim(),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showTechnicalDetails: {
      control: 'boolean',
      description: 'Show technical details by default',
    },
    showActions: {
      control: 'boolean',
      description: 'Show action buttons',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
  },
} satisfies Meta<typeof ScanErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock scan errors for stories
const createMockScanError = (
  overrides: Partial<ScanError> = {},
): ScanError => ({
  error_type: 'EnrichmentError',
  error_category: 'metadata_extraction',
  severity: 'warning',
  component: 'ffprobe',
  operation: 'extract_video_metadata',
  item_path: '/media/tv-shows/Breaking.Bad.S01E01.2160p.mkv',
  item_name: 'Breaking.Bad.S01E01.2160p.mkv',
  error_message: 'Invalid or corrupted video stream',
  technical_details: 'moov atom not found - file may be truncated or corrupted',
  occurred_at: new Date().toISOString(),
  retry_count: 1,
  file_size: 1073741824, // 1GB
  file_type: 'video/x-matroska',
  ...overrides,
});

// File permission error
export const FilePermissionError: Story = {
  args: {
    error: createMockScanError({
      error_type: 'FileAccessError',
      error_category: 'permissions',
      severity: 'error',
      component: 'filesystem_scanner',
      operation: 'read_file_metadata',
      item_path: '/media/restricted/private-video.mp4',
      item_name: 'private-video.mp4',
      error_message: 'Permission denied',
      technical_details:
        "EACCES: permission denied, open '/media/restricted/private-video.mp4'",
      retry_count: 0,
    }),
    context: {
      phase: 'filesystem_indexing',
      volumeName: 'Media Library',
      batchInfo: {
        currentBatch: 15,
        totalBatches: 50,
        filesInBatch: 100,
        batchProgress: 23,
      },
    },
    actions: {
      onRetry: () => console.log('Retry clicked'),
      onSkip: () => console.log('Skip clicked'),
      onPause: () => console.log('Pause clicked'),
    },
    showActions: true,
    showTechnicalDetails: false,
  },
};

// Media enrichment error
export const MediaEnrichmentError: Story = {
  args: {
    error: createMockScanError(),
    context: {
      phase: 'media_enrichment',
      operation: 'extract_video_metadata',
      volumeName: 'TV Shows',
      fileName: 'Breaking.Bad.S01E01.2160p.mkv',
      batchInfo: {
        currentBatch: 3,
        totalBatches: 12,
        filesInBatch: 25,
        batchProgress: 68,
      },
    },
    actions: {
      onRetry: () => console.log('Retry clicked'),
      onSkip: () => console.log('Skip clicked'),
    },
    showActions: true,
  },
};

// Critical filesystem error
export const CriticalFilesystemError: Story = {
  args: {
    error: createMockScanError({
      error_type: 'FilesystemError',
      error_category: 'disk_io',
      severity: 'critical',
      component: 'filesystem_scanner',
      operation: 'read_directory',
      item_path: '/media/corrupted-directory',
      item_name: 'corrupted-directory',
      error_message: 'I/O error reading directory structure',
      technical_details:
        'Block device error: sector unreadable at LBA 2048576. Possible disk failure.',
      retry_count: 3,
    }),
    context: {
      phase: 'filesystem_indexing',
      volumeName: 'External Drive',
    },
    actions: {
      onAbort: () => console.log('Abort scan clicked'),
      onViewDetails: () => console.log('View details clicked'),
    },
    showActions: true,
    showTechnicalDetails: true,
  },
};

// Memory resource error
export const ResourceError: Story = {
  args: {
    error: createMockScanError({
      error_type: 'ResourceError',
      error_category: 'memory',
      severity: 'error',
      component: 'media_processor',
      operation: 'create_thumbnail',
      item_path: '/media/movies/8K-Movie-Sample.mkv',
      item_name: '8K-Movie-Sample.mkv',
      error_message: 'Insufficient memory to process large media file',
      technical_details:
        'Out of memory: cannot allocate 16GB for 8K video frame buffer',
      file_size: 17179869184, // 16GB
      retry_count: 2,
    }),
    context: {
      phase: 'media_enrichment',
      operation: 'create_thumbnail',
      volumeName: 'Movies',
      fileName: '8K-Movie-Sample.mkv',
    },
    actions: {
      onSkip: () => console.log('Skip clicked'),
      onPause: () => console.log('Pause clicked'),
    },
    showActions: true,
  },
};

// Network timeout error
export const NetworkTimeoutError: Story = {
  args: {
    error: createMockScanError({
      error_type: 'TimeoutError',
      error_category: 'timeout',
      severity: 'warning',
      component: 'network_scanner',
      operation: 'read_file_metadata',
      item_path: '//nas-server/media/large-video.mkv',
      item_name: 'large-video.mkv',
      error_message: 'Network operation timed out',
      technical_details: 'Read timeout after 30 seconds on network share',
      file_size: 5368709120, // 5GB
      retry_count: 1,
    }),
    context: {
      phase: 'filesystem_indexing',
      volumeName: 'NAS Storage',
      fileName: 'large-video.mkv',
    },
    actions: {
      onRetry: () => console.log('Retry clicked'),
      onSkip: () => console.log('Skip clicked'),
    },
    showActions: true,
  },
};

// API error (not scan-specific)
export const ApiError: Story = {
  args: {
    error: {
      error: {
        code: 'VOLUME_NOT_ACCESSIBLE',
        message: 'The specified volume could not be accessed',
        details: {
          volume_path: '/mnt/external-drive',
          mount_status: 'unmounted',
        },
        request_id: 'req_1234567890',
      },
    },
    context: {
      phase: 'volume_scan',
      volumeName: 'External Drive',
    },
    actions: {
      onRetry: () => console.log('Retry clicked'),
    },
    showActions: true,
  },
};

// Compact size
export const CompactSize: Story = {
  args: {
    ...MediaEnrichmentError.args,
    size: 'sm',
    showTechnicalDetails: false,
  },
};

// Large size with all features
export const LargeSize: Story = {
  args: {
    ...CriticalFilesystemError.args,
    size: 'lg',
    showTechnicalDetails: true,
  },
};

// Multiple retry attempts
export const MultipleRetryAttempts: Story = {
  args: {
    error: createMockScanError({
      error_type: 'EnrichmentError',
      error_category: 'metadata_extraction',
      severity: 'error',
      retry_count: 3,
      error_message: 'Failed to extract metadata after multiple attempts',
      technical_details:
        'FFprobe returned exit code 1: Invalid data found when processing input',
    }),
    context: {
      phase: 'media_enrichment',
      volumeName: 'Media Library',
    },
    actions: {
      onSkip: () => console.log('Skip clicked - too many retries'),
      onAbort: () => console.log('Abort scan clicked'),
    },
    showActions: true,
  },
};

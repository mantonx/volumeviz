import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';
import { action } from '@storybook/addon-actions';

import { ScanProgressModal } from './ScanProgressModal';
import type {
  ScanProgressModalProps,
  ScanData,
  WebSocketState,
  ScanStatus,
  ScanProgressTab,
} from './ScanProgressModal.types';
import { scanDataUtils } from '../../../utils';
import { createMockScanData } from './ScanProgressModal.types';
import { createScanErrors } from '../../shared/ErrorSummary/ErrorSummary.types';

const meta: Meta<typeof ScanProgressModal> = {
  title: 'Domain/ScanProgressModal',
  component: ScanProgressModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# ScanProgressModal

A comprehensive scan monitoring interface that combines all Tier 1 and Tier 2 components into a domain-specific composition. Features multi-tab layout, real-time updates, WebSocket integration, and comprehensive action handling.

## Features

- **Multi-tab Interface**: Overview, Performance, Errors, and Details tabs
- **Real-time Updates**: WebSocket integration with connection status
- **Comprehensive Progress Tracking**: Phase-by-phase progress with timeline
- **Performance Monitoring**: Real-time metrics and throughput analysis
- **Error Management**: Categorized error display with retry/acknowledge actions
- **Responsive Design**: Adapts to different screen sizes and modal sizes
- **Accessibility**: Full ARIA compliance and keyboard navigation

## Architecture

Combines components from all tiers:
- **Tier 1**: ProgressBar, StatusBadge
- **Tier 2**: ProcessTimeline, PerformanceDashboard, ErrorSummary
- **Tier 3**: ScanProgressModal (domain composition)

## Usage

\`\`\`tsx
<ScanProgressModal
  open={true}
  scanData={scanData}
  connectionState={connectionState}
  actions={{
    onPause: () => console.log('Pause'),
    onCancel: () => console.log('Cancel'),
    onClose: () => console.log('Close'),
  }}
/>
\`\`\`
        `,
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    activeTab: {
      control: 'select',
      options: ['overview', 'performance', 'errors', 'details'],
      description: 'Currently active tab',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Modal size',
    },
    closable: {
      control: 'boolean',
      description: 'Whether the modal can be closed',
    },
    showConnectionStatus: {
      control: 'boolean',
      description: 'Whether to show WebSocket connection status',
    },
    showAdvancedDetails: {
      control: 'boolean',
      description: 'Whether to show advanced details',
    },
    enableRealTimeUpdates: {
      control: 'boolean',
      description: 'Whether to enable real-time updates',
    },
    autoCloseOnComplete: {
      control: 'boolean',
      description: 'Whether to auto-close when scan completes',
    },
    autoCloseDelay: {
      control: 'number',
      description: 'Auto-close delay in milliseconds',
    },
  },
  args: {
    open: true,
    activeTab: 'overview',
    size: 'lg',
    closable: true,
    showConnectionStatus: true,
    showAdvancedDetails: false,
    enableRealTimeUpdates: true,
    autoCloseOnComplete: false,
    autoCloseDelay: 3000,
  },
};

export default meta;
type Story = StoryObj<typeof ScanProgressModal>;

// Base mock data
const baseScanData = createMockScanData();

const mockConnectionState: WebSocketState = {
  connected: true,
  reconnecting: false,
  lastUpdate: new Date(),
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
};

const mockActions = {
  onPause: action('pause'),
  onResume: action('resume'),
  onCancel: action('cancel'),
  onClose: action('close'),
  onViewDetails: action('view-details'),
  onDownloadReport: action('download-report'),
  onRetryError: action('retry-error'),
  onAcknowledgeError: action('acknowledge-error'),
  onDismissError: action('dismiss-error'),
};

/**
 * Default story showing active scan in progress
 */
export const Default: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Preparing phase - scan just starting
 */
export const Preparing: Story = {
  args: {
    scanData: createMockScanData({
      status: 'preparing',
      phases: [
        {
          id: 'prepare',
          name: 'Preparation',
          description: 'Preparing scan configuration and validating access',
          status: 'active',
          startTime: new Date(),
          progress: 25,
          estimatedDuration: 60000,
        },
        {
          id: 'index',
          name: 'Indexing',
          description: 'Scanning filesystem and building file index',
          status: 'pending',
          estimatedDuration: 180000,
        },
        {
          id: 'analyze',
          name: 'Analysis',
          description: 'Extracting metadata and generating previews',
          status: 'pending',
          estimatedDuration: 120000,
        },
        {
          id: 'finalize',
          name: 'Finalization',
          description: 'Finalizing scan results and updating database',
          status: 'pending',
          estimatedDuration: 30000,
        },
      ],
      statistics: {
        ...baseScanData.statistics,
        processedFiles: 0,
        processedSize: 0,
        throughput: {
          filesPerSecond: 0,
          bytesPerSecond: 0,
          currentThroughput: 0,
          averageThroughput: 0,
        },
      },
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Analysis phase with high throughput
 */
export const Analyzing: Story = {
  args: {
    scanData: createMockScanData({
      status: 'analyzing',
      phases: [
        {
          id: 'prepare',
          name: 'Preparation',
          description: 'Preparing scan configuration and validating access',
          status: 'completed',
          startTime: new Date(Date.now() - 300000),
          endTime: new Date(Date.now() - 240000),
          progress: 100,
          actualDuration: 60000,
        },
        {
          id: 'index',
          name: 'Indexing',
          description: 'Scanning filesystem and building file index',
          status: 'completed',
          startTime: new Date(Date.now() - 240000),
          endTime: new Date(Date.now() - 120000),
          progress: 100,
          actualDuration: 120000,
        },
        {
          id: 'analyze',
          name: 'Analysis',
          description: 'Extracting metadata and generating previews',
          status: 'active',
          startTime: new Date(Date.now() - 120000),
          progress: 75,
          estimatedDuration: 120000,
          details: {
            filesProcessed: 7500,
            totalFiles: 10000,
            currentFile: '/Users/docs/presentation.pptx',
            throughput: 45.2,
            errorCount: 1,
          },
        },
        {
          id: 'finalize',
          name: 'Finalization',
          description: 'Finalizing scan results and updating database',
          status: 'pending',
          estimatedDuration: 30000,
        },
      ],
      statistics: {
        ...baseScanData.statistics,
        processedFiles: 7500,
        processedSize: 1610612736, // 1.5GB
        throughput: {
          filesPerSecond: 45.2,
          bytesPerSecond: 8388608, // 8MB/s
          currentThroughput: 48.1,
          averageThroughput: 42.3,
        },
      },
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Completed scan
 */
export const Completed: Story = {
  args: {
    scanData: createMockScanData({
      status: 'completed',
      phases: [
        {
          id: 'prepare',
          name: 'Preparation',
          description: 'Preparing scan configuration and validating access',
          status: 'completed',
          startTime: new Date(Date.now() - 600000),
          endTime: new Date(Date.now() - 540000),
          progress: 100,
          actualDuration: 60000,
        },
        {
          id: 'index',
          name: 'Indexing',
          description: 'Scanning filesystem and building file index',
          status: 'completed',
          startTime: new Date(Date.now() - 540000),
          endTime: new Date(Date.now() - 360000),
          progress: 100,
          actualDuration: 180000,
        },
        {
          id: 'analyze',
          name: 'Analysis',
          description: 'Extracting metadata and generating previews',
          status: 'completed',
          startTime: new Date(Date.now() - 360000),
          endTime: new Date(Date.now() - 60000),
          progress: 100,
          actualDuration: 300000,
        },
        {
          id: 'finalize',
          name: 'Finalization',
          description: 'Finalizing scan results and updating database',
          status: 'completed',
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(),
          progress: 100,
          actualDuration: 60000,
        },
      ],
      statistics: {
        ...baseScanData.statistics,
        processedFiles: 10000,
        processedSize: 2147483648, // 2GB
        timing: {
          startTime: new Date(Date.now() - 600000),
          currentTime: new Date(),
          elapsedTime: 600000,
          remainingTime: 0,
        },
        throughput: {
          filesPerSecond: 16.7, // 10000 files / 600 seconds
          bytesPerSecond: 3579139, // ~3.4MB/s average
          currentThroughput: 0,
          averageThroughput: 16.7,
        },
      },
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Failed scan with errors
 */
export const Failed: Story = {
  args: {
    scanData: createMockScanData({
      status: 'failed',
      phases: [
        {
          id: 'prepare',
          name: 'Preparation',
          description: 'Preparing scan configuration and validating access',
          status: 'completed',
          startTime: new Date(Date.now() - 180000),
          endTime: new Date(Date.now() - 120000),
          progress: 100,
          actualDuration: 60000,
        },
        {
          id: 'index',
          name: 'Indexing',
          description: 'Scanning filesystem and building file index',
          status: 'failed',
          startTime: new Date(Date.now() - 120000),
          endTime: new Date(),
          progress: 45,
          actualDuration: 120000,
          details: {
            filesProcessed: 2250,
            totalFiles: 10000,
            currentFile: '/restricted/admin/config.db',
            throughput: 18.75,
            errorCount: 25,
          },
        },
        {
          id: 'analyze',
          name: 'Analysis',
          description: 'Extracting metadata and generating previews',
          status: 'skipped',
          estimatedDuration: 120000,
        },
        {
          id: 'finalize',
          name: 'Finalization',
          description: 'Finalizing scan results and updating database',
          status: 'skipped',
          estimatedDuration: 30000,
        },
      ],
      statistics: {
        ...baseScanData.statistics,
        processedFiles: 2250,
        processedSize: 483729392, // ~461MB
        errorFiles: 25,
        timing: {
          startTime: new Date(Date.now() - 180000),
          currentTime: new Date(),
          elapsedTime: 180000,
          remainingTime: 0,
        },
        throughput: {
          filesPerSecond: 12.5,
          bytesPerSecond: 2687274, // ~2.6MB/s
          currentThroughput: 0,
          averageThroughput: 12.5,
        },
      },
      errors: createScanErrors([
        {
          code: 'EACCES',
          message: 'Permission denied accessing /restricted/admin/',
          path: '/restricted/admin/',
          phase: 'indexing',
        },
        {
          code: 'ENOENT',
          message: 'File not found: /temp/missing.tmp',
          path: '/temp/missing.tmp',
          phase: 'indexing',
        },
        {
          code: 'TIMEOUT',
          message: 'Operation timed out while reading large file',
          path: '/media/large-video.mkv',
          phase: 'indexing',
        },
      ]),
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
    activeTab: 'errors',
  },
};

/**
 * Paused scan
 */
export const Paused: Story = {
  args: {
    scanData: createMockScanData({
      status: 'paused',
      phases: [
        {
          id: 'prepare',
          name: 'Preparation',
          description: 'Preparing scan configuration and validating access',
          status: 'completed',
          startTime: new Date(Date.now() - 300000),
          endTime: new Date(Date.now() - 240000),
          progress: 100,
          actualDuration: 60000,
        },
        {
          id: 'index',
          name: 'Indexing',
          description: 'Scanning filesystem and building file index',
          status: 'active',
          startTime: new Date(Date.now() - 240000),
          progress: 65,
          estimatedDuration: 180000,
          details: {
            filesProcessed: 6500,
            totalFiles: 10000,
            currentFile: '/Users/photos/vacation/IMG_1234.jpg',
            throughput: 0, // Paused
            errorCount: 2,
          },
        },
        {
          id: 'analyze',
          name: 'Analysis',
          description: 'Extracting metadata and generating previews',
          status: 'pending',
          estimatedDuration: 120000,
        },
        {
          id: 'finalize',
          name: 'Finalization',
          description: 'Finalizing scan results and updating database',
          status: 'pending',
          estimatedDuration: 30000,
        },
      ],
      statistics: {
        ...baseScanData.statistics,
        processedFiles: 6500,
        processedSize: 1395864371, // ~1.3GB
        throughput: {
          filesPerSecond: 0, // Paused
          bytesPerSecond: 0,
          currentThroughput: 0,
          averageThroughput: 27.1,
        },
      },
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Disconnected state
 */
export const Disconnected: Story = {
  args: {
    scanData: baseScanData,
    connectionState: {
      connected: false,
      reconnecting: false,
      error: 'WebSocket connection lost',
      lastUpdate: new Date(Date.now() - 30000), // 30 seconds ago
      reconnectAttempts: 3,
      maxReconnectAttempts: 5,
    },
    actions: mockActions,
  },
};

/**
 * Reconnecting state
 */
export const Reconnecting: Story = {
  args: {
    scanData: baseScanData,
    connectionState: {
      connected: false,
      reconnecting: true,
      lastUpdate: new Date(Date.now() - 5000), // 5 seconds ago
      reconnectAttempts: 2,
      maxReconnectAttempts: 5,
    },
    actions: mockActions,
  },
};

/**
 * Large modal size
 */
export const LargeSize: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: mockActions,
    size: 'xl',
  },
};

/**
 * Small modal size
 */
export const SmallSize: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: mockActions,
    size: 'sm',
  },
};

/**
 * Non-closable modal
 */
export const NonClosable: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: {
      ...mockActions,
      onClose: undefined,
    },
    closable: false,
  },
};

/**
 * Advanced details enabled
 */
export const AdvancedDetails: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: mockActions,
    activeTab: 'details',
    showAdvancedDetails: true,
  },
};

/**
 * Performance tab focus
 */
export const PerformanceTab: Story = {
  args: {
    scanData: createMockScanData({
      performance: [
        {
          id: 'throughput-files',
          label: 'Files/Second',
          value: 25.5,
          unit: 'files/s',
          type: 'throughput',
          status: 'good',
          lastUpdated: new Date(),
          trend: 'up',
        },
        {
          id: 'throughput-bytes',
          label: 'Data/Second',
          value: 5468006,
          unit: 'bytes/s',
          type: 'throughput',
          status: 'good',
          lastUpdated: new Date(),
          trend: 'stable',
        },
        {
          id: 'memory-usage',
          label: 'Memory Usage',
          value: 256 * 1024 * 1024, // 256MB
          unit: 'bytes',
          type: 'resource',
          status: 'good',
          lastUpdated: new Date(),
          trend: 'stable',
        },
        {
          id: 'cpu-usage',
          label: 'CPU Usage',
          value: 45.2,
          unit: '%',
          type: 'resource',
          status: 'warning',
          lastUpdated: new Date(),
          trend: 'down',
        },
      ],
    }),
    connectionState: mockConnectionState,
    actions: mockActions,
    activeTab: 'performance',
  },
};

/**
 * Interactive real-time simulation
 */
export const RealTimeSimulation: Story = {
  render: (args) => {
    const [scanData, setScanData] = useState<ScanData>(createMockScanData());
    const [isRunning, setIsRunning] = useState(true);

    useEffect(() => {
      if (!isRunning) return;

      const interval = setInterval(() => {
        setScanData((prev) => {
          if (scanDataUtils.isTerminalState(prev.status)) {
            setIsRunning(false);
            return prev;
          }

          const currentPhase = scanDataUtils.getCurrentPhase(prev);
          if (!currentPhase) return prev;

          // Simulate progress
          const newProgress = Math.min(
            100,
            (currentPhase.progress || 0) + Math.random() * 5,
          );
          const updatedPhases = prev.phases.map((phase) =>
            phase.id === currentPhase.id
              ? { ...phase, progress: newProgress }
              : phase,
          );

          // Simulate file processing
          const filesIncrement = Math.floor(Math.random() * 50);
          const bytesIncrement =
            filesIncrement * (100000 + Math.random() * 500000);

          return {
            ...prev,
            phases: updatedPhases,
            statistics: {
              ...prev.statistics,
              processedFiles: Math.min(
                prev.statistics.totalFiles,
                prev.statistics.processedFiles + filesIncrement,
              ),
              processedSize: prev.statistics.processedSize + bytesIncrement,
              throughput: {
                ...prev.statistics.throughput,
                currentThroughput: 20 + Math.random() * 20,
                filesPerSecond: 20 + Math.random() * 20,
                bytesPerSecond: 3000000 + Math.random() * 5000000,
              },
              timing: {
                ...prev.statistics.timing,
                currentTime: new Date(),
                elapsedTime:
                  Date.now() - prev.statistics.timing.startTime.getTime(),
              },
            },
          };
        });
      }, 1000);

      return () => clearInterval(interval);
    }, [isRunning]);

    const handlePause = () => {
      setIsRunning(false);
      setScanData((prev) => ({ ...prev, status: 'paused' }));
      action('pause')();
    };

    const handleResume = () => {
      setIsRunning(true);
      setScanData((prev) => ({ ...prev, status: 'indexing' }));
      action('resume')();
    };

    return (
      <ScanProgressModal
        {...args}
        scanData={scanData}
        actions={{
          ...args.actions,
          onPause: handlePause,
          onResume: handleResume,
        }}
      />
    );
  },
  args: {
    connectionState: mockConnectionState,
    actions: mockActions,
  },
};

/**
 * Custom tabs example
 */
export const CustomTabs: Story = {
  args: {
    scanData: baseScanData,
    connectionState: mockConnectionState,
    actions: mockActions,
    customTabs: [
      {
        id: 'logs' as ScanProgressTab,
        label: 'Logs',
        content: (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Scan Logs</h3>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
              <div>[12:34:56] INFO: Starting filesystem scan</div>
              <div>[12:34:57] DEBUG: Scanning directory /Users</div>
              <div>[12:34:58] INFO: Found 1,234 files in /Users/Documents</div>
              <div>[12:34:59] DEBUG: Processing file: document.pdf</div>
              <div>[12:35:00] WARN: Skipping hidden file: .DS_Store</div>
              <div>[12:35:01] INFO: Extracted metadata from image.jpg</div>
              <div>[12:35:02] DEBUG: Generated thumbnail for photo.png</div>
            </div>
          </div>
        ),
      },
    ],
  },
};

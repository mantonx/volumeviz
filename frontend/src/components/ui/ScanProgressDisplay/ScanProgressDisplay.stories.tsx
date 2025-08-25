import { action } from '@storybook/addon-actions';
import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ScanProgressDisplay } from './ScanProgressDisplay';
import type { ScanProgressData } from './ScanProgressDisplay.types';

const meta = {
  title: 'Components/UI/ScanProgressDisplay',
  component: ScanProgressDisplay,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The ScanProgressDisplay component provides real-time visualization of volume scan progress.

## Features
- **Two display modes**: 'border' for subtle progress indication, 'panel' for detailed view
- **Real-time updates**: WebSocket integration for live progress updates
- **Phase breakdown**: Shows progress for Volume Scan, Filesystem Indexing, and Media Enrichment phases
- **Performance metrics**: Displays scan performance statistics
- **Auto-expand behavior**: Automatically shows panel when scan starts with optional auto-close
- **Error handling**: Shows recent errors and error states
- **Responsive design**: Works across different screen sizes

## Usage Patterns
1. **Scan-triggered mode**: Auto-expand with toast, then auto-close after delay
2. **View-only mode**: Manual expand/collapse, no toast, real-time updates
3. **Border-only mode**: Always collapsed, subtle progress border only
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    volumeId: {
      description: 'Unique identifier for the volume being scanned',
      control: 'text',
    },
    scanId: {
      description: 'Optional scan ID if known',
      control: 'text',
    },
    variant: {
      description: 'Display variant',
      control: { type: 'select' },
      options: ['border', 'panel'],
    },
    size: {
      description: 'Display size variant',
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    showPerformanceStats: {
      description: 'Whether to show performance statistics (panel mode only)',
      control: 'boolean',
    },
    showErrors: {
      description: 'Whether to show recent errors (panel mode only)',
      control: 'boolean',
    },
    animated: {
      description: 'Whether to animate progress changes',
      control: 'boolean',
    },
    showEstimatedTime: {
      description:
        'Whether to show estimated completion time (panel mode only)',
      control: 'boolean',
    },
    compact: {
      description:
        'Compact mode - reduced spacing and smaller text (panel mode only)',
      control: 'boolean',
    },
    borderHeight: {
      description: 'Height of the progress border in pixels (border mode only)',
      control: { type: 'range', min: 2, max: 10, step: 1 },
    },
    showBorderProgress: {
      description: 'Whether to show progress percentage text in border mode',
      control: 'boolean',
    },
    onScanStart: { action: 'scan-started' },
    onScanComplete: { action: 'scan-completed' },
    onScanError: { action: 'scan-error' },
    onProgressUpdate: { action: 'progress-updated' },
    onExpandedChange: { action: 'expanded-changed' },
  },
  args: {
    volumeId: 'volume-12345',
    variant: 'panel',
    size: 'md',
    showPerformanceStats: true,
    showErrors: true,
    animated: true,
    showEstimatedTime: true,
    compact: false,
    borderHeight: 4,
    showBorderProgress: false,
    onScanStart: action('scan-started'),
    onScanComplete: action('scan-completed'),
    onScanError: action('scan-error'),
    onProgressUpdate: action('progress-updated'),
    onExpandedChange: action('expanded-changed'),
  },
} satisfies Meta<typeof ScanProgressDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock WebSocket provider for Storybook
const MockWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div>{children}</div>;
};

// Mock the WebSocket provider hook
const mockWebSocketHook = {
  isConnected: true,
  on: () => {},
  send: () => true,
};

// Mock the WebSocket provider globally for stories
// @ts-ignore - Storybook context
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.__MOCK_WEBSOCKET__ = mockWebSocketHook;
}

// Sample progress data for different scan states
const createMockProgressData = (
  overrides: Partial<ScanProgressData> = {},
): ScanProgressData => ({
  scanId: 'scan-12345',
  volumeId: 'volume-12345',
  overallStatus: 'running',
  overallProgress: 45,
  phases: [
    {
      id: 'volume_scan',
      name: 'volume_scan',
      label: 'Volume Scan',
      description: 'Calculating volume size and basic statistics',
      order: 1,
      status: 'completed',
      progress: 100,
      itemsProcessed: 100,
      itemsTotal: 100,
      bytesProcessed: 1024,
      bytesTotal: 1024,
      itemsPerSecond: 10,
      bytesPerSecond: 1024,
      errorCount: 0,
      startedAt: '2025-01-01T10:00:00Z',
      completedAt: '2025-01-01T10:01:00Z',
    },
    {
      id: 'filesystem_indexing',
      name: 'filesystem_indexing',
      label: 'Filesystem Indexing',
      description: 'Analyzing file structure and metadata',
      order: 2,
      status: 'running',
      progress: 60,
      itemsProcessed: 6000,
      itemsTotal: 10000,
      bytesProcessed: 2048000,
      bytesTotal: 4096000,
      itemsPerSecond: 50,
      bytesPerSecond: 512000,
      currentItem: '/path/to/current/file.txt',
      errorCount: 2,
    },
    {
      id: 'media_enrichment',
      name: 'media_enrichment',
      label: 'Media Enrichment',
      description: 'Extracting metadata from images, videos, and audio',
      order: 3,
      status: 'pending',
      progress: 0,
      itemsProcessed: 0,
      itemsTotal: 1000,
      bytesProcessed: 0,
      bytesTotal: 500000,
      itemsPerSecond: 0,
      bytesPerSecond: 0,
      errorCount: 0,
    },
  ],
  performanceStats: {
    elapsedSeconds: 120,
    estimatedRemainingSeconds: 60,
    overallItemsPerSecond: 35.5,
    overallBytesPerSecond: 256000,
    errorRate: 0.02,
    memoryUsageBytes: 512000000,
    cpuUsagePercent: 45.2,
  },
  startedAt: '2025-01-01T10:00:00Z',
  estimatedEndTime: '2025-01-01T11:00:00Z',
  recentErrors: [
    {
      itemName: '/path/to/problematic/file.txt',
      errorMessage: 'Permission denied',
      occurredAt: '2025-01-01T10:30:00Z',
    },
    {
      itemName: '/path/to/another/corrupt.jpg',
      errorMessage: 'Invalid image format',
      occurredAt: '2025-01-01T10:31:00Z',
    },
  ],
  ...overrides,
});

// Story component that simulates progress updates
const ProgressStory: React.FC<{
  initialProgress: ScanProgressData;
  autoUpdate?: boolean;
  updateInterval?: number;
  maxProgress?: number;
  children: (progress: ScanProgressData | null) => React.ReactElement;
}> = ({
  initialProgress,
  autoUpdate = false,
  updateInterval = 1000,
  maxProgress = 100,
  children,
}) => {
  const [progress, setProgress] = useState<ScanProgressData | null>(
    initialProgress,
  );

  useEffect(() => {
    if (!autoUpdate || !progress || progress.overallStatus !== 'running')
      return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (!prev) return prev;

        // Simulate progress updates
        const currentPhase = prev.phases.find((p) => p.status === 'running');
        if (!currentPhase) return prev;

        const newProgress = Math.min(
          currentPhase.progress + Math.random() * 5,
          100,
        );
        const updatedPhases = prev.phases.map((phase) => {
          if (phase.id === currentPhase.id) {
            const isCompleted = newProgress >= 100;
            return {
              ...phase,
              progress: newProgress,
              status: isCompleted
                ? ('completed' as const)
                : ('running' as const),
              itemsProcessed: Math.floor(
                (newProgress / 100) * phase.itemsTotal,
              ),
              bytesProcessed: Math.floor(
                (newProgress / 100) * phase.bytesTotal,
              ),
              completedAt: isCompleted ? new Date().toISOString() : undefined,
            };
          }
          return phase;
        });

        // Check if we need to start the next phase
        const completedPhase = updatedPhases.find(
          (p) => p.id === currentPhase.id && p.status === 'completed',
        );
        if (completedPhase) {
          const nextPhase = updatedPhases.find((p) => p.status === 'pending');
          if (nextPhase) {
            updatedPhases[updatedPhases.indexOf(nextPhase)] = {
              ...nextPhase,
              status: 'running',
              startedAt: new Date().toISOString(),
            };
          }
        }

        // Calculate overall progress
        let totalProgress = 0;
        const phaseWeights = {
          volume_scan: 0.15,
          filesystem_indexing: 0.7,
          media_enrichment: 0.15,
        };
        for (const phase of updatedPhases) {
          const weight =
            phaseWeights[phase.name as keyof typeof phaseWeights] || 0;
          totalProgress += (phase.progress / 100) * weight * 100;
        }

        const overallProgress = Math.min(
          Math.round(totalProgress),
          maxProgress,
        );
        const allCompleted = updatedPhases.every(
          (p) => p.status === 'completed',
        );

        return {
          ...prev,
          phases: updatedPhases,
          overallProgress,
          overallStatus: allCompleted ? 'completed' : 'running',
          completedAt: allCompleted ? new Date().toISOString() : undefined,
          performanceStats: prev.performanceStats
            ? {
                ...prev.performanceStats,
                elapsedSeconds:
                  prev.performanceStats.elapsedSeconds + updateInterval / 1000,
                estimatedRemainingSeconds: Math.max(
                  0,
                  prev.performanceStats.estimatedRemainingSeconds -
                    updateInterval / 1000,
                ),
              }
            : undefined,
        };
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [autoUpdate, updateInterval, maxProgress, progress]);

  return children(progress);
};

// Basic Panel Story
export const PanelDefault: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div style={{ width: '600px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
};

// Panel with Live Updates
export const PanelWithLiveUpdates: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()} autoUpdate>
        {(progress) => (
          <div style={{ width: '600px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows scan progress with simulated live updates every second.',
      },
    },
  },
};

// Border Variant
export const BorderMode: Story = {
  args: {
    variant: 'border',
    borderHeight: 6,
    showBorderProgress: true,
  },
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div
            style={{
              width: '400px',
              margin: '20px',
              padding: '20px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
              Volume: /home/user/documents
            </div>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the subtle border-only mode for displaying progress in table rows or compact layouts.',
      },
    },
  },
};

// Completed Scan
export const CompletedScan: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory
        initialProgress={createMockProgressData({
          overallStatus: 'completed',
          overallProgress: 100,
          completedAt: '2025-01-01T11:00:00Z',
          phases: [
            {
              id: 'volume_scan',
              name: 'volume_scan',
              label: 'Volume Scan',
              description: 'Calculating volume size and basic statistics',
              order: 1,
              status: 'completed',
              progress: 100,
              itemsProcessed: 100,
              itemsTotal: 100,
              bytesProcessed: 1024,
              bytesTotal: 1024,
              itemsPerSecond: 10,
              bytesPerSecond: 1024,
              errorCount: 0,
              completedAt: '2025-01-01T10:01:00Z',
            },
            {
              id: 'filesystem_indexing',
              name: 'filesystem_indexing',
              label: 'Filesystem Indexing',
              description: 'Analyzing file structure and metadata',
              order: 2,
              status: 'completed',
              progress: 100,
              itemsProcessed: 10000,
              itemsTotal: 10000,
              bytesProcessed: 4096000,
              bytesTotal: 4096000,
              itemsPerSecond: 50,
              bytesPerSecond: 512000,
              errorCount: 2,
              completedAt: '2025-01-01T10:45:00Z',
            },
            {
              id: 'media_enrichment',
              name: 'media_enrichment',
              label: 'Media Enrichment',
              description: 'Extracting metadata from images, videos, and audio',
              order: 3,
              status: 'completed',
              progress: 100,
              itemsProcessed: 1000,
              itemsTotal: 1000,
              bytesProcessed: 500000,
              bytesTotal: 500000,
              itemsPerSecond: 20,
              bytesPerSecond: 25000,
              errorCount: 0,
              completedAt: '2025-01-01T11:00:00Z',
            },
          ],
        })}
      >
        {(progress) => (
          <div style={{ width: '600px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the component displays a successfully completed scan with all phases done.',
      },
    },
  },
};

// Failed Scan
export const FailedScan: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory
        initialProgress={createMockProgressData({
          overallStatus: 'failed',
          overallProgress: 30,
          phases: [
            {
              id: 'volume_scan',
              name: 'volume_scan',
              label: 'Volume Scan',
              description: 'Calculating volume size and basic statistics',
              order: 1,
              status: 'completed',
              progress: 100,
              itemsProcessed: 100,
              itemsTotal: 100,
              bytesProcessed: 1024,
              bytesTotal: 1024,
              itemsPerSecond: 10,
              bytesPerSecond: 1024,
              errorCount: 0,
              completedAt: '2025-01-01T10:01:00Z',
            },
            {
              id: 'filesystem_indexing',
              name: 'filesystem_indexing',
              label: 'Filesystem Indexing',
              description: 'Analyzing file structure and metadata',
              order: 2,
              status: 'failed',
              progress: 30,
              itemsProcessed: 3000,
              itemsTotal: 10000,
              bytesProcessed: 1048576,
              bytesTotal: 4096000,
              itemsPerSecond: 0,
              bytesPerSecond: 0,
              errorCount: 15,
              errorMessage:
                'Critical filesystem error: Permission denied accessing /protected/directory',
            },
            {
              id: 'media_enrichment',
              name: 'media_enrichment',
              label: 'Media Enrichment',
              description: 'Extracting metadata from images, videos, and audio',
              order: 3,
              status: 'pending',
              progress: 0,
              itemsProcessed: 0,
              itemsTotal: 1000,
              bytesProcessed: 0,
              bytesTotal: 500000,
              itemsPerSecond: 0,
              bytesPerSecond: 0,
              errorCount: 0,
            },
          ],
          recentErrors: [
            {
              itemName: '/protected/directory/secret.txt',
              errorMessage: 'Permission denied',
              occurredAt: '2025-01-01T10:15:00Z',
            },
            {
              itemName: '/protected/directory/private.jpg',
              errorMessage: 'Access forbidden',
              occurredAt: '2025-01-01T10:16:00Z',
            },
          ],
        })}
      >
        {(progress) => (
          <div style={{ width: '600px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows how the component displays a failed scan with error information and partial progress.',
      },
    },
  },
};

// Compact Mode
export const CompactMode: Story = {
  args: {
    compact: true,
    size: 'sm',
  },
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div style={{ width: '500px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the compact mode with reduced spacing and smaller text, ideal for space-constrained layouts.',
      },
    },
  },
};

// Large Size Variant
export const LargeSize: Story = {
  args: {
    size: 'lg',
  },
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div style={{ width: '700px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the large size variant with bigger text and icons, suitable for main dashboard displays.',
      },
    },
  },
};

// Without Performance Stats
export const WithoutPerformanceStats: Story = {
  args: {
    showPerformanceStats: false,
  },
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div style={{ width: '600px', margin: '20px' }}>
            <ScanProgressDisplay {...args} />
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the component with performance statistics hidden for a cleaner interface.',
      },
    },
  },
};

// Auto-Expand Behavior Demo
export const AutoExpandBehavior: Story = {
  args: {
    autoExpandOnScanStart: {
      enabled: true,
      autoCloseDuration: 5000,
      showToast: true,
    },
  },
  render: (args) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <MockWebSocketProvider>
        <div style={{ width: '600px', margin: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => {
                // Simulate scan start which should trigger auto-expand
                args.onScanStart?.('new-scan-id');
                setIsExpanded(true);
                // Auto-close after 5 seconds
                setTimeout(() => setIsExpanded(false), 5000);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Start Scan (Triggers Auto-Expand)
            </button>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Click to simulate scan start. Panel will auto-expand and close
              after 5 seconds.
            </p>
          </div>

          <ProgressStory initialProgress={createMockProgressData()}>
            {(progress) => (
              <ScanProgressDisplay
                {...args}
                isExpanded={isExpanded}
                onExpandedChange={setIsExpanded}
              />
            )}
          </ProgressStory>
        </div>
      </MockWebSocketProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the auto-expand behavior when a scan starts. Click the button to see the panel automatically open and close.',
      },
    },
  },
};

// No Data State
export const NoData: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <div style={{ width: '600px', margin: '20px' }}>
        <ScanProgressDisplay {...args} />
      </div>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows the component when no scan data is available (no active or historical scan).',
      },
    },
  },
};

// Border with Different Heights
export const BorderVariants: Story = {
  render: (args) => (
    <MockWebSocketProvider>
      <ProgressStory initialProgress={createMockProgressData()}>
        {(progress) => (
          <div style={{ width: '500px', margin: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>Border Height: 2px</h3>
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                }}
              >
                <ScanProgressDisplay
                  {...args}
                  variant="border"
                  borderHeight={2}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>
                Border Height: 4px (Default)
              </h3>
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                }}
              >
                <ScanProgressDisplay
                  {...args}
                  variant="border"
                  borderHeight={4}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '10px' }}>Border Height: 8px</h3>
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                }}
              >
                <ScanProgressDisplay
                  {...args}
                  variant="border"
                  borderHeight={8}
                />
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: '10px' }}>
                Border Height: 4px with Progress Text
              </h3>
              <div
                style={{
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                }}
              >
                <ScanProgressDisplay
                  {...args}
                  variant="border"
                  borderHeight={4}
                  showBorderProgress
                />
              </div>
            </div>
          </div>
        )}
      </ProgressStory>
    </MockWebSocketProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows different border height variants and the optional progress text display.',
      },
    },
  },
};

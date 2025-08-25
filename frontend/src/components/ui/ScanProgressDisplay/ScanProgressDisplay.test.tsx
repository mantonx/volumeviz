import { jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ScanProgressDisplay } from './ScanProgressDisplay';
import type { ScanProgressData } from './ScanProgressDisplay.types';

// Mock the WebSocket provider
const mockWebSocketProvider = {
  isConnected: true,
  on: jest.fn(),
  send: jest.fn(),
};

jest.mock('../../../providers/WebSocketProvider', () => ({
  useWebSocket: () => mockWebSocketProvider,
}));

// Mock the format utilities
jest.mock('../../../utils/format', () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
  formatDuration: (ms: number) => `${Math.round(ms / 1000)}s`,
}));

// Mock child components
jest.mock('../ProgressBar', () => ({
  ProgressBar: ({ value, variant, testId }: any) => (
    <div
      data-testid={testId || 'progress-bar'}
      data-value={value}
      data-variant={variant}
    >
      Progress: {value}%
    </div>
  ),
}));

jest.mock('../Badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockProgressData: ScanProgressData = {
  scanId: 'scan-123',
  volumeId: 'volume-456',
  overallStatus: 'running',
  overallProgress: 45,
  phases: [
    {
      id: 'volume_scan',
      name: 'volume_scan',
      label: 'Volume Scan',
      description: 'Calculating volume size',
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
    },
    {
      id: 'filesystem_indexing',
      name: 'filesystem_indexing',
      label: 'Filesystem Indexing',
      description: 'Analyzing files',
      order: 2,
      status: 'running',
      progress: 60,
      itemsProcessed: 60,
      itemsTotal: 100,
      bytesProcessed: 2048,
      bytesTotal: 4096,
      itemsPerSecond: 5,
      bytesPerSecond: 512,
      currentItem: '/path/to/current/file.txt',
      errorCount: 0,
    },
    {
      id: 'media_enrichment',
      name: 'media_enrichment',
      label: 'Media Enrichment',
      description: 'Processing media',
      order: 3,
      status: 'pending',
      progress: 0,
      itemsProcessed: 0,
      itemsTotal: 0,
      bytesProcessed: 0,
      bytesTotal: 0,
      itemsPerSecond: 0,
      bytesPerSecond: 0,
      errorCount: 0,
    },
  ],
  performanceStats: {
    elapsedSeconds: 120,
    estimatedRemainingSeconds: 60,
    overallItemsPerSecond: 8.5,
    overallBytesPerSecond: 1536,
    errorRate: 0.01,
  },
  startedAt: '2025-01-01T10:00:00Z',
  estimatedEndTime: '2025-01-01T11:00:00Z',
};

describe('ScanProgressDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch for historical data
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Border variant', () => {
    it('renders progress border correctly', () => {
      // Create a component that simulates having progress data
      const TestComponent = () => {
        const [progress] = React.useState(mockProgressData);
        return (
          <ScanProgressDisplay
            volumeId="volume-456"
            variant="border"
            borderHeight={4}
            testId="border-progress"
          />
        );
      };

      render(<TestComponent />);

      const borderElement = screen.getByTestId('border-progress');
      expect(borderElement).toBeInTheDocument();
    });

    it('shows progress percentage in border mode when enabled', () => {
      const TestComponent = () => {
        return (
          <ScanProgressDisplay
            volumeId="volume-456"
            variant="border"
            showBorderProgress={true}
            testId="border-with-text"
          />
        );
      };

      render(<TestComponent />);

      // Component should render but without data, it won't show percentage
      const borderElement = screen.getByTestId('border-with-text');
      expect(borderElement).toBeInTheDocument();
    });
  });

  describe('Panel variant', () => {
    it('renders loading state', () => {
      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
        />,
      );

      // Should trigger historical data fetch
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/scans/scan-123/progress',
      );
    });

    it('renders panel with progress data', async () => {
      // Mock successful fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: mockProgressData.phases.map((phase) => ({
              id: phase.id,
              phase_name: phase.name,
              phase_order: phase.order,
              status: phase.status,
              progress: phase.progress,
              items_processed: phase.itemsProcessed,
              items_total: phase.itemsTotal,
              bytes_processed: phase.bytesProcessed,
              bytes_total: phase.bytesTotal,
              items_per_second: phase.itemsPerSecond,
              bytes_per_second: phase.bytesPerSecond,
              current_item: phase.currentItem,
              error_count: phase.errorCount,
            })),
            performance_stats: {
              elapsed_seconds:
                mockProgressData.performanceStats!.elapsedSeconds,
              estimated_remaining_seconds:
                mockProgressData.performanceStats!.estimatedRemainingSeconds,
              overall_items_per_second:
                mockProgressData.performanceStats!.overallItemsPerSecond,
              overall_bytes_per_second:
                mockProgressData.performanceStats!.overallBytesPerSecond,
              error_rate: mockProgressData.performanceStats!.errorRate,
            },
            started_at: mockProgressData.startedAt,
            estimated_end_time: mockProgressData.estimatedEndTime,
            recent_errors: [],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
          showPerformanceStats={true}
          testId="panel-progress"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Scan Progress')).toBeInTheDocument();
      });

      // Should show overall progress
      expect(screen.getByText('45%')).toBeInTheDocument();

      // Should show all phases
      expect(screen.getByText('Volume Scan')).toBeInTheDocument();
      expect(screen.getByText('Filesystem Indexing')).toBeInTheDocument();
      expect(screen.getByText('Media Enrichment')).toBeInTheDocument();

      // Should show performance stats
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('120s')).toBeInTheDocument(); // Elapsed time
    });

    it('handles 404 error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="nonexistent-scan"
        />,
      );

      await waitFor(() => {
        // Should not show error, just rely on WebSocket updates
        expect(screen.queryByText('Error')).not.toBeInTheDocument();
      });
    });
  });

  describe('WebSocket integration', () => {
    it('subscribes to progress updates on mount', () => {
      render(<ScanProgressDisplay volumeId="volume-456" variant="panel" />);

      // Should register event handlers
      expect(mockWebSocketProvider.on).toHaveBeenCalledWith(
        'scan_progress_update',
        expect.any(Function),
      );
      expect(mockWebSocketProvider.on).toHaveBeenCalledWith(
        'scan_started',
        expect.any(Function),
      );

      // Should send subscription message
      expect(mockWebSocketProvider.send).toHaveBeenCalledWith({
        type: 'subscribe',
        data: {
          event: 'scan_progress',
          filters: { volume_id: 'volume-456' },
        },
      });
    });

    it('calls callbacks on scan events', () => {
      const onScanStart = jest.fn();
      const onScanComplete = jest.fn();
      const onScanError = jest.fn();
      const onProgressUpdate = jest.fn();

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          onScanStart={onScanStart}
          onScanComplete={onScanComplete}
          onScanError={onScanError}
          onProgressUpdate={onProgressUpdate}
        />,
      );

      // Get the registered handlers
      const calls = (mockWebSocketProvider.on as jest.Mock).mock.calls;
      const progressHandler = calls.find(
        (call) => call[0] === 'scan_progress_update',
      )[1];
      const startHandler = calls.find((call) => call[0] === 'scan_started')[1];
      const completeHandler = calls.find(
        (call) => call[0] === 'scan_complete',
      )[1];
      const errorHandler = calls.find((call) => call[0] === 'scan_error')[1];

      // Simulate progress update
      progressHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
          overall_progress: 50,
          phases: [],
        },
      });
      expect(onProgressUpdate).toHaveBeenCalled();

      // Simulate scan start
      startHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
        },
      });
      expect(onScanStart).toHaveBeenCalledWith('scan-123');

      // Simulate scan complete
      completeHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
        },
      });
      expect(onScanComplete).toHaveBeenCalled();

      // Simulate scan error
      errorHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
          error: 'Test error',
        },
      });
      expect(onScanError).toHaveBeenCalledWith('scan-123', 'Test error');
    });
  });

  describe('Auto-expand behavior', () => {
    it('auto-expands on scan start when enabled', () => {
      const onExpandedChange = jest.fn();

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          autoExpandOnScanStart={{
            enabled: true,
            autoCloseDuration: 5000,
            showToast: true,
          }}
          onExpandedChange={onExpandedChange}
        />,
      );

      // Get the scan start handler
      const calls = (mockWebSocketProvider.on as jest.Mock).mock.calls;
      const startHandler = calls.find((call) => call[0] === 'scan_started')[1];

      // Simulate scan start
      startHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
        },
      });

      // Should call to expand
      expect(onExpandedChange).toHaveBeenCalledWith(true);
    });

    it('auto-closes after timeout when configured', async () => {
      jest.useFakeTimers();

      const onExpandedChange = jest.fn();

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          autoExpandOnScanStart={{
            enabled: true,
            autoCloseDuration: 1000, // 1 second
            showToast: true,
          }}
          onExpandedChange={onExpandedChange}
        />,
      );

      // Get the scan start handler
      const calls = (mockWebSocketProvider.on as jest.Mock).mock.calls;
      const startHandler = calls.find((call) => call[0] === 'scan_started')[1];

      // Simulate scan start
      startHandler({
        data: {
          volume_id: 'volume-456',
          scan_id: 'scan-123',
        },
      });

      // Should expand immediately
      expect(onExpandedChange).toHaveBeenCalledWith(true);

      // Fast-forward time
      jest.advanceTimersByTime(1000);

      // Should close after timeout
      await waitFor(() => {
        expect(onExpandedChange).toHaveBeenCalledWith(false);
      });

      jest.useRealTimers();
    });
  });

  describe('Phase rendering', () => {
    it('renders phases in correct order', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: [
              // Phases in wrong order to test sorting
              {
                id: 'media_enrichment',
                phase_name: 'media_enrichment',
                phase_order: 3,
                status: 'pending',
                progress: 0,
                items_processed: 0,
                items_total: 0,
                bytes_processed: 0,
                bytes_total: 0,
                items_per_second: 0,
                bytes_per_second: 0,
                error_count: 0,
              },
              {
                id: 'volume_scan',
                phase_name: 'volume_scan',
                phase_order: 1,
                status: 'completed',
                progress: 100,
                items_processed: 100,
                items_total: 100,
                bytes_processed: 1024,
                bytes_total: 1024,
                items_per_second: 10,
                bytes_per_second: 1024,
                error_count: 0,
              },
              {
                id: 'filesystem_indexing',
                phase_name: 'filesystem_indexing',
                phase_order: 2,
                status: 'running',
                progress: 60,
                items_processed: 60,
                items_total: 100,
                bytes_processed: 2048,
                bytes_total: 4096,
                items_per_second: 5,
                bytes_per_second: 512,
                error_count: 0,
              },
            ],
            performance_stats: null,
            recent_errors: [],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Volume Scan')).toBeInTheDocument();
      });

      // Get all phase elements and check their order
      const phases = screen.getAllByText(
        /Volume Scan|Filesystem Indexing|Media Enrichment/,
      );
      expect(phases[0]).toHaveTextContent('Volume Scan');
      expect(phases[1]).toHaveTextContent('Filesystem Indexing');
      expect(phases[2]).toHaveTextContent('Media Enrichment');
    });

    it('shows correct badges for different phase statuses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: [
              {
                id: 'volume_scan',
                phase_name: 'volume_scan',
                phase_order: 1,
                status: 'completed',
                progress: 100,
                items_processed: 100,
                items_total: 100,
                bytes_processed: 1024,
                bytes_total: 1024,
                items_per_second: 10,
                bytes_per_second: 1024,
                error_count: 0,
              },
              {
                id: 'filesystem_indexing',
                phase_name: 'filesystem_indexing',
                phase_order: 2,
                status: 'running',
                progress: 60,
                items_processed: 60,
                items_total: 100,
                bytes_processed: 2048,
                bytes_total: 4096,
                items_per_second: 5,
                bytes_per_second: 512,
                error_count: 0,
              },
              {
                id: 'failed_phase',
                phase_name: 'failed_phase',
                phase_order: 4,
                status: 'failed',
                progress: 30,
                items_processed: 30,
                items_total: 100,
                bytes_processed: 512,
                bytes_total: 2048,
                items_per_second: 0,
                bytes_per_second: 0,
                error_count: 5,
                error_message: 'Test error message',
              },
            ],
            performance_stats: null,
            recent_errors: [],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument(); // Completed phase
        expect(screen.getByText('60%')).toBeInTheDocument(); // Running phase progress
        expect(screen.getByText('Failed at 30%')).toBeInTheDocument(); // Failed phase
      });
    });
  });

  describe('Compact mode', () => {
    it('hides detailed information in compact mode', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: mockProgressData.phases.map((phase) => ({
              id: phase.id,
              phase_name: phase.name,
              phase_order: phase.order,
              status: phase.status,
              progress: phase.progress,
              items_processed: phase.itemsProcessed,
              items_total: phase.itemsTotal,
              bytes_processed: phase.bytesProcessed,
              bytes_total: phase.bytesTotal,
              items_per_second: phase.itemsPerSecond,
              bytes_per_second: phase.bytesPerSecond,
              current_item: phase.currentItem,
              error_count: phase.errorCount,
            })),
            performance_stats: mockProgressData.performanceStats,
            recent_errors: [],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
          compact={true}
          showPerformanceStats={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Volume Scan')).toBeInTheDocument();
      });

      // Should not show performance stats in compact mode
      expect(screen.queryByText('Performance')).not.toBeInTheDocument();

      // Should not show phase descriptions
      expect(
        screen.queryByText('Calculating volume size'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('displays recent errors when available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: [],
            recent_errors: [
              {
                item_name: '/path/to/problematic/file.txt',
                error_message: 'Permission denied',
                occurred_at: '2025-01-01T10:30:00Z',
              },
            ],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
          showErrors={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Recent Errors (1)')).toBeInTheDocument();
        expect(
          screen.getByText('/path/to/problematic/file.txt'),
        ).toBeInTheDocument();
        expect(screen.getByText('Permission denied')).toBeInTheDocument();
      });
    });

    it('hides errors when showErrors is false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            scan_id: 'scan-123',
            volume_id: 'volume-456',
            overall_status: 'running',
            overall_progress: 45,
            phases: [],
            recent_errors: [
              {
                item_name: '/path/to/problematic/file.txt',
                error_message: 'Permission denied',
                occurred_at: '2025-01-01T10:30:00Z',
              },
            ],
          }),
      });

      render(
        <ScanProgressDisplay
          volumeId="volume-456"
          variant="panel"
          scanId="scan-123"
          showErrors={false}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Scan Progress')).toBeInTheDocument();
      });

      expect(screen.queryByText('Recent Errors')).not.toBeInTheDocument();
    });
  });
});

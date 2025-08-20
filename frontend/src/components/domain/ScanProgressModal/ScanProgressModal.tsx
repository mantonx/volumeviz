import { clsx } from 'clsx';
import {
  Download,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Square,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import { ErrorSummary } from '../../shared/ErrorSummary';
import { PerformanceDashboard } from '../../shared/PerformanceDashboard';
import { ProcessTimeline } from '../../shared/ProcessTimeline';
import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';

import type {
  ScanData,
  ScanProgressModalProps,
  ScanProgressModalState,
  ScanProgressTab,
  TabConfig,
} from './ScanProgressModal.types';
import { scanDataUtils } from '../../../utils';

/**
 * Modal component reference interface
 */
export interface ScanProgressModalRef {
  /** Focus the modal */
  focus(): void;
  /** Switch to a specific tab */
  switchTab(tab: ScanProgressTab): void;
  /** Refresh data */
  refresh(): void;
  /** Get current scan data */
  getScanData(): ScanData;
}

/**
 * ScanProgressModal - Comprehensive scan monitoring interface
 *
 * Combines all Tier 1 and Tier 2 components into a domain-specific composition
 * for real-time scan progress monitoring with multi-tab layout, WebSocket updates,
 * and comprehensive action handling.
 */
export const ScanProgressModal = forwardRef<
  ScanProgressModalRef,
  ScanProgressModalProps
>(
  (
    {
      open,
      scanData,
      connectionState,
      actions,
      activeTab = 'overview',
      onTabChange,
      showAdvancedDetails = false,
      enableRealTimeUpdates = true,
      updateInterval = 1000,
      size = 'lg',
      closable = true,
      showConnectionStatus = true,
      className,
      customTabs,
      autoCloseOnComplete = false,
      autoCloseDelay = 3000,
      customFooter,
      testId = 'scan-progress-modal',
    },
    ref,
  ) => {
    // Component state
    const [state, setState] = useState<ScanProgressModalState>({
      activeTab,
      showAdvancedDetails,
      lastUpdate: new Date(),
      autoRefresh: enableRealTimeUpdates,
      refreshInterval: updateInterval,
      expandedPhases: new Set(),
      selectedErrors: new Set(),
      performanceTimeRange: '5m',
    });

    // Update state when props change
    useEffect(() => {
      setState((prev) => ({
        ...prev,
        activeTab,
        showAdvancedDetails,
        autoRefresh: enableRealTimeUpdates,
        refreshInterval: updateInterval,
      }));
    }, [activeTab, showAdvancedDetails, enableRealTimeUpdates, updateInterval]);

    // Auto-close on completion
    useEffect(() => {
      if (
        autoCloseOnComplete &&
        scanDataUtils.isTerminalState(scanData.status)
      ) {
        const timer = setTimeout(() => {
          actions.onClose?.();
        }, autoCloseDelay);
        return () => clearTimeout(timer);
      }
    }, [autoCloseOnComplete, scanData.status, autoCloseDelay, actions]);

    // Calculate derived data
    const overallProgress = useMemo(
      () => scanDataUtils.calculateOverallProgress(scanData),
      [scanData],
    );

    const currentPhase = useMemo(
      () => scanDataUtils.getCurrentPhase(scanData),
      [scanData],
    );

    const estimatedCompletion = useMemo(
      () => scanDataUtils.getEstimatedCompletion(scanData),
      [scanData],
    );

    const timelineItems = useMemo(
      () => scanDataUtils.toTimelineItems(scanData),
      [scanData],
    );

    const performanceMetrics = useMemo(
      () => scanDataUtils.toPerformanceMetrics(scanData),
      [scanData],
    );

    const criticalErrors = useMemo(
      () =>
        scanDataUtils.filterErrorsBySeverity(
          [...scanData.errors, ...scanData.warnings],
          'critical',
        ),
      [scanData.errors, scanData.warnings],
    );

    const highErrors = useMemo(
      () =>
        scanDataUtils.filterErrorsBySeverity(
          [...scanData.errors, ...scanData.warnings],
          'high',
        ),
      [scanData.errors, scanData.warnings],
    );

    // Event handlers
    const handleTabChange = useCallback(
      (tab: ScanProgressTab) => {
        setState((prev) => ({ ...prev, activeTab: tab }));
        onTabChange?.(tab);
      },
      [onTabChange],
    );

    const handlePhaseToggle = useCallback((phaseId: string) => {
      setState((prev) => {
        const newExpanded = new Set(prev.expandedPhases);
        if (newExpanded.has(phaseId)) {
          newExpanded.delete(phaseId);
        } else {
          newExpanded.add(phaseId);
        }
        return { ...prev, expandedPhases: newExpanded };
      });
    }, []);

    const handleRefresh = useCallback(() => {
      setState((prev) => ({ ...prev, lastUpdate: new Date() }));
    }, []);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          // Focus implementation would go here
        },
        switchTab: (tab: ScanProgressTab) => {
          handleTabChange(tab);
        },
        refresh: handleRefresh,
        getScanData: () => scanData,
      }),
      [handleTabChange, handleRefresh, scanData],
    );

    // Default tab configurations
    const defaultTabs: TabConfig[] = useMemo(
      () => [
        {
          id: 'overview',
          label: 'Overview',
          content: (
            <div className="space-y-6">
              {/* Scan Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {scanData.context.volumeName}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {scanData.context.volumePath} • {scanData.context.scanType}{' '}
                    scan
                  </p>
                </div>
                <StatusBadge
                  variant={scanDataUtils.getStatusSeverity(scanData.status)}
                >
                  {scanData.status}
                </StatusBadge>
              </div>

              {/* Overall Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Overall Progress
                  </span>
                  <span className="text-sm text-gray-500">
                    {overallProgress}%
                  </span>
                </div>
                <ProgressBar
                  progress={overallProgress}
                  variant={scanData.status === 'failed' ? 'error' : 'default'}
                  size="lg"
                  showPercentage={false}
                  animated={!scanDataUtils.isTerminalState(scanData.status)}
                />
              </div>

              {/* Current Phase */}
              {currentPhase && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-blue-900">
                      {currentPhase.name}
                    </h4>
                    <span className="text-sm text-blue-700">
                      {currentPhase.progress || 0}%
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 mb-3">
                    {currentPhase.description}
                  </p>
                  <ProgressBar
                    progress={currentPhase.progress || 0}
                    size="sm"
                    variant="info"
                    animated={true}
                  />
                  {currentPhase.details && (
                    <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-blue-600">
                      <div>
                        <span className="font-medium">Files:</span>{' '}
                        {currentPhase.details.filesProcessed?.toLocaleString()}{' '}
                        / {currentPhase.details.totalFiles?.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Current:</span>{' '}
                        {currentPhase.details.currentFile}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {scanData.statistics.processedFiles.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">Files Processed</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {scanDataUtils.formatFileSize(
                      scanData.statistics.processedSize,
                    )}
                  </div>
                  <div className="text-sm text-gray-500">Data Processed</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {scanData.statistics.throughput.filesPerSecond.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500">Files/Second</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {scanDataUtils.formatDuration(
                      scanData.statistics.timing.elapsedTime,
                    )}
                  </div>
                  <div className="text-sm text-gray-500">Elapsed Time</div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Scan Phases</h4>
                <ProcessTimeline
                  items={timelineItems}
                  orientation="vertical"
                  showProgress={true}
                  compact={false}
                  expandable={true}
                  onItemClick={(item) => handlePhaseToggle(item.id)}
                />
              </div>
            </div>
          ),
        },
        {
          id: 'performance',
          label: 'Performance',
          content: (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Performance Metrics
                </h3>
                <select
                  value={state.performanceTimeRange}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      performanceTimeRange: e.target
                        .value as typeof prev.performanceTimeRange,
                    }))
                  }
                  className="text-sm border-gray-300 rounded-md"
                >
                  <option value="1m">Last 1 minute</option>
                  <option value="5m">Last 5 minutes</option>
                  <option value="15m">Last 15 minutes</option>
                  <option value="1h">Last 1 hour</option>
                </select>
              </div>
              <PerformanceDashboard
                metrics={performanceMetrics}
                layout="grid"
                timeRange={state.performanceTimeRange}
                showDetails={true}
                enableRefresh={state.autoRefresh}
                refreshInterval={state.refreshInterval}
              />
            </div>
          ),
        },
        {
          id: 'errors',
          label: 'Errors',
          badge: scanData.errors.length + scanData.warnings.length || undefined,
          content: (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Errors & Warnings
                </h3>
                <div className="flex gap-2">
                  <StatusBadge variant="error" size="sm">
                    {criticalErrors.length + highErrors.length} High Priority
                  </StatusBadge>
                  <StatusBadge variant="warning" size="sm">
                    {scanData.warnings.length} Warnings
                  </StatusBadge>
                </div>
              </div>
              <ErrorSummary
                errors={[...scanData.errors, ...scanData.warnings]}
                layout="list"
                groupByCategory={true}
                showRetryActions={true}
                showAcknowledgeActions={true}
                onRetry={actions.onRetryError}
                onAcknowledge={actions.onAcknowledgeError}
                onDismiss={actions.onDismissError}
                maxHeight="400px"
                collapseResolved={true}
              />
            </div>
          ),
        },
        {
          id: 'details',
          label: 'Details',
          content: (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Scan Details
              </h3>

              {/* Scan Context */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  Scan Configuration
                </h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-gray-700">Scan ID:</dt>
                    <dd className="text-gray-600 font-mono">
                      {scanData.context.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Volume ID:</dt>
                    <dd className="text-gray-600 font-mono">
                      {scanData.context.volumeId}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Type:</dt>
                    <dd className="text-gray-600">
                      {scanData.context.scanType}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Trigger:</dt>
                    <dd className="text-gray-600">
                      {scanData.context.trigger}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">
                      Include Hidden:
                    </dt>
                    <dd className="text-gray-600">
                      {scanData.context.options.includeHidden ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">
                      Metadata Extraction:
                    </dt>
                    <dd className="text-gray-600">
                      {scanData.context.options.enableMetadataExtraction
                        ? 'Enabled'
                        : 'Disabled'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Timing Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  Timing Information
                </h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-gray-700">Started:</dt>
                    <dd className="text-gray-600">
                      {scanData.statistics.timing.startTime.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-700">Elapsed:</dt>
                    <dd className="text-gray-600">
                      {scanDataUtils.formatDuration(
                        scanData.statistics.timing.elapsedTime,
                      )}
                    </dd>
                  </div>
                  {estimatedCompletion && (
                    <div>
                      <dt className="font-medium text-gray-700">
                        Estimated Completion:
                      </dt>
                      <dd className="text-gray-600">
                        {estimatedCompletion.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {scanData.statistics.timing.remainingTime && (
                    <div>
                      <dt className="font-medium text-gray-700">Remaining:</dt>
                      <dd className="text-gray-600">
                        {scanDataUtils.formatDuration(
                          scanData.statistics.timing.remainingTime,
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Advanced Statistics */}
              {state.showAdvancedDetails && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Advanced Statistics
                  </h4>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="font-medium text-gray-700">
                        Average File Size:
                      </dt>
                      <dd className="text-gray-600">
                        {scanDataUtils.formatFileSize(
                          scanData.statistics.averageFileSize,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Average Throughput:
                      </dt>
                      <dd className="text-gray-600">
                        {scanData.statistics.throughput.averageThroughput.toFixed(
                          1,
                        )}{' '}
                        files/s
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Skipped Files:
                      </dt>
                      <dd className="text-gray-600">
                        {scanData.statistics.skippedFiles.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-700">
                        Error Files:
                      </dt>
                      <dd className="text-gray-600">
                        {scanData.statistics.errorFiles.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          ),
        },
      ],
      [
        scanData,
        overallProgress,
        currentPhase,
        timelineItems,
        performanceMetrics,
        criticalErrors,
        highErrors,
        state,
        actions,
        estimatedCompletion,
        handlePhaseToggle,
      ],
    );

    // Merge custom tabs with defaults
    const allTabs = useMemo(() => {
      if (!customTabs) return defaultTabs;
      return [...defaultTabs, ...customTabs];
    }, [defaultTabs, customTabs]);

    // Connection status component
    const ConnectionStatus = () => {
      if (!showConnectionStatus) return null;

      return (
        <div
          className={clsx(
            'flex items-center gap-2 text-xs px-2 py-1 rounded-full',
            connectionState.connected
              ? 'bg-green-100 text-green-700'
              : connectionState.reconnecting
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700',
          )}
        >
          {connectionState.connected ? (
            <>
              <Wifi className="w-3 h-3" />
              Connected
            </>
          ) : connectionState.reconnecting ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Reconnecting...
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Disconnected
            </>
          )}
        </div>
      );
    };

    // Modal size classes
    const sizeClasses = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-4xl',
      xl: 'max-w-6xl',
      full: 'max-w-full mx-4',
    };

    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-progress-title"
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={closable ? actions.onClose : undefined}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className={clsx(
              'relative bg-white rounded-lg shadow-xl w-full',
              sizeClasses[size],
              className,
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <h2
                  id="scan-progress-title"
                  className="text-xl font-semibold text-gray-900"
                >
                  Scan Progress
                </h2>
                <ConnectionStatus />
              </div>
              <div className="flex items-center gap-2">
                {/* Action buttons */}
                {scanDataUtils.canPause(scanData.status) && (
                  <button
                    onClick={actions.onPause}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="Pause scan"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                )}
                {scanDataUtils.canResume(scanData.status) && (
                  <button
                    onClick={actions.onResume}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="Resume scan"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                )}
                {scanDataUtils.canCancel(scanData.status) && (
                  <button
                    onClick={actions.onCancel}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    title="Cancel scan"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                )}
                {actions.onViewDetails && (
                  <button
                    onClick={() => actions.onViewDetails?.(scanData.context.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                )}
                {actions.onDownloadReport && (
                  <button
                    onClick={() =>
                      actions.onDownloadReport?.(scanData.context.id)
                    }
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="Download report"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
                {closable && (
                  <button
                    onClick={actions.onClose}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {allTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    disabled={tab.disabled}
                    className={clsx(
                      'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2',
                      state.activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                      tab.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                    {tab.badge && (
                      <span
                        className={clsx(
                          'ml-2 py-0.5 px-2 rounded-full text-xs font-medium',
                          state.activeTab === tab.id
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800',
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {allTabs.find((tab) => tab.id === state.activeTab)?.content}
            </div>

            {/* Footer */}
            {customFooter && (
              <div className="border-t border-gray-200 px-6 py-4">
                {customFooter}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

ScanProgressModal.displayName = 'ScanProgressModal';

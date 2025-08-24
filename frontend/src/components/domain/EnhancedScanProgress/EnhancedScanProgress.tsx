import React, { useMemo, useState } from 'react';
import {
  Clock,
  File,
  FolderOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  FileAudio,
  FileVideo,
  FileImage,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
  Database,
  Eye,
} from 'lucide-react';
import { clsx } from 'clsx';

import { ProgressBar } from '../../ui/ProgressBar';
import { Badge } from '../../ui/Badge';
import { formatBytes, formatDuration } from '../../../utils/format';
import type {
  ComprehensiveScanProgress,
  ScanPhaseProgress,
  ScanProgressError,
} from '../../ui/MultiPhaseProgressBar/MultiPhaseProgressBar.types';

interface EnhancedFileContext {
  currentFile?: string;
  currentFileSize?: number;
  currentFileType?: string;
  currentDirectory?: string;
  currentBatch?: {
    number: number;
    totalBatches: number;
    filesInBatch: number;
    batchProgress: number;
  };
  processingStep?: string;
  recentFiles?: string[];
  fileTypesProcessed?: {
    videos: number;
    images: number;
    audio: number;
    documents: number;
    others: number;
  };
}

interface EnhancedScanProgressProps {
  progress: ComprehensiveScanProgress;
  showFileContext?: boolean;
  showBatchInfo?: boolean;
  showPerformanceMetrics?: boolean;
  showRecentActivity?: boolean;
  showPhaseTransitions?: boolean;
  expandedByDefault?: boolean;
  onPhaseTransition?: (fromPhase: string, toPhase: string) => void;
  className?: string;
  testId?: string;
}

/**
 * EnhancedScanProgress - Advanced scan progress visualization with detailed file context
 *
 * Provides rich contextual information during scan operations including:
 * - Current file being processed with metadata
 * - Batch processing information
 * - Real-time performance metrics
 * - Phase transition notifications
 * - Enhanced error context with file details
 * - Recent activity feed
 */
export const EnhancedScanProgress: React.FC<EnhancedScanProgressProps> = ({
  progress,
  showFileContext = true,
  showBatchInfo = true,
  showPerformanceMetrics = true,
  showRecentActivity = true,
  showPhaseTransitions = true,
  expandedByDefault = false,
  onPhaseTransition,
  className,
  testId = 'enhanced-scan-progress',
}) => {
  const [expandedSections, setExpandedSections] = useState({
    fileContext: expandedByDefault,
    batchInfo: expandedByDefault,
    performance: expandedByDefault,
    recentActivity: expandedByDefault,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Extract enhanced file context from progress data
  const fileContext = useMemo((): EnhancedFileContext => {
    const currentPhase = progress.phases.find((p) => p.status === 'running');
    if (!currentPhase) return {};

    // Parse current item if available (enhanced format: "path|size|type|step")
    const currentItem = currentPhase.current_item;
    const itemParts = currentItem?.split('|') || [];

    return {
      currentFile: itemParts[0] || currentItem,
      currentFileSize: itemParts[1] ? parseInt(itemParts[1], 10) : undefined,
      currentFileType: itemParts[2],
      currentDirectory: currentItem
        ? currentItem.substring(0, currentItem.lastIndexOf('/'))
        : undefined,
      processingStep: itemParts[3] || 'Processing',
      // Batch information (if available in phase data)
      currentBatch:
        currentPhase.items_total > 1000
          ? {
              number: Math.floor(currentPhase.items_processed / 1000) + 1,
              totalBatches: Math.ceil(currentPhase.items_total / 1000),
              filesInBatch: Math.min(
                1000,
                currentPhase.items_total -
                  Math.floor(currentPhase.items_processed / 1000) * 1000,
              ),
              batchProgress:
                ((currentPhase.items_processed % 1000) /
                  Math.min(
                    1000,
                    currentPhase.items_total -
                      Math.floor(currentPhase.items_processed / 1000) * 1000,
                  )) *
                100,
            }
          : undefined,
      // Mock recent files for demonstration (in real implementation, this would come from WebSocket)
      recentFiles: currentItem ? [currentItem] : [],
    };
  }, [progress.phases]);

  // Get file type icon
  const getFileTypeIcon = (fileType?: string, fileName?: string) => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    const iconClass = 'w-4 h-4';

    if (
      fileType?.startsWith('video/') ||
      ['mp4', 'avi', 'mkv', 'mov', 'wmv'].includes(extension || '')
    ) {
      return <FileVideo className={clsx(iconClass, 'text-purple-500')} />;
    }
    if (
      fileType?.startsWith('audio/') ||
      ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(extension || '')
    ) {
      return <FileAudio className={clsx(iconClass, 'text-green-500')} />;
    }
    if (
      fileType?.startsWith('image/') ||
      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')
    ) {
      return <FileImage className={clsx(iconClass, 'text-blue-500')} />;
    }
    if (['txt', 'doc', 'docx', 'pdf', 'md'].includes(extension || '')) {
      return <FileText className={clsx(iconClass, 'text-gray-500')} />;
    }
    return <File className={clsx(iconClass, 'text-gray-400')} />;
  };

  // Get current phase for enhanced display
  const currentPhase = progress.phases.find((p) => p.status === 'running');
  const nextPhase = progress.phases.find((p) => p.status === 'pending');

  // Calculate enhanced performance metrics
  const performanceMetrics = useMemo(() => {
    const stats = progress.performance_stats;
    if (!stats) return null;

    return {
      throughput: stats.overall_items_per_second,
      dataRate: stats.overall_bytes_per_second,
      efficiency:
        stats.error_rate < 0.01
          ? 'Excellent'
          : stats.error_rate < 0.05
            ? 'Good'
            : 'Needs Attention',
      eta: stats.estimated_remaining_seconds,
      memoryPressure: stats.memory_usage_bytes
        ? (stats.memory_usage_bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
        : undefined,
      cpuUsage: stats.cpu_usage_percent
        ? Math.round(stats.cpu_usage_percent) + '%'
        : undefined,
    };
  }, [progress.performance_stats]);

  return (
    <div className={clsx('space-y-4', className)} data-testid={testId}>
      {/* Phase Transition Banner */}
      {showPhaseTransitions && currentPhase && nextPhase && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
              <div>
                <h4 className="font-medium text-blue-900">Phase Transition</h4>
                <p className="text-sm text-blue-700">
                  Currently in{' '}
                  <strong>{currentPhase.phase_name.replace('_', ' ')}</strong>
                  {nextPhase && (
                    <span className="ml-2 text-blue-600">
                      → Next:{' '}
                      <strong>{nextPhase.phase_name.replace('_', ' ')}</strong>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Badge variant="info" size="sm">
              {currentPhase.progress}% Complete
            </Badge>
          </div>
        </div>
      )}

      {/* Current File Context */}
      {showFileContext && fileContext.currentFile && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection('fileContext')}
          >
            <div className="flex items-center space-x-3">
              {getFileTypeIcon(
                fileContext.currentFileType,
                fileContext.currentFile,
              )}
              <div>
                <h4 className="font-medium text-gray-900">
                  Currently Processing
                </h4>
                <p className="text-sm text-gray-500">
                  {fileContext.processingStep || 'Processing file'}
                </p>
              </div>
            </div>
            {expandedSections.fileContext ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {expandedSections.fileContext && (
            <div className="border-t border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    File Path
                  </div>
                  <div
                    className="text-sm text-gray-900 font-mono truncate"
                    title={fileContext.currentFile}
                  >
                    {fileContext.currentFile}
                  </div>
                </div>
                {fileContext.currentFileSize && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      File Size
                    </div>
                    <div className="text-sm text-gray-900">
                      {formatBytes(fileContext.currentFileSize)}
                    </div>
                  </div>
                )}
                {fileContext.currentFileType && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      File Type
                    </div>
                    <div className="text-sm text-gray-900">
                      {fileContext.currentFileType}
                    </div>
                  </div>
                )}
                {fileContext.currentDirectory && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Directory
                    </div>
                    <div
                      className="text-sm text-gray-900 font-mono truncate"
                      title={fileContext.currentDirectory}
                    >
                      <FolderOpen className="w-4 h-4 inline mr-1" />
                      {fileContext.currentDirectory}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch Processing Information */}
      {showBatchInfo && fileContext.currentBatch && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection('batchInfo')}
          >
            <div className="flex items-center space-x-3">
              <Database className="w-5 h-5 text-indigo-600" />
              <div>
                <h4 className="font-medium text-gray-900">Batch Processing</h4>
                <p className="text-sm text-gray-500">
                  Batch {fileContext.currentBatch.number} of{' '}
                  {fileContext.currentBatch.totalBatches}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {fileContext.currentBatch.batchProgress.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">Batch Progress</div>
            </div>
          </div>

          {expandedSections.batchInfo && (
            <div className="border-t border-gray-100 p-4">
              <div className="space-y-3">
                <ProgressBar
                  value={fileContext.currentBatch.batchProgress}
                  variant="info"
                  size="sm"
                  showLabel={true}
                  animated={true}
                  className="w-full"
                />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {fileContext.currentBatch.filesInBatch}
                    </div>
                    <div className="text-xs text-gray-500">Files in Batch</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {fileContext.currentBatch.number}
                    </div>
                    <div className="text-xs text-gray-500">Current Batch</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {fileContext.currentBatch.totalBatches}
                    </div>
                    <div className="text-xs text-gray-500">Total Batches</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Performance Metrics */}
      {showPerformanceMetrics && performanceMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection('performance')}
          >
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <h4 className="font-medium text-gray-900">
                  Performance Metrics
                </h4>
                <p className="text-sm text-gray-500">
                  {Math.round(performanceMetrics.throughput)} files/sec •{' '}
                  {performanceMetrics.efficiency} efficiency
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-gray-900">
                {formatBytes(performanceMetrics.dataRate)}/s
              </span>
            </div>
          </div>

          {expandedSections.performance && (
            <div className="border-t border-gray-100 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="font-bold text-green-700 text-lg">
                    {Math.round(performanceMetrics.throughput)}
                  </div>
                  <div className="text-green-600 text-xs">Files/Second</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="font-bold text-blue-700 text-lg">
                    {formatBytes(performanceMetrics.dataRate)}
                  </div>
                  <div className="text-blue-600 text-xs">Data/Second</div>
                </div>
                {performanceMetrics.eta && (
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="font-bold text-purple-700 text-lg">
                      {formatDuration(performanceMetrics.eta * 1000)}
                    </div>
                    <div className="text-purple-600 text-xs">ETA</div>
                  </div>
                )}
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-gray-700 text-lg">
                    {performanceMetrics.efficiency}
                  </div>
                  <div className="text-gray-600 text-xs">Efficiency</div>
                </div>
                {performanceMetrics.memoryPressure && (
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="font-bold text-orange-700 text-lg">
                      {performanceMetrics.memoryPressure}
                    </div>
                    <div className="text-orange-600 text-xs">Memory Usage</div>
                  </div>
                )}
                {performanceMetrics.cpuUsage && (
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="font-bold text-red-700 text-lg">
                      {performanceMetrics.cpuUsage}
                    </div>
                    <div className="text-red-600 text-xs">CPU Usage</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Feed */}
      {showRecentActivity && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => toggleSection('recentActivity')}
          >
            <div className="flex items-center space-x-3">
              <Eye className="w-5 h-5 text-gray-600" />
              <div>
                <h4 className="font-medium text-gray-900">Recent Activity</h4>
                <p className="text-sm text-gray-500">
                  Latest file processing activity
                </p>
              </div>
            </div>
            {expandedSections.recentActivity ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {expandedSections.recentActivity && (
            <div className="border-t border-gray-100 p-4">
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {fileContext.recentFiles?.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 text-sm"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {getFileTypeIcon(undefined, file)}
                    <span className="font-mono text-gray-700 truncate">
                      {file}
                    </span>
                    <span className="text-xs text-gray-500">just now</span>
                  </div>
                ))}
                {progress.recent_errors?.slice(0, 3).map((error, index) => (
                  <div
                    key={`error-${index}`}
                    className="flex items-center space-x-3 text-sm"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    {getFileTypeIcon(undefined, error.item_name)}
                    <span className="font-mono text-red-700 truncate">
                      {error.item_name}
                    </span>
                    <span className="text-xs text-red-500">
                      {error.error_message}
                    </span>
                  </div>
                ))}
                {!fileContext.recentFiles?.length &&
                  !progress.recent_errors?.length && (
                    <div className="text-center text-gray-500 py-4">
                      <Activity className="w-6 h-6 mx-auto mb-2 animate-pulse" />
                      <p className="text-sm">
                        Monitoring file processing activity...
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Error Context */}
      {progress.recent_errors && progress.recent_errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="font-medium text-red-900">
              Recent Issues ({progress.recent_errors.length})
            </h4>
          </div>
          <div className="space-y-3 max-h-32 overflow-y-auto">
            {progress.recent_errors.slice(0, 3).map((error, index) => (
              <div
                key={index}
                className="bg-white/70 border border-red-200 rounded-lg p-3"
              >
                <div className="flex items-start space-x-3">
                  {getFileTypeIcon(undefined, error.item_name)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-red-900 truncate">
                      {error.item_name}
                    </div>
                    <div className="text-sm text-red-700">
                      {error.error_message}
                    </div>
                    <div className="text-xs text-red-600 mt-1">
                      {error.component} • {error.operation} •{' '}
                      {new Date(error.occurred_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <Badge variant="error" size="sm">
                    {error.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

EnhancedScanProgress.displayName = 'EnhancedScanProgress';

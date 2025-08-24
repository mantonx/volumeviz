import React, { useMemo, useState } from 'react';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  Filter,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { StatusBadge } from '../../ui/StatusBadge';
import { formatBytes, formatNumber } from '../../../utils';
import type {
  ScanHistoryPanelProps,
  ScanHistoryEntryCardProps,
} from './ScanHistoryPanel.types';

const ScanHistoryEntryCard: React.FC<ScanHistoryEntryCardProps> = ({
  entry,
  onClick,
  onDelete,
  showDetails = false,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(showDetails);

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  return (
    <Card
      className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${className}`}
    >
      <div onClick={() => onClick?.(entry)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {getStatusIcon(entry.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {entry.volumeName}
                </h4>
                <StatusBadge
                  variant={getStatusVariant(entry.status)}
                  label={entry.status}
                  size="sm"
                />
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {new Date(entry.startedAt).toLocaleString()}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Duration
                  </span>
                  <div className="font-medium">
                    {formatDuration(entry.duration)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    Files
                  </span>
                  <div className="font-medium">
                    {formatNumber(entry.filesScanned)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {entry.errorCount > 0 && (
              <Badge variant="error" size="sm">
                {entry.errorCount} errors
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(entry.scanId);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Folders
                </span>
                <div className="font-medium">
                  {formatNumber(entry.foldersScanned)}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Avg Speed
                </span>
                <div className="font-medium">
                  {formatNumber(entry.averageFilesPerSecond)} files/s
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  Peak Speed
                </span>
                <div className="font-medium">
                  {formatNumber(entry.peakFilesPerSecond)} files/s
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Method</span>
                <div className="font-medium capitalize">{entry.scanMethod}</div>
              </div>
            </div>

            {entry.phases.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scan Phases
                </h5>
                <div className="space-y-2">
                  {entry.phases.map((phase, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="capitalize font-medium">
                          {phase.phase.replace('_', ' ')}
                        </div>
                        {phase.duration && (
                          <span className="text-gray-500 dark:text-gray-400">
                            ({formatDuration(phase.duration)})
                          </span>
                        )}
                      </div>
                      <div className="text-gray-600 dark:text-gray-400">
                        {formatNumber(phase.filesProcessed)} files
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entry.errors && entry.errors.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-red-700 dark:text-red-300 mb-2">
                  Recent Errors
                </h5>
                <div className="space-y-1">
                  {entry.errors.slice(0, 3).map((error, index) => (
                    <div
                      key={index}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      <div className="font-medium">
                        {error.errorType.replace('_', ' ')}
                      </div>
                      <div className="text-red-500 dark:text-red-500 truncate">
                        {error.path}: {error.errorMessage}
                      </div>
                    </div>
                  ))}
                  {entry.errors.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ... and {entry.errors.length - 3} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export const ScanHistoryPanel: React.FC<ScanHistoryPanelProps> = ({
  entries = [],
  loading = false,
  error = null,
  showFilters = true,
  showExport = true,
  maxEntries = 20,
  onFilterChange,
  onEntryClick,
  onEntryDelete,
  onExport,
  onRefresh,
  onClearHistory,
  className = '',
  testId = 'scan-history-panel',
}) => {
  const [showingAll, setShowingAll] = useState(false);

  const displayedEntries = useMemo(() => {
    if (showingAll) return entries;
    return entries.slice(0, maxEntries);
  }, [entries, maxEntries, showingAll]);

  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status === 'completed').length;
    const failed = entries.filter((e) => e.status === 'failed').length;
    const cancelled = entries.filter((e) => e.status === 'cancelled').length;
    const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
    const avgDuration = entries.length > 0 ? totalDuration / entries.length : 0;

    return {
      total: entries.length,
      completed,
      failed,
      cancelled,
      avgDuration,
    };
  }, [entries]);

  if (error) {
    return (
      <Card className={`p-6 ${className}`} data-testid={testId}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Failed to load scan history
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{error}</p>
          {onRefresh && (
            <Button onClick={onRefresh} className="mt-4">
              Try Again
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className={className} data-testid={testId}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Scan History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {stats.total} scans • {stats.completed} completed • {stats.failed}{' '}
              failed
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {showExport && onExport && (
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExport('csv')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onExport('json')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </div>
            )}

            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            )}

            {onClearHistory && entries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearHistory}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {loading && entries.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading scan history...
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No scan history
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Start scanning volumes to see their history here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedEntries.map((entry) => (
              <ScanHistoryEntryCard
                key={entry.id}
                entry={entry}
                onClick={onEntryClick}
                onDelete={onEntryDelete}
              />
            ))}

            {entries.length > maxEntries && !showingAll && (
              <div className="text-center pt-4">
                <Button variant="ghost" onClick={() => setShowingAll(true)}>
                  Show {entries.length - maxEntries} more entries
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

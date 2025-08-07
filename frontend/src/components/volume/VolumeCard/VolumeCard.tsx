import React from 'react';
import { useAtomValue } from 'jotai';
import {
  HardDrive,
  Database,
  Container,
  Clock,
  MoreVertical,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { scanResultsAtom } from '@/store/atoms/volumes';
import { cn } from '@/utils';
import type { VolumeCardProps } from './VolumeCard.types';

/**
 * VolumeCard component displaying comprehensive Docker volume information.
 *
 * Core volume dashboard component showing:
 * - Volume identification (name, ID, driver type)
 * - Current size information from scans or cached data
 * - Status indicators (active/inactive, health, scan status)
 * - Container usage count and relationships
 * - Quick action buttons (scan, manage, details)
 * - Metadata labels and mount point information
 * - Visual size representation with color coding
 * - Last scan timestamp with relative time display
 *
 * Integrates with Jotai atoms for real-time scan results and volume
 * state management. Supports hover states, loading indicators, and
 * error states for comprehensive user feedback.
 *
 * Used throughout the volume dashboard for consistent volume representation
 * in grid layouts, search results, and detailed views.
 */
export const VolumeCard: React.FC<VolumeCardProps> = ({
  volume,
  variant = 'default',
  showQuickActions = true,
  onScan,
  onManage,
  onViewDetails,
  className,
  ...props
}) => {
  const scanResults = useAtomValue(scanResultsAtom);
  const scanResult = scanResults[volume.id];

  /**
   * Format bytes to human-readable size with appropriate units.
   * Uses binary prefixes (1024) for consistency with Docker/filesystem tools.
   */
  const formatSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const base = 1024;
    const index = Math.floor(Math.log(bytes) / Math.log(base));
    const size = bytes / Math.pow(base, index);

    return `${size.toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
  };

  /**
   * Get appropriate status badge variant based on volume state.
   */
  const getStatusVariant = (isActive?: boolean) => {
    if (isActive === undefined) return 'secondary';
    return isActive ? 'success' : 'outline';
  };

  /**
   * Get status display text for accessibility and consistency.
   */
  const getStatusText = (isActive?: boolean): string => {
    if (isActive === undefined) return 'Unknown';
    return isActive ? 'Active' : 'Inactive';
  };

  /**
   * Determine size color coding based on volume size.
   * Helps users quickly identify large volumes that may need attention.
   */
  const getSizeColorClass = (bytes?: number): string => {
    if (!bytes) return 'text-gray-500';

    const gb = bytes / (1024 * 1024 * 1024);
    if (gb > 50) return 'text-red-600 dark:text-red-400'; // Very large
    if (gb > 10) return 'text-orange-600 dark:text-orange-400'; // Large
    if (gb > 1) return 'text-blue-600 dark:text-blue-400'; // Medium
    return 'text-green-600 dark:text-green-400'; // Small
  };

  /**
   * Format last scan timestamp to relative time display.
   */
  const formatLastScan = (timestamp?: string): string => {
    if (!timestamp) return 'Never scanned';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Just scanned';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  /**
   * Get card variant styling classes.
   */
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'compact':
        return 'p-4';
      case 'detailed':
        return 'p-6';
      default:
        return 'p-5';
    }
  };

  const cardClasses = cn(
    'hover:shadow-md transition-all duration-200 cursor-pointer',
    'border-l-4 border-l-transparent hover:border-l-blue-500',
    getVariantClasses(),
    volume.isActive === false && 'opacity-75',
    className,
  );

  return (
    <Card className={cardClasses} {...props}>
      {/* Header Section */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {volume.name || volume.id}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {volume.driver || 'local'} • {volume.id}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <Badge variant={getStatusVariant(volume.isActive)}>
            {getStatusText(volume.isActive)}
          </Badge>
          {showQuickActions && (
            <Button variant="ghost" size="sm" onClick={onManage}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="space-y-3">
        {/* Size Information */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Size:
          </span>
          <span
            className={cn(
              'text-sm font-medium',
              getSizeColorClass(scanResult?.size_bytes),
            )}
          >
            {scanResult ? formatSize(scanResult.size_bytes) : 'Not scanned'}
          </span>
        </div>

        {/* Container Usage */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Containers:
          </span>
          <div className="flex items-center space-x-1">
            <Container className="h-3 w-3 text-gray-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {volume.containerCount || 0}
            </span>
          </div>
        </div>

        {/* Mount Point */}
        {volume.mountpoint && variant !== 'compact' && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Mount:
            </span>
            <span
              className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate max-w-32"
              title={volume.mountpoint}
            >
              {volume.mountpoint}
            </span>
          </div>
        )}

        {/* Last Scan */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last scan:
          </span>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatLastScan(scanResult?.scanned_at)}
            </span>
          </div>
        </div>

        {/* Labels */}
        {volume.labels &&
          Object.keys(volume.labels).length > 0 &&
          variant === 'detailed' && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-1 max-h-16 overflow-hidden">
                {Object.entries(volume.labels)
                  .slice(0, 4)
                  .map(([key, value]) => (
                    <Badge
                      key={key}
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5"
                      title={`${key}=${value}`}
                    >
                      {key}=
                      {value.length > 8 ? `${value.slice(0, 8)}...` : value}
                    </Badge>
                  ))}
                {Object.keys(volume.labels).length > 4 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    +{Object.keys(volume.labels).length - 4}
                  </Badge>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Action Section */}
      {showQuickActions && (
        <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            size="sm"
            variant="outline"
            onClick={onScan}
            className="flex-1"
            disabled={!volume.isActive}
          >
            <Activity className="h-3 w-3 mr-1.5" />
            Scan
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onViewDetails}
            className="flex-1"
          >
            <Database className="h-3 w-3 mr-1.5" />
            Details
          </Button>
        </div>
      )}
    </Card>
  );
};

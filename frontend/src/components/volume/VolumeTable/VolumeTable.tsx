import React, { useState } from 'react';
import { Volume, VolumeDriver } from '../../../types/api';
import { Badge } from '../../ui/Badge';
import { formatBytes, formatDate } from '../../../utils/formatters';
import {
  ChevronUp,
  ChevronDown,
  HardDrive,
  Calendar,
  Package,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface VolumeTableProps {
  volumes: Volume[];
  loading?: boolean;
  sortBy?: 'name' | 'size' | 'created' | 'driver' | 'mountCount';
  sortOrder?: 'asc' | 'desc';
  onSort?: (
    column: 'name' | 'size' | 'created' | 'driver' | 'mountCount',
  ) => void;
  onRowClick?: (volume: Volume) => void;
  selectedVolumes?: string[];
  onSelectionChange?: (volumeIds: string[]) => void;
  showSelection?: boolean;
  className?: string;
}

/**
 * Table component for displaying Docker volumes in VolumeViz.
 *
 * Features:
 * - Sortable columns with visual indicators
 * - Row selection with checkbox support
 * - Responsive design with horizontal scroll
 * - Driver type badges
 * - Size formatting with human-readable units
 * - Mount count indicators
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * const [sortBy, setSortBy] = useState<'name' | 'size'>('name');
 * const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
 *
 * <VolumeTable
 *   volumes={volumes}
 *   sortBy={sortBy}
 *   sortOrder={sortOrder}
 *   onSort={(column) => {
 *     if (column === sortBy) {
 *       setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
 *     } else {
 *       setSortBy(column);
 *       setSortOrder('asc');
 *     }
 *   }}
 *   onRowClick={(volume) => navigate(`/volumes/${volume.id}`)}
 * />
 * ```
 */
export const VolumeTable: React.FC<VolumeTableProps> = ({
  volumes,
  loading = false,
  sortBy = 'name',
  sortOrder = 'asc',
  onSort,
  onRowClick,
  selectedVolumes = [],
  onSelectionChange,
  showSelection = false,
  className,
}) => {
  const [localSelectedVolumes, setLocalSelectedVolumes] = useState<Set<string>>(
    new Set(selectedVolumes),
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = volumes.map((v) => v.id);
      setLocalSelectedVolumes(new Set(allIds));
      onSelectionChange?.(allIds);
    } else {
      setLocalSelectedVolumes(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectVolume = (volumeId: string, checked: boolean) => {
    const newSelection = new Set(localSelectedVolumes);
    if (checked) {
      newSelection.add(volumeId);
    } else {
      newSelection.delete(volumeId);
    }
    setLocalSelectedVolumes(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const sortedVolumes = [...volumes].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'created':
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case 'driver':
        comparison = a.driver.localeCompare(b.driver);
        break;
      case 'mountCount':
        comparison = a.mount_count - b.mount_count;
        break;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getDriverVariant = (
    driver: VolumeDriver,
  ): 'primary' | 'secondary' | 'success' | 'warning' => {
    switch (driver) {
      case 'local':
        return 'primary';
      case 'nfs':
        return 'success';
      case 'cifs':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className={clsx('overflow-x-auto', className)}>
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Size</th>
              <th className="px-4 py-3 text-left">Driver</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Mounts</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr
                key={i}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                <td className="px-4 py-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (volumes.length === 0) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <HardDrive className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 dark:text-gray-400">No volumes found</p>
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
            {showSelection && (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={
                    localSelectedVolumes.size === volumes.length &&
                    volumes.length > 0
                  }
                  indeterminate={
                    localSelectedVolumes.size > 0 &&
                    localSelectedVolumes.size < volumes.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort?.('name')}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Name
                <SortIcon column="name" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort?.('size')}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Size
                <SortIcon column="size" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort?.('driver')}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Driver
                <SortIcon column="driver" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort?.('created')}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Created
                <SortIcon column="created" />
              </button>
            </th>
            <th className="px-4 py-3 text-left">
              <button
                onClick={() => onSort?.('mountCount')}
                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Mounts
                <SortIcon column="mountCount" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedVolumes.map((volume) => (
            <tr
              key={volume.id}
              onClick={() => onRowClick?.(volume)}
              className={clsx(
                'border-b border-gray-200 dark:border-gray-700',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                onRowClick && 'cursor-pointer',
              )}
            >
              {showSelection && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={localSelectedVolumes.has(volume.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectVolume(volume.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {volume.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                {volume.size ? formatBytes(volume.size) : '-'}
              </td>
              <td className="px-4 py-3">
                <Badge variant={getDriverVariant(volume.driver)}>
                  {volume.driver}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(volume.created_at)}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Package className="w-3 h-3" />
                  {volume.mount_count}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

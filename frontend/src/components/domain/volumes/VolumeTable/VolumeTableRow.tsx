/**
 * VolumeTableRow Component
 *
 * Displays a single volume row in the volumes table with:
 * - Selection checkbox
 * - Expand/collapse for details
 * - Volume name and path
 * - Status badges
 * - Size information
 * - File count and scan status
 * - Container attachments
 * - Action dropdown menu
 */

import React from 'react';
import { formatBytes } from '@/utils/formatters';
import { cn } from '@/utils/ui';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  HardDrive,
  MoreVertical,
  ScanSearch,
  Info,
  PlayCircle,
  PauseCircle,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  VOLUME_STATUS,
  STATUS_ICON_COLORS,
  STATUS_BADGE_CLASSES,
} from '../shared/constants';
import { useVolumeScanState } from '@/hooks/useVolumeScanState';
import { VolumeRowProgressBar } from './VolumeRowProgressBar';
import type { VolumeTableRowProps } from './VolumeTableRow.types';

/**
 * Get status icon based on volume status
 */
const getStatusIcon = (status: string) => {
  switch (status) {
    case VOLUME_STATUS.ACTIVE:
      return <CheckCircle2 className={cn('w-4 h-4', STATUS_ICON_COLORS[VOLUME_STATUS.ACTIVE])} />;
    case VOLUME_STATUS.SCANNING:
      return <Activity className={cn('w-4 h-4 animate-pulse', STATUS_ICON_COLORS[VOLUME_STATUS.SCANNING])} />;
    case VOLUME_STATUS.ERROR:
      return <AlertCircle className={cn('w-4 h-4', STATUS_ICON_COLORS[VOLUME_STATUS.ERROR])} />;
    case VOLUME_STATUS.PENDING:
      return <Clock className={cn('w-4 h-4', STATUS_ICON_COLORS[VOLUME_STATUS.PENDING])} />;
    case VOLUME_STATUS.INACTIVE:
    default:
      return <Clock className={cn('w-4 h-4', STATUS_ICON_COLORS[VOLUME_STATUS.INACTIVE])} />;
  }
};

/**
 * Get status badge classes based on volume status
 */
const getStatusBadge = (status: string) => {
  const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
  const statusClass = STATUS_BADGE_CLASSES[status as keyof typeof STATUS_BADGE_CLASSES] ||
                      STATUS_BADGE_CLASSES[VOLUME_STATUS.INACTIVE];
  return `${baseClasses} ${statusClass}`;
};

export const VolumeTableRow: React.FC<VolumeTableRowProps> = ({
  volume,
  isSelected,
  isExpanded,
  onSelect,
  onClick,
  onToggleExpand,
  onOpenModal,
  onTrack,
  onUntrack,
  onScan,
  onDelete,
}) => {
  const volumeId = volume.name;
  const sizePercentage = volume.quota_bytes
    ? Math.min((volume.size_bytes / volume.quota_bytes) * 100, 100)
    : 0;

  // Single source of truth for scan state: live WebSocket atom preferred,
  // REST scan_status as fallback. Drives both the Files cell and the under-row
  // progress bar so they can never disagree (see useVolumeScanState).
  const scanState = useVolumeScanState(volumeId, volume.scan_status);

  return (
    <tr
      key={`row-${volumeId}`}
      className={cn(
        'group relative hover:bg-surface-hover cursor-pointer',
        isSelected && 'bg-blue-50 dark:bg-blue-900/20',
      )}
    >
      {/* Selection checkbox */}
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          className="rounded border-line text-blue-600 focus:ring-blue-500"
          checked={isSelected}
          onChange={() => onSelect(volumeId)}
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      {/* Volume name and path */}
      <td className="px-6 py-4 whitespace-nowrap" onClick={() => onClick(volume)}>
        <div className="flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(volumeId);
            }}
            className="mr-2 p-1 hover:bg-surface-secondary rounded text-secondary hover:text-primary"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <HardDrive className="w-5 h-5 text-gray-400 mr-3" />
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal(volumeId);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
            >
              {volume.name}
            </button>
            <div
              className="text-sm text-secondary truncate max-w-xs"
              title={volume.path}
            >
              {volume.path}
            </div>
          </div>
        </div>
      </td>

      {/* Status badges */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            {getStatusIcon(volume.status)}
            <span className={cn('ml-2', getStatusBadge(volume.status))}>
              {volume.status}
            </span>
          </div>
          {/* Tracking Status Badge */}
          {volume.is_tracked === false && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Untracked
            </span>
          )}
        </div>
      </td>

      {/* Size */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-primary">
          {formatBytes(volume.size_bytes)}
        </div>
        {volume.quota_bytes && (
          <div className="text-xs text-secondary">
            {sizePercentage.toFixed(1)}% of {formatBytes(volume.quota_bytes)}
          </div>
        )}
      </td>

      {/* Files */}
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        {scanState.isScanning ? (
          <span className="text-blue-600 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>
              Scanning
              {scanState.progress !== null ? ` ${scanState.progress}%` : '…'}
            </span>
          </span>
        ) : volume.file_count !== null && volume.file_count !== undefined ? (
          <div>
            <div className="font-medium text-primary">
              {volume.file_count.toLocaleString()} files
            </div>
            {volume.last_scan_at && (
              <div className="text-xs text-secondary mt-0.5">
                {formatDistanceToNow(new Date(volume.last_scan_at), {
                  addSuffix: true,
                })}
              </div>
            )}
          </div>
        ) : (
          <span className="text-tertiary italic">Not scanned</span>
        )}
      </td>

      {/* Containers */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
        {volume.attachments_count || '—'}
      </td>

      {/* Last Scanned */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
        {volume.last_scan_at
          ? new Date(volume.last_scan_at).toLocaleDateString()
          : '—'}
      </td>

      {/* Actions: primary Scan is directly visible (revealed on row
          hover/focus); secondary actions stay in the kebab. */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Primary action — Scan. Hidden at rest, revealed on row hover OR
              when focused (keyboard/touch reachable). Stays mounted so it's
              always in the tab order. */}
          <button
            type="button"
            onClick={() => onScan(volumeId)}
            disabled={scanState.isScanning}
            aria-label={`Scan ${volume.name}`}
            title={scanState.isScanning ? 'Scan in progress' : 'Scan volume'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium',
              'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30',
              'opacity-0 transition-opacity duration-150',
              'group-hover:opacity-100 group-focus-within:opacity-100',
              'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              scanState.isScanning && 'opacity-100',
            )}
          >
            <ScanSearch className="w-4 h-4" />
            <span>Scan</span>
          </button>

          {/* Secondary actions — kebab, same reveal behavior. */}
          <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
            <Dropdown
              items={[
                // Track/Untrack based on current status
                ...(volume.is_tracked === false
                  ? [
                      {
                        id: 'track',
                        label: 'Track Volume',
                        icon: PlayCircle,
                        onClick: () => onTrack(volumeId),
                      },
                    ]
                  : [
                      {
                        id: 'untrack',
                        label: 'Untrack Volume',
                        icon: PauseCircle,
                        onClick: () => onUntrack(volumeId),
                      },
                    ]),
                {
                  id: 'details',
                  label: 'View Details',
                  icon: Info,
                  onClick: () => onOpenModal(volumeId),
                },
                {
                  id: 'delete',
                  label: 'Delete Volume',
                  icon: Trash2,
                  onClick: () => onDelete(volumeId),
                  destructive: true,
                },
              ]}
              trigger={<MoreVertical className="w-4 h-4 text-secondary" />}
              align="right"
            />
          </div>
        </div>

        {/* Live under-row scan progress bar. Lives inside this <td> (valid
            table markup) but is absolutely positioned against the
            position:relative <tr>, so it spans the FULL row width along the
            bottom edge rather than just this cell. */}
        <VolumeRowProgressBar scanState={scanState} />
      </td>
    </tr>
  );
};

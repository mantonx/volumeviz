import { selectedVolumeAtom } from '@/atoms/volumes';
import { ScanProgressDetail } from '@/components/domain/scan/ScanProgressDetail';
import { Dropdown } from '@/components/ui/Dropdown';
import { VolumeDetailsModal } from '@/components/application/Modals';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';
import { useVolumeBulkActions } from '@/hooks/volumes/useVolumeBulkActions';
import { formatBytes } from '@/utils/formatters';
import { cn } from '@/utils/ui';
import { useSetAtom } from 'jotai';
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
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { VolumeTableProps } from './VolumeTable.types';

export const VolumeTable: React.FC<VolumeTableProps> = React.memo(({
  volumes,
  isLoading,
  onVolumeSelect,
  selectedVolumeIds = [],
  onSelectionChange,
  showBulkActions = true,
  className,
}) => {
  const setSelectedVolume = useSetAtom(selectedVolumeAtom);
  const { scanVolume, refreshVolumeSize } = useVolumeOperations();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalVolumeName, setModalVolumeName] = useState<string>('');

  // Convert selected volumes for bulk actions
  const selectedVolumes = useMemo(
    () =>
      volumes
        .filter((v) => selectedVolumeIds.includes(v.id))
        .map((v) => ({ ...v, status: v.status as any })),
    [volumes, selectedVolumeIds],
  );

  const bulkActions = useVolumeBulkActions(selectedVolumes, {
    onActionComplete: (actionId, volumeIds) => {
      console.log(`Bulk action ${actionId} completed for volumes:`, volumeIds);
      // Clear selection after successful bulk action
      onSelectionChange?.([]);
    },
  });

  const handleSelectAll = () => {
    if (selectedVolumeIds.length === volumes.length) {
      onSelectionChange?.([]);
    } else {
      // Use volume.name as unique identifier (API doesn't return 'id')
      onSelectionChange?.(volumes.map((v) => v.name));
    }
  };

  const handleRowSelect = (volumeId: string) => {
    const newSelection = selectedVolumeIds.includes(volumeId)
      ? selectedVolumeIds.filter((id) => id !== volumeId)
      : [...selectedVolumeIds, volumeId];
    onSelectionChange?.(newSelection);
  };

  const handleRowClick = (volume: any) => {
    // Use volume.name as the unique identifier since API doesn't return 'id'
    setSelectedVolume(volume.name || volume.id);
    onVolumeSelect?.(volume);
  };

  const openVolumeModal = (volumeName: string) => {
    setModalVolumeName(volumeName);
    setIsModalOpen(true);
  };

  const toggleExpanded = (volumeId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(volumeId)) {
      newExpanded.delete(volumeId);
    } else {
      newExpanded.add(volumeId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'scanning':
        return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'scanning':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const isAllSelected =
    volumes.length > 0 && selectedVolumeIds.length === volumes.length;
  const isPartiallySelected =
    selectedVolumeIds.length > 0 && selectedVolumeIds.length < volumes.length;

  if (isLoading) {
    return (
      <div
        className={cn('bg-white rounded-lg border border-gray-200', className)}
      >
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-20 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('bg-white rounded-lg border border-gray-200', className)}
    >
      {/* Bulk Actions Bar */}
      {showBulkActions && selectedVolumeIds.length > 0 && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedVolumeIds.length} volume
              {selectedVolumeIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              {bulkActions
                .filter(
                  (action) =>
                    !action.isEnabled || action.isEnabled(selectedVolumes),
                )
                .slice(0, 4) // Show first 4 actions
                .map((action) => (
                  <button
                    key={action.id}
                    onClick={() => action.action(selectedVolumeIds)}
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-md text-sm font-medium',
                      action.variant === 'destructive'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                    )}
                    title={action.tooltip}
                  >
                    <action.icon className="w-4 h-4 mr-1" />
                    {action.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Files
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Containers
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Scanned
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {volumes.flatMap((volume) => {
              // Use volume.name as unique identifier (API doesn't return 'id')
              const volumeId = volume.name;
              const isSelected = selectedVolumeIds.includes(volumeId);
              const isExpanded = expandedRows.has(volumeId);
              const sizePercentage = volume.quota_bytes
                ? Math.min((volume.size_bytes / volume.quota_bytes) * 100, 100)
                : 0;

              const rows = [
                <tr
                  key={`row-${volumeId}`}
                  className={cn(
                    'hover:bg-gray-50 cursor-pointer',
                    isSelected && 'bg-blue-50',
                  )}
                >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={isSelected}
                        onChange={() => handleRowSelect(volumeId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={() => handleRowClick(volume)}
                    >
                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(volumeId);
                          }}
                          className="mr-2 p-1 hover:bg-gray-200 rounded"
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
                              openVolumeModal(volumeId);
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                          >
                            {volume.name}
                          </button>
                          <div
                            className="text-sm text-gray-500 truncate max-w-xs"
                            title={volume.path}
                          >
                            {volume.path}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(volume.status)}
                        <span
                          className={cn('ml-2', getStatusBadge(volume.status))}
                        >
                          {volume.status}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatBytes(volume.size_bytes)}
                      </div>
                      {volume.quota_bytes && (
                        <div className="text-xs text-gray-500">
                          {sizePercentage.toFixed(1)}% of{' '}
                          {formatBytes(volume.quota_bytes)}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {volume.scan_status === 'running' || volume.scan_status === 'pending' ? (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 animate-pulse" />
                          <span>Scanning...</span>
                        </span>
                      ) : volume.file_count !== null && volume.file_count !== undefined ? (
                        <div className="text-gray-900 dark:text-white">
                          <div className="font-medium">{volume.file_count.toLocaleString()} files</div>
                          {volume.last_scan_at && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatDistanceToNow(new Date(volume.last_scan_at), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">Not scanned</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {volume.container_count || '—'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {volume.last_scanned_at
                        ? new Date(volume.last_scanned_at).toLocaleDateString()
                        : '—'}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          items={[
                            {
                              id: 'scan',
                              label: 'Scan Volume',
                              icon: ScanSearch,
                              onClick: () => scanVolume.mutateAsync(volumeId),
                              disabled: volume.scan_status === 'running',
                            },
                            {
                              id: 'details',
                              label: 'View Details',
                              icon: Info,
                              onClick: () => openVolumeModal(volumeId),
                            },
                            {
                              id: 'delete',
                              label: 'Delete Volume',
                              icon: Trash2,
                              onClick: () => {
                                // TODO: Add delete confirmation modal
                                console.log('Delete volume:', volumeId);
                              },
                              destructive: true,
                            },
                          ]}
                          trigger={<MoreVertical className="w-4 h-4" />}
                          align="right"
                        />
                      </div>
                    </td>
                  </tr>,
              ];

              // Add expanded row if needed
              if (isExpanded) {
                rows.push(
                  <ExpandedVolumeRow
                    key={`expanded-${volumeId}`}
                    volume={volume}
                    volumeId={volumeId}
                    sizePercentage={sizePercentage}
                  />
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {!isLoading && volumes.length === 0 && (
        <div className="text-center py-12">
          <HardDrive className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No volumes found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a new volume to track.
          </p>
        </div>
      )}

      {/* Volume Details Modal */}
      <VolumeDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        volumeName={modalVolumeName}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-render on volume scan progress updates
  // Only re-render if volumes array length changes or if non-scan-progress fields change
  if (prevProps.volumes.length !== nextProps.volumes.length) return false;
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.selectedVolumeIds.length !== nextProps.selectedVolumeIds.length) return false;
  if (JSON.stringify(prevProps.selectedVolumeIds) !== JSON.stringify(nextProps.selectedVolumeIds)) return false;

  // Check if non-progress volume fields changed
  for (let i = 0; i < prevProps.volumes.length; i++) {
    const prev = prevProps.volumes[i];
    const next = nextProps.volumes[i];

    // Only check fields that aren't scan progress related
    if (prev.name !== next.name ||
        prev.status !== next.status ||
        prev.size_bytes !== next.size_bytes ||
        prev.file_count !== next.file_count) {
      return false;
    }
  }

  return true; // Props are equal, skip re-render
});

// Separate memoized component for expanded row to isolate WebSocket updates
const ExpandedVolumeRow = React.memo<{
  volume: any;
  volumeId: string;
  sizePercentage: number;
}>(({ volume, volumeId, sizePercentage }) => {
  return (
    <tr>
      <td colSpan={8} className="px-6 py-4 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-200 dark:border-gray-700">
        {/* Scan Progress Detail - shows if volume is actively scanning */}
        <ScanProgressDetail volumeId={volumeId} volumeName={volume.name} className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Volume Information */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Volume Info</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-200">Mount Point:</span>
                <div className="text-gray-700 dark:text-gray-300 font-mono text-xs break-all">
                  {volume.mountpoint || volume.mount_point || '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-200">Driver:</span>
                <div className="text-gray-700 dark:text-gray-300">
                  {volume.driver || '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-200">Scope:</span>
                <div className="text-gray-700 dark:text-gray-300">
                  {volume.scope || '—'}
                </div>
              </div>
              {volume.volume_type && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Type:</span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {volume.volume_type === 'network'
                      ? 'Network Mount'
                      : volume.volume_type === 'bind'
                        ? 'Bind Mount'
                        : 'Local Volume'}
                  </div>
                </div>
              )}
              {volume.labels && Object.keys(volume.labels).length > 0 && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Labels:</span>
                  <div className="text-gray-700 dark:text-gray-300 text-xs space-y-1 mt-1">
                    {Object.entries(volume.labels).map(([key, value]) => (
                      <div key={key} className="font-mono">
                        {key}: {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps & Status */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Timestamps</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-200">Created:</span>
                <div className="text-gray-700 dark:text-gray-300">
                  {volume.created_at ? new Date(volume.created_at).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-gray-200">Last Updated:</span>
                <div className="text-gray-700 dark:text-gray-300">
                  {volume.updated_at ? new Date(volume.updated_at).toLocaleString() : '—'}
                </div>
              </div>
              {volume.last_scan_at && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Last Scanned:</span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {new Date(volume.last_scan_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments & Usage */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm uppercase tracking-wide">Usage</h4>
            <div className="space-y-2 text-sm">
              {volume.attachments_count !== undefined && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Container Attachments:</span>
                  <div className="text-gray-700 dark:text-gray-300">
                    {volume.attachments_count} {volume.attachments_count === 1 ? 'container' : 'containers'}
                  </div>
                </div>
              )}
              {volume.is_orphaned !== undefined && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Orphaned:</span>
                  <div className={cn(
                    "font-medium",
                    volume.is_orphaned ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {volume.is_orphaned ? 'Yes (no containers attached)' : 'No'}
                  </div>
                </div>
              )}
              {volume.quota_bytes && (
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-200">Quota Usage:</span>
                  <div className="mt-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          sizePercentage > 90
                            ? 'bg-red-500'
                            : sizePercentage > 75
                              ? 'bg-yellow-500'
                              : 'bg-blue-500',
                        )}
                        style={{
                          width: `${Math.min(sizePercentage, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      {sizePercentage.toFixed(1)}% of quota
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Message - Full Width */}
        {volume.error_message && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <span className="font-medium text-red-700 dark:text-red-400 text-sm">Error:</span>
            <div className="text-red-600 dark:text-red-300 text-sm mt-1">{volume.error_message}</div>
          </div>
        )}
      </td>
    </tr>
  );
});

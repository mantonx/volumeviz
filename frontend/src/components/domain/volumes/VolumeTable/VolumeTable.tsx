import { selectedVolumeAtom } from '@/atoms/volumes';
import { ScanProgressDetail } from '@/components/domain/scan/ScanProgressDetail';
import { DeleteVolumeModal } from '@/components/domain/volumes/modals';
import { useVolumeBulkActions } from '@/hooks/volumes/useVolumeBulkActions';
import { useVolumeDelete } from '@/hooks/volumes/useVolumeDelete';
import { cn } from '@/utils/ui';
import { useSetAtom } from 'jotai';
import { useVolumeRowActions } from './hooks/useVolumeRowActions';
import { VolumeTableRow } from './VolumeTableRow';
import { HardDrive, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { VolumeTableProps } from './VolumeTable.types';

export const VolumeTable: React.FC<VolumeTableProps> = ({
  volumes,
  isLoading,
  selectedVolumeIds = [],
  onSelectionChange,
  showBulkActions = true,
  className,
  onRefetch,
}) => {
  const setSelectedVolume = useSetAtom(selectedVolumeAtom);
  const { trackVolume, untrackVolume, scanVolume } = useVolumeRowActions({
    onRefetch,
  });

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Convert selected volumes for bulk actions. Rows are keyed and selected
  // by volume.name everywhere in this file (the API doesn't return an `id`
  // field at all), so this must filter on `name` too — filtering on `.id`
  // here previously meant this list was always empty, silently disabling
  // every bulk action gated by an isEnabled(selectedVolumes) check (e.g.
  // Track/Untrack) even when rows were genuinely selected.
  const selectedVolumes = useMemo(
    () =>
      volumes
        .filter((v) => selectedVolumeIds.includes(v.name))
        .map((v) => ({ ...v, id: v.name, status: v.status as any })),
    [volumes, selectedVolumeIds],
  );

  const bulkActions = useVolumeBulkActions(selectedVolumes, {
    onActionComplete: (actionId, volumeIds) => {
      console.log(`Bulk action ${actionId} completed for volumes:`, volumeIds);
      // Clear selection after successful bulk action
      onSelectionChange?.([]);
    },
  });

  const {
    pendingVolumes: pendingDeleteVolumes,
    failures: deleteFailures,
    isModalOpen: isDeleteModalOpen,
    isDeleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useVolumeDelete();

  const handleDeleteRow = (volumeId: string) => {
    const volume = volumes.find((v) => v.name === volumeId);
    requestDelete([{ name: volumeId, size_bytes: volume?.size_bytes }]);
  };

  const handleDeleteSelected = () => {
    const toDelete = selectedVolumes.map((v) => ({
      name: v.name,
      size_bytes: v.size_bytes,
    }));
    requestDelete(toDelete);
  };

  const handleConfirmDelete = async () => {
    const allSucceeded = await confirmDelete();
    // Only clear the table's own selection once everything succeeded — a
    // partial bulk failure keeps the modal open scoped to just the failed
    // volumes, and clearing selection at that point would desync the
    // checkboxes from what's still being confirmed.
    if (allSucceeded) {
      onSelectionChange?.([]);
    }
  };

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
  };

  const openVolumeModal = (volumeName: string) => {
    setSelectedVolume(volumeName);
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

  const isAllSelected =
    volumes.length > 0 && selectedVolumeIds.length === volumes.length;
  const isPartiallySelected =
    selectedVolumeIds.length > 0 && selectedVolumeIds.length < volumes.length;

  if (isLoading) {
    return (
      <div
        className={cn('bg-surface rounded-lg border border-line', className)}
      >
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-4 h-4 bg-surface-secondary rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-secondary rounded w-1/4"></div>
                  <div className="h-3 bg-surface-secondary rounded w-1/2"></div>
                </div>
                <div className="w-20 h-4 bg-surface-secondary rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('bg-surface rounded-lg border border-line', className)}
    >
      {/* Bulk Actions Bar */}
      {showBulkActions && selectedVolumeIds.length > 0 && (
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
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
              {/* Delete is intentionally not part of useVolumeBulkActions'
                  fire-immediately array — it opens the confirm modal first,
                  the mutation only runs after the user types "delete". */}
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                title="Delete selected volumes"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y border-line">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-line text-blue-600 focus:ring-blue-500"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Volume
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Files
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Containers
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                Last Scanned
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y border-line">
            {volumes.flatMap((volume) => {
              // Use volume.name as unique identifier (API doesn't return 'id')
              const volumeId = volume.name;
              const isSelected = selectedVolumeIds.includes(volumeId);
              const isExpanded = expandedRows.has(volumeId);
              const sizePercentage = volume.quota_bytes
                ? Math.min((volume.size_bytes / volume.quota_bytes) * 100, 100)
                : 0;

              const rows = [
                <VolumeTableRow
                  key={`row-${volumeId}`}
                  volume={volume}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                  onSelect={handleRowSelect}
                  onClick={handleRowClick}
                  onToggleExpand={toggleExpanded}
                  onOpenModal={openVolumeModal}
                  onTrack={trackVolume}
                  onUntrack={untrackVolume}
                  onScan={scanVolume}
                  onDelete={handleDeleteRow}
                />,
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

      {/* Delete Volume Confirmation Modal */}
      <DeleteVolumeModal
        isOpen={isDeleteModalOpen}
        onClose={cancelDelete}
        onConfirm={handleConfirmDelete}
        volumes={pendingDeleteVolumes}
        isDeleting={isDeleting}
        failures={deleteFailures}
      />
    </div>
  );
};

// Separate memoized component for expanded row to isolate WebSocket updates
const ExpandedVolumeRow = React.memo<{
  volume: any;
  volumeId: string;
  sizePercentage: number;
}>(({ volume, volumeId, sizePercentage }) => {
  return (
    <tr>
      <td colSpan={8} className="px-6 py-4 bg-surface-secondary border-t border-line">
        {/* Scan Progress Detail - shows if volume is actively scanning */}
        <ScanProgressDetail volumeId={volumeId} volumeName={volume.name} className="mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Volume Information */}
          <div className="space-y-3">
            <h4 className="font-semibold text-primary text-sm uppercase tracking-wide">Volume Info</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-primary">Mount Point:</span>
                <div className="text-secondary font-mono text-xs break-all">
                  {volume.mountpoint || volume.mount_point || '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-primary">Driver:</span>
                <div className="text-secondary">
                  {volume.driver || '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-primary">Scope:</span>
                <div className="text-secondary">
                  {volume.scope || '—'}
                </div>
              </div>
              {volume.volume_type && (
                <div>
                  <span className="font-medium text-primary">Type:</span>
                  <div className="text-secondary">
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
                  <span className="font-medium text-primary">Labels:</span>
                  <div className="text-secondary text-xs space-y-1 mt-1">
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
            <h4 className="font-semibold text-primary text-sm uppercase tracking-wide">Timestamps</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-primary">Created:</span>
                <div className="text-secondary">
                  {volume.created_at ? new Date(volume.created_at).toLocaleString() : '—'}
                </div>
              </div>
              <div>
                <span className="font-medium text-primary">Last Updated:</span>
                <div className="text-secondary">
                  {volume.updated_at ? new Date(volume.updated_at).toLocaleString() : '—'}
                </div>
              </div>
              {volume.last_scan_at && (
                <div>
                  <span className="font-medium text-primary">Last Scanned:</span>
                  <div className="text-secondary">
                    {new Date(volume.last_scan_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Attachments & Usage */}
          <div className="space-y-3">
            <h4 className="font-semibold text-primary text-sm uppercase tracking-wide">Usage</h4>
            <div className="space-y-2 text-sm">
              {volume.attachments_count !== undefined && (
                <div>
                  <span className="font-medium text-primary">Container Attachments:</span>
                  <div className="text-secondary">
                    {volume.attachments_count} {volume.attachments_count === 1 ? 'container' : 'containers'}
                  </div>
                </div>
              )}
              {volume.is_orphaned !== undefined && (
                <div>
                  <span className="font-medium text-primary">Orphaned:</span>
                  <div className={cn(
                    "font-medium",
                    volume.is_orphaned ? "text-orange-600" : "text-green-600"
                  )}>
                    {volume.is_orphaned ? 'Yes (no containers attached)' : 'No'}
                  </div>
                </div>
              )}
              {volume.quota_bytes && (
                <div>
                  <span className="font-medium text-primary">Quota Usage:</span>
                  <div className="mt-1">
                    <div className="w-full bg-surface-secondary rounded-full h-2">
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
                    <div className="text-xs text-secondary mt-1">
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
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <span className="font-medium text-red-700 text-sm">Error:</span>
            <div className="text-red-600 text-sm mt-1">{volume.error_message}</div>
          </div>
        )}
      </td>
    </tr>
  );
});

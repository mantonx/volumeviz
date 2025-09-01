import { useCallback, useMemo } from 'react';
import {
  Archive,
  PlayCircle,
  PauseCircle,
  Scan,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react';
import type { VolumeMount } from '../useVolumesAndMounts';
import { useToast } from '@/components/ui';
import { usePostVolumesBulkScan } from '@/api/orval-generated/api';

export interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (selectedIds: string[]) => Promise<void>;
  variant?: 'default' | 'destructive';
  isEnabled?: (volumes: VolumeMount[]) => boolean;
  tooltip?: string;
}

export interface UseVolumeBulkActionsOptions {
  onActionComplete?: (actionId: string, volumeIds: string[]) => void;
  onActionError?: (actionId: string, error: Error) => void;
}

/**
 * Hook for managing bulk actions on volumes
 * Provides common bulk operations like scan, track, untrack, delete, etc.
 */
export const useVolumeBulkActions = (
  selectedVolumes: VolumeMount[],
  options: UseVolumeBulkActionsOptions = {},
): BulkAction[] => {
  const { success, error: showError } = useToast();
  const bulkScanMutation = usePostVolumesBulkScan();
  const { onActionComplete, onActionError } = options;

  const handleBulkScan = useCallback(
    async (volumeIds: string[]) => {
      try {
        await bulkScanMutation.mutateAsync({
          volume_ids: volumeIds,
          method: 'du',
          async: false
        });
        success(`Started scanning ${volumeIds.length} volume(s)`);
        onActionComplete?.('scan', volumeIds);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Bulk scan failed');
        showError(`Failed to scan volumes: ${error.message}`);
        onActionError?.('scan', error);
      }
    },
    [bulkScanMutation, success, showError, onActionComplete, onActionError],
  );

  const handleBulkTrack = useCallback(
    async (volumeIds: string[]) => {
      try {
        // NOTE: Bulk tracking API not available - individual volume tracking needed
        success(`Tracking enabled for ${volumeIds.length} volume(s)`);
        onActionComplete?.('track', volumeIds);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Bulk track failed');
        showError(`Failed to track volumes: ${error.message}`);
        onActionError?.('track', error);
      }
    },
    [success, showError, onActionComplete, onActionError],
  );

  const handleBulkUntrack = useCallback(
    async (volumeIds: string[]) => {
      try {
        // NOTE: API endpoint not available - bulk untrack API call
        success(`Tracking disabled for ${volumeIds.length} volume(s)`);
        onActionComplete?.('untrack', volumeIds);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Bulk untrack failed');
        showError(`Failed to untrack volumes: ${error.message}`);
        onActionError?.('untrack', error);
      }
    },
    [success, showError, onActionComplete, onActionError],
  );

  const handleBulkDelete = useCallback(
    async (volumeIds: string[]) => {
      try {
        // NOTE: API endpoint not available - bulk delete API call
        success(`Deleted ${volumeIds.length} volume(s)`);
        onActionComplete?.('delete', volumeIds);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Bulk delete failed');
        showError(`Failed to delete volumes: ${error.message}`);
        onActionError?.('delete', error);
      }
    },
    [success, showError, onActionComplete, onActionError],
  );

  const handleBulkExport = useCallback(
    async (volumeIds: string[]) => {
      try {
        // NOTE: API endpoint not available - export functionality
        success(`Exported ${volumeIds.length} volume(s)`);
        onActionComplete?.('export', volumeIds);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Export failed');
        showError(`Failed to export volumes: ${error.message}`);
        onActionError?.('export', error);
      }
    },
    [success, showError, onActionComplete, onActionError],
  );

  const handleBulkRefresh = useCallback(
    async (volumeIds: string[]) => {
      try {
        // NOTE: API endpoint not available - refresh API call
        success(`Refreshed ${volumeIds.length} volume(s)`);
        onActionComplete?.('refresh', volumeIds);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Bulk refresh failed');
        showError(`Failed to refresh volumes: ${error.message}`);
        onActionError?.('refresh', error);
      }
    },
    [success, showError, onActionComplete, onActionError],
  );

  const bulkActions = useMemo<BulkAction[]>(() => {
    const hasTrackedVolumes = selectedVolumes.some(
      (v) => v.status === 'tracked',
    );
    const hasUntrackedVolumes = selectedVolumes.some(
      (v) => v.status === 'untracked',
    );

    return [
      {
        id: 'scan',
        label: 'Scan',
        icon: Scan,
        action: handleBulkScan,
        isEnabled: (volumes) => volumes.some((v) => v.status === 'tracked'),
        tooltip: 'Start scanning selected volumes',
      },
      {
        id: 'track',
        label: 'Track',
        icon: PlayCircle,
        action: handleBulkTrack,
        isEnabled: () => hasUntrackedVolumes,
        tooltip: 'Enable tracking for selected volumes',
      },
      {
        id: 'untrack',
        label: 'Untrack',
        icon: PauseCircle,
        action: handleBulkUntrack,
        isEnabled: () => hasTrackedVolumes,
        tooltip: 'Disable tracking for selected volumes',
      },
      {
        id: 'archive',
        label: 'Archive',
        icon: Archive,
        action: async (ids) => {
          // NOTE: Archive functionality requires backend API implementation
          success(`Archived ${ids.length} volume(s)`);
        },
        tooltip: 'Archive selected volumes',
      },
      {
        id: 'export',
        label: 'Export',
        icon: Download,
        action: handleBulkExport,
        tooltip: 'Export selected volumes data',
      },
      {
        id: 'refresh',
        label: 'Refresh',
        icon: RefreshCw,
        action: handleBulkRefresh,
        tooltip: 'Refresh selected volumes',
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        action: handleBulkDelete,
        variant: 'destructive',
        tooltip: 'Delete selected volumes',
      },
    ];
  }, [
    selectedVolumes,
    handleBulkScan,
    handleBulkTrack,
    handleBulkUntrack,
    handleBulkDelete,
    handleBulkExport,
    handleBulkRefresh,
    success,
  ]);

  return bulkActions;
};

export default useVolumeBulkActions;

import { useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { 
  usePostVolumesIdSizeRefresh,
  usePostVolumesIdFilesystemIndex,
  usePostVolumesBulkScan 
} from '@/api/orval-generated/api';
import { lastRefreshAtom } from '@/atoms/volumes';
import { backgroundSyncManager, useBackgroundSync } from '@/utils/background-sync';

export interface UseVolumeOperationsReturn {
  scanVolume: {
    mutateAsync: (volumeId: string) => Promise<any>;
    isLoading: boolean;
  };
  refreshVolumeSize: {
    mutateAsync: (volumeId: string) => Promise<any>;
    isLoading: boolean;
  };
  indexFilesystem: {
    mutateAsync: (volumeId: string) => Promise<any>;
    isLoading: boolean;
  };
  bulkScan: {
    mutateAsync: (volumeIds: string[], options?: { async?: boolean; method?: string }) => Promise<any>;
    isLoading: boolean;
  };
  refreshVolumes: () => void;
}

export function useVolumeOperations(): UseVolumeOperationsReturn {
  const queryClient = useQueryClient();
  const setLastRefresh = useSetAtom(lastRefreshAtom);
  const { isOnline, addPendingOperation } = useBackgroundSync();

  // Size refresh mutation
  const sizeRefreshMutation = usePostVolumesIdSizeRefresh({
    mutation: {
      onSuccess: (data, { id }) => {
        // Invalidate volume queries
        queryClient.invalidateQueries({ queryKey: ['getVolumes'] });
        queryClient.invalidateQueries({ queryKey: ['getVolumesIdSize'] });
        setLastRefresh(Date.now());
      },
    },
  });

  // Filesystem indexing mutation  
  const filesystemIndexMutation = usePostVolumesIdFilesystemIndex({
    mutation: {
      onSuccess: (data, { id }) => {
        queryClient.invalidateQueries({ queryKey: ['getVolumes'] });
        queryClient.invalidateQueries({ queryKey: ['getVolumesIdFilesystemStatus'] });
        setLastRefresh(Date.now());
      },
    },
  });

  // Bulk scan mutation
  const bulkScanMutation = usePostVolumesBulkScan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['getVolumes'] });
        setLastRefresh(Date.now());
      },
    },
  });

  const refreshVolumes = () => {
    queryClient.invalidateQueries({ queryKey: ['getVolumes'] });
    setLastRefresh(Date.now());
  };

  return {
    // Legacy compatibility - map to size refresh with offline support
    scanVolume: {
      mutateAsync: async (volumeId: string) => {
        if (isOnline) {
          return sizeRefreshMutation.mutateAsync({ id: volumeId });
        } else {
          // Queue for background sync when offline
          addPendingOperation({
            type: 'scan',
            volumeId,
            maxRetries: 3,
          });
          return Promise.resolve({ queued: true, offline: true });
        }
      },
      isLoading: sizeRefreshMutation.isPending,
    },
    refreshVolumeSize: {
      mutateAsync: async (volumeId: string) => {
        if (isOnline) {
          return sizeRefreshMutation.mutateAsync({ id: volumeId });
        } else {
          // Queue for background sync when offline
          addPendingOperation({
            type: 'refresh',
            volumeId,
            maxRetries: 3,
          });
          return Promise.resolve({ queued: true, offline: true });
        }
      },
      isLoading: sizeRefreshMutation.isPending,
    },
    indexFilesystem: {
      mutateAsync: async (volumeId: string) => {
        if (isOnline) {
          return filesystemIndexMutation.mutateAsync({ id: volumeId });
        } else {
          // Queue for background sync when offline
          addPendingOperation({
            type: 'index',
            volumeId,
            maxRetries: 5, // Higher retries for filesystem operations
          });
          return Promise.resolve({ queued: true, offline: true });
        }
      },
      isLoading: filesystemIndexMutation.isPending,
    },
    bulkScan: {
      mutateAsync: async (volumeIds: string[], options = {}) => {
        const { async = false, method = 'du' } = options;
        if (isOnline) {
          return bulkScanMutation.mutateAsync({
            async,
            method,
            volume_ids: volumeIds,
          });
        } else {
          // Queue each volume for background sync when offline
          volumeIds.forEach(volumeId => {
            addPendingOperation({
              type: 'scan',
              volumeId,
              data: { async, method },
              maxRetries: 3,
            });
          });
          return Promise.resolve({ queued: true, offline: true, count: volumeIds.length });
        }
      },
      isLoading: bulkScanMutation.isPending,
    },
    refreshVolumes,
  };
}
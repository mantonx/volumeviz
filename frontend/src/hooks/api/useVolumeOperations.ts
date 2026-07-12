import { useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import {
  usePostApiV1VolumesIdSizeRefresh,
  usePostApiV1VolumesIdFilesystemIndex,
  usePostApiV1VolumesBulkScan,
} from '@/api/orval-generated/api';
import { customFetchClient } from '@/api/fetch-client';
import { lastRefreshAtom } from '@/atoms/volumes';
import { useBackgroundSync } from '@/utils/background-sync';

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
    mutateAsync: (
      volumeIds: string[],
      options?: { async?: boolean; method?: string },
    ) => Promise<any>;
    isLoading: boolean;
  };
  refreshVolumes: () => void;
}

export function useVolumeOperations(): UseVolumeOperationsReturn {
  const queryClient = useQueryClient();
  const setLastRefresh = useSetAtom(lastRefreshAtom);
  const { isOnline, addPendingOperation } = useBackgroundSync();

  // Size refresh mutation
  const sizeRefreshMutation = usePostApiV1VolumesIdSizeRefresh({
    mutation: {
      onSuccess: () => {
        // Invalidate volume queries. The per-volume size query key is
        // templated with the volume ID (`/api/v1/volumes/${id}/size`), so a
        // predicate match on the path prefix catches it regardless of which
        // volume was refreshed.
        queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
        queryClient.invalidateQueries({
          predicate: (query) =>
            typeof query.queryKey[0] === 'string' &&
            query.queryKey[0].startsWith('/api/v1/volumes/') &&
            query.queryKey[0].endsWith('/size'),
        });
        setLastRefresh(Date.now());
      },
    },
  });

  // Filesystem indexing mutation
  const filesystemIndexMutation = usePostApiV1VolumesIdFilesystemIndex({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
        setLastRefresh(Date.now());
      },
    },
  });

  // Bulk scan mutation
  const bulkScanMutation = usePostApiV1VolumesBulkScan({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
        setLastRefresh(Date.now());
      },
    },
  });

  const refreshVolumes = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
    setLastRefresh(Date.now());
  };

  return {
    // Trigger full filesystem scan through scheduler (proper scan_job creation).
    // POST /volumes/{id}/scan isn't in the OpenAPI spec (see FIXES_2.md #13),
    // so there's no generated hook for it — customFetchClient is the same
    // shared client every generated hook uses under the hood, so this still
    // gets the Authorization header, 401 session-expiry handling, and
    // consistent error shape everything else gets (see useFileOperations.ts
    // for the same pattern with other spec-less endpoints).
    scanVolume: {
      mutateAsync: async (volumeId: string) => {
        if (isOnline) {
          const data = await customFetchClient(`/volumes/${volumeId}/scan`, {
            method: 'POST',
          });

          // Invalidate queries to refresh UI
          queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });

          return data;
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
      isLoading: false, // Not using mutation hook anymore
    },
    refreshVolumeSize: {
      mutateAsync: async (volumeId: string) => {
        if (isOnline) {
          return sizeRefreshMutation.mutateAsync({ id: volumeId, data: {} });
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
          return filesystemIndexMutation.mutateAsync({
            id: volumeId,
            data: { full_scan: true },
          });
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
        // method is accepted for API-shape compatibility but not currently
        // read by the backend's async bulk-scan path — the scanner only has
        // one method (walker; see FIXES_2.md #1l), selected server-side.
        const { async = false, method = 'walker' } = options;
        if (isOnline) {
          return bulkScanMutation.mutateAsync({
            data: {
              async,
              method,
              volume_ids: volumeIds,
            },
          });
        } else {
          // Queue each volume for background sync when offline
          volumeIds.forEach((volumeId) => {
            addPendingOperation({
              type: 'scan',
              volumeId,
              data: { async, method },
              maxRetries: 3,
            });
          });
          return Promise.resolve({
            queued: true,
            offline: true,
            count: volumeIds.length,
          });
        }
      },
      isLoading: bulkScanMutation.isPending,
    },
    refreshVolumes,
  };
}

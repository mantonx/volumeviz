import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePostVolumesVolumeIdTrack,
  usePostVolumesVolumeIdUntrack,
} from '@/api/orval-generated/api';
import { useVolumeOperations } from '@/hooks/api/useVolumeOperations';
import { useToast } from '@/components/ui/Toast';

export interface UseVolumeRowActionsOptions {
  /** Callback to trigger data refetch after mutations */
  onRefetch?: () => void;
}

export interface UseVolumeRowActionsReturn {
  /** Track a volume */
  trackVolume: (volumeId: string) => Promise<void>;
  /** Untrack a volume */
  untrackVolume: (volumeId: string) => Promise<void>;
  /** Scan a volume */
  scanVolume: (volumeId: string) => Promise<void>;
  /** Refresh volume size */
  refreshVolumeSize: (volumeId: string) => Promise<void>;
  /** Whether track mutation is loading */
  isTracking: boolean;
  /** Whether untrack mutation is loading */
  isUntracking: boolean;
}

/**
 * Hook for managing volume row actions (track, untrack, scan, refresh).
 *
 * Handles:
 * - Volume tracking/untracking with query invalidation
 * - Volume scanning
 * - Volume size refresh
 * - Loading states for each action
 *
 * @param options - Configuration options
 * @returns Object with action functions and loading states
 *
 * @example
 * ```tsx
 * const { trackVolume, untrackVolume, scanVolume, isTracking } =
 *   useVolumeRowActions({ onRefetch });
 *
 * <button onClick={() => trackVolume(volume.name)} disabled={isTracking}>
 *   Track Volume
 * </button>
 * ```
 */
export const useVolumeRowActions = (
  options: UseVolumeRowActionsOptions = {},
): UseVolumeRowActionsReturn => {
  const { onRefetch } = options;
  const queryClient = useQueryClient();
  const { scanVolume: scanVolumeOp, refreshVolumeSize: refreshVolumeSizeOp } =
    useVolumeOperations();
  const toast = useToast();

  const trackVolumeMutation = usePostVolumesVolumeIdTrack({
    mutation: {
      onSuccess: () => {
        // Invalidate all volumes queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
        // Also call the refetch callback for immediate UI update
        onRefetch?.();
        toast.success('Volume is now being tracked');
      },
      onError: (error: any) => {
        toast.error(`Failed to track volume: ${error?.message || 'Unknown error'}`);
      },
    },
  });

  const untrackVolumeMutation = usePostVolumesVolumeIdUntrack({
    mutation: {
      onSuccess: () => {
        // Invalidate all volumes queries to ensure fresh data
        queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
        // Also call the refetch callback for immediate UI update
        onRefetch?.();
        toast.success('Volume is no longer being tracked');
      },
      onError: (error: any) => {
        toast.error(`Failed to untrack volume: ${error?.message || 'Unknown error'}`);
      },
    },
  });

  const trackVolume = useCallback(
    async (volumeId: string) => {
      try {
        await trackVolumeMutation.mutateAsync({ name: volumeId });
      } catch (error) {
        // Error already handled in onError callback
        console.error('Track volume error:', error);
      }
    },
    [trackVolumeMutation],
  );

  const untrackVolume = useCallback(
    async (volumeId: string) => {
      try {
        await untrackVolumeMutation.mutateAsync({ name: volumeId });
      } catch (error) {
        // Error already handled in onError callback
        console.error('Untrack volume error:', error);
      }
    },
    [untrackVolumeMutation],
  );

  const scanVolume = useCallback(
    async (volumeId: string) => {
      try {
        await scanVolumeOp.mutateAsync(volumeId);
        toast.success('Scan started');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to start scan');
      }
    },
    [scanVolumeOp, toast],
  );

  const refreshVolumeSize = useCallback(
    async (volumeId: string) => {
      try {
        await refreshVolumeSizeOp.mutateAsync(volumeId);
        toast.success('Volume size refresh started');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to refresh volume size');
      }
    },
    [refreshVolumeSizeOp, toast],
  );

  return {
    trackVolume,
    untrackVolume,
    scanVolume,
    refreshVolumeSize,
    isTracking: trackVolumeMutation.isPending,
    isUntracking: untrackVolumeMutation.isPending,
  };
};

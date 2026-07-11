import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useDeleteVolumesVolumeId,
  usePostVolumesBulkDelete,
} from '@/api/orval-generated/api';
import { useToast } from '@/components/ui/Toast';

export interface VolumeDeleteCandidate {
  name: string;
  size_bytes?: number;
}

export interface VolumeDeleteFailure {
  volume_id: string;
  error: string;
}

export interface UseVolumeDeleteReturn {
  /** Volumes currently staged in the confirm modal (empty when closed). */
  pendingVolumes: VolumeDeleteCandidate[];
  /** Per-volume failures from the last completed delete attempt. */
  failures: VolumeDeleteFailure[];
  isModalOpen: boolean;
  isDeleting: boolean;
  /** Open the confirm modal for one or more volumes. */
  requestDelete: (volumes: VolumeDeleteCandidate[]) => void;
  /** Close the modal without deleting anything. */
  cancelDelete: () => void;
  /** Confirm and actually perform the delete for whatever's pending. Resolves
   * true only if every pending volume was deleted successfully — false on
   * any failure (including a partial bulk failure, where the modal stays
   * open scoped to just the volumes that didn't go through). */
  confirmDelete: () => Promise<boolean>;
}

/**
 * Manages the full delete-volume flow: staging candidates, showing the
 * confirm modal, and calling the real single/bulk delete endpoints. The
 * mutation never fires until confirmDelete() is called from the modal's
 * typed-confirmation gate — requestDelete() only stages state, it never
 * deletes anything by itself.
 */
export const useVolumeDelete = (): UseVolumeDeleteReturn => {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [pendingVolumes, setPendingVolumes] = useState<
    VolumeDeleteCandidate[]
  >([]);
  const [failures, setFailures] = useState<VolumeDeleteFailure[]>([]);

  const deleteOneMutation = useDeleteVolumesVolumeId();
  const bulkDeleteMutation = usePostVolumesBulkDelete();

  const isDeleting =
    deleteOneMutation.isPending || bulkDeleteMutation.isPending;

  const invalidateAfterDelete = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });
    await queryClient.invalidateQueries({
      queryKey: ['/api/v1/reports/orphaned'],
    });
  }, [queryClient]);

  const requestDelete = useCallback((volumes: VolumeDeleteCandidate[]) => {
    setFailures([]);
    setPendingVolumes(volumes);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeleting) return;
    setPendingVolumes([]);
    setFailures([]);
  }, [isDeleting]);

  const confirmDelete = useCallback(async (): Promise<boolean> => {
    if (pendingVolumes.length === 0) return true;

    if (pendingVolumes.length === 1) {
      const volumeId = pendingVolumes[0].name;
      try {
        await deleteOneMutation.mutateAsync({ name: volumeId });
        await invalidateAfterDelete();
        success(`Deleted volume '${volumeId}'`);
        setPendingVolumes([]);
        setFailures([]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError(`Failed to delete volume: ${message}`);
        setFailures([{ volume_id: volumeId, error: message }]);
        return false;
      }
    }

    try {
      const response = await bulkDeleteMutation.mutateAsync({
        data: { volume_ids: pendingVolumes.map((v) => v.name) },
      });
      await invalidateAfterDelete();

      const body = response.status === 200 ? response.data : undefined;
      const succeeded: string[] = body?.succeeded ?? [];
      const failed: VolumeDeleteFailure[] = (body?.failed ?? []).map((f) => ({
        volume_id: f.volume_id ?? '',
        error: f.error ?? 'Unknown error',
      }));

      if (failed.length === 0) {
        success(`Deleted ${succeeded.length} volume(s)`);
        setPendingVolumes([]);
        setFailures([]);
        return true;
      }

      if (succeeded.length === 0) {
        showError(`Failed to delete all ${failed.length} volume(s)`);
        setFailures(failed);
        return false;
      }

      success(`Deleted ${succeeded.length} volume(s)`);
      showError(`${failed.length} volume(s) could not be deleted`);
      // Keep the modal open, scoped to just the failures, so the user can
      // see exactly what didn't go through without re-selecting anything.
      setPendingVolumes(
        pendingVolumes.filter((v) =>
          failed.some((f) => f.volume_id === v.name),
        ),
      );
      setFailures(failed);
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showError(`Bulk delete failed: ${message}`);
      return false;
    }
  }, [
    pendingVolumes,
    deleteOneMutation,
    bulkDeleteMutation,
    invalidateAfterDelete,
    success,
    showError,
  ]);

  return {
    pendingVolumes,
    failures,
    isModalOpen: pendingVolumes.length > 0,
    isDeleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
};

export default useVolumeDelete;

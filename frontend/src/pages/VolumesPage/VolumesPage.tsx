import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VolumesList } from '@/components/domain/volumes';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useVolumeWebSocket } from '@/hooks/useVolumeWebSocket';
import { HardDrive } from 'lucide-react';

/**
 * VolumesPage - Comprehensive Docker volume management page
 *
 * Features:
 * - Volume listing with grid/table views
 * - Advanced filtering and search
 * - Bulk operations (scan) - see VolumesList, which owns selection state
 * - Real-time scan progress
 * - Volume analytics and insights
 * - Export functionality
 */
export const VolumesPage: React.FC = () => {
  // Real-time updates via WebSocket
  const { onSizeUpdate, onMetadataUpdate, onScanProgress } = useVolumeWebSocket({
    enabled: true,
  });

  const queryClient = useQueryClient();

  // Track volume updates for refresh indicator
  const [, setHasUpdates] = useState(false);

  // Listen for volume size updates
  useEffect(() => {
    // Volumes are fetched with page/filter-specific query keys, so we
    // invalidate by the shared '/api/v1/volumes' prefix rather than trying
    // to reconstruct the exact key VolumesList is currently using.
    const refetchVolumes = () =>
      queryClient.invalidateQueries({ queryKey: ['/api/v1/volumes'] });

    const cleanupSize = onSizeUpdate(() => {
      setHasUpdates(true);
      refetchVolumes();
    });

    const cleanupMetadata = onMetadataUpdate(() => {
      setHasUpdates(true);
      refetchVolumes();
    });

    const cleanupProgress = onScanProgress((event) => {
      if (event.status === 'completed') {
        refetchVolumes();
      }
    });

    return () => {
      cleanupSize();
      cleanupMetadata();
      cleanupProgress();
    };
  }, [onSizeUpdate, onMetadataUpdate, onScanProgress, queryClient]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-blue-600" />
            Volumes
          </h1>
          <p className="mt-2 text-secondary">
            Manage and analyze your Docker volumes
          </p>
        </div>

        {/* Main Volume List with Error Boundary - owns its own selection
            state and bulk-scan flow */}
        <ErrorBoundary>
          <VolumesList />
        </ErrorBoundary>
      </div>
    </div>
  );
};

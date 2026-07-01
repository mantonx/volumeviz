import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { VolumesList } from '@/components/domain/volumes';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { usePostVolumesBulkScan } from '@/api/orval-generated/api';
import { useVolumeWebSocket } from '@/hooks/useVolumeWebSocket';
import {
  HardDrive,
  RefreshCw,
  CheckCircle,
  Scan,
} from 'lucide-react';

/**
 * VolumesPage - Comprehensive Docker volume management page
 *
 * Features:
 * - Volume listing with grid/table views
 * - Advanced filtering and search
 * - Bulk operations (scan)
 * - Real-time scan progress
 * - Volume analytics and insights
 * - Export functionality
 */
export const VolumesPage: React.FC = () => {
  // Modal states
  const [isBulkScanModalOpen, setIsBulkScanModalOpen] = useState(false);
  const [selectedVolumes] = useState<string[]>([]);

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
    // invalidate by the shared '/volumes' prefix rather than trying to
    // reconstruct the exact key VolumesList is currently using.
    const refetchVolumes = () =>
      queryClient.invalidateQueries({ queryKey: ['/volumes'] });

    const cleanupSize = onSizeUpdate((event) => {
      console.log('[VolumesPage] Volume size updated:', event);
      setHasUpdates(true);
      refetchVolumes();
    });

    const cleanupMetadata = onMetadataUpdate((event) => {
      console.log('[VolumesPage] Volume metadata updated:', event);
      setHasUpdates(true);
      refetchVolumes();
    });

    const cleanupProgress = onScanProgress((event) => {
      console.log('[VolumesPage] Scan progress:', event);
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

  // Bulk scan mutation
  const bulkScanMutation = usePostVolumesBulkScan();

  // Handlers
  const handleBulkScan = async () => {
    try {
      await bulkScanMutation.mutateAsync({
        data: {
          volume_ids: selectedVolumes,
          async: true,
          method: 'du',
        },
      });
      setIsBulkScanModalOpen(false);
      // Show success notification
    } catch (error) {
      console.error('Bulk scan failed:', error);
      // Show error notification
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                <HardDrive className="w-8 h-8 text-blue-600" />
                Volumes
              </h1>
              <p className="mt-2 text-secondary">
                Manage and analyze your Docker volumes
              </p>
            </div>

            {/* Quick Actions */}
            {selectedVolumes.length > 0 && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkScanModalOpen(true)}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  Scan Selected ({selectedVolumes.length})
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Volume List with Error Boundary */}
        <ErrorBoundary>
          <VolumesList />
        </ErrorBoundary>

        {/* Bulk Scan Confirmation Modal */}
        {isBulkScanModalOpen && (
          <Modal
            open={isBulkScanModalOpen}
            onClose={() => setIsBulkScanModalOpen(false)}
            header={{ title: 'Confirm Bulk Scan' }}
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <Scan className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Start scanning {selectedVolumes.length} volume
                    {selectedVolumes.length > 1 ? 's' : ''}?
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    This will perform a full file system scan for each selected
                    volume. Large volumes may take several minutes to complete.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsBulkScanModalOpen(false)}
                  disabled={bulkScanMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkScan}
                  disabled={bulkScanMutation.isPending}
                >
                  {bulkScanMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Starting Scan...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Start Scan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

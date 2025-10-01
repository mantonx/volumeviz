import React, { useState } from 'react';
import { VolumesList } from '@/components/domain/volumes';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { usePostVolumesBulkScan } from '@/api/orval-generated/api';
import {
  HardDrive,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Scan,
} from 'lucide-react';

/**
 * VolumesPage - Comprehensive Docker volume management page
 *
 * Features:
 * - Volume listing with grid/table views
 * - Advanced filtering and search
 * - Create/Edit/Delete operations
 * - Bulk operations (scan, delete)
 * - Real-time scan progress
 * - Volume analytics and insights
 * - Export functionality
 */
export const VolumesPage: React.FC = () => {
  // Modal states
  const [isBulkScanModalOpen, setIsBulkScanModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedVolumes, setSelectedVolumes] = useState<string[]>([]);

  // Bulk scan mutation
  const bulkScanMutation = usePostVolumesBulkScan();

  // Handlers
  const handleBulkScan = async () => {
    try {
      await bulkScanMutation.mutateAsync({
        data: {
          volume_ids: selectedVolumes,
          full_scan: true,
        },
      });
      setIsBulkScanModalOpen(false);
      // Show success notification
    } catch (error) {
      console.error('Bulk scan failed:', error);
      // Show error notification
    }
  };

  const handleBulkDelete = async () => {
    // TODO: Implement bulk delete when API is available
    console.log('Bulk delete:', selectedVolumes);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <HardDrive className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                Volumes
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Volume List */}
        <VolumesList />

        {/* Bulk Scan Confirmation Modal */}
        <Modal
          isOpen={isBulkScanModalOpen}
          onClose={() => setIsBulkScanModalOpen(false)}
          title="Confirm Bulk Scan"
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

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title="Confirm Deletion"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Delete {selectedVolumes.length} volume
                  {selectedVolumes.length > 1 ? 's' : ''}?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  This action cannot be undone. Volume data will be permanently
                  removed from tracking (Docker volumes themselves will not be
                  deleted).
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

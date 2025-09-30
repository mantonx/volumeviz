import React, { useState } from 'react';
import { VolumesList } from '@/components/domain/volumes';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePostVolumesBulkScan } from '@/api/orval-generated/api';
import {
  HardDrive,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Scan
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
  const [isAddVolumeModalOpen, setIsAddVolumeModalOpen] = useState(false);
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
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <HardDrive className="w-8 h-8 text-blue-600" />
                Volumes
              </h1>
              <p className="mt-2 text-gray-600">
                Manage and analyze your Docker volumes
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              {selectedVolumes.length > 0 && (
                <>
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
                </>
              )}
              <Button
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddVolumeModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Volume
              </Button>
            </div>
          </div>
        </div>

        {/* Main Volume List */}
        <VolumesList />

        {/* Add Volume Modal */}
        <Modal
          isOpen={isAddVolumeModalOpen}
          onClose={() => setIsAddVolumeModalOpen(false)}
          title="Add New Volume"
        >
          <AddVolumeForm onClose={() => setIsAddVolumeModalOpen(false)} />
        </Modal>

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
                  Start scanning {selectedVolumes.length} volume{selectedVolumes.length > 1 ? 's' : ''}?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  This will perform a full file system scan for each selected volume.
                  Large volumes may take several minutes to complete.
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
                  Delete {selectedVolumes.length} volume{selectedVolumes.length > 1 ? 's' : ''}?
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  This action cannot be undone. Volume data will be permanently removed
                  from tracking (Docker volumes themselves will not be deleted).
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
              <Button
                variant="danger"
                onClick={handleBulkDelete}
              >
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

/**
 * AddVolumeForm - Form for adding a new volume to tracking
 */
interface AddVolumeFormProps {
  onClose: () => void;
}

function AddVolumeForm({ onClose }: AddVolumeFormProps) {
  const [volumeName, setVolumeName] = useState('');
  const [volumePath, setVolumePath] = useState('');
  const [description, setDescription] = useState('');
  const [autoScan, setAutoScan] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement volume creation when API is available
    console.log('Create volume:', { volumeName, volumePath, description, autoScan });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="volumeName" className="block text-sm font-medium text-gray-700 mb-1">
          Volume Name *
        </label>
        <Input
          id="volumeName"
          type="text"
          placeholder="my-volume"
          value={volumeName}
          onChange={(e) => setVolumeName(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Docker volume name or identifier
        </p>
      </div>

      <div>
        <label htmlFor="volumePath" className="block text-sm font-medium text-gray-700 mb-1">
          Mount Path (optional)
        </label>
        <Input
          id="volumePath"
          type="text"
          placeholder="/var/lib/docker/volumes/my-volume/_data"
          value={volumePath}
          onChange={(e) => setVolumePath(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          id="description"
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Description of this volume..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex items-center">
        <input
          id="autoScan"
          type="checkbox"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          checked={autoScan}
          onChange={(e) => setAutoScan(e.target.checked)}
        />
        <label htmlFor="autoScan" className="ml-2 block text-sm text-gray-700">
          Automatically scan after creation
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Volume
        </Button>
      </div>
    </form>
  );
}

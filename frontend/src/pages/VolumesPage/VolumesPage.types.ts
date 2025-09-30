/**
 * Types for VolumesPage
 */

export interface VolumeFormData {
  volumeName: string;
  volumePath?: string;
  description?: string;
  autoScan: boolean;
}

export interface BulkOperation {
  type: 'scan' | 'delete' | 'export';
  volumeIds: string[];
}

export interface VolumesPageState {
  selectedVolumes: string[];
  isAddModalOpen: boolean;
  isBulkScanModalOpen: boolean;
  isDeleteConfirmOpen: boolean;
}

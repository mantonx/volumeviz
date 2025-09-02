export interface VolumeTableProps {
  volumes: Array<{
    id: string;
    name: string;
    path: string;
    size_bytes: number;
    quota_bytes?: number;
    file_count?: number;
    container_count: number;
    status: 'active' | 'inactive' | 'scanning' | 'error';
    last_scanned_at?: string;
    error_message?: string;
    created_at: string;
    updated_at: string;
  }>;
  isLoading?: boolean;
  selectedVolumeIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onVolumeSelect?: (volume: any) => void;
  showBulkActions?: boolean;
  className?: string;
}
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
    last_scan_at?: string;
    scan_status?: string;
    attachments_count?: number;
    error_message?: string;
    created_at: string;
    updated_at: string;
    is_tracked?: boolean;
    tracked_at?: string;
    untracked_at?: string;
  }>;
  isLoading?: boolean;
  selectedVolumeIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  showBulkActions?: boolean;
  className?: string;
  onRefetch?: () => void;
}

export interface VolumeCardProps {
  volume: {
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
  };
  isSelected?: boolean;
  onSelect?: (volumeId: string) => void;
  showActions?: boolean;
  className?: string;
}

export interface Volume {
  id: string;
  name: string;
  organization_id: number;
  path: string;
  container_name?: string;
  mount_point?: string;
  total_size: number;
  file_count: number;
  folder_count: number;
  is_active: boolean;
  is_scanning?: boolean;
  last_scan_at?: string;
  last_scan_status?: 'success' | 'failed' | 'in_progress';
  created_at: string;
  updated_at: string;
}

export interface VolumeFilters {
  searchTerm: string;
  organizationId: number | null;
  status: 'all' | 'active' | 'inactive';
  sortBy: 'name' | 'size' | 'created';
}

export interface VolumeStats {
  volume_id: string;
  total_size: number;
  file_count: number;
  folder_count: number;
  avg_file_size: number;
  largest_file_size: number;
  file_types: FileTypeDistribution[];
  size_distribution: SizeDistribution[];
  last_updated: string;
}

export interface FileTypeDistribution {
  extension: string;
  count: number;
  total_size: number;
  percentage: number;
}

export interface SizeDistribution {
  range: string;
  count: number;
  total_size: number;
}
export interface SystemOverviewProps {
  /** Array of volumes to analyze */
  volumes: Volume[];
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Enable real-time updates */
  enableRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Height of the component */
  height?: number;
  /** Callback when refresh is triggered */
  onRefresh?: () => Promise<void>;
  /** Callback when a driver is clicked */
  onDriverClick?: (driver: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface SystemStorageBreakdown {
  /** Total storage used across all volumes */
  totalSize: number;
  /** Number of active volumes */
  volumeCount: number;
  /** Number of mounted volumes */
  mountedCount: number;
  /** Number of unmounted volumes */
  unmountedCount: number;
  /** Breakdown by driver */
  byDriver: DriverBreakdown[];
  /** Breakdown by size ranges */
  bySizeRange: SizeRangeBreakdown[];
  /** Growth statistics */
  growth: GrowthStats;
}

export interface DriverBreakdown {
  /** Driver name (local, nfs, etc.) */
  driver: string;
  /** Number of volumes using this driver */
  volumeCount: number;
  /** Total size for this driver */
  totalSize: number;
  /** Percentage of total storage */
  percentage: number;
  /** Color for visualization */
  color: string;
  /** Average volume size for this driver */
  averageSize: number;
}

export interface SizeRangeBreakdown {
  /** Size range label (e.g., "< 1GB", "1-10GB") */
  label: string;
  /** Minimum size in bytes */
  minSize: number;
  /** Maximum size in bytes (null for unbounded) */
  maxSize: number | null;
  /** Number of volumes in this range */
  count: number;
  /** Total size for this range */
  totalSize: number;
  /** Percentage of total volumes */
  percentage: number;
  /** Color for visualization */
  color: string;
}

export interface GrowthStats {
  /** Number of new volumes (if tracking changes) */
  newVolumes?: number;
  /** Number of removed volumes (if tracking changes) */
  removedVolumes?: number;
  /** Total size change in bytes */
  sizeChange?: number;
  /** Percentage change in total size */
  sizeChangePercent?: number;
  /** Most active driver (by volume count change) */
  mostActiveDriver?: string;
}

export interface Volume {
  id: string;
  name: string;
  driver: string;
  mount_point: string;
  created_at: string;
  size?: number;
  mount_count?: number;
  labels?: Record<string, string>;
  options?: Record<string, any>;
}

// Predefined size ranges for categorization
export const SIZE_RANGES = [
  {
    label: '< 100MB',
    minSize: 0,
    maxSize: 100 * 1024 * 1024,
    color: '#22C55E',
  },
  {
    label: '100MB - 1GB',
    minSize: 100 * 1024 * 1024,
    maxSize: 1024 * 1024 * 1024,
    color: '#3B82F6',
  },
  {
    label: '1GB - 10GB',
    minSize: 1024 * 1024 * 1024,
    maxSize: 10 * 1024 * 1024 * 1024,
    color: '#F59E0B',
  },
  {
    label: '10GB - 100GB',
    minSize: 10 * 1024 * 1024 * 1024,
    maxSize: 100 * 1024 * 1024 * 1024,
    color: '#EF4444',
  },
  {
    label: '> 100GB',
    minSize: 100 * 1024 * 1024 * 1024,
    maxSize: null,
    color: '#8B5CF6',
  },
];

// Driver colors for consistent visualization
export const DRIVER_COLORS: Record<string, string> = {
  local: '#3B82F6',
  nfs: '#10B981',
  cifs: '#F59E0B',
  overlay: '#EF4444',
  tmpfs: '#8B5CF6',
  bind: '#F97316',
  volume: '#06B6D4',
  default: '#6B7280',
};

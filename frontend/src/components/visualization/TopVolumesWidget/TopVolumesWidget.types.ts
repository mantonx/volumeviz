export interface TopVolumesWidgetProps {
  /** Array of volumes to rank */
  volumes: Volume[];
  /** Maximum number of volumes to show */
  maxVolumes?: number;
  /** Sort criteria */
  sortBy?: 'size' | 'mount_count' | 'created_at';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Show visual indicators (progress bars, icons) */
  showIndicators?: boolean;
  /** Show additional volume details */
  showDetails?: boolean;
  /** Enable real-time updates */
  enableRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Size variant of the widget */
  size?: 'sm' | 'md' | 'lg';
  /** Callback when refresh is triggered */
  onRefresh?: () => Promise<void>;
  /** Callback when a volume is clicked */
  onVolumeClick?: (volumeId: string) => void;
  /** Callback when scan is triggered for a volume */
  onVolumeScan?: (volumeId: string) => Promise<void>;
  /** Additional CSS classes */
  className?: string;
}

export interface TopVolumeData {
  /** Volume ID */
  id: string;
  /** Volume name */
  name: string;
  /** Volume driver */
  driver: string;
  /** Volume size in bytes */
  size: number;
  /** Mount count */
  mountCount: number;
  /** Creation date */
  createdAt: Date;
  /** Mount point path */
  mountPoint: string;
  /** Percentage of total storage */
  percentage: number;
  /** Ranking position (1-based) */
  rank: number;
  /** Size category */
  sizeCategory: 'small' | 'medium' | 'large' | 'huge';
  /** Status indicator */
  status: 'mounted' | 'unmounted';
  /** Color for visualization */
  color: string;
  /** Growth trend (if available) */
  trend?: 'up' | 'down' | 'stable';
  /** Previous size for comparison */
  previousSize?: number;
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

// Size thresholds for categorization
export const SIZE_CATEGORIES = {
  small: { threshold: 100 * 1024 * 1024, color: '#22C55E' }, // < 100MB
  medium: { threshold: 1024 * 1024 * 1024, color: '#3B82F6' }, // < 1GB
  large: { threshold: 10 * 1024 * 1024 * 1024, color: '#F59E0B' }, // < 10GB
  huge: { threshold: Infinity, color: '#EF4444' }, // >= 10GB
};

// Colors for ranking visualization
export const RANKING_COLORS = [
  '#FFD700', // Gold - 1st place
  '#C0C0C0', // Silver - 2nd place
  '#CD7F32', // Bronze - 3rd place
  '#3B82F6', // Blue - 4th and below
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#F97316', // Orange
  '#EC4899', // Pink
  '#6B7280', // Gray
];

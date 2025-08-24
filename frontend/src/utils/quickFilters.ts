/**
 * Quick Filter utilities for volume/mount listing
 * Provides reusable filter configurations and utilities for consistent UI
 */

import {
  AlertTriangle,
  Eye,
  EyeOff,
  Database,
  Folder,
  HardDrive,
  Clock,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * Configuration for a quick filter button
 */
export interface QuickFilterConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  filterType: string;
  filterValue: string;
  description: string;
  apiKey: string;
  apiValue: string | number | boolean;
  category?: 'status' | 'type' | 'size' | 'time' | 'activity';
}

/**
 * Pre-defined quick filter configurations
 * Organized by category for maintainability
 */
export const QUICK_FILTER_CONFIGS = {
  // Status-based filters
  status: {
    orphaned: {
      id: 'orphaned',
      label: 'Orphaned',
      icon: AlertTriangle,
      filterType: 'status',
      filterValue: 'orphaned',
      description: 'Volumes with no container attachments',
      apiKey: 'orphaned',
      apiValue: true,
      category: 'status' as const,
    },
    untracked: {
      id: 'untracked',
      label: 'Untracked',
      icon: EyeOff,
      filterType: 'status',
      filterValue: 'untracked',
      description: 'Volumes not being tracked',
      apiKey: 'is_tracked',
      apiValue: false,
      category: 'status' as const,
    },
    tracked: {
      id: 'tracked',
      label: 'Tracked',
      icon: Eye,
      filterType: 'status',
      filterValue: 'tracked',
      description: 'Volumes being actively tracked',
      apiKey: 'is_tracked',
      apiValue: true,
      category: 'status' as const,
    },
  },

  // Type-based filters
  type: {
    volume: {
      id: 'volume_type',
      label: 'Volumes Only',
      icon: Database,
      filterType: 'type',
      filterValue: 'volume',
      description: 'Show only Docker volumes',
      apiKey: 'type',
      apiValue: 'volume',
      category: 'type' as const,
    },
    bind: {
      id: 'bind_mounts',
      label: 'Bind Mounts',
      icon: Folder,
      filterType: 'type',
      filterValue: 'bind',
      description: 'Show only bind mounts',
      apiKey: 'type',
      apiValue: 'bind',
      category: 'type' as const,
    },
  },

  // Size-based filters
  size: {
    large: {
      id: 'large_volumes',
      label: 'Large Volumes',
      icon: HardDrive,
      filterType: 'size',
      filterValue: 'large',
      description: 'Volumes larger than 1GB',
      apiKey: 'min_size',
      apiValue: 1073741824, // 1GB in bytes
      category: 'size' as const,
    },
  },

  // Time-based filters
  time: {
    recent: {
      id: 'recently_created',
      label: 'Recently Created',
      icon: Clock,
      filterType: 'time',
      filterValue: 'recent',
      description: 'Volumes created in the last 7 days',
      apiKey: 'created_after',
      apiValue: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      category: 'time' as const,
    },
  },

  // Activity-based filters
  activity: {
    growing: {
      id: 'growing_fast',
      label: 'Growing Fast',
      icon: TrendingUp,
      filterType: 'activity',
      filterValue: 'growing',
      description: 'Volumes with >10% growth rate',
      apiKey: 'min_growth_rate',
      apiValue: 0.1, // 10% growth
      category: 'activity' as const,
    },
  },
} as const;

/**
 * Get all available quick filters as a flat array
 */
export function getAllQuickFilters(): QuickFilterConfig[] {
  return Object.values(QUICK_FILTER_CONFIGS).flatMap((category) =>
    Object.values(category),
  );
}

/**
 * Get quick filters by category
 */
export function getQuickFiltersByCategory(
  category: QuickFilterConfig['category'],
): QuickFilterConfig[] {
  return getAllQuickFilters().filter((filter) => filter.category === category);
}

/**
 * Get a specific quick filter by ID
 */
export function getQuickFilterById(id: string): QuickFilterConfig | undefined {
  return getAllQuickFilters().find((filter) => filter.id === id);
}

/**
 * Create a custom quick filter configuration
 */
export function createQuickFilter(
  config: Omit<QuickFilterConfig, 'category'> & {
    category?: QuickFilterConfig['category'];
  },
): QuickFilterConfig {
  return {
    category: 'custom',
    ...config,
  } as QuickFilterConfig;
}

/**
 * Validate if a quick filter configuration is valid
 */
export function isValidQuickFilter(filter: QuickFilterConfig): boolean {
  return !!(
    filter.id &&
    filter.label &&
    filter.icon &&
    filter.filterType &&
    filter.filterValue &&
    filter.description &&
    filter.apiKey &&
    filter.apiValue !== undefined &&
    filter.apiValue !== null
  );
}

/**
 * Default quick filter sets for different use cases
 */
export const QUICK_FILTER_PRESETS = {
  // Basic set - most commonly used
  basic: [
    QUICK_FILTER_CONFIGS.status.orphaned,
    QUICK_FILTER_CONFIGS.type.volume,
    QUICK_FILTER_CONFIGS.size.large,
  ],

  // Extended set - includes time and activity filters
  extended: [
    QUICK_FILTER_CONFIGS.status.orphaned,
    QUICK_FILTER_CONFIGS.status.untracked,
    QUICK_FILTER_CONFIGS.type.volume,
    QUICK_FILTER_CONFIGS.type.bind,
    QUICK_FILTER_CONFIGS.size.large,
    QUICK_FILTER_CONFIGS.time.recent,
  ],

  // Advanced set - all available filters
  advanced: getAllQuickFilters(),

  // Admin set - focus on problem detection
  admin: [
    QUICK_FILTER_CONFIGS.status.orphaned,
    QUICK_FILTER_CONFIGS.status.untracked,
    QUICK_FILTER_CONFIGS.size.large,
    QUICK_FILTER_CONFIGS.activity.growing,
  ],
} as const;

import React from 'react';

// Container types - simplified for volume attachment data only
export interface VolumeAttachedContainer {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  state: string;
}

// API response types
export interface APIResponse<T> {
  data: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// UI component props
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Chart data types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// Filter and search types (simplified for volume attachments)
export interface ContainerFilters {
  status?: VolumeAttachedContainer['status'][];
  name?: string;
}

export interface SortConfig {
  field: keyof VolumeAttachedContainer;
  direction: 'asc' | 'desc';
}

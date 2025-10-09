/**
 * Types for AdvancedFilters component
 */

export type MediaTypeCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code';

export interface SizeRange {
  min?: number;
  minUnit?: 'B' | 'KB' | 'MB' | 'GB';
  max?: number;
  maxUnit?: 'B' | 'KB' | 'MB' | 'GB';
}

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface FilterState {
  sizeRange?: SizeRange;
  dateRange?: DateRange;
  mediaTypes?: MediaTypeCategory[];
  fileTypes?: string[];
  volumes?: string[];
  pathFilter?: string;
}

export interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
}

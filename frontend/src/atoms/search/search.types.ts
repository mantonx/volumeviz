export interface SearchQuery {
  text: string;
  filters: SearchFilters;
}

export interface SearchFilters {
  fileTypes: string[];
  sizeRange: {
    min?: number;
    max?: number;
  };
  dateRange: {
    start?: Date;
    end?: Date;
  };
  location?: string;
}

export interface AdvancedFilters {
  includeHidden: boolean;
  caseSensitive: boolean;
  useRegex: boolean;
  searchContent: boolean;
}
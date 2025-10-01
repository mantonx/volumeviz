export interface SearchFilters {
  q?: string;
  path?: string;
  glob?: string;
  regex?: string;
  mediaKind?: string;
  mime?: string[];
  minSize?: number;
  maxSize?: number;
  mtimeFrom?: string;
  mtimeTo?: string;
  durationFrom?: number;
  durationTo?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  hasGps?: boolean;
  hasSubs?: boolean;
  hashPresent?: boolean;
}

export interface SavedSearch {
  id: number;
  name: string;
  description?: string;
  filters: SearchFilters;
  tags?: string[];
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  execution_count?: number;
  user_id?: string;
}

export interface CreateSavedSearchRequest {
  name: string;
  description?: string;
  filters: SearchFilters;
  tags?: string[];
}

export interface UpdateSavedSearchRequest {
  name?: string;
  description?: string;
  filters?: SearchFilters;
  tags?: string[];
}

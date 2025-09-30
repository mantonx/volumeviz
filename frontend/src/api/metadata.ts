/**
 * Metadata API exports
 * Re-exports metadata-related API functions from the generated client
 */
export * from './orval-generated/api';

// TODO: These types and APIs are placeholders until backend implements metadata endpoints

export type FilterMetadataResponse = {
  file_types: string[];
  size_ranges: Array<{ min: number; max: number; label: string }>;
  date_ranges: Array<{ start: string; end: string; label: string }>;
  owners: string[];
  locations: string[];
};

// Placeholder API object until backend is ready
export const metadataApi = {
  getFilterMetadata: async (): Promise<FilterMetadataResponse> => {
    // TODO: Implement when backend endpoint exists
    return {
      file_types: [],
      size_ranges: [],
      date_ranges: [],
      owners: [],
      locations: [],
    };
  },
};

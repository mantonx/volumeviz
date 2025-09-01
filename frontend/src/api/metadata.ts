/**
 * Metadata API hooks
 * 
 * Legacy compatibility layer for metadata functionality.
 * Provides wrapper hooks that map to modern Orval-generated API hooks.
 */

import { 
  useGetApiV1MetadataFilesByDuration,
  useGetApiV1MetadataFilesByLocation,
  useGetApiV1MetadataFilesByMediaKind,
  useGetApiV1MetadataFilesByResolution,
} from './orval-generated/api';
import type {
  FilterMetadataResponse,
  GetApiV1MetadataFilesByDurationParams,
  GetApiV1MetadataFilesByLocationParams,
  GetApiV1MetadataFilesByMediaKindParams,
  GetApiV1MetadataFilesByResolutionParams,
} from './orval-generated/api';

// Legacy type exports
export type { FilterMetadataResponse };

// Files by duration hook
export const useFilesByDuration = (params?: GetApiV1MetadataFilesByDurationParams) => {
  const query = useGetApiV1MetadataFilesByDuration(params);
  
  return {
    files: query.data?.files || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Files by location hook
export const useFilesByLocation = (params?: GetApiV1MetadataFilesByLocationParams) => {
  const query = useGetApiV1MetadataFilesByLocation(params);
  
  return {
    files: query.data?.files || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Files by media kind hook
export const useFilesByMediaKind = (params?: GetApiV1MetadataFilesByMediaKindParams) => {
  const query = useGetApiV1MetadataFilesByMediaKind(params);
  
  return {
    files: query.data?.files || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Files by resolution hook
export const useFilesByResolution = (params?: GetApiV1MetadataFilesByResolutionParams) => {
  const query = useGetApiV1MetadataFilesByResolution(params);
  
  return {
    files: query.data?.files || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Metadata API utilities
export const metadataApi = {
  // Get filter metadata - placeholder implementation
  async getFilterMetadata(): Promise<FilterMetadataResponse> {
    // Placeholder - in real implementation this would make API call
    return {
      file_extensions: ['.jpg', '.png', '.mp4', '.pdf', '.txt', '.doc'],
      mime_types: ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf', 'text/plain'],
      media_kinds: ['image', 'video', 'audio', 'document'],
      metadata_supported: true,
    };
  },
  
  // Get available metadata fields
  async getMetadataFields(): Promise<string[]> {
    return [
      'duration',
      'resolution', 
      'location',
      'media_kind',
      'file_size',
      'created_date',
      'modified_date',
      'camera_make',
      'camera_model',
      'iso_speed',
      'focal_length',
    ];
  },
};
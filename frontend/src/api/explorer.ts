/**
 * Explorer API hooks
 * 
 * Legacy compatibility layer for explorer functionality.
 * Provides wrapper hooks that map to modern Orval-generated API hooks.
 */

import { 
  useGetApiV1ExplorerBrowse,
  useGetApiV1ExplorerFiles,
  useGetApiV1ExplorerFilesByExtension,
} from './orval-generated/api';
import type { 
  GetApiV1ExplorerBrowseParams,
  GetApiV1ExplorerFilesParams,
} from './orval-generated/api';

// File list hook - maps to the files endpoint
export const useFileList = (params?: GetApiV1ExplorerFilesParams) => {
  const query = useGetApiV1ExplorerFiles(params);
  
  return {
    files: query.data?.files || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Tree navigation hook - maps to the browse endpoint  
export const useTreeNavigation = (params?: GetApiV1ExplorerBrowseParams) => {
  const query = useGetApiV1ExplorerBrowse(params);
  
  return {
    tree: query.data?.tree || [],
    currentPath: query.data?.current_path || '/',
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Volume insights hook - placeholder for analytics data
export const useVolumeInsights = (volumeId?: string) => {
  // For now, return empty data structure until insights API is available
  return {
    insights: {
      totalSize: 0,
      fileCount: 0,
      topFileTypes: [],
      largestFiles: [],
      recentActivity: [],
    },
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
};
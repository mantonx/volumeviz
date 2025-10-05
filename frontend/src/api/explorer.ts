/**
 * Explorer API - Placeholder for file browsing functionality
 * TODO: Implement real file list API integration
 */

import type { FileItem } from '@/atoms/explorer';

export const useFileList = () => {
  return {
    data: [] as FileItem[],
    isLoading: false,
    error: null,
  };
};

export const useTreeNavigation = () => {
  return {
    expandedPaths: new Set<string>(),
    toggleExpand: () => {},
    navigateToPath: () => {},
  };
};

export const useVolumeInsights = () => {
  return {
    data: null,
    isLoading: false,
    error: null,
  };
};

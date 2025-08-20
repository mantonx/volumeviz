/**
 * Explorer API service hooks
 */

import { Api } from '@/api/generated/Api';
import {
  // File atoms
  currentPathAtom,
  // Current volume
  currentVolumeAtom,
  expandedNodesAtom,
  fileCompositionAtom,
  fileCompositionErrorAtom,
  fileCompositionLoadingAtom,
  fileDetailsAtom,
  fileDetailsErrorAtom,
  fileDetailsLoadingAtom,
  filesAtom,
  filesErrorAtom,
  filesLoadingAtom,
  filesPageAtom,
  filesPageSizeAtom,
  filesTotalAtom,
  isDrawerOpenAtom,
  searchFiltersAtom,
  // Search atoms
  searchQueryAtom,
  // File details atoms
  selectedFileAtom,
  topFoldersAtom,
  topFoldersErrorAtom,
  topFoldersLoadingAtom,
  treeErrorAtom,
  treeLoadingAtom,
  // Tree atoms
  treeNodesAtom,
  // Insights atoms
  volumeStatsAtom,
  volumeStatsErrorAtom,
  volumeStatsLoadingAtom,
  type FileDetails,
  type FileItem,
  type TreeNode,
} from '@/store/atoms/explorer';
import { useAtom, useAtomValue } from 'jotai';
import { useCallback } from 'react';

// Create configured API client instance
const explorerApi = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

/**
 * Hook for managing tree navigation
 */
export const useTreeNavigation = () => {
  const [treeNodes, setTreeNodes] = useAtom(treeNodesAtom);
  const [expandedNodes, setExpandedNodes] = useAtom(expandedNodesAtom);
  const [isLoading, setIsLoading] = useAtom(treeLoadingAtom);
  const [error, setError] = useAtom(treeErrorAtom);
  const currentVolume = useAtomValue(currentVolumeAtom);

  const loadTreeChildren = useCallback(
    async (path: string = '/', forceReload: boolean = false) => {
      if (!currentVolume) return;

      // Check if already loaded and not forcing reload
      if (treeNodes[path] && !forceReload) {
        return treeNodes[path];
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await explorerApi.api.v1ExplorerTreeChildrenList({
          volume_id: currentVolume,
          path,
          include_files: false,
        });

        const responseData = response.data;

        // Transform API response to TreeNode format
        const nodes: TreeNode[] = (responseData.children || []).map(
          (item) => ({
            id: `${path}/${item.name}`,
            name: item.name || '',
            path: `${path}/${item.name}`,
            type: item.is_directory ? 'folder' : 'file',
            hasChildren: item.is_directory && (item.has_children || false),
          }),
        );

        setTreeNodes((prev) => ({
          ...prev,
          [path]: nodes,
        }));

        return nodes;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load tree';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [currentVolume, treeNodes, setTreeNodes, setIsLoading, setError],
  );

  const expandNode = useCallback(
    (path: string) => {
      setExpandedNodes((prev) => new Set([...prev, path]));
      return loadTreeChildren(path);
    },
    [setExpandedNodes, loadTreeChildren],
  );

  const collapseNode = useCallback(
    (path: string) => {
      setExpandedNodes((prev) => {
        const newSet = new Set([...prev]);
        newSet.delete(path);
        return newSet;
      });
    },
    [setExpandedNodes],
  );

  const toggleNode = useCallback(
    (path: string) => {
      if (expandedNodes.has(path)) {
        collapseNode(path);
      } else {
        return expandNode(path);
      }
    },
    [expandedNodes, expandNode, collapseNode],
  );

  return {
    treeNodes,
    expandedNodes,
    isLoading,
    error,
    loadTreeChildren,
    expandNode,
    collapseNode,
    toggleNode,
  };
};

/**
 * Hook for managing file listing
 */
export const useFileList = () => {
  const [files, setFiles] = useAtom(filesAtom);
  const [isLoading, setIsLoading] = useAtom(filesLoadingAtom);
  const [error, setError] = useAtom(filesErrorAtom);
  const [total, setTotal] = useAtom(filesTotalAtom);
  const [page, setPage] = useAtom(filesPageAtom);
  const [pageSize] = useAtom(filesPageSizeAtom);
  const currentPath = useAtomValue(currentPathAtom);
  const currentVolume = useAtomValue(currentVolumeAtom);
  const searchFilters = useAtomValue(searchFiltersAtom);

  const loadFiles = useCallback(
    async (path?: string, pageNum?: number) => {
      if (!currentVolume) return;

      const targetPath = path || currentPath;
      const targetPage = pageNum || page;

      setIsLoading(true);
      setError(null);

      try {
        const response = await explorerApi.api.v1ExplorerFilesList({
          volume_id: currentVolume,
          path: targetPath,
          page: targetPage,
          limit: pageSize,
          file_type: searchFilters.extension,
          min_size: searchFilters.minSize,
          max_size: searchFilters.maxSize,
          sort_by: 'name',
          sort_order: 'asc',
        });

        const responseData = response.data;

        // Transform API response to FileItem format
        const items: FileItem[] = (responseData.files || []).map((item) => ({
          id: `${targetPath}/${item.name}`,
          name: item.name || '',
          path: item.path || `${targetPath}/${item.name}`,
          type: item.is_directory ? 'folder' : 'file',
          size: item.size || 0,
          modified: item.modified_time || new Date().toISOString(),
          extension: item.extension,
          mediaType: item.media_type,
          permissions: undefined, // Not provided by new API
          owner: undefined, // Not provided by new API
          group: undefined, // Not provided by new API
        }));

        setFiles(items);
        setTotal(responseData.total_count || items.length);

        return items;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load files';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentVolume,
      currentPath,
      page,
      pageSize,
      searchFilters,
      setFiles,
      setTotal,
      setIsLoading,
      setError,
    ],
  );

  const refreshFiles = useCallback(() => {
    return loadFiles(currentPath, 1);
  }, [loadFiles, currentPath]);

  return {
    files,
    isLoading,
    error,
    total,
    page,
    pageSize,
    loadFiles,
    refreshFiles,
    setPage,
  };
};

/**
 * Hook for managing file details
 */
export const useFileDetails = () => {
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [fileDetails, setFileDetails] = useAtom(fileDetailsAtom);
  const [isLoading, setIsLoading] = useAtom(fileDetailsLoadingAtom);
  const [error, setError] = useAtom(fileDetailsErrorAtom);
  const [isDrawerOpen, setIsDrawerOpen] = useAtom(isDrawerOpenAtom);

  const loadFileDetails = useCallback(
    async (file: FileItem) => {
      if (!file.id || file.type === 'folder') return;

      setIsLoading(true);
      setError(null);

      try {
        // For now, we'll use basic file info since the file details API requires numeric ID
        // which we don't have from the new API response structure
        const fileDetailsData: FileDetails = {
          ...file,
          created: file.modified,
          accessed: file.modified, // API doesn't provide accessed time
          rawMetadata: {}, // Will be loaded separately when metadata API is updated
        };

        setFileDetails(fileDetailsData);
        return fileDetailsData;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load file details';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setFileDetails, setIsLoading, setError],
  );

  const selectFile = useCallback(
    (file: FileItem) => {
      setSelectedFile(file);
      setIsDrawerOpen(true);
      if (file.type === 'file') {
        loadFileDetails(file);
      }
    },
    [setSelectedFile, setIsDrawerOpen, loadFileDetails],
  );

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedFile(null);
    setFileDetails(null);
  }, [setIsDrawerOpen, setSelectedFile, setFileDetails]);

  return {
    selectedFile,
    fileDetails,
    isLoading,
    error,
    isDrawerOpen,
    selectFile,
    closeDrawer,
    loadFileDetails,
  };
};

/**
 * Hook for managing volume insights
 */
export const useVolumeInsights = () => {
  const [volumeStats, setVolumeStats] = useAtom(volumeStatsAtom);
  const [statsLoading, setStatsLoading] = useAtom(volumeStatsLoadingAtom);
  const [statsError, setStatsError] = useAtom(volumeStatsErrorAtom);

  const [topFolders, setTopFolders] = useAtom(topFoldersAtom);
  const [foldersLoading, setFoldersLoading] = useAtom(topFoldersLoadingAtom);
  const [foldersError, setFoldersError] = useAtom(topFoldersErrorAtom);

  const [fileComposition, setFileComposition] = useAtom(fileCompositionAtom);
  const [compositionLoading, setCompositionLoading] = useAtom(
    fileCompositionLoadingAtom,
  );
  const [compositionError, setCompositionError] = useAtom(
    fileCompositionErrorAtom,
  );

  const currentVolume = useAtomValue(currentVolumeAtom);

  const loadVolumeStats = useCallback(
    async (days: number = 30) => {
      if (!currentVolume) return;

      setStatsLoading(true);
      setStatsError(null);

      try {
        const response = await explorerApi.stats.dailyList({
          volume_id: currentVolume,
          days,
        });

        const responseData = response.data;
        const transformedStats = (responseData.daily_stats || []).map((stat) => ({
          volume_id: stat.volume_id || currentVolume,
          date: stat.date || '',
          total_size: stat.size_bytes || 0,
          file_count: stat.file_count || 0,
          folder_count: stat.folder_count || 0,
          growth_bytes: stat.growth || 0,
          growth_files: 0, // Not provided by API
        }));
        setVolumeStats(transformedStats);
        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load volume stats';
        setStatsError(errorMessage);
        throw err;
      } finally {
        setStatsLoading(false);
      }
    },
    [currentVolume, setVolumeStats, setStatsLoading, setStatsError],
  );

  const loadTopFolders = useCallback(
    async (limit: number = 10) => {
      if (!currentVolume) return;

      setFoldersLoading(true);
      setFoldersError(null);

      try {
        const response = await explorerApi.stats.topFoldersList({
          volume_id: currentVolume,
          limit,
        });

        const responseData = response.data;
        const transformedResponse = (responseData.folders || []).map((folder) => ({
          path: folder.path || '',
          name: folder.name || '',
          size: folder.disk_usage_bytes_recursive || 0,
          file_count: folder.file_count || 0,
          growth_bytes: 0, // API doesn't provide this yet
          growth_percentage: 0, // API doesn't provide this yet
        }));

        setTopFolders(transformedResponse);
        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load top folders';
        setFoldersError(errorMessage);
        throw err;
      } finally {
        setFoldersLoading(false);
      }
    },
    [currentVolume, setTopFolders, setFoldersLoading, setFoldersError],
  );

  const loadFileComposition = useCallback(async () => {
    if (!currentVolume) return;

    setCompositionLoading(true);
    setCompositionError(null);

    try {
      // TODO: Implement file type stats API
      // For now, return mock data
      const mockComposition = [
        {
          extension: 'mp4',
          count: 150,
          total_size: 50000000000,
          percentage: 45.2,
        },
        {
          extension: 'jpg',
          count: 1200,
          total_size: 25000000000,
          percentage: 22.6,
        },
        {
          extension: 'pdf',
          count: 300,
          total_size: 15000000000,
          percentage: 13.6,
        },
        {
          extension: 'txt',
          count: 800,
          total_size: 8000000000,
          percentage: 7.2,
        },
        {
          extension: 'other',
          count: 500,
          total_size: 12000000000,
          percentage: 11.4,
        },
      ];

      setFileComposition(mockComposition);
      return mockComposition;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load file composition';
      setCompositionError(errorMessage);
      throw err;
    } finally {
      setCompositionLoading(false);
    }
  }, [
    currentVolume,
    setFileComposition,
    setCompositionLoading,
    setCompositionError,
  ]);

  const loadAllInsights = useCallback(
    async (days: number = 30) => {
      await Promise.all([
        loadVolumeStats(days),
        loadTopFolders(),
        loadFileComposition(),
      ]);
    },
    [loadVolumeStats, loadTopFolders, loadFileComposition],
  );

  return {
    // Volume stats
    volumeStats,
    statsLoading,
    statsError,
    loadVolumeStats,
    // Top folders
    topFolders,
    foldersLoading,
    foldersError,
    loadTopFolders,
    // File composition
    fileComposition,
    compositionLoading,
    compositionError,
    loadFileComposition,
    // Combined loading
    loadAllInsights,
    isLoading: statsLoading || foldersLoading || compositionLoading,
  };
};

/**
 * Hook for managing search
 */
export const useExplorerSearch = () => {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const [searchFilters, setSearchFilters] = useAtom(searchFiltersAtom);
  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);

  const updateFilters = useCallback(
    (filters: Partial<typeof searchFilters>) => {
      setSearchFilters((prev) => ({ ...prev, ...filters }));
    },
    [setSearchFilters],
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSearchFilters({});
  }, [setSearchQuery, setSearchFilters]);

  const navigateToPath = useCallback(
    (path: string) => {
      setCurrentPath(path);
    },
    [setCurrentPath],
  );

  return {
    searchQuery,
    setSearchQuery,
    searchFilters,
    setSearchFilters: updateFilters,
    clearFilters,
    currentPath,
    navigateToPath,
  };
};

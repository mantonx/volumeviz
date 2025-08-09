/**
 * API service layer with Jotai integration
 * Provides hooks and utilities for interacting with the VolumeViz API
 */

import { getErrorMessage } from '@/utils/errorHandling';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

// Volume atoms
import {
  asyncScansAtom,
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
  scanErrorAtom,
  scanLoadingAtom,
  scanResultsAtom,
  volumesAtom,
  volumesErrorAtom,
  volumesLastUpdatedAtom,
  volumesLoadingAtom,
  volumesPaginationMetaAtom,
} from '@/store/atoms/volumes';

// API atoms
import {
  apiConnectedAtom,
  apiHealthAtom,
  apiHealthErrorAtom,
  apiHealthLoadingAtom,
} from '@/store/atoms/api';

// Container atoms
import {
  containersAtom,
  containersErrorAtom,
  containersLoadingAtom,
} from '@/store/atoms/containers';

// Import types from generated API client
import type { AsyncScanResponse, RefreshRequest, ScanResponse } from './client';

// Import generated API client
import { Api, type Volume } from './generated/volumeviz-api';

// Create configured API client instance
const volumeVizApi = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Updated VolumeListParams to match v1 API specification
export interface VolumeListParams {
  // Pagination parameters
  page?: number;
  page_size?: number;

  // Sorting parameter
  sort?: string;

  // Search and filter parameters
  q?: string; // Search query
  driver?: 'local' | 'nfs' | 'cifs' | 'overlay2';
  orphaned?: boolean;
  system?: boolean; // Replaces user_only (defaults to false)

  // Date filters
  created_after?: string; // ISO 8601 date string
  created_before?: string; // ISO 8601 date string
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  response_time?: number;
  open_connections?: number;
  idle_connections?: number;
  max_open_connections?: number;
  checks?: Record<
    string,
    {
      status: 'healthy' | 'unhealthy';
    }
  >;
  timestamp?: number;
}

// Interface for paginated volume response metadata
export interface VolumesPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  sort?: string;
  filters?: Record<string, any>;
}

/**
 * React hook for managing Docker volume data with v1 API pagination.
 *
 * Provides comprehensive volume management functionality including:
 * - Fetching volume lists with pagination, sorting, and filtering
 * - Loading states and error handling
 * - Last updated timestamp tracking
 * - Pagination metadata tracking
 * - Automatic state management through Jotai atoms
 *
 * @returns Object containing:
 * - volumes: Current volume data array
 * - loading: Boolean indicating if a request is in progress
 * - error: Error message string or null
 * - paginationMeta: Pagination metadata (page, total, etc.)
 * - fetchVolumes: Function to fetch volumes with pagination/filters
 * - refreshVolumes: Convenience function to refresh with last params
 *
 * @example
 * ```tsx
 * const { volumes, loading, error, paginationMeta, fetchVolumes } = useVolumes();
 *
 * // Fetch first page with default settings
 * useEffect(() => {
 *   fetchVolumes();
 * }, []);
 *
 * // Fetch with pagination and filters
 * const handleSearch = () => {
 *   fetchVolumes({
 *     page: 1,
 *     page_size: 50,
 *     q: 'web',
 *     sort: 'size_bytes:desc'
 *   });
 * };
 * ```
 */
export function useVolumes() {
  const [volumes, setVolumes] = useAtom(volumesAtom);
  const [loading, setLoading] = useAtom(volumesLoadingAtom);
  const [error, setError] = useAtom(volumesErrorAtom);
  const setLastUpdated = useSetAtom(volumesLastUpdatedAtom);
  const [paginationMeta, setPaginationMeta] = useAtom(
    volumesPaginationMetaAtom,
  );
  const lastParamsRef = useRef<VolumeListParams | undefined>(undefined);
  const requestSeqRef = useRef(0); // sequence counter to avoid race conditions

  const fetchVolumes = useCallback(
    async (params?: VolumeListParams) => {
      const seq = ++requestSeqRef.current; // increment sequence
      try {
        setLoading(true);
        setError(null);
        lastParamsRef.current = params;
        const queryParams = {
          page: params?.page ?? 1,
          page_size: params?.page_size ?? 25,
          sort: params?.sort,
          q: params?.q,
          driver: params?.driver,
          orphaned: params?.orphaned,
          system: params?.system,
          created_after: params?.created_after,
          created_before: params?.created_before,
        };
        const baseUrl =
          import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1';
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
          }
        });
        const url = `${baseUrl}/volumes?${searchParams.toString()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        // Ignore stale responses
        if (seq !== requestSeqRef.current) return;
        const pagedData = await response.json();
        const volumeData = pagedData.data || [];
        setVolumes(volumeData as Volume[]);
        setPaginationMeta({
          page: pagedData.page,
          pageSize: pagedData.page_size,
          total: pagedData.total,
          sort: pagedData.sort,
          filters: pagedData.filters,
        });
        setLastUpdated(new Date());
      } catch (err) {
        if (seq !== requestSeqRef.current) return; // suppress stale errors
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    },
    [setVolumes, setLoading, setError, setLastUpdated, setPaginationMeta],
  );

  const refreshVolumes = useCallback(() => {
    return fetchVolumes(lastParamsRef.current);
  }, [fetchVolumes]);

  return {
    volumes,
    loading,
    error,
    paginationMeta,
    fetchVolumes,
    refreshVolumes,
  };
}

/**
 * React hook for managing Docker volume size scanning operations.
 *
 * Handles both synchronous and asynchronous volume scanning:
 * - Immediate size calculation for small volumes
 * - Background scanning for large volumes with progress tracking
 * - Bulk scanning operations across multiple volumes
 * - Scan status monitoring and result caching
 *
 * @returns Object containing:
 * - scanLoading: Object mapping volume IDs to loading states
 * - scanError: Object mapping volume IDs to error messages
 * - scanResults: Object mapping volume IDs to size scan results
 * - asyncScans: Object mapping volume IDs to async scan handles
 * - scanVolume: Function to scan a specific volume
 * - getVolumeSize: Function to get cached or fresh volume size
 * - getScanStatus: Function to check async scan progress
 *
 * @example
 * ```tsx
 * const { scanVolume, scanResults, scanLoading } = useVolumeScanning();
 *
 * const handleScan = async (volumeId: string) => {
 *   try {
 *     await scanVolume(volumeId, { async: false });
 *     console.log('Scan result:', scanResults[volumeId]);
 *   } catch (error) {
 *     console.error('Scan failed:', error);
 *   }
 * };
 * ```
 */
export function useVolumeScanning() {
  const [scanLoading, setScanLoading] = useAtom(scanLoadingAtom);
  const [scanError, setScanError] = useAtom(scanErrorAtom);
  const [scanResults, setScanResults] = useAtom(scanResultsAtom);
  const [asyncScans, setAsyncScans] = useAtom(asyncScansAtom);

  const scanVolume = useCallback(
    async (volumeId: string, options?: RefreshRequest) => {
      try {
        // Set loading state for this specific volume
        setScanLoading((prev) => ({ ...prev, [volumeId]: true }));
        setScanError((prev) => ({ ...prev, [volumeId]: null }));

        // Use generated API client
        const response = await volumeVizApi.volumes.refreshVolumeSize(
          volumeId,
          options,
        );

        // Check if it's an async scan
        if ((response.data as any).scan_id) {
          setAsyncScans((prev) => ({
            ...prev,
            [volumeId]: response.data as unknown as AsyncScanResponse,
          }));
        } else {
          // Synchronous scan
          setScanResults((prev) => ({
            ...prev,
            [volumeId]: response.data as ScanResponse,
          }));
        }

        return response.data;
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setScanError((prev) => ({ ...prev, [volumeId]: errorMessage }));
        throw err;
      } finally {
        setScanLoading((prev) => ({ ...prev, [volumeId]: false }));
      }
    },
    [setScanLoading, setScanError, setScanResults, setAsyncScans],
  );

  const getVolumeSize = useCallback(
    async (volumeId: string) => {
      try {
        setScanLoading((prev) => ({ ...prev, [volumeId]: true }));
        setScanError((prev) => ({ ...prev, [volumeId]: null }));

        // Use generated API client
        const response = await volumeVizApi.volumes.getVolumeSize(volumeId);

        setScanResults((prev) => ({
          ...prev,
          [volumeId]: response.data as ScanResponse,
        }));

        return response.data;
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setScanError((prev) => ({ ...prev, [volumeId]: errorMessage }));
        throw err;
      } finally {
        setScanLoading((prev) => ({ ...prev, [volumeId]: false }));
      }
    },
    [setScanLoading, setScanError, setScanResults],
  );

  const getScanStatus = useCallback(
    async (volumeId: string, scanId?: string) => {
      // Use generated API client
      const response = await volumeVizApi.volumes.getScanStatus(volumeId, {
        scan_id: scanId,
      });
      return response.data;
    },
    [],
  );

  return {
    scanLoading,
    scanError,
    scanResults,
    asyncScans,
    scanVolume,
    getVolumeSize,
    getScanStatus,
  };
}

/**
 * Hook for API health monitoring
 */
export function useApiHealth() {
  const [health, setHealth] = useAtom(apiHealthAtom);
  const [loading, setLoading] = useAtom(apiHealthLoadingAtom);
  const [error, setError] = useAtom(apiHealthErrorAtom);
  const connected = useAtomValue(apiConnectedAtom);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use direct fetch since the generated API client has wrong endpoint path
      const baseUrl =
        import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1';
      const response = await fetch(`${baseUrl}/health`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();

      setHealth({
        status: healthData.status || 'unknown',
        timestamp: Date.now(),
        checks: healthData.checks || {},
      });
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      setHealth({
        status: 'unhealthy',
        timestamp: Date.now(),
        checks: {},
      });
    } finally {
      setLoading(false);
    }
  }, [setHealth, setLoading, setError]);

  const checkDatabaseHealth = useCallback(async () => {
    // Use generated API client
    const response = await volumeVizApi.database.getDatabaseHealth();
    return response.data;
  }, []);

  return {
    health,
    loading,
    error,
    connected,
    checkHealth,
    checkDatabaseHealth,
  };
}

/**
 * Hook for auto-refresh functionality
 */
export function useAutoRefresh() {
  const { refreshVolumes } = useVolumes();
  const { checkHealth } = useApiHealth();
  const autoRefreshEnabled = useAtomValue(autoRefreshEnabledAtom);
  const autoRefreshInterval = useAtomValue(autoRefreshIntervalAtom);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      refreshVolumes();
      checkHealth();
    }, autoRefreshInterval);
  }, [refreshVolumes, checkHealth, autoRefreshInterval]);

  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (autoRefreshEnabled) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [autoRefreshEnabled, startAutoRefresh, stopAutoRefresh]);

  return {
    autoRefreshEnabled,
    autoRefreshInterval,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

/**
 * Hook for bulk operations
 */
export function useBulkOperations() {
  const { refreshVolumes } = useVolumes();

  const bulkScan = useCallback(
    async (volumeIds: string[], options?: RefreshRequest) => {
      // Use generated API client for bulk scan
      const response = await volumeVizApi.volumes.bulkScanVolumes({
        volume_ids: volumeIds,
        ...options,
      });

      // Refresh volumes list after bulk operation
      await refreshVolumes();

      return response.data;
    },
    [refreshVolumes],
  );

  return {
    bulkScan,
  };
}

/**
 * Hook for fetching and managing container data
 *
 * Since VolumeViz doesn't have a direct containers list endpoint,
 * this service aggregates container information from volume data.
 *
 * @returns Container management functions and state
 */
export function useContainers() {
  const [containers, setContainers] = useAtom(containersAtom);
  const [loading, setLoading] = useAtom(containersLoadingAtom);
  const [error, setError] = useAtom(containersErrorAtom);
  const volumes = useAtomValue(volumesAtom);

  const fetchContainersForVolumes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch containers for each volume using new attachments endpoint
      const allContainers = new Map(); // Use Map to deduplicate by container ID

      // Fetch containers for each volume in parallel
      const containerPromises = volumes.map(async (volume) => {
        if (!volume.name) return [];

        try {
          // Use generated API client for volume attachments
          const response = await volumeVizApi.volumes.getVolumeAttachments(
            volume.name,
          );
          const attachmentsList = response.data;

          return attachmentsList.data || [];
        } catch (err) {
          // Silently ignore individual volume errors
          console.warn(
            `Failed to fetch containers for volume ${volume.name}:`,
            err,
          );
          return [];
        }
      });

      const containerArrays = await Promise.all(containerPromises);

      // Aggregate and deduplicate containers from attachments
      containerArrays.forEach((attachmentsList) => {
        attachmentsList.forEach((attachment) => {
          if (!allContainers.has(attachment.container_id)) {
            allContainers.set(attachment.container_id, {
              id: attachment.container_id,
              name:
                attachment.container_name?.replace(/^\//, '') ||
                attachment.container_id, // Remove leading slash
              status: 'unknown' as const, // State not provided by attachments endpoint
              state: 'unknown',
            });
          }
        });
      });

      const uniqueContainers = Array.from(allContainers.values());
      setContainers(uniqueContainers);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [volumes, setContainers, setLoading, setError]);

  // Auto-fetch containers when volumes change
  useEffect(() => {
    if (volumes.length > 0) {
      fetchContainersForVolumes();
    }
  }, [volumes, fetchContainersForVolumes]);

  return {
    containers,
    loading,
    error,
    fetchContainers: fetchContainersForVolumes,
  };
}

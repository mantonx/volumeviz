/**
 * API service layer with Jotai integration
 * Provides hooks and utilities for interacting with the VolumeViz API
 */

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { useHttpClient } from './http-client';
import type { ApiResponse } from './http-client';

// Volume atoms
import {
  volumesAtom,
  volumesLoadingAtom,
  volumesErrorAtom,
  volumesLastUpdatedAtom,
  scanLoadingAtom,
  scanErrorAtom,
  scanResultsAtom,
  asyncScansAtom,
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
} from '@/store/atoms/volumes';

// API atoms
import {
  apiHealthAtom,
  apiHealthLoadingAtom,
  apiHealthErrorAtom,
  apiConnectedAtom,
} from '@/store/atoms/api';

// Container atoms
import {
  containersAtom,
  containersLoadingAtom,
  containersErrorAtom,
} from '@/store/atoms/containers';

// Import types from generated API client
import type {
  VolumeResponse,
  ScanResponse,
  AsyncScanResponse,
  RefreshRequest,
} from './client';

export interface VolumeListParams {
  driver?: string;
  label_key?: string;
  label_value?: string;
  user_only?: boolean;
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

/**
 * React hook for managing Docker volume data and operations.
 *
 * Provides comprehensive volume management functionality including:
 * - Fetching volume lists with optional filtering (driver, labels)
 * - Loading states and error handling
 * - Last updated timestamp tracking
 * - Automatic state management through Jotai atoms
 *
 * @returns Object containing:
 * - volumes: Current volume data array
 * - loading: Boolean indicating if a request is in progress
 * - error: Error message string or null
 * - fetchVolumes: Function to fetch volumes with optional filters
 * - refreshVolumes: Convenience function to refresh current volume list
 *
 * @example
 * ```tsx
 * const { volumes, loading, error, fetchVolumes } = useVolumes();
 *
 * // Fetch all volumes
 * useEffect(() => {
 *   fetchVolumes();
 * }, []);
 *
 * // Fetch volumes with driver filter
 * const handleFilterByLocal = () => {
 *   fetchVolumes({ driver: 'local' });
 * };
 * ```
 */
export function useVolumes() {
  const httpClient = useHttpClient();
  const [volumes, setVolumes] = useAtom(volumesAtom);
  const [loading, setLoading] = useAtom(volumesLoadingAtom);
  const [error, setError] = useAtom(volumesErrorAtom);
  const setLastUpdated = useSetAtom(volumesLastUpdatedAtom);

  const fetchVolumes = useCallback(
    async (params?: VolumeListParams) => {
      try {
        setLoading(true);
        setError(null);

        const queryParams = new URLSearchParams();
        if (params?.driver) queryParams.append('driver', params.driver);
        if (params?.label_key)
          queryParams.append('label_key', params.label_key);
        if (params?.label_value)
          queryParams.append('label_value', params.label_value);
        // Default to showing only user volumes (excludes Docker infrastructure)
        const userOnly = params?.user_only ?? true;
        if (userOnly) queryParams.append('user_only', 'true');

        const queryString = queryParams.toString();
        const endpoint = `volumes${queryString ? `?${queryString}` : ''}`;

        const response: ApiResponse<{ volumes: VolumeResponse[] }> =
          await httpClient.get(endpoint);

        const volumes = response.data.volumes || [];
        setVolumes(volumes);
        setLastUpdated(new Date());
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch volumes';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [httpClient, setVolumes, setLoading, setError, setLastUpdated],
  );

  const refreshVolumes = useCallback(() => {
    return fetchVolumes();
  }, [fetchVolumes]);

  return {
    volumes,
    loading,
    error,
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
  const httpClient = useHttpClient();
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

        const response: ApiResponse<ScanResponse | AsyncScanResponse> =
          await httpClient.post(`volumes/${volumeId}/size/refresh`, options);

        // Check if it's an async scan
        if ('scan_id' in response.data) {
          // Async scan
          setAsyncScans((prev) => ({
            ...prev,
            [volumeId]: response.data as AsyncScanResponse,
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
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to scan volume';
        setScanError((prev) => ({ ...prev, [volumeId]: errorMessage }));
        throw err;
      } finally {
        setScanLoading((prev) => ({ ...prev, [volumeId]: false }));
      }
    },
    [httpClient, setScanLoading, setScanError, setScanResults, setAsyncScans],
  );

  const getVolumeSize = useCallback(
    async (volumeId: string) => {
      try {
        setScanLoading((prev) => ({ ...prev, [volumeId]: true }));
        setScanError((prev) => ({ ...prev, [volumeId]: null }));

        const response: ApiResponse<ScanResponse> = await httpClient.get(
          `volumes/${volumeId}/size`,
        );

        setScanResults((prev) => ({
          ...prev,
          [volumeId]: response.data,
        }));

        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get volume size';
        setScanError((prev) => ({ ...prev, [volumeId]: errorMessage }));
        throw err;
      } finally {
        setScanLoading((prev) => ({ ...prev, [volumeId]: false }));
      }
    },
    [httpClient, setScanLoading, setScanError, setScanResults],
  );

  const getScanStatus = useCallback(
    async (volumeId: string) => {
      const response: ApiResponse<{ status: string; progress?: number }> =
        await httpClient.get(`volumes/${volumeId}/scan/status`);
      return response.data;
    },
    [httpClient],
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
  const httpClient = useHttpClient();
  const [health, setHealth] = useAtom(apiHealthAtom);
  const [loading, setLoading] = useAtom(apiHealthLoadingAtom);
  const [error, setError] = useAtom(apiHealthErrorAtom);
  const connected = useAtomValue(apiConnectedAtom);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response: ApiResponse<HealthCheckResponse> = await httpClient.get(
        'database/health',
        { skipErrorHandling: true },
      );

      setHealth({
        status: response.data.status,
        timestamp: response.data.timestamp || Date.now(),
        checks: response.data.checks || {},
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Health check failed';
      setError(errorMessage);
      setHealth({
        status: 'unhealthy',
        timestamp: Date.now(),
        checks: {},
      });
    } finally {
      setLoading(false);
    }
  }, [httpClient, setHealth, setLoading, setError]);

  const checkDatabaseHealth = useCallback(async () => {
    const response: ApiResponse<any> = await httpClient.get('database/health', {
      skipErrorHandling: true,
    });
    return response.data;
  }, [httpClient]);

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
  const httpClient = useHttpClient();
  const { refreshVolumes } = useVolumes();

  const bulkScan = useCallback(
    async (volumeIds: string[], options?: RefreshRequest) => {
      const response: ApiResponse<{
        scans: Record<string, AsyncScanResponse>;
      }> = await httpClient.post('volumes/bulk-scan', {
        volume_ids: volumeIds,
        ...options,
      });

      // Refresh volumes list after bulk operation
      await refreshVolumes();

      return response.data;
    },
    [httpClient, refreshVolumes],
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
  const httpClient = useHttpClient();
  const [containers, setContainers] = useAtom(containersAtom);
  const [loading, setLoading] = useAtom(containersLoadingAtom);
  const [error, setError] = useAtom(containersErrorAtom);
  const volumes = useAtomValue(volumesAtom);

  const fetchContainersForVolumes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch containers for each volume
      const allContainers = new Map(); // Use Map to deduplicate by container ID

      // Fetch containers for each volume in parallel
      const containerPromises = volumes.map(async (volume) => {
        if (!volume.id) return [];
        
        try {
          const response: ApiResponse<{
            containers: Array<{
              id: string;
              name: string;
              state: string;
              status: string;
              mount_path: string;
              mount_type: string;
              access_mode: string;
            }>;
          }> = await httpClient.get(`volumes/${volume.id}/containers`);
          
          return response.data.containers || [];
        } catch (err) {
          // Silently ignore individual volume errors
          console.warn(`Failed to fetch containers for volume ${volume.id}:`, err);
          return [];
        }
      });

      const containerArrays = await Promise.all(containerPromises);
      
      // Aggregate and deduplicate containers
      containerArrays.forEach((containerList) => {
        containerList.forEach((container) => {
          if (!allContainers.has(container.id)) {
            allContainers.set(container.id, {
              id: container.id,
              name: container.name.replace(/^\//, ''), // Remove leading slash
              status: container.state || 'unknown',
              state: container.state,
              image: '', // Not provided by volume containers endpoint
              created: '', // Not provided by volume containers endpoint
            });
          }
        });
      });

      const uniqueContainers = Array.from(allContainers.values());
      setContainers(uniqueContainers);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch containers';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [httpClient, volumes, setContainers, setLoading, setError]);

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

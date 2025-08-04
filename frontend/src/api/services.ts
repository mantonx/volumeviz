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
 * Hook for managing volume data
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

        const queryString = queryParams.toString();
        const endpoint = `volumes${queryString ? `?${queryString}` : ''}`;

        const response: ApiResponse<{ volumes: VolumeResponse[] }> =
          await httpClient.get(endpoint);

        setVolumes(response.data.volumes || []);
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
 * Hook for managing volume scanning
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
    const response: ApiResponse<any> = await httpClient.get(
      'database/health',
      { skipErrorHandling: true },
    );
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

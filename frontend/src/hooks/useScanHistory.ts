import { useState, useEffect, useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import type { 
  ScanHistoryEntry, 
  ScanHistoryFilter, 
  ScanHistoryResponse,
  ScanHistoryStats 
} from '../types/scanHistory';
import type { ScanOperation } from '../components/domain/ScanManagerDashboard';

// Atoms for scan history state
const scanHistoryAtom = atom<ScanHistoryEntry[]>([]);
const scanHistoryStatsAtom = atom<ScanHistoryStats | null>(null);
const scanHistoryLoadingAtom = atom<boolean>(false);

export interface UseScanHistoryOptions {
  /** Auto-fetch history on mount */
  autoFetch?: boolean;
  /** Page size for pagination */
  pageSize?: number;
  /** Auto-refresh interval (ms) */
  refreshInterval?: number;
}

export interface UseScanHistoryReturn {
  /** Scan history entries */
  history: ScanHistoryEntry[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** History statistics */
  stats: ScanHistoryStats | null;
  /** Current filter */
  filter: ScanHistoryFilter;
  /** Fetch scan history */
  fetchHistory: (filter?: ScanHistoryFilter, page?: number) => Promise<void>;
  /** Add completed scan to history */
  addScanToHistory: (scan: ScanOperation, result: 'completed' | 'failed' | 'cancelled') => Promise<void>;
  /** Clear history */
  clearHistory: () => Promise<void>;
  /** Export history */
  exportHistory: (format: 'csv' | 'json') => Promise<void>;
  /** Update filter */
  setFilter: (filter: ScanHistoryFilter) => void;
  /** Get scan details */
  getScanDetails: (scanId: string) => Promise<ScanHistoryEntry | null>;
  /** Delete scan from history */
  deleteScan: (scanId: string) => Promise<void>;
}

export const useScanHistory = (options: UseScanHistoryOptions = {}): UseScanHistoryReturn => {
  const {
    autoFetch = true,
    pageSize = 50,
    refreshInterval
  } = options;

  const [history, setHistory] = useAtom(scanHistoryAtom);
  const [stats, setStats] = useAtom(scanHistoryStatsAtom);
  const [loading, setLoading] = useAtom(scanHistoryLoadingAtom);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScanHistoryFilter>({});

  const fetchHistory = useCallback(async (
    newFilter: ScanHistoryFilter = {},
    page: number = 1
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        ...Object.entries(newFilter).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            if (value instanceof Date) {
              acc[key] = value.toISOString();
            } else {
              acc[key] = value.toString();
            }
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/v1/scans/history?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch scan history: ${response.statusText}`);
      }

      const data: ScanHistoryResponse = await response.json();
      
      if (page === 1) {
        setHistory(data.entries);
      } else {
        setHistory(prev => [...prev, ...data.entries]);
      }
      
      setStats(data.stats);
      setFilter(newFilter);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useScanHistory] Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [pageSize, setHistory, setStats, setLoading]);

  const addScanToHistory = useCallback(async (
    scan: ScanOperation, 
    result: 'completed' | 'failed' | 'cancelled'
  ) => {
    try {
      const historyEntry: Omit<ScanHistoryEntry, 'id'> = {
        scanId: scan.scanId,
        volumeId: scan.volumeId,
        volumeName: scan.volumeName,
        status: result,
        startedAt: scan.startedAt || new Date().toISOString(),
        completedAt: scan.completedAt || new Date().toISOString(),
        duration: scan.completedAt && scan.startedAt 
          ? new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()
          : 0,
        totalFiles: 0, // Would be provided by backend
        totalFolders: 0,
        totalBytes: 0,
        filesScanned: scan.filesScanned || 0,
        foldersScanned: scan.foldersScanned || 0,
        bytesScanned: 0,
        averageFilesPerSecond: scan.filesPerSecond || 0,
        averageBytesPerSecond: scan.bytesPerSecond || 0,
        peakFilesPerSecond: scan.filesPerSecond || 0,
        peakBytesPerSecond: scan.bytesPerSecond || 0,
        phases: [], // Would be populated during scan
        errorCount: scan.errorsCount || 0,
        scanMethod: 'manual',
        scanVersion: '1.0.0',
        newFilesFound: 0,
        modifiedFilesFound: 0,
        deletedFilesFound: 0,
      };

      const response = await fetch('/api/v1/scans/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historyEntry),
      });

      if (!response.ok) {
        throw new Error(`Failed to add scan to history: ${response.statusText}`);
      }

      // Refresh history to include the new entry
      await fetchHistory(filter);
    } catch (err) {
      console.error('[useScanHistory] Failed to add scan to history:', err);
      throw err;
    }
  }, [fetchHistory, filter]);

  const clearHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/scans/history', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to clear history: ${response.statusText}`);
      }

      setHistory([]);
      setStats(null);
    } catch (err) {
      console.error('[useScanHistory] Failed to clear history:', err);
      throw err;
    }
  }, [setHistory, setStats]);

  const exportHistory = useCallback(async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({
        format,
        ...Object.entries(filter).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            if (value instanceof Date) {
              acc[key] = value.toISOString();
            } else {
              acc[key] = value.toString();
            }
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/v1/scans/history/export?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to export history: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scan-history-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[useScanHistory] Failed to export history:', err);
      throw err;
    }
  }, [filter]);

  const getScanDetails = useCallback(async (scanId: string): Promise<ScanHistoryEntry | null> => {
    try {
      const response = await fetch(`/api/v1/scans/history/${scanId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get scan details: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('[useScanHistory] Failed to get scan details:', err);
      throw err;
    }
  }, []);

  const deleteScan = useCallback(async (scanId: string) => {
    try {
      const response = await fetch(`/api/v1/scans/history/${scanId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete scan: ${response.statusText}`);
      }

      // Remove from local state
      setHistory(prev => prev.filter(entry => entry.scanId !== scanId));
    } catch (err) {
      console.error('[useScanHistory] Failed to delete scan:', err);
      throw err;
    }
  }, [setHistory]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchHistory();
    }
  }, [autoFetch, fetchHistory]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchHistory(filter);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchHistory, filter]);

  return {
    history,
    loading,
    error,
    stats,
    filter,
    fetchHistory,
    addScanToHistory,
    clearHistory,
    exportHistory,
    setFilter,
    getScanDetails,
    deleteScan,
  };
};
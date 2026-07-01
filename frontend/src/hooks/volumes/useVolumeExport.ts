import { useCallback, useState } from 'react';

export interface VolumeExportFilters {
  searchTerm?: string;
  status?: string;
  sortBy?: string;
}

export interface UseVolumeExportReturn {
  /** Export volumes to CSV format */
  exportCSV: () => Promise<void>;
  /** Export volumes to JSON format */
  exportJSON: () => Promise<void>;
  /** Generic export function that takes format parameter */
  exportVolumes: (format: 'csv' | 'json') => Promise<void>;
  /** Loading state for export operation */
  isExporting: boolean;
  /** Error from last export attempt */
  error: Error | null;
}

/**
 * Hook for exporting volume data to CSV or JSON formats.
 *
 * Handles:
 * - Authentication token retrieval
 * - Query parameter construction from filters
 * - File download with proper naming
 * - Error handling and loading states
 * - Cache busting for fresh exports
 *
 * @param filters - Optional filters to apply to export (search, status, sort)
 * @returns Object with export functions and state
 *
 * @example
 * ```tsx
 * const { exportCSV, exportJSON, isExporting, error } = useVolumeExport(filters);
 *
 * <Button onClick={exportCSV} disabled={isExporting}>
 *   Export CSV
 * </Button>
 * ```
 */
export const useVolumeExport = (
  filters?: VolumeExportFilters,
): UseVolumeExportReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportVolumes = useCallback(
    async (format: 'csv' | 'json') => {
      setIsExporting(true);
      setError(null);

      try {
        // Get auth token from localStorage
        const token = localStorage.getItem('auth_token');

        if (!token) {
          throw new Error('No authentication token found. Please log in again.');
        }

        // Build query parameters from filters
        const params = new URLSearchParams();

        if (filters?.searchTerm) {
          params.append('search', filters.searchTerm);
        }
        if (filters?.status && filters.status !== 'all') {
          params.append('status', filters.status);
        }
        if (filters?.sortBy) {
          params.append('sort_by', filters.sortBy);
        }

        // Add timestamp to bust cache
        params.append('_t', Date.now().toString());

        // Construct API URL
        const baseUrl =
          import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        const url = `${baseUrl}/volumes/export/${format}?${params.toString()}`;

        // Fetch export data
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: 'no-store', // Disable caching for exports
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Export failed (${response.status}): ${errorText || 'Unknown error'}`,
          );
        }

        // Download file
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `volumes-${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);

        console.log(`Successfully exported volumes as ${format.toUpperCase()}`);
      } catch (err) {
        const exportError =
          err instanceof Error ? err : new Error('Export failed');
        setError(exportError);
        console.error('Export failed:', exportError);
        throw exportError; // Re-throw so caller can handle if needed
      } finally {
        setIsExporting(false);
      }
    },
    [filters],
  );

  const exportCSV = useCallback(() => exportVolumes('csv'), [exportVolumes]);
  const exportJSON = useCallback(() => exportVolumes('json'), [exportVolumes]);

  return {
    exportCSV,
    exportJSON,
    exportVolumes,
    isExporting,
    error,
  };
};

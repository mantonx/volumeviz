import { useCallback, useState } from 'react';
import { ExportOptions } from '@/components/domain/explorer/ExportDialog';
import { exportService, ExportContext } from '@/utils/export/exportService';

export interface UseExportOptions {
  onSuccess?: (format: string) => void;
  onError?: (error: string) => void;
}

export interface UseExportReturn {
  isExporting: boolean;
  exportError: string | null;
  exportVisualization: (
    options: ExportOptions,
    context: ExportContext,
  ) => Promise<void>;
  clearError: () => void;
}

export function useExport(options: UseExportOptions = {}): UseExportReturn {
  const { onSuccess, onError } = options;

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportVisualization = useCallback(
    async (exportOptions: ExportOptions, context: ExportContext) => {
      setIsExporting(true);
      setExportError(null);

      try {
        await exportService.exportVisualization(exportOptions, context);

        if (onSuccess) {
          onSuccess(exportOptions.format);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Export failed';
        setExportError(errorMessage);

        if (onError) {
          onError(errorMessage);
        }
      } finally {
        setIsExporting(false);
      }
    },
    [onSuccess, onError],
  );

  const clearError = useCallback(() => {
    setExportError(null);
  }, []);

  return {
    isExporting,
    exportError,
    exportVisualization,
    clearError,
  };
}

// Specialized hooks for different visualization types

export function useTreemapExport(options: UseExportOptions = {}) {
  const exportHook = useExport(options);

  const exportTreemap = useCallback(
    async (
      exportOptions: ExportOptions,
      treemapElement: HTMLElement | SVGElement,
      data?: any,
    ) => {
      const context: ExportContext = {
        element: treemapElement,
        data,
        metadata: {
          visualizationType: 'treemap',
          generatedAt: new Date().toISOString(),
          nodeCount: Array.isArray(data) ? data.length : 0,
        },
      };

      return exportHook.exportVisualization(exportOptions, context);
    },
    [exportHook],
  );

  return {
    ...exportHook,
    exportTreemap,
  };
}

export function useSunburstExport(options: UseExportOptions = {}) {
  const exportHook = useExport(options);

  const exportSunburst = useCallback(
    async (
      exportOptions: ExportOptions,
      sunburstElement: HTMLElement | SVGElement,
      data?: any,
    ) => {
      const context: ExportContext = {
        element: sunburstElement,
        data,
        metadata: {
          visualizationType: 'sunburst',
          generatedAt: new Date().toISOString(),
          levels: data?.maxDepth || 0,
        },
      };

      return exportHook.exportVisualization(exportOptions, context);
    },
    [exportHook],
  );

  return {
    ...exportHook,
    exportSunburst,
  };
}

export function useDataExport(options: UseExportOptions = {}) {
  const exportHook = useExport(options);

  const exportData = useCallback(
    async (
      exportOptions: ExportOptions,
      data: any,
      metadata?: Record<string, any>,
    ) => {
      // Create a dummy element for data-only exports
      const dummyElement = document.createElement('div');

      const context: ExportContext = {
        element: dummyElement,
        data,
        metadata: {
          exportType: 'data',
          recordCount: Array.isArray(data) ? data.length : 1,
          ...metadata,
        },
      };

      return exportHook.exportVisualization(exportOptions, context);
    },
    [exportHook],
  );

  return {
    ...exportHook,
    exportData,
  };
}

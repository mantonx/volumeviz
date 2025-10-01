import React, { useRef, useCallback } from 'react';
import { Download } from 'lucide-react';
import { ExportDialog, ExportOptions } from '../ExportDialog';
import { UndoRollback } from '../UndoRollback';
import { useExplorerNavigation } from '@/hooks/useExplorerNavigation';
import {
  useTreemapExport,
  useSunburstExport,
  useDataExport,
} from '@/hooks/useExport';
import { cn } from '@/utils/class-names/cn';

export interface ExplorerWithExportProps {
  className?: string;
  children: React.ReactNode;
  currentView?: 'list' | 'grid' | 'treemap' | 'sunburst';
  data?: any;
  metadata?: Record<string, any>;
}

export const ExplorerWithExport: React.FC<ExplorerWithExportProps> = ({
  className,
  children,
  currentView = 'list',
  data,
  metadata,
}) => {
  const {
    volumeId,
    exportDialogVisible,
    undoRollbackVisible,
    toggleExportDialog,
    toggleUndoRollback,
  } = useExplorerNavigation();

  const contentRef = useRef<HTMLDivElement>(null);

  // Export hooks for different visualization types
  const treemapExport = useTreemapExport({
    onSuccess: (format) => console.log(`Treemap exported as ${format}`),
    onError: (error) => console.error('Export failed:', error),
  });

  const sunburstExport = useSunburstExport({
    onSuccess: (format) => console.log(`Sunburst exported as ${format}`),
    onError: (error) => console.error('Export failed:', error),
  });

  const dataExport = useDataExport({
    onSuccess: (format) => console.log(`Data exported as ${format}`),
    onError: (error) => console.error('Export failed:', error),
  });

  const handleExport = useCallback(
    async (options: ExportOptions) => {
      if (!contentRef.current || !volumeId) {
        throw new Error('Unable to export: missing content or volume');
      }

      const exportMetadata = {
        volumeId,
        view: currentView,
        exportedAt: new Date().toISOString(),
        ...metadata,
      };

      // Choose appropriate export method based on current view
      switch (currentView) {
        case 'treemap':
          // Find treemap SVG element
          const treemapSvg = contentRef.current.querySelector('svg');
          if (treemapSvg) {
            await treemapExport.exportTreemap(options, treemapSvg, data);
          } else {
            // Fallback to element export
            await treemapExport.exportVisualization(options, {
              element: contentRef.current,
              data,
              metadata: exportMetadata,
            });
          }
          break;

        case 'sunburst':
          // Find sunburst SVG element
          const sunburstSvg = contentRef.current.querySelector('svg');
          if (sunburstSvg) {
            await sunburstExport.exportSunburst(options, sunburstSvg, data);
          } else {
            // Fallback to element export
            await sunburstExport.exportVisualization(options, {
              element: contentRef.current,
              data,
              metadata: exportMetadata,
            });
          }
          break;

        case 'list':
        case 'grid':
          // For data formats, export the underlying data
          if (['csv', 'json'].includes(options.format)) {
            await dataExport.exportData(options, data, exportMetadata);
          } else {
            // For image formats, export the visual content
            await dataExport.exportVisualization(options, {
              element: contentRef.current,
              data,
              metadata: exportMetadata,
            });
          }
          break;

        default:
          // Generic export using the main content element
          await dataExport.exportVisualization(options, {
            element: contentRef.current,
            data,
            metadata: exportMetadata,
          });
      }
    },
    [
      volumeId,
      currentView,
      data,
      metadata,
      treemapExport,
      sunburstExport,
      dataExport,
    ],
  );

  const handleRollback = useCallback((operationId: string, response: any) => {
    console.log('Operation rolled back:', { operationId, response });
    // Handle successful rollback - could refresh data, show notification, etc.
  }, []);

  const getSupportedFormats = useCallback(() => {
    const baseFormats: ('png' | 'pdf' | 'svg' | 'csv' | 'json')[] = [
      'png',
      'pdf',
      'csv',
      'json',
    ];

    // SVG is better supported for vector-based visualizations
    if (['treemap', 'sunburst'].includes(currentView)) {
      return ['svg', ...baseFormats];
    }

    return baseFormats;
  }, [currentView]);

  const getExportTitle = useCallback(() => {
    switch (currentView) {
      case 'treemap':
        return 'Export Treemap Visualization';
      case 'sunburst':
        return 'Export Sunburst Chart';
      case 'list':
        return 'Export File List';
      case 'grid':
        return 'Export File Grid';
      default:
        return 'Export Explorer View';
    }
  }, [currentView]);

  return (
    <div className={cn('relative', className)}>
      {/* Main Content */}
      <div ref={contentRef} className="explorer-content">
        {children}
      </div>

      {/* Export Button */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex gap-2">
          <button
            onClick={toggleExportDialog}
            className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            title="Export current view"
          >
            <Download className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isVisible={exportDialogVisible}
        onClose={toggleExportDialog}
        onExport={handleExport}
        supportedFormats={getSupportedFormats()}
        title={getExportTitle()}
        description={`Export your ${currentView} view in various formats`}
      />

      {/* Undo/Rollback Dialog */}
      {volumeId && (
        <UndoRollback
          isVisible={undoRollbackVisible}
          onClose={toggleUndoRollback}
          volumeId={volumeId}
          onOperationRollback={handleRollback}
        />
      )}
    </div>
  );
};

// Example usage with different visualizations
export const TreemapExplorerExample: React.FC = () => {
  const mockTreemapData = [
    { id: '1', name: 'Documents', value: 1024000, path: '/docs' },
    { id: '2', name: 'Images', value: 2048000, path: '/images' },
    { id: '3', name: 'Videos', value: 4096000, path: '/videos' },
  ];

  return (
    <ExplorerWithExport
      currentView="treemap"
      data={mockTreemapData}
      metadata={{ totalFiles: 150, totalSize: '7.2 GB' }}
    >
      <div className="h-96 bg-gray-100 flex items-center justify-center">
        <svg width="400" height="300" className="border">
          <rect
            x="0"
            y="0"
            width="200"
            height="150"
            fill="#3b82f6"
            opacity="0.7"
          />
          <rect
            x="200"
            y="0"
            width="200"
            height="100"
            fill="#ef4444"
            opacity="0.7"
          />
          <rect
            x="200"
            y="100"
            width="200"
            height="50"
            fill="#10b981"
            opacity="0.7"
          />
          <text x="100" y="75" textAnchor="middle" fill="white" fontSize="14">
            Documents
          </text>
          <text x="300" y="50" textAnchor="middle" fill="white" fontSize="12">
            Images
          </text>
          <text x="300" y="125" textAnchor="middle" fill="white" fontSize="10">
            Videos
          </text>
        </svg>
      </div>
    </ExplorerWithExport>
  );
};

export const SunburstExplorerExample: React.FC = () => {
  const mockSunburstData = {
    name: 'root',
    children: [
      { name: 'Documents', value: 1000 },
      { name: 'Media', value: 2000 },
      { name: 'Code', value: 500 },
    ],
  };

  return (
    <ExplorerWithExport
      currentView="sunburst"
      data={mockSunburstData}
      metadata={{ depth: 3, categories: 12 }}
    >
      <div className="h-96 bg-gray-100 flex items-center justify-center">
        <svg width="300" height="300" className="border-radius-full">
          <circle cx="150" cy="150" r="100" fill="#3b82f6" opacity="0.7" />
          <circle cx="150" cy="150" r="70" fill="#ef4444" opacity="0.7" />
          <circle cx="150" cy="150" r="40" fill="#10b981" opacity="0.7" />
        </svg>
      </div>
    </ExplorerWithExport>
  );
};

export const DataExplorerExample: React.FC = () => {
  const mockTableData = [
    { name: 'document1.pdf', size: 1024000, modified: '2024-01-15' },
    { name: 'image.jpg', size: 2048000, modified: '2024-01-14' },
    { name: 'video.mp4', size: 4096000, modified: '2024-01-13' },
  ];

  return (
    <ExplorerWithExport
      currentView="list"
      data={mockTableData}
      metadata={{ sortBy: 'name', sortOrder: 'asc' }}
    >
      <div className="h-96 bg-white border rounded-lg p-4">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Size</th>
              <th className="text-left p-2">Modified</th>
            </tr>
          </thead>
          <tbody>
            {mockTableData.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="p-2">{item.name}</td>
                <td className="p-2">
                  {(item.size / 1024 / 1024).toFixed(1)} MB
                </td>
                <td className="p-2">{item.modified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExplorerWithExport>
  );
};

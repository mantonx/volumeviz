import React, { useState, useCallback } from 'react';
import {
  Download,
  FileImage,
  FileText,
  Image,
  Check,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/utils/class-names/cn';

export interface ExportOptions {
  format: 'png' | 'pdf' | 'svg' | 'csv' | 'json';
  quality?: 'low' | 'medium' | 'high';
  size?: 'small' | 'medium' | 'large' | 'custom';
  width?: number;
  height?: number;
  includeData?: boolean;
  includeMetadata?: boolean;
  backgroundColor?: string;
  transparent?: boolean;
}

export interface ExportDialogProps {
  className?: string;
  isVisible: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  supportedFormats?: ('png' | 'pdf' | 'svg' | 'csv' | 'json')[];
  title?: string;
  description?: string;
}

const formatInfo = {
  png: {
    name: 'PNG Image',
    description: 'High-quality raster image',
    icon: FileImage,
    supportsQuality: true,
    supportsSize: true,
    supportsTransparency: true,
  },
  pdf: {
    name: 'PDF Document',
    description: 'Vector-based document',
    icon: FileText,
    supportsQuality: false,
    supportsSize: true,
    supportsTransparency: false,
  },
  svg: {
    name: 'SVG Vector',
    description: 'Scalable vector graphics',
    icon: Image,
    supportsQuality: false,
    supportsSize: false,
    supportsTransparency: true,
  },
  csv: {
    name: 'CSV Data',
    description: 'Comma-separated values',
    icon: FileText,
    supportsQuality: false,
    supportsSize: false,
    supportsTransparency: false,
  },
  json: {
    name: 'JSON Data',
    description: 'Structured data format',
    icon: FileText,
    supportsQuality: false,
    supportsSize: false,
    supportsTransparency: false,
  },
};

const sizePresets = {
  small: { width: 800, height: 600, label: 'Small (800×600)' },
  medium: { width: 1200, height: 900, label: 'Medium (1200×900)' },
  large: { width: 1920, height: 1080, label: 'Large (1920×1080)' },
  custom: { width: 1200, height: 900, label: 'Custom' },
};

export const ExportDialog: React.FC<ExportDialogProps> = ({
  className,
  isVisible,
  onClose,
  onExport,
  supportedFormats = ['png', 'pdf', 'svg', 'csv', 'json'],
  title = 'Export Visualization',
  description = 'Export your data visualization in various formats',
}) => {
  const [selectedFormat, setSelectedFormat] =
    useState<ExportOptions['format']>('png');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [size, setSize] = useState<'small' | 'medium' | 'large' | 'custom'>(
    'medium',
  );
  const [customWidth, setCustomWidth] = useState(1200);
  const [customHeight, setCustomHeight] = useState(900);
  const [includeData, setIncludeData] = useState(false);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [transparent, setTransparent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const currentFormatInfo = formatInfo[selectedFormat];
  const currentSizePreset = sizePresets[size];

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const exportOptions: ExportOptions = {
        format: selectedFormat,
        quality: currentFormatInfo.supportsQuality ? quality : undefined,
        size: currentFormatInfo.supportsSize ? size : undefined,
        width: size === 'custom' ? customWidth : currentSizePreset?.width,
        height: size === 'custom' ? customHeight : currentSizePreset?.height,
        includeData,
        includeMetadata,
        backgroundColor: transparent ? 'transparent' : backgroundColor,
        transparent,
      };

      await onExport(exportOptions);
      setExportSuccess(true);

      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1500);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [
    selectedFormat,
    quality,
    size,
    customWidth,
    customHeight,
    includeData,
    includeMetadata,
    backgroundColor,
    transparent,
    onExport,
    onClose,
    currentFormatInfo,
    currentSizePreset,
  ]);

  const isImageFormat = ['png', 'pdf', 'svg'].includes(selectedFormat);
  const isDataFormat = ['csv', 'json'].includes(selectedFormat);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className={cn(
          'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden',
          className,
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {supportedFormats.map((format) => {
                const info = formatInfo[format];
                const Icon = info.icon;
                return (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-colors',
                      selectedFormat === format
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {info.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {info.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image Format Options */}
          {isImageFormat && (
            <>
              {/* Quality Settings */}
              {currentFormatInfo.supportsQuality && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Quality
                  </label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          quality === q
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                        )}
                      >
                        {q.charAt(0).toUpperCase() + q.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Settings */}
              {currentFormatInfo.supportsSize && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Size
                  </label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {Object.entries(sizePresets).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() =>
                            setSize(
                              key as 'small' | 'medium' | 'large' | 'custom',
                            )
                          }
                          className={cn(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            size === key
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {size === 'custom' && (
                      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">
                            Width:
                          </label>
                          <input
                            type="number"
                            value={customWidth}
                            onChange={(e) =>
                              setCustomWidth(
                                parseInt(e.target.value, 10) || 1200,
                              )
                            }
                            className="w-20 px-2 py-1 text-sm border rounded"
                            min="100"
                            max="4000"
                          />
                          <span className="text-xs text-gray-500">px</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">
                            Height:
                          </label>
                          <input
                            type="number"
                            value={customHeight}
                            onChange={(e) =>
                              setCustomHeight(
                                parseInt(e.target.value, 10) || 900,
                              )
                            }
                            className="w-20 px-2 py-1 text-sm border rounded"
                            min="100"
                            max="4000"
                          />
                          <span className="text-xs text-gray-500">px</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Background Settings */}
              {currentFormatInfo.supportsTransparency && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Background
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={transparent}
                          onChange={(e) => setTransparent(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          Transparent background
                        </span>
                      </label>
                    </div>

                    {!transparent && (
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600">Color:</label>
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-300"
                        />
                        <span className="text-sm text-gray-500">
                          {backgroundColor}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Data Export Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Content Options
            </label>
            <div className="space-y-2">
              {isDataFormat && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeData}
                    onChange={(e) => setIncludeData(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    Include raw data
                  </span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Include metadata (timestamps, settings)
                </span>
              </label>
            </div>
          </div>

          {/* Error Display */}
          {exportError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-red-900">Export Failed</div>
                <div className="text-sm text-red-700">{exportError}</div>
              </div>
            </div>
          )}

          {/* Success Display */}
          {exportSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <div className="font-medium text-green-900">
                  Export Successful
                </div>
                <div className="text-sm text-green-700">
                  Your file has been downloaded
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            File will be saved as:{' '}
            <span className="font-mono">export.{selectedFormat}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={cn(
                'px-6 py-2 rounded-lg font-medium transition-colors',
                isExporting
                  ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 inline mr-2" />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

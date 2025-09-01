/**
 * SearchFilters Component
 *
 * Advanced filtering interface for file search
 */

import React, { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { advancedFiltersAtom } from '@/atoms/search';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useFilterMetadata } from '@/hooks/useFilterMetadata';

const SIZE_PRESETS = [
  { label: 'Any Size', min: undefined, max: undefined },
  { label: 'Small (< 10 MB)', min: undefined, max: 10 * 1024 * 1024 },
  {
    label: 'Medium (10-100 MB)',
    min: 10 * 1024 * 1024,
    max: 100 * 1024 * 1024,
  },
  {
    label: 'Large (100 MB - 1 GB)',
    min: 100 * 1024 * 1024,
    max: 1024 * 1024 * 1024,
  },
  { label: 'Very Large (> 1 GB)', min: 1024 * 1024 * 1024, max: undefined },
];

interface SearchFiltersProps {
  onFilterChange: (filters: Record<string, any>) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  onFilterChange,
}) => {
  const [filters, setFilters] = useAtom(advancedFiltersAtom);
  const {
    mimeTypes: dynamicMimeTypes,
    mediaKinds: dynamicMediaKinds,
    isLoading: metadataLoading,
    error: metadataError,
  } = useFilterMetadata();

  // Helper to update filters and notify URL
  const updateFilters = useCallback(
    (updates: any) => {
      setFilters((prev) => {
        const newFilters = { ...prev, ...updates };

        // Convert to URL format and notify parent
        const urlUpdates: Record<string, any> = {};
        if (newFilters.mediaKind) urlUpdates.mediaKind = newFilters.mediaKind;
        if (newFilters.mimeTypes?.length)
          urlUpdates.mime = newFilters.mimeTypes;
        if (newFilters.sizeRange?.min)
          urlUpdates.minSize = newFilters.sizeRange.min;
        if (newFilters.sizeRange?.max)
          urlUpdates.maxSize = newFilters.sizeRange.max;
        if (newFilters.timeRange?.from)
          urlUpdates.mtimeFrom = newFilters.timeRange.from;
        if (newFilters.timeRange?.to)
          urlUpdates.mtimeTo = newFilters.timeRange.to;
        if (newFilters.booleanFilters?.hasGps !== undefined)
          urlUpdates.hasGps = newFilters.booleanFilters.hasGps;
        if (newFilters.booleanFilters?.hasSubs !== undefined)
          urlUpdates.hasSubs = newFilters.booleanFilters.hasSubs;

        onFilterChange(urlUpdates);
        return newFilters;
      });
    },
    [setFilters, onFilterChange],
  );

  // Categorize MIME types by media category
  const categorizedMimeTypes = useMemo(() => {
    const categories: Record<
      string,
      Array<{ value: string; label: string; fileCount: number }>
    > = {
      video: [],
      audio: [],
      image: [],
      document: [],
      archive: [],
      other: [],
    };

    dynamicMimeTypes.forEach((mimeType) => {
      const type = mimeType.value.split('/')[0];
      switch (type) {
        case 'video':
          categories.video.push(mimeType);
          break;
        case 'audio':
          categories.audio.push(mimeType);
          break;
        case 'image':
          categories.image.push(mimeType);
          break;
        case 'application':
          // Categorize common application types
          if (
            mimeType.value.includes('pdf') ||
            mimeType.value.includes('document') ||
            mimeType.value.includes('word') ||
            mimeType.value.includes('excel') ||
            mimeType.value.includes('powerpoint') ||
            mimeType.value.includes('text')
          ) {
            categories.document.push(mimeType);
          } else if (
            mimeType.value.includes('zip') ||
            mimeType.value.includes('rar') ||
            mimeType.value.includes('tar') ||
            mimeType.value.includes('7z') ||
            mimeType.value.includes('compressed')
          ) {
            categories.archive.push(mimeType);
          } else {
            categories.other.push(mimeType);
          }
          break;
        case 'text':
          categories.document.push(mimeType);
          break;
        default:
          categories.other.push(mimeType);
      }
    });

    // Sort each category by file count (descending)
    Object.keys(categories).forEach((key) => {
      categories[key].sort((a, b) => b.fileCount - a.fileCount);
    });

    return categories;
  }, [dynamicMimeTypes]);

  // Update media kind filter
  const updateMediaKind = useCallback(
    (mediaKind: string) => {
      updateFilters({
        mediaKind: mediaKind || undefined,
      });
    },
    [updateFilters],
  );

  // Update MIME types filter
  const updateMimeTypes = useCallback(
    (mimeType: string, checked: boolean) => {
      updateFilters({
        mimeTypes: checked
          ? [...filters.mimeTypes, mimeType]
          : filters.mimeTypes.filter((type) => type !== mimeType),
      });
    },
    [updateFilters, filters.mimeTypes],
  );

  // Update size range filter
  const updateSizeRange = useCallback(
    (range: { min?: number; max?: number }) => {
      setFilters((prev) => ({
        ...prev,
        sizeRange: range,
      }));
    },
    [setFilters],
  );

  // Update custom size values
  const updateCustomSize = useCallback(
    (type: 'min' | 'max', value: string) => {
      const numValue = value ? parseInt(value) * 1024 * 1024 : undefined; // Convert MB to bytes
      setFilters((prev) => ({
        ...prev,
        sizeRange: {
          ...(prev.sizeRange || {}), // Ensure sizeRange exists
          [type]: numValue,
        },
      }));
    },
    [setFilters],
  );

  // Update time range filter
  const updateTimeRange = useCallback(
    (type: 'from' | 'to', value: string) => {
      setFilters((prev) => ({
        ...prev,
        timeRange: {
          ...(prev.timeRange || {}), // Ensure timeRange exists
          [type]: value || undefined,
        },
      }));
    },
    [setFilters],
  );

  // Update duration range filter
  const updateDurationRange = useCallback(
    (type: 'min' | 'max', value: string) => {
      const numValue = value ? parseInt(value) * 1000 : undefined; // Convert seconds to ms
      setFilters((prev) => ({
        ...prev,
        durationRange: {
          ...(prev.durationRange || {}), // Ensure durationRange exists
          [type]: numValue,
        },
      }));
    },
    [setFilters],
  );

  // Update dimensions filter
  const updateDimensions = useCallback(
    (dimension: 'width' | 'height', type: 'min' | 'max', value: string) => {
      const numValue = value ? parseInt(value) : undefined;
      setFilters((prev) => ({
        ...prev,
        dimensionsRange: {
          ...(prev.dimensionsRange || { width: {}, height: {} }), // Ensure dimensionsRange exists
          [dimension]: {
            ...(prev.dimensionsRange?.[dimension] || {}), // Ensure dimension exists
            [type]: numValue,
          },
        },
      }));
    },
    [setFilters],
  );

  // Update boolean filters
  const updateBooleanFilter = useCallback(
    (key: 'hasGps' | 'hasSubs' | 'hashPresent', value: boolean | undefined) => {
      setFilters((prev) => ({
        ...prev,
        booleanFilters: {
          ...(prev.booleanFilters || {}), // Ensure booleanFilters exists
          [key]: value,
        },
      }));
    },
    [setFilters],
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters({
      mimeTypes: [],
      sizeRange: {},
      timeRange: {},
      durationRange: {},
      dimensionsRange: { width: {}, height: {} },
      booleanFilters: {},
    });
  }, [setFilters]);

  // Remove specific filter
  const removeFilter = useCallback(
    (filterType: string, filterKey?: string) => {
      setFilters((prev) => {
        const updated = { ...prev };

        switch (filterType) {
          case 'mediaKind':
            delete updated.mediaKind;
            break;
          case 'mimeType':
            if (filterKey) {
              updated.mimeTypes = updated.mimeTypes.filter(
                (type) => type !== filterKey,
              );
            }
            break;
          case 'sizeRange':
            updated.sizeRange = {};
            break;
          case 'timeRange':
            updated.timeRange = {};
            break;
          case 'durationRange':
            updated.durationRange = {};
            break;
          case 'dimensionsRange':
            updated.dimensionsRange = { width: {}, height: {} };
            break;
          case 'booleanFilter':
            if (filterKey && updated.booleanFilters) {
              delete updated.booleanFilters[
                filterKey as keyof typeof updated.booleanFilters
              ];
            }
            break;
        }

        return updated;
      });
    },
    [setFilters],
  );

  // Format file size for display
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
  };

  // Context-aware field visibility
  const isVideoOrAudio =
    filters.mediaKind === 'video' || filters.mediaKind === 'audio';
  const isImageOrVideo =
    filters.mediaKind === 'image' || filters.mediaKind === 'video';
  const showDurationFilter = isVideoOrAudio;
  const showDimensionsFilter = isImageOrVideo;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Advanced Filters
        </h3>
        <Button onClick={clearAllFilters} variant="outline" size="sm">
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Media Type Filter */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Media Type
          </label>
          <select
            value={filters.mediaKind || ''}
            onChange={(e) => updateMediaKind(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={metadataLoading}
          >
            <option value="">All Media Types</option>
            {dynamicMediaKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label} ({kind.fileCount.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        {/* File Size Filter */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            File Size
          </label>
          <select
            value={(() => {
              // Find matching preset based on current filter values
              const currentPreset = SIZE_PRESETS.find(
                (p) =>
                  p.min === filters.sizeRange?.min &&
                  p.max === filters.sizeRange?.max,
              );
              return currentPreset?.label || '';
            })()}
            onChange={(e) => {
              const preset = SIZE_PRESETS.find(
                (p) => p.label === e.target.value,
              );
              if (preset) {
                updateSizeRange({ min: preset.min, max: preset.max });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {SIZE_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="number"
              placeholder="Min (MB)"
              value={
                filters.sizeRange.min
                  ? Math.round(filters.sizeRange.min / (1024 * 1024))
                  : ''
              }
              onChange={(e) => updateCustomSize('min', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="number"
              placeholder="Max (MB)"
              value={
                filters.sizeRange.max
                  ? Math.round(filters.sizeRange.max / (1024 * 1024))
                  : ''
              }
              onChange={(e) => updateCustomSize('max', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Modified Date
          </label>
          <div className="grid grid-cols-1 gap-2">
            <input
              type="date"
              placeholder="From"
              value={
                filters.timeRange.from
                  ? filters.timeRange.from.split('T')[0]
                  : ''
              }
              onChange={(e) =>
                updateTimeRange(
                  'from',
                  e.target.value ? `${e.target.value}T00:00:00Z` : '',
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <input
              type="date"
              placeholder="To"
              value={
                filters.timeRange.to ? filters.timeRange.to.split('T')[0] : ''
              }
              onChange={(e) =>
                updateTimeRange(
                  'to',
                  e.target.value ? `${e.target.value}T23:59:59Z` : '',
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        {/* Duration Filter (for video/audio) */}
        {showDurationFilter && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Duration (seconds)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min"
                value={
                  filters.durationRange.min
                    ? Math.round(filters.durationRange.min / 1000)
                    : ''
                }
                onChange={(e) => updateDurationRange('min', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <input
                type="number"
                placeholder="Max"
                value={
                  filters.durationRange.max
                    ? Math.round(filters.durationRange.max / 1000)
                    : ''
                }
                onChange={(e) => updateDurationRange('max', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Dimensions Filter (for images/video) */}
        {showDimensionsFilter && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Dimensions (pixels)
            </label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Width"
                  value={filters.dimensionsRange?.width?.min || ''}
                  onChange={(e) =>
                    updateDimensions('width', 'min', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Max Width"
                  value={filters.dimensionsRange?.width?.max || ''}
                  onChange={(e) =>
                    updateDimensions('width', 'max', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Min Height"
                  value={filters.dimensionsRange?.height?.min || ''}
                  onChange={(e) =>
                    updateDimensions('height', 'min', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Max Height"
                  value={filters.dimensionsRange?.height?.max || ''}
                  onChange={(e) =>
                    updateDimensions('height', 'max', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Boolean Filters */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Features
          </label>
          <div className="space-y-2">
            {/* GPS - mainly for images */}
            {(filters.mediaKind === 'image' || !filters.mediaKind) && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.booleanFilters?.hasGps === true}
                  onChange={(e) =>
                    updateBooleanFilter(
                      'hasGps',
                      e.target.checked ? true : undefined,
                    )
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Has GPS coordinates
                </span>
              </label>
            )}

            {/* Subtitles - mainly for videos */}
            {(filters.mediaKind === 'video' || !filters.mediaKind) && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.booleanFilters?.hasSubs === true}
                  onChange={(e) =>
                    updateBooleanFilter(
                      'hasSubs',
                      e.target.checked ? true : undefined,
                    )
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Has subtitles
                </span>
              </label>
            )}

            {/* File hash - relevant for all file types */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.booleanFilters?.hashPresent === true}
                onChange={(e) =>
                  updateBooleanFilter(
                    'hashPresent',
                    e.target.checked ? true : undefined,
                  )
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Has file hash
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* File Types Filter (categorized) */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <details className="space-y-4">
          <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            File Types ({filters.mimeTypes.length} selected)
            {metadataLoading && (
              <span className="ml-2 text-xs text-gray-500">(loading...)</span>
            )}
            {metadataError && (
              <span className="ml-2 text-xs text-red-500">(error loading)</span>
            )}
          </summary>

          {dynamicMimeTypes.length > 0 ? (
            <div className="space-y-4">
              {/* Quick actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const allMimeTypes = dynamicMimeTypes.map((mt) => mt.value);
                    setFilters((prev) => ({
                      ...prev,
                      mimeTypes: allMimeTypes,
                    }));
                  }}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, mimeTypes: [] }))
                  }
                  className="px-3 py-1 text-xs border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-red-50 hover:border-red-300 hover:text-red-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                >
                  Clear All
                </button>
              </div>

              {/* Categorized file types */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(categorizedMimeTypes).map(
                  ([category, mimeTypes]) => {
                    if (mimeTypes.length === 0) return null;

                    const categoryLabels: Record<string, string> = {
                      video: '🎬 Video Files',
                      audio: '🎵 Audio Files',
                      image: '🖼️ Images',
                      document: '📄 Documents',
                      archive: '📦 Archives',
                      other: '📁 Other Files',
                    };

                    const selectedInCategory = mimeTypes.filter((mt) =>
                      filters.mimeTypes.includes(mt.value),
                    ).length;
                    const totalInCategory = mimeTypes.length;

                    return (
                      <div
                        key={category}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                            {categoryLabels[category]}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {selectedInCategory}/{totalInCategory}
                            </span>
                            <button
                              onClick={() => {
                                const categoryMimeTypes = mimeTypes.map(
                                  (mt) => mt.value,
                                );
                                const allSelected = categoryMimeTypes.every(
                                  (mt) => filters.mimeTypes.includes(mt),
                                );

                                if (allSelected) {
                                  // Deselect all in category
                                  setFilters((prev) => ({
                                    ...prev,
                                    mimeTypes: prev.mimeTypes.filter(
                                      (mt) => !categoryMimeTypes.includes(mt),
                                    ),
                                  }));
                                } else {
                                  // Select all in category
                                  setFilters((prev) => ({
                                    ...prev,
                                    mimeTypes: [
                                      ...new Set([
                                        ...prev.mimeTypes,
                                        ...categoryMimeTypes,
                                      ]),
                                    ],
                                  }));
                                }
                              }}
                              className="text-xs px-2 py-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                            >
                              {selectedInCategory === totalInCategory
                                ? 'None'
                                : 'All'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {mimeTypes.slice(0, 10).map((mimeType) => (
                            <label
                              key={mimeType.value}
                              className="flex items-center text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={filters.mimeTypes.includes(
                                  mimeType.value,
                                )}
                                onChange={(e) =>
                                  updateMimeTypes(
                                    mimeType.value,
                                    e.target.checked,
                                  )
                                }
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                              />
                              <span
                                className="flex-1 text-gray-700 dark:text-gray-300"
                                title={mimeType.value}
                              >
                                {mimeType.label}
                              </span>
                              <span className="text-gray-400 ml-1">
                                {mimeType.fileCount.toLocaleString()}
                              </span>
                            </label>
                          ))}
                          {mimeTypes.length > 10 && (
                            <div className="text-xs text-gray-500 italic">
                              ...and {mimeTypes.length - 10} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          ) : metadataLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Loading file types...
            </div>
          ) : metadataError ? (
            <div className="text-center py-8 text-red-500">
              <div className="mb-2">⚠️ Failed to load file types</div>
              <div className="text-sm">{metadataError.message}</div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              📁 No file types available
            </div>
          )}
        </details>
      </div>

      {/* Current Filters Summary */}
      {(filters.mediaKind ||
        filters.mimeTypes.length > 0 ||
        filters.sizeRange.min ||
        filters.sizeRange.max ||
        filters.timeRange.from ||
        filters.timeRange.to ||
        Object.values(filters.booleanFilters).some((v) => v !== undefined)) && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Active Filters:
          </h4>
          <div className="flex flex-wrap gap-2">
            {filters.mediaKind && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Media: {filters.mediaKind}
                <button
                  onClick={() => removeFilter('mediaKind')}
                  className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                  aria-label="Remove media filter"
                  title="Remove media type filter"
                >
                  ×
                </button>
              </span>
            )}
            {filters.mimeTypes.length > 0 && (
              <>
                {filters.mimeTypes.map((mimeType) => {
                  // Find the label for this MIME type from dynamic data
                  const mimeTypeData = dynamicMimeTypes.find(
                    (mt) => mt.value === mimeType,
                  );
                  const displayLabel = mimeTypeData?.label || mimeType;

                  return (
                    <span
                      key={mimeType}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      {displayLabel}
                      <button
                        onClick={() => removeFilter('mimeType', mimeType)}
                        className="ml-1 text-green-600 hover:text-green-800 hover:bg-green-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-green-500"
                        aria-label={`Remove ${displayLabel} filter`}
                        title={`Remove ${displayLabel} filter`}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </>
            )}
            {(filters.sizeRange?.min || filters.sizeRange?.max) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Size: {formatFileSize(filters.sizeRange.min)} -{' '}
                {formatFileSize(filters.sizeRange.max)}
                <button
                  onClick={() => removeFilter('sizeRange')}
                  className="ml-1 text-purple-600 hover:text-purple-800 hover:bg-purple-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500"
                  aria-label="Remove size filter"
                  title="Remove size range filter"
                >
                  ×
                </button>
              </span>
            )}
            {(filters.timeRange?.from || filters.timeRange?.to) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Date Range
                <button
                  onClick={() => removeFilter('timeRange')}
                  className="ml-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-yellow-500"
                  aria-label="Remove date range filter"
                  title="Remove date range filter"
                >
                  ×
                </button>
              </span>
            )}
            {(filters.durationRange?.min || filters.durationRange?.max) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Duration:{' '}
                {filters.durationRange.min
                  ? Math.round(filters.durationRange.min / 1000) + 's'
                  : ''}{' '}
                -{' '}
                {filters.durationRange.max
                  ? Math.round(filters.durationRange.max / 1000) + 's'
                  : ''}
                <button
                  onClick={() => removeFilter('durationRange')}
                  className="ml-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  aria-label="Remove duration filter"
                  title="Remove duration range filter"
                >
                  ×
                </button>
              </span>
            )}
            {(filters.dimensionsRange?.width?.min ||
              filters.dimensionsRange?.width?.max ||
              filters.dimensionsRange?.height?.min ||
              filters.dimensionsRange?.height?.max) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                Dimensions
                <button
                  onClick={() => removeFilter('dimensionsRange')}
                  className="ml-1 text-pink-600 hover:text-pink-800 hover:bg-pink-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-pink-500"
                  aria-label="Remove dimensions filter"
                  title="Remove dimensions filter"
                >
                  ×
                </button>
              </span>
            )}
            {Object.entries(filters.booleanFilters || {}).map(
              ([key, value]) =>
                value && (
                  <span
                    key={key}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800"
                  >
                    {key === 'hasGps'
                      ? 'GPS'
                      : key === 'hasSubs'
                        ? 'Subtitles'
                        : 'Hash'}
                    <button
                      onClick={() => removeFilter('booleanFilter', key)}
                      className="ml-1 text-teal-600 hover:text-teal-800 hover:bg-teal-200 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500"
                      aria-label={`Remove ${key} filter`}
                      title={`Remove ${key === 'hasGps' ? 'GPS' : key === 'hasSubs' ? 'subtitles' : 'hash'} filter`}
                    >
                      ×
                    </button>
                  </span>
                ),
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

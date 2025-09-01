/**
 * FilterDebugger Component
 *
 * Manual debugging tool to test filter functionality
 */

import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { advancedFiltersAtom } from '@/atoms/search';
import { useSearch } from '@/hooks/useSearch';

export const FilterDebugger: React.FC = () => {
  const filters = useAtomValue(advancedFiltersAtom);
  const searchHook = useSearch();
  // Access buildSearchRequest if available (it's internal to the hook)
  const buildSearchRequest = null; // Remove this for now since it's internal

  useEffect(() => {
    console.group('🔍 Filter State Debug');
    console.log('Current filters:', JSON.stringify(filters, null, 2));

    // Test buildSearchRequest if available
    try {
      if (buildSearchRequest) {
        const testRequest = {
          q: 'test',
          page: 1,
          perPage: 20,
          sort: 'name',
          order: 'asc' as const,
        };
        const builtRequest = buildSearchRequest(testRequest);
        console.log(
          'Built search request:',
          JSON.stringify(builtRequest, null, 2),
        );
      }
    } catch (error) {
      console.error('Error building search request:', error);
    }
    console.groupEnd();
  }, [filters, buildSearchRequest]);

  const filterSummary = {
    hasActiveFilters: Object.values(filters).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(
          (v) => v !== undefined && v !== null && v !== '',
        );
      }
      return value !== undefined && value !== null && value !== '';
    }),
    mediaKind: filters.mediaKind,
    mimeTypesCount: filters.mimeTypes?.length || 0,
    sizeRange: filters.sizeRange,
    timeRange: filters.timeRange,
    durationRange: filters.durationRange,
    dimensionsRange: filters.dimensionsRange,
    booleanFilters: filters.booleanFilters,
  };

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-yellow-400">
      <h3 className="text-lg font-bold mb-4 text-yellow-800 dark:text-yellow-200">
        🛠️ Filter Debugger
      </h3>

      <div className="space-y-4">
        <div>
          <h4 className="font-semibold">Filter Summary:</h4>
          <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(filterSummary, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="font-semibold">Raw Filter State:</h4>
          <pre className="bg-white dark:bg-gray-900 p-2 rounded text-xs overflow-auto max-h-40">
            {JSON.stringify(filters, null, 2)}
          </pre>
        </div>

        <div>
          <h4 className="font-semibold">Issues Detected:</h4>
          <ul className="list-disc list-inside text-sm">
            {/* Check for common issues */}
            {filters?.mimeTypes && !Array.isArray(filters.mimeTypes) && (
              <li className="text-red-600">❌ mimeTypes is not an array</li>
            )}
            {filters?.sizeRange && typeof filters.sizeRange !== 'object' && (
              <li className="text-red-600">❌ sizeRange is not an object</li>
            )}
            {filters?.timeRange && typeof filters.timeRange !== 'object' && (
              <li className="text-red-600">❌ timeRange is not an object</li>
            )}
            {filters?.booleanFilters &&
              typeof filters.booleanFilters !== 'object' && (
                <li className="text-red-600">
                  ❌ booleanFilters is not an object
                </li>
              )}
            {/* Check for undefined nested objects */}
            {!filters?.dimensionsRange?.width && (
              <li className="text-yellow-600">
                ⚠️ dimensionsRange.width is undefined
              </li>
            )}
            {!filters?.dimensionsRange?.height && (
              <li className="text-yellow-600">
                ⚠️ dimensionsRange.height is undefined
              </li>
            )}
            {/* Check for null/undefined filters object */}
            {!filters && (
              <li className="text-red-600">
                ❌ Filters object is null/undefined
              </li>
            )}
            {filterSummary.hasActiveFilters && (
              <li className="text-green-600">✅ Has active filters</li>
            )}
            {!filterSummary.hasActiveFilters && (
              <li className="text-gray-600">ℹ️ No active filters</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

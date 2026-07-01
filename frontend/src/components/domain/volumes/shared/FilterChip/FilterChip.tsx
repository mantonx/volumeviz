import React from 'react';
import type { FilterChipProps } from './FilterChip.types';

/**
 * FilterChip component for displaying removable filter tags.
 *
 * Used on the volumes page to show active filters such as:
 * - Search terms
 * - Status filters (active, inactive)
 * - Orphaned volume filters
 *
 * Each chip includes a remove button allowing users to clear
 * individual filters without resetting all filters.
 */
export const FilterChip: React.FC<FilterChipProps> = ({ label, onRemove }) => {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      {label}
      <button
        type="button"
        className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white dark:text-blue-300 dark:hover:bg-blue-800"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
      >
        <span className="sr-only">Remove filter</span>
        <svg
          className="h-2 w-2"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 8 8"
        >
          <path strokeLinecap="round" strokeWidth="1.5" d="m1 1 6 6m0-6-6 6" />
        </svg>
      </button>
    </span>
  );
};

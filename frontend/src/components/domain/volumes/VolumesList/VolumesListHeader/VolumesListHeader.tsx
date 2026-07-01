/**
 * VolumesListHeader Component
 *
 * Displays view controls, scan all button, and export dropdown for the volumes list.
 * Extracted from VolumesList to improve maintainability.
 */

import React from 'react';
import { cn } from '@/utils/ui';
import { Dropdown } from '@/components/ui/Dropdown';
import {
  Grid,
  List,
  Loader2,
  ScanSearch,
  Download,
  FileText,
  FileJson,
} from 'lucide-react';
import type { VolumesListHeaderProps } from './VolumesListHeader.types';

/**
 * VolumesListHeader displays action controls for the volumes list
 */
export const VolumesListHeader: React.FC<VolumesListHeaderProps> = ({
  viewMode,
  onViewModeChange,
  onScanAll,
  isScanLoading,
  hasVolumes,
  onExportCSV,
  onExportJSON,
  isExportLoading,
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-end gap-3', className)}>
      {/* View Mode Toggle */}
      <div className="flex bg-surface-secondary rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('table')}
          className={cn(
            'p-2 rounded-md transition-colors',
            viewMode === 'table'
              ? 'bg-surface text-primary shadow-sm'
              : 'text-tertiary hover:text-primary'
          )}
          title="Table view"
          aria-label="Switch to table view"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'p-2 rounded-md transition-colors',
            viewMode === 'grid'
              ? 'bg-surface text-primary shadow-sm'
              : 'text-tertiary hover:text-primary'
          )}
          title="Grid view"
          aria-label="Switch to grid view"
        >
          <Grid className="h-4 w-4" />
        </button>
      </div>

      {/* Scan All Button */}
      <button
        onClick={onScanAll}
        disabled={isScanLoading || !hasVolumes}
        className={cn(
          'inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm',
          'text-sm font-medium text-white',
          'bg-blue-600 hover:bg-blue-700',
          'disabled:bg-gray-300 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        )}
        aria-label="Scan all volumes"
      >
        {isScanLoading ? (
          <Loader2 className="-ml-1 mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ScanSearch className="-ml-1 mr-2 h-4 w-4" />
        )}
        {isScanLoading ? 'Scanning...' : 'Scan All'}
      </button>

      {/* Export Dropdown */}
      <Dropdown
        items={[
          {
            id: 'csv',
            label: 'Export as CSV',
            icon: FileText,
            onClick: onExportCSV,
            disabled: isExportLoading,
          },
          {
            id: 'json',
            label: 'Export as JSON',
            icon: FileJson,
            onClick: onExportJSON,
            disabled: isExportLoading,
          },
        ]}
        trigger={
          <button
            className={cn(
              'inline-flex items-center px-4 py-2 border border-line rounded-md shadow-sm',
              'text-sm font-medium text-secondary bg-surface hover:bg-surface-hover',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            disabled={isExportLoading}
            aria-label="Export volumes"
          >
            <Download className="-ml-1 mr-2 h-4 w-4" />
            Export
          </button>
        }
        align="right"
      />
    </div>
  );
};

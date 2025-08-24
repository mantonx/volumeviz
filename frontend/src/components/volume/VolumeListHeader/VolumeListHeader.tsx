import React from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Plus,
  Columns,
  Download,
  LayoutGrid,
  List,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils';
import type { VolumeListHeaderProps } from './VolumeListHeader.types';

/**
 * Header component for the VolumesList
 * Contains search, filters, view controls, and actions
 */
export const VolumeListHeader: React.FC<VolumeListHeaderProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  filterCount,
  showFilters,
  onToggleFilters,
  showColumnConfig,
  onToggleColumnConfig,
  visibleColumnsCount,
  totalColumnsCount,
  onRefresh,
  onExport,
  onShowKeyboardHelp,
  onDiscoverVolumes,
  isLoading = false,
  isRefreshing = false,
  totalVolumes = 0,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Top row - Search and primary actions */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search volumes by name, project, or container..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4"
            disabled={isLoading}
          />
        </div>

        {/* Primary actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter toggle */}
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleFilters}
            className="relative"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {filterCount > 0 && (
              <Badge
                variant="error"
                size="sm"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
              >
                {filterCount}
              </Badge>
            )}
          </Button>

          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className="rounded-r-none"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('cards')}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* Column config (table view only) */}
          {viewMode === 'table' && (
            <Button
              variant={showColumnConfig ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleColumnConfig}
            >
              <Columns className="h-4 w-4 mr-2" />
              Columns ({visibleColumnsCount}/{totalColumnsCount})
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
            />
          </Button>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4" />
          </Button>

          {/* Discover volumes */}
          <Button variant="primary" size="sm" onClick={onDiscoverVolumes}>
            <Plus className="h-4 w-4 mr-2" />
            Discover
          </Button>

          {/* Keyboard shortcuts help */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowKeyboardHelp}
            className="px-2"
            title="Keyboard shortcuts (Ctrl+?)"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Volume count and status */}
      {totalVolumes > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {totalVolumes} volume{totalVolumes !== 1 ? 's' : ''}
          {filterCount > 0 &&
            ` (${filterCount} filter${filterCount !== 1 ? 's' : ''} applied)`}
        </div>
      )}
    </div>
  );
};

export default VolumeListHeader;

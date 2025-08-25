import { useVolumeScanning } from '@/api/services';
import VolumeDetailsModal from '@/components/modals/VolumeDetailsModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ColumnConfig, ColumnDefinition } from '@/components/ui/ColumnConfig';
import type { DropdownItem } from '@/components/ui/Dropdown';
import { KeyboardShortcutsHelp } from '@/components/ui/KeyboardShortcutsHelp';
import { Pagination } from '@/components/ui/Pagination';
import { formatBytes } from '@/components/ui/SizeVisualization';
import { VolumeListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { VolumeBulkActions } from '@/components/volume/VolumeBulkActions';
import { VolumeCardView } from '@/components/volume/VolumeCardView';
import { VolumeFilterPanel } from '@/components/volume/VolumeFilterPanel';
import { VolumeListHeader } from '@/components/volume/VolumeListHeader';
import { VolumeQuickFilters } from '@/components/volume/VolumeQuickFilters';
import { VolumeTableView } from '@/components/volume/VolumeTableView';
import { useFilterViews } from '@/hooks/useFilterViews';
import type { VolumeMount } from '@/hooks/useVolumesAndMounts';
import { useVolumesAndMounts } from '@/hooks/useVolumesAndMounts';
import { useWebSocket } from '@/providers/WebSocketProvider';
import {
  volumesAddDetailedProgressAtom,
  volumesClearSelectionAtom,
  volumesRemoveDetailedProgressAtom,
  volumesSearchQueryAtom,
  volumesSelectAllAtom,
  volumesSelectAllModeAtom,
  volumesSelectedCountAtom,
  volumesSelectedForDetailsAtom,
  volumesSelectedIdsAtom,
  volumesSelectPageAtom,
  volumesShowColumnConfigAtom,
  volumesShowDetailsModalAtom,
  volumesShowFiltersAtom,
  volumesShowKeyboardHelpAtom,
  volumesShowSelectDropdownAtom,
  volumesToggleColumnAtom,
  volumesToggleSelectionAtom,
  volumesViewModeAtom,
  volumesVisibleColumnsAtom,
  volumesWithDetailedProgressAtom,
} from '@/store';
import { cn } from '@/utils';
import { QUICK_FILTER_PRESETS } from '@/utils/quickFilters';
import { calculateVolumePercentage } from '@/utils/volumePercentage';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { AlertTriangle, Database, Eye, EyeOff, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo } from 'react';
import type {
  BulkAction,
  FilterChip,
  SortConfig,
  VolumesListProps,
} from './VolumesList.types';

/**
 * Main VolumesList component - refactored using extracted components
 * Provides comprehensive volume and mount management interface
 */
export const VolumesList: React.FC<VolumesListProps> = ({ className }) => {
  // Default view configuration
  const defaultView = useMemo(
    () => ({
      search: '',
      filters: {},
      sort: [{ field: 'name', direction: 'asc' as const }],
      columns: [
        'name',
        'type',
        'compose_project',
        'containers',
        'status',
        'size_bytes',
        'last_seen',
      ],
    }),
    [],
  );

  // Filter views management
  const {
    currentConfig,
    updateConfig,
    clearFilters: clearFiltersState,
  } = useFilterViews({
    storageKey: 'volumeviz_volumes_views',
    defaultView,
  });

  // API data management
  const {
    data,
    loading,
    error,
    paginationMeta,
    fetchData,
    bulkTrack,
    bulkUntrack,
    bulkHide,
    triggerDiscovery,
  } = useVolumesAndMounts();

  // Toast notifications
  const { success, error: showError, info } = useToast();

  // WebSocket connection
  const { isConnected, on, send } = useWebSocket();

  // Scanning functionality
  const { scanVolume, scanLoading } = useVolumeScanning();

  // UI State with Jotai atoms
  const [viewMode, setViewMode] = useAtom(volumesViewModeAtom);
  const [showFilters, setShowFilters] = useAtom(volumesShowFiltersAtom);
  const [showColumnConfig, setShowColumnConfig] = useAtom(
    volumesShowColumnConfigAtom,
  );
  const [showKeyboardHelp, setShowKeyboardHelp] = useAtom(
    volumesShowKeyboardHelpAtom,
  );
  const [selectedIds] = useAtom(volumesSelectedIdsAtom);
  const [selectAllMode] = useAtom(volumesSelectAllModeAtom);
  const [selectedVolumeForDetails] = useAtom(volumesSelectedForDetailsAtom);
  const [showVolumeDetailsModal, setShowVolumeDetailsModal] = useAtom(
    volumesShowDetailsModalAtom,
  );
  const [volumesWithDetailedProgress, setVolumesWithDetailedProgress] = useAtom(
    volumesWithDetailedProgressAtom,
  );
  const [showSelectDropdown, setShowSelectDropdown] = useAtom(
    volumesShowSelectDropdownAtom,
  );
  const [searchQuery, setSearchQuery] = useAtom(volumesSearchQueryAtom);
  const [visibleColumns] = useAtom(volumesVisibleColumnsAtom);

  // Action atoms
  const toggleSelection = useSetAtom(volumesToggleSelectionAtom);
  const clearSelection = useSetAtom(volumesClearSelectionAtom);
  const selectAllVolumes = useSetAtom(volumesSelectAllAtom);
  const selectPageVolumes = useSetAtom(volumesSelectPageAtom);
  const toggleColumn = useSetAtom(volumesToggleColumnAtom);
  const addDetailedProgress = useSetAtom(volumesAddDetailedProgressAtom);
  const removeDetailedProgress = useSetAtom(volumesRemoveDetailedProgressAtom);

  // Computed values
  const selectedCount = useAtomValue(volumesSelectedCountAtom);

  // Derived state
  const sortConfig: SortConfig[] = useMemo(
    () => currentConfig.sort || [{ field: 'name', direction: 'asc' }],
    [currentConfig.sort],
  );

  // Filter chips for active filters
  const filterChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = [];
    const filters = currentConfig.filters || {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        chips.push({
          id: `${key}-${value}`,
          type: key as FilterChip['type'],
          value: value as string,
          label: `${key}: ${value}`,
          removable: true,
        });
      }
    });

    return chips;
  }, [currentConfig.filters]);

  // Column configuration
  const availableColumns: ColumnDefinition[] = [
    { key: 'name', label: 'Name/Path' },
    { key: 'type', label: 'Type' },
    { key: 'compose_project', label: 'Compose Project' },
    { key: 'containers', label: 'Containers' },
    { key: 'status', label: 'Status' },
    { key: 'size_bytes', label: 'Size' },
    { key: 'last_seen', label: 'Size Scan' },
    { key: 'driver', label: 'Driver' },
    { key: 'compose_services', label: 'Services' },
    { key: 'readonly', label: 'RO/RW' },
    { key: 'growth_rate', label: 'Growth' },
    { key: 'created_at', label: 'Created' },
  ];

  const visibleColumnsSet = useMemo(() => {
    return new Set(visibleColumns);
  }, [visibleColumns]);

  // Calculate max size for relative calculations
  const maxSize = useMemo(() => {
    if (!data || data.length === 0) return 1;
    return Math.max(...data.map((item) => item.size_bytes || 0), 1);
  }, [data]);

  // Load data on mount
  useEffect(() => {
    fetchData({});
  }, [fetchData]);

  // WebSocket subscriptions for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const handleVolumeListUpdate = (message: any) => {
      const data = message.data || message;
      if (['created', 'updated', 'removed'].includes(data.action)) {
        setTimeout(() => fetchData({}), 500);
      }
    };

    const handleContainerUpdate = (message: any) => {
      const data = message.data || message;
      if (['attached', 'detached'].includes(data.action)) {
        setTimeout(() => fetchData({}), 500);
      }
    };

    const handleScanProgress = (message: any) => {
      console.log('Received scan progress update:', message);
      const data = message.data || message;
      // Refresh data when scan completes to update volume sizes
      if (data.phase === 'complete' || data.phase === 'completed') {
        setTimeout(() => fetchData({}), 1000);
      }
    };

    on('volume_updates', handleVolumeListUpdate);
    on('container_updates', handleContainerUpdate);
    on('scan_progress_update', handleScanProgress); // Backend sends 'scan_progress_update', not 'scan_progress'

    // Subscribe to scan progress for all volumes
    const subscribeMessage = {
      type: 'subscribe',
      data: {
        event: 'scan_progress',
        filters: {}, // Subscribe to all scan progress
      },
    };
    console.log('Sending WebSocket subscription:', subscribeMessage);
    
    // Add a small delay to ensure WebSocket connection is fully ready
    setTimeout(() => {
      if (!send(subscribeMessage)) {
        console.warn('Failed to send subscription, retrying in 100ms...');
        setTimeout(() => send(subscribeMessage), 100);
      }
    }, 10);
  }, [isConnected, on, send, fetchData]);

  // Show error toasts
  useEffect(() => {
    if (error) {
      showError(`Failed to load data: ${error}`);
    }
  }, [error, showError]);

  // Handlers
  const handleSort = useCallback(
    (field: string) => {
      const existing = sortConfig.find((s) => s.field === field);
      let newSort: SortConfig[];

      if (existing) {
        newSort = [
          { field, direction: existing.direction === 'asc' ? 'desc' : 'asc' },
        ];
      } else {
        newSort = [{ field, direction: 'asc' }];
      }

      updateConfig({ sort: newSort });
    },
    [sortConfig, updateConfig],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateConfig({ search: query });
    },
    [setSearchQuery, updateConfig],
  );

  const handleRefresh = useCallback(() => {
    fetchData({});
  }, [fetchData]);

  const clearFilters = useCallback(() => {
    clearFiltersState();
    updateConfig({
      filters: {},
      sort: defaultView.sort,
    });
    fetchData({
      page: 1,
      page_size: paginationMeta.pageSize,
      sort: defaultView.sort?.[0]
        ? `${defaultView.sort[0].field}:${defaultView.sort[0].direction}`
        : 'name:asc',
      q: undefined,
    });
    success('All filters cleared');
  }, [
    clearFiltersState,
    paginationMeta.pageSize,
    defaultView.sort,
    fetchData,
    success,
    updateConfig,
  ]);

  const handleToggleColumn = useCallback(
    (columnKey: string) => {
      toggleColumn(columnKey);

      const newColumns = visibleColumns.includes(columnKey)
        ? visibleColumns.filter((col) => col !== columnKey)
        : [...visibleColumns, columnKey];

      updateConfig({ columns: newColumns });
    },
    [toggleColumn, visibleColumns, updateConfig],
  );

  const handleSelectAll = useCallback(() => {
    const pageItems = data;
    const allPageSelected = pageItems.every((item) => selectedIds.has(item.id));

    if (allPageSelected) {
      clearSelection();
    } else {
      selectPageVolumes(pageItems.map((item) => item.id));
    }
  }, [data, selectedIds, clearSelection, selectPageVolumes]);

  const handleSelectItem = useCallback(
    (id: string) => {
      toggleSelection(id);
    },
    [toggleSelection],
  );

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleSelectAllPages = useCallback(() => {
    selectAllVolumes(data.map((item) => item.id));
    setShowSelectDropdown(false);
  }, [data, selectAllVolumes, setShowSelectDropdown]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      fetchData({
        page: newPage,
        page_size: paginationMeta.pageSize,
        sort:
          sortConfig.length > 0
            ? `${sortConfig[0].field}:${sortConfig[0].direction}`
            : undefined,
        q: searchQuery || undefined,
      });
    },
    [fetchData, paginationMeta.pageSize, sortConfig, searchQuery],
  );

  // Volume scanning
  const handleScanVolume = useCallback(
    async (volumeId: string) => {
      const wasAlreadyOpen = volumesWithDetailedProgress.has(volumeId);

      try {
        // Always show progress when starting a scan
        addDetailedProgress(volumeId);

        // Show toast notification that scan is starting
        info('Starting volume scan...');

        // Start the actual scan
        await scanVolume(volumeId);

        // Show success toast
        success('Volume scan completed successfully');
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Scan failed');
        showError(`Volume scan failed: ${error.message}`);
      } finally {
        // Auto-close progress panel only if it wasn't manually opened before the scan
        if (!wasAlreadyOpen) {
          setTimeout(() => {
            removeDetailedProgress(volumeId);
          }, 5000); // Auto-close after 5 seconds to show final results
        }
      }
    },
    [
      scanVolume,
      success,
      showError,
      info,
      addDetailedProgress,
      removeDetailedProgress,
      volumesWithDetailedProgress,
    ],
  );

  // Just toggle progress view without triggering scan or toasts
  const handleToggleProgressView = useCallback(
    (volumeId: string) => {
      const hasDetailedProgress = volumesWithDetailedProgress.has(volumeId);

      if (hasDetailedProgress) {
        removeDetailedProgress(volumeId);
      } else {
        addDetailedProgress(volumeId);
      }
    },
    [volumesWithDetailedProgress, addDetailedProgress, removeDetailedProgress],
  );

  // Get volume actions
  const getVolumeActions = useCallback(
    (item: VolumeMount): DropdownItem[] => {
      const isScanning = scanLoading[item.id] || false;
      const hasDetailedProgress = volumesWithDetailedProgress.has(item.id);

      return [
        {
          id: 'scan',
          label: isScanning ? 'Scanning...' : 'Scan Volume',
          icon: RefreshCw,
          onClick: () => handleScanVolume(item.id),
          disabled: item.status === 'untracked' || isScanning,
        },
        {
          id: 'view-progress',
          label: hasDetailedProgress ? 'Hide Progress' : 'Show Progress',
          icon: hasDetailedProgress ? EyeOff : Eye,
          onClick: () => handleToggleProgressView(item.id),
          disabled: item.status === 'untracked',
        },
        {
          id: 'track',
          label:
            item.status === 'tracked' ? 'Disable Tracking' : 'Enable Tracking',
          icon: Database,
          onClick: () => {
            if (item.status === 'tracked') {
              bulkUntrack([item.id]);
            } else {
              bulkTrack([item.id]);
            }
          },
          destructive: item.status === 'tracked',
        },
      ];
    },
    [
      scanLoading,
      handleScanVolume,
      handleToggleProgressView,
      bulkTrack,
      bulkUntrack,
      volumesWithDetailedProgress,
    ],
  );

  // Status color helper
  const getStatusColor = (status: VolumeMount['status']) => {
    switch (status) {
      case 'tracked':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'untracked':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'orphaned':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  // Type icon helper
  const getTypeIcon = (type: VolumeMount['type']) => {
    switch (type) {
      case 'volume':
        return Database;
      default:
        return Database;
    }
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: 'untrack',
      label: 'Disable Tracking',
      icon: Database,
      action: bulkUntrack,
      variant: 'destructive',
    },
    {
      id: 'hide',
      label: 'Hide Selected',
      icon: AlertTriangle,
      action: bulkHide,
      variant: 'destructive',
    },
  ];

  const totalPages = Math.ceil(paginationMeta.total / paginationMeta.pageSize);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <VolumeListHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterCount={filterChips.length}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        showColumnConfig={showColumnConfig}
        onToggleColumnConfig={() => setShowColumnConfig(!showColumnConfig)}
        visibleColumnsCount={visibleColumnsSet.size}
        totalColumnsCount={availableColumns.length}
        onRefresh={handleRefresh}
        onExport={() => success('Export functionality coming soon!')}
        onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
        onDiscoverVolumes={triggerDiscovery}
        isLoading={loading}
        isRefreshing={loading}
        totalVolumes={paginationMeta.total}
      />

      {/* Column Configuration */}
      <ColumnConfig
        show={showColumnConfig}
        onToggle={() => setShowColumnConfig(!showColumnConfig)}
        availableColumns={availableColumns}
        visibleColumns={visibleColumnsSet}
        onToggleColumn={handleToggleColumn}
      />

      {/* Filter Panel */}
      <VolumeFilterPanel
        showAdvancedFilters={showFilters}
        filterChips={filterChips}
        onRemoveFilterChip={(chipId) => {
          const [type] = chipId.split('-');
          const filters = { ...currentConfig.filters };
          delete filters[type];
          updateConfig({ filters });
        }}
        availableFilters={[
          {
            key: 'type',
            label: 'Type',
            placeholder: 'All Types',
            options: [
              { value: 'volume', label: 'Volume' },
              { value: 'bind', label: 'Bind Mount' },
              { value: 'tmpfs', label: 'Tmpfs' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            placeholder: 'All Status',
            options: [
              { value: 'tracked', label: 'Tracked' },
              { value: 'untracked', label: 'Untracked' },
              { value: 'orphaned', label: 'Orphaned' },
            ],
          },
        ]}
        onApplyFilter={(filterKey, value) => {
          const filters = { ...currentConfig.filters };
          filters[filterKey] = value;
          updateConfig({ filters });
        }}
      />

      {/* Quick Filters */}
      <VolumeQuickFilters
        filters={[...QUICK_FILTER_PRESETS.extended]}
        activeFilters={new Set(Object.keys(currentConfig.filters || {}))}
        onApplyFilter={(filter) => {
          const newFilters = { ...currentConfig.filters };
          newFilters[filter.filterType] = filter.filterValue;
          updateConfig({ filters: newFilters });
        }}
        onClearFilter={(filterId) => {
          const newFilters = { ...currentConfig.filters };
          delete newFilters[filterId];
          updateConfig({ filters: newFilters });
        }}
      />

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <VolumeBulkActions
          selectedCount={selectedCount}
          selectAllMode={selectAllMode}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
          onSelectPage={handleSelectAll}
          bulkActions={bulkActions}
          isProcessing={loading}
        />
      )}

      {/* Error State */}
      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to Load Data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      ) : loading ? (
        // Loading State
        <Card className="overflow-hidden">
          <VolumeListSkeleton rows={paginationMeta.pageSize || 25} />
        </Card>
      ) : data.length === 0 ? (
        // Empty State
        <Card className="p-8">
          <div className="text-center">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Results Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery || filterChips.length > 0
                ? 'No volumes or mounts match your search criteria.'
                : 'No volumes or mounts are available.'}
            </p>
            {(searchQuery || filterChips.length > 0) && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === 'cards' ? (
        <>
          <VolumeCardView
            data={data}
            selectedIds={selectedIds}
            onSelectItem={handleSelectItem}
            getVolumeActions={getVolumeActions}
            getStatusColor={getStatusColor}
            getTypeIcon={getTypeIcon}
            formatBytes={formatBytes}
            calculateVolumePercentage={calculateVolumePercentage}
            maxSize={maxSize}
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={paginationMeta.page}
              totalPages={totalPages}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.total}
              onPageChange={handlePageChange}
              loading={loading}
            />
          )}
        </>
      ) : (
        <>
          <VolumeTableView
            data={data}
            loading={loading}
            selectedIds={selectedIds}
            selectAllMode={selectAllMode}
            paginationMeta={paginationMeta}
            availableColumns={availableColumns}
            visibleColumns={visibleColumnsSet}
            sortConfig={sortConfig}
            onSort={handleSort}
            onSelectAll={handleSelectAll}
            onSelectItem={handleSelectItem}
            onSelectAllPages={handleSelectAllPages}
            onClearSelection={handleClearSelection}
            getVolumeActions={getVolumeActions}
            getStatusColor={getStatusColor}
            getTypeIcon={getTypeIcon}
            formatBytes={formatBytes}
            calculateVolumePercentage={calculateVolumePercentage}
            maxSize={maxSize}
            volumesWithDetailedProgress={volumesWithDetailedProgress}
            setVolumesWithDetailedProgress={setVolumesWithDetailedProgress}
            showSelectDropdown={showSelectDropdown}
            success={success}
            showError={showError}
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={paginationMeta.page}
              totalPages={totalPages}
              pageSize={paginationMeta.pageSize}
              totalItems={paginationMeta.total}
              onPageChange={handlePageChange}
              loading={loading}
            />
          )}
        </>
      )}

      {/* Volume Details Modal */}
      <VolumeDetailsModal
        isOpen={showVolumeDetailsModal}
        onClose={() => setShowVolumeDetailsModal(false)}
        volumeName={selectedVolumeForDetails}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        shortcutGroups={[]}
        title="VolumesList Keyboard Shortcuts"
      />
    </div>
  );
};

export default VolumesList;

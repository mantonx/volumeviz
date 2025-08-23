import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  Archive,
  ChevronDown,
  X,
  Plus,
  Share,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Activity,
  MoreHorizontal,
  Columns,
  Download,
  PlayCircle,
  PauseCircle,
  LayoutGrid,
  List,
  // Icons needed for existing functionality
  Eye,
  EyeOff,
  Database,
  Folder,
  HardDrive,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { FilterViewsManager } from '@/components/FilterViewsManager';
import { useFilterViews } from '@/hooks/useFilterViews';
import { useToast } from '@/components/ui/Toast/ToastProvider';
import { useVolumesAndMounts } from '@/hooks/useVolumesAndMounts';
import type { VolumeMount } from '@/hooks/useVolumesAndMounts';
import { cn } from '@/utils';
import { calculateVolumePercentage } from '@/utils/volumePercentage';
import { QUICK_FILTER_PRESETS, type QuickFilterConfig, getQuickFilterById } from '@/utils/quickFilters';
import { useKeyboardShortcuts, createVolumeListShortcuts } from '@/utils/keyboardShortcuts';
import { KeyboardShortcutsHelp } from '@/components/ui/KeyboardShortcutsHelp';
import { SizeVisualization, formatBytes } from '@/components/ui/SizeVisualization';
import { GrowthIndicator } from '@/components/ui/GrowthIndicator';
import { ContainerStatus, ContainerBadge } from '@/components/ui/ContainerStatus';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { VolumeListSkeleton } from '@/components/ui/Skeleton';
import VolumeDetailsModal from '@/components/modals/VolumeDetailsModal';

// Types for filters and UI components

interface FilterChip {
  id: string;
  label: string;
  value: string;
  type: 'type' | 'status' | 'project' | 'driver' | 'readonly';
  removable: boolean;
}

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (selectedIds: string[]) => Promise<void>;
  variant?: 'default' | 'destructive';
}

export const VolumesList: React.FC = () => {
  // Filter views management - use useMemo to prevent object recreation
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

  const {
    savedViews,
    currentConfig,
    isModified,
    updateConfig,
    saveView,
    updateView,
    deleteView,
    loadView,
    copyShareableUrl,
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
  const { success, error: showError, info, loading: showLoading } = useToast();

  // UI state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState<'none' | 'page' | 'all'>(
    'none',
  );
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedVolumeForDetails, setSelectedVolumeForDetails] = useState<string>('');
  const [showVolumeDetailsModal, setShowVolumeDetailsModal] = useState(false);

  // Derived state from currentConfig
  const searchQuery = currentConfig.search || '';
  const sortConfig = useMemo(
    () => currentConfig.sort || [{ field: 'name', direction: 'asc' as const }],
    [currentConfig.sort],
  );
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
  const visibleColumns = useMemo(() => {
    return new Set(
      currentConfig.columns || [
        'name',
        'type',
        'compose_project',
        'containers',
        'status',
        'size_bytes',
        'last_seen',
      ],
    );
  }, [currentConfig.columns]);

  const availableColumns = [
    { key: 'name', label: 'Name/Path', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
    { key: 'driver', label: 'Driver', sortable: true },
    { key: 'compose_project', label: 'Compose Project', sortable: true },
    { key: 'compose_services', label: 'Services', sortable: false },
    { key: 'containers', label: 'Containers', sortable: true },
    { key: 'readonly', label: 'RO/RW', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'size_bytes', label: 'Size', sortable: true },
    { key: 'last_seen', label: 'Size Scan', sortable: true },
    { key: 'growth_rate', label: 'Growth', sortable: true },
    { key: 'created_at', label: 'Created', sortable: true },
  ];

  // Quick filter configurations - using centralized utility
  // Define early to avoid circular dependency
  const quickFilters: QuickFilterConfig[] = useMemo(
    () => [...QUICK_FILTER_PRESETS.extended],
    [],
  );

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: 'track',
      label: 'Track Selected',
      icon: Eye,
      action: bulkTrack,
    },
    {
      id: 'untrack',
      label: 'Untrack Selected',
      icon: EyeOff,
      action: bulkUntrack,
    },
    {
      id: 'hide',
      label: 'Hide Selected',
      icon: Archive,
      action: bulkHide,
      variant: 'destructive',
    },
  ];

  // Load data once on mount
  useEffect(() => {
    fetchData({});
  }, [fetchData]);

  // Handlers
  const handleSort = useCallback(
    (field: string) => {
      const newSort = [...sortConfig];
      const existing = newSort.find((s) => s.field === field);

      if (existing) {
        if (existing.direction === 'asc') {
          existing.direction = 'desc';
        } else {
          // Remove this sort
          const index = newSort.findIndex((s) => s.field === field);
          newSort.splice(index, 1);
        }
      } else {
        newSort.push({ field, direction: 'asc' });
      }

      updateConfig({ sort: newSort });
    },
    [sortConfig, updateConfig],
  );

  const addFilterChip = useCallback(
    (type: string, value: string) => {
      const filters = { ...currentConfig.filters };
      filters[type] = value;
      updateConfig({ filters });
    },
    [currentConfig.filters, updateConfig],
  );

  const removeFilterChip = useCallback(
    (chipId: string) => {
      const [type] = chipId.split('-');
      const filters = { ...currentConfig.filters };
      delete filters[type];
      updateConfig({ filters });
    },
    [currentConfig.filters, updateConfig],
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      updateConfig({ search: query });
    },
    [updateConfig],
  );

  // Quick filter actions - properly wired to API
  const applyQuickFilter = useCallback(
    (filter: (typeof quickFilters)[0]) => {
      const newFilters = { ...currentConfig.filters };
      newFilters[filter.filterType] = filter.filterValue;
      updateConfig({ filters: newFilters });

      // Build API parameters
      const params: any = {
        page: 1, // Reset to first page when filtering
        page_size: paginationMeta.pageSize,
        q: currentConfig.search || undefined,
      };

      // Apply sort for Large Volumes filter
      if (filter.id === 'large_volumes') {
        params.sort = 'size_bytes:desc';
      } else if (currentConfig.sort?.[0]) {
        params.sort = `${currentConfig.sort[0].field}:${currentConfig.sort[0].direction}`;
      }

      // Apply all active filters from the configuration
      // Use the quick filter configs to get the correct API parameters
      Object.entries(newFilters).forEach(([key, value]) => {
        // Find the matching quick filter config to get the correct API params
        const matchingFilter = quickFilters.find(
          f => f.filterType === key && f.filterValue === value
        );
        
        if (matchingFilter) {
          // Use the filter's configured API key and value
          params[matchingFilter.apiKey] = matchingFilter.apiValue;
        } else {
          // Fallback for non-quick filters
          switch (key) {
            case 'project':
              params.compose_project = value as string;
              break;
            case 'driver':
              params.driver = value as any;
              break;
          }
        }
      });

      fetchData(params);
    },
    [currentConfig, updateConfig, paginationMeta.pageSize, fetchData, quickFilters],
  );

  const clearQuickFilter = useCallback(
    (filterType: string) => {
      const newFilters = { ...currentConfig.filters };
      delete newFilters[filterType];
      updateConfig({ filters: newFilters });

      // Build params with remaining filters
      const params: any = {
        page: 1,
        page_size: paginationMeta.pageSize,
        q: currentConfig.search || undefined,
      };

      // Reset sort to default if we're clearing the Large Volumes filter
      if (filterType === 'size') {
        params.sort = defaultView.sort?.[0]
          ? `${defaultView.sort[0].field}:${defaultView.sort[0].direction}`
          : 'name:asc';
      } else if (currentConfig.sort?.[0]) {
        params.sort = `${currentConfig.sort[0].field}:${currentConfig.sort[0].direction}`;
      }

      // Apply remaining filters using quick filter configs
      Object.entries(newFilters).forEach(([key, value]) => {
        // Find the matching quick filter config to get the correct API params
        const matchingFilter = quickFilters.find(
          f => f.filterType === key && f.filterValue === value
        );
        
        if (matchingFilter) {
          // Use the filter's configured API key and value
          params[matchingFilter.apiKey] = matchingFilter.apiValue;
        } else {
          // Fallback for non-quick filters
          switch (key) {
            case 'project':
              params.compose_project = value as string;
              break;
            case 'driver':
              params.driver = value as any;
              break;
          }
        }
      });

      fetchData(params);
    },
    [currentConfig, updateConfig, paginationMeta.pageSize, fetchData, defaultView, quickFilters],
  );

  const isQuickFilterActive = useCallback(
    (filterType: string, filterValue: string) => {
      return currentConfig.filters?.[filterType] === filterValue;
    },
    [currentConfig.filters],
  );

  // Enhanced clear filters that also refreshes data
  const clearFilters = useCallback(() => {
    // Clear the state
    clearFiltersState();

    // Reset sort to default as well
    updateConfig({ 
      filters: {},
      sort: defaultView.sort
    });

    // Trigger fresh data fetch with no filters and default sort
    const params = {
      page: 1,
      page_size: paginationMeta.pageSize,
      sort: defaultView.sort?.[0]
        ? `${defaultView.sort[0].field}:${defaultView.sort[0].direction}`
        : 'name:asc',
      q: undefined,
    };

    fetchData(params);
    success('All filters cleared');
  }, [
    clearFiltersState,
    paginationMeta.pageSize,
    defaultView.sort,
    fetchData,
    success,
  ]);


  const toggleColumn = useCallback(
    (columnKey: string) => {
      const currentColumns = currentConfig.columns || [
        'name',
        'type',
        'compose_project',
        'containers',
        'status',
        'size_bytes',
        'last_seen',
      ];

      const newColumns = currentColumns.includes(columnKey)
        ? currentColumns.filter((col) => col !== columnKey)
        : [...currentColumns, columnKey];

      updateConfig({ columns: newColumns });
    },
    [currentConfig.columns, updateConfig],
  );


  const exportData = useCallback(
    async (format: 'csv' | 'json') => {
      try {
        if (data.length === 0) {
          showError('No data available to export');
          return;
        }

        info(
          `Preparing ${format.toUpperCase()} export for ${data.length} items...`,
        );

        // Create export data with current filters applied
        const exportableData = data.map((item) => ({
          name: item.name || 'N/A',
          path: item.path || 'N/A',
          type: item.type || 'unknown',
          driver: item.driver || 'N/A',
          compose_project: item.compose_project || 'N/A',
          compose_services: Array.isArray(item.compose_services)
            ? item.compose_services.join(', ') || 'N/A'
            : 'N/A',
          containers_count: Array.isArray(item.containers)
            ? item.containers.length
            : 0,
          readonly: item.readonly ? 'Yes' : 'No',
          status: item.status || 'unknown',
          last_seen: item.last_seen || 'N/A',
          size_bytes: typeof item.size_bytes === 'number' ? item.size_bytes : 0,
          size_formatted: formatBytes(item.size_bytes),
          growth_rate:
            typeof item.growth_rate === 'number'
              ? `${(item.growth_rate * 100).toFixed(1)}%`
              : 'N/A',
          created_at: item.created_at || 'N/A',
          source_type: item.source_type || 'unknown',
        }));

        let content: string;
        let mimeType: string;
        let filename: string;

        if (format === 'csv') {
          // Generate CSV
          const headers = Object.keys(exportableData[0] || {});
          const csvContent = [
            headers.join(','),
            ...exportableData.map((row) =>
              headers
                .map((header) => {
                  const value = row[header as keyof typeof row];
                  // Escape commas and quotes
                  const stringValue = String(value || '');
                  return stringValue.includes(',') || stringValue.includes('"')
                    ? `"${stringValue.replace(/"/g, '""')}"`
                    : stringValue;
                })
                .join(','),
            ),
          ].join('\n');

          content = csvContent;
          mimeType = 'text/csv';
          filename = `volumes-and-mounts-${new Date().toISOString().split('T')[0]}.csv`;
        } else {
          // Generate JSON
          content = JSON.stringify(
            {
              exported_at: new Date().toISOString(),
              total_items: exportableData.length,
              filters_applied: currentConfig.filters,
              search_query: searchQuery,
              data: exportableData,
            },
            null,
            2,
          );

          mimeType = 'application/json';
          filename = `volumes-and-mounts-${new Date().toISOString().split('T')[0]}.json`;
        }

        // Create and trigger download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        success(
          `Successfully exported ${data.length} items as ${format.toUpperCase()}`,
        );
      } catch (exportError) {
        console.error('Failed to export data:', exportError);
        showError(
          `Failed to export data as ${format.toUpperCase()}. Please try again.`,
        );
      }
    },
    [
      data,
      currentConfig.filters,
      searchQuery,
      info,
      showError,
      success,
    ],
  );

  const handleSelectAll = useCallback(() => {
    const pageItems = data;
    const allPageSelected = pageItems.every((item) => selectedIds.has(item.id));

    if (allPageSelected) {
      // Deselect all items on current page
      setSelectedIds((current) => {
        const newSet = new Set(current);
        pageItems.forEach((item) => newSet.delete(item.id));
        return newSet;
      });
      setSelectAllMode('none');
      setShowSelectDropdown(false);
    } else {
      // Select all items on current page
      setSelectedIds((current) => {
        const newSet = new Set(current);
        pageItems.forEach((item) => newSet.add(item.id));
        return newSet;
      });
      setSelectAllMode('page');
      // Show dropdown if there are more items on other pages
      if (paginationMeta.total > data.length) {
        setShowSelectDropdown(true);
      }
    }
  }, [data, selectedIds, paginationMeta.total]);

  const handleSelectAllPages = useCallback(() => {
    // For now, we'll simulate selecting all by setting the mode
    // In a real implementation, you'd fetch all item IDs or work with the API
    setSelectAllMode('all');
    setShowSelectDropdown(false);
    // Keep current page items selected and indicate "all mode"
    setSelectedIds((current) => {
      const newSet = new Set(current);
      data.forEach((item) => newSet.add(item.id));
      return newSet;
    });
  }, [data]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllMode('none');
    setShowSelectDropdown(false);
  }, []);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedIds((current) => {
      const newSet = new Set(current);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    // Reset mode when individual items are selected/deselected
    setSelectAllMode('none');
    setShowSelectDropdown(false);
  }, []);

  const handleDiscovery = useCallback(async () => {
    try {
      info('Starting discovery of new volumes and mounts...');
      await triggerDiscovery();
      success('Discovery completed! New volumes and mounts have been scanned.');
      await fetchData(); // Refresh data to show new discoveries
    } catch (discoveryError) {
      console.error('Failed to trigger discovery:', discoveryError);
      showError('Failed to trigger discovery. Please try again.');
    }
  }, [triggerDiscovery, fetchData, info, success, showError]);

  const executeBulkAction = useCallback(
    async (action: BulkAction) => {
      if (selectedIds.size === 0) return;

      const itemCount =
        selectAllMode === 'all' ? paginationMeta.total : selectedIds.size;
      const itemText = itemCount === 1 ? 'item' : 'items';

      try {
        showLoading(`${action.label} ${itemCount} ${itemText}...`);
        await action.action(Array.from(selectedIds));
        setSelectedIds(new Set());
        setSelectAllMode('none');
        setShowSelectDropdown(false);
        await fetchData(); // Refresh data
        success(
          `Successfully ${action.label.toLowerCase()}ed ${itemCount} ${itemText}`,
        );
      } catch (actionError) {
        console.error(`Failed to execute ${action.label}:`, actionError);
        showError(
          `Failed to ${action.label.toLowerCase()} ${itemCount} ${itemText}. Please try again.`,
        );
      }
    },
    [
      selectedIds,
      selectAllMode,
      paginationMeta.total,
      showLoading,
      success,
      showError,
      fetchData,
    ],
  );

  // Helper functions for keyboard shortcuts
  const focusSearchInput = useCallback(() => {
    const searchInput = document.querySelector(
      'input[placeholder*="Search"]',
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }, []);

  const handleSelectAllPage = useCallback(() => {
    setSelectAllMode('page');
    handleSelectAll();
  }, [handleSelectAll, setSelectAllMode]);

  const handleSelectAllAcrossPages = useCallback(() => {
    setSelectAllMode('all');
    handleSelectAll();
  }, [handleSelectAll, setSelectAllMode]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setShowColumnConfig(false);
    setShowFilters(false);
    setShowKeyboardHelp(false);
  }, [setSelectedIds]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      bulkHide(Array.from(selectedIds));
    }
  }, [selectedIds, bulkHide]);

  const handleOpenVolumeDetails = useCallback((volumeName: string) => {
    setSelectedVolumeForDetails(volumeName);
    setShowVolumeDetailsModal(true);
  }, []);

  const handleCloseVolumeDetails = useCallback(() => {
    setShowVolumeDetailsModal(false);
    setSelectedVolumeForDetails('');
  }, []);

  const handleToggleQuickFilter = useCallback((filterId: string) => {
    const filter = getQuickFilterById(filterId);
    if (!filter) return;

    // Check if filter is currently active
    const isActive = isQuickFilterActive(filter.filterType as any, filter.filterValue);
    
    if (isActive) {
      clearQuickFilter(filter.filterType as any);
    } else {
      applyQuickFilter(filter);
    }
  }, [isQuickFilterActive, clearQuickFilter, applyQuickFilter]);

  const handleRefresh = useCallback(() => {
    fetchData({});
  }, [fetchData]);

  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    success('Export functionality coming soon!');
  }, [success]);

  const handleOpenColumnSettings = useCallback(() => {
    setShowColumnConfig(true);
  }, []);

  const handleShowHelp = useCallback(() => {
    setShowKeyboardHelp(true);
  }, []);

  // Create keyboard shortcut groups
  const keyboardShortcutGroups = useMemo(() => {
    return createVolumeListShortcuts({
      selectAll: handleSelectAllPage,
      selectAllAcrossPages: handleSelectAllAcrossPages,
      focusSearch: focusSearchInput,
      clearSelection: handleClearSelection,
      refresh: handleRefresh,
      deleteSelected: handleDeleteSelected,
      toggleQuickFilter: handleToggleQuickFilter,
      export: handleExport,
      openColumnSettings: handleOpenColumnSettings,
      showHelp: handleShowHelp,
    });
  }, [
    handleSelectAllPage,
    handleSelectAllAcrossPages,
    focusSearchInput,
    handleClearSelection,
    handleRefresh,
    handleDeleteSelected,
    handleToggleQuickFilter,
    handleExport,
    handleOpenColumnSettings,
    handleShowHelp,
  ]);

  // Get all shortcuts as flat array for the hook
  const allShortcuts = useMemo(() => {
    return keyboardShortcutGroups.flatMap(group => group.shortcuts);
  }, [keyboardShortcutGroups]);

  // Use the reusable keyboard shortcuts hook
  useKeyboardShortcuts(allShortcuts, true);

  // Close select dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSelectDropdown) {
        const target = event.target as Element;
        if (!target.closest('[data-select-dropdown]')) {
          setShowSelectDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSelectDropdown]);

  // Show error toasts when errors occur
  useEffect(() => {
    if (error) {
      showError(`Failed to load data: ${error}`);
    }
  }, [error, showError]);

  // Calculate max size for visualization
  const maxSize = useMemo(() => {
    return Math.max(...data.map((item) => item.size_bytes || 0), 1);
  }, [data]);

  // Get size color based on filesystem capacity percentage when available, otherwise relative to max volume
  const getSizeColor = useCallback(
    (sizeBytes: number, maxSize: number, filesystemCapacity?: any): string => {
      let percentage: number;
      
      if (filesystemCapacity?.total_bytes) {
        // Use filesystem capacity for accurate percentage
        percentage = (sizeBytes / filesystemCapacity.total_bytes) * 100;
      } else {
        // Fallback to relative size among volumes
        percentage = (sizeBytes / maxSize) * 100;
      }
      
      if (percentage >= 80) return 'bg-red-500';
      if (percentage >= 60) return 'bg-yellow-500';
      if (percentage >= 40) return 'bg-blue-500';
      return 'bg-green-500';
    },
    [],
  );

  // Get growth trend indicator
  const getGrowthIndicator = useCallback((growthRate?: number) => {
    if (typeof growthRate !== 'number') return null;

    const percentage = growthRate * 100;
    if (percentage > 10) {
      return {
        icon: 'TrendingUp',
        color: 'text-red-500',
        label: 'Growing fast',
        value: `+${percentage.toFixed(1)}%`,
      };
    }
    if (percentage > 5) {
      return {
        icon: 'TrendingUp',
        color: 'text-yellow-500',
        label: 'Moderate growth',
        value: `+${percentage.toFixed(1)}%`,
      };
    }
    if (percentage > 0) {
      return {
        icon: 'TrendingUp',
        color: 'text-green-500',
        label: 'Stable growth',
        value: `+${percentage.toFixed(1)}%`,
      };
    }
    if (percentage < 0) {
      return {
        icon: 'TrendingDown',
        color: 'text-blue-500',
        label: 'Shrinking',
        value: `${percentage.toFixed(1)}%`,
      };
    }
    return {
      icon: 'Minus',
      color: 'text-gray-400',
      label: 'No change',
      value: '0%',
    };
  }, []);


  // Format relative time
  const formatRelativeTime = useCallback((date?: string): string => {
    if (!date) return 'Never';

    const now = Date.now();
    const dateTime = new Date(date).getTime();
    const diffMinutes = Math.floor((now - dateTime) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
    if (diffMinutes < 10080)
      return `${Math.floor(diffMinutes / 1440)} days ago`;
    return `${Math.floor(diffMinutes / 10080)} weeks ago`;
  }, []);

  // Format helpers continued

  const formatDate = useCallback((date: string): string => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (dateError) {
      console.warn('Invalid date format:', date, dateError);
      return 'Invalid date';
    }
  }, []);

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

  const getTypeIcon = (type: VolumeMount['type']) => {
    switch (type) {
      case 'volume':
        return Database;
      case 'bind':
        return Folder;
      case 'tmpfs':
        return HardDrive;
      default:
        return HardDrive;
    }
  };

  // Pagination
  const paginatedData = useMemo(() => {
    // Since we're using server-side pagination, data is already paginated
    return data;
  }, [data]);

  const totalPages = Math.ceil(paginationMeta.total / paginationMeta.pageSize);

  // Page navigation handlers
  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = {
        page: newPage,
        page_size: paginationMeta.pageSize,
        sort:
          sortConfig.length > 0
            ? `${sortConfig[0].field}:${sortConfig[0].direction}`
            : undefined,
        q: searchQuery || undefined,

        // Map filter config to API parameters
        driver: currentConfig.filters?.driver as any,
        orphaned:
          currentConfig.filters?.status === 'orphaned' ? true : undefined,
        type: currentConfig.filters?.type as any,
        compose_project: currentConfig.filters?.project,
        is_tracked:
          currentConfig.filters?.status === 'tracked'
            ? true
            : currentConfig.filters?.status === 'untracked'
              ? false
              : undefined,
      };

      fetchData(params);
    },
    [
      fetchData,
      paginationMeta.pageSize,
      sortConfig,
      searchQuery,
      currentConfig.filters,
    ],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Volumes & Mounts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your Docker volumes and mount points
          </p>
          {/* Keyboard shortcuts help */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span className="hidden lg:inline">
              Shortcuts: Ctrl+A (select all), Ctrl+F (search), Del (delete),
              Ctrl+R (refresh), Ctrl+1-3 (quick filters)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchData({})}
            disabled={loading}
            aria-label="Refresh volumes and mounts data"
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', loading && 'animate-spin')}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleDiscovery}
            disabled={loading}
            aria-label="Discover new volumes and mounts"
          >
            <Database className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Discover</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button aria-label="Add new volume">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            <span className="hidden sm:inline">Add Volume</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search volumes and mounts..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'table'
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                  onClick={() => setViewMode('table')}
                  aria-label="Table view"
                  title="Table view (compact)"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    viewMode === 'cards'
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                  onClick={() => setViewMode('cards')}
                  aria-label="Card view"
                  title="Card view (detailed)"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                aria-label="Share current view"
              >
                <Share className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Share View</span>
              </Button>

              {/* Column Configuration */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColumnConfig(!showColumnConfig)}
                  aria-label="Configure column visibility"
                  aria-expanded={showColumnConfig}
                >
                  <Columns className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Columns</span>
                </Button>

                {showColumnConfig && (
                  <Card
                    className="absolute top-full mt-1 right-0 z-50 w-64"
                    role="dialog"
                    aria-label="Column visibility configuration"
                  >
                    <div className="p-3 border-b">
                      <h3
                        className="font-medium text-gray-900 dark:text-white text-sm"
                        id="column-config-title"
                      >
                        Column Visibility
                      </h3>
                    </div>
                    <div
                      className="p-2 space-y-2 max-h-64 overflow-y-auto"
                      role="group"
                      aria-labelledby="column-config-title"
                    >
                      {availableColumns.map((column) => (
                        <label
                          key={column.key}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                        >
                          <Checkbox
                            checked={visibleColumns.has(column.key)}
                            onChange={() => toggleColumn(column.key)}
                            aria-describedby={`column-${column.key}-desc`}
                          />
                          <span
                            className="text-sm text-gray-700 dark:text-gray-300 flex-1"
                            id={`column-${column.key}-desc`}
                          >
                            {column.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="p-3 border-t">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {visibleColumns.size} of {availableColumns.length}{' '}
                          visible
                        </span>
                        <button
                          onClick={() => {
                            const allColumns = availableColumns.map(
                              (col) => col.key,
                            );
                            updateConfig({ columns: allColumns });
                          }}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          aria-label="Show all columns"
                        >
                          Show All
                        </button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Export/Download */}
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Export data options"
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="h-3 w-3 ml-1" aria-hidden="true" />
                </Button>

                {/* Export dropdown */}
                <div className="absolute top-full mt-1 right-0 z-50 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="py-1">
                    <button
                      onClick={() => exportData('csv')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download className="h-3 w-3" />
                      Export as CSV
                    </button>
                    <button
                      onClick={() => exportData('json')}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download className="h-3 w-3" />
                      Export as JSON
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      Exports {data.length} items
                      {(searchQuery ||
                        Object.keys(currentConfig.filters || {}).length > 0) &&
                        ' (filtered)'}
                    </div>
                  </div>
                </div>
              </div>

              <FilterViewsManager
                savedViews={savedViews}
                isModified={isModified}
                onSaveView={saveView}
                onUpdateView={updateView}
                onDeleteView={deleteView}
                onLoadView={loadView}
                onCopyShareableUrl={copyShareableUrl}
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Filters:
            </span>
            {quickFilters.map((filter) => {
              const isActive = isQuickFilterActive(
                filter.filterType,
                filter.filterValue,
              );
              return (
                <Button
                  key={filter.id}
                  variant={isActive ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (isActive) {
                      clearQuickFilter(filter.filterType);
                    } else {
                      applyQuickFilter(filter);
                    }
                  }}
                  className={cn(
                    'h-8 text-xs transition-all duration-200',
                    isActive && 'shadow-sm',
                  )}
                  title={filter.description}
                  aria-label={`${isActive ? 'Remove' : 'Apply'} ${filter.label} filter`}
                >
                  <filter.icon className="h-3 w-3 mr-1.5" aria-hidden="true" />
                  {filter.label}
                </Button>
              );
            })}

            {/* Clear all quick filters button */}
            {Object.keys(currentConfig.filters || {}).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 px-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Clear all filters"
              >
                <X className="h-3 w-3 mr-1" aria-hidden="true" />
                Clear All
              </Button>
            )}
          </div>

          {/* Active Filter Chips */}
          {filterChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 self-center">
                Active Filters:
              </span>
              {filterChips.map((chip) => (
                <Badge
                  key={chip.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1 text-xs text-gray-800 dark:text-gray-300"
                >
                  {chip.label}
                  {chip.removable && (
                    <button
                      onClick={() => removeFilterChip(chip.id)}
                      className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5 ml-1"
                      aria-label={`Remove ${chip.label} filter`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
          )}

          {/* Expanded Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterChip('type', e.target.value);
                    }
                  }}
                  value=""
                >
                  <option value="">All Types</option>
                  <option value="volume">Volume</option>
                  <option value="bind">Bind Mount</option>
                  <option value="tmpfs">Tmpfs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Status</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterChip('status', e.target.value);
                    }
                  }}
                  value=""
                >
                  <option value="">All Status</option>
                  <option value="tracked">Tracked</option>
                  <option value="untracked">Untracked</option>
                  <option value="orphaned">Orphaned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">
                  Project
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterChip('project', e.target.value);
                    }
                  }}
                  value=""
                >
                  <option value="">All Projects</option>
                  <option value="webapp">webapp</option>
                  <option value="dev-env">dev-env</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Driver</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterChip('driver', e.target.value);
                    }
                  }}
                  value=""
                >
                  <option value="">All Drivers</option>
                  <option value="local">Local</option>
                  <option value="nfs">NFS</option>
                  <option value="cifs">CIFS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Access</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilterChip('readonly', e.target.value);
                    }
                  }}
                  value=""
                >
                  <option value="">All Access</option>
                  <option value="false">Read/Write</option>
                  <option value="true">Read Only</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectAllMode === 'all'
                  ? `All ${paginationMeta.total} items selected`
                  : `${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} selected${selectAllMode === 'page' ? ' (page only)' : ''}`}
              </span>
              <div className="flex items-center gap-2">
                {bulkActions.map((action) => (
                  <Button
                    key={action.id}
                    variant={
                      action.variant === 'destructive'
                        ? 'destructive'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => executeBulkAction(action)}
                  >
                    <action.icon className="h-4 w-4 mr-2" />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear Selection
            </Button>
          </div>
        </Card>
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
            <Button onClick={() => fetchData({})}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      ) : loading ? (
        // Loading State with Skeletons
        <Card className="overflow-hidden">
          <VolumeListSkeleton rows={paginationMeta.pageSize || 25} />
        </Card>
      ) : data.length === 0 ? (
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
          {/* Card View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {paginatedData.map((item) => {
              const TypeIcon = getTypeIcon(item.type);
              return (
                <Card
                  key={item.id}
                  className="p-4 hover:shadow-md transition-shadow"
                  role="article"
                  aria-label={`Volume ${item.name}`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => handleSelectItem(item.id)}
                        />
                        <TypeIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {item.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                            {item.path}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-shrink-0 cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                        onClick={() => handleOpenVolumeDetails(item.name)}
                        aria-label={`View details for ${item.name}`}
                      >
                        <Eye
                          className="h-4 w-4 transition-transform hover:scale-110"
                          aria-hidden="true"
                        />
                      </Button>
                    </div>

                    {/* Status and Type */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      <Badge
                        className={`text-xs ${getStatusColor(item.status)}`}
                      >
                        {item.status}
                      </Badge>
                      {item.readonly && (
                        <Badge variant="secondary" className="text-xs">
                          RO
                        </Badge>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {item.compose_project && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-gray-400">
                            Project:
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {item.compose_project}
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Containers:
                        </span>
                        <ContainerBadge 
                          count={item.containers?.length || 0}
                          active={item.containers && item.containers.length > 0}
                        />
                      </div>

                      {item.size_bytes && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 dark:text-gray-400">
                              Size:
                            </span>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatBytes(item.size_bytes)}
                              </div>
                              {(() => {
                                const percentageData = calculateVolumePercentage(
                                  item.size_bytes || 0,
                                  item.filesystem_capacity,
                                  maxSize,
                                );
                                if (percentageData.capacityInfo) {
                                  return (
                                    <>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Total: {formatBytes(percentageData.capacityInfo.totalBytes)}
                                      </div>
                                      <div className="text-xs text-gray-600 dark:text-gray-300">
                                        {percentageData.capacityInfo.usagePercent.toFixed(1)}% of capacity
                                      </div>
                                    </>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                          
                          {/* Visual progress bar */}
                          <SizeVisualization
                            sizeBytes={item.size_bytes || 0}
                            maxSizeBytes={item.filesystem_capacity?.total_bytes || maxSize}
                            showPercentage={false}
                            showLabel={false}
                            compact={false}
                          />
                          
                          {/* Growth indicator */}
                          {item.growth_rate && (
                            <GrowthIndicator
                              growthRate={item.growth_rate}
                              showLabel={true}
                              compact={false}
                            />
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">
                          Size scan:
                        </span>
                        <FreshnessIndicator
                          lastSeen={item.last_seen}
                          compact={true}
                          showIcon={true}
                          showLabel={false}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination for Card View */}
          {totalPages > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing{' '}
                  {(paginationMeta.page - 1) * paginationMeta.pageSize + 1} to{' '}
                  {Math.min(
                    paginationMeta.page * paginationMeta.pageSize,
                    paginationMeta.total,
                  )}{' '}
                  of {paginationMeta.total} items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginationMeta.page <= 1}
                    onClick={() => handlePageChange(paginationMeta.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={
                            pageNum === paginationMeta.page
                              ? 'primary'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginationMeta.page >= totalPages}
                    onClick={() => handlePageChange(paginationMeta.page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          {/* Data Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-3 text-left">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Checkbox
                            checked={
                              paginatedData.length > 0 &&
                              paginatedData.every((item) =>
                                selectedIds.has(item.id),
                              )
                            }
                            indeterminate={
                              paginatedData.some((item) =>
                                selectedIds.has(item.id),
                              ) &&
                              !paginatedData.every((item) =>
                                selectedIds.has(item.id),
                              )
                            }
                            onChange={handleSelectAll}
                            aria-label="Select all items on current page"
                          />

                          {/* Enhanced selection dropdown */}
                          {showSelectDropdown &&
                            selectedIds.size > 0 &&
                            paginationMeta.total > paginatedData.length && (
                              <div
                                className="absolute top-full left-0 z-50 mt-1"
                                data-select-dropdown
                              >
                                <Card className="p-2 shadow-lg border">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                    {selectAllMode === 'all' ? (
                                      <span className="font-medium text-blue-600 dark:text-blue-400">
                                        All {paginationMeta.total} items
                                        selected
                                      </span>
                                    ) : (
                                      <>
                                        {selectedIds.size} of{' '}
                                        {paginatedData.length} selected on this
                                        page
                                      </>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {selectAllMode !== 'all' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs h-7 text-blue-600 dark:text-blue-400"
                                        onClick={handleSelectAllPages}
                                      >
                                        Select all {paginationMeta.total} items
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-xs h-7"
                                      onClick={clearSelection}
                                    >
                                      Clear selection
                                    </Button>
                                  </div>
                                </Card>
                              </div>
                            )}
                        </div>

                        {selectedIds.size > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {selectAllMode === 'all' ? (
                                <>All {paginationMeta.total} items selected</>
                              ) : (
                                <>
                                  {selectedIds.size} selected
                                  {selectAllMode === 'page' && ' (page only)'}
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </th>
                    {availableColumns
                      .filter((col) => visibleColumns.has(col.key))
                      .map((column) => (
                        <th
                          key={column.key}
                          className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {column.sortable ? (
                            <button
                              onClick={() => handleSort(column.key)}
                              className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              {column.label}
                              {sortConfig.find(
                                (s) => s.field === column.key,
                              ) && (
                                <div className="flex flex-col">
                                  <ChevronUp
                                    className={cn(
                                      'h-3 w-3',
                                      sortConfig.find(
                                        (s) => s.field === column.key,
                                      )?.direction === 'asc'
                                        ? 'text-blue-600'
                                        : 'text-gray-400',
                                    )}
                                  />
                                  <ChevronDown
                                    className={cn(
                                      'h-3 w-3 -mt-1',
                                      sortConfig.find(
                                        (s) => s.field === column.key,
                                      )?.direction === 'desc'
                                        ? 'text-blue-600'
                                        : 'text-gray-400',
                                    )}
                                  />
                                </div>
                              )}
                            </button>
                          ) : (
                            column.label
                          )}
                        </th>
                      ))}
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((item) => {
                    const TypeIcon = getTypeIcon(item.type);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="p-3">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onChange={() => handleSelectItem(item.id)}
                          />
                        </td>

                        {visibleColumns.has('name') && (
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <TypeIcon className="h-5 w-5 text-gray-500" />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {item.name}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                  {item.path.length > 50
                                    ? `${item.path.substring(0, 50)}...`
                                    : item.path}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}

                        {visibleColumns.has('type') && (
                          <td className="p-3">
                            <Badge variant="outline">{item.type}</Badge>
                          </td>
                        )}

                        {visibleColumns.has('compose_project') && (
                          <td className="p-3">
                            {item.compose_project && (
                              <Badge variant="secondary">
                                {item.compose_project}
                              </Badge>
                            )}
                          </td>
                        )}

                        {visibleColumns.has('containers') && (
                          <td className="p-3">
                            <ContainerStatus
                              containers={item.containers || []}
                              showDetails={true}
                              showCount={true}
                              compact={false}
                            />
                          </td>
                        )}

                        {visibleColumns.has('status') && (
                          <td className="p-3">
                            <Badge className={getStatusColor(item.status)}>
                              {item.status}
                            </Badge>
                          </td>
                        )}

                        {visibleColumns.has('size_bytes') && (
                          <td className="p-3">
                            <div className="space-y-2">
                              {/* Size with filesystem capacity */}
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatBytes(item.size_bytes)}
                                </div>
                                {(() => {
                                  const percentageData = calculateVolumePercentage(
                                    item.size_bytes || 0,
                                    item.filesystem_capacity,
                                    maxSize,
                                  );
                                  if (percentageData.capacityInfo) {
                                    return (
                                      <>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          Total capacity: {formatBytes(percentageData.capacityInfo.totalBytes)}
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-300">
                                          {percentageData.capacityInfo.usagePercent.toFixed(1)}% of capacity
                                        </div>
                                      </>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              
                              {/* Visual progress bar */}
                              <SizeVisualization
                                sizeBytes={item.size_bytes || 0}
                                maxSizeBytes={item.filesystem_capacity?.total_bytes || maxSize}
                                showPercentage={false}
                                showLabel={false}
                                compact={false}
                              />
                              
                              {/* Growth indicator */}
                              <GrowthIndicator
                                growthRate={item.growth_rate}
                                showLabel={false}
                                compact={true}
                              />
                            </div>
                          </td>
                        )}

                        {visibleColumns.has('last_seen') && (
                          <td className="p-3">
                            <FreshnessIndicator
                              lastSeen={item.last_seen}
                              compact={false}
                              showIcon={true}
                              showLabel={true}
                            />
                          </td>
                        )}

                        <td className="p-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                            onClick={() => handleOpenVolumeDetails(item.name)}
                            aria-label={`View details for ${item.name}`}
                          >
                            <Eye className="h-4 w-4 transition-transform hover:scale-110" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing{' '}
                  {(paginationMeta.page - 1) * paginationMeta.pageSize + 1} to{' '}
                  {Math.min(
                    paginationMeta.page * paginationMeta.pageSize,
                    paginationMeta.total,
                  )}{' '}
                  of {paginationMeta.total} items
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginationMeta.page <= 1}
                    onClick={() => handlePageChange(paginationMeta.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <Button
                          key={pageNum}
                          variant={
                            pageNum === paginationMeta.page
                              ? 'primary'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-10"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginationMeta.page >= totalPages}
                    onClick={() => handlePageChange(paginationMeta.page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Click outside to close dropdowns */}
      {showColumnConfig && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColumnConfig(false)}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        shortcutGroups={keyboardShortcutGroups}
        title="VolumesList Keyboard Shortcuts"
      />

      {/* Volume Details Modal */}
      <VolumeDetailsModal
        isOpen={showVolumeDetailsModal}
        onClose={handleCloseVolumeDetails}
        volumeName={selectedVolumeForDetails}
      />
    </div>
  );
};

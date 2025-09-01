import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Folder,
  File,
  Grid3x3,
  List,
  TreePine,
  Columns,
  Search,
  SortAsc,
  SortDesc,
  ChevronRight,
  ChevronDown,
  Star,
  Download,
  Trash2,
  Edit,
  Copy,
  Move,
  Eye,
  RefreshCw,
  Upload,
  FolderPlus,
  MoreHorizontal,
  Home,
  Image,
  FileText,
  Video,
  Music,
  Archive,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';

import { ProgressBar } from '../../ui/ProgressBar';
import { StatusBadge } from '../../ui/StatusBadge';

import type {
  VolumeExplorerPanelProps,
  VolumeExplorerPanelState,
  VolumeExplorerPanelRef,
  ExplorerItem,
  ExplorerViewMode,
  ExplorerSortBy,
  ExplorerSortOrder,
  ExplorerSelection,
  ExplorerFilter,
  BreadcrumbItem,
  ExplorerContextAction,
} from './VolumeExplorerPanel.types';
import { explorerUtils } from '@/utils';

/**
 * VolumeExplorerPanel - Comprehensive file browser with preview integration
 *
 * A sophisticated domain composition that combines file browsing, preview,
 * search, filtering, and management capabilities in a unified interface.
 */
export const VolumeExplorerPanel = forwardRef<
  VolumeExplorerPanelRef,
  VolumeExplorerPanelProps
>(
  (
    {
      volumeId,
      currentPath = '/',
      items = [],
      isLoading = false,
      isLoadingMore = false,
      error,
      totalItems,
      viewMode = 'grid',
      sortBy = 'name',
      sortOrder = 'asc',
      filter = {},
      selection,
      multiSelect = true,
      enableDragDrop = true,
      enableContextMenu = true,
      contextActions = [],
      preview = { enabled: true, mode: 'inline' },
      showBreadcrumb = true,
      breadcrumb,
      showToolbar = true,
      showStatusBar = true,
      showSidebar = false,
      sidebarContent,
      toolbarActions,
      enableSearch = true,
      searchPlaceholder = 'Search files and folders...',
      gridConfig = {
        itemWidth: 160,
        itemHeight: 140,
        gap: 16,
        columns: 'auto',
      },
      listConfig = {
        rowHeight: 40,
        showIcons: true,
        showSize: true,
        showModified: true,
        showType: true,
      },
      treeConfig = {
        indentSize: 24,
        showLines: true,
        expandOnClick: true,
        loadChildrenOnExpand: true,
      },
      virtualScroll = false,
      pageSize = 100,
      currentPage = 1,
      onItemClick,
      onItemDoubleClick,
      onItemContextMenu,
      onSelectionChange,
      onPathChange,
      onViewModeChange,
      onSortChange,
      onFilterChange,
      onSearch,
      onLoadMore,
      onPageChange,
      onItemExpand,
      onItemCollapse,
      onDragStart,
      onDragEnd,
      onDrop,
      onPreview,
      onDownload,
      onDelete,
      onRename,
      onCreateFolder,
      onUpload,
      onRefresh,
      emptyState,
      loadingState,
      errorState,
      renderItem,
      className,
      testId = 'volume-explorer-panel',
    },
    ref,
  ) => {
    // Component state
    const [state, setState] = useState<VolumeExplorerPanelState>({
      viewMode,
      sortBy,
      sortOrder,
      filter,
      selection: selection || {
        items: new Set(),
        mode: multiSelect ? 'multiple' : 'single',
      },
      expandedItems: new Set(),
      searchQuery: filter.query || '',
    });

    // Use props directly instead of syncing to state to avoid infinite loops

    // Filter and sort items
    const processedItems = useMemo(() => {
      let filtered = items.filter((item) =>
        explorerUtils.matchesFilter(item, filter),
      );
      filtered = explorerUtils.sortItems(filtered, sortBy, sortOrder);
      return filtered;
    }, [items, filter, sortBy, sortOrder]);

    // Build breadcrumb
    const breadcrumbItems = useMemo(() => {
      return breadcrumb || explorerUtils.buildBreadcrumb(currentPath);
    }, [breadcrumb, currentPath]);

    // Get file type icon
    const getFileIcon = useCallback((item: ExplorerItem) => {
      if (item.type === 'folder') {
        return <Folder className="w-5 h-5 text-blue-500" />;
      }

      const ext = item.extension?.toLowerCase();
      const iconMap: Record<string, React.ReactNode> = {
        jpg: <Image className="w-5 h-5 text-green-500" />,
        jpeg: <Image className="w-5 h-5 text-green-500" />,
        png: <Image className="w-5 h-5 text-green-500" />,
        gif: <Image className="w-5 h-5 text-green-500" />,
        svg: <Image className="w-5 h-5 text-green-500" />,
        pdf: <FileText className="w-5 h-5 text-red-500" />,
        doc: <FileText className="w-5 h-5 text-blue-500" />,
        docx: <FileText className="w-5 h-5 text-blue-500" />,
        txt: <FileText className="w-5 h-5 text-gray-500" />,
        md: <FileText className="w-5 h-5 text-gray-500" />,
        mp4: <Video className="w-5 h-5 text-purple-500" />,
        avi: <Video className="w-5 h-5 text-purple-500" />,
        mov: <Video className="w-5 h-5 text-purple-500" />,
        mp3: <Music className="w-5 h-5 text-orange-500" />,
        wav: <Music className="w-5 h-5 text-orange-500" />,
        zip: <Archive className="w-5 h-5 text-yellow-500" />,
        rar: <Archive className="w-5 h-5 text-yellow-500" />,
        tar: <Archive className="w-5 h-5 text-yellow-500" />,
      };

      return iconMap[ext || ''] || <File className="w-5 h-5 text-gray-500" />;
    }, []);

    // Event handlers
    const handleItemClick = useCallback(
      (item: ExplorerItem, event: React.MouseEvent) => {
        if (multiSelect && (event.ctrlKey || event.metaKey)) {
          // Toggle selection
          setState((prev) => {
            const newSelection = new Set(prev.selection.items);
            if (newSelection.has(item.id)) {
              newSelection.delete(item.id);
            } else {
              newSelection.add(item.id);
            }
            const updatedSelection = {
              ...prev.selection,
              items: newSelection,
              lastSelected: item.id,
            };
            onSelectionChange?.(updatedSelection);
            return {
              ...prev,
              selection: updatedSelection,
              focusedItem: item.id,
            };
          });
        } else if (
          multiSelect &&
          event.shiftKey &&
          state.selection.lastSelected
        ) {
          // Range selection
          const startIndex = processedItems.findIndex(
            (i) => i.id === state.selection.lastSelected,
          );
          const endIndex = processedItems.findIndex((i) => i.id === item.id);
          if (startIndex !== -1 && endIndex !== -1) {
            const range = processedItems.slice(
              Math.min(startIndex, endIndex),
              Math.max(startIndex, endIndex) + 1,
            );
            setState((prev) => {
              const newSelection = new Set(prev.selection.items);
              range.forEach((rangeItem) => newSelection.add(rangeItem.id));
              const updatedSelection = {
                ...prev.selection,
                items: newSelection,
                rangeStart: state.selection.lastSelected,
              };
              onSelectionChange?.(updatedSelection);
              return {
                ...prev,
                selection: updatedSelection,
                focusedItem: item.id,
              };
            });
          }
        } else {
          // Single selection
          setState((prev) => {
            const updatedSelection = {
              ...prev.selection,
              items: new Set([item.id]),
              lastSelected: item.id,
            };
            onSelectionChange?.(updatedSelection);
            return {
              ...prev,
              selection: updatedSelection,
              focusedItem: item.id,
            };
          });
        }

        onItemClick?.(item, event);
      },
      [
        multiSelect,
        processedItems,
        state.selection.lastSelected,
        onSelectionChange,
        onItemClick,
      ],
    );

    const handleItemDoubleClick = useCallback(
      (item: ExplorerItem) => {
        if (item.type === 'folder') {
          onPathChange?.(item.path);
        } else {
          onPreview?.(item);
        }
        onItemDoubleClick?.(item);
      },
      [onPathChange, onPreview, onItemDoubleClick],
    );

    const handleSearch = useCallback(
      (query: string) => {
        setState((prev) => ({
          ...prev,
          searchQuery: query,
          filter: { ...prev.filter, query },
        }));
        onSearch?.(query);
        onFilterChange?.({ ...filter, query });
      },
      [onSearch, onFilterChange, filter],
    );

    const handleViewModeChange = useCallback(
      (mode: ExplorerViewMode) => {
        setState((prev) => ({ ...prev, viewMode: mode }));
        onViewModeChange?.(mode);
      },
      [onViewModeChange],
    );

    const handleSortChange = useCallback(
      (newSortBy: ExplorerSortBy) => {
        setState((prev) => {
          const newSortOrder =
            prev.sortBy === newSortBy && prev.sortOrder === 'asc'
              ? 'desc'
              : 'asc';
          onSortChange?.(newSortBy, newSortOrder);
          return {
            ...prev,
            sortBy: newSortBy,
            sortOrder: newSortOrder,
          };
        });
      },
      [onSortChange],
    );

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        selectItems: (itemIds: string[]) => {
          setState((prev) => ({
            ...prev,
            selection: {
              ...prev.selection,
              items: new Set(itemIds),
              lastSelected: itemIds[itemIds.length - 1],
            },
          }));
        },
        clearSelection: () => {
          setState((prev) => ({
            ...prev,
            selection: { ...prev.selection, items: new Set() },
          }));
        },
        focusItem: (itemId: string) => {
          setState((prev) => ({ ...prev, focusedItem: itemId }));
        },
        expandFolder: (itemId: string) => {
          setState((prev) => ({
            ...prev,
            expandedItems: new Set([...prev.expandedItems, itemId]),
          }));
        },
        collapseFolder: (itemId: string) => {
          setState((prev) => {
            const newExpanded = new Set(prev.expandedItems);
            newExpanded.delete(itemId);
            return { ...prev, expandedItems: newExpanded };
          });
        },
        toggleFolder: (itemId: string) => {
          setState((prev) => {
            const newExpanded = new Set(prev.expandedItems);
            if (newExpanded.has(itemId)) {
              newExpanded.delete(itemId);
            } else {
              newExpanded.add(itemId);
            }
            return { ...prev, expandedItems: newExpanded };
          });
        },
        navigateTo: (path: string) => {
          onPathChange?.(path);
        },
        goBack: () => {
          // Implementation would handle history navigation
        },
        goForward: () => {
          // Implementation would handle history navigation
        },
        refresh: () => {
          onRefresh?.();
        },
        openPreview: (itemId: string) => {
          const item = items.find((i) => i.id === itemId);
          if (item) {
            setState((prev) => ({ ...prev, previewItem: item }));
            onPreview?.(item);
          }
        },
        closePreview: () => {
          setState((prev) => ({ ...prev, previewItem: undefined }));
        },
        getSelectedItems: () => {
          return items.filter((item) => state.selection.items.has(item.id));
        },
        getCurrentPath: () => currentPath,
        setViewMode: (mode: ExplorerViewMode) => {
          handleViewModeChange(mode);
        },
      }),
      [
        items,
        state.selection.items,
        currentPath,
        onPathChange,
        onRefresh,
        onPreview,
        handleViewModeChange,
      ],
    );

    // Render breadcrumb
    const renderBreadcrumb = () => (
      <nav className="flex items-center space-x-1 text-sm text-gray-600">
        <Home className="w-4 h-4" />
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={item.id}>
            <ChevronRight className="w-4 h-4" />
            <button
              onClick={() => onPathChange?.(item.path)}
              className={clsx(
                'hover:text-blue-600 hover:underline',
                index === breadcrumbItems.length - 1 &&
                  'font-medium text-gray-900',
              )}
            >
              {item.label}
            </button>
          </React.Fragment>
        ))}
      </nav>
    );

    // Render toolbar
    const renderToolbar = () => (
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          {/* View mode toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={clsx(
                'p-2 rounded-md',
                viewMode === 'grid'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={clsx(
                'p-2 rounded-md',
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('tree')}
              className={clsx(
                'p-2 rounded-md',
                viewMode === 'tree'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
              title="Tree view"
            >
              <TreePine className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange('columns')}
              className={clsx(
                'p-2 rounded-md',
                viewMode === 'columns'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-gray-500 hover:text-gray-700',
              )}
              title="Column view"
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>

          {/* Sort controls */}
          <div className="flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) =>
                handleSortChange(e.target.value as ExplorerSortBy)
              }
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="type">Type</option>
              <option value="modified">Modified</option>
              <option value="created">Created</option>
            </select>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                }))
              }
              className="p-1 text-gray-500 hover:text-gray-700"
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="w-4 h-4" />
              ) : (
                <SortDesc className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onCreateFolder?.(currentPath, 'New Folder')}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = Array.from(
                    (e.target as HTMLInputElement).files || [],
                  );
                  if (files.length > 0) {
                    onUpload?.(files, currentPath);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search */}
          {enableSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={state.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
              {state.searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {toolbarActions}
        </div>
      </div>
    );

    // Render grid item
    const renderGridItem = (item: ExplorerItem) => (
      <div
        key={item.id}
        className={clsx(
          'group relative p-3 rounded-lg border-2 border-transparent cursor-pointer hover:border-blue-200 hover:bg-blue-50',
          state.selection.items.has(item.id) && 'border-blue-500 bg-blue-50',
          state.focusedItem === item.id && 'ring-2 ring-blue-500 ring-offset-1',
        )}
        style={{
          width: gridConfig?.itemWidth || 160,
          height: gridConfig?.itemHeight || 140,
        }}
        onClick={(e) => handleItemClick(item, e)}
        onDoubleClick={() => handleItemDoubleClick(item)}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className="mb-2">{getFileIcon(item)}</div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900 truncate w-full">
              {item.name}
            </div>
            {item.type === 'file' && item.size && (
              <div className="text-xs text-gray-500 mt-1">
                {explorerUtils.formatFileSize(item.size)}
              </div>
            )}
          </div>
          {item.starred && (
            <Star className="absolute top-2 right-2 w-4 h-4 text-yellow-500 fill-current" />
          )}
        </div>
      </div>
    );

    // Render list item
    const renderListItem = (item: ExplorerItem) => (
      <div
        key={item.id}
        className={clsx(
          'group flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer',
          state.selection.items.has(item.id) && 'bg-blue-50',
          state.focusedItem === item.id && 'ring-2 ring-blue-500 ring-inset',
        )}
        style={{ height: listConfig?.rowHeight || 40 }}
        onClick={(e) => handleItemClick(item, e)}
        onDoubleClick={() => handleItemDoubleClick(item)}
      >
        <div className="flex items-center min-w-0 flex-1">
          {listConfig?.showIcons && (
            <div className="mr-3">{getFileIcon(item)}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">
              {item.name}
            </div>
          </div>
          {item.starred && (
            <Star className="w-4 h-4 text-yellow-500 fill-current ml-2" />
          )}
        </div>
        {listConfig?.showSize && (
          <div className="w-20 text-sm text-gray-500 text-right">
            {item.type === 'file' && item.size
              ? explorerUtils.formatFileSize(item.size)
              : '—'}
          </div>
        )}
        {listConfig?.showType && (
          <div className="w-24 text-sm text-gray-500 text-right">
            {explorerUtils.getFileType(item)}
          </div>
        )}
        {listConfig?.showModified && (
          <div className="w-32 text-sm text-gray-500 text-right">
            {item.modifiedAt ? explorerUtils.formatDate(item.modifiedAt) : '—'}
          </div>
        )}
      </div>
    );

    // Render content based on view mode
    const renderContent = () => {
      if (isLoading && items.length === 0) {
        return (
          loadingState || (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2 text-gray-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )
        );
      }

      if (error) {
        return (
          errorState || (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="text-red-600 mb-2">Error loading files</div>
                <div className="text-sm text-gray-500">{error}</div>
                <button
                  onClick={onRefresh}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )
        );
      }

      if (processedItems.length === 0) {
        return (
          emptyState || (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-gray-500">
                <Folder className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <div className="text-lg font-medium">No items found</div>
                <div className="text-sm">
                  {state.searchQuery
                    ? 'Try adjusting your search criteria'
                    : 'This folder is empty'}
                </div>
              </div>
            </div>
          )
        );
      }

      const content = renderItem
        ? processedItems.map((item) => renderItem(item, viewMode))
        : viewMode === 'grid'
          ? processedItems.map(renderGridItem)
          : processedItems.map(renderListItem);

      if (viewMode === 'grid') {
        return (
          <div
            className="p-4 grid gap-4"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${gridConfig?.itemWidth || 160}px, 1fr))`,
              gap: gridConfig?.gap || 16,
            }}
          >
            {content}
          </div>
        );
      } else {
        return <div className="divide-y divide-gray-200">{content}</div>;
      }
    };

    // Render status bar
    const renderStatusBar = () => (
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 text-sm text-gray-500">
        <div>
          {processedItems.length} item{processedItems.length !== 1 ? 's' : ''}
          {totalItems && totalItems !== processedItems.length && (
            <span> ({totalItems} total)</span>
          )}
          {state.selection.items.size > 0 && (
            <span className="ml-2 text-blue-600">
              {state.selection.items.size} selected
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {isLoadingMore && (
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading more...</span>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <div
        className={clsx(
          'flex flex-col h-full bg-white border border-gray-200 rounded-lg overflow-hidden',
          className,
        )}
        data-testid={testId}
      >
        {/* Breadcrumb */}
        {showBreadcrumb && (
          <div className="px-4 py-3 border-b border-gray-200">
            {renderBreadcrumb()}
          </div>
        )}

        {/* Toolbar */}
        {showToolbar && renderToolbar()}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Content */}
          <div className="flex-1 overflow-auto">{renderContent()}</div>

          {/* Sidebar */}
          {showSidebar && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-auto">
              {sidebarContent}
            </div>
          )}
        </div>

        {/* Status bar */}
        {showStatusBar && renderStatusBar()}
      </div>
    );
  },
);

VolumeExplorerPanel.displayName = 'VolumeExplorerPanel';

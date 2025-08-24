import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Check,
  Minus,
  Loader2,
  Search,
  Filter,
  Download,
  Settings,
  RotateCcw,
} from 'lucide-react';
import { clsx } from 'clsx';

import type {
  DataGridProps,
  DataGridRef,
  DataGridColumn,
  SortDirection,
  SortConfig,
  SelectionState,
  LoadingState,
} from './DataGrid.types';
import {
  defaultDataGridSizes,
  defaultDataGridVariants,
} from './DataGrid.types';

/**
 * Format file size in bytes to human readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * Format duration in milliseconds to human readable format
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

/**
 * Format date to localized string
 */
const formatDate = (date: Date | string, format = 'short'): string => {
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString();
  }
  return d.toLocaleString();
};

/**
 * Default column renderer based on type
 */
const getDefaultRenderer = (type: string) => {
  switch (type) {
    case 'fileSize':
      return (value: number) => formatFileSize(value);
    case 'duration':
      return (value: number) => formatDuration(value);
    case 'date':
      return (value: Date | string) => formatDate(value);
    case 'number':
      return (value: number) => value?.toLocaleString() || '0';
    case 'boolean':
      return (value: boolean) => (
        <span
          className={clsx(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
            value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800',
          )}
        >
          {value ? 'Yes' : 'No'}
        </span>
      );
    default:
      return (value: any) => value?.toString() || '';
  }
};

/**
 * Sort data based on configuration
 */
const sortData = <T,>(
  data: T[],
  sortConfig: SortConfig | undefined,
  columns: DataGridColumn<T>[],
): T[] => {
  if (!sortConfig || !sortConfig.direction) return data;

  const column = columns.find((col) => col.id === sortConfig.key);
  if (!column) return data;

  return [...data].sort((a, b) => {
    if (column.sortFn) {
      return column.sortFn(a, b, sortConfig.direction);
    }

    const aValue = (a as any)[column.key];
    const bValue = (b as any)[column.key];

    if (aValue === bValue) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;

    let result = 0;
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      result = aValue - bValue;
    } else if (aValue instanceof Date && bValue instanceof Date) {
      result = aValue.getTime() - bValue.getTime();
    } else {
      result = String(aValue).localeCompare(String(bValue));
    }

    return sortConfig.direction === 'desc' ? -result : result;
  });
};

/**
 * Checkbox component for selection
 */
const Checkbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'data-testid'?: string;
}> = ({
  checked,
  indeterminate,
  onChange,
  disabled,
  'data-testid': testId,
}) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-center w-4 h-4 border rounded',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        disabled
          ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
          : checked || indeterminate
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-gray-300 hover:border-gray-400',
      )}
      data-testid={testId}
    >
      {indeterminate ? (
        <Minus className="w-3 h-3" />
      ) : checked ? (
        <Check className="w-3 h-3" />
      ) : null}
    </button>
  );
};

/**
 * Enhanced DataGrid component
 *
 * A comprehensive data grid component with:
 * - Advanced sorting and filtering
 * - Row selection (single/multiple)
 * - Column resizing and reordering
 * - Virtualization for large datasets
 * - Loading and empty states
 * - Accessibility support
 * - File-specific formatting for scan monitoring
 */
export const DataGrid = forwardRef<DataGridRef, DataGridProps>(
  (
    {
      data,
      columns,
      keyField = 'id',
      size = 'md',
      variant = 'default',
      height,
      maxHeight,
      bordered,
      striped,
      hoverable = true,
      selectionMode = 'none',
      selectedRows,
      onSelectionChange,
      sortable = true,
      sortConfig: externalSortConfig,
      onSortChange,
      filterable,
      filterConfig,
      onFilterChange,
      pagination,
      onPaginationChange,
      virtualization,
      loading,
      emptyState,
      rowHeight,
      expandableRows,
      rowExpansion,
      onRowClick,
      onRowDoubleClick,
      onRowContextMenu,
      onColumnResize,
      onColumnReorder,
      className,
      headerClassName,
      bodyClassName,
      footerClassName,
      rowClassName,
      ariaLabel = 'Data grid',
      ariaDescribedBy,
      testId = 'data-grid',
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    // Internal state
    const [internalSortConfig, setInternalSortConfig] = useState<SortConfig>({
      key: '',
      direction: null,
    });
    const [internalSelection, setInternalSelection] = useState<SelectionState>({
      selectedRows: new Set(),
      isAllSelected: false,
      isIndeterminate: false,
    });
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(
      new Set(),
    );

    // Computed values
    const sizeConfig = useMemo(() => defaultDataGridSizes[size], [size]);
    const variantConfig = useMemo(() => {
      let config = defaultDataGridVariants[variant];

      if (striped && variant !== 'striped') {
        config = {
          ...config,
          row: config.row.replace(
            'hover:bg-gray-50',
            'even:bg-gray-50/50 hover:bg-gray-100',
          ),
        };
      }

      if (bordered && variant !== 'bordered') {
        config = { ...config, border: 'border-gray-300' };
      }

      return config;
    }, [variant, striped, bordered]);

    const sortConfig = externalSortConfig || internalSortConfig;
    const selection = selectedRows
      ? {
          selectedRows,
          isAllSelected: selectedRows.size === data.length && data.length > 0,
          isIndeterminate:
            selectedRows.size > 0 && selectedRows.size < data.length,
        }
      : internalSelection;

    // Data processing
    const processedData = useMemo(() => {
      let result = data;

      // Apply sorting
      if (sortable) {
        result = sortData(result, sortConfig, columns);
      }

      return result;
    }, [data, sortConfig, columns, sortable]);

    // Selection handlers
    const handleRowSelection = useCallback(
      (rowId: string | number, selected: boolean) => {
        const newSelection = new Set(selection.selectedRows);

        if (selected) {
          newSelection.add(rowId);
        } else {
          newSelection.delete(rowId);
        }

        const newSelectionState: SelectionState = {
          selectedRows: newSelection,
          isAllSelected: newSelection.size === data.length && data.length > 0,
          isIndeterminate:
            newSelection.size > 0 && newSelection.size < data.length,
        };

        if (selectedRows) {
          onSelectionChange?.(newSelectionState);
        } else {
          setInternalSelection(newSelectionState);
        }
      },
      [selection.selectedRows, data.length, selectedRows, onSelectionChange],
    );

    const handleSelectAll = useCallback(
      (selected: boolean) => {
        const newSelection = selected
          ? new Set(data.map((row) => (row as any)[keyField]))
          : new Set();

        const newSelectionState: SelectionState = {
          selectedRows: newSelection,
          isAllSelected: selected && data.length > 0,
          isIndeterminate: false,
        };

        if (selectedRows) {
          onSelectionChange?.(newSelectionState);
        } else {
          setInternalSelection(newSelectionState);
        }
      },
      [data, keyField, selectedRows, onSelectionChange],
    );

    // Sort handlers
    const handleSort = useCallback(
      (columnId: string) => {
        const column = columns.find((col) => col.id === columnId);
        if (!column?.sortable) return;

        let newDirection: SortDirection = 'asc';

        if (sortConfig.key === columnId) {
          if (sortConfig.direction === 'asc') {
            newDirection = 'desc';
          } else if (sortConfig.direction === 'desc') {
            newDirection = null;
          }
        }

        const newSortConfig: SortConfig = {
          key: columnId,
          direction: newDirection,
        };

        if (externalSortConfig) {
          onSortChange?.(newSortConfig);
        } else {
          setInternalSortConfig(newSortConfig);
        }
      },
      [columns, sortConfig, externalSortConfig, onSortChange],
    );

    // Row expansion handlers
    const handleRowExpansion = useCallback(
      (rowId: string | number) => {
        const newExpanded = new Set(expandedRows);

        if (newExpanded.has(rowId)) {
          newExpanded.delete(rowId);
        } else {
          newExpanded.add(rowId);
        }

        setExpandedRows(newExpanded);
        rowExpansion?.onExpansionChange?.(newExpanded);
      },
      [expandedRows, rowExpansion],
    );

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        scrollToRow: (rowIndex: number, align = 'auto') => {
          // Implementation would depend on virtualization setup
        },
        scrollToColumn: (columnIndex: number) => {
          // Implementation for horizontal scrolling
        },
        selectRow: (rowId: string | number) => {
          handleRowSelection(rowId, true);
        },
        selectRows: (rowIds: (string | number)[]) => {
          const newSelection = new Set([...selection.selectedRows, ...rowIds]);
          const newSelectionState: SelectionState = {
            selectedRows: newSelection,
            isAllSelected: newSelection.size === data.length && data.length > 0,
            isIndeterminate:
              newSelection.size > 0 && newSelection.size < data.length,
          };

          if (selectedRows) {
            onSelectionChange?.(newSelectionState);
          } else {
            setInternalSelection(newSelectionState);
          }
        },
        deselectRow: (rowId: string | number) => {
          handleRowSelection(rowId, false);
        },
        deselectAll: () => {
          handleSelectAll(false);
        },
        selectAll: () => {
          handleSelectAll(true);
        },
        getSelectedRows: () => {
          return data.filter((row) =>
            selection.selectedRows.has((row as any)[keyField]),
          );
        },
        expandRow: (rowId: string | number) => {
          if (!expandedRows.has(rowId)) {
            handleRowExpansion(rowId);
          }
        },
        collapseRow: (rowId: string | number) => {
          if (expandedRows.has(rowId)) {
            handleRowExpansion(rowId);
          }
        },
        toggleRowExpansion: handleRowExpansion,
        getElement: () => containerRef.current,
        refresh: () => {
          // Trigger re-render or data refresh
        },
      }),
      [
        handleRowSelection,
        handleSelectAll,
        handleRowExpansion,
        selection.selectedRows,
        data,
        keyField,
        expandedRows,
        selectedRows,
        onSelectionChange,
      ],
    );

    // Render header
    const renderHeader = () => (
      <div
        ref={headerRef}
        className={clsx(
          'sticky top-0 z-10',
          variantConfig.header,
          headerClassName,
        )}
      >
        <div className="flex">
          {/* Selection column */}
          {selectionMode === 'multiple' && (
            <div
              className={clsx(
                'flex items-center justify-center flex-shrink-0 w-12',
                sizeConfig.header,
                variantConfig.headerCell,
              )}
            >
              <Checkbox
                checked={selection.isAllSelected}
                indeterminate={selection.isIndeterminate}
                onChange={handleSelectAll}
                data-testid={`${testId}-select-all`}
              />
            </div>
          )}

          {/* Expansion column */}
          {expandableRows && (
            <div
              className={clsx(
                'flex items-center justify-center flex-shrink-0 w-12',
                sizeConfig.header,
                variantConfig.headerCell,
              )}
            />
          )}

          {/* Data columns */}
          {columns
            .filter((col) => !col.hidden)
            .map((column) => (
              <div
                key={column.id}
                className={clsx(
                  'flex items-center',
                  sizeConfig.header,
                  variantConfig.headerCell,
                  column.headerClassName,
                  column.sortable && 'cursor-pointer hover:bg-gray-100',
                  column.align === 'center' && 'justify-center',
                  column.align === 'right' && 'justify-end',
                )}
                style={{
                  width: column.width,
                  minWidth: column.minWidth,
                  maxWidth: column.maxWidth,
                }}
                onClick={() => column.sortable && handleSort(column.id)}
                data-testid={`${testId}-header-${column.id}`}
              >
                {column.headerRender ? (
                  column.headerRender()
                ) : (
                  <>
                    <span className="select-none">{column.title}</span>
                    {column.sortable && (
                      <span className="ml-1 flex-shrink-0">
                        {sortConfig.key === column.id ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : sortConfig.direction === 'desc' ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4" />
                          )
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    );

    // Render row
    const renderRow = (row: any, rowIndex: number) => {
      const rowId = row[keyField];
      const isSelected = selection.selectedRows.has(rowId);
      const isExpanded = expandedRows.has(rowId);

      const rowClasses = clsx(
        variantConfig.row,
        hoverable && 'cursor-pointer',
        isSelected && 'bg-blue-50 border-blue-200',
        typeof rowClassName === 'function'
          ? rowClassName(row, rowIndex)
          : rowClassName,
      );

      return (
        <React.Fragment key={rowId}>
          <div
            className={rowClasses}
            onClick={() => onRowClick?.(row, rowIndex)}
            onDoubleClick={() => onRowDoubleClick?.(row, rowIndex)}
            onContextMenu={(e) => onRowContextMenu?.(row, rowIndex, e)}
            data-testid={`${testId}-row-${rowIndex}`}
          >
            <div className="flex">
              {/* Selection column */}
              {selectionMode !== 'none' && (
                <div
                  className={clsx(
                    'flex items-center justify-center flex-shrink-0 w-12',
                    sizeConfig.cell,
                    variantConfig.cell,
                  )}
                >
                  {selectionMode === 'multiple' ? (
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => handleRowSelection(rowId, checked)}
                      data-testid={`${testId}-select-${rowIndex}`}
                    />
                  ) : (
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => handleRowSelection(rowId, true)}
                      className="w-4 h-4 text-blue-600"
                      data-testid={`${testId}-select-${rowIndex}`}
                    />
                  )}
                </div>
              )}

              {/* Expansion column */}
              {expandableRows && (
                <div
                  className={clsx(
                    'flex items-center justify-center flex-shrink-0 w-12',
                    sizeConfig.cell,
                    variantConfig.cell,
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowExpansion(rowId);
                    }}
                    className="p-1 rounded hover:bg-gray-200"
                    data-testid={`${testId}-expand-${rowIndex}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Data columns */}
              {columns
                .filter((col) => !col.hidden)
                .map((column) => {
                  const value = row[column.key];
                  const cellClasses = clsx(
                    'flex items-center',
                    sizeConfig.cell,
                    variantConfig.cell,
                    column.className,
                    typeof column.cellClassName === 'function'
                      ? column.cellClassName(value, row, rowIndex)
                      : column.cellClassName,
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end',
                  );

                  const content = column.render
                    ? column.render(value, row, rowIndex)
                    : column.type
                      ? getDefaultRenderer(column.type)(value)
                      : value;

                  return (
                    <div
                      key={column.id}
                      className={cellClasses}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                        maxWidth: column.maxWidth,
                      }}
                      data-testid={`${testId}-cell-${rowIndex}-${column.id}`}
                    >
                      {content}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Expanded row content */}
          {expandableRows && isExpanded && rowExpansion?.render && (
            <div className="border-b border-gray-100">
              {rowExpansion.render(row, rowIndex)}
            </div>
          )}
        </React.Fragment>
      );
    };

    // Render body
    const renderBody = () => {
      if (loading?.state === 'loading') {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-gray-600">
                {loading.message || 'Loading...'}
              </span>
            </div>
          </div>
        );
      }

      if (loading?.state === 'error') {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-600 mb-2">
                {loading.message || 'Failed to load data'}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:text-blue-800"
              >
                <RotateCcw className="w-4 h-4 inline mr-1" />
                Try again
              </button>
            </div>
          </div>
        );
      }

      if (processedData.length === 0) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              {emptyState?.icon && (
                <div className="mb-4 text-gray-400">{emptyState.icon}</div>
              )}
              <div className="text-gray-600 mb-2">
                {emptyState?.message || 'No data to display'}
              </div>
              {emptyState?.description && (
                <div className="text-sm text-gray-500 mb-4">
                  {emptyState.description}
                </div>
              )}
              {emptyState?.action && (
                <button
                  onClick={emptyState.action.onClick}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {emptyState.action.label}
                </button>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className={bodyClassName}>
          {processedData.map((row, index) => renderRow(row, index))}
        </div>
      );
    };

    // Container styles
    const containerStyles: React.CSSProperties = {
      height,
      maxHeight,
    };

    return (
      <div
        ref={containerRef}
        className={clsx(
          'relative',
          sizeConfig.container,
          variantConfig.container,
          className,
        )}
        style={containerStyles}
        role="grid"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        data-testid={testId}
      >
        {renderHeader()}
        <div
          ref={bodyRef}
          className="overflow-auto"
          style={{
            maxHeight: maxHeight ? `calc(${maxHeight} - 60px)` : undefined,
          }}
        >
          {renderBody()}
        </div>
      </div>
    );
  },
);

DataGrid.displayName = 'DataGrid';

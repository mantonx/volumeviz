import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dropdown } from '@/components/ui/Dropdown';
import { ScanProgressDisplay } from '@/components/ui/ScanProgressDisplay';
import { ContainerStatus } from '@/components/ui/ContainerStatus';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { SizeVisualization } from '@/components/ui/SizeVisualization';
import { GrowthIndicator } from '@/components/ui/GrowthIndicator';
import { cn } from '@/utils';
import type { VolumeTableViewProps } from './VolumeTableView.types';

/**
 * Table view component for volumes list
 * Displays volumes in a traditional table format with sorting
 */
export const VolumeTableView: React.FC<VolumeTableViewProps> = ({
  data,
  loading,
  selectedIds,
  selectAllMode,
  paginationMeta,
  availableColumns,
  visibleColumns,
  sortConfig,
  onSort,
  onSelectAll,
  onSelectItem,
  onSelectAllPages,
  onClearSelection,
  getVolumeActions,
  getStatusColor,
  getTypeIcon,
  formatBytes,
  calculateVolumePercentage,
  maxSize,
  volumesWithDetailedProgress,
  setVolumesWithDetailedProgress,
  showSelectDropdown,
  success,
  showError,
  className,
}) => {
  const paginatedData = data;
  const visibleColumnsCount = visibleColumns.size;

  return (
    <Card className={cn('overflow-hidden', className)}>
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
                        paginatedData.every((item) => selectedIds.has(item.id))
                      }
                      indeterminate={
                        paginatedData.some((item) =>
                          selectedIds.has(item.id),
                        ) &&
                        !paginatedData.every((item) => selectedIds.has(item.id))
                      }
                      onChange={onSelectAll}
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
                                  All {paginationMeta.total} items selected
                                </span>
                              ) : (
                                <>
                                  {selectedIds.size} of {paginatedData.length}{' '}
                                  selected on this page
                                </>
                              )}
                            </div>
                            <div className="space-y-1">
                              {selectAllMode !== 'all' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-xs h-7 text-blue-600 dark:text-blue-400"
                                  onClick={onSelectAllPages}
                                >
                                  Select all {paginationMeta.total} items
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs h-7"
                                onClick={onClearSelection}
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
                        onClick={() => onSort(column.key)}
                        disabled={loading}
                        className={cn(
                          'flex items-center gap-1 transition-colors duration-150',
                          loading
                            ? 'text-gray-400 cursor-wait'
                            : 'hover:text-gray-700 dark:hover:text-gray-200',
                        )}
                      >
                        {column.label}
                        {loading &&
                        sortConfig.find((s) => s.field === column.key) ? (
                          <div className="ml-1 w-3 h-3 animate-pulse">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                          </div>
                        ) : sortConfig.find((s) => s.field === column.key) ? (
                          <div className="flex flex-col">
                            <ChevronUp
                              className={cn(
                                'h-3 w-3 transition-colors duration-150',
                                sortConfig.find((s) => s.field === column.key)
                                  ?.direction === 'asc'
                                  ? 'text-blue-600'
                                  : 'text-gray-400',
                              )}
                            />
                            <ChevronDown
                              className={cn(
                                'h-3 w-3 -mt-1 transition-colors duration-150',
                                sortConfig.find((s) => s.field === column.key)
                                  ?.direction === 'desc'
                                  ? 'text-blue-600'
                                  : 'text-gray-400',
                              )}
                            />
                          </div>
                        ) : null}
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
            {paginatedData.map((item, index) => {
              const TypeIcon = getTypeIcon(item.type);
              return (
                <React.Fragment key={`${item.id}-${index}`}>
                  <tr
                    className={cn(
                      'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 relative',
                      item.status === 'untracked' &&
                        'opacity-60 bg-gray-25 dark:bg-gray-800/20',
                    )}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onChange={() => onSelectItem(item.id)}
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
                              {formatBytes(item.size_bytes || 0)}
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
                                      Total capacity:{' '}
                                      {formatBytes(
                                        percentageData.capacityInfo.totalBytes,
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-300">
                                      {percentageData.capacityInfo.usagePercent.toFixed(
                                        1,
                                      )}
                                      % of capacity
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
                            maxSizeBytes={
                              item.filesystem_capacity?.total_bytes || maxSize
                            }
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
                      <Dropdown items={getVolumeActions(item)} />
                    </td>
                  </tr>

                  {/* Unified detailed progress row using ScanProgressDisplay for both scan and view */}
                  {volumesWithDetailedProgress.has(item.id) && (
                    <tr key={`${item.id}-progress`} className="border-t-0">
                      <td className="p-0" colSpan={visibleColumnsCount + 2}>
                        <div className="bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 p-4">
                          <ScanProgressDisplay
                            volumeId={item.id}
                            scanId={item.last_scan_id}
                            variant="panel"
                            size="md"
                            showPerformanceStats={true}
                            showErrors={true}
                            animated={true}
                            showEstimatedTime={true}
                            compact={false}
                            onScanStart={(scanId) => {
                              console.log(
                                `ScanProgressDisplay: Scan started for volume ${item.id}:`,
                                scanId,
                              );
                            }}
                            onScanComplete={(scanId, duration) => {
                              console.log(
                                `ScanProgressDisplay: Scan completed for volume ${item.id}:`,
                                scanId,
                                duration,
                              );
                              // Don't show toasts or auto-hide when just viewing progress
                              // These actions are handled by the scan initiation logic
                            }}
                            onScanError={(scanId, error) => {
                              console.log(
                                `ScanProgressDisplay: Scan error for volume ${item.id}:`,
                                scanId,
                                error,
                              );
                              // Only show error toasts for actively running scans, not for viewing historical data
                              // This prevents error toasts when just viewing progress of completed/failed scans
                            }}
                            className="w-full"
                          />
                        </div>
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default VolumeTableView;

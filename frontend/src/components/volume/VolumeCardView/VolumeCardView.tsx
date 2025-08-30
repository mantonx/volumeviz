import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dropdown } from '@/components/ui/Dropdown';
import { ScanProgressBar } from '@/components/scan';
import { ContainerBadge } from '@/components/ui/ContainerStatus';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { SizeVisualization } from '@/components/ui/SizeVisualization';
import { GrowthIndicator } from '@/components/ui/GrowthIndicator';
import { cn } from '@/utils';
import type { VolumeCardViewProps } from './VolumeCardView.types';

/**
 * Card view component for volumes list
 * Displays volumes as cards with detailed information
 */
export const VolumeCardView: React.FC<VolumeCardViewProps> = ({
  data,
  selectedIds,
  onSelectItem,
  getVolumeActions,
  getStatusColor,
  getTypeIcon,
  formatBytes,
  calculateVolumePercentage,
  maxSize,
  className,
}) => {
  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4',
        className,
      )}
    >
      {data.map((item, index) => {
        const TypeIcon = getTypeIcon(item.type);
        return (
          <Card
            key={`${item.id}-${index}`}
            className={cn(
              'p-4 transition-all duration-200 relative',
              item.status === 'untracked' ? 
                'opacity-40 bg-gray-100 dark:bg-gray-800/40 cursor-not-allowed' :
                'hover:shadow-md',
            )}
            style={item.status === 'untracked' ? {
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 12px)',
            } : undefined}
            role="article"
            aria-label={`Volume ${item.name}`}
          >
            {/* Scan Progress Bar as bottom border */}
            <ScanProgressBar volumeId={item.id} volumeStatus={item.status} />
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={cn(item.status === 'untracked' && "cursor-pointer")}>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onChange={() => onSelectItem(item.id)}
                    />
                  </div>
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
                {item.status !== 'untracked' && (
                  <Dropdown
                    items={getVolumeActions(item)}
                    className="flex-shrink-0"
                  />
                )}
              </div>

              {/* Status and Type */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {item.type}
                </Badge>
                <Badge className={`text-xs ${getStatusColor(item.status)}`}>
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
                                  Total:{' '}
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
  );
};

export default VolumeCardView;

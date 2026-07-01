/**
 * VolumesListStats Component
 *
 * Displays statistics cards for the volumes list:
 * - Total volumes across all pages
 * - Storage size on current page
 * - Tracked volumes count
 */

import React, { useMemo } from 'react';
import { cn } from '@/utils/ui';
import { HardDrive, Database, Activity } from 'lucide-react';
import { formatBytes } from '@/utils/formatters';
import { StatsCard } from '../../shared';
import type { VolumesListStatsProps } from './VolumesListStats.types';

/**
 * VolumesListStats displays volume statistics
 */
export const VolumesListStats: React.FC<VolumesListStatsProps> = ({
  volumes,
  totalVolumes,
  className,
}) => {
  // Calculate stats
  const stats = useMemo(() => {
    const totalSizeBytes = volumes.reduce((sum, v) => sum + (v.size_bytes || 0), 0);
    const trackedCount = volumes.filter(v => v.is_tracked !== false).length;

    return {
      totalSizeBytes,
      trackedCount,
    };
  }, [volumes]);

  return (
    <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-3', className)}>
      <StatsCard
        title="Total Volumes"
        value={totalVolumes}
        subtitle="across all pages"
        icon={<HardDrive className="w-5 h-5" />}
        color="blue"
      />
      <StatsCard
        title="Storage on Page"
        value={formatBytes(stats.totalSizeBytes)}
        subtitle={`${volumes.length} volume${volumes.length !== 1 ? 's' : ''} shown`}
        icon={<Database className="w-5 h-5" />}
        color="green"
      />
      <StatsCard
        title="Tracked Volumes"
        value={stats.trackedCount}
        subtitle={`of ${volumes.length} on this page`}
        icon={<Activity className="w-5 h-5" />}
        color="purple"
      />
    </div>
  );
};

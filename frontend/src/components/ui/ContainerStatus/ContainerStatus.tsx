/**
 * Container Status Component
 * Shows container information with running/stopped status indicators
 */

import React, { useState } from 'react';
import {
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/utils';

interface ContainerStatusProps {
  containers?: string[];
  containerCount?: number;
  showDetails?: boolean;
  showCount?: boolean;
  compact?: boolean;
  className?: string;
}

export const ContainerStatus: React.FC<ContainerStatusProps> = ({
  containers = [],
  containerCount,
  showDetails = true,
  showCount = true,
  compact = false,
  className,
}) => {
  // Use provided containerCount if available, otherwise fallback to containers array length
  const actualContainerCount =
    containerCount !== undefined ? containerCount : containers.length;
  const hasContainers = actualContainerCount > 0;
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show expand/collapse if we have actual container names and more than 2
  const canExpand = containers.length > 2 && showDetails;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {hasContainers ? (
          <span title="Active containers">
            <PlayCircle className="h-3.5 w-3.5 text-green-500" />
          </span>
        ) : (
          <span title="No active containers">
            <PauseCircle className="h-3.5 w-3.5 text-gray-400" />
          </span>
        )}
        {showCount && (
          <span
            className={cn(
              'text-sm font-medium',
              hasContainers
                ? 'text-primary'
                : 'text-tertiary',
            )}
          >
            {actualContainerCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        {hasContainers ? (
          <>
            <span title="Active containers">
              <PlayCircle className="h-4 w-4 text-green-500" />
            </span>
            <span className="text-sm font-medium text-primary">
              {actualContainerCount === 1
                ? '1 container'
                : `${actualContainerCount} containers`}
            </span>
          </>
        ) : (
          <>
            <span title="No active containers">
              <PauseCircle className="h-4 w-4 text-gray-400" />
            </span>
            <span className="text-sm text-tertiary">
              No containers
            </span>
          </>
        )}
      </div>

      {showDetails && hasContainers && (
        <div className="text-xs text-secondary">
          {/* Show first 2 containers or all if expanded */}
          {(isExpanded ? containers : containers.slice(0, 2)).map(
            (container) => (
              <div key={container} className="truncate" title={container}>
                {container}
              </div>
            ),
          )}

          {/* Expandable "+X more" link */}
          {canExpand && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'flex items-center gap-1 text-tertiary italic',
                'hover:text-blue-600 hover:underline',
                'cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded',
                'text-left',
              )}
              title={
                isExpanded
                  ? 'Show fewer containers'
                  : `Show all ${actualContainerCount} containers`
              }
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />+{actualContainerCount - 2}{' '}
                  more containers
                </>
              )}
            </button>
          )}

          {/* If we don't have container names but have a count > 2, show static text */}
          {!canExpand && actualContainerCount > 2 && containers.length <= 2 && (
            <div className="text-tertiary italic">
              +{actualContainerCount - containers.length} more containers
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Container health indicator for future use
interface ContainerHealthProps {
  containers: Array<{
    name: string;
    status: 'running' | 'stopped' | 'paused' | 'restarting';
    health?: 'healthy' | 'unhealthy' | 'starting';
  }>;
  compact?: boolean;
  className?: string;
}

export const ContainerHealth: React.FC<ContainerHealthProps> = ({
  containers,
  compact = false,
  className,
}) => {
  const runningCount = containers.filter((c) => c.status === 'running').length;
  const stoppedCount = containers.filter((c) => c.status === 'stopped').length;
  const unhealthyCount = containers.filter(
    (c) => c.health === 'unhealthy',
  ).length;
  const totalCount = containers.length;

  if (totalCount === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 text-tertiary',
          className,
        )}
      >
        <PauseCircle className="h-4 w-4" />
        <span className="text-sm">No containers</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {runningCount > 0 && (
          <div className="flex items-center gap-1">
            <PlayCircle className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-green-600">
              {runningCount}
            </span>
          </div>
        )}
        {stoppedCount > 0 && (
          <div className="flex items-center gap-1">
            <PauseCircle className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">
              {stoppedCount}
            </span>
          </div>
        )}
        {unhealthyCount > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-600">
              {unhealthyCount}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-3">
        {runningCount > 0 && (
          <div className="flex items-center gap-1.5">
            <PlayCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-600">
              {runningCount} running
            </span>
          </div>
        )}
        {stoppedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <PauseCircle className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-tertiary">
              {stoppedCount} stopped
            </span>
          </div>
        )}
        {unhealthyCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">
              {unhealthyCount} unhealthy
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Quick container count badge
interface ContainerBadgeProps {
  count: number;
  active?: boolean;
  className?: string;
}

export const ContainerBadge: React.FC<ContainerBadgeProps> = ({
  count,
  active = true,
  className,
}) => {
  if (count === 0) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
          'bg-surface-secondary text-secondary',
          className,
        )}
      >
        <PauseCircle className="h-3 w-3" />
        <span>None</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        active
          ? 'bg-green-100 text-green-700'
          : 'bg-surface-secondary text-secondary',
        className,
      )}
    >
      {active ? (
        <PlayCircle className="h-3 w-3" />
      ) : (
        <PauseCircle className="h-3 w-3" />
      )}
      <span>{count}</span>
    </div>
  );
};

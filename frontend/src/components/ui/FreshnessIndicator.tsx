/**
 * Freshness Indicator Component
 * Shows how recent the last scan was with color coding and relative time
 */

import React from 'react';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils';

interface FreshnessIndicatorProps {
  lastSeen?: string | null;
  showIcon?: boolean;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

const getTimeAgo = (dateString: string): { text: string; exact: string } => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  if (diffMinutes < 1) {
    text = 'Just now';
  } else if (diffMinutes < 60) {
    text = `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    text = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    text = `${diffDays}d ago`;
  } else {
    text = date.toLocaleDateString();
  }

  return {
    text,
    exact: date.toLocaleString(),
  };
};

const getFreshnessLevel = (
  dateString: string,
): 'fresh' | 'recent' | 'stale' | 'old' => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'fresh'; // < 1 hour
  if (diffHours < 24) return 'recent'; // < 1 day
  if (diffHours < 168) return 'stale'; // < 1 week
  return 'old'; // > 1 week
};

const getFreshnessStyles = (level: string) => {
  switch (level) {
    case 'fresh':
      return {
        text: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        icon: CheckCircle2,
        border: 'border-green-200 dark:border-green-800',
      };
    case 'recent':
      return {
        text: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        icon: Clock,
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'stale':
      return {
        text: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        icon: Clock,
        border: 'border-yellow-200 dark:border-yellow-800',
      };
    case 'old':
      return {
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        icon: AlertTriangle,
        border: 'border-red-200 dark:border-red-800',
      };
    default:
      return {
        text: 'text-gray-600 dark:text-gray-400',
        bg: 'bg-gray-100 dark:bg-gray-900/30',
        icon: Clock,
        border: 'border-gray-200 dark:border-gray-800',
      };
  }
};

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  lastSeen,
  showIcon = true,
  showLabel = true,
  compact = false,
  className,
}) => {
  // Handle null/undefined case for never-scanned volumes
  if (!lastSeen) {
    return (
      <div
        className={cn('flex items-center gap-1', className)}
        title="This volume has never been scanned for size information"
      >
        {showIcon && <AlertTriangle className="h-3 w-3 text-gray-400" />}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Never scanned
        </span>
      </div>
    );
  }

  const timeInfo = getTimeAgo(lastSeen);
  const level = getFreshnessLevel(lastSeen);
  const styles = getFreshnessStyles(level);
  const Icon = styles.icon;

  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-1', className)}
        title={`Last scanned: ${timeInfo.exact}`}
      >
        {showIcon && <Icon className={cn('h-3 w-3', styles.text)} />}
        <span className={cn('text-xs font-medium', styles.text)}>
          {timeInfo.text}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border',
        styles.bg,
        styles.border,
        className,
      )}
      title={`Last scanned: ${timeInfo.exact}`}
    >
      {showIcon && <Icon className={cn('h-3.5 w-3.5', styles.text)} />}
      <div className="flex flex-col">
        <span className={cn('text-xs font-medium', styles.text)}>
          {timeInfo.text}
        </span>
        {showLabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Size scan
          </span>
        )}
      </div>
    </div>
  );
};

// Alert component for very stale data
interface StaleDataAlertProps {
  lastSeen: string;
  volumeName: string;
  onRefresh?: () => void;
  className?: string;
}

export const StaleDataAlert: React.FC<StaleDataAlertProps> = ({
  lastSeen,
  volumeName,
  onRefresh,
  className,
}) => {
  const level = getFreshnessLevel(lastSeen);

  if (level !== 'old') return null;

  const timeInfo = getTimeAgo(lastSeen);

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg',
        'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
          Stale Data Detected
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
          {volumeName} was last scanned {timeInfo.text}. Consider refreshing for
          current data.
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-yellow-800 dark:text-yellow-200 hover:underline mt-1"
          >
            Refresh now
          </button>
        )}
      </div>
    </div>
  );
};

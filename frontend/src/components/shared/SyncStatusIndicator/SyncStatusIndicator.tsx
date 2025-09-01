import { AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { useBackgroundSync } from '@/utils/background-sync';
import { cn } from '@/utils';

interface SyncStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function SyncStatusIndicator({ 
  className, 
  showLabel = true,
  size = 'md' 
}: SyncStatusIndicatorProps) {
  const { isOnline, pendingCount, syncInProgress } = useBackgroundSync();

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: `Offline${pendingCount > 0 ? ` (${pendingCount} queued)` : ''}`,
        color: 'text-amber-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    }

    if (syncInProgress) {
      return {
        icon: Clock,
        label: 'Syncing...',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      };
    }

    if (pendingCount > 0) {
      return {
        icon: AlertCircle,
        label: `${pendingCount} pending`,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
      };
    }

    return {
      icon: CheckCircle,
      label: 'Online',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    };
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  if (!showLabel) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center rounded-full p-1 border',
          statusInfo.bgColor,
          statusInfo.borderColor,
          className
        )}
        title={statusInfo.label}
      >
        <Icon className={cn(sizeClasses[size], statusInfo.color)} />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border',
        statusInfo.bgColor,
        statusInfo.borderColor,
        className
      )}
    >
      <Icon className={cn(sizeClasses[size], statusInfo.color)} />
      <span className={cn(textSizeClasses[size], 'font-medium', statusInfo.color)}>
        {statusInfo.label}
      </span>
    </div>
  );
}

// Compact version for header/toolbar use
export function SyncStatusBadge({ className }: { className?: string }) {
  const { isOnline, pendingCount } = useBackgroundSync();

  if (isOnline && pendingCount === 0) {
    return null; // Hide when everything is normal
  }

  return (
    <SyncStatusIndicator
      className={cn('px-2 py-1', className)}
      showLabel={true}
      size="sm"
    />
  );
}

// Detailed sync status panel for settings/debug
export function SyncStatusPanel() {
  const { isOnline, pendingCount, syncInProgress, forceSync, clearPending } = useBackgroundSync();

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Sync Status</h3>
        <SyncStatusIndicator size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-medium">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            Pending operations: <span className="font-medium">{pendingCount}</span>
          </div>
          
          <div className="text-sm text-gray-600">
            Sync in progress: <span className="font-medium">{syncInProgress ? 'Yes' : 'No'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => forceSync()}
            disabled={!isOnline || syncInProgress}
            className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Force Sync
          </button>
          
          <button
            onClick={() => clearPending()}
            disabled={pendingCount === 0}
            className="w-full px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear Queue
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            You're currently offline. Operations will be queued and executed when connection is restored.
          </p>
        </div>
      )}
    </div>
  );
}
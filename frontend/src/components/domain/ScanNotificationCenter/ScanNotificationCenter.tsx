import React, { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import type {
  ScanNotificationCenterProps,
  ScanNotification,
} from './ScanNotificationCenter.types';

export const ScanNotificationCenter: React.FC<ScanNotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onClearAll,
  maxVisible = 10,
  className,
  testId = 'scan-notification-center',
}) => {
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const visibleNotifications = useMemo(
    () => notifications.slice(0, maxVisible),
    [notifications, maxVisible],
  );

  const getIconForType = (type: ScanNotification['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const getColorClasses = (type: ScanNotification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'error':
        return 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (notifications.length === 0) {
    return (
      <Card className={className} data-testid={testId}>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No notifications
        </div>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid={testId}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <Badge variant="primary" size="sm">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && onMarkAllAsRead && (
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
              Mark all read
            </Button>
          )}
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {visibleNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              relative p-3 rounded-lg transition-all
              ${!notification.read ? 'ring-2 ring-blue-500 ring-opacity-20' : ''}
              ${getColorClasses(notification.type)}
            `}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-gray-800">
                <span className="text-sm font-semibold">
                  {getIconForType(notification.type)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-sm mt-1 opacity-90">
                      {notification.message}
                    </p>
                    {notification.volumeName && (
                      <p className="text-xs mt-1 opacity-75">
                        Volume: {notification.volumeName}
                      </p>
                    )}

                    {notification.actions &&
                      notification.actions.length > 0 && (
                        <div className="flex items-center space-x-2 mt-2">
                          {notification.actions.map((action, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              size="sm"
                              onClick={action.action}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-xs opacity-75">
                      {formatTimestamp(notification.timestamp)}
                    </span>

                    {!notification.persistent && onDismiss && (
                      <button
                        onClick={() => onDismiss(notification.id)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label="Dismiss"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!notification.read && onMarkAsRead && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="absolute inset-0 w-full h-full opacity-0"
                aria-label="Mark as read"
              />
            )}
          </div>
        ))}
      </div>

      {notifications.length > maxVisible && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {maxVisible} of {notifications.length} notifications
          </p>
        </div>
      )}
    </Card>
  );
};

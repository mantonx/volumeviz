export interface ScanNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  volumeId?: string;
  volumeName?: string;
  scanId?: string;
  timestamp: string;
  read: boolean;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

export interface ScanNotificationCenterProps {
  notifications: ScanNotification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDismiss?: (notificationId: string) => void;
  onClearAll?: () => void;
  maxVisible?: number;
  className?: string;
  testId?: string;
}
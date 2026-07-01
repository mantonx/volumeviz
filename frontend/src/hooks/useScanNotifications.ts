import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useScanProgress } from './useScanProgress';

interface UseScanNotificationsOptions {
  showStartNotification?: boolean;
  showCompletionNotification?: boolean;
  showErrorNotification?: boolean;
}

/**
 * Hook that automatically shows toast notifications for scan events
 */
export function useScanNotifications(
  volumeId: string,
  options: UseScanNotificationsOptions = {},
) {
  const {
    showStartNotification = true,
    showCompletionNotification = true,
    showErrorNotification = true,
  } = options;

  const { progress } = useScanProgress(volumeId);
  const toast = useToast();

  useEffect(() => {
    if (!progress) return;

    const { overall_status: status } = progress;

    if (status === 'running' && showStartNotification) {
      toast.success(`Scan started for volume ${volumeId}`, {
        duration: 3000,
      });
    } else if (status === 'completed' && showCompletionNotification) {
      toast.success(`Scan completed for volume ${volumeId}`, {
        duration: 4000,
      });
    } else if (status === 'failed' && showErrorNotification) {
      toast.error(`Scan failed for volume ${volumeId}`, {
        duration: 5000,
      });
    }
  }, [
    progress?.overall_status,
    volumeId,
    showStartNotification,
    showCompletionNotification,
    showErrorNotification,
  ]);

  return { progress };
}

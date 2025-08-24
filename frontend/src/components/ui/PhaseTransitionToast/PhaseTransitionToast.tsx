import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { PhaseTransitionNotification } from '../PhaseTransitionNotification';
import { usePhaseTransitionNotifications } from '../../../hooks/usePhaseTransitionNotifications';
import type { PhaseTransition } from '../../../utils/phaseTransitionNotifications';

export interface PhaseTransitionToastProps {
  /** Whether toast notifications are enabled */
  enabled?: boolean;
  /** Maximum number of toasts to show simultaneously */
  maxToasts?: number;
  /** Default auto-dismiss timeout */
  autoDismissTimeout?: number;
  /** Position of toast container */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Filter by volume ID */
  volumeId?: string;
  /** Filter by scan ID */
  scanId?: string;
  /** Custom className for container */
  className?: string;
  /** Callback when a toast is clicked */
  onToastClick?: (transition: PhaseTransition) => void;
}

interface ToastInstance {
  id: string;
  transition: PhaseTransition;
  timestamp: number;
}

/**
 * PhaseTransitionToast provides elegant toast notifications for scan phase transitions
 * Automatically displays when phases change and manages multiple concurrent toasts
 */
export const PhaseTransitionToast: React.FC<PhaseTransitionToastProps> = ({
  enabled = true,
  maxToasts = 3,
  autoDismissTimeout = 6000,
  position = 'top-right',
  volumeId,
  scanId,
  className,
  onToastClick,
}) => {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);

  const { latestTransition } = usePhaseTransitionNotifications({
    enabled,
    volumeId,
    scanId,
    onTransition: (transition) => {
      // Create new toast instance
      const toastInstance: ToastInstance = {
        id: `toast-${transition.id}`,
        transition,
        timestamp: Date.now(),
      };

      setToasts(prev => {
        // Add new toast and limit to maxToasts
        const updated = [toastInstance, ...prev].slice(0, maxToasts);
        return updated;
      });
    },
  });

  // Remove toast
  const removeToast = (toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId));
  };

  // Handle toast click
  const handleToastClick = (transition: PhaseTransition) => {
    onToastClick?.(transition);
  };

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  if (!enabled || toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed z-50 flex flex-col gap-3 pointer-events-none',
        positionClasses[position],
        className
      )}
      style={{ maxWidth: '400px' }}
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto transform transition-all duration-300 ease-out"
          style={{
            transform: `translateY(${index * 8}px) scale(${1 - index * 0.02})`,
            opacity: Math.max(0.3, 1 - index * 0.15),
            zIndex: 50 - index,
          }}
        >
          <PhaseTransitionNotification
            transition={toast.transition}
            variant="toast"
            size="md"
            showDetails={false}
            autoDismiss={true}
            dismissTimeout={autoDismissTimeout}
            dismissible={true}
            onDismiss={() => removeToast(toast.id)}
            onClick={onToastClick ? () => handleToastClick(toast.transition) : undefined}
          />
        </div>
      ))}
    </div>
  );
};

export default PhaseTransitionToast;
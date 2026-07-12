import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { useSetAtom } from 'jotai';
import { addNotificationAtom } from '@/atoms/ui';

import { Toast } from './Toast';
import type {
  ToastProviderProps,
  ToastContainerProps,
  ToastConfig,
  ToastQueueItem,
  ToastHelpers,
  ExtendedToastContextValue,
  ToastVariant,
  ToastOptions,
} from './Toast.types';
import { defaultToastPositions, defaultToastSizes } from './Toast.types';

/**
 * Toast Context
 */
const ToastContext = createContext<ExtendedToastContextValue | undefined>(
  undefined,
);

/**
 * Toast Container Component
 */
const ToastContainer: React.FC<
  ToastContainerProps & { toasts: ToastQueueItem[] }
> = ({
  position = 'top-right',
  size = 'md',
  maxToasts = 5,
  zIndex = 50,
  className,
  testId = 'toast-container',
  toasts,
}) => {
  const positionConfig = defaultToastPositions[position];
  const sizeConfig = defaultToastSizes[size];

  const containerClasses = clsx(
    positionConfig.container,
    sizeConfig.container,
    positionConfig.spacing,
    `z-${zIndex}`,
    className,
  );

  const visibleToasts = toasts
    .filter((toast) => toast.isVisible)
    .slice(0, maxToasts);

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div
      className={containerClasses}
      data-testid={testId}
      data-position={position}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visibleToasts.map((toast) => (
        <div key={toast.id} className={positionConfig.item}>
          <Toast
            {...toast}
            position={position}
            size={size}
            isVisible={toast.isVisible}
            testId={`${testId}-item`}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Enhanced Toast Provider
 *
 * Provides comprehensive toast management with:
 * - Queue management with max limits
 * - Multiple positioning options
 * - Helper methods for common patterns
 * - Promise-based toast handling
 * - Auto-cleanup and lifecycle management
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultPosition = 'top-right',
  defaultSize = 'md',
  defaultDuration = 5000,
  maxToasts = 5,
  containerProps,
}) => {
  const [toasts, setToasts] = useState<ToastQueueItem[]>([]);
  const nextIdRef = useRef(1);
  const addNotification = useSetAtom(addNotificationAtom);

  // Core toast management
  const showToast = useCallback(
    (config: Omit<ToastConfig, 'id'>): string => {
      const id = `toast-${nextIdRef.current++}`;
      const duration = config.duration ?? defaultDuration;

      const newToast: ToastQueueItem = {
        ...config,
        id,
        duration: config.persistent ? 0 : duration,
        timestamp: Date.now(),
        isVisible: true,
        isExiting: false,
      };

      // Error/warning toasts also get a durable record in notificationsAtom
      // — the toast itself auto-dismisses in a few seconds, but a user who
      // wasn't looking at the screen at that moment (or a failure with no
      // server-side trace, like a request that never reached the backend)
      // would otherwise have zero way to check "did something go wrong
      // recently" — see NotificationsDropdown.tsx.
      if (config.variant === 'error' || config.variant === 'warning') {
        addNotification({
          type: config.variant,
          title: config.title ?? (config.variant === 'error' ? 'Error' : 'Warning'),
          message: config.message,
        });
      }

      setToasts((prev) => {
        const updated = [...prev, newToast];

        // Remove excess toasts if over limit
        if (updated.length > maxToasts) {
          const toRemove = updated.slice(0, updated.length - maxToasts);
          toRemove.forEach((toast) => {
            if (toast.timeoutId) {
              clearTimeout(toast.timeoutId);
            }
          });
          return updated.slice(updated.length - maxToasts);
        }

        return updated;
      });

      // Auto-dismiss handling
      if (!config.persistent && duration > 0) {
        const timeoutId = setTimeout(() => {
          hideToast(id);
        }, duration);

        setToasts((prev) =>
          prev.map((toast) =>
            toast.id === id ? { ...toast, timeoutId } : toast,
          ),
        );
      }

      return id;
    },
    [defaultDuration, maxToasts],
  );

  const hideToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((toast) => {
        if (toast.id === id) {
          if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
          }
          return {
            ...toast,
            isVisible: false,
            isExiting: true,
            timeoutId: undefined,
          };
        }
        return toast;
      }),
    );

    // Remove from array after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts((prev) => {
      prev.forEach((toast) => {
        if (toast.timeoutId) {
          clearTimeout(toast.timeoutId);
        }
      });
      return [];
    });
  }, []);

  const updateToast = useCallback(
    (id: string, updates: Partial<ToastConfig>) => {
      setToasts((prev) =>
        prev.map((toast) =>
          toast.id === id ? { ...toast, ...updates } : toast,
        ),
      );
    },
    [],
  );

  const getToast = useCallback(
    (id: string): ToastConfig | undefined => {
      return toasts.find((toast) => toast.id === id);
    },
    [toasts],
  );

  const getAllToasts = useCallback((): ToastConfig[] => {
    return toasts.filter((toast) => toast.isVisible);
  }, [toasts]);

  const isVisible = useCallback(
    (id: string): boolean => {
      const toast = toasts.find((t) => t.id === id);
      return toast?.isVisible ?? false;
    },
    [toasts],
  );

  // Helper methods
  const helpers: ToastHelpers = useMemo(
    () => ({
      info: (message: string, options?: Partial<ToastOptions>) =>
        showToast({ variant: 'info', message, ...options }),

      success: (message: string, options?: Partial<ToastOptions>) =>
        showToast({ variant: 'success', message, ...options }),

      warning: (message: string, options?: Partial<ToastOptions>) =>
        showToast({ variant: 'warning', message, ...options }),

      error: (message: string, options?: Partial<ToastOptions>) =>
        showToast({ variant: 'error', message, ...options }),

      loading: (message: string, options?: Partial<ToastOptions>) =>
        showToast({
          variant: 'info',
          message,
          persistent: true,
          dismissible: false,
          ...options,
        }),

      promise: async <T,>(
        promise: Promise<T>,
        messages: {
          loading: string;
          success: string | ((data: T) => string);
          error: string | ((error: Error) => string);
        },
        options?: Partial<ToastOptions>,
      ): Promise<T> => {
        const {
          loading: loadingMessage,
          success: successMessage,
          error: errorMessage,
        } = messages;
        const loadingId = showToast({
          variant: 'info',
          message: loadingMessage,
          persistent: true,
          dismissible: false,
          ...options,
        });

        try {
          const result = await promise;
          hideToast(loadingId);

          const message =
            typeof successMessage === 'function'
              ? successMessage(result)
              : successMessage;

          showToast({
            variant: 'success',
            message,
            ...options,
          });

          return result;
        } catch (err) {
          hideToast(loadingId);

          const message =
            typeof errorMessage === 'function'
              ? errorMessage(err as Error)
              : errorMessage;

          showToast({
            variant: 'error',
            message,
            ...options,
          });

          throw err;
        }
      },
    }),
    [showToast, hideToast],
  );

  // Toast manager
  const manager = useMemo(
    () => ({
      show: (variant: ToastVariant, messageOrConfig: string | ToastOptions) => {
        if (typeof messageOrConfig === 'string') {
          return showToast({ variant, message: messageOrConfig });
        }
        return showToast({ variant, ...messageOrConfig });
      },
      hide: hideToast,
      clear: clearAllToasts,
      update: updateToast,
      get: getToast,
      getAll: getAllToasts,
      isVisible,
      subscribe: (callback: (toasts: ToastConfig[]) => void) => {
        const unsubscribe = () => {
          // In a real implementation, this would remove the listener
          // For now, we'll just return a no-op function
        };

        // Call immediately with current toasts
        callback(getAllToasts());

        return unsubscribe;
      },
    }),
    [
      showToast,
      hideToast,
      clearAllToasts,
      updateToast,
      getToast,
      getAllToasts,
      isVisible,
    ],
  );

  // Context value
  const contextValue: ExtendedToastContextValue = useMemo(
    () => ({
      showToast,
      hideToast,
      clearAllToasts,
      updateToast,
      getToast,
      getAllToasts,
      isVisible,
      position: defaultPosition,
      size: defaultSize,
      maxToasts,
      ...helpers,
      manager,
    }),
    [
      showToast,
      hideToast,
      clearAllToasts,
      updateToast,
      getToast,
      getAllToasts,
      isVisible,
      defaultPosition,
      defaultSize,
      maxToasts,
      helpers,
      manager,
    ],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Portal for toast container */}
      {typeof document !== 'undefined' &&
        createPortal(
          <ToastContainer
            position={defaultPosition}
            size={defaultSize}
            maxToasts={maxToasts}
            toasts={toasts}
            {...containerProps}
          />,
          document.body,
        )}
    </ToastContext.Provider>
  );
};

/**
 * Hook to use toast context
 */
export const useToast = (): ExtendedToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

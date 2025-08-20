import type { ReactNode } from 'react';

/**
 * Toast component types and configurations
 */

// Core types
export type ToastVariant = 'info' | 'success' | 'warning' | 'error';
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type ToastSize = 'sm' | 'md' | 'lg';

// Toast configuration
export interface ToastConfig {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  dismissible?: boolean;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAction?: () => void;
  className?: string;
  testId?: string;
}

// Toast component props
export interface ToastProps extends Omit<ToastConfig, 'id'> {
  id?: string;
  isVisible?: boolean;
  position?: ToastPosition;
  size?: ToastSize;
  animate?: boolean;
  onAnimationEnd?: () => void;
}

// Toast ref API
export interface ToastRef {
  dismiss: () => void;
  show: () => void;
  getElement: () => HTMLDivElement | null;
  isPersistent: () => boolean;
}

// Toast container props
export interface ToastContainerProps {
  position?: ToastPosition;
  size?: ToastSize;
  maxToasts?: number;
  spacing?: number;
  zIndex?: number;
  className?: string;
  testId?: string;
}

// Toast provider props
export interface ToastProviderProps {
  children: ReactNode;
  defaultPosition?: ToastPosition;
  defaultSize?: ToastSize;
  defaultDuration?: number;
  maxToasts?: number;
  containerProps?: Partial<ToastContainerProps>;
}

// Toast context value
export interface ToastContextValue {
  showToast: (config: Omit<ToastConfig, 'id'>) => string;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  updateToast: (id: string, updates: Partial<ToastConfig>) => void;
  getToast: (id: string) => ToastConfig | undefined;
  getAllToasts: () => ToastConfig[];
  isVisible: (id: string) => boolean;
  position: ToastPosition;
  size: ToastSize;
  maxToasts: number;
}

// Animation configuration
export interface ToastAnimationConfig {
  enter: string;
  enterActive: string;
  exit: string;
  exitActive: string;
  duration: number;
}

// Position configuration
export interface ToastPositionConfig {
  container: string;
  item: string;
  spacing: string;
}

// Size configuration
export interface ToastSizeConfig {
  container: string;
  toast: string;
  icon: string;
  title: string;
  message: string;
  action: string;
}

// Predefined configurations
export const defaultToastDurations: Record<ToastVariant, number> = {
  info: 5000,
  success: 4000,
  warning: 6000,
  error: 8000,
};

export const defaultToastSizes: Record<ToastSize, ToastSizeConfig> = {
  sm: {
    container: 'w-80',
    toast: 'p-3',
    icon: 'w-4 h-4',
    title: 'text-sm font-medium',
    message: 'text-xs',
    action: 'text-xs px-2 py-1',
  },
  md: {
    container: 'w-96',
    toast: 'p-4',
    icon: 'w-5 h-5',
    title: 'text-sm font-semibold',
    message: 'text-sm',
    action: 'text-sm px-3 py-1.5',
  },
  lg: {
    container: 'w-112',
    toast: 'p-5',
    icon: 'w-6 h-6',
    title: 'text-base font-semibold',
    message: 'text-sm',
    action: 'text-sm px-4 py-2',
  },
};

export const defaultToastPositions: Record<ToastPosition, ToastPositionConfig> = {
  'top-left': {
    container: 'fixed top-4 left-4 z-50',
    item: 'mb-2',
    spacing: 'space-y-2',
  },
  'top-center': {
    container: 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    item: 'mb-2',
    spacing: 'space-y-2',
  },
  'top-right': {
    container: 'fixed top-4 right-4 z-50',
    item: 'mb-2',
    spacing: 'space-y-2',
  },
  'bottom-left': {
    container: 'fixed bottom-4 left-4 z-50',
    item: 'mt-2',
    spacing: 'space-y-2',
  },
  'bottom-center': {
    container: 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
    item: 'mt-2',
    spacing: 'space-y-2',
  },
  'bottom-right': {
    container: 'fixed bottom-4 right-4 z-50',
    item: 'mt-2',
    spacing: 'space-y-2',
  },
};

export const defaultToastAnimations: Record<string, ToastAnimationConfig> = {
  'slide-right': {
    enter: 'transform translate-x-full opacity-0',
    enterActive: 'transform translate-x-0 opacity-100 transition-all duration-300',
    exit: 'transform translate-x-full opacity-100',
    exitActive: 'transform translate-x-full opacity-0 transition-all duration-300',
    duration: 300,
  },
  'slide-left': {
    enter: 'transform -translate-x-full opacity-0',
    enterActive: 'transform translate-x-0 opacity-100 transition-all duration-300',
    exit: 'transform translate-x-0 opacity-100',
    exitActive: 'transform -translate-x-full opacity-0 transition-all duration-300',
    duration: 300,
  },
  'slide-down': {
    enter: 'transform -translate-y-full opacity-0',
    enterActive: 'transform translate-y-0 opacity-100 transition-all duration-300',
    exit: 'transform translate-y-0 opacity-100',
    exitActive: 'transform -translate-y-full opacity-0 transition-all duration-300',
    duration: 300,
  },
  'slide-up': {
    enter: 'transform translate-y-full opacity-0',
    enterActive: 'transform translate-y-0 opacity-100 transition-all duration-300',
    exit: 'transform translate-y-0 opacity-100',
    exitActive: 'transform translate-y-full opacity-0 transition-all duration-300',
    duration: 300,
  },
  fade: {
    enter: 'opacity-0 scale-95',
    enterActive: 'opacity-100 scale-100 transition-all duration-200',
    exit: 'opacity-100 scale-100',
    exitActive: 'opacity-0 scale-95 transition-all duration-200',
    duration: 200,
  },
};

// Variant styling
export const toastVariantStyles: Record<ToastVariant, {
  container: string;
  icon: string;
  title: string;
  message: string;
  closeButton: string;
  action: string;
}> = {
  info: {
    container: 'bg-blue-50 border-blue-200 border',
    icon: 'text-blue-500',
    title: 'text-blue-900',
    message: 'text-blue-700',
    closeButton: 'text-blue-400 hover:text-blue-600',
    action: 'text-blue-600 hover:text-blue-800 border-blue-300 hover:border-blue-400',
  },
  success: {
    container: 'bg-green-50 border-green-200 border',
    icon: 'text-green-500',
    title: 'text-green-900',
    message: 'text-green-700',
    closeButton: 'text-green-400 hover:text-green-600',
    action: 'text-green-600 hover:text-green-800 border-green-300 hover:border-green-400',
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 border',
    icon: 'text-yellow-500',
    title: 'text-yellow-900',
    message: 'text-yellow-700',
    closeButton: 'text-yellow-400 hover:text-yellow-600',
    action: 'text-yellow-600 hover:text-yellow-800 border-yellow-300 hover:border-yellow-400',
  },
  error: {
    container: 'bg-red-50 border-red-200 border',
    icon: 'text-red-500',
    title: 'text-red-900',
    message: 'text-red-700',
    closeButton: 'text-red-400 hover:text-red-600',
    action: 'text-red-600 hover:text-red-800 border-red-300 hover:border-red-400',
  },
};

// Default icons for variants
export const defaultToastIcons: Record<ToastVariant, string> = {
  info: 'Info',
  success: 'CheckCircle',
  warning: 'AlertTriangle',
  error: 'AlertCircle',
};

// Helper types for convenience
export type ToastOptions = Omit<ToastConfig, 'id' | 'variant'>;
export type ToastShowFunction = (variant: ToastVariant, messageOrConfig: string | ToastOptions) => string;

/**
 * Toast queue management
 */
export interface ToastQueueItem extends ToastConfig {
  timestamp: number;
  isVisible: boolean;
  isExiting: boolean;
  timeoutId?: NodeJS.Timeout;
}

export interface ToastQueue {
  items: ToastQueueItem[];
  maxSize: number;
  position: ToastPosition;
}

/**
 * Toast manager for complex scenarios
 */
export interface ToastManager {
  show: ToastShowFunction;
  hide: (id: string) => void;
  clear: () => void;
  update: (id: string, updates: Partial<ToastConfig>) => void;
  get: (id: string) => ToastConfig | undefined;
  getAll: () => ToastConfig[];
  isVisible: (id: string) => boolean;
  subscribe: (callback: (toasts: ToastConfig[]) => void) => () => void;
}

/**
 * Convenience methods for common toast types
 */
export interface ToastHelpers {
  info: (message: string, options?: Partial<ToastOptions>) => string;
  success: (message: string, options?: Partial<ToastOptions>) => string;
  warning: (message: string, options?: Partial<ToastOptions>) => string;
  error: (message: string, options?: Partial<ToastOptions>) => string;
  loading: (message: string, options?: Partial<ToastOptions>) => string;
  promise: <T>(
    promise: Promise<T>,
    {
      loading: loadingMessage,
      success: successMessage,
      error: errorMessage,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
    options?: Partial<ToastOptions>
  ) => Promise<T>;
}

/**
 * Extended toast context with helpers
 */
export interface ExtendedToastContextValue extends ToastContextValue, ToastHelpers {
  manager: ToastManager;
}

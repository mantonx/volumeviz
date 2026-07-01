import type { ReactNode } from 'react';

/**
 * Modal variants
 */
export type ModalVariant = 'modal' | 'drawer';

/**
 * Modal sizes
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

/**
 * Drawer positions
 */
export type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * Modal/Drawer animation types
 */
export type ModalAnimation = 'fade' | 'slide' | 'scale' | 'none';

/**
 * Focus trap configuration
 */
export interface FocusTrapConfig {
  /** Whether to enable focus trap */
  enabled?: boolean;
  /** Initial focus target selector */
  initialFocus?: string;
  /** Return focus target selector */
  returnFocus?: string;
  /** Allow outside clicks to close */
  allowOutsideClick?: boolean;
}

/**
 * Backdrop configuration
 */
export interface BackdropConfig {
  /** Whether to show backdrop */
  show?: boolean;
  /** Backdrop opacity (0-100) */
  opacity?: number;
  /** Whether backdrop click closes modal */
  closable?: boolean;
  /** Custom backdrop color */
  color?: string;
  /** Blur intensity */
  blur?: number;
}

/**
 * Header configuration
 */
export interface ModalHeader {
  /** Header title */
  title?: ReactNode;
  /** Header subtitle */
  subtitle?: ReactNode;
  /** Whether to show close button */
  showClose?: boolean;
  /** Custom close button */
  closeButton?: ReactNode;
  /** Header actions */
  actions?: ReactNode;
  /** Whether header is sticky */
  sticky?: boolean;
  /** Custom header component */
  custom?: ReactNode;
}

/**
 * Footer configuration
 */
export interface ModalFooter {
  /** Footer content */
  content?: ReactNode;
  /** Primary action button */
  primaryAction?: ReactNode;
  /** Secondary action button */
  secondaryAction?: ReactNode;
  /** Additional actions */
  actions?: ReactNode[];
  /** Whether footer is sticky */
  sticky?: boolean;
  /** Footer alignment */
  align?: 'left' | 'center' | 'right' | 'between';
}

/**
 * Main component props
 */
export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;

  /** Modal variant */
  variant?: ModalVariant;

  /** Modal size */
  size?: ModalSize;

  /** Drawer position (only for drawer variant) */
  position?: DrawerPosition;

  /** Animation type */
  animation?: ModalAnimation;

  /** Animation duration in ms */
  animationDuration?: number;

  /** Header configuration */
  header?: ModalHeader;

  /** Footer configuration */
  footer?: ModalFooter;

  /** Modal content */
  children: ReactNode;

  /** Focus trap configuration */
  focusTrap?: FocusTrapConfig;

  /** Backdrop configuration */
  backdrop?: BackdropConfig;

  /** Whether modal can be closed */
  closable?: boolean;

  /** Whether to close on escape key */
  closeOnEscape?: boolean;

  /** Whether to close on outside click */
  closeOnOutsideClick?: boolean;

  /** Whether to prevent body scroll */
  preventBodyScroll?: boolean;

  /** Z-index value */
  zIndex?: number;

  /** Custom container element */
  container?: HTMLElement | string;

  /** Whether content should scroll */
  scrollable?: boolean;

  /** Maximum height */
  maxHeight?: string | number;

  /** Whether modal is loading */
  loading?: boolean;

  /** Error state */
  error?: string;

  /** Event handlers */
  onClose?: () => void;
  onOpen?: () => void;
  onEscapeKey?: () => void;
  onOutsideClick?: () => void;
  onAnimationEnd?: () => void;

  /** Custom CSS classes */
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  backdropClassName?: string;

  /** Test ID for testing */
  testId?: string;
}

/**
 * Component ref interface
 */
export interface ModalRef {
  /** Focus the modal */
  focus(): void;
  /** Close the modal */
  close(): void;
  /** Get modal element */
  getElement(): HTMLElement | null;
  /** Scroll to top */
  scrollToTop(): void;
  /** Check if modal is open */
  isOpen(): boolean;
}

/**
 * Modal context value
 */
export interface ModalContextValue {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close function */
  close: () => void;
  /** Modal ID */
  modalId: string;
  /** Size configuration */
  size: ModalSize;
  /** Variant configuration */
  variant: ModalVariant;
}

/**
 * Size configuration mapping
 */
export interface ModalSizeConfig {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

/**
 * Default size configurations
 */
export const defaultModalSizes: ModalSizeConfig = {
  xs: 'max-w-xs',
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
} as const;

/**
 * Drawer size configurations
 */
export const defaultDrawerSizes: ModalSizeConfig = {
  xs: 'w-64',
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-1/3',
  xl: 'w-1/2',
  '2xl': 'w-2/3',
  full: 'w-full',
} as const;

/**
 * Animation configuration
 */
export interface AnimationConfig {
  /** Enter animation classes */
  enter: string;
  /** Enter active animation classes */
  enterActive: string;
  /** Exit animation classes */
  exit: string;
  /** Exit active animation classes */
  exitActive: string;
  /** Animation duration */
  duration: number;
}

/**
 * Default animation configurations
 */
export const defaultAnimations: Record<ModalAnimation, AnimationConfig> = {
  fade: {
    enter: 'opacity-0',
    enterActive: 'opacity-100 transition-opacity duration-300 ease-out',
    exit: 'opacity-100',
    exitActive: 'opacity-0 transition-opacity duration-200 ease-in',
    duration: 300,
  },
  slide: {
    enter: 'translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95',
    enterActive:
      'translate-y-0 opacity-100 sm:scale-100 transition-all duration-300 ease-out',
    exit: 'translate-y-0 opacity-100 sm:scale-100',
    exitActive:
      'translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95 transition-all duration-200 ease-in',
    duration: 300,
  },
  scale: {
    enter: 'opacity-0 scale-95',
    enterActive: 'opacity-100 scale-100 transition-all duration-300 ease-out',
    exit: 'opacity-100 scale-100',
    exitActive: 'opacity-0 scale-95 transition-all duration-200 ease-in',
    duration: 300,
  },
  none: {
    enter: '',
    enterActive: '',
    exit: '',
    exitActive: '',
    duration: 0,
  },
} as const;

/**
 * Portal configuration
 */
export interface PortalConfig {
  /** Whether to use portal */
  enabled?: boolean;
  /** Portal container */
  container?: HTMLElement | string;
  /** Portal class name */
  className?: string;
}

/**
 * Keyboard navigation configuration
 */
export interface KeyboardConfig {
  /** Whether to enable keyboard navigation */
  enabled?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Trap focus within modal */
  trapFocus?: boolean;
  /** Return focus on close */
  returnFocus?: boolean;
}

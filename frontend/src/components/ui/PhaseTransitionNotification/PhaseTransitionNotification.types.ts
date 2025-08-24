import type { PhaseTransition } from '../../../utils/phaseTransitionNotifications';

export interface PhaseTransitionNotificationProps {
  /** The phase transition to display */
  transition: PhaseTransition;
  /** Whether to show detailed stats */
  showDetails?: boolean;
  /** Whether to auto-dismiss after a timeout */
  autoDismiss?: boolean;
  /** Auto-dismiss timeout in ms */
  dismissTimeout?: number;
  /** Variant for styling */
  variant?: 'toast' | 'inline' | 'modal';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether notification can be dismissed */
  dismissible?: boolean;
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Callback when notification is clicked */
  onClick?: (transition: PhaseTransition) => void;
  /** Custom className */
  className?: string;
}

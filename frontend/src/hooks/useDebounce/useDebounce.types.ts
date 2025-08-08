/**
 * Type definitions for debounce hook
 */

export interface UseDebounceOptions {
  /** The delay in milliseconds */
  delay: number;
  /** Whether to trigger on the leading edge */
  leading?: boolean;
  /** Whether to trigger on the trailing edge */
  trailing?: boolean;
  /** Maximum time to wait before forcing execution */
  maxWait?: number;
}

export interface UseDebounceReturn<T> {
  /** The debounced value */
  debouncedValue: T;
  /** Cancel the pending debounced call */
  cancel: () => void;
  /** Immediately flush the pending debounced call */
  flush: () => void;
  /** Whether there's a pending debounced call */
  isPending: boolean;
}
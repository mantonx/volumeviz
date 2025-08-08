/**
 * Type definitions for async operations hook
 */

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export interface UseAsyncOptions {
  /** Execute the async function immediately when hook is mounted */
  immediate?: boolean;
  /** Reset state when asyncFunction changes */
  resetOnChange?: boolean;
}

export interface UseAsyncReturn<T> extends AsyncState<T> {
  /** Execute the async function manually */
  execute: () => Promise<void>;
  /** Reset the state to initial values */
  reset: () => void;
  /** Whether the operation was successful */
  isSuccess: boolean;
  /** Whether there's an error */
  isError: boolean;
}

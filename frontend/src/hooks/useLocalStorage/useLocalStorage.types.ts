/**
 * Type definitions for localStorage hook
 */

export interface UseLocalStorageOptions {
  /** Custom serialization function */
  serialize?: (value: any) => string;
  /** Custom deserialization function */
  deserialize?: (value: string) => any;
  /** Sync state with localStorage changes from other tabs/windows */
  syncAcrossTabs?: boolean;
}

export type UseLocalStorageReturn<T> = [
  /** Current value */
  T,
  /** Set value function */
  (value: T | ((prevValue: T) => T)) => void,
  /** Remove value from localStorage */
  () => void,
];

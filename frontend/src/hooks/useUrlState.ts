import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UseUrlStateOptions {
  defaultValue?: any;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
  replace?: boolean;
}

/**
 * Custom hook to synchronize component state with URL search parameters
 *
 * @param key - The URL parameter key
 * @param options - Configuration options
 * @returns [value, setValue] - State value and setter function
 */
export function useUrlState<T>(
  key: string,
  options: UseUrlStateOptions = {},
): [T | undefined, (value: T | undefined) => void] {
  const {
    defaultValue,
    serialize = (value) => String(value),
    deserialize = (value) => value as T,
    replace = false,
  } = options;

  const navigate = useNavigate();
  const location = useLocation();

  // Parse initial value from URL
  const getInitialValue = useCallback((): T | undefined => {
    const params = new URLSearchParams(location.search);
    const urlValue = params.get(key);

    if (urlValue !== null) {
      try {
        return deserialize(urlValue);
      } catch (error) {
        console.warn(`Failed to deserialize URL parameter "${key}":`, error);
        return defaultValue;
      }
    }

    return defaultValue;
  }, [key, location.search, defaultValue, deserialize]);

  const [state, setState] = useState<T | undefined>(getInitialValue);

  // Update state when URL changes
  useEffect(() => {
    const newValue = getInitialValue();
    setState(newValue);
  }, [getInitialValue]);

  // Update URL when state changes
  const setValue = useCallback(
    (value: T | undefined) => {
      const params = new URLSearchParams(location.search);

      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, serialize(value));
      }

      const newSearch = params.toString();
      const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;

      if (newUrl !== `${location.pathname}${location.search}`) {
        navigate(newUrl, { replace });
      }

      setState(value);
    },
    [key, serialize, navigate, location, replace],
  );

  return [state, setValue];
}

/**
 * Hook for managing multiple URL state parameters
 */
export function useMultipleUrlState<T extends Record<string, any>>(
  keys: (keyof T)[],
  options: Partial<Record<keyof T, UseUrlStateOptions>> = {},
): [Partial<T>, (updates: Partial<T>) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialValues = useCallback((): Partial<T> => {
    const params = new URLSearchParams(location.search);
    const values: Partial<T> = {};

    keys.forEach((key) => {
      const keyOptions = options[key] || {};
      const { defaultValue, deserialize = (value: any) => value } = keyOptions;
      const urlValue = params.get(String(key));

      if (urlValue !== null) {
        try {
          values[key] = deserialize(urlValue);
        } catch (error) {
          console.warn(
            `Failed to deserialize URL parameter "${String(key)}":`,
            error,
          );
          if (defaultValue !== undefined) {
            values[key] = defaultValue;
          }
        }
      } else if (defaultValue !== undefined) {
        values[key] = defaultValue;
      }
    });

    return values;
  }, [keys, options, location.search]);

  const [state, setState] = useState<Partial<T>>(getInitialValues);

  // Update state when URL changes
  useEffect(() => {
    const newValues = getInitialValues();
    setState((prev) => {
      // Only update if there are actual changes to prevent infinite loops
      const hasChanges = keys.some((key) => prev[key] !== newValues[key]);
      return hasChanges ? newValues : prev;
    });
  }, [getInitialValues, keys]);

  const setValues = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(location.search);

      // Update params based on the provided updates
      Object.entries(updates).forEach(([key, value]) => {
        const keyOptions = options[key as keyof T] || {};
        const { serialize = (value: any) => String(value) } = keyOptions as any;

        // Compute serialized value first so we decide deletion based on output
        let serialized: any;
        try {
          serialized = serialize(value);
        } catch {
          serialized = undefined;
        }

        if (
          serialized === undefined ||
          serialized === null ||
          serialized === ''
        ) {
          params.delete(key);
        } else {
          params.set(key, serialized);
        }
      });

      const newSearch = params.toString();
      const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;

      if (newUrl !== `${location.pathname}${location.search}`) {
        navigate(newUrl, { replace: true });
      }

      setState((prev) => ({ ...prev, ...updates }));
    },
    [location, navigate, options],
  );

  return [state, setValues];
}

/**
 * Specialized hook for volume list URL state
 */
export function useVolumeListUrlState() {
  return useMultipleUrlState<{
    page: number;
    page_size: number;
    sort: string;
    q: string;
    driver: string;
    orphaned: boolean;
    system: boolean;
  }>(['page', 'page_size', 'sort', 'q', 'driver', 'orphaned', 'system'], {
    page: {
      defaultValue: 1,
      serialize: (value) => String(value),
      deserialize: (value) => parseInt(value, 10) || 1,
    },
    page_size: {
      defaultValue: 25,
      serialize: (value) => String(value),
      deserialize: (value) => parseInt(value, 10) || 25,
    },
    sort: {
      defaultValue: 'name:asc',
    },
    q: {
      defaultValue: '',
      serialize: (value) => (value ? String(value) : ''),
    },
    driver: {
      defaultValue: '',
      serialize: (value) => (value ? String(value) : ''),
    },
    orphaned: {
      defaultValue: false,
      // Only include when true
      serialize: (value) => (value ? 'true' : ''),
      deserialize: (value) => value === 'true',
    },
    system: {
      defaultValue: false,
      // Only include when true (absence means false)
      serialize: (value) => (value ? 'true' : ''),
      deserialize: (value) => value === 'true',
    },
  });
}

/**
 * Specialized hook for search URL state management
 */
export function useSearchUrlState() {
  return useMultipleUrlState<{
    q: string;
    mediaKind: string;
    mime: string[];
    minSize: number;
    maxSize: number;
    mtimeFrom: string;
    mtimeTo: string;
    durationFrom: number;
    durationTo: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    hasGps: boolean;
    hasSubs: boolean;
    hashPresent: boolean;
    page: number;
    perPage: number;
    sort: string;
    order: string;
  }>([
    'q', 'mediaKind', 'mime', 'minSize', 'maxSize', 'mtimeFrom', 'mtimeTo',
    'durationFrom', 'durationTo', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
    'hasGps', 'hasSubs', 'hashPresent', 'page', 'perPage', 'sort', 'order'
  ], {
    q: {
      defaultValue: '',
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value || '',
    },
    mediaKind: {
      defaultValue: '',
      serialize: (value) => value ? String(value) : '',
    },
    mime: {
      defaultValue: [],
      serialize: (value) => Array.isArray(value) && value.length > 0 ? value.join(',') : '',
      deserialize: (value) => value ? value.split(',').filter(Boolean) : [],
    },
    minSize: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    maxSize: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    mtimeFrom: {
      defaultValue: '',
      serialize: (value) => value ? String(value) : '',
    },
    mtimeTo: {
      defaultValue: '',
      serialize: (value) => value ? String(value) : '',
    },
    durationFrom: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    durationTo: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    minWidth: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    maxWidth: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    minHeight: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    maxHeight: {
      serialize: (value) => value ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) : undefined,
    },
    hasGps: {
      serialize: (value) => typeof value === 'boolean' ? String(value) : '',
      deserialize: (value) => value === 'true' ? true : value === 'false' ? false : undefined,
    },
    hasSubs: {
      serialize: (value) => typeof value === 'boolean' ? String(value) : '',
      deserialize: (value) => value === 'true' ? true : value === 'false' ? false : undefined,
    },
    hashPresent: {
      serialize: (value) => typeof value === 'boolean' ? String(value) : '',
      deserialize: (value) => value === 'true' ? true : value === 'false' ? false : undefined,
    },
    page: {
      defaultValue: 1,
      serialize: (value) => value && value > 1 ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) || 1 : 1,
    },
    perPage: {
      defaultValue: 20,
      serialize: (value) => value && value !== 20 ? String(value) : '',
      deserialize: (value) => value ? parseInt(value, 10) || 20 : 20,
    },
    sort: {
      defaultValue: 'name',
      serialize: (value) => value && value !== 'name' ? String(value) : '',
    },
    order: {
      defaultValue: 'asc',
      serialize: (value) => value && value !== 'asc' ? String(value) : '',
    },
  });
}

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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
  options: UseUrlStateOptions = {}
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
  const setValue = useCallback((value: T | undefined) => {
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
  }, [key, serialize, navigate, location, replace]);

  return [state, setValue];
}

/**
 * Hook for managing multiple URL state parameters
 */
export function useMultipleUrlState<T extends Record<string, any>>(
  keys: (keyof T)[],
  options: Partial<Record<keyof T, UseUrlStateOptions>> = {}
): [Partial<T>, (updates: Partial<T>) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialValues = useCallback((): Partial<T> => {
    const params = new URLSearchParams(location.search);
    const values: Partial<T> = {};

    keys.forEach((key) => {
      const keyOptions = options[key] || {};
      const { defaultValue, deserialize = (value) => value } = keyOptions;
      const urlValue = params.get(String(key));

      if (urlValue !== null) {
        try {
          values[key] = deserialize(urlValue);
        } catch (error) {
          console.warn(`Failed to deserialize URL parameter "${String(key)}":`, error);
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
    setState(newValues);
  }, [getInitialValues]);

  const setValues = useCallback((updates: Partial<T>) => {
    const params = new URLSearchParams(location.search);

    // Update params based on the provided updates
    Object.entries(updates).forEach(([key, value]) => {
      const keyOptions = options[key as keyof T] || {};
      const { serialize = (value) => String(value) } = keyOptions;

      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, serialize(value));
      }
    });

    const newSearch = params.toString();
    const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`;

    if (newUrl !== `${location.pathname}${location.search}`) {
      navigate(newUrl, { replace: true });
    }

    setState((prev) => ({ ...prev, ...updates }));
  }, [location, navigate, options]);

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
  }>(
    ['page', 'page_size', 'sort', 'q', 'driver', 'orphaned', 'system'],
    {
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
      },
      driver: {
        defaultValue: '',
      },
      orphaned: {
        serialize: (value) => value ? 'true' : 'false',
        deserialize: (value) => value === 'true',
      },
      system: {
        serialize: (value) => value ? 'true' : 'false',
        deserialize: (value) => value === 'true',
      },
    }
  );
}
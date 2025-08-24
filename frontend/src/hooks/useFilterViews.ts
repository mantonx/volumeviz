import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterConfig {
  search?: string;
  filters?: Record<string, any>;
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  columns?: string[];
}

export interface SavedView {
  id: string;
  name: string;
  config: FilterConfig;
  created_at: string;
  updated_at: string;
  is_default?: boolean;
}

export interface UseFilterViewsOptions {
  storageKey?: string;
  defaultView?: Partial<FilterConfig>;
}

export function useFilterViews(options: UseFilterViewsOptions = {}) {
  const { storageKey = 'volumeviz_filter_views', defaultView = {} } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [currentConfig, setCurrentConfig] = useState<FilterConfig>(defaultView);
  const [isModified, setIsModified] = useState(false);

  // Load saved views from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const views = JSON.parse(stored);
        setSavedViews(Array.isArray(views) ? views : []);
      }
    } catch (error) {
      console.warn('Failed to load saved views from localStorage:', error);
    }
  }, [storageKey]);

  // Save views to localStorage
  const saveViewsToStorage = useCallback(
    (views: SavedView[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(views));
        setSavedViews(views);
      } catch (error) {
        console.warn('Failed to save views to localStorage:', error);
      }
    },
    [storageKey],
  );

  // Load config from URL params
  useEffect(() => {
    const config: FilterConfig = {};

    const search = searchParams.get('search');
    if (search) config.search = search;

    const filters = searchParams.get('filters');
    if (filters) {
      try {
        config.filters = JSON.parse(filters);
      } catch (error) {
        console.warn('Failed to parse filters from URL:', error);
      }
    }

    const sort = searchParams.get('sort');
    if (sort) {
      try {
        config.sort = JSON.parse(sort);
      } catch (error) {
        console.warn('Failed to parse sort from URL:', error);
      }
    }

    const columns = searchParams.get('columns');
    if (columns) {
      try {
        config.columns = JSON.parse(columns);
      } catch (error) {
        console.warn('Failed to parse columns from URL:', error);
      }
    }

    setCurrentConfig({ ...defaultView, ...config });
  }, [searchParams, defaultView]);

  // Update URL params when config changes
  const updateUrlParams = useCallback(
    (config: FilterConfig) => {
      const params = new URLSearchParams();

      if (config.search) params.set('search', config.search);
      if (config.filters && Object.keys(config.filters).length > 0) {
        params.set('filters', JSON.stringify(config.filters));
      }
      if (config.sort && config.sort.length > 0) {
        params.set('sort', JSON.stringify(config.sort));
      }
      if (config.columns && config.columns.length > 0) {
        params.set('columns', JSON.stringify(config.columns));
      }

      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  // Update current config
  const updateConfig = useCallback(
    (updates: Partial<FilterConfig>) => {
      const newConfig = { ...currentConfig, ...updates };
      setCurrentConfig(newConfig);
      updateUrlParams(newConfig);
      setIsModified(true);
    },
    [currentConfig, updateUrlParams],
  );

  // Save current config as a named view
  const saveView = useCallback(
    async (name: string, makeDefault: boolean = false): Promise<SavedView> => {
      const newView: SavedView = {
        id: Date.now().toString(),
        name,
        config: { ...currentConfig },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_default: makeDefault,
      };

      let updatedViews = [...savedViews];

      // If making this the default, remove default from others
      if (makeDefault) {
        updatedViews = updatedViews.map((view) => ({
          ...view,
          is_default: false,
        }));
      }

      updatedViews.push(newView);
      saveViewsToStorage(updatedViews);
      setIsModified(false);

      return newView;
    },
    [currentConfig, savedViews, saveViewsToStorage],
  );

  // Update an existing view
  const updateView = useCallback(
    async (
      viewId: string,
      updates: Partial<Pick<SavedView, 'name' | 'config' | 'is_default'>>,
    ): Promise<SavedView | null> => {
      const viewIndex = savedViews.findIndex((view) => view.id === viewId);
      if (viewIndex === -1) return null;

      let updatedViews = [...savedViews];

      // If making this the default, remove default from others
      if (updates.is_default) {
        updatedViews = updatedViews.map((view) => ({
          ...view,
          is_default: false,
        }));
      }

      const updatedView: SavedView = {
        ...savedViews[viewIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      updatedViews[viewIndex] = updatedView;
      saveViewsToStorage(updatedViews);

      return updatedView;
    },
    [savedViews, saveViewsToStorage],
  );

  // Delete a view
  const deleteView = useCallback(
    async (viewId: string): Promise<void> => {
      const updatedViews = savedViews.filter((view) => view.id !== viewId);
      saveViewsToStorage(updatedViews);
    },
    [savedViews, saveViewsToStorage],
  );

  // Load a saved view
  const loadView = useCallback(
    async (view: SavedView): Promise<void> => {
      setCurrentConfig(view.config);
      updateUrlParams(view.config);
      setIsModified(false);
    },
    [updateUrlParams],
  );

  // Reset to default view
  const resetToDefault = useCallback(() => {
    const defaultViewConfig =
      savedViews.find((view) => view.is_default)?.config || defaultView;
    setCurrentConfig(defaultViewConfig);
    updateUrlParams(defaultViewConfig);
    setIsModified(false);
  }, [savedViews, defaultView, updateUrlParams]);

  // Generate shareable URL
  const getShareableUrl = useCallback(
    (config: FilterConfig = currentConfig): string => {
      const url = new URL(window.location.href);
      const params = new URLSearchParams();

      if (config.search) params.set('search', config.search);
      if (config.filters && Object.keys(config.filters).length > 0) {
        params.set('filters', JSON.stringify(config.filters));
      }
      if (config.sort && config.sort.length > 0) {
        params.set('sort', JSON.stringify(config.sort));
      }
      if (config.columns && config.columns.length > 0) {
        params.set('columns', JSON.stringify(config.columns));
      }

      url.search = params.toString();
      return url.toString();
    },
    [currentConfig],
  );

  // Copy shareable URL to clipboard
  const copyShareableUrl = useCallback(
    async (config: FilterConfig = currentConfig): Promise<boolean> => {
      try {
        const url = getShareableUrl(config);
        await navigator.clipboard.writeText(url);
        return true;
      } catch (error) {
        console.warn('Failed to copy URL to clipboard:', error);
        return false;
      }
    },
    [getShareableUrl, currentConfig],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    const clearedConfig = { ...defaultView };
    setCurrentConfig(clearedConfig);
    updateUrlParams(clearedConfig);
    setIsModified(false);
  }, [defaultView, updateUrlParams]);

  return {
    // State
    savedViews,
    currentConfig,
    isModified,

    // Actions
    updateConfig,
    saveView,
    updateView,
    deleteView,
    loadView,
    resetToDefault,
    clearFilters,

    // Sharing
    getShareableUrl,
    copyShareableUrl,
  };
}

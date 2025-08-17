/**
 * useFilterMetadata Hook
 * 
 * Provides filter metadata (MIME types, media kinds, extensions) from the backend
 */

import { useState, useEffect, useCallback } from 'react';
import { metadataApi, type FilterMetadataResponse } from '@/api/metadata';

export interface UseFilterMetadataResult {
  mimeTypes: Array<{ value: string; label: string; fileCount: number }>;
  mediaKinds: Array<{ value: string; label: string; fileCount: number }>;
  extensions: Array<{ value: string; label: string; fileCount: number }>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// Simple cache to avoid repeated requests
let cachedData: FilterMetadataResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function useFilterMetadata(): UseFilterMetadataResult {
  const [data, setData] = useState<FilterMetadataResponse | null>(cachedData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    // Check if we have valid cached data
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp < CACHE_DURATION)) {
      setData(cachedData);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await metadataApi.getFilterMetadata();
      cachedData = response;
      cacheTimestamp = now;
      setData(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch filter metadata');
      setError(error);
      console.error('Failed to fetch filter metadata:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    // Force refresh by clearing cache
    cachedData = null;
    cacheTimestamp = 0;
    fetchData();
  }, [fetchData]);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform the data to match frontend expectations
  const mimeTypes = data?.mime_types?.map(mt => ({
    value: mt.value,
    label: mt.label,
    fileCount: mt.file_count,
  })) || [];

  const mediaKinds = data?.media_kinds?.map(mk => ({
    value: mk.value,
    label: mk.label,
    fileCount: mk.file_count,
  })) || [];

  const extensions = data?.extensions?.map(ext => ({
    value: ext.value,
    label: ext.label,
    fileCount: ext.file_count,
  })) || [];

  return {
    mimeTypes,
    mediaKinds,
    extensions,
    isLoading,
    error,
    refetch,
  };
}
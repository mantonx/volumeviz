/**
 * useThumbnailPreference Hook
 *
 * Manages user preference for showing thumbnails with localStorage persistence
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'volumeviz-show-thumbnails';

export function useThumbnailPreference(defaultValue: boolean = false) {
  const [showThumbnails, setShowThumbnails] = useState<boolean>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.warn(
          'Failed to read thumbnail preference from localStorage:',
          error,
        );
      }
    }
    return defaultValue;
  });

  // Update localStorage when preference changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(showThumbnails));
      } catch (error) {
        console.warn(
          'Failed to save thumbnail preference to localStorage:',
          error,
        );
      }
    }
  }, [showThumbnails]);

  const toggleThumbnails = () => {
    setShowThumbnails((prev) => !prev);
  };

  const setThumbnails = (value: boolean) => {
    setShowThumbnails(value);
  };

  return {
    showThumbnails,
    toggleThumbnails,
    setThumbnails,
  };
}

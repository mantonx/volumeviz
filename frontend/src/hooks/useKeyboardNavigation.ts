import { useEffect, useCallback, useRef } from 'react';
import { useExplorerNavigation, useExplorerSelection } from './useExplorerNavigation';

export interface UseKeyboardNavigationOptions {
  /** Items available for navigation */
  items: Array<{ id: string; name: string; path: string; type: 'file' | 'directory' }>;
  /** Currently focused item index */
  focusedIndex?: number;
  /** Called when focus changes */
  onFocusChange?: (index: number) => void;
  /** Called when an item is activated (Enter key) */
  onItemActivate?: (item: { id: string; name: string; path: string; type: 'file' | 'directory' }) => void;
  /** Enable keyboard navigation */
  enabled?: boolean;
}

export interface UseKeyboardNavigationReturn {
  /** Current focused item index */
  focusedIndex: number;
  /** Set focused item index */
  setFocusedIndex: (index: number) => void;
  /** Whether keyboard navigation is active */
  isActive: boolean;
  /** Focus the container element */
  focus: () => void;
  /** Ref for the container element */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for keyboard navigation in file explorer
 * Provides arrow key navigation, selection, and activation
 */
export function useKeyboardNavigation({
  items,
  focusedIndex = 0,
  onFocusChange,
  onItemActivate,
  enabled = true,
}: UseKeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef(focusedIndex);
  const isActiveRef = useRef(false);
  
  const { navigateToPath, goBack, setSearchQuery } = useExplorerNavigation();
  const { toggleItem, selectAll, selectNone } = useExplorerSelection();
  
  // Update focused index ref when prop changes
  focusedIndexRef.current = focusedIndex;
  
  const setFocusedIndex = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));
    focusedIndexRef.current = clampedIndex;
    onFocusChange?.(clampedIndex);
  }, [items.length, onFocusChange]);
  
  const focus = useCallback(() => {
    containerRef.current?.focus();
    isActiveRef.current = true;
  }, []);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || items.length === 0) return;
    
    const currentIndex = focusedIndexRef.current;
    const currentItem = items[currentIndex];
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(currentIndex + 1);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(currentIndex - 1);
        break;
        
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
        
      case 'End':
        event.preventDefault();
        setFocusedIndex(items.length - 1);
        break;
        
      case 'PageDown':
        event.preventDefault();
        setFocusedIndex(Math.min(currentIndex + 10, items.length - 1));
        break;
        
      case 'PageUp':
        event.preventDefault();
        setFocusedIndex(Math.max(currentIndex - 10, 0));
        break;
        
      case 'Enter':
        event.preventDefault();
        if (currentItem) {
          if (currentItem.type === 'directory') {
            navigateToPath(currentItem.path);
          }
          onItemActivate?.(currentItem);
        }
        break;
        
      case ' ':
        event.preventDefault();
        if (currentItem) {
          toggleItem(currentItem.id);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        containerRef.current?.blur();
        isActiveRef.current = false;
        break;
        
      case 'Backspace':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          goBack();
        }
        break;
        
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAll(items.map(item => item.id));
        }
        break;
        
      case 'd':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectNone();
        }
        break;
        
      case 'f':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Focus search - this would typically be handled by the search component
          const searchInput = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
          searchInput?.focus();
        }
        break;
        
      case '/':
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          const searchInput = document.querySelector('[data-testid="search-input"]') as HTMLInputElement;
          searchInput?.focus();
        }
        break;
        
      default:
        // Handle alphanumeric keys for quick navigation
        if (event.key.length === 1 && event.key.match(/[a-zA-Z0-9]/)) {
          const char = event.key.toLowerCase();
          const startIndex = (currentIndex + 1) % items.length;
          
          // Find next item starting with the typed character
          for (let i = 0; i < items.length; i++) {
            const itemIndex = (startIndex + i) % items.length;
            const item = items[itemIndex];
            if (item.name.toLowerCase().startsWith(char)) {
              setFocusedIndex(itemIndex);
              break;
            }
          }
        }
        break;
    }
  }, [
    enabled,
    items,
    setFocusedIndex,
    navigateToPath,
    goBack,
    toggleItem,
    selectAll,
    selectNone,
    onItemActivate,
  ]);
  
  const handleFocus = useCallback(() => {
    isActiveRef.current = true;
  }, []);
  
  const handleBlur = useCallback(() => {
    isActiveRef.current = false;
  }, []);
  
  // Set up keyboard event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleFocus, handleBlur, enabled]);
  
  // Auto-clamp focused index when items change
  useEffect(() => {
    if (items.length === 0) {
      setFocusedIndex(0);
    } else if (focusedIndexRef.current >= items.length) {
      setFocusedIndex(items.length - 1);
    }
  }, [items.length, setFocusedIndex]);
  
  return {
    focusedIndex: focusedIndexRef.current,
    setFocusedIndex,
    isActive: isActiveRef.current,
    focus,
    containerRef,
  };
}

/**
 * Hook for managing keyboard shortcuts in the explorer
 */
export function useExplorerKeyboardShortcuts(enabled = true) {
  const { goBack, setViewMode } = useExplorerNavigation();
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only handle global shortcuts when not focused on input elements
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }
      
      switch (event.key) {
        case '1':
          if (event.altKey) {
            event.preventDefault();
            setViewMode('list');
          }
          break;
          
        case '2':
          if (event.altKey) {
            event.preventDefault();
            setViewMode('grid');
          }
          break;
          
        case '3':
          if (event.altKey) {
            event.preventDefault();
            setViewMode('treemap');
          }
          break;
          
        case 'ArrowLeft':
          if (event.altKey) {
            event.preventDefault();
            goBack();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [enabled, goBack, setViewMode]);
}
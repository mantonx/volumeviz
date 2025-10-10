/**
 * SearchAutocomplete Component
 *
 * Intelligent search suggestions with autocomplete functionality
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchApi, type SearchSuggestion } from '@/api/search';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SearchAutocomplete: React.FC<SearchAutocompleteProps> = ({
  value,
  onChange,
  onSuggestionSelect,
  placeholder = 'Search files, folders, and metadata...',
  className = '',
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce search input to avoid excessive API calls
  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    if (debouncedValue.length >= 2) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [debouncedValue]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    try {
      setLoading(true);
      const response = await searchApi.getSearchSuggestions({
        q: query,
        limit: 8,
      });

      // Add null checks for response and suggestions
      const suggestions = response?.suggestions || [];
      setSuggestions(suggestions);
      setIsOpen(suggestions.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setSelectedIndex(-1);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            selectSuggestion(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex],
  );

  const selectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      let newValue = suggestion.text;

      // Smart insertion based on suggestion type
      if (suggestion.type === 'filter') {
        // For filters, append to existing query
        newValue = value.trim()
          ? `${value.trim()} ${suggestion.text}`
          : suggestion.text;
      } else if (suggestion.type === 'extension') {
        // For extensions, replace or append
        newValue = suggestion.text;
      }

      onChange(newValue);
      setIsOpen(false);
      setSelectedIndex(-1);

      if (onSuggestionSelect) {
        onSuggestionSelect(suggestion);
      }

      // Focus back to input
      inputRef.current?.focus();
    },
    [value, onChange, onSuggestionSelect],
  );

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'filename':
        return '📄';
      case 'extension':
        return '🏷️';
      case 'path':
        return '📁';
      case 'filter':
        return '🔍';
      case 'recent':
        return '🕒';
      default:
        return '💡';
    }
  };

  const getSuggestionTypeLabel = (type: string) => {
    switch (type) {
      case 'filename':
        return 'File';
      case 'extension':
        return 'Extension';
      case 'path':
        return 'Path';
      case 'filter':
        return 'Filter';
      case 'recent':
        return 'Recent';
      default:
        return 'Suggestion';
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 bg-surface-secondary border-line text-primary pr-10"
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-line rounded-lg shadow-lg max-h-80 overflow-y-auto">
          <ul ref={listRef} className="py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.type}-${suggestion.text}-${index}`}
                onClick={() => selectSuggestion(suggestion)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {getSuggestionIcon(suggestion.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {suggestion.text}
                      </div>
                      {suggestion.description && (
                        <div className="text-xs text-tertiary truncate">
                          {suggestion.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {suggestion.count && (
                      <span className="text-xs text-tertiary">
                        {suggestion.count.toLocaleString()}
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 bg-surface-secondary text-secondary rounded-full">
                      {getSuggestionTypeLabel(suggestion.type)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Keyboard hints */}
          <div className="px-4 py-2 border-t border-line bg-surface-secondary">
            <div className="text-xs text-tertiary flex items-center justify-between">
              <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
              <span>
                {suggestions.length} suggestion
                {suggestions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAutocomplete;

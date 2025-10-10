/**
 * SavedSearchPanel Component
 *
 * Manages saved searches with create, edit, delete, and run functionality
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useSavedSearches } from '@/hooks/useSearch';
import { searchQueryAtom, advancedFiltersAtom } from '@/atoms/search';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { SavedSearch, CreateSavedSearchRequest } from '@/api/search';

interface SavedSearchPanelProps {
  className?: string;
}

interface SavedSearchFormProps {
  initialData?: Partial<CreateSavedSearchRequest>;
  onSave: (data: CreateSavedSearchRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Form for creating/editing saved searches
const SavedSearchForm: React.FC<SavedSearchFormProps> = ({
  initialData,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [formData, setFormData] = useState<CreateSavedSearchRequest>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    query: initialData?.query || {},
    tags: initialData?.tags || [],
    is_public: initialData?.is_public || false,
    metadata: initialData?.metadata || {},
  });

  const [tagInput, setTagInput] = useState('');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return;

      await onSave(formData);
    },
    [formData, onSave],
  );

  const addTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim().toLowerCase();
      if (trimmedTag && !formData.tags.includes(trimmedTag)) {
        setFormData((prev) => ({
          ...prev,
          tags: [...prev.tags, trimmedTag],
        }));
      }
      setTagInput('');
    },
    [formData.tags],
  );

  const removeTag = useCallback((tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  }, []);

  const handleTagKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(tagInput);
      }
    },
    [tagInput, addTag],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 bg-surface-secondary border-line text-primary"
          placeholder="My saved search"
          required
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, description: e.target.value }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 bg-surface-secondary border-line text-primary"
          placeholder="Describe what this search finds..."
          rows={3}
          disabled={loading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary mb-1">
          Tags
        </label>
        <div className="space-y-2">
          <div className="flex space-x-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 bg-surface-secondary border-line text-primary"
              placeholder="Add tags..."
              disabled={loading}
            />
            <Button
              type="button"
              onClick={() => addTag(tagInput)}
              disabled={!tagInput.trim() || loading}
              variant="outline"
              size="sm"
            >
              Add
            </Button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                    disabled={loading}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_public}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, is_public: e.target.checked }))
            }
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={loading}
          />
          <span className="ml-2 text-sm text-gray-700">
            Make this search public
          </span>
        </label>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button
          type="submit"
          disabled={!formData.name.trim() || loading}
          className="flex-1"
        >
          {loading ? 'Saving...' : 'Save Search'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export const SavedSearchPanel: React.FC<SavedSearchPanelProps> = ({
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [currentQuery] = useAtom(searchQueryAtom);
  const currentFilters = useAtomValue(advancedFiltersAtom);

  const {
    savedSearches,
    loading,
    error,
    hasSavedSearches,
    fetchSavedSearches,
    createSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    runSavedSearch,
    duplicateSavedSearch,
    exportSavedSearch,
    getAllTags,
    filterByTags,
  } = useSavedSearches();

  // Load saved searches on mount
  useEffect(() => {
    if (isOpen && !hasSavedSearches) {
      fetchSavedSearches();
    }
  }, [isOpen, hasSavedSearches, fetchSavedSearches]);

  // Handle creating new saved search
  const handleCreateSearch = useCallback(
    async (data: CreateSavedSearchRequest) => {
      try {
        // Include current query and filters
        const searchData = {
          ...data,
          query: {
            ...currentQuery,
            filters: currentFilters,
          },
        };

        await createSavedSearch(searchData);
        setShowForm(false);
      } catch (err) {
        console.error('Failed to create saved search:', err);
      }
    },
    [createSavedSearch, currentQuery, currentFilters],
  );

  // Handle updating saved search
  const handleUpdateSearch = useCallback(
    async (data: CreateSavedSearchRequest) => {
      if (!editingSearch) return;

      try {
        await updateSavedSearch(editingSearch.id, data);
        setEditingSearch(null);
        setShowForm(false);
      } catch (err) {
        console.error('Failed to update saved search:', err);
      }
    },
    [editingSearch, updateSavedSearch],
  );

  // Handle running saved search
  const handleRunSearch = useCallback(
    async (search: SavedSearch) => {
      try {
        await runSavedSearch(search.id);
        setIsOpen(false); // Close panel after running search
      } catch (err) {
        console.error('Failed to run saved search:', err);
      }
    },
    [runSavedSearch],
  );

  // Handle deleting saved search
  const handleDeleteSearch = useCallback(
    async (search: SavedSearch) => {
      if (!confirm(`Are you sure you want to delete "${search.name}"?`)) return;

      try {
        await deleteSavedSearch(search.id);
      } catch (err) {
        console.error('Failed to delete saved search:', err);
      }
    },
    [deleteSavedSearch],
  );

  // Handle duplicating saved search
  const handleDuplicateSearch = useCallback(
    async (search: SavedSearch) => {
      try {
        await duplicateSavedSearch(search.id);
      } catch (err) {
        console.error('Failed to duplicate saved search:', err);
      }
    },
    [duplicateSavedSearch],
  );

  // Get filtered searches
  const filteredSearches =
    selectedTags.length > 0 ? filterByTags(selectedTags) : savedSearches;

  // Get available tags
  const availableTags = getAllTags();

  // Format run count and last run date
  const formatLastRun = (lastRunAt: string | null, runCount: number) => {
    if (!lastRunAt) return `Never run (${runCount} total)`;
    const date = new Date(lastRunAt).toLocaleDateString();
    return `Last run ${date} (${runCount} total)`;
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className={`flex items-center space-x-2 ${className}`}
      >
        <span>📋</span>
        <span>Saved Searches</span>
      </Button>
    );
  }

  return (
    <div className={`saved-search-panel ${className}`}>
      <Card className="w-96 max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary">
              Saved Searches
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setShowForm(true)}
                size="sm"
                className="flex items-center space-x-1"
              >
                <span>+</span>
                <span>Save Current</span>
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                variant="outline"
                size="sm"
              >
                ×
              </Button>
            </div>
          </div>

          {/* Tag Filter */}
          {availableTags.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTags((prev) =>
                        prev.includes(tag)
                          ? prev.filter((t) => t !== tag)
                          : [...prev, tag],
                      );
                    }}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {showForm && (
            <div className="p-4 border-b border-gray-200">
              <SavedSearchForm
                initialData={editingSearch || undefined}
                onSave={editingSearch ? handleUpdateSearch : handleCreateSearch}
                onCancel={() => {
                  setShowForm(false);
                  setEditingSearch(null);
                }}
                loading={loading}
              />
            </div>
          )}

          {error && (
            <div className="p-4 text-red-600 text-sm">Error: {error}</div>
          )}

          {loading && (
            <div className="p-4 text-center text-gray-500">
              Loading saved searches...
            </div>
          )}

          {!loading && !error && filteredSearches.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {selectedTags.length > 0
                ? 'No searches match the selected tags.'
                : 'No saved searches yet.'}
            </div>
          )}

          {!loading && !error && filteredSearches.length > 0 && (
            <div className="divide-y divide-line">
              {filteredSearches.map((search) => (
                <div key={search.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-primary truncate">
                        {search.name}
                      </h4>
                      {search.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {search.description}
                        </p>
                      )}

                      {/* Tags */}
                      {search.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {search.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="text-xs text-gray-400 mt-2">
                        {formatLastRun(search.last_run_at, search.run_count)}
                        {search.is_public && (
                          <span className="ml-2">• Public</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 ml-2">
                      <Button
                        onClick={() => handleRunSearch(search)}
                        size="sm"
                        className="px-2 py-1 text-xs"
                      >
                        Run
                      </Button>
                      <div className="relative group">
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-2 py-1 text-xs"
                        >
                          •••
                        </Button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            onClick={() => {
                              setEditingSearch(search);
                              setShowForm(true);
                            }}
                            className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDuplicateSearch(search)}
                            className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => exportSavedSearch(search)}
                            className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100"
                          >
                            Export
                          </button>
                          <button
                            onClick={() => handleDeleteSearch(search)}
                            className="block w-full px-3 py-2 text-left text-xs text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

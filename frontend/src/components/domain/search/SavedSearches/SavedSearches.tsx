/**
 * SavedSearches - Component for managing and executing saved searches
 *
 * Features:
 * - List all saved searches with metadata
 * - Quick execute saved search
 * - Create new saved search
 * - Edit and delete existing searches
 * - Tag management for organization
 * - Search execution count tracking
 */

import React, { useState } from 'react';
import {
  Bookmark,
  Play,
  Edit2,
  Trash2,
  Clock,
  Tag,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import type { SavedSearch, SearchFilters } from './SavedSearches.types';

interface SavedSearchesProps {
  onExecuteSearch?: (filters: SearchFilters) => void;
  className?: string;
}

export const SavedSearches: React.FC<SavedSearchesProps> = ({
  onExecuteSearch,
  className = '',
}) => {
  const {
    savedSearches,
    isLoading,
    createSearch,
    updateSearch,
    deleteSearch,
    runSearch,
  } = useSavedSearches();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [newSearchName, setNewSearchName] = useState('');
  const [newSearchDescription, setNewSearchDescription] = useState('');
  const [newSearchTags, setNewSearchTags] = useState<string[]>([]);

  const handleCreateSearch = async () => {
    if (!newSearchName.trim()) return;

    await createSearch({
      name: newSearchName,
      description: newSearchDescription,
      filters: {}, // TODO: Get current filters from parent
      tags: newSearchTags,
    });

    // Reset form
    setNewSearchName('');
    setNewSearchDescription('');
    setNewSearchTags([]);
    setIsCreateModalOpen(false);
  };

  const handleExecuteSearch = async (search: SavedSearch) => {
    const results = await runSearch(search.id);
    if (onExecuteSearch && search.filters) {
      onExecuteSearch(search.filters);
    }
  };

  const handleDeleteSearch = async (id: number) => {
    if (confirm('Are you sure you want to delete this saved search?')) {
      await deleteSearch(id);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">
            Loading saved searches...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={className}>
      <Card>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bookmark className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Saved Searches
              </h2>
              <span className="text-sm text-gray-500">
                ({savedSearches.length})
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Save Current Search
            </Button>
          </div>

          {/* Saved Searches List */}
          {savedSearches.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No saved searches yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Save your frequently used searches for quick access
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Your First Search
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {search.name}
                      </h3>
                      {search.tags && search.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {search.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {search.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {search.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {search.last_used_at
                          ? `Last used ${new Date(search.last_used_at).toLocaleDateString()}`
                          : 'Never used'}
                      </span>
                      {search.execution_count !== undefined && (
                        <span>Executed {search.execution_count} times</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleExecuteSearch(search)}
                      className="flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingSearch(search)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSearch(search.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Create Search Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Save Search"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Name *
            </label>
            <input
              type="text"
              value={newSearchName}
              onChange={(e) => setNewSearchName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Large Video Files"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={newSearchDescription}
              onChange={(e) => setNewSearchDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what this search finds..."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={newSearchTags.join(', ')}
              onChange={(e) =>
                setNewSearchTags(
                  e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., videos, cleanup, large-files"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSearch}
              disabled={!newSearchName.trim()}
            >
              Save Search
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SavedSearches;

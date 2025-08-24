import React, { useState } from 'react';
import { Save, Share, Settings, Trash2, Star, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils';
import type { SavedView } from '@/hooks/useFilterViews';

interface SavedViewsManagerProps {
  savedViews: SavedView[];
  currentView?: SavedView | null;
  isModified: boolean;
  onSaveView: (name: string, makeDefault?: boolean) => Promise<SavedView>;
  onUpdateView: (
    viewId: string,
    updates: Partial<Pick<SavedView, 'name' | 'config' | 'is_default'>>,
  ) => Promise<SavedView | null>;
  onDeleteView: (viewId: string) => Promise<void>;
  onLoadView: (view: SavedView) => Promise<void>;
  onCopyShareableUrl: () => Promise<boolean>;
  className?: string;
}

export const FilterViewsManager: React.FC<SavedViewsManagerProps> = ({
  savedViews,
  currentView,
  isModified,
  onSaveView,
  onUpdateView,
  onDeleteView,
  onLoadView,
  onCopyShareableUrl,
  className,
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showViewsList, setShowViewsList] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [editingView, setEditingView] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;

    setSaving(true);
    try {
      await onSaveView(newViewName.trim(), makeDefault);
      setShowSaveDialog(false);
      setNewViewName('');
      setMakeDefault(false);
    } catch (error) {
      console.error('Failed to save view:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateView = async (
    viewId: string,
    updates: Partial<Pick<SavedView, 'name' | 'is_default'>>,
  ) => {
    try {
      await onUpdateView(viewId, updates);
      setEditingView(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update view:', error);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (window.confirm('Are you sure you want to delete this saved view?')) {
      try {
        await onDeleteView(viewId);
      } catch (error) {
        console.error('Failed to delete view:', error);
      }
    }
  };

  const handleCopyUrl = async () => {
    const success = await onCopyShareableUrl();
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const startEditing = (view: SavedView) => {
    setEditingView(view.id);
    setEditingName(view.name);
  };

  const cancelEditing = () => {
    setEditingView(null);
    setEditingName('');
  };

  const saveEditing = () => {
    if (editingView && editingName.trim()) {
      handleUpdateView(editingView, { name: editingName.trim() });
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-2">
        {/* Save Current View */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          disabled={!isModified}
        >
          <Save className="h-4 w-4 mr-2" />
          Save View
        </Button>

        {/* Saved Views Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowViewsList(!showViewsList)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Views ({savedViews.length})
          </Button>

          {showViewsList && (
            <Card className="absolute top-full mt-1 right-0 z-50 w-80 max-h-96 overflow-y-auto">
              <div className="p-3 border-b">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Saved Views
                </h3>
              </div>

              <div className="p-2 space-y-1">
                {savedViews.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    No saved views yet
                  </div>
                ) : (
                  savedViews.map((view) => (
                    <div
                      key={view.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800',
                        currentView?.id === view.id &&
                          'bg-blue-50 dark:bg-blue-900/20',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        {editingView === view.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="text-sm h-6 px-2"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditing();
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={saveEditing}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditing}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => onLoadView(view)}
                            className="text-left w-full"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {view.name}
                              </span>
                              {view.is_default && (
                                <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(view.created_at).toLocaleDateString()}
                            </div>
                          </button>
                        )}
                      </div>

                      {editingView !== view.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(view)}
                            className="h-6 w-6 p-0"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleUpdateView(view.id, {
                                is_default: !view.is_default,
                              })
                            }
                            className={cn(
                              'h-6 w-6 p-0',
                              view.is_default && 'text-yellow-500',
                            )}
                          >
                            <Star className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteView(view.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Share URL */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyUrl}
          className={cn(copySuccess && 'text-green-600')}
        >
          {copySuccess ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Share className="h-4 w-4 mr-2" />
          )}
          {copySuccess ? 'Copied!' : 'Share'}
        </Button>
      </div>

      {/* Save View Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Save Current View
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    View Name
                  </label>
                  <Input
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    placeholder="Enter view name..."
                    className="w-full"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="make-default"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <label
                    htmlFor="make-default"
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    Make this my default view
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setNewViewName('');
                    setMakeDefault(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveView}
                  disabled={!newViewName.trim() || saving}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save View
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Click outside to close views list */}
      {showViewsList && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowViewsList(false)}
        />
      )}
    </div>
  );
};

/**
 * FilesPage - Unified file browsing and search interface
 *
 * Combines Explorer (browse files) and Search (find files) into a single intuitive page.
 * Users can switch between Browse and Search modes via tabs.
 */

import React, { useState } from 'react';
import { FolderOpen, Search } from 'lucide-react';
import { ExplorerPage } from '@/pages/ExplorerPage';
import { SearchPage } from '@/pages/SearchPage';

type ViewMode = 'browse' | 'search';

export const FilesPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');

  return (
    <div className="min-h-screen bg-gray-50 bg-surface">
      {/* Tab Navigation */}
      <div className="bg-surface border-b border-line">
        <div className="px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setViewMode('browse')}
              className={`
                flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                ${
                  viewMode === 'browse'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 text-tertiary hover:text-secondary'
                }
              `}
            >
              <FolderOpen className="w-4 h-4" />
              Browse Files
            </button>

            <button
              onClick={() => setViewMode('search')}
              className={`
                flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors
                ${
                  viewMode === 'search'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 text-tertiary hover:text-secondary'
                }
              `}
            >
              <Search className="w-4 h-4" />
              Search Files
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {viewMode === 'browse' ? <ExplorerPage /> : <SearchPage />}
      </div>
    </div>
  );
};

export default FilesPage;

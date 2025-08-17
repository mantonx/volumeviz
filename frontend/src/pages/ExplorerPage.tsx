/**
 * Explorer Page - Main file system exploration interface
 *
 * Provides comprehensive file system browsing with:
 * - Left panel: Lazy-loading directory tree
 * - Right panel: Virtualized file table
 * - Drawer: File metadata with raw JSON
 * - Real-time updates via WebSocket
 */

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useWebSocket } from '@/providers/WebSocketProvider';
import {
    currentPathAtom,
    searchQueryAtom,
} from '@/store/api-state';
import { useAtom } from 'jotai';
import { FileIcon, FolderIcon, SearchIcon } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

// Types
interface ExplorerPageProps {
  className?: string;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  extension?: string;
  mediaType?: string;
}

export function ExplorerPage({ className = '' }: ExplorerPageProps) {
  const { volumeId } = useParams<{ volumeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // State management
  const [currentPath, setCurrentPath] = useAtom(currentPathAtom);
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);

  // Local state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [files] = useState<FileItem[]>([]);

  // WebSocket connection for real-time updates
  const { status: wsStatus } = useWebSocket();

  // URL synchronization
  React.useEffect(() => {
    const path = searchParams.get('path') || '/';
    const search = searchParams.get('search') || '';

    setCurrentPath(path);
    setSearchQuery(search);
  }, [searchParams, setCurrentPath, setSearchQuery]);

  // Handle search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (query === '') {
        params.delete('search');
      } else {
        params.set('search', query);
      }
      return params;
    });
  }, [setSearchQuery, setSearchParams]);

  if (!volumeId) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Volume Explorer
          </h1>
          <p className="text-gray-600">
            Select a volume to explore its contents
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`container mx-auto py-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Volume Explorer
            </h1>
            <p className="mt-2 text-gray-600">
              Browse and analyze files in volume: <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{volumeId}</span>
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {wsStatus === 'connected' && (
              <div className="flex items-center text-green-600 text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full mr-2" />
                Live Updates
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search files and folders..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Main Explorer Layout */}
      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-240px)]">
        {/* Left Panel: Directory Tree */}
        <div className="col-span-3">
          <Card className="h-full p-4">
            <div className="flex items-center gap-2 mb-4">
              <FolderIcon className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Directory Tree</h2>
            </div>

            {/* Tree will be implemented as a separate component */}
            <div className="text-sm text-gray-500">
              <div className="space-y-1">
                <div className="flex items-center gap-1 p-1 hover:bg-gray-50 rounded cursor-pointer">
                  <FolderIcon className="h-4 w-4" />
                  <span>root</span>
                </div>
                <div className="ml-4 space-y-1 text-gray-400">
                  <div>📁 Tree component coming next...</div>
                  <div>🔄 Lazy loading</div>
                  <div>🎯 Path navigation</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Panel: File Table */}
        <div className={`${drawerOpen ? 'col-span-6' : 'col-span-9'} transition-all duration-300`}>
          <Card className="h-full p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileIcon className="h-5 w-5 text-green-600" />
                <h2 className="font-semibold text-gray-900">Files</h2>
                <span className="text-sm text-gray-500">in {currentPath}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Sort
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Filter
                </Button>
              </div>
            </div>

            {/* File table will be implemented as a separate component */}
            <div className="text-sm text-gray-500">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                <div className="space-y-2">
                  <div>📋 Virtualized file table coming next...</div>
                  <div>⚡ High performance rendering</div>
                  <div>🔍 Advanced filtering & sorting</div>
                  <div>📊 Column customization</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Drawer: File Metadata */}
        {drawerOpen && (
          <div className="col-span-3">
            <Card className="h-full p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">File Details</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  ✕
                </Button>
              </div>

              {/* File metadata drawer will be implemented */}
              <div className="text-sm text-gray-500">
                <div className="space-y-2">
                  <div>📄 File metadata display</div>
                  <div>🔍 Raw JSON viewer</div>
                  <div>🏷️ Normalized fields</div>
                  <div>📊 Media properties</div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>{files.length} items</span>
          <span>Path: {currentPath}</span>
        </div>
        <div className="flex items-center gap-4">
          {wsStatus === 'connected' && <span>🔄 Live updates active</span>}
        </div>
      </div>
    </div>
  );
}

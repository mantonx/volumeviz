/**
 * ExplorerView Component
 *
 * Main explorer interface with lazy-loading tree, virtualized file table,
 * file metadata drawer, volume insights charts, and alert center.
 */

import React, { useCallback, useState } from 'react';
import { SearchIcon, BarChart3Icon, BellIcon, List, Grid3X3 } from 'lucide-react';
import { DirectoryTree } from './DirectoryTree';
import { FileTable } from './FileTable';
import { FileGrid } from './FileGrid/FileGrid';
import { ViewToggle, type ViewType } from '@/components/ui/ViewToggle';
import { FileDrawer } from './FileDrawer';
import { VolumeCharts } from './Charts';
import { AlertCenter } from './AlertCenter';
import { useRealtime } from '@/providers/realtime';
import { ReadyState } from 'react-use-websocket';
import type { FileItem } from './VirtualizedFileTable/VirtualizedFileTable.types';

interface ExplorerViewProps {
  volumeId: string;
  volumeName: string;
  className?: string;
}

// Adapts the explorer's FileItem (from the real /explorer/files API) to the
// shape FileDrawer expects. FileDrawer's richer fields (duration, codec, raw
// metadata, etc.) require a separate per-file metadata fetch that isn't wired
// up yet — this only shows what's already available from the file list.
function toDrawerMetadata(file: FileItem) {
  return {
    id: String(file.id ?? file.path),
    name: file.name,
    path: file.path,
    size: file.size ?? 0,
    type: file.media_type ?? (file.is_directory ? 'directory' : 'file'),
    extension: file.extension,
    mediaType: file.media_type,
    created: file.modified_time ?? '',
    modified: file.modified_time ?? '',
  };
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  volumeId,
  volumeName,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [activeTab, setActiveTab] = useState<
    'explorer' | 'insights' | 'alerts'
  >('explorer');
  const [viewMode, setViewMode] = useState<ViewType>('list');

  const { connectionStatus } = useRealtime();
  const wsStatus = React.useMemo(() => {
    switch (connectionStatus) {
      case ReadyState.CONNECTING:
        return 'connecting';
      case ReadyState.OPEN:
        return 'connected';
      case ReadyState.CLOSING:
        return 'disconnecting';
      case ReadyState.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }, [connectionStatus]);

  const handleTreeNodeSelect = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const handleFileSelect = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setIsDrawerOpen(true);
  }, []);

  const handleFileDoubleClick = useCallback((file: FileItem) => {
    if (file.is_directory) {
      setCurrentPath(file.path);
    }
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <div className={`flex h-full ${className}`}>
      {/* Left Panel - Directory Tree */}
      <div className="w-80 flex-shrink-0 border-r border-line">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">
              {volumeName}
            </h2>
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected'
                    ? 'bg-green-500'
                    : wsStatus === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-xs text-gray-500">
                {wsStatus === 'connected' ? 'Live' : wsStatus}
              </span>
            </div>
          </div>

          <DirectoryTree
            volumeId={volumeId}
            onPathSelect={handleTreeNodeSelect}
            selectedPath={currentPath}
            className="h-[calc(100vh-200px)]"
          />
        </div>
      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-line">
          <div className="flex space-x-0">
            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'explorer'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-secondary'
              }`}
            >
              Explorer
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center space-x-2 ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-secondary'
              }`}
            >
              <BarChart3Icon className="w-4 h-4" />
              <span>Insights</span>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center space-x-2 ${
                activeTab === 'alerts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-secondary'
              }`}
            >
              <BellIcon className="w-4 h-4" />
              <span>Alerts</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'explorer' && (
            <>
              {/* Search and Navigation Bar */}
              <div className="border-b border-line p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-secondary">
                    <span className="font-medium">Path:</span> {currentPath}
                  </div>
                  <ViewToggle
                    value={viewMode}
                    onChange={setViewMode}
                    options={[
                      { id: 'list', label: 'List', icon: <List /> },
                      { id: 'grid', label: 'Grid', icon: <Grid3X3 /> },
                    ]}
                  />
                </div>

                <div className="relative">
                  <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files and folders..."
                    className="w-full pl-10 pr-4 py-2 border border-line rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* File View - Table or Grid */}
              <div className="flex-1 overflow-hidden">
                {viewMode === 'list' ? (
                  <FileTable
                    volumeId={volumeId}
                    currentPath={currentPath}
                    onFileSelect={handleFileSelect}
                    onFileDoubleClick={handleFileDoubleClick}
                    className="h-full"
                  />
                ) : (
                  <FileGrid
                    volumeId={volumeId}
                    currentPath={currentPath}
                    onFileSelect={handleFileSelect}
                    onFileDoubleClick={handleFileDoubleClick}
                    className="h-full"
                    itemSize="medium"
                  />
                )}
              </div>
            </>
          )}

          {activeTab === 'insights' && (
            <div className="p-6 overflow-auto">
              <VolumeCharts volumeId={volumeId} />
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="p-6 overflow-auto">
              <AlertCenter />
            </div>
          )}
        </div>
      </div>

      {/* File Metadata Drawer */}
      <FileDrawer
        file={selectedFile ? toDrawerMetadata(selectedFile) : null}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
      />
    </div>
  );
};

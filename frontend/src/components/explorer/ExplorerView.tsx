/**
 * ExplorerView Component
 *
 * Main explorer interface with lazy-loading tree, virtualized file table,
 * file metadata drawer, volume insights charts, and alert center.
 */

import React, { useCallback, useState } from 'react';
import { SearchIcon, BarChart3Icon, BellIcon } from 'lucide-react';
import { Tree } from './Tree';
import { FileTable } from './FileTable';
import { FileGrid } from './FileGrid/FileGrid';
import { ViewToggle, type ViewMode } from './ViewToggle/ViewToggle';
import { FileDrawer } from './FileDrawer';
import { VolumeCharts } from './Charts';
import { AlertCenter } from './AlertCenter';
import { useWebSocket } from '@/providers/WebSocketProvider';

interface ExplorerViewProps {
  volumeId: string;
  volumeName: string;
  className?: string;
}

// Mock data for development
const mockFiles = [
  {
    id: '1',
    name: 'Documents',
    type: 'folder' as const,
    size: 0,
    modified: '2024-03-15T10:30:00Z',
    path: '/home/user/Documents',
  },
  {
    id: '2',
    name: 'Images',
    type: 'folder' as const,
    size: 0,
    modified: '2024-03-14T16:45:00Z',
    path: '/home/user/Images',
  },
  {
    id: '3',
    name: 'report.pdf',
    type: 'file' as const,
    size: 2048576,
    modified: '2024-03-13T09:20:00Z',
    extension: 'pdf',
    mediaType: 'application/pdf',
    path: '/home/user/report.pdf',
  },
  {
    id: '4',
    name: 'presentation.pptx',
    type: 'file' as const,
    size: 5242880,
    modified: '2024-03-12T14:30:00Z',
    extension: 'pptx',
    mediaType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    path: '/home/user/presentation.pptx',
  },
  {
    id: '5',
    name: 'vacation.mp4',
    type: 'file' as const,
    size: 104857600,
    modified: '2024-03-11T20:15:00Z',
    extension: 'mp4',
    mediaType: 'video/mp4',
    path: '/home/user/vacation.mp4',
  },
];

const mockFileMetadata = {
  id: '3',
  name: 'report.pdf',
  path: '/home/user/report.pdf',
  size: 2048576,
  type: 'application/pdf',
  extension: 'pdf',
  mediaType: 'application/pdf',
  created: '2024-03-10T08:00:00Z',
  modified: '2024-03-13T09:20:00Z',
  accessed: '2024-03-15T11:30:00Z',
  permissions: '-rw-r--r--',
  owner: 'user',
  group: 'users',
  rawMetadata: {
    pdf: {
      version: '1.4',
      pages: 12,
      title: 'Quarterly Report',
      author: 'John Doe',
      creator: 'Microsoft Word',
      producer: 'Adobe PDF Library',
      encrypted: false,
    },
    filesystem: {
      inode: 123456,
      links: 1,
      blocks: 4096,
      blockSize: 512,
    },
  },
};

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  volumeId,
  volumeName,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [activeTab, setActiveTab] = useState<
    'explorer' | 'insights' | 'alerts'
  >('explorer');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const { status: wsStatus } = useWebSocket();

  const handleTreeNodeSelect = useCallback((node: any) => {
    setCurrentPath(node.path);
  }, []);

  const handleFileSelect = useCallback((file: any) => {
    setSelectedFile(file);
    setIsDrawerOpen(true);
  }, []);

  const handleFileDoubleClick = useCallback((file: any) => {
    if (file.type === 'folder') {
      setCurrentPath(file.path);
    }
  }, []);

  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  return (
    <div className={`flex h-full ${className}`}>
      {/* Left Panel - Directory Tree */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
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

          <Tree
            volumeId={volumeId}
            onNodeSelect={handleTreeNodeSelect}
            className="h-[calc(100vh-200px)]"
          />
        </div>
      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-0">
            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'explorer'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Explorer
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center space-x-2 ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
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
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
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
              <div className="border-b border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Path:</span> {currentPath}
                  </div>
                  <ViewToggle view={viewMode} onViewChange={setViewMode} />
                </div>

                <div className="relative">
                  <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files and folders..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* File View - Table or Grid */}
              <div className="flex-1 overflow-hidden">
                {viewMode === 'list' ? (
                  <FileTable
                    onFileSelect={handleFileSelect}
                    onFileDoubleClick={handleFileDoubleClick}
                    className="h-full"
                  />
                ) : (
                  <FileGrid
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
        file={selectedFile ? mockFileMetadata : null}
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
      />
    </div>
  );
};

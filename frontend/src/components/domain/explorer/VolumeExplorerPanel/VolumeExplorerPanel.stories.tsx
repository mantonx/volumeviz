import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Folder, Settings, Eye } from 'lucide-react';
import { action } from '@/utils/storybook-utils';

interface MockVolumeExplorerPanelProps {
  volumeId: string;
  currentPath: string;
  viewMode: 'grid' | 'list' | 'tree' | 'columns';
  multiSelect?: boolean;
  enableSearch?: boolean;
  showBreadcrumb?: boolean;
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showSidebar?: boolean;
  enableDragDrop?: boolean;
  enableContextMenu?: boolean;
  items?: Array<{
    id: string;
    name: string;
    type: 'file' | 'folder';
    size?: number;
    modified?: Date;
  }>;
  isLoading?: boolean;
  error?: string;
  sidebarContent?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  onItemClick?: (item: any) => void;
  onPathChange?: (path: string) => void;
  onViewModeChange?: (mode: string) => void;
}

const MockVolumeExplorerPanel: React.FC<MockVolumeExplorerPanelProps> = ({
  volumeId,
  currentPath,
  viewMode,
  items = [],
  isLoading = false,
  error,
  showBreadcrumb = true,
  showToolbar = true,
  showStatusBar = true,
  showSidebar = false,
  sidebarContent,
  toolbarActions,
}) => {
  const mockItems =
    items.length > 0
      ? items
      : [
          {
            id: '1',
            name: 'Documents',
            type: 'folder' as const,
            modified: new Date(),
          },
          {
            id: '2',
            name: 'Images',
            type: 'folder' as const,
            modified: new Date(),
          },
          {
            id: '3',
            name: 'report.pdf',
            type: 'file' as const,
            size: 1024000,
            modified: new Date(),
          },
          {
            id: '4',
            name: 'data.xlsx',
            type: 'file' as const,
            size: 512000,
            modified: new Date(),
          },
        ];

  if (error) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-600">Loading volume contents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {showBreadcrumb && (
        <div className="bg-white border-b px-4 py-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{volumeId}</span> → {currentPath}
          </div>
        </div>
      )}

      {showToolbar && (
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <select className="border rounded px-2 py-1 text-sm">
              <option value="grid">Grid</option>
              <option value="list">List</option>
              <option value="tree">Tree</option>
              <option value="columns">Columns</option>
            </select>
            <input
              type="text"
              placeholder="Search files..."
              className="border rounded px-3 py-1 text-sm w-64"
            />
          </div>
          {toolbarActions && <div>{toolbarActions}</div>}
        </div>
      )}

      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          <div
            className={`grid ${
              viewMode === 'grid' ? 'grid-cols-6 gap-4' : 'grid-cols-1 gap-2'
            }`}
          >
            {mockItems.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white rounded-lg border hover:shadow-md cursor-pointer transition-shadow"
                onClick={() => action('item-click')(item)}
              >
                <div className="flex items-center space-x-2">
                  {item.type === 'folder' ? (
                    <Folder className="w-5 h-5 text-blue-500" />
                  ) : (
                    <div className="w-5 h-5 bg-gray-200 rounded"></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.size && (
                      <p className="text-xs text-gray-500">
                        {(item.size / 1024).toFixed(0)} KB
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showSidebar && sidebarContent && (
          <div className="w-80 bg-white border-l">{sidebarContent}</div>
        )}
      </div>

      {showStatusBar && (
        <div className="bg-white border-t px-4 py-2 text-xs text-gray-500">
          {mockItems.length} items • Volume: {volumeId} • Path: {currentPath}
        </div>
      )}
    </div>
  );
};

const meta: Meta<MockVolumeExplorerPanelProps> = {
  title: 'Domain/VolumeExplorerPanel',
  component: MockVolumeExplorerPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# VolumeExplorerPanel

A comprehensive file browser with preview integration that combines multiple components for exploring volume contents.

## Features

- **Multiple View Modes**: Grid, List, Tree, and Columns views
- **Advanced Search & Filtering**: Full-text search with type, size, and date filters
- **Multi-Selection**: Support for single, multiple, and range selection
- **Drag & Drop**: File and folder drag-and-drop operations
- **Context Menu**: Contextual actions for files and folders
- **Breadcrumb Navigation**: Easy path navigation
- **Preview Integration**: Inline and modal preview support
- **Responsive Design**: Adapts to different screen sizes
        `,
      },
    },
  },
  argTypes: {
    volumeId: {
      control: 'text',
      description: 'Volume identifier',
    },
    currentPath: {
      control: 'text',
      description: 'Current path in the volume',
    },
    viewMode: {
      control: 'select',
      options: ['grid', 'list', 'tree', 'columns'],
      description: 'View mode for displaying items',
    },
    multiSelect: {
      control: 'boolean',
      description: 'Enable multi-select',
    },
    enableSearch: {
      control: 'boolean',
      description: 'Enable search functionality',
    },
    showBreadcrumb: {
      control: 'boolean',
      description: 'Show breadcrumb navigation',
    },
    showToolbar: {
      control: 'boolean',
      description: 'Show toolbar',
    },
    showStatusBar: {
      control: 'boolean',
      description: 'Show status bar',
    },
    showSidebar: {
      control: 'boolean',
      description: 'Show sidebar',
    },
  },
  args: {
    volumeId: 'vol-001',
    currentPath: '/Users/Documents',
    viewMode: 'grid',
    multiSelect: true,
    enableSearch: true,
    showBreadcrumb: true,
    showToolbar: true,
    showStatusBar: true,
    showSidebar: false,
    enableDragDrop: true,
    enableContextMenu: true,
  },
};

export default meta;
type Story = StoryObj<MockVolumeExplorerPanelProps>;

export const Default: Story = {};

export const ListView: Story = {
  args: {
    viewMode: 'list',
  },
};

export const WithSidebar: Story = {
  args: {
    showSidebar: true,
    sidebarContent: (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">File Details</h3>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700">
              Selected Items
            </div>
            <div className="text-sm text-gray-500">No items selected</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">
              Quick Actions
            </div>
            <div className="space-y-2 mt-2">
              <button className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded">
                <Eye className="inline w-4 h-4 mr-2" />
                Preview
              </button>
              <button className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded">
                <Settings className="inline w-4 h-4 mr-2" />
                Properties
              </button>
            </div>
          </div>
        </div>
      </div>
    ),
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Error: Story = {
  args: {
    error:
      'Failed to load volume contents. Please check your connection and try again.',
  },
};

export const CustomToolbar: Story = {
  args: {
    toolbarActions: (
      <div className="flex items-center space-x-2">
        <button className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100">
          <Settings className="w-4 h-4" />
        </button>
        <div className="border-l border-gray-300 h-6" />
        <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
          Export
        </button>
        <button className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">
          Share
        </button>
      </div>
    ),
  },
};

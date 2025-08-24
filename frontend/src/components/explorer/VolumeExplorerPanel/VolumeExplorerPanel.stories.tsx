import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { Folder, Settings, Eye } from 'lucide-react';

import { VolumeExplorerPanel } from './VolumeExplorerPanel';
import type {
  VolumeExplorerPanelProps,
  ExplorerItem,
  ExplorerSelection,
  ExplorerFilter,
  ExplorerViewMode,
} from './VolumeExplorerPanel.types';
import { createMockExplorerData } from './VolumeExplorerPanel.types';

const meta: Meta<typeof VolumeExplorerPanel> = {
  title: 'Domain/VolumeExplorerPanel',
  component: VolumeExplorerPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# VolumeExplorerPanel

A comprehensive file browser with preview integration that combines multiple components for exploring volume contents. This is a Tier 3 Domain-Specific Composition that integrates all lower-tier components.

## Features

- **Multiple View Modes**: Grid, List, Tree, and Columns views
- **Advanced Search & Filtering**: Full-text search with type, size, and date filters
- **Multi-Selection**: Support for single, multiple, and range selection
- **Drag & Drop**: File and folder drag-and-drop operations
- **Context Menu**: Contextual actions for files and folders
- **Breadcrumb Navigation**: Easy path navigation
- **Preview Integration**: Inline and modal preview support
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility**: Full keyboard navigation and screen reader support

## Architecture

Combines components from all tiers:
- **Tier 1**: ProgressBar, StatusBadge
- **Tier 2**: Direct integration with business logic
- **Tier 3**: VolumeExplorerPanel (domain composition)

## Usage

\`\`\`tsx
<VolumeExplorerPanel
  volumeId="vol-001"
  currentPath="/Users/Documents"
  items={explorerItems}
  viewMode="grid"
  onItemClick={(item) => console.log('Clicked:', item)}
  onPathChange={(path) => console.log('Navigate to:', path)}
/>
\`\`\`
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
    enableDragDrop: {
      control: 'boolean',
      description: 'Enable drag and drop',
    },
    enableContextMenu: {
      control: 'boolean',
      description: 'Enable context menu',
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
type Story = StoryObj<typeof VolumeExplorerPanel>;

// Mock data
const mockItems = createMockExplorerData(30, '/Users/Documents/');

const mockActions = {
  onItemClick: action('item-click'),
  onItemDoubleClick: action('item-double-click'),
  onItemContextMenu: action('item-context-menu'),
  onSelectionChange: action('selection-change'),
  onPathChange: action('path-change'),
  onViewModeChange: action('view-mode-change'),
  onSortChange: action('sort-change'),
  onFilterChange: action('filter-change'),
  onSearch: action('search'),
  onLoadMore: action('load-more'),
  onPageChange: action('page-change'),
  onItemExpand: action('item-expand'),
  onItemCollapse: action('item-collapse'),
  onDragStart: action('drag-start'),
  onDragEnd: action('drag-end'),
  onDrop: action('drop'),
  onPreview: action('preview'),
  onDownload: action('download'),
  onDelete: action('delete'),
  onRename: action('rename'),
  onCreateFolder: action('create-folder'),
  onUpload: action('upload'),
  onRefresh: action('refresh'),
};

/**
 * Default explorer with grid view
 */
export const Default: Story = {
  args: {
    items: mockItems,
    ...mockActions,
  },
};

/**
 * List view mode
 */
export const ListView: Story = {
  args: {
    items: mockItems,
    viewMode: 'list',
    ...mockActions,
  },
};

/**
 * Tree view mode
 */
export const TreeView: Story = {
  args: {
    items: mockItems.map((item, index) => ({
      ...item,
      type: index < 5 ? 'folder' : 'file',
      hasChildren: index < 5 ? true : false,
    })),
    viewMode: 'tree',
    ...mockActions,
  },
};

/**
 * Column view mode
 */
export const ColumnView: Story = {
  args: {
    items: mockItems,
    viewMode: 'columns',
    ...mockActions,
  },
};

/**
 * With sidebar enabled
 */
export const WithSidebar: Story = {
  args: {
    items: mockItems,
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
    ...mockActions,
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  args: {
    items: [],
    isLoading: true,
    ...mockActions,
  },
};

/**
 * Empty state
 */
export const Empty: Story = {
  args: {
    items: [],
    isLoading: false,
    ...mockActions,
  },
};

/**
 * Error state
 */
export const Error: Story = {
  args: {
    items: [],
    isLoading: false,
    error:
      'Failed to load volume contents. Please check your connection and try again.',
    ...mockActions,
  },
};

/**
 * With search results
 */
export const SearchResults: Story = {
  args: {
    items: mockItems.filter((item) =>
      item.name.toLowerCase().includes('document'),
    ),
    filter: { query: 'document' },
    ...mockActions,
  },
};

/**
 * Image gallery mode
 */
export const ImageGallery: Story = {
  args: {
    items: createMockExplorerData(20, '/Users/Photos/').map((item, index) => ({
      ...item,
      type: 'file' as const,
      extension: ['jpg', 'png', 'gif'][index % 3],
      mimeType: 'image/jpeg',
      name: `IMG_${String(index + 1).padStart(4, '0')}.jpg`,
      thumbnailUrl: `https://picsum.photos/200/200?random=${index}`,
      metadata: {
        width: 1920,
        height: 1080,
      },
    })),
    currentPath: '/Users/Photos',
    gridConfig: {
      itemWidth: 200,
      itemHeight: 180,
      gap: 16,
    },
    ...mockActions,
  },
};

/**
 * Large dataset with pagination
 */
export const LargeDataset: Story = {
  args: {
    items: createMockExplorerData(100),
    totalItems: 1000,
    pageSize: 100,
    currentPage: 1,
    isLoadingMore: false,
    ...mockActions,
  },
};

/**
 * Interactive selection example
 */
export const InteractiveSelection: Story = {
  render: (args) => {
    const [selection, setSelection] = useState<ExplorerSelection>({
      items: new Set(),
      mode: 'multiple',
    });

    const handleSelectionChange = (newSelection: ExplorerSelection) => {
      setSelection(newSelection);
      action('selection-change')(newSelection);
    };

    return (
      <VolumeExplorerPanel
        {...args}
        selection={selection}
        onSelectionChange={handleSelectionChange}
        sidebarContent={
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Selection</h3>
            <div className="text-sm text-gray-600">
              {selection.items.size} item{selection.items.size !== 1 ? 's' : ''}{' '}
              selected
            </div>
            {selection.items.size > 0 && (
              <div className="mt-4">
                <button
                  onClick={() =>
                    setSelection({ items: new Set(), mode: 'multiple' })
                  }
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        }
      />
    );
  },
  args: {
    items: mockItems,
    showSidebar: true,
    multiSelect: true,
    ...mockActions,
  },
};

/**
 * With custom toolbar actions
 */
export const CustomToolbar: Story = {
  args: {
    items: mockItems,
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
    ...mockActions,
  },
};

/**
 * Filtering example
 */
export const FilteringExample: Story = {
  render: (args) => {
    const [filter, setFilter] = useState<ExplorerFilter>({
      query: '',
      types: [],
      showHidden: false,
    });

    const [filteredItems, setFilteredItems] = useState(mockItems);

    const handleFilterChange = (newFilter: ExplorerFilter) => {
      setFilter(newFilter);

      let filtered = mockItems;
      if (newFilter.query) {
        filtered = filtered.filter((item) =>
          item.name.toLowerCase().includes(newFilter.query!.toLowerCase()),
        );
      }
      if (newFilter.types?.length) {
        filtered = filtered.filter((item) =>
          newFilter.types!.includes(item.type),
        );
      }

      setFilteredItems(filtered);
      action('filter-change')(newFilter);
    };

    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Filters</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filter.query || ''}
                onChange={(e) =>
                  handleFilterChange({ ...filter, query: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Search files..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={filter.types?.[0] || ''}
                onChange={(e) =>
                  handleFilterChange({
                    ...filter,
                    types: e.target.value ? [e.target.value] : [],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">All types</option>
                <option value="folder">Folders</option>
                <option value="file">Files</option>
              </select>
            </div>
            <div>
              <label className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={filter.showHidden || false}
                  onChange={(e) =>
                    handleFilterChange({
                      ...filter,
                      showHidden: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">Show hidden</span>
              </label>
            </div>
          </div>
        </div>
        <VolumeExplorerPanel
          {...args}
          items={filteredItems}
          filter={filter}
          onFilterChange={handleFilterChange}
        />
      </div>
    );
  },
  args: {
    ...mockActions,
  },
};

/**
 * Performance test with many items
 */
export const PerformanceTest: Story = {
  args: {
    items: createMockExplorerData(500),
    virtualScroll: true,
    ...mockActions,
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  args: {
    items: mockItems,
    viewMode: 'list',
    gridConfig: {
      itemWidth: 120,
      itemHeight: 100,
      gap: 8,
    },
    listConfig: {
      rowHeight: 56,
      compactMode: true,
    },
    ...mockActions,
  },
};

/**
 * Compact mode
 */
export const Compact: Story = {
  args: {
    items: mockItems,
    showBreadcrumb: false,
    showStatusBar: false,
    gridConfig: {
      itemWidth: 120,
      itemHeight: 100,
      gap: 8,
    },
    listConfig: {
      rowHeight: 32,
      compactMode: true,
      showSize: false,
      showModified: false,
    },
    ...mockActions,
  },
};

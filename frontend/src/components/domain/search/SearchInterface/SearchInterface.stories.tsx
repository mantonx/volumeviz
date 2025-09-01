import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Search, Filter, Save, Clock, Grid, List, Table } from 'lucide-react';
import { action } from '@/utils/storybook-utils';

interface MockSearchInterfaceProps {
  query?: {
    query: string;
    type: 'simple' | 'advanced';
    scope: 'all' | 'volume';
    filters: Record<string, any>;
  };
  results?: {
    items: Array<{
      id: string;
      name: string;
      path: string;
      type: 'file' | 'folder';
      size?: number;
      modified?: Date;
    }>;
    totalCount: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    searchTime: number;
    executedAt: Date;
  };
  isSearching?: boolean;
  searchError?: string;
  enableRealTimeSearch?: boolean;
  layout?: 'compact' | 'standard' | 'expanded';
  resultsView?: 'list' | 'grid' | 'table';
  showAdvanced?: boolean;
  showFilters?: boolean;
  showSavedSearches?: boolean;
  showHistory?: boolean;
  onSearch?: (query: any) => void;
  onSearchChange?: (query: any) => void;
}

const MockSearchInterface: React.FC<MockSearchInterfaceProps> = ({
  query = { query: '', type: 'simple', scope: 'all', filters: {} },
  results,
  isSearching = false,
  searchError,
  layout = 'standard',
  resultsView = 'list',
  showAdvanced = false,
  showFilters = true,
  showSavedSearches = false,
  onSearch = action('search'),
  onSearchChange = action('searchChange'),
}) => {
  const [searchTerm, setSearchTerm] = useState(query.query);
  
  const mockResults = results || {
    items: [
      { id: '1', name: 'document.pdf', path: '/docs/document.pdf', type: 'file' as const, size: 1024000, modified: new Date() },
      { id: '2', name: 'presentation.pptx', path: '/docs/presentation.pptx', type: 'file' as const, size: 2048000, modified: new Date() },
      { id: '3', name: 'data', path: '/data', type: 'folder' as const, modified: new Date() },
    ],
    totalCount: 3,
    page: 1,
    pageSize: 20,
    hasMore: false,
    searchTime: 125,
    executedAt: new Date(),
  };

  if (searchError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8 text-red-600">
          <p className="font-semibold">Search Error</p>
          <p className="text-sm mt-1">{searchError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onSearchChange({ ...query, query: e.target.value });
              }}
              placeholder="Search files and folders..."
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button 
            onClick={() => onSearch({ ...query, query: searchTerm })}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            disabled={isSearching}
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Search className="w-5 h-5" />
            )}
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Type
                </label>
                <select className="w-full border rounded-md px-3 py-2">
                  <option value="simple">Simple</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <select className="w-full border rounded-md px-3 py-2">
                  <option value="all">All Volumes</option>
                  <option value="volume">Current Volume</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <select className="w-full border rounded-md px-3 py-2">
                  <option value="">All Types</option>
                  <option value="document">Documents</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {showFilters && (
          <div className="w-80 bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Size
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded" />
                    <span className="ml-2 text-sm">Small (&lt; 1MB)</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded" />
                    <span className="ml-2 text-sm">Medium (1-10MB)</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded" />
                    <span className="ml-2 text-sm">Large (&gt; 10MB)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Modified
                </label>
                <select className="w-full border rounded-md px-3 py-2 text-sm">
                  <option>Any time</option>
                  <option>Last 24 hours</option>
                  <option>Last week</option>
                  <option>Last month</option>
                  <option>Last year</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="bg-white rounded-lg border p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {isSearching ? (
                  'Searching...'
                ) : results?.items.length ? (
                  `${results.totalCount} results found in ${results.searchTime}ms`
                ) : (
                  'Enter a search term to begin'
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  className={`p-2 rounded ${resultsView === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                  onClick={() => action('view-change')('list')}
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  className={`p-2 rounded ${resultsView === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                  onClick={() => action('view-change')('grid')}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  className={`p-2 rounded ${resultsView === 'table' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                  onClick={() => action('view-change')('table')}
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border">
            {isSearching ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Searching files...</p>
              </div>
            ) : results?.items.length ? (
              <div className="divide-y">
                {mockResults.items.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => action('result-click')(item)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          item.type === 'folder' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {item.type === 'folder' ? '📁' : '📄'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.path}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {item.size && <p>{(item.size / 1024 / 1024).toFixed(1)} MB</p>}
                        <p>{item.modified?.toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No results found</p>
                <p className="text-sm">Try adjusting your search terms or filters</p>
              </div>
            )}
          </div>
        </div>

        {showSavedSearches && (
          <div className="w-64 bg-white rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Save className="w-5 h-5 mr-2" />
              Saved
            </h3>
            <div className="space-y-2">
              <button className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                Recent documents
              </button>
              <button className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                Large files
              </button>
              <button className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded flex items-center">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                Images
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const meta: Meta<MockSearchInterfaceProps> = {
  title: 'Domain/SearchInterface',
  component: MockSearchInterface,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
**SearchInterface** - Advanced search with filters and saved searches

A sophisticated domain composition that provides comprehensive search functionality with advanced filtering, saved searches, and real-time results.

Features:
- Real-time search with debouncing
- Advanced filters (file types, sizes, dates)
- Saved searches with favorites
- Search history and suggestions
- Multiple result view modes
- Export functionality
        `,
      },
    },
  },
  argTypes: {
    layout: {
      control: 'radio',
      options: ['compact', 'standard', 'expanded'],
      description: 'Interface layout mode',
    },
    resultsView: {
      control: 'radio',
      options: ['list', 'grid', 'table'],
      description: 'Results display mode',
    },
    showAdvanced: {
      control: 'boolean',
      description: 'Show advanced search options',
    },
    showFilters: {
      control: 'boolean',
      description: 'Show search filters panel',
    },
    showSavedSearches: {
      control: 'boolean',
      description: 'Show saved searches panel',
    },
    isSearching: {
      control: 'boolean',
      description: 'Whether search is in progress',
    },
  },
};

export default meta;
type Story = StoryObj<MockSearchInterfaceProps>;

export const Default: Story = {};

export const WithResults: Story = {
  args: {
    query: {
      query: 'document',
      type: 'simple',
      scope: 'all',
      filters: {},
    },
    results: {
      items: [
        { id: '1', name: 'report.pdf', path: '/docs/report.pdf', type: 'file', size: 1024000, modified: new Date() },
        { id: '2', name: 'presentation.pptx', path: '/docs/presentation.pptx', type: 'file', size: 2048000, modified: new Date() },
        { id: '3', name: 'documents', path: '/documents', type: 'folder', modified: new Date() },
      ],
      totalCount: 3,
      page: 1,
      pageSize: 20,
      hasMore: false,
      searchTime: 125,
      executedAt: new Date(),
    },
  },
};

export const Loading: Story = {
  args: {
    isSearching: true,
  },
};

export const WithError: Story = {
  args: {
    searchError: 'Search service temporarily unavailable. Please try again later.',
  },
};

export const WithFilters: Story = {
  args: {
    showAdvanced: true,
    showFilters: true,
    query: {
      query: 'filtered search',
      type: 'advanced',
      scope: 'volume',
      filters: {
        fileTypes: ['document', 'image'],
        sizeFilter: {
          operator: 'gt',
          value: 1,
          unit: 'MB',
        },
      },
    },
  },
};

export const ExpandedLayout: Story = {
  args: {
    layout: 'expanded',
    showFilters: true,
    showSavedSearches: true,
    showAdvanced: true,
  },
};

export const GridView: Story = {
  args: {
    resultsView: 'grid',
    results: {
      items: [
        { id: '1', name: 'image1.jpg', path: '/photos/image1.jpg', type: 'file', size: 512000, modified: new Date() },
        { id: '2', name: 'image2.png', path: '/photos/image2.png', type: 'file', size: 1024000, modified: new Date() },
        { id: '3', name: 'image3.gif', path: '/photos/image3.gif', type: 'file', size: 256000, modified: new Date() },
      ],
      totalCount: 3,
      page: 1,
      pageSize: 20,
      hasMore: false,
      searchTime: 89,
      executedAt: new Date(),
    },
  },
};

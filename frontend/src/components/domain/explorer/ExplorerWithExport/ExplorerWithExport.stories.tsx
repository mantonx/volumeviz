import type { Meta, StoryObj } from '@storybook/react';
import {
  ExplorerWithExport,
  TreemapExplorerExample,
  SunburstExplorerExample,
  DataExplorerExample,
} from './ExplorerWithExport';

const meta = {
  title: 'Domain/Explorer/ExplorerWithExport',
  component: ExplorerWithExport,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    currentView: {
      control: {
        type: 'select',
        options: ['list', 'grid', 'treemap', 'sunburst'],
      },
    },
  },
} satisfies Meta<typeof ExplorerWithExport>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TreemapVisualization: Story = {
  render: () => <TreemapExplorerExample />,
};

export const SunburstVisualization: Story = {
  render: () => <SunburstExplorerExample />,
};

export const DataTable: Story = {
  render: () => <DataExplorerExample />,
};

export const CustomContent: Story = {
  args: {
    currentView: 'list',
    data: [
      { name: 'project1', size: 1024, type: 'directory' },
      { name: 'project2', size: 2048, type: 'directory' },
      { name: 'README.md', size: 512, type: 'file' },
    ],
    metadata: {
      totalItems: 3,
      viewMode: 'list',
      sortBy: 'name',
    },
    children: (
      <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-100 border rounded-lg p-6 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Custom Explorer Content
          </h3>
          <p className="text-gray-600">
            This content can be exported as PNG, PDF, SVG, CSV, or JSON
          </p>
        </div>
      </div>
    ),
  },
};

export const InteractiveDemo: Story = {
  render: () => (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Interactive Export Demo
        </h2>
        <p className="text-gray-600 mb-8">
          Try the export functionality with different visualization types
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Treemap Visualization</h3>
          <TreemapExplorerExample />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Sunburst Chart</h3>
          <SunburstExplorerExample />
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Data Table View</h3>
          <DataExplorerExample />
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to Use:</h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>
            • Click the download button in the top-right corner of each
            visualization
          </li>
          <li>
            • Choose your preferred export format (PNG, PDF, SVG, CSV, JSON)
          </li>
          <li>• Adjust quality and size settings for image formats</li>
          <li>• Enable transparency or set background colors</li>
          <li>• Include metadata and raw data in your exports</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const AllFormatsSupported: Story = {
  args: {
    currentView: 'treemap',
    data: {
      name: 'File System',
      children: [
        { name: 'Documents', value: 1024 },
        { name: 'Images', value: 2048 },
        { name: 'Videos', value: 4096 },
      ],
    },
    metadata: {
      totalSize: '7.2 GB',
      fileCount: 1250,
      lastScanned: '2024-01-15T10:30:00Z',
    },
    children: (
      <div className="h-80 bg-white border rounded-lg p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-bold text-2xl">VIZ</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">
            All Export Formats Supported
          </h3>
          <p className="text-gray-600 text-sm mt-2">
            PNG • PDF • SVG • CSV • JSON
          </p>
        </div>
      </div>
    ),
  },
};

export const HighQualityExport: Story = {
  args: {
    currentView: 'sunburst',
    data: {
      name: 'root',
      value: 1000,
      children: [
        { name: 'Branch A', value: 400 },
        { name: 'Branch B', value: 300 },
        { name: 'Branch C', value: 300 },
      ],
    },
    metadata: {
      resolution: '4K',
      quality: 'high',
      antiAliasing: true,
    },
    children: (
      <div className="h-80 bg-gray-900 border rounded-lg p-4 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-48 h-48 border-4 border-white rounded-full mx-auto mb-4 flex items-center justify-center relative">
            <div className="absolute inset-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <div className="absolute inset-8 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full"></div>
            <div className="absolute inset-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
          </div>
          <h3 className="text-lg font-semibold">High-Quality Export Ready</h3>
          <p className="text-gray-300 text-sm mt-2">
            Optimized for 4K resolution and print quality
          </p>
        </div>
      </div>
    ),
  },
};

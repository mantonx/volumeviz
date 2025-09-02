import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { VirtualizedFileList, type FileItem } from './VirtualizedFileList';

// Generate mock file data
const generateMockFiles = (count: number): FileItem[] => {
  const fileTypes = [
    { ext: 'txt', mime: 'text/plain' },
    { ext: 'pdf', mime: 'application/pdf' },
    { ext: 'jpg', mime: 'image/jpeg' },
    { ext: 'png', mime: 'image/png' },
    { ext: 'mp4', mime: 'video/mp4' },
    { ext: 'mp3', mime: 'audio/mpeg' },
    { ext: 'doc', mime: 'application/msword' },
    { ext: 'zip', mime: 'application/zip' },
  ];

  const files: FileItem[] = [];

  // Add some directories
  for (let i = 0; i < Math.floor(count * 0.2); i++) {
    files.push({
      id: `dir-${i}`,
      name: `Folder ${i + 1}`,
      path: `/data/folder-${i + 1}`,
      size: 0,
      type: 'directory',
      modified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    });
  }

  // Add files
  for (let i = 0; i < count - files.length; i++) {
    const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)];
    const size = Math.floor(Math.random() * 100 * 1024 * 1024); // 0-100MB
    
    files.push({
      id: `file-${i}`,
      name: `file-${i + 1}.${fileType.ext}`,
      path: `/data/file-${i + 1}.${fileType.ext}`,
      size,
      type: 'file',
      modified: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      extension: fileType.ext,
      mimeType: fileType.mime,
    });
  }

  return files;
};

const meta: Meta<typeof VirtualizedFileList> = {
  title: 'Explorer/VirtualizedFileList',
  component: VirtualizedFileList,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'High-performance virtualized file list component with multi-select, sorting, and keyboard navigation.',
      },
    },
  },
  argTypes: {
    height: {
      control: { type: 'range', min: 200, max: 800, step: 50 },
      description: 'Height of the list container',
    },
    viewMode: {
      control: { type: 'select' },
      options: ['list', 'grid'],
      description: 'Display mode (grid not yet implemented)',
    },
    sortBy: {
      control: { type: 'select' },
      options: ['name', 'size', 'modified', 'type'],
      description: 'Sort field',
    },
    sortDirection: {
      control: { type: 'select' },
      options: ['asc', 'desc'],
      description: 'Sort direction',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Loading state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    files: generateMockFiles(100),
    height: 600,
    sortBy: 'name',
    sortDirection: 'asc',
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    files: [],
    height: 400,
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    files: [],
    height: 400,
    isLoading: false,
  },
};

export const LargeDataset: Story = {
  args: {
    files: generateMockFiles(10000),
    height: 600,
    sortBy: 'name',
    sortDirection: 'asc',
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates virtualization with 10,000 items. Scrolling should remain smooth.',
      },
    },
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<keyof FileItem>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    return (
      <div className="p-4">
        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Selected: {selectedIds.size} files | Sort: {sortBy} ({sortDirection})
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Use Cmd/Ctrl+Click for multi-select, Shift+Click for range select, Arrow keys for navigation
          </p>
        </div>
        
        <VirtualizedFileList
          {...args}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(field, direction) => {
            setSortBy(field);
            setSortDirection(direction);
          }}
          onFileOpen={(file) => {
            console.log('Opening file:', file.name);
            alert(`Opening: ${file.name}`);
          }}
          onFileAction={(file, action) => {
            console.log('File action:', action, file.name);
            alert(`Action "${action}" on: ${file.name}`);
          }}
        />
      </div>
    );
  },
  args: {
    files: generateMockFiles(1000),
    height: 600,
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive example with selection state, sorting, and actions.',
      },
    },
  },
};

export const SortedBySize: Story = {
  args: {
    files: generateMockFiles(500),
    height: 600,
    sortBy: 'size',
    sortDirection: 'desc',
  },
  parameters: {
    docs: {
      description: {
        story: 'Files sorted by size (largest first). Directories always appear at the top.',
      },
    },
  },
};

export const SortedByDate: Story = {
  args: {
    files: generateMockFiles(500),
    height: 600,
    sortBy: 'modified',
    sortDirection: 'desc',
  },
  parameters: {
    docs: {
      description: {
        story: 'Files sorted by modification date (most recent first).',
      },
    },
  },
};
import type { Meta, StoryObj } from '@storybook/react';
import { Sunburst, SunburstItem } from './Sunburst';

const meta = {
  title: 'Domain/Explorer/Sunburst',
  component: Sunburst,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'range', min: 300, max: 800, step: 50 },
    },
    height: {
      control: { type: 'range', min: 300, max: 800, step: 50 },
    },
    innerRadius: {
      control: { type: 'range', min: 20, max: 100, step: 10 },
    },
    maxDepth: {
      control: { type: 'range', min: 2, max: 8, step: 1 },
    },
    colorScheme: {
      control: { type: 'select' },
      options: ['fileSize', 'fileType', 'depth'],
    },
  },
} satisfies Meta<typeof Sunburst>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleHierarchicalData: SunburstItem[] = [
  {
    id: '1',
    name: 'Documents',
    size: 0,
    path: '/documents',
    type: 'directory',
    isDirectory: true,
    children: [
      {
        id: '2',
        name: 'Work',
        size: 0,
        path: '/documents/work',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '3',
            name: 'report.pdf',
            size: 2048000,
            path: '/documents/work/report.pdf',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '4',
            name: 'presentation.pptx',
            size: 5120000,
            path: '/documents/work/presentation.pptx',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
      {
        id: '5',
        name: 'Personal',
        size: 0,
        path: '/documents/personal',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '6',
            name: 'photos.zip',
            size: 15360000,
            path: '/documents/personal/photos.zip',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '7',
            name: 'notes.txt',
            size: 1024,
            path: '/documents/personal/notes.txt',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
    ],
  },
  {
    id: '8',
    name: 'Media',
    size: 0,
    path: '/media',
    type: 'directory',
    isDirectory: true,
    children: [
      {
        id: '9',
        name: 'Videos',
        size: 0,
        path: '/media/videos',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '10',
            name: 'movie.mp4',
            size: 104857600,
            path: '/media/videos/movie.mp4',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '11',
            name: 'tutorial.avi',
            size: 52428800,
            path: '/media/videos/tutorial.avi',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
      {
        id: '12',
        name: 'Music',
        size: 0,
        path: '/media/music',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '13',
            name: 'song1.mp3',
            size: 4194304,
            path: '/media/music/song1.mp3',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '14',
            name: 'song2.flac',
            size: 25165824,
            path: '/media/music/song2.flac',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
      {
        id: '15',
        name: 'Images',
        size: 0,
        path: '/media/images',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '16',
            name: 'photo1.jpg',
            size: 2097152,
            path: '/media/images/photo1.jpg',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '17',
            name: 'photo2.png',
            size: 4194304,
            path: '/media/images/photo2.png',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
    ],
  },
  {
    id: '18',
    name: 'Software',
    size: 0,
    path: '/software',
    type: 'directory',
    isDirectory: true,
    children: [
      {
        id: '19',
        name: 'Projects',
        size: 0,
        path: '/software/projects',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '20',
            name: 'app.js',
            size: 102400,
            path: '/software/projects/app.js',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '21',
            name: 'styles.css',
            size: 51200,
            path: '/software/projects/styles.css',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '22',
            name: 'index.html',
            size: 25600,
            path: '/software/projects/index.html',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
      {
        id: '23',
        name: 'Tools',
        size: 0,
        path: '/software/tools',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '24',
            name: 'installer.exe',
            size: 10485760,
            path: '/software/tools/installer.exe',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '25',
            name: 'config.json',
            size: 2048,
            path: '/software/tools/config.json',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
    ],
  },
];

// Calculate sizes for directories
const calculateDirectorySizes = (items: SunburstItem[]): SunburstItem[] => {
  return items.map((item) => {
    if (item.children && item.children.length > 0) {
      const processedChildren = calculateDirectorySizes(item.children);
      const totalSize = processedChildren.reduce(
        (sum, child) => sum + child.size,
        0,
      );
      return {
        ...item,
        size: totalSize,
        children: processedChildren,
      };
    }
    return item;
  });
};

const processedData = calculateDirectorySizes(sampleHierarchicalData);

const largeDataset: SunburstItem[] = [
  ...processedData,
  {
    id: '26',
    name: 'System',
    size: 209715200,
    path: '/system',
    type: 'directory',
    isDirectory: true,
    children: [
      {
        id: '27',
        name: 'Logs',
        size: 52428800,
        path: '/system/logs',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '28',
            name: 'error.log',
            size: 26214400,
            path: '/system/logs/error.log',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '29',
            name: 'access.log',
            size: 26214400,
            path: '/system/logs/access.log',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
      {
        id: '30',
        name: 'Cache',
        size: 157286400,
        path: '/system/cache',
        type: 'directory',
        isDirectory: true,
        children: [
          {
            id: '31',
            name: 'temp1.tmp',
            size: 78643200,
            path: '/system/cache/temp1.tmp',
            type: 'file',
            isDirectory: false,
          },
          {
            id: '32',
            name: 'temp2.tmp',
            size: 78643200,
            path: '/system/cache/temp2.tmp',
            type: 'file',
            isDirectory: false,
          },
        ],
      },
    ],
  },
];

export const Default: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 50,
    maxDepth: 4,
    colorScheme: 'fileSize',
  },
};

export const FileSizeColoring: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 60,
    maxDepth: 4,
    colorScheme: 'fileSize',
  },
};

export const FileTypeColoring: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 60,
    maxDepth: 4,
    colorScheme: 'fileType',
  },
};

export const DepthColoring: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 60,
    maxDepth: 4,
    colorScheme: 'depth',
  },
};

export const LargeDataset: Story = {
  args: {
    data: largeDataset,
    width: 600,
    height: 600,
    innerRadius: 80,
    maxDepth: 5,
    colorScheme: 'fileType',
  },
};

export const SmallSize: Story = {
  args: {
    data: processedData.slice(0, 2),
    width: 300,
    height: 300,
    innerRadius: 30,
    maxDepth: 3,
    colorScheme: 'fileSize',
  },
};

export const DeepHierarchy: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 40,
    maxDepth: 6,
    colorScheme: 'depth',
  },
};

export const WithSelection: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 50,
    maxDepth: 4,
    colorScheme: 'fileSize',
    selectedIds: new Set(['10', '13', '20']),
  },
};

export const Interactive: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 50,
    maxDepth: 4,
    colorScheme: 'fileType',
    onItemClick: (item) => console.log('Clicked:', item.name),
    onItemHover: (item) => console.log('Hovered:', item?.name || 'none'),
    onZoomIn: (item) => console.log('Zoom in:', item.name),
    onZoomOut: () => console.log('Zoom out'),
  },
};

export const ZoomedIn: Story = {
  args: {
    data: processedData,
    width: 500,
    height: 500,
    innerRadius: 50,
    maxDepth: 4,
    colorScheme: 'fileType',
    focusedItemId: '8', // Focus on Media directory
    onZoomOut: () => console.log('Zoom out'),
  },
};

export const EmptyState: Story = {
  args: {
    data: [],
    width: 500,
    height: 500,
    innerRadius: 50,
    maxDepth: 4,
    colorScheme: 'fileSize',
  },
};

export const SingleLevel: Story = {
  args: {
    data: [
      {
        id: '1',
        name: 'file1.txt',
        size: 1024,
        path: '/file1.txt',
        type: 'file',
        isDirectory: false,
      },
      {
        id: '2',
        name: 'file2.jpg',
        size: 2048000,
        path: '/file2.jpg',
        type: 'file',
        isDirectory: false,
      },
      {
        id: '3',
        name: 'file3.mp4',
        size: 50000000,
        path: '/file3.mp4',
        type: 'file',
        isDirectory: false,
      },
    ],
    width: 400,
    height: 400,
    innerRadius: 60,
    maxDepth: 2,
    colorScheme: 'fileType',
  },
};

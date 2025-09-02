import type { Meta, StoryObj } from '@storybook/react'
import { Treemap, TreemapItem, TreemapColorScheme } from './Treemap'

const meta = {
  title: 'Domain/Explorer/Treemap',
  component: Treemap,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'range', min: 200, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 800, step: 50 },
    },
    colorScheme: {
      control: { type: 'select' },
      options: ['fileSize', 'fileType', 'fileAge'] as TreemapColorScheme[],
    },
  },
} satisfies Meta<typeof Treemap>

export default meta
type Story = StoryObj<typeof meta>

const sampleData: TreemapItem[] = [
  {
    id: '1',
    name: 'Documents',
    size: 2500,
    isDirectory: true,
    path: '/documents',
    type: 'directory',
    lastModified: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'video.mp4',
    size: 8000,
    isDirectory: false,
    path: '/video.mp4',
    type: 'video',
    lastModified: new Date('2024-02-10'),
  },
  {
    id: '3',
    name: 'Photos',
    size: 15000,
    isDirectory: true,
    path: '/photos',
    type: 'directory',
    lastModified: new Date('2024-01-20'),
  },
  {
    id: '4',
    name: 'script.js',
    size: 1200,
    isDirectory: false,
    path: '/script.js',
    type: 'code',
    lastModified: new Date('2024-03-01'),
  },
  {
    id: '5',
    name: 'archive.zip',
    size: 5500,
    isDirectory: false,
    path: '/archive.zip',
    type: 'archive',
    lastModified: new Date('2024-01-05'),
  },
  {
    id: '6',
    name: 'presentation.pptx',
    size: 3200,
    isDirectory: false,
    path: '/presentation.pptx',
    type: 'document',
    lastModified: new Date('2024-02-25'),
  },
  {
    id: '7',
    name: 'audio.mp3',
    size: 4800,
    isDirectory: false,
    path: '/audio.mp3',
    type: 'audio',
    lastModified: new Date('2024-02-15'),
  },
  {
    id: '8',
    name: 'image.png',
    size: 2100,
    isDirectory: false,
    path: '/image.png',
    type: 'image',
    lastModified: new Date('2024-03-05'),
  },
]

const largeDataset: TreemapItem[] = [
  ...sampleData,
  {
    id: '9',
    name: 'System',
    size: 25000,
    isDirectory: true,
    path: '/system',
    type: 'directory',
    lastModified: new Date('2024-01-01'),
  },
  {
    id: '10',
    name: 'Applications',
    size: 18000,
    isDirectory: true,
    path: '/applications',
    type: 'directory',
    lastModified: new Date('2024-01-10'),
  },
  {
    id: '11',
    name: 'database.db',
    size: 12000,
    isDirectory: false,
    path: '/database.db',
    type: 'data',
    lastModified: new Date('2024-02-20'),
  },
  {
    id: '12',
    name: 'backup.tar.gz',
    size: 35000,
    isDirectory: false,
    path: '/backup.tar.gz',
    type: 'archive',
    lastModified: new Date('2024-01-12'),
  },
]

export const Default: Story = {
  args: {
    data: sampleData,
    width: 600,
    height: 400,
    colorScheme: 'fileSize',
  },
}

export const FileTypeColors: Story = {
  args: {
    data: sampleData,
    width: 600,
    height: 400,
    colorScheme: 'fileType',
  },
}

export const FileAgeColors: Story = {
  args: {
    data: sampleData,
    width: 600,
    height: 400,
    colorScheme: 'fileAge',
  },
}

export const LargeDataset: Story = {
  args: {
    data: largeDataset,
    width: 800,
    height: 600,
    colorScheme: 'fileSize',
  },
}

export const SmallSize: Story = {
  args: {
    data: sampleData.slice(0, 4),
    width: 300,
    height: 200,
    colorScheme: 'fileType',
  },
}

export const WithSelection: Story = {
  args: {
    data: sampleData,
    width: 600,
    height: 400,
    colorScheme: 'fileSize',
    selectedIds: new Set(['2', '5']),
  },
}

export const Interactive: Story = {
  args: {
    data: sampleData,
    width: 600,
    height: 400,
    colorScheme: 'fileSize',
    onItemClick: (item) => console.log('Clicked:', item.name),
    onItemHover: (item) => console.log('Hovered:', item?.name || 'none'),
  },
}

export const EmptyState: Story = {
  args: {
    data: [],
    width: 600,
    height: 400,
    colorScheme: 'fileSize',
  },
}

export const SingleItem: Story = {
  args: {
    data: [sampleData[0]],
    width: 600,
    height: 400,
    colorScheme: 'fileSize',
  },
}
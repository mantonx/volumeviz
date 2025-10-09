/**
 * TreeMap Visualization Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { TreeMapVisualization } from './TreeMapVisualization';
import type { FileItem } from './TreeMapVisualization.types';

const meta: Meta<typeof TreeMapVisualization> = {
  title: 'Domain/Analytics/TreeMapVisualization',
  component: TreeMapVisualization,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TreeMapVisualization>;

// Sample file data for stories
const sampleFiles: FileItem[] = [
  // Videos folder (largest)
  { name: 'videos', path: '/data/videos', size: 52428800, is_directory: true },
  { name: 'movie1.mp4', path: '/data/videos/movie1.mp4', size: 20971520, is_directory: false, extension: 'mp4', modified_time: '2024-01-15T10:30:00Z' },
  { name: 'movie2.mkv', path: '/data/videos/movie2.mkv', size: 15728640, is_directory: false, extension: 'mkv', modified_time: '2024-02-20T14:20:00Z' },
  { name: 'tutorial.mp4', path: '/data/videos/tutorial.mp4', size: 10485760, is_directory: false, extension: 'mp4', modified_time: '2024-03-10T09:15:00Z' },
  { name: 'clips', path: '/data/videos/clips', size: 5242880, is_directory: true },
  { name: 'clip1.mp4', path: '/data/videos/clips/clip1.mp4', size: 2621440, is_directory: false, extension: 'mp4', modified_time: '2024-03-25T16:45:00Z' },
  { name: 'clip2.mp4', path: '/data/videos/clips/clip2.mp4', size: 2621440, is_directory: false, extension: 'mp4', modified_time: '2024-03-26T11:20:00Z' },

  // Images folder
  { name: 'images', path: '/data/images', size: 23592960, is_directory: true },
  { name: 'photo1.jpg', path: '/data/images/photo1.jpg', size: 5242880, is_directory: false, extension: 'jpg', modified_time: '2023-12-01T08:00:00Z' },
  { name: 'photo2.png', path: '/data/images/photo2.png', size: 8388608, is_directory: false, extension: 'png', modified_time: '2023-11-15T13:30:00Z' },
  { name: 'screenshot.png', path: '/data/images/screenshot.png', size: 2097152, is_directory: false, extension: 'png', modified_time: '2024-04-01T15:00:00Z' },
  { name: 'wallpapers', path: '/data/images/wallpapers', size: 7864320, is_directory: true },
  { name: 'wallpaper1.jpg', path: '/data/images/wallpapers/wallpaper1.jpg', size: 3932160, is_directory: false, extension: 'jpg', modified_time: '2023-10-10T10:00:00Z' },
  { name: 'wallpaper2.jpg', path: '/data/images/wallpapers/wallpaper2.jpg', size: 3932160, is_directory: false, extension: 'jpg', modified_time: '2023-10-11T11:00:00Z' },

  // Documents folder
  { name: 'documents', path: '/data/documents', size: 19660800, is_directory: true },
  { name: 'report.pdf', path: '/data/documents/report.pdf', size: 5242880, is_directory: false, extension: 'pdf', modified_time: '2024-01-05T09:00:00Z' },
  { name: 'presentation.pptx', path: '/data/documents/presentation.pptx', size: 8388608, is_directory: false, extension: 'pptx', modified_time: '2024-02-15T14:30:00Z' },
  { name: 'spreadsheet.xlsx', path: '/data/documents/spreadsheet.xlsx', size: 3145728, is_directory: false, extension: 'xlsx', modified_time: '2024-03-01T10:15:00Z' },
  { name: 'notes.txt', path: '/data/documents/notes.txt', size: 524288, is_directory: false, extension: 'txt', modified_time: '2024-03-30T08:45:00Z' },
  { name: 'archive', path: '/data/documents/archive', size: 2359296, is_directory: true },
  { name: 'old_report.pdf', path: '/data/documents/archive/old_report.pdf', size: 2359296, is_directory: false, extension: 'pdf', modified_time: '2022-06-15T12:00:00Z' },

  // Audio folder
  { name: 'music', path: '/data/music', size: 15728640, is_directory: true },
  { name: 'song1.mp3', path: '/data/music/song1.mp3', size: 5242880, is_directory: false, extension: 'mp3', modified_time: '2024-01-20T14:00:00Z' },
  { name: 'song2.flac', path: '/data/music/song2.flac', size: 8388608, is_directory: false, extension: 'flac', modified_time: '2024-02-10T16:30:00Z' },
  { name: 'podcast.mp3', path: '/data/music/podcast.mp3', size: 2097152, is_directory: false, extension: 'mp3', modified_time: '2024-03-15T09:00:00Z' },

  // Code folder
  { name: 'projects', path: '/data/projects', size: 10485760, is_directory: true },
  { name: 'app.js', path: '/data/projects/app.js', size: 524288, is_directory: false, extension: 'js', modified_time: '2024-04-05T11:30:00Z' },
  { name: 'styles.css', path: '/data/projects/styles.css', size: 262144, is_directory: false, extension: 'css', modified_time: '2024-04-05T11:35:00Z' },
  { name: 'main.py', path: '/data/projects/main.py', size: 1048576, is_directory: false, extension: 'py', modified_time: '2024-04-06T10:00:00Z' },
  { name: 'node_modules', path: '/data/projects/node_modules', size: 8650752, is_directory: true },
  { name: 'package.json', path: '/data/projects/node_modules/package.json', size: 4194304, is_directory: false, extension: 'json', modified_time: '2024-04-01T09:00:00Z' },
  { name: 'dist', path: '/data/projects/node_modules/dist', size: 4456448, is_directory: true },
  { name: 'bundle.js', path: '/data/projects/node_modules/dist/bundle.js', size: 4456448, is_directory: false, extension: 'js', modified_time: '2024-04-02T12:00:00Z' },

  // Archives folder
  { name: 'archives', path: '/data/archives', size: 8388608, is_directory: true },
  { name: 'backup.zip', path: '/data/archives/backup.zip', size: 5242880, is_directory: false, extension: 'zip', modified_time: '2023-08-15T18:00:00Z' },
  { name: 'data.tar.gz', path: '/data/archives/data.tar.gz', size: 3145728, is_directory: false, extension: 'gz', modified_time: '2023-09-20T14:00:00Z' },
];

/**
 * Default TreeMap view with file type coloring
 */
export const Default: Story = {
  args: {
    volumeId: 'sample-volume',
    files: sampleFiles,
    currentPath: '/data',
    colorScheme: 'fileType',
  },
};

/**
 * TreeMap with age-based coloring
 */
export const AgeColorScheme: Story = {
  args: {
    volumeId: 'sample-volume',
    files: sampleFiles,
    currentPath: '/data',
    colorScheme: 'age',
  },
};

/**
 * TreeMap with size-based coloring
 */
export const SizeColorScheme: Story = {
  args: {
    volumeId: 'sample-volume',
    files: sampleFiles,
    currentPath: '/data',
    colorScheme: 'size',
  },
};

/**
 * Empty state
 */
export const EmptyState: Story = {
  args: {
    volumeId: 'empty-volume',
    files: [],
    currentPath: '/data',
  },
};

/**
 * Small dataset (only a few files)
 */
export const SmallDataset: Story = {
  args: {
    volumeId: 'small-volume',
    files: [
      { name: 'file1.txt', path: '/data/file1.txt', size: 1024, is_directory: false, extension: 'txt' },
      { name: 'file2.pdf', path: '/data/file2.pdf', size: 5120, is_directory: false, extension: 'pdf' },
      { name: 'folder', path: '/data/folder', size: 10240, is_directory: true },
      { name: 'image.jpg', path: '/data/folder/image.jpg', size: 10240, is_directory: false, extension: 'jpg' },
    ],
    currentPath: '/data',
  },
};

/**
 * Custom height
 */
export const CustomHeight: Story = {
  args: {
    volumeId: 'sample-volume',
    files: sampleFiles,
    currentPath: '/data',
    height: 800,
  },
};

/**
 * With callbacks
 */
export const WithCallbacks: Story = {
  args: {
    volumeId: 'sample-volume',
    files: sampleFiles,
    currentPath: '/data',
    onFileClick: (node) => {
      console.log('File clicked:', node);
      alert(`Clicked: ${node.name} (${node.type})`);
    },
    onNavigate: (path) => {
      console.log('Navigating to:', path);
    },
  },
};

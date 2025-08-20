import type { Meta, StoryObj } from '@storybook/react';
import { VolumeCardWithProgress } from './VolumeCardWithProgress';
import type { Volume } from '../../../api/generated/Api';

const meta = {
  title: 'Domain/VolumeCardWithProgress',
  component: VolumeCardWithProgress,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onScanStart: { action: 'scan-start' },
    onScanStop: { action: 'scan-stop' },
    onScanPause: { action: 'scan-pause' },
    onScanResume: { action: 'scan-resume' },
    onClick: { action: 'card-click' },
    onViewDetails: { action: 'view-details' },
  },
} satisfies Meta<typeof VolumeCardWithProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseVolume: Volume = {
  id: '1',
  name: 'Media Library',
  path: '/mnt/media',
  mount_point: '/mnt/media',
  total_size: 1024 * 1024 * 1024 * 500,
  file_count: 15432,
  folder_count: 234,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

export const Default: Story = {
  args: {
    volume: baseVolume,
  },
};

export const Scanning: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-1',
      volumeId: '1',
      status: 'running',
      phase: 'filesystem_indexing',
      progress: 67,
      phaseProgress: 85,
      filesScanned: 10342,
      foldersScanned: 156,
      currentPath: '/mnt/media/movies/2024/action/movie-file.mp4',
      filesPerSecond: 250,
      bytesPerSecond: 1024 * 1024 * 50,
      errorsCount: 0,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 240,
    },
  },
};

export const Paused: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-2',
      volumeId: '1',
      status: 'paused',
      phase: 'media_enrichment',
      progress: 45,
      phaseProgress: 60,
      filesScanned: 6945,
      foldersScanned: 120,
      currentPath: '/mnt/media/tv-shows/series-name/season-01',
      filesPerSecond: 0,
      bytesPerSecond: 0,
      errorsCount: 1,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 480,
    },
  },
};

export const Completed: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-3',
      volumeId: '1',
      status: 'completed',
      phase: 'media_enrichment',
      progress: 100,
      phaseProgress: 100,
      filesScanned: 15432,
      foldersScanned: 234,
      filesPerSecond: 0,
      bytesPerSecond: 0,
      errorsCount: 0,
      startedAt: new Date(Date.now() - 600000).toISOString(),
    },
  },
};

export const Failed: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-4',
      volumeId: '1',
      status: 'failed',
      phase: 'volume_scan',
      progress: 23,
      phaseProgress: 45,
      filesScanned: 3542,
      foldersScanned: 54,
      currentPath: '/mnt/media/corrupted-folder',
      filesPerSecond: 0,
      bytesPerSecond: 0,
      errorsCount: 15,
      startedAt: new Date().toISOString(),
    },
  },
};

export const Pending: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-5',
      volumeId: '1',
      status: 'pending',
      progress: 0,
    },
  },
};

export const VolumeScanPhase: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-6',
      volumeId: '1',
      status: 'running',
      phase: 'volume_scan',
      progress: 15,
      phaseProgress: 30,
      filesScanned: 2314,
      foldersScanned: 35,
      currentPath: '/mnt/media/photos',
      filesPerSecond: 180,
      bytesPerSecond: 1024 * 1024 * 25,
      errorsCount: 0,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 850,
    },
  },
};

export const WithErrors: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-7',
      volumeId: '1',
      status: 'running',
      phase: 'filesystem_indexing',
      progress: 82,
      phaseProgress: 90,
      filesScanned: 12654,
      foldersScanned: 198,
      currentPath: '/mnt/media/restricted-folder',
      filesPerSecond: 120,
      bytesPerSecond: 1024 * 1024 * 15,
      errorsCount: 7,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 120,
    },
  },
};

export const SmallVolume: Story = {
  args: {
    volume: {
      ...baseVolume,
      name: 'Documents',
      path: '/home/user/documents',
      mount_point: '/home/user/documents',
      total_size: 1024 * 1024 * 250,
      file_count: 342,
      folder_count: 12,
    },
    scanProgress: {
      scanId: 'scan-8',
      volumeId: '1',
      status: 'running',
      phase: 'filesystem_indexing',
      progress: 95,
      phaseProgress: 98,
      filesScanned: 325,
      foldersScanned: 11,
      currentPath: '/home/user/documents/reports/2024',
      filesPerSecond: 450,
      bytesPerSecond: 1024 * 1024 * 2,
      errorsCount: 0,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 2,
    },
  },
};

export const LongPath: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-9',
      volumeId: '1',
      status: 'running',
      phase: 'filesystem_indexing',
      progress: 50,
      phaseProgress: 50,
      filesScanned: 7716,
      foldersScanned: 117,
      currentPath: '/mnt/media/very/long/path/to/deeply/nested/folder/structure/with/many/subdirectories/and/files/current-file.txt',
      filesPerSecond: 200,
      bytesPerSecond: 1024 * 1024 * 30,
      errorsCount: 0,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 300,
    },
  },
};

export const NoControls: Story = {
  args: {
    volume: baseVolume,
    scanProgress: {
      scanId: 'scan-10',
      volumeId: '1',
      status: 'running',
      phase: 'media_enrichment',
      progress: 75,
      phaseProgress: 80,
      filesScanned: 11574,
      foldersScanned: 175,
      currentPath: '/mnt/media/processing',
      filesPerSecond: 150,
      bytesPerSecond: 1024 * 1024 * 20,
      errorsCount: 2,
      startedAt: new Date().toISOString(),
      estimatedRemaining: 150,
    },
  },
};
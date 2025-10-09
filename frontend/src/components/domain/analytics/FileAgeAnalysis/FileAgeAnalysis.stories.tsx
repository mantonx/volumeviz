/**
 * File Age Analysis - Storybook Stories
 */

import type { Meta, StoryObj } from '@storybook/react';
import { FileAgeAnalysis } from './FileAgeAnalysis';
import type { FileItem } from './FileAgeAnalysis.types';

// Generate mock file data with various ages
function generateMockFiles(count: number): FileItem[] {
  const extensions = ['jpg', 'mp4', 'pdf', 'txt', 'zip', 'ts', 'py', 'csv'];
  const files: FileItem[] = [];

  const now = new Date();

  for (let i = 0; i < count; i++) {
    // Create files with various ages
    const ageInDays = Math.floor(Math.random() * 500); // 0-500 days old
    const modifiedDate = new Date(now.getTime() - ageInDays * 24 * 60 * 60 * 1000);

    // Random file size (10KB to 1GB)
    const size = Math.floor(Math.random() * 1000000000) + 10000;

    files.push({
      id: i,
      name: `file-${i}.${extensions[i % extensions.length]}`,
      path: `/data/folder-${Math.floor(i / 10)}/file-${i}.${extensions[i % extensions.length]}`,
      size,
      is_directory: false,
      modified_time: modifiedDate.toISOString(),
      extension: extensions[i % extensions.length],
    });
  }

  return files;
}

// Generate files with specific age distribution
function generateFilesWithDistribution(): FileItem[] {
  const files: FileItem[] = [];
  const now = new Date();

  // Very Recent (0-7 days) - 100 files
  for (let i = 0; i < 100; i++) {
    const age = Math.floor(Math.random() * 7);
    files.push({
      id: files.length,
      name: `recent-${i}.jpg`,
      path: `/data/recent/recent-${i}.jpg`,
      size: Math.floor(Math.random() * 10000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'jpg',
    });
  }

  // Recent (8-30 days) - 150 files
  for (let i = 0; i < 150; i++) {
    const age = 8 + Math.floor(Math.random() * 23);
    files.push({
      id: files.length,
      name: `medium-${i}.pdf`,
      path: `/data/docs/medium-${i}.pdf`,
      size: Math.floor(Math.random() * 50000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'pdf',
    });
  }

  // Medium (1-3 months) - 200 files
  for (let i = 0; i < 200; i++) {
    const age = 31 + Math.floor(Math.random() * 60);
    files.push({
      id: files.length,
      name: `old-${i}.mp4`,
      path: `/data/videos/old-${i}.mp4`,
      size: Math.floor(Math.random() * 200000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'mp4',
    });
  }

  // Old (3-6 months) - 250 files
  for (let i = 0; i < 250; i++) {
    const age = 91 + Math.floor(Math.random() * 90);
    files.push({
      id: files.length,
      name: `archive-${i}.zip`,
      path: `/data/archives/archive-${i}.zip`,
      size: Math.floor(Math.random() * 500000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'zip',
    });
  }

  // Very Old (6-12 months) - 180 files
  for (let i = 0; i < 180; i++) {
    const age = 181 + Math.floor(Math.random() * 185);
    files.push({
      id: files.length,
      name: `backup-${i}.tar`,
      path: `/data/backups/backup-${i}.tar`,
      size: Math.floor(Math.random() * 1000000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'tar',
    });
  }

  // Ancient (1+ years) - 120 files
  for (let i = 0; i < 120; i++) {
    const age = 366 + Math.floor(Math.random() * 365);
    files.push({
      id: files.length,
      name: `ancient-${i}.log`,
      path: `/data/logs/ancient-${i}.log`,
      size: Math.floor(Math.random() * 100000000),
      is_directory: false,
      modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
      extension: 'log',
    });
  }

  return files;
}

const meta: Meta<typeof FileAgeAnalysis> = {
  title: 'Domain/Analytics/FileAgeAnalysis',
  component: FileAgeAnalysis,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Comprehensive file age analysis with multiple visualizations showing file distribution, storage usage, and modification timeline.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FileAgeAnalysis>;

export const Default: Story = {
  args: {
    files: generateFilesWithDistribution(),
    volumeId: 'data-volume',
  },
};

export const SmallDataset: Story = {
  args: {
    files: generateMockFiles(50),
    volumeId: 'small-volume',
  },
};

export const LargeDataset: Story = {
  args: {
    files: generateMockFiles(5000),
    volumeId: 'large-volume',
  },
};

export const MostlyOldFiles: Story = {
  args: {
    files: (() => {
      const files: FileItem[] = [];
      const now = new Date();

      // 10% recent
      for (let i = 0; i < 100; i++) {
        files.push({
          id: i,
          name: `recent-${i}.jpg`,
          path: `/data/recent-${i}.jpg`,
          size: Math.floor(Math.random() * 10000000),
          is_directory: false,
          modified_time: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          extension: 'jpg',
        });
      }

      // 90% old (6+ months)
      for (let i = 100; i < 1000; i++) {
        const age = 180 + Math.floor(Math.random() * 500);
        files.push({
          id: i,
          name: `old-${i}.dat`,
          path: `/data/old-${i}.dat`,
          size: Math.floor(Math.random() * 100000000),
          is_directory: false,
          modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
          extension: 'dat',
        });
      }

      return files;
    })(),
    volumeId: 'cleanup-candidate-volume',
  },
};

export const MostlyRecentFiles: Story = {
  args: {
    files: (() => {
      const files: FileItem[] = [];
      const now = new Date();

      // 80% very recent
      for (let i = 0; i < 800; i++) {
        files.push({
          id: i,
          name: `active-${i}.tmp`,
          path: `/data/active/active-${i}.tmp`,
          size: Math.floor(Math.random() * 5000000),
          is_directory: false,
          modified_time: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          extension: 'tmp',
        });
      }

      // 20% older
      for (let i = 800; i < 1000; i++) {
        const age = 30 + Math.floor(Math.random() * 200);
        files.push({
          id: i,
          name: `older-${i}.bak`,
          path: `/data/older-${i}.bak`,
          size: Math.floor(Math.random() * 50000000),
          is_directory: false,
          modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
          extension: 'bak',
        });
      }

      return files;
    })(),
    volumeId: 'active-volume',
  },
};

export const WithCallbacks: Story = {
  args: {
    files: generateFilesWithDistribution(),
    volumeId: 'interactive-volume',
    onFileClick: (file) => {
      console.log('File clicked:', file);
      alert(`Clicked: ${file.name}\nPath: ${file.path}`);
    },
    onFilterByAge: (bucket) => {
      console.log('Filter by age:', bucket);
      alert(`Filter by: ${bucket.label}\n${bucket.fileCount} files, ${bucket.description}`);
    },
  },
};

export const EmptyState: Story = {
  args: {
    files: [],
    volumeId: 'empty-volume',
  },
};

export const OnlyDirectories: Story = {
  args: {
    files: (() => {
      const files: FileItem[] = [];
      for (let i = 0; i < 50; i++) {
        files.push({
          id: i,
          name: `folder-${i}`,
          path: `/data/folder-${i}`,
          size: 0,
          is_directory: true,
          modified_time: new Date().toISOString(),
        });
      }
      return files;
    })(),
    volumeId: 'dirs-only-volume',
  },
};

export const MixedModificationDates: Story = {
  args: {
    files: (() => {
      const files: FileItem[] = [];
      const now = new Date();

      // Files with no modification time
      for (let i = 0; i < 50; i++) {
        files.push({
          id: i,
          name: `unknown-${i}.dat`,
          path: `/data/unknown-${i}.dat`,
          size: Math.floor(Math.random() * 10000000),
          is_directory: false,
          extension: 'dat',
        });
      }

      // Files with various ages
      for (let i = 50; i < 500; i++) {
        const age = Math.floor(Math.random() * 730);
        files.push({
          id: i,
          name: `file-${i}.bin`,
          path: `/data/file-${i}.bin`,
          size: Math.floor(Math.random() * 50000000),
          is_directory: false,
          modified_time: new Date(now.getTime() - age * 24 * 60 * 60 * 1000).toISOString(),
          extension: 'bin',
        });
      }

      return files;
    })(),
    volumeId: 'mixed-volume',
  },
};

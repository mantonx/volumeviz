import type { Meta, StoryObj } from '@storybook/react'
import { TopNAnalysis } from './TopNAnalysis'

const meta = {
  title: 'Domain/Explorer/TopNAnalysis',
  component: TopNAnalysis,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isVisible: {
      control: { type: 'boolean' },
    },
    volumeId: {
      control: { type: 'text' },
    },
    path: {
      control: { type: 'text' },
    },
    topN: {
      control: { type: 'number', min: 5, max: 50 },
    },
  },
} satisfies Meta<typeof TopNAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isVisible: true,
    volumeId: 'project-drive',
    path: '/workspace',
    topN: 10,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const MediaLibrary: Story = {
  args: {
    isVisible: true,
    volumeId: 'media-library',
    path: '/photos-videos',
    topN: 15,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const DocumentStorage: Story = {
  args: {
    isVisible: true,
    volumeId: 'document-storage',
    path: '/company-docs',
    topN: 20,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const BackupAnalysis: Story = {
  args: {
    isVisible: true,
    volumeId: 'backup-drive',
    path: '/',
    topN: 25,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const ServerLogs: Story = {
  args: {
    isVisible: true,
    volumeId: 'log-storage',
    path: '/var/log',
    topN: 30,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const CloudSync: Story = {
  args: {
    isVisible: true,
    volumeId: 'cloud-sync',
    path: '/synced-folders',
    topN: 12,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const SmallDataset: Story = {
  args: {
    isVisible: true,
    volumeId: 'temp-files',
    path: '/tmp',
    topN: 5,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const LargeDataset: Story = {
  args: {
    isVisible: true,
    volumeId: 'enterprise-storage',
    path: '/data',
    topN: 50,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const Hidden: Story = {
  args: {
    isVisible: false,
    volumeId: 'project-drive',
    path: '/workspace',
    topN: 10,
    onClose: () => console.log('Close Top-N analysis'),
    onItemClick: (item, category) => console.log('Item clicked:', { item, category }),
    onRefresh: () => console.log('Refresh analysis'),
  },
}

export const InteractiveDemo: Story = {
  args: {
    isVisible: true,
    volumeId: 'demo-analysis',
    path: '/demo-data',
    topN: 15,
    onClose: () => {
      console.log('Top-N analysis closed');
      // In a real app, this would update state to hide the overlay
    },
    onItemClick: (item, category) => {
      console.log('Top-N item clicked:', {
        itemName: item.name,
        itemPath: item.path,
        itemValue: item.value,
        categoryName: category.name,
        categoryId: category.id,
        percentage: item.percentage,
        trend: item.trend,
      });
      // In a real app, this might navigate to the file or show details
    },
    onRefresh: () => {
      console.log('Analysis refresh requested');
      // In a real app, this would reload the analysis data
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen">
        <div className="p-4 bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            Interactive Top-N analysis - try switching between overview and detailed views
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}
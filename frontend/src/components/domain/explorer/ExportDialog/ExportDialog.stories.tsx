import type { Meta, StoryObj } from '@storybook/react'
import { ExportDialog } from './ExportDialog'

const meta = {
  title: 'Domain/Explorer/ExportDialog',
  component: ExportDialog,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    isVisible: {
      control: { type: 'boolean' },
    },
    supportedFormats: {
      control: { type: 'check', options: ['png', 'pdf', 'svg', 'csv', 'json'] },
    },
  },
} satisfies Meta<typeof ExportDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isVisible: true,
    title: 'Export Visualization',
    description: 'Export your data visualization in various formats',
    supportedFormats: ['png', 'pdf', 'svg', 'csv', 'json'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Export options:', options)
      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 2000))
    },
  },
}

export const ImageFormatsOnly: Story = {
  args: {
    isVisible: true,
    title: 'Export Chart',
    description: 'Export your chart as an image file',
    supportedFormats: ['png', 'pdf', 'svg'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Export options:', options)
      await new Promise(resolve => setTimeout(resolve, 1500))
    },
  },
}

export const DataFormatsOnly: Story = {
  args: {
    isVisible: true,
    title: 'Export Data',
    description: 'Export your data in structured formats',
    supportedFormats: ['csv', 'json'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Export options:', options)
      await new Promise(resolve => setTimeout(resolve, 1000))
    },
  },
}

export const TreemapExport: Story = {
  args: {
    isVisible: true,
    title: 'Export Treemap Visualization',
    description: 'Export your treemap in high quality formats',
    supportedFormats: ['png', 'svg', 'pdf'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Treemap export options:', options)
      await new Promise(resolve => setTimeout(resolve, 2500))
    },
  },
}

export const SunburstExport: Story = {
  args: {
    isVisible: true,
    title: 'Export Sunburst Chart',
    description: 'Export your sunburst visualization',
    supportedFormats: ['png', 'svg', 'pdf'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Sunburst export options:', options)
      await new Promise(resolve => setTimeout(resolve, 3000))
    },
  },
}

export const ExportWithError: Story = {
  args: {
    isVisible: true,
    title: 'Export Visualization',
    description: 'Export your data visualization in various formats',
    supportedFormats: ['png', 'pdf', 'svg', 'csv', 'json'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Export options:', options)
      await new Promise(resolve => setTimeout(resolve, 1000))
      throw new Error('Failed to generate export file. Please try again.')
    },
  },
}

export const QuickPNGExport: Story = {
  args: {
    isVisible: true,
    title: 'Quick PNG Export',
    description: 'Export current view as PNG image',
    supportedFormats: ['png'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Quick PNG export:', options)
      await new Promise(resolve => setTimeout(resolve, 800))
    },
  },
}

export const InteractiveDemo: Story = {
  args: {
    isVisible: true,
    title: 'Interactive Export Demo',
    description: 'Try different export formats and options',
    supportedFormats: ['png', 'pdf', 'svg', 'csv', 'json'],
    onClose: () => {
      console.log('Export dialog closed')
      // In a real app, this would update state to hide the dialog
    },
    onExport: async (options) => {
      console.log('Export started with options:', {
        format: options.format,
        quality: options.quality,
        size: options.size,
        dimensions: options.width && options.height ? `${options.width}×${options.height}` : undefined,
        includeData: options.includeData,
        includeMetadata: options.includeMetadata,
        backgroundColor: options.backgroundColor,
        transparent: options.transparent,
      })
      
      // Simulate different export times based on format
      const exportTimes = {
        png: 1500,
        pdf: 2500,
        svg: 800,
        csv: 1000,
        json: 600,
      }
      
      await new Promise(resolve => setTimeout(resolve, exportTimes[options.format]))
      
      console.log('Export completed successfully')
      // In a real app, this would trigger file download
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-50">
        <div className="p-4 bg-green-50 text-center">
          <p className="text-sm text-green-700">
            Interactive export dialog - try different formats and settings
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const Hidden: Story = {
  args: {
    isVisible: false,
    title: 'Export Visualization',
    description: 'Export your data visualization in various formats',
    supportedFormats: ['png', 'pdf', 'svg', 'csv', 'json'],
    onClose: () => console.log('Export dialog closed'),
    onExport: async (options) => {
      console.log('Export options:', options)
      await new Promise(resolve => setTimeout(resolve, 2000))
    },
  },
}
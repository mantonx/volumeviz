import type { Meta, StoryObj } from '@storybook/react'
import { WebWorkerTreemap } from './WebWorkerTreemap'

const meta = {
  title: 'Domain/Explorer/WebWorkerTreemap',
  component: WebWorkerTreemap,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'range', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 300, max: 800, step: 50 },
    },
    padding: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
    },
    showPerformanceMetrics: {
      control: { type: 'boolean' },
    },
    fallbackToSync: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof WebWorkerTreemap>

export default meta
type Story = StoryObj<typeof meta>

// Mock data for stories
const smallDataset = [
  { id: '1', name: 'Documents', value: 1024000 },
  { id: '2', name: 'Images', value: 2048000 },
  { id: '3', name: 'Videos', value: 4096000 },
  { id: '4', name: 'Music', value: 512000 },
]

const mediumDataset = [
  { id: '1', name: 'System Files', value: 8192000 },
  { id: '2', name: 'Applications', value: 6144000 },
  { id: '3', name: 'User Data', value: 12288000 },
  { id: '4', name: 'Documents', value: 3072000 },
  { id: '5', name: 'Downloads', value: 4096000 },
  { id: '6', name: 'Desktop', value: 1024000 },
  { id: '7', name: 'Pictures', value: 5120000 },
  { id: '8', name: 'Videos', value: 15360000 },
  { id: '9', name: 'Music', value: 2048000 },
  { id: '10', name: 'Temp Files', value: 1536000 },
]

const largeDataset = Array.from({ length: 50 }, (_, i) => ({
  id: `file-${i}`,
  name: `File ${i + 1}`,
  value: Math.floor(Math.random() * 10000000) + 100000,
}))

export const Default: Story = {
  args: {
    data: smallDataset,
    width: 800,
    height: 600,
    showPerformanceMetrics: true,
    onNodeClick: (node) => console.log('Node clicked:', node),
    onNodeHover: (node) => console.log('Node hovered:', node),
  },
}

export const SmallDataset: Story = {
  args: {
    data: smallDataset,
    width: 600,
    height: 400,
    showPerformanceMetrics: true,
    fallbackToSync: true,
  },
}

export const MediumDataset: Story = {
  args: {
    data: mediumDataset,
    width: 800,
    height: 600,
    padding: 3,
    showPerformanceMetrics: true,
    onNodeClick: (node) => console.log('Medium dataset - Node clicked:', node.name, node.value),
  },
}

export const LargeDataset: Story = {
  args: {
    data: largeDataset,
    width: 1000,
    height: 700,
    padding: 2,
    minSize: 15,
    showPerformanceMetrics: true,
    onNodeClick: (node) => console.log('Large dataset - Node clicked:', node),
  },
}

export const CustomStyling: Story = {
  args: {
    data: mediumDataset,
    width: 800,
    height: 600,
    padding: 5,
    minSize: 20,
    showPerformanceMetrics: true,
    className: 'border-4 border-blue-500 rounded-xl shadow-lg',
  },
}

export const WithFallback: Story = {
  args: {
    data: smallDataset,
    width: 600,
    height: 400,
    showPerformanceMetrics: true,
    fallbackToSync: true,
  },
}

export const PerformanceComparison: Story = {
  render: () => (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Web Worker Performance Comparison
        </h2>
        <p className="text-gray-600 mb-8">
          Compare Web Worker vs synchronous treemap calculations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Web Worker (Non-blocking)</h3>
          <WebWorkerTreemap
            data={largeDataset}
            width={500}
            height={400}
            showPerformanceMetrics={true}
            fallbackToSync={false}
            onNodeClick={(node) => console.log('Worker - Clicked:', node.name)}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Synchronous Fallback</h3>
          <WebWorkerTreemap
            data={smallDataset} // Use smaller dataset for fallback demo
            width={500}
            height={400}
            showPerformanceMetrics={true}
            fallbackToSync={true}
            onNodeClick={(node) => console.log('Fallback - Clicked:', node.name)}
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Performance Benefits:</h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Web Workers prevent UI blocking during complex calculations</li>
          <li>• Automatic fallback ensures compatibility across all browsers</li>
          <li>• Performance metrics help monitor calculation efficiency</li>
          <li>• Large datasets benefit most from worker-based processing</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
}

export const InteractiveDemo: Story = {
  args: {
    data: mediumDataset,
    width: 800,
    height: 600,
    showPerformanceMetrics: true,
    onNodeClick: (node) => {
      console.log('Interactive demo - Node clicked:', {
        name: node.name,
        value: node.value,
        size: `${(node.value / 1024 / 1024).toFixed(1)} MB`,
        position: `${node.x},${node.y}`,
        dimensions: `${Math.round(node.width)}×${Math.round(node.height)}`,
      });
    },
    onNodeHover: (node) => {
      if (node) {
        console.log('Interactive demo - Hovering:', node.name);
      }
    },
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">
            Interactive Web Worker Treemap
          </h3>
          <p className="text-green-700 text-sm">
            Click on rectangles to see detailed information. 
            Check browser console for click/hover events.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const EmptyState: Story = {
  args: {
    data: [],
    width: 600,
    height: 400,
    showPerformanceMetrics: true,
  },
}

export const ErrorHandling: Story = {
  args: {
    data: mediumDataset,
    width: 800,
    height: 600,
    showPerformanceMetrics: true,
    fallbackToSync: false, // Force potential worker errors
  },
}
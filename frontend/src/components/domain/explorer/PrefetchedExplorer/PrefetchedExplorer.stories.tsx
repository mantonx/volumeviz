import type { Meta, StoryObj } from '@storybook/react'
import { PrefetchedExplorer } from './PrefetchedExplorer'

const meta = {
  title: 'Domain/Explorer/PrefetchedExplorer',
  component: PrefetchedExplorer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    initialPath: {
      control: { type: 'text' },
    },
    showPrefetchStats: {
      control: { type: 'boolean' },
    },
    showPredictions: {
      control: { type: 'boolean' },
    },
    enableOptimizations: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof PrefetchedExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    initialPath: '/home',
    showPrefetchStats: true,
    showPredictions: true,
    enableOptimizations: true,
    onPathChange: (path) => console.log('Path changed:', path),
  },
}

export const WithoutStats: Story = {
  args: {
    initialPath: '/documents',
    showPrefetchStats: false,
    showPredictions: true,
    enableOptimizations: true,
  },
}

export const WithoutPredictions: Story = {
  args: {
    initialPath: '/downloads',
    showPrefetchStats: true,
    showPredictions: false,
    enableOptimizations: true,
  },
}

export const BasicMode: Story = {
  args: {
    initialPath: '/media',
    showPrefetchStats: false,
    showPredictions: false,
    enableOptimizations: false,
  },
}

export const PerformanceDemo: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Prefetch Performance Comparison
        </h2>
        <p className="text-gray-600 mb-8">
          Compare navigation performance with and without prefetching
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">With Smart Prefetching</h3>
          <div className="border rounded-lg">
            <PrefetchedExplorer
              initialPath="/home"
              showPrefetchStats={true}
              showPredictions={true}
              enableOptimizations={true}
              onPathChange={(path) => console.log('Optimized - Path:', path)}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Without Prefetching</h3>
          <div className="border rounded-lg">
            <PrefetchedExplorer
              initialPath="/home"
              showPrefetchStats={true}
              showPredictions={false}
              enableOptimizations={false}
              onPathChange={(path) => console.log('Basic - Path:', path)}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Prefetch Benefits:</h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Dramatically faster navigation to predicted paths</li>
          <li>• Background loading prevents UI blocking</li>
          <li>• Smart cache management optimizes memory usage</li>
          <li>• Hover-based prefetching for instant access</li>
          <li>• Adaptive strategies learn from user behavior</li>
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
    initialPath: '/projects',
    showPrefetchStats: true,
    showPredictions: true,
    enableOptimizations: true,
    onPathChange: (path) => {
      console.log('Interactive demo - Navigation to:', path);
      console.log('Try navigating between predicted paths to see cache hits');
    },
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">
            Interactive Prefetch Demo
          </h3>
          <p className="text-green-700 text-sm">
            Navigate between paths to see prefetching in action. 
            Green buttons indicate prefetched data ready for instant access.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const LearningBehavior: Story = {
  render: () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Adaptive Learning Demo
          </h2>
          <p className="text-gray-600 mb-4">
            The system learns your navigation patterns and improves predictions over time
          </p>
        </div>

        <PrefetchedExplorer
          initialPath="/workspace"
          showPrefetchStats={true}
          showPredictions={true}
          enableOptimizations={true}
          onPathChange={(path) => {
            console.log('Learning demo - Path changed:', path);
          }}
        />

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-900 mb-2">How It Learns:</h4>
          <div className="text-yellow-800 text-sm space-y-2">
            <div>• <strong>Frequency Analysis:</strong> Tracks how often you visit each path</div>
            <div>• <strong>Navigation Chains:</strong> Learns which paths you typically visit after others</div>
            <div>• <strong>Time Patterns:</strong> Records how long you spend in different locations</div>
            <div>• <strong>Sibling Prediction:</strong> Anticipates exploration of related directories</div>
            <div>• <strong>Recency Boost:</strong> Prioritizes recently visited locations</div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
}

export const MemoryOptimized: Story = {
  args: {
    initialPath: '/large-dataset',
    showPrefetchStats: true,
    showPredictions: true,
    enableOptimizations: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-medium text-purple-900 mb-2">
            Memory-Optimized Prefetching
          </h3>
          <p className="text-purple-700 text-sm">
            Watch the cache statistics to see intelligent memory management in action.
            The system automatically evicts old data to stay within memory limits.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const NetworkAware: Story = {
  args: {
    initialPath: '/remote-data',
    showPrefetchStats: true,
    showPredictions: true,
    enableOptimizations: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <h3 className="font-medium text-indigo-900 mb-2">
            Network-Aware Prefetching
          </h3>
          <p className="text-indigo-700 text-sm">
            The system adapts to network conditions, reducing prefetching on slow connections
            and being more aggressive on fast connections.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
}

export const DeepNavigation: Story = {
  args: {
    initialPath: '/deep/nested/path/structure',
    showPrefetchStats: true,
    showPredictions: true,
    enableOptimizations: true,
  },
}
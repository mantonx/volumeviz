import type { Meta, StoryObj } from '@storybook/react';
import { AdaptiveExplorer } from './AdaptiveExplorer';

const meta = {
  title: 'Domain/Explorer/AdaptiveExplorer',
  component: AdaptiveExplorer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    initialPath: {
      control: { type: 'text' },
    },
    showAdaptationStats: {
      control: { type: 'boolean' },
    },
    showDeviceInfo: {
      control: { type: 'boolean' },
    },
    enablePerformanceMonitoring: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof AdaptiveExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialPath: '/home',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
    onPathChange: (path) => console.log('Path changed:', path),
  },
};

export const HighEndDevice: Story = {
  args: {
    initialPath: '/projects',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">
            High-End Device Simulation
          </h3>
          <p className="text-green-700 text-sm">
            This demo simulates a high-end device with fast network, high
            memory, and multiple CPU cores. The system will use the
            "high-performance" strategy with larger chunks and higher quality
            rendering.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export const LowEndDevice: Story = {
  args: {
    initialPath: '/documents',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <h3 className="font-medium text-orange-900 mb-2">
            Low-End Device Simulation
          </h3>
          <p className="text-orange-700 text-sm">
            This demo simulates a low-end device with slow network and limited
            resources. The system will use the "low-resource" strategy with
            smaller chunks and reduced quality.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export const BatterySaverMode: Story = {
  args: {
    initialPath: '/media',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-900 mb-2">
            Battery Saver Mode
          </h3>
          <p className="text-yellow-700 text-sm">
            This demo simulates a device with low battery level. The system will
            automatically switch to the "battery-saver" strategy to conserve
            energy.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export const AdaptationComparison: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Adaptive Loading Comparison
        </h2>
        <p className="text-gray-600 mb-8">
          Compare how different device conditions affect loading strategies
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">
            High Performance Device
          </h3>
          <div className="border rounded-lg">
            <AdaptiveExplorer
              initialPath="/high-performance"
              showAdaptationStats={true}
              showDeviceInfo={false}
              enablePerformanceMonitoring={true}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">
            Resource-Constrained Device
          </h3>
          <div className="border rounded-lg">
            <AdaptiveExplorer
              initialPath="/low-resource"
              showAdaptationStats={true}
              showDeviceInfo={false}
              enablePerformanceMonitoring={true}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Adaptive Strategies:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-blue-800 text-sm">
          <div>
            <strong>High Performance:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Larger chunk sizes (10,000 items)</li>
              <li>• Higher prefetch distance</li>
              <li>• Multiple worker threads</li>
              <li>• High-quality rendering</li>
            </ul>
          </div>
          <div>
            <strong>Low Resource:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Smaller chunks (1,000 items)</li>
              <li>• Minimal prefetching</li>
              <li>• Single worker thread</li>
              <li>• Reduced quality rendering</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const PerformanceMonitoring: Story = {
  args: {
    initialPath: '/monitoring',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-medium text-purple-900 mb-2">
            Performance Monitoring Demo
          </h3>
          <p className="text-purple-700 text-sm mb-3">
            This demo showcases real-time performance monitoring and adaptive
            learning. Navigate between different paths to see how the system
            learns and adapts.
          </p>
          <div className="text-purple-800 text-sm space-y-1">
            <div>
              • <strong>Navigation Tracking:</strong> Records time spent and
              success rates
            </div>
            <div>
              • <strong>Chunk Loading:</strong> Monitors rendering performance
            </div>
            <div>
              • <strong>Strategy Learning:</strong> Automatically switches to
              better strategies
            </div>
            <div>
              • <strong>Real-time Metrics:</strong> Shows performance statistics
              as you use the interface
            </div>
          </div>
        </div>
        <Story />
      </div>
    ),
  ],
};

export const MinimalView: Story = {
  args: {
    initialPath: '/minimal',
    showAdaptationStats: false,
    showDeviceInfo: false,
    enablePerformanceMonitoring: false,
  },
};

export const LearningBehavior: Story = {
  render: () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Adaptive Learning Demo
          </h2>
          <p className="text-gray-600 mb-4">
            The system learns from your usage patterns and device
            characteristics to optimize performance
          </p>
        </div>

        <AdaptiveExplorer
          initialPath="/learning"
          showAdaptationStats={true}
          showDeviceInfo={true}
          enablePerformanceMonitoring={true}
        />

        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <h4 className="font-medium text-indigo-900 mb-2">
            Learning Mechanisms:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-indigo-800 text-sm">
            <div>
              <div>
                • <strong>Device Detection:</strong> Automatically detects CPU,
                memory, and network capabilities
              </div>
              <div>
                • <strong>Usage Patterns:</strong> Tracks navigation frequency
                and visualization preferences
              </div>
              <div>
                • <strong>Performance History:</strong> Records operation
                success rates and durations
              </div>
            </div>
            <div>
              <div>
                • <strong>Strategy Selection:</strong> Chooses optimal loading
                strategy based on all factors
              </div>
              <div>
                • <strong>Real-time Adaptation:</strong> Switches strategies if
                performance degrades
              </div>
              <div>
                • <strong>Continuous Learning:</strong> Improves predictions
                with more usage data
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  parameters: {
    layout: 'padded',
  },
};

export const NetworkAware: Story = {
  args: {
    initialPath: '/network-aware',
    showAdaptationStats: true,
    showDeviceInfo: true,
    enablePerformanceMonitoring: true,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
          <h3 className="font-medium text-cyan-900 mb-2">
            Network-Aware Loading
          </h3>
          <p className="text-cyan-700 text-sm">
            The system detects network conditions and adjusts loading behavior
            accordingly. On slow connections, it reduces chunk sizes and
            prefetching to improve responsiveness.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

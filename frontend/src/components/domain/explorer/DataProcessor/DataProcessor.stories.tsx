import type { Meta, StoryObj } from '@storybook/react';
import { DataProcessor } from './DataProcessor';

const meta = {
  title: 'Domain/Explorer/DataProcessor',
  component: DataProcessor,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    autoProcess: {
      control: { type: 'boolean' },
    },
    showProgress: {
      control: { type: 'boolean' },
    },
    showMetrics: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof DataProcessor>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for stories
const createMockFile = (
  id: string,
  name: string,
  size: number,
  type: 'file' | 'directory',
  extension?: string,
) => ({
  id,
  name,
  path: `/mock/path/${name}`,
  size,
  type,
  modified: '2024-01-15T10:30:00Z',
  extension,
  mimeType: extension ? `application/${extension}` : undefined,
});

const smallDataset = [
  createMockFile('1', 'document.pdf', 1024000, 'file', 'pdf'),
  createMockFile('2', 'image.jpg', 2048000, 'file', 'jpg'),
  createMockFile('3', 'video.mp4', 4096000, 'file', 'mp4'),
  createMockFile('4', 'Documents', 0, 'directory'),
  createMockFile('5', 'Photos', 0, 'directory'),
];

const mediumDataset = [
  ...Array.from({ length: 50 }, (_, i) =>
    createMockFile(
      `file-${i}`,
      `file-${i}.txt`,
      Math.floor(Math.random() * 5000000) + 100000,
      'file',
      ['txt', 'pdf', 'jpg', 'png', 'mp4', 'mp3', 'doc', 'xlsx'][
        Math.floor(Math.random() * 8)
      ],
    ),
  ),
  ...Array.from({ length: 10 }, (_, i) =>
    createMockFile(`dir-${i}`, `Directory ${i}`, 0, 'directory'),
  ),
];

const largeDataset = [
  ...Array.from({ length: 500 }, (_, i) =>
    createMockFile(
      `large-file-${i}`,
      `large-file-${i}.dat`,
      Math.floor(Math.random() * 10000000) + 500000,
      'file',
      ['dat', 'bin', 'log', 'tmp'][Math.floor(Math.random() * 4)],
    ),
  ),
  ...Array.from({ length: 50 }, (_, i) =>
    createMockFile(`large-dir-${i}`, `Large Directory ${i}`, 0, 'directory'),
  ),
];

export const Default: Story = {
  args: {
    data: smallDataset,
    showProgress: true,
    showMetrics: true,
    onProcessingComplete: (result) => {
      console.log('Processing completed:', result);
    },
    onError: (error) => {
      console.error('Processing error:', error);
    },
  },
};

export const SmallDataset: Story = {
  args: {
    data: smallDataset,
    autoProcess: true,
    showProgress: true,
    showMetrics: true,
  },
};

export const MediumDataset: Story = {
  args: {
    data: mediumDataset,
    showProgress: true,
    showMetrics: true,
    onProcessingComplete: (result) => {
      console.log('Medium dataset processed:', {
        totalSize: result.totalSize,
        fileCount: result.fileCount,
        processingTime: result.processingTime,
        extensionCount: Object.keys(result.extensionStats).length,
      });
    },
  },
};

export const LargeDataset: Story = {
  args: {
    data: largeDataset,
    showProgress: true,
    showMetrics: true,
    onProcessingComplete: (result) => {
      console.log('Large dataset processed:', {
        totalItems: result.totalCount,
        processingTime: result.processingTime,
        duplicateGroups: result.duplicates.length,
      });
    },
  },
};

export const AutoProcess: Story = {
  args: {
    data: mediumDataset,
    autoProcess: true,
    showProgress: true,
    showMetrics: true,
  },
};

export const MinimalUI: Story = {
  args: {
    data: smallDataset,
    showProgress: false,
    showMetrics: false,
    onProcessingComplete: (result) => {
      console.log(
        'Minimal UI processing completed:',
        result.totalCount,
        'items',
      );
    },
  },
};

export const PerformanceDemo: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Web Worker Data Processing Performance
        </h2>
        <p className="text-gray-600 mb-8">
          Compare processing times for different dataset sizes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Small Dataset</h3>
          <div className="border rounded-lg p-4">
            <DataProcessor
              data={smallDataset}
              showProgress={true}
              showMetrics={true}
              onProcessingComplete={(result) => {
                console.log(
                  'Small dataset:',
                  result.processingTime.toFixed(1) + 'ms',
                );
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Medium Dataset</h3>
          <div className="border rounded-lg p-4">
            <DataProcessor
              data={mediumDataset}
              showProgress={true}
              showMetrics={true}
              onProcessingComplete={(result) => {
                console.log(
                  'Medium dataset:',
                  result.processingTime.toFixed(1) + 'ms',
                );
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Large Dataset</h3>
          <div className="border rounded-lg p-4">
            <DataProcessor
              data={largeDataset}
              showProgress={true}
              showMetrics={true}
              onProcessingComplete={(result) => {
                console.log(
                  'Large dataset:',
                  result.processingTime.toFixed(1) + 'ms',
                );
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Web Worker Benefits:</h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Non-blocking processing keeps UI responsive</li>
          <li>• Automatic progress tracking and error handling</li>
          <li>• Efficient duplicate detection and file analysis</li>
          <li>• Scales well with large datasets (500+ files)</li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const InteractiveDemo: Story = {
  args: {
    data: mediumDataset,
    showProgress: true,
    showMetrics: true,
    onProcessingComplete: (result) => {
      console.log('Interactive demo - Processing completed:', {
        summary: `Processed ${result.totalCount} items (${result.fileCount} files, ${result.dirCount} directories)`,
        size: `Total size: ${(result.totalSize / 1024 / 1024).toFixed(1)} MB`,
        time: `Processing time: ${result.processingTime.toFixed(1)}ms`,
        extensions: `File types: ${Object.keys(result.extensionStats).length}`,
        duplicates: `Duplicate groups: ${result.duplicates.length}`,
        largest: result.largestFile
          ? `Largest file: ${result.largestFile.name}`
          : 'No files',
      });
    },
    onError: (error) => {
      console.error('Interactive demo - Processing error:', error);
    },
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">
            Interactive Data Processing Demo
          </h3>
          <p className="text-green-700 text-sm">
            Click "Process Data" to analyze the dataset. Check browser console
            for detailed results.
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
};

export const EmptyState: Story = {
  args: {
    data: [],
    showProgress: true,
    showMetrics: true,
  },
};

export const ErrorHandling: Story = {
  args: {
    data: mediumDataset,
    showProgress: true,
    showMetrics: true,
    onError: (error) => {
      console.log('Error handling demo:', error);
    },
  },
};

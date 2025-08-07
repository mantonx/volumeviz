import type { Meta, StoryObj } from '@storybook/react';
import { ScanButton } from './ScanButton';
import { Provider } from 'jotai';

const meta = {
  title: 'Volume/ScanButton',
  component: ScanButton,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Provider>
        <Story />
      </Provider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof ScanButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    volumeId: 'test-volume-1',
  },
};

export const IconVariant: Story = {
  args: {
    volumeId: 'test-volume-2',
    variant: 'icon',
  },
};

export const CompactVariant: Story = {
  args: {
    volumeId: 'test-volume-3',
    variant: 'compact',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <ScanButton volumeId="vol-1" size="sm" />
      <ScanButton volumeId="vol-2" size="md" />
      <ScanButton volumeId="vol-3" size="lg" />
    </div>
  ),
};

export const IconSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ScanButton volumeId="vol-1" variant="icon" size="sm" />
      <ScanButton volumeId="vol-2" variant="icon" size="md" />
      <ScanButton volumeId="vol-3" variant="icon" size="lg" />
    </div>
  ),
};

export const CompactSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ScanButton volumeId="vol-1" variant="compact" size="sm" />
      <ScanButton volumeId="vol-2" variant="compact" size="md" />
      <ScanButton volumeId="vol-3" variant="compact" size="lg" />
    </div>
  ),
};

export const WithStatus: Story = {
  args: {
    volumeId: 'test-volume-4',
    showStatus: true,
  },
};

export const LoadingState: Story = {
  render: () => {
    // This would show loading state if the volume is in scanningVolumesAtom
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Click button to see loading state
        </p>
        <ScanButton volumeId="test-volume-5" />
      </div>
    );
  },
};

export const ErrorState: Story = {
  render: () => {
    // This would show error state after a failed scan
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Simulated error state</p>
        <ScanButton volumeId="test-volume-6" showStatus />
      </div>
    );
  },
};

export const InVolumeCard: Story = {
  render: () => (
    <div className="w-96 p-4 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">postgres-data</h3>
        <ScanButton volumeId="postgres-data" variant="icon" size="sm" />
      </div>
      <p className="text-sm text-gray-600">Local volume • 5.2 GB</p>
    </div>
  ),
};

export const InTableRow: Story = {
  render: () => (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2">Volume</th>
          <th className="text-left p-2">Size</th>
          <th className="text-left p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b">
          <td className="p-2">postgres-data</td>
          <td className="p-2">5.2 GB</td>
          <td className="p-2">
            <ScanButton volumeId="postgres-data" variant="compact" size="sm" />
          </td>
        </tr>
        <tr className="border-b">
          <td className="p-2">redis-data</td>
          <td className="p-2">256 MB</td>
          <td className="p-2">
            <ScanButton volumeId="redis-data" variant="compact" size="sm" />
          </td>
        </tr>
      </tbody>
    </table>
  ),
};

export const CustomCallbacks: Story = {
  args: {
    volumeId: 'test-volume-7',
    onScanComplete: (result) => {
      console.log('Scan completed:', result);
      alert('Scan completed successfully!');
    },
    onScanError: (error) => {
      console.error('Scan error:', error);
      alert(`Scan failed: ${error.message}`);
    },
  },
};

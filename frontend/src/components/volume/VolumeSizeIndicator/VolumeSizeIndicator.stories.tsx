import type { Meta, StoryObj } from '@storybook/react';
import { VolumeSizeIndicator } from './VolumeSizeIndicator';

const meta = {
  title: 'Volume/VolumeSizeIndicator',
  component: VolumeSizeIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VolumeSizeIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 1073741824, // 1GB
  },
};

export const WithMaxSize: Story = {
  args: {
    size: 5368709120, // 5GB
    maxSize: 10737418240, // 10GB
  },
};

export const BarVariants: Story = {
  render: () => (
    <div className="space-y-6 w-96">
      <div>
        <h3 className="text-sm font-medium mb-2">Low Usage (25%)</h3>
        <VolumeSizeIndicator
          size={2684354560}
          maxSize={10737418240}
          variant="bar"
          colorScheme="status"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Medium Usage (60%)</h3>
        <VolumeSizeIndicator
          size={6442450944}
          maxSize={10737418240}
          variant="bar"
          colorScheme="status"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">High Usage (85%)</h3>
        <VolumeSizeIndicator
          size={9126805504}
          maxSize={10737418240}
          variant="bar"
          colorScheme="status"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Critical Usage (95%)</h3>
        <VolumeSizeIndicator
          size={10200547328}
          maxSize={10737418240}
          variant="bar"
          colorScheme="status"
        />
      </div>
    </div>
  ),
};

export const CircleVariants: Story = {
  render: () => (
    <div className="flex gap-8">
      <div className="text-center">
        <h3 className="text-sm font-medium mb-4">Small Volume</h3>
        <VolumeSizeIndicator
          size={268435456} // 256MB
          maxSize={1073741824} // 1GB
          variant="circle"
          colorScheme="status"
        />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium mb-4">Medium Volume</h3>
        <VolumeSizeIndicator
          size={5368709120} // 5GB
          maxSize={10737418240} // 10GB
          variant="circle"
          colorScheme="status"
        />
      </div>
      <div className="text-center">
        <h3 className="text-sm font-medium mb-4">Large Volume</h3>
        <VolumeSizeIndicator
          size={19327352832} // 18GB
          maxSize={21474836480} // 20GB
          variant="circle"
          colorScheme="status"
        />
      </div>
    </div>
  ),
};

export const CompactVariants: Story = {
  render: () => (
    <div className="space-y-2">
      <VolumeSizeIndicator size={0} variant="compact" />
      <VolumeSizeIndicator size={1024} variant="compact" />
      <VolumeSizeIndicator size={1048576} variant="compact" />
      <VolumeSizeIndicator size={268435456} variant="compact" />
      <VolumeSizeIndicator size={1073741824} variant="compact" />
      <VolumeSizeIndicator size={5368709120} variant="compact" />
      <VolumeSizeIndicator size={10737418240} variant="compact" />
      <VolumeSizeIndicator size={107374182400} variant="compact" />
    </div>
  ),
};

export const ColorSchemes: Story = {
  render: () => (
    <div className="space-y-6 w-96">
      <div>
        <h3 className="text-sm font-medium mb-2">Default Color</h3>
        <VolumeSizeIndicator
          size={5368709120}
          maxSize={10737418240}
          colorScheme="default"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Status Color</h3>
        <VolumeSizeIndicator
          size={8589934592}
          maxSize={10737418240}
          colorScheme="status"
        />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Gradient Color</h3>
        <VolumeSizeIndicator
          size={5368709120}
          maxSize={10737418240}
          colorScheme="gradient"
        />
      </div>
    </div>
  ),
};

export const WithoutLabel: Story = {
  args: {
    size: 5368709120,
    maxSize: 10737418240,
    showLabel: false,
  },
};

export const WithoutIcon: Story = {
  args: {
    size: 1073741824,
    showIcon: false,
  },
};

export const UnknownMaxSize: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Volumes without known maximum size:
      </p>
      <VolumeSizeIndicator size={1073741824} />
      <VolumeSizeIndicator size={5368709120} variant="compact" />
    </div>
  ),
};

export const ResponsiveGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <h4 className="text-sm font-medium mb-2">Volume {i + 1}</h4>
          <VolumeSizeIndicator
            size={Math.random() * 10737418240}
            maxSize={10737418240}
            colorScheme="status"
          />
        </div>
      ))}
    </div>
  ),
};

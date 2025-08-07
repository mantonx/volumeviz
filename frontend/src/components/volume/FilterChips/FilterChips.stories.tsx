import type { Meta, StoryObj } from '@storybook/react';
import { FilterChips, FilterChip } from './FilterChips';
import { useState } from 'react';

const meta = {
  title: 'Volume/FilterChips',
  component: FilterChips,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof FilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleChips: FilterChip[] = [
  { id: '1', type: 'driver', label: 'Driver', value: 'local' },
  { id: '2', type: 'driver', label: 'Driver', value: 'nfs' },
  { id: '3', type: 'size', label: 'Min Size', value: 1073741824 },
  { id: '4', type: 'size', label: 'Max Size', value: 10737418240 },
  { id: '5', type: 'status', label: 'Status', value: 'mounted' },
];

export const Default: Story = {
  args: {
    chips: sampleChips.slice(0, 3),
    onRemove: (chipId) => console.log('Remove chip:', chipId),
  },
};

export const WithClearAll: Story = {
  args: {
    chips: sampleChips,
    onRemove: (chipId) => console.log('Remove chip:', chipId),
    onClearAll: () => console.log('Clear all chips'),
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-2">Small</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          size="sm"
          onRemove={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Medium</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          size="md"
          onRemove={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Large</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          size="lg"
          onRemove={() => {}}
        />
      </div>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-2">Default</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          variant="default"
          onRemove={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Outlined</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          variant="outlined"
          onRemove={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Solid</p>
        <FilterChips
          chips={sampleChips.slice(0, 3)}
          variant="solid"
          onRemove={() => {}}
        />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [chips, setChips] = useState<FilterChip[]>(sampleChips);

    const handleRemove = (chipId: string) => {
      setChips(chips.filter((chip) => chip.id !== chipId));
    };

    const handleClearAll = () => {
      setChips([]);
    };

    const handleReset = () => {
      setChips(sampleChips);
    };

    return (
      <div className="space-y-4 w-full max-w-2xl">
        <FilterChips
          chips={chips}
          onRemove={handleRemove}
          onClearAll={handleClearAll}
        />
        {chips.length === 0 && (
          <p className="text-gray-500 text-center py-4">No active filters</p>
        )}
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reset Filters
        </button>
      </div>
    );
  },
};

export const EmptyState: Story = {
  args: {
    chips: [],
    onRemove: () => {},
  },
};

export const SingleChip: Story = {
  args: {
    chips: [sampleChips[0]],
    onRemove: () => {},
    onClearAll: () => {}, // Won't show clear all for single chip
  },
};

export const ManyChips: Story = {
  args: {
    chips: [
      ...sampleChips,
      { id: '6', type: 'custom', label: 'Created', value: 'Last 7 days' },
      { id: '7', type: 'custom', label: 'Modified', value: 'Last 24 hours' },
      { id: '8', type: 'driver', label: 'Driver', value: 'cifs' },
      { id: '9', type: 'status', label: 'Status', value: 'unmounted' },
    ],
    onRemove: () => {},
    onClearAll: () => {},
  },
};

export const InFilterBar: Story = {
  render: () => (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Active Filters</h3>
        <span className="text-sm text-gray-600">3 filters applied</span>
      </div>
      <FilterChips
        chips={sampleChips.slice(0, 3)}
        onRemove={() => {}}
        onClearAll={() => {}}
      />
    </div>
  ),
};

export const CustomTypeExamples: Story = {
  args: {
    chips: [
      { id: '1', type: 'custom', label: 'Label', value: 'app=postgres' },
      { id: '2', type: 'custom', label: 'Container', value: 'web-server' },
      { id: '3', type: 'custom', label: 'Network', value: 'bridge' },
      { id: '4', type: 'custom', label: 'Scan Status', value: 'completed' },
    ],
    onRemove: () => {},
  },
};

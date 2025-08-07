import type { Meta, StoryObj } from '@storybook/react';
import { VolumeSearch, VolumeSearchFilters } from './VolumeSearch';
import { useState } from 'react';

const meta = {
  title: 'Volume/VolumeSearch',
  component: VolumeSearch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof VolumeSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    filters: {
      query: '',
      drivers: [],
    },
    onFiltersChange: () => {},
  },
};

export const WithQuery: Story = {
  args: {
    filters: {
      query: 'postgres',
      drivers: [],
    },
    onFiltersChange: () => {},
  },
};

export const WithAdvancedFilters: Story = {
  args: {
    filters: {
      query: '',
      drivers: [],
    },
    onFiltersChange: () => {},
    showAdvanced: true,
  },
};

export const WithActiveFilters: Story = {
  args: {
    filters: {
      query: 'data',
      drivers: ['local', 'nfs'],
      minSize: 1048576, // 1MB
      maxSize: 10737418240, // 10GB
      mounted: true,
    },
    onFiltersChange: () => {},
    showAdvanced: true,
    totalVolumes: 50,
    filteredVolumes: 12,
  },
};

export const Interactive: Story = {
  render: () => {
    const [filters, setFilters] = useState<VolumeSearchFilters>({
      query: '',
      drivers: [],
    });
    const [showAdvanced, setShowAdvanced] = useState(true);

    // Simulate filtering
    const totalVolumes = 100;
    const filteredVolumes =
      filters.query ||
      filters.drivers.length > 0 ||
      filters.minSize ||
      filters.maxSize ||
      filters.mounted ||
      filters.unmounted
        ? Math.floor(Math.random() * 50) + 10
        : totalVolumes;

    return (
      <div className="w-full max-w-4xl space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Interactive Demo</h3>
          <p className="text-sm mb-4">
            Try searching and applying filters to see how the component works.
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show advanced filters</span>
          </label>
        </div>

        <VolumeSearch
          filters={filters}
          onFiltersChange={setFilters}
          showAdvanced={showAdvanced}
          totalVolumes={totalVolumes}
          filteredVolumes={filteredVolumes}
        />

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h4 className="font-semibold mb-2">Current Filters:</h4>
          <pre className="text-sm">{JSON.stringify(filters, null, 2)}</pre>
        </div>
      </div>
    );
  },
};

export const CustomPlaceholder: Story = {
  args: {
    filters: {
      query: '',
      drivers: [],
    },
    onFiltersChange: () => {},
    placeholder: 'Type to search Docker volumes...',
  },
};

export const CompactView: Story = {
  render: () => {
    const [filters, setFilters] = useState<VolumeSearchFilters>({
      query: '',
      drivers: [],
    });

    return (
      <div className="w-96">
        <VolumeSearch
          filters={filters}
          onFiltersChange={setFilters}
          showAdvanced={false}
          totalVolumes={25}
          filteredVolumes={25}
        />
      </div>
    );
  },
};

export const DarkMode: Story = {
  render: () => {
    const [filters, setFilters] = useState<VolumeSearchFilters>({
      query: '',
      drivers: [],
    });

    return (
      <div className="dark bg-gray-900 p-8 rounded-lg">
        <VolumeSearch
          filters={filters}
          onFiltersChange={setFilters}
          showAdvanced={true}
          totalVolumes={50}
          filteredVolumes={32}
        />
      </div>
    );
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

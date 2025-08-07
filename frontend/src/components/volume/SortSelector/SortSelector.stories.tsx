import type { Meta, StoryObj } from '@storybook/react';
import { SortSelector, SortOption } from './SortSelector';
import { useState } from 'react';

const meta = {
  title: 'Volume/SortSelector',
  component: SortSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SortSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const volumeSortOptions: SortOption[] = [
  { id: 'name', label: 'Name', field: 'name' },
  { id: 'size', label: 'Size', field: 'size' },
  { id: 'created', label: 'Date Created', field: 'created_at' },
  { id: 'driver', label: 'Driver', field: 'driver' },
  { id: 'mounts', label: 'Mount Count', field: 'mount_count' },
];

export const Default: Story = {
  args: {
    options: volumeSortOptions,
    value: 'name',
    order: 'asc',
    onChange: (sortBy, order) => console.log('Sort:', sortBy, order),
  },
};

export const InlineVariant: Story = {
  args: {
    options: volumeSortOptions.slice(0, 3),
    value: 'size',
    order: 'desc',
    variant: 'inline',
    onChange: (sortBy, order) => console.log('Sort:', sortBy, order),
  },
};

export const ButtonVariant: Story = {
  args: {
    options: volumeSortOptions,
    value: 'created',
    order: 'desc',
    variant: 'button',
    onChange: (sortBy, order) => console.log('Sort:', sortBy, order),
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-gray-600 mb-2">Small</p>
        <SortSelector
          options={volumeSortOptions}
          value="name"
          order="asc"
          size="sm"
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Medium</p>
        <SortSelector
          options={volumeSortOptions}
          value="name"
          order="asc"
          size="md"
          onChange={() => {}}
        />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Large</p>
        <SortSelector
          options={volumeSortOptions}
          value="name"
          order="asc"
          size="lg"
          onChange={() => {}}
        />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [sortBy, setSortBy] = useState('name');
    const [order, setOrder] = useState<'asc' | 'desc'>('asc');

    const handleChange = (newSortBy: string, newOrder: 'asc' | 'desc') => {
      setSortBy(newSortBy);
      setOrder(newOrder);
    };

    return (
      <div className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Interactive Demo</h3>
          <p className="text-sm">
            Current sort: <strong>{sortBy}</strong> ({order})
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Dropdown</p>
            <SortSelector
              options={volumeSortOptions}
              value={sortBy}
              order={order}
              onChange={handleChange}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Inline</p>
            <SortSelector
              options={volumeSortOptions.slice(0, 3)}
              value={sortBy}
              order={order}
              variant="inline"
              onChange={handleChange}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Button</p>
            <SortSelector
              options={volumeSortOptions}
              value={sortBy}
              order={order}
              variant="button"
              onChange={handleChange}
            />
          </div>
        </div>
      </div>
    );
  },
};

export const WithoutOrderToggle: Story = {
  args: {
    options: volumeSortOptions,
    value: 'name',
    order: 'asc',
    showOrderToggle: false,
    onChange: (sortBy, order) => console.log('Sort:', sortBy, order),
  },
};

export const InTableHeader: Story = {
  render: () => (
    <div className="w-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Volume List</h3>
        <SortSelector
          options={volumeSortOptions}
          value="name"
          order="asc"
          size="sm"
          onChange={() => {}}
        />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Size</th>
            <th className="text-left p-3">Created</th>
            <th className="text-left p-3">Driver</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3">postgres-data</td>
            <td className="p-3">5.2 GB</td>
            <td className="p-3">2 days ago</td>
            <td className="p-3">local</td>
          </tr>
        </tbody>
      </table>
    </div>
  ),
};

export const InlineInToolbar: Story = {
  render: () => (
    <div className="p-4 bg-white border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">Volumes</h3>
          <span className="text-sm text-gray-500">156 items</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort:</span>
          <SortSelector
            options={volumeSortOptions.slice(0, 4)}
            value="size"
            order="desc"
            variant="inline"
            size="sm"
            onChange={() => {}}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="p-3 border rounded hover:bg-gray-50">
          <strong>postgres-data</strong> - 5.2 GB
        </div>
        <div className="p-3 border rounded hover:bg-gray-50">
          <strong>redis-data</strong> - 256 MB
        </div>
        <div className="p-3 border rounded hover:bg-gray-50">
          <strong>app-logs</strong> - 128 MB
        </div>
      </div>
    </div>
  ),
};

export const CustomSortOptions: Story = {
  args: {
    options: [
      { id: 'usage', label: 'Disk Usage', field: 'usage_percentage' },
      {
        id: 'last_accessed',
        label: 'Last Accessed',
        field: 'last_accessed_at',
      },
      { id: 'file_count', label: 'File Count', field: 'file_count' },
      { id: 'permissions', label: 'Permissions', field: 'permissions' },
    ],
    value: 'usage',
    order: 'desc',
    onChange: (sortBy, order) => console.log('Custom sort:', sortBy, order),
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import { ViewToggle, ViewType } from './ViewToggle';
import { useState } from 'react';

const meta = {
  title: 'Volume/ViewToggle',
  component: ViewToggle,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ViewToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'cards',
    onChange: (view) => console.log('View changed to:', view),
  },
};

export const ButtonsVariant: Story = {
  args: {
    value: 'list',
    variant: 'buttons',
    onChange: (view) => console.log('View changed to:', view),
  },
};

export const DropdownVariant: Story = {
  args: {
    value: 'table',
    variant: 'dropdown',
    onChange: (view) => console.log('View changed to:', view),
  },
};

export const WithLabels: Story = {
  args: {
    value: 'cards',
    showLabels: true,
    onChange: (view) => console.log('View changed to:', view),
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-600 mb-2">Small</p>
        <ViewToggle value="cards" size="sm" onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Medium</p>
        <ViewToggle value="list" size="md" onChange={() => {}} />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Large</p>
        <ViewToggle value="table" size="lg" onChange={() => {}} />
      </div>
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="font-medium mb-3">Segmented (Default)</h3>
        <ViewToggle value="cards" variant="segmented" onChange={() => {}} />
      </div>

      <div>
        <h3 className="font-medium mb-3">Buttons</h3>
        <ViewToggle value="list" variant="buttons" onChange={() => {}} />
      </div>

      <div>
        <h3 className="font-medium mb-3">Dropdown</h3>
        <ViewToggle value="table" variant="dropdown" onChange={() => {}} />
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  render: () => {
    const [view, setView] = useState<ViewType>('cards');

    return (
      <div className="space-y-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold mb-2">Interactive Demo</h3>
          <p className="text-sm">
            Current view: <strong>{view}</strong>
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Segmented</p>
            <ViewToggle value={view} onChange={setView} />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Buttons with Labels</p>
            <ViewToggle
              value={view}
              variant="buttons"
              showLabels
              onChange={setView}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Dropdown</p>
            <ViewToggle value={view} variant="dropdown" onChange={setView} />
          </div>
        </div>

        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium mb-2">Mock Volume Display</h4>
          {view === 'cards' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded">Volume Card 1</div>
              <div className="p-4 border rounded">Volume Card 2</div>
            </div>
          )}
          {view === 'list' && (
            <div className="space-y-2">
              <div className="p-2 border rounded">Volume Item 1</div>
              <div className="p-2 border rounded">Volume Item 2</div>
            </div>
          )}
          {view === 'table' && (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Size</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2">Volume 1</td>
                  <td className="p-2">1GB</td>
                </tr>
                <tr>
                  <td className="p-2">Volume 2</td>
                  <td className="p-2">2GB</td>
                </tr>
              </tbody>
            </table>
          )}
          {view === 'grid' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square border rounded p-2 text-xs">
                Vol 1
              </div>
              <div className="aspect-square border rounded p-2 text-xs">
                Vol 2
              </div>
              <div className="aspect-square border rounded p-2 text-xs">
                Vol 3
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
};

export const InToolbar: Story = {
  render: () => (
    <div className="p-4 bg-white border rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Docker Volumes</h3>
          <p className="text-sm text-gray-600">156 volumes found</p>
        </div>

        <div className="flex items-center gap-4">
          <ViewToggle value="cards" onChange={() => {}} />

          <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded hover:bg-gray-50">
          <strong>postgres-data</strong>
          <br />
          <span className="text-sm text-gray-600">5.2 GB • local</span>
        </div>
        <div className="p-4 border rounded hover:bg-gray-50">
          <strong>redis-cache</strong>
          <br />
          <span className="text-sm text-gray-600">256 MB • local</span>
        </div>
      </div>
    </div>
  ),
};

export const CustomOptions: Story = {
  args: {
    value: 'custom1',
    options: [
      {
        id: 'custom1',
        label: 'Thumbnails',
        icon: <div className="w-4 h-4 bg-blue-500 rounded" />,
      },
      {
        id: 'custom2',
        label: 'Details',
        icon: <div className="w-4 h-4 bg-green-500 rounded" />,
      },
      {
        id: 'custom3',
        label: 'Compact',
        icon: <div className="w-4 h-4 bg-red-500 rounded" />,
      },
    ],
    onChange: (view) => console.log('Custom view:', view),
  },
};

export const TwoOptions: Story = {
  args: {
    value: 'list',
    options: [
      { id: 'list', label: 'List', icon: <div className="w-4 h-4 border" /> },
      {
        id: 'grid',
        label: 'Grid',
        icon: <div className="w-4 h-4 border border-dashed" />,
      },
    ],
    onChange: (view) => console.log('View:', view),
  },
};

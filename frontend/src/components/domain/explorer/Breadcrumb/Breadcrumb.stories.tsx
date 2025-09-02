import type { Meta, StoryObj } from '@storybook/react'
import { Breadcrumb } from './Breadcrumb'
import type { BreadcrumbItem } from '@/atoms/explorer'

const meta = {
  title: 'Domain/Explorer/Breadcrumb',
  component: Breadcrumb,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    maxVisibleItems: {
      control: { type: 'range', min: 2, max: 10, step: 1 },
    },
  },
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

const shortPath: BreadcrumbItem[] = [
  { name: 'Root', path: '/', isClickable: true },
  { name: 'Documents', path: '/documents', isClickable: true },
  { name: 'Projects', path: '/documents/projects', isClickable: true },
]

const longPath: BreadcrumbItem[] = [
  { name: 'Root', path: '/', isClickable: true },
  { name: 'Users', path: '/users', isClickable: true },
  { name: 'john', path: '/users/john', isClickable: true },
  { name: 'Documents', path: '/users/john/documents', isClickable: true },
  { name: 'Work', path: '/users/john/documents/work', isClickable: true },
  { name: 'Projects', path: '/users/john/documents/work/projects', isClickable: true },
  { name: 'VolumeViz', path: '/users/john/documents/work/projects/volumeviz', isClickable: true },
  { name: 'Frontend', path: '/users/john/documents/work/projects/volumeviz/frontend', isClickable: true },
  { name: 'src', path: '/users/john/documents/work/projects/volumeviz/frontend/src', isClickable: true },
  { name: 'components', path: '/users/john/documents/work/projects/volumeviz/frontend/src/components', isClickable: false },
]

const veryLongPath: BreadcrumbItem[] = [
  { name: 'Root', path: '/', isClickable: true },
  { name: 'very-long-folder-name-that-exceeds-normal-lengths', path: '/very-long-folder-name-that-exceeds-normal-lengths', isClickable: true },
  { name: 'another-extremely-long-folder-name', path: '/very-long-folder-name-that-exceeds-normal-lengths/another-extremely-long-folder-name', isClickable: true },
  { name: 'deeply-nested-subfolder-with-long-name', path: '/very-long-folder-name-that-exceeds-normal-lengths/another-extremely-long-folder-name/deeply-nested-subfolder-with-long-name', isClickable: true },
  { name: 'final-destination-folder', path: '/very-long-folder-name-that-exceeds-normal-lengths/another-extremely-long-folder-name/deeply-nested-subfolder-with-long-name/final-destination-folder', isClickable: false },
]

export const Default: Story = {
  args: {
    items: shortPath,
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const LongPath: Story = {
  args: {
    items: longPath,
    onItemClick: (path) => console.log('Clicked path:', path),
    maxVisibleItems: 5,
  },
}

export const VeryLongPath: Story = {
  args: {
    items: veryLongPath,
    onItemClick: (path) => console.log('Clicked path:', path),
    maxVisibleItems: 4,
  },
}

export const SingleItem: Story = {
  args: {
    items: [{ name: 'Root', path: '/', isClickable: true }],
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const TwoItems: Story = {
  args: {
    items: shortPath.slice(0, 2),
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const MaxItems: Story = {
  args: {
    items: longPath,
    onItemClick: (path) => console.log('Clicked path:', path),
    maxVisibleItems: 10,
  },
}

export const MinimalOverflow: Story = {
  args: {
    items: longPath.slice(0, 4),
    onItemClick: (path) => console.log('Clicked path:', path),
    maxVisibleItems: 3,
  },
}

export const NonClickableItems: Story = {
  args: {
    items: shortPath.map((item, index) => ({
      ...item,
      isClickable: index !== shortPath.length - 1, // Last item is not clickable
    })),
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const MixedClickability: Story = {
  args: {
    items: [
      { name: 'Root', path: '/', isClickable: true },
      { name: 'Protected', path: '/protected', isClickable: false },
      { name: 'System', path: '/protected/system', isClickable: false },
      { name: 'Logs', path: '/protected/system/logs', isClickable: true },
      { name: 'Current', path: '/protected/system/logs/current', isClickable: false },
    ],
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const EmptyPath: Story = {
  args: {
    items: [],
    onItemClick: (path) => console.log('Clicked path:', path),
  },
}

export const ConstrainedWidth: Story = {
  args: {
    items: longPath,
    onItemClick: (path) => console.log('Clicked path:', path),
    maxVisibleItems: 5,
    className: 'max-w-md',
  },
  decorators: [
    (Story) => (
      <div className="w-80 p-4 border border-border rounded-lg">
        <div className="mb-2 text-sm font-medium">Constrained to 320px width:</div>
        <Story />
      </div>
    ),
  ],
}

export const InteractiveDemo: Story = {
  args: {
    items: longPath,
    onItemClick: (path) => {
      // Simulate navigation by updating the breadcrumb
      const clickedIndex = longPath.findIndex(item => item.path === path);
      if (clickedIndex !== -1) {
        console.log('Navigating to:', path);
        // In a real app, this would trigger navigation
      }
    },
    maxVisibleItems: 5,
  },
  decorators: [
    (Story) => (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Click on any breadcrumb item to simulate navigation
        </div>
        <Story />
        <div className="text-xs text-muted-foreground">
          Check the console to see navigation events
        </div>
      </div>
    ),
  ],
}
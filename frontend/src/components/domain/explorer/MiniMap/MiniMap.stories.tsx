import type { Meta, StoryObj } from '@storybook/react';
import { MiniMap, MiniMapItem, MiniMapViewport } from './MiniMap';

const meta = {
  title: 'Domain/Explorer/MiniMap',
  component: MiniMap,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    width: {
      control: { type: 'range', min: 150, max: 400, step: 25 },
    },
    height: {
      control: { type: 'range', min: 100, max: 300, step: 25 },
    },
    showLabels: {
      control: { type: 'boolean' },
    },
    showViewport: {
      control: { type: 'boolean' },
    },
    enablePan: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof MiniMap>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data for mini-map
const sampleItems: MiniMapItem[] = [
  {
    id: '1',
    name: 'Documents',
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    type: 'directory',
    size: 1024000,
    color: 'hsl(220, 70%, 60%)',
    isVisible: true,
  },
  {
    id: '2',
    name: 'Media',
    x: 220,
    y: 0,
    width: 300,
    height: 200,
    type: 'directory',
    size: 5120000,
    color: 'hsl(280, 70%, 60%)',
    isVisible: true,
  },
  {
    id: '3',
    name: 'Projects',
    x: 0,
    y: 170,
    width: 250,
    height: 180,
    type: 'directory',
    size: 2048000,
    color: 'hsl(130, 70%, 60%)',
    isVisible: true,
  },
  {
    id: '4',
    name: 'Archive',
    x: 270,
    y: 220,
    width: 150,
    height: 100,
    type: 'directory',
    size: 512000,
    color: 'hsl(30, 70%, 60%)',
    isVisible: true,
  },
  {
    id: '5',
    name: 'Temp',
    x: 440,
    y: 50,
    width: 80,
    height: 60,
    type: 'directory',
    size: 128000,
    color: 'hsl(0, 50%, 60%)',
    isVisible: true,
  },
  {
    id: '6',
    name: 'Config',
    x: 540,
    y: 0,
    width: 100,
    height: 80,
    type: 'directory',
    size: 64000,
    color: 'hsl(200, 70%, 60%)',
    isVisible: true,
  },
  {
    id: '7',
    name: 'Large File',
    x: 300,
    y: 340,
    width: 200,
    height: 30,
    type: 'file',
    size: 10240000,
    color: 'hsl(10, 70%, 60%)',
    isVisible: true,
  },
];

const contentBounds = {
  x: -50,
  y: -50,
  width: 750,
  height: 470,
};

const defaultViewport: MiniMapViewport = {
  x: 100,
  y: 50,
  width: 300,
  height: 200,
  scale: 1,
};

const zoomedInViewport: MiniMapViewport = {
  x: 200,
  y: 100,
  width: 150,
  height: 100,
  scale: 2,
};

const zoomedOutViewport: MiniMapViewport = {
  x: -25,
  y: -25,
  width: 600,
  height: 400,
  scale: 0.5,
};

export const Default: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: false,
    showViewport: true,
    enablePan: true,
  },
};

export const WithLabels: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 250,
    height: 180,
    showLabels: true,
    showViewport: true,
    enablePan: true,
  },
};

export const ZoomedIn: Story = {
  args: {
    items: sampleItems,
    viewport: zoomedInViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: true,
    showViewport: true,
    enablePan: true,
  },
};

export const ZoomedOut: Story = {
  args: {
    items: sampleItems,
    viewport: zoomedOutViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: false,
    showViewport: true,
    enablePan: true,
  },
};

export const LargeSize: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 350,
    height: 250,
    showLabels: true,
    showViewport: true,
    enablePan: true,
  },
};

export const SmallSize: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 150,
    height: 100,
    showLabels: false,
    showViewport: true,
    enablePan: true,
  },
};

export const NoViewportIndicator: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: false,
    showViewport: false,
    enablePan: false,
  },
};

export const DisabledInteraction: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: true,
    showViewport: true,
    enablePan: false,
  },
};

export const Interactive: Story = {
  args: {
    items: sampleItems,
    viewport: defaultViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: false,
    showViewport: true,
    enablePan: true,
    onViewportChange: (viewport) => console.log('Viewport changed:', viewport),
    onItemClick: (item) => console.log('Item clicked:', item.name),
  },
};

export const ManyItems: Story = {
  args: {
    items: [
      ...sampleItems,
      // Add more items for a crowded mini-map
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `extra-${i}`,
        name: `Item ${i}`,
        x: Math.random() * 600,
        y: Math.random() * 400,
        width: 20 + Math.random() * 80,
        height: 20 + Math.random() * 60,
        type:
          Math.random() > 0.5 ? 'directory' : ('file' as 'directory' | 'file'),
        size: Math.random() * 1000000,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        isVisible: Math.random() > 0.2,
      })),
    ],
    viewport: defaultViewport,
    contentBounds,
    width: 250,
    height: 180,
    showLabels: false,
    showViewport: true,
    enablePan: true,
  },
};

export const EmptyMiniMap: Story = {
  args: {
    items: [],
    viewport: defaultViewport,
    contentBounds,
    width: 200,
    height: 150,
    showLabels: false,
    showViewport: true,
    enablePan: true,
  },
};

export const SingleItem: Story = {
  args: {
    items: [sampleItems[0]],
    viewport: {
      x: -25,
      y: -25,
      width: 250,
      height: 200,
      scale: 1,
    },
    contentBounds: {
      x: -50,
      y: -50,
      width: 300,
      height: 250,
    },
    width: 200,
    height: 150,
    showLabels: true,
    showViewport: true,
    enablePan: true,
  },
};

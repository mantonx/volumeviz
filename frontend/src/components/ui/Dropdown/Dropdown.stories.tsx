import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Dropdown } from './Dropdown';
import {
  Edit,
  Trash2,
  Settings,
  Download,
  User,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { action } from '@/utils/storybook-utils';

const meta: Meta<typeof Dropdown> = {
  title: 'Components/UI/Dropdown',
  component: Dropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A flexible dropdown menu component with customizable trigger and menu items.

## Features
- Customizable trigger element
- Left or right alignment
- Icon support for menu items
- Disabled items
- Destructive items (for delete actions)
- Click outside to close
- Keyboard accessible
- Dark/light theme support

## Usage
\`\`\`tsx
import { Dropdown } from '@/components/ui/Dropdown';
import { action } from '@/utils/storybook-utils';

const items = [
  { id: 'edit', label: 'Edit', icon: Edit, onClick: () => {} },
  { id: 'delete', label: 'Delete', icon: Trash2, onClick: () => {}, destructive: true }
];

<Dropdown items={items} />
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    items: {
      description: 'Array of dropdown menu items',
    },
    trigger: {
      description: 'Custom trigger element (defaults to more horizontal icon)',
    },
    align: {
      control: { type: 'select' },
      options: ['left', 'right'],
      description: 'Alignment of the dropdown menu',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const defaultItems = [
  { id: 'edit', label: 'Edit', icon: Edit, onClick: action('edit-clicked') },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    onClick: action('settings-clicked'),
  },
  {
    id: 'download',
    label: 'Download',
    icon: Download,
    onClick: action('download-clicked'),
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    onClick: action('delete-clicked'),
    destructive: true,
  },
];

export const Default: Story = {
  args: {
    items: defaultItems,
  },
};

export const LeftAligned: Story = {
  args: {
    items: defaultItems,
    align: 'left',
  },
  parameters: {
    docs: {
      description: {
        story: 'Dropdown menu aligned to the left of the trigger.',
      },
    },
  },
};

export const CustomTrigger: Story = {
  args: {
    items: defaultItems,
    trigger: (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg">
        Actions <ChevronDown className="w-4 h-4" />
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dropdown with a custom trigger element instead of the default icon.',
      },
    },
  },
};

export const WithDisabledItems: Story = {
  args: {
    items: [
      {
        id: 'edit',
        label: 'Edit',
        icon: Edit,
        onClick: action('edit-clicked'),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        onClick: action('settings-clicked'),
        disabled: true,
      },
      {
        id: 'download',
        label: 'Download',
        icon: Download,
        onClick: action('download-clicked'),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        onClick: action('delete-clicked'),
        destructive: true,
        disabled: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dropdown with some items disabled to show the disabled state styling.',
      },
    },
  },
};

export const UserMenu: Story = {
  args: {
    items: [
      {
        id: 'profile',
        label: 'Profile',
        icon: User,
        onClick: action('profile-clicked'),
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        onClick: action('settings-clicked'),
      },
      {
        id: 'logout',
        label: 'Sign Out',
        icon: LogOut,
        onClick: action('logout-clicked'),
        destructive: true,
      },
    ],
    trigger: (
      <div className="flex items-center gap-2 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          U
        </div>
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of a user menu dropdown with profile picture trigger.',
      },
    },
  },
};

export const FileActions: Story = {
  args: {
    items: [
      { id: 'open', label: 'Open', onClick: action('open-clicked') },
      {
        id: 'rename',
        label: 'Rename',
        icon: Edit,
        onClick: action('rename-clicked'),
      },
      {
        id: 'download',
        label: 'Download',
        icon: Download,
        onClick: action('download-clicked'),
      },
      {
        id: 'delete',
        label: 'Move to Trash',
        icon: Trash2,
        onClick: action('delete-clicked'),
        destructive: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of a file context menu with typical file operations.',
      },
    },
  },
};

export const WithoutIcons: Story = {
  args: {
    items: [
      { id: 'option1', label: 'Option 1', onClick: action('option1-clicked') },
      { id: 'option2', label: 'Option 2', onClick: action('option2-clicked') },
      { id: 'option3', label: 'Option 3', onClick: action('option3-clicked') },
      {
        id: 'danger',
        label: 'Dangerous Action',
        onClick: action('danger-clicked'),
        destructive: true,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'Simple dropdown menu without icons, showing text-only items.',
      },
    },
  },
};

export const AlignmentComparison: Story = {
  render: () => (
    <div className="flex gap-8 items-center">
      <div>
        <p className="text-sm text-gray-600 mb-2">Left Aligned</p>
        <Dropdown items={defaultItems} align="left" />
      </div>
      <div>
        <p className="text-sm text-gray-600 mb-2">Right Aligned</p>
        <Dropdown items={defaultItems} align="right" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of left and right aligned dropdown menus.',
      },
    },
    layout: 'centered',
  },
};

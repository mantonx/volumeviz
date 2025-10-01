import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import {
  HardDrive,
  Search,
  Users,
  Mail,
  FileX,
  Folder,
  Database,
} from 'lucide-react';
import { action } from '@/utils/storybook-utils';
const meta: Meta<typeof EmptyState> = {
  title: 'Components/UI/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A component for displaying empty states with an icon, title, description, and optional action button.

## Features
- Customizable icon
- Title and description text
- Optional action button
- Custom children content
- Card-based design
- Dark/light theme support
- Responsive layout

## Usage
\`\`\`tsx
import { EmptyState } from '@/components/ui/EmptyState';
import { Search } from 'lucide-react';
import { action } from '@/utils/storybook-utils';

<EmptyState
  icon={Search}
  title="No results found"
  description="Try adjusting your search criteria"
  actionLabel="Clear filters"
  onAction={clearFilters}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      description: 'Icon component to display',
    },
    title: {
      control: { type: 'text' },
      description: 'Main title text',
    },
    description: {
      control: { type: 'text' },
      description: 'Description text below the title',
    },
    actionLabel: {
      control: { type: 'text' },
      description: 'Label for the action button',
    },
    onAction: {
      action: 'action-clicked',
      description: 'Callback for action button click',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
  args: {
    onAction: action('action-clicked'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No volumes found',
    description: 'There are no volumes to display at the moment.',
    actionLabel: 'Add Volume',
  },
};

export const SearchResults: Story = {
  args: {
    icon: Search,
    title: 'No results found',
    description:
      "We couldn't find anything matching your search. Try different keywords or clear your filters.",
    actionLabel: 'Clear filters',
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state for when search results are empty.',
      },
    },
  },
};

export const UsersList: Story = {
  args: {
    icon: Users,
    title: 'No team members yet',
    description: 'Invite team members to collaborate on your projects.',
    actionLabel: 'Invite members',
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state for a users or team members list.',
      },
    },
  },
};

export const Inbox: Story = {
  args: {
    icon: Mail,
    title: 'All caught up!',
    description:
      'You have no new messages. Great work staying on top of your inbox.',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty state for an inbox or messages list with positive messaging.',
      },
    },
  },
};

export const FileList: Story = {
  args: {
    icon: FileX,
    title: 'No files found',
    description: 'This folder is empty. Upload files to get started.',
    actionLabel: 'Upload files',
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty state for a file listing or folder view.',
      },
    },
  },
};

export const WithoutAction: Story = {
  args: {
    icon: Database,
    title: 'No data available',
    description:
      'The system is currently processing data. Please check back later.',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty state without an action button for situations where no action is needed.',
      },
    },
  },
};

export const WithCustomContent: Story = {
  args: {
    icon: Folder,
    title: 'Get started with your first project',
    description:
      'Projects help you organize your work and collaborate with your team.',
    children: (
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center justify-center gap-2">
          <span>•</span>
          <span>Create folders and organize files</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span>•</span>
          <span>Invite team members to collaborate</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span>•</span>
          <span>Track progress and deadlines</span>
        </div>
      </div>
    ),
    actionLabel: 'Create project',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Empty state with custom content between description and action button.',
      },
    },
  },
};

export const Variations: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <EmptyState
        icon={Search}
        title="No results"
        description="Try a different search term"
        actionLabel="Reset"
      />
      <EmptyState
        icon={Users}
        title="No team members"
        description="Invite your first team member"
        actionLabel="Invite"
      />
      <EmptyState
        icon={HardDrive}
        title="No volumes"
        description="Add your first volume to get started"
        actionLabel="Add Volume"
      />
      <EmptyState
        icon={Mail}
        title="All caught up!"
        description="No new notifications"
      />
      <EmptyState
        icon={FileX}
        title="No files"
        description="This directory is empty"
        actionLabel="Upload"
      />
      <EmptyState
        icon={Database}
        title="No data"
        description="Data will appear here when available"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Various empty state designs showing different use cases and messaging.',
      },
    },
    layout: 'padded',
  },
};

export const Compact: Story = {
  args: {
    icon: Search,
    title: 'No results',
    description: 'Try adjusting your filters',
    actionLabel: 'Clear all',
    className: 'p-4 max-w-xs',
  },
  parameters: {
    docs: {
      description: {
        story: 'Smaller, more compact version of the empty state.',
      },
    },
  },
};

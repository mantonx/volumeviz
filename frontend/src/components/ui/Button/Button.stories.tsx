import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Button } from './Button';
import { Play, Download, Heart } from 'lucide-react';

/**
 * Button component stories and documentation.
 */
const meta: Meta<typeof Button> = {
  title: 'Components/UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A flexible button component with multiple variants, sizes, and states.

## Features
- Multiple visual variants (primary, secondary, outline, ghost, destructive)
- Three sizes (sm, md, lg)
- Loading state with spinner
- Left and right icon support
- Full accessibility support
- TypeScript support with strict typing

## Usage
\`\`\`tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'destructive'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size of the button',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Whether the button is in a loading state',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the button is disabled',
    },
    children: {
      control: { type: 'text' },
      description: 'Button content',
    },
    onClick: {
      action: 'clicked',
      description: 'Click event handler',
    },
  },
  args: {
    onClick: action('clicked'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default button with primary variant and medium size
 */
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

/**
 * All button variants displayed in a grid
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available button variants showcasing different visual styles.',
      },
    },
  },
};

/**
 * All button sizes displayed in a row
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available button sizes from small to large.',
      },
    },
  },
};

/**
 * Button in loading state with spinner
 */
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Button in loading state shows a spinner and is automatically disabled.',
      },
    },
  },
};

/**
 * Disabled button state
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled button with reduced opacity and no interaction.',
      },
    },
  },
};

/**
 * Button with left icon
 */
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Play size={16} />,
    children: 'Play Video',
  },
  parameters: {
    docs: {
      description: {
        story: 'Button with an icon on the left side of the text.',
      },
    },
  },
};

/**
 * Button with right icon
 */
export const WithRightIcon: Story = {
  args: {
    rightIcon: <Download size={16} />,
    children: 'Download',
  },
  parameters: {
    docs: {
      description: {
        story: 'Button with an icon on the right side of the text.',
      },
    },
  },
};

/**
 * Button with both left and right icons
 */
export const WithBothIcons: Story = {
  args: {
    leftIcon: <Heart size={16} />,
    rightIcon: <Download size={16} />,
    children: 'Save',
  },
  parameters: {
    docs: {
      description: {
        story: 'Button with icons on both sides of the text.',
      },
    },
  },
};

/**
 * Icon-only button (no text)
 */
export const IconOnly: Story = {
  args: {
    leftIcon: <Heart size={16} />,
    'aria-label': 'Like',
  },
  parameters: {
    docs: {
      description: {
        story: 'Icon-only button without text. Remember to provide aria-label for accessibility.',
      },
    },
  },
};

/**
 * Loading button with icon (icon is hidden during loading)
 */
export const LoadingWithIcon: Story = {
  args: {
    loading: true,
    leftIcon: <Download size={16} />,
    children: 'Downloading...',
  },
  parameters: {
    docs: {
      description: {
        story: 'When loading, the left icon is hidden and replaced with a spinner.',
      },
    },
  },
};

/**
 * Interactive demo showing all states
 */
export const Interactive: Story = {
  args: {
    children: 'Interactive Button',
    variant: 'primary',
    size: 'md',
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive button where you can test all props and states.',
      },
    },
  },
};

/**
 * Button variants with different themes (light/dark)
 */
export const ThemeVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Light Theme</h3>
        <div className="flex gap-4 p-4 bg-white rounded-lg">
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">Dark Theme</h3>
        <div className="flex gap-4 p-4 bg-gray-900 rounded-lg">
          <Button variant="primary">Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Button appearance in light and dark themes.',
      },
    },
  },
};
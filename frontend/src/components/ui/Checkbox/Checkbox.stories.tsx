import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';
import { action } from '@/utils/storybook-utils';
const meta: Meta<typeof Checkbox> = {
  title: 'Components/UI/Checkbox',
  component: Checkbox,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A customizable checkbox component with support for checked, unchecked, and indeterminate states.

## Features
- Standard checked/unchecked states
- Indeterminate state for partial selections
- Disabled state
- Keyboard accessible
- Dark/light theme support
- Custom styling support

## Usage
\`\`\`tsx
import { Checkbox } from '@/components/ui/Checkbox';
import { action } from '@/utils/storybook-utils';

<Checkbox 
  checked={checked}
  onChange={setChecked}
  aria-label="Accept terms"
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is checked',
    },
    indeterminate: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is in indeterminate state',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the checkbox is disabled',
    },
    onChange: {
      action: 'changed',
      description: 'Callback fired when checkbox state changes',
    },
  },
  args: {
    onChange: action('changed'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    'aria-label': 'Default checkbox',
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    'aria-label': 'Checked checkbox',
  },
};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    'aria-label': 'Indeterminate checkbox',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Indeterminate state is useful for "select all" checkboxes when only some items are selected.',
      },
    },
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col items-center gap-2">
        <Checkbox disabled checked={false} aria-label="Disabled unchecked" />
        <span className="text-sm text-gray-500">Unchecked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox disabled checked={true} aria-label="Disabled checked" />
        <span className="text-sm text-gray-500">Checked</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox disabled indeterminate aria-label="Disabled indeterminate" />
        <span className="text-sm text-gray-500">Indeterminate</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Disabled checkboxes in all states.',
      },
    },
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold">Normal</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <Checkbox checked={false} aria-label="Unchecked normal" />
            <span>Unchecked</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={true} aria-label="Checked normal" />
            <span>Checked</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox indeterminate aria-label="Indeterminate normal" />
            <span>Indeterminate</span>
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold">Disabled</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <Checkbox
              disabled
              checked={false}
              aria-label="Unchecked disabled"
            />
            <span className="text-gray-500">Unchecked</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox disabled checked={true} aria-label="Checked disabled" />
            <span className="text-gray-500">Checked</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              disabled
              indeterminate
              aria-label="Indeterminate disabled"
            />
            <span className="text-gray-500">Indeterminate</span>
          </label>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All checkbox states in normal and disabled variants.',
      },
    },
  },
};

export const WithLabels: Story = {
  render: () => {
    const [checked, setChecked] = React.useState(false);

    return (
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            checked={checked}
            onChange={setChecked}
            aria-label="Accept terms and conditions"
          />
          <span>I accept the terms and conditions</span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={checked}
            onChange={setChecked}
            className="mt-1"
            aria-label="Subscribe to newsletter"
          />
          <div>
            <span className="font-medium">Subscribe to newsletter</span>
            <p className="text-sm text-gray-500 mt-1">
              Get the latest updates and news delivered to your inbox.
            </p>
          </div>
        </label>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Checkboxes with descriptive labels and proper click areas.',
      },
    },
  },
};

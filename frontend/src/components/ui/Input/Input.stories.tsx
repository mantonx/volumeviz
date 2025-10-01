import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@/utils/storybook-utils';

import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
A flexible input component that extends the standard HTML input element with consistent styling and error states.

## Features
- All standard HTML input types supported
- Error state styling
- Dark/light theme support
- Disabled state
- Focus ring for accessibility
- Proper forwarded ref support

## Usage
\`\`\`tsx
import { Input } from '@/components/ui/Input';
import { action } from '@/utils/storybook-utils';

<Input 
  placeholder="Enter your name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
      description: 'HTML input type',
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Whether the input is disabled',
    },
    error: {
      control: { type: 'boolean' },
      description: 'Whether the input has an error state',
    },
    onChange: {
      action: 'changed',
      description: 'Input change event handler',
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
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Sample text',
    placeholder: 'Enter text...',
  },
};

export const Error: Story = {
  args: {
    error: true,
    value: 'Invalid input',
    placeholder: 'Enter text...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Input with error styling, typically used with form validation.',
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Disabled input',
    placeholder: 'This is disabled',
  },
};

export const InputTypes: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <label className="block text-sm font-medium mb-1">Text</label>
        <Input type="text" placeholder="Enter text" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <Input type="email" placeholder="Enter email" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <Input type="password" placeholder="Enter password" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Number</label>
        <Input type="number" placeholder="Enter number" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Search</label>
        <Input type="search" placeholder="Search..." />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">URL</label>
        <Input type="url" placeholder="https://example.com" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tel</label>
        <Input type="tel" placeholder="+1 (555) 123-4567" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different HTML input types with appropriate placeholders.',
      },
    },
  },
};

export const FormValidation: Story = {
  render: () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [errors, setErrors] = React.useState<{
      email?: boolean;
      password?: boolean;
    }>({});

    const validateEmail = (email: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const validatePassword = (password: string) => {
      return password.length >= 8;
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      setErrors((prev) => ({
        ...prev,
        email: value ? !validateEmail(value) : false,
      }));
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      setErrors((prev) => ({
        ...prev,
        password: value ? !validatePassword(value) : false,
      }));
    };

    return (
      <div className="space-y-4 w-80">
        <div>
          <label className="block text-sm font-medium mb-1">
            Email {errors.email && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="user@example.com"
            error={errors.email}
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">
              Please enter a valid email address
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Password{' '}
            {errors.password && <span className="text-red-500">*</span>}
          </label>
          <Input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Minimum 8 characters"
            error={errors.password}
          />
          {errors.password && (
            <p className="text-sm text-red-500 mt-1">
              Password must be at least 8 characters long
            </p>
          )}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive form validation example showing error states and feedback.',
      },
    },
  },
};

export const CustomStyling: Story = {
  render: () => (
    <div className="space-y-4 w-80">
      <div>
        <label className="block text-sm font-medium mb-1">Small Input</label>
        <Input placeholder="Small input" className="h-8 text-xs" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Default Input</label>
        <Input placeholder="Default input" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Large Input</label>
        <Input placeholder="Large input" className="h-12 text-base" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Full Width</label>
        <Input placeholder="Full width input" className="w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Custom Border</label>
        <Input
          placeholder="Custom styling"
          className="border-2 border-blue-300 rounded-lg"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Examples of custom styling and different sizes using className prop.',
      },
    },
  },
};

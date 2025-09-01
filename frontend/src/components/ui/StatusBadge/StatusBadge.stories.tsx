import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useState, useRef } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import type { StatusBadgeProps, StatusBadgeRef } from './StatusBadge.types';

const meta: Meta<typeof StatusBadge> = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A flexible status badge component for displaying scan states, progress indicators,
and general status information. Supports multiple variants, animations, and
accessibility features for comprehensive status communication.

## Features
- Multiple visual variants (default, success, warning, error, info, pending)
- Size options from xs to lg
- Optional icons and animated dots
- Clickable badges with keyboard navigation
- Accessibility compliant with ARIA attributes
- Imperative API via ref for programmatic control
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'error', 'info', 'pending'],
      description: 'Visual variant determining the appearance',
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg'],
      description: 'Size of the badge',
    },
    children: {
      control: { type: 'text' },
      description: 'Badge content',
    },
    animated: {
      control: { type: 'boolean' },
      description: 'Whether to show animated pulse effect',
    },
    showDot: {
      control: { type: 'boolean' },
      description: 'Whether to show a dot indicator',
    },
    dotPosition: {
      control: { type: 'select' },
      options: ['left', 'right'],
      description: 'Dot position relative to content',
    },
    rounded: {
      control: { type: 'boolean' },
      description: 'Whether the badge should be rounded',
    },
    clickable: {
      control: { type: 'boolean' },
      description: 'Whether the badge is clickable',
    },
    className: {
      control: { type: 'text' },
      description: 'Custom CSS class name',
    },
    testId: {
      control: { type: 'text' },
      description: 'Test ID for testing',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default Status',
    variant: 'default',
    size: 'md',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Success',
    variant: 'success',
    size: 'md',
    icon: <CheckCircle />,
  },
};

export const WithDot: Story = {
  args: {
    children: 'Active',
    variant: 'info',
    size: 'md',
    showDot: true,
    animated: true,
  },
};

export const Clickable: Story = {
  args: {
    children: 'Click me',
    variant: 'info',
    size: 'md',
    clickable: true,
    showDot: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Default</h3>
        <StatusBadge variant="default">Default Status</StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Success</h3>
        <StatusBadge variant="success" icon={<CheckCircle />}>
          Completed
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Warning</h3>
        <StatusBadge variant="warning" icon={<AlertTriangle />}>
          Warning
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Error</h3>
        <StatusBadge variant="error" icon={<XCircle />}>
          Failed
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Info</h3>
        <StatusBadge variant="info" icon={<Activity />} animated>
          Running
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Pending</h3>
        <StatusBadge variant="pending" icon={<Clock />} animated showDot>
          Pending
        </StatusBadge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows all available variants with appropriate icons.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Extra Small</h3>
        <StatusBadge variant="info" size="xs" showDot>
          Active
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Small</h3>
        <StatusBadge variant="info" size="sm" showDot icon={<Activity />}>
          Running
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Medium</h3>
        <StatusBadge variant="info" size="md" showDot icon={<Activity />}>
          Processing
        </StatusBadge>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Large</h3>
        <StatusBadge variant="info" size="lg" showDot icon={<Activity />}>
          Scanning Volume
        </StatusBadge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows all available size options from xs to lg.',
      },
    },
  },
};

export const AnimatedStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Static</h3>
        <div className="flex gap-3">
          <StatusBadge variant="success" showDot>
            Completed
          </StatusBadge>
          <StatusBadge variant="error" showDot>
            Failed
          </StatusBadge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Animated</h3>
        <div className="flex gap-3">
          <StatusBadge variant="info" animated showDot icon={<Activity />}>
            Scanning
          </StatusBadge>
          <StatusBadge variant="pending" animated showDot icon={<Clock />}>
            Queued
          </StatusBadge>
          <StatusBadge variant="warning" animated showDot icon={<Zap />}>
            Processing
          </StatusBadge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison between static and animated badge states.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [status, setStatus] =
      useState<StatusBadgeProps['variant']>('pending');
    const [isAnimated, setIsAnimated] = useState(true);
    const badgeRef = useRef<StatusBadgeRef>(null);

    const statusConfigs = {
      pending: { label: 'Pending', icon: <Clock /> },
      info: { label: 'Running', icon: <Activity /> },
      success: { label: 'Completed', icon: <CheckCircle /> },
      error: { label: 'Failed', icon: <XCircle /> },
      warning: { label: 'Paused', icon: <Pause /> },
    };

    const currentConfig = statusConfigs[status || 'pending'];

    const simulateProgress = () => {
      setStatus('info');
      setIsAnimated(true);

      setTimeout(() => {
        const outcomes = ['success', 'error'] as const;
        const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
        setStatus(outcome);
        setIsAnimated(false);
      }, 3000);
    };

    const handleFocus = () => {
      badgeRef.current?.focus();
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interactive Status Badge
          </h3>
          <StatusBadge
            ref={badgeRef}
            variant={status}
            size="lg"
            animated={isAnimated}
            showDot
            icon={currentConfig.icon}
            clickable
            onClick={() => setStatus('pending')}
          >
            {currentConfig.label}
          </StatusBadge>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={simulateProgress}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            disabled={status === 'info'}
          >
            {status === 'info' ? 'Running...' : 'Start Scan'}
          </button>
          <button
            onClick={() => setStatus('pending')}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleFocus}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Focus Badge
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-gray-700">Set Status:</label>
          {Object.entries(statusConfigs).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setStatus(key as StatusBadgeProps['variant'])}
              className={`px-2 py-1 text-xs rounded ${
                status === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>

        <div className="text-sm text-gray-600">
          Click the badge to reset to pending state. Use keyboard (Tab +
          Enter/Space) for accessibility.
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example demonstrating status transitions and programmatic control.',
      },
    },
  },
};

export const ScanStatusExamples: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Scan Status Scenarios
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Active States</h4>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge variant="pending" animated showDot icon={<Clock />}>
                Queued
              </StatusBadge>
              <span className="text-sm text-gray-600">Waiting to start</span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="info" animated showDot icon={<Activity />}>
                Scanning
              </StatusBadge>
              <span className="text-sm text-gray-600">Actively processing</span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="info" animated showDot icon={<RotateCcw />}>
                Indexing
              </StatusBadge>
              <span className="text-sm text-gray-600">Building file index</span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="warning" showDot icon={<Pause />}>
                Paused
              </StatusBadge>
              <span className="text-sm text-gray-600">Temporarily stopped</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">
            Completed States
          </h4>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge variant="success" showDot icon={<CheckCircle />}>
                Completed
              </StatusBadge>
              <span className="text-sm text-gray-600">
                Finished successfully
              </span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="error" showDot icon={<XCircle />}>
                Failed
              </StatusBadge>
              <span className="text-sm text-gray-600">Encountered errors</span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="default" showDot>
                Cancelled
              </StatusBadge>
              <span className="text-sm text-gray-600">Stopped by user</span>
            </div>

            <div className="flex items-center gap-3">
              <StatusBadge variant="warning" showDot icon={<AlertTriangle />}>
                Partial
              </StatusBadge>
              <span className="text-sm text-gray-600">
                Completed with warnings
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6 mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Clickable Actions
        </h4>
        <div className="flex flex-wrap gap-3">
          <StatusBadge
            variant="error"
            clickable
            icon={<RotateCcw />}
            showDot
            onClick={() => alert('Retry scan')}
          >
            Retry
          </StatusBadge>
          <StatusBadge
            variant="warning"
            clickable
            icon={<Play />}
            showDot
            onClick={() => alert('Resume scan')}
          >
            Resume
          </StatusBadge>
          <StatusBadge
            variant="info"
            clickable
            icon={<Pause />}
            showDot
            onClick={() => alert('Pause scan')}
          >
            Pause
          </StatusBadge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples showing how the status badge would be used in scan monitoring scenarios.',
      },
    },
  },
};

export const DotPositions: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Left Dot (Default)
        </h3>
        <div className="flex gap-3">
          <StatusBadge variant="info" showDot dotPosition="left" size="sm">
            Active
          </StatusBadge>
          <StatusBadge variant="success" showDot dotPosition="left" size="md">
            Complete
          </StatusBadge>
          <StatusBadge variant="warning" showDot dotPosition="left" size="lg">
            Warning State
          </StatusBadge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Right Dot</h3>
        <div className="flex gap-3">
          <StatusBadge variant="info" showDot dotPosition="right" size="sm">
            Active
          </StatusBadge>
          <StatusBadge variant="success" showDot dotPosition="right" size="md">
            Complete
          </StatusBadge>
          <StatusBadge variant="warning" showDot dotPosition="right" size="lg">
            Warning State
          </StatusBadge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows dot positioning options for visual emphasis.',
      },
    },
  },
};

export const ShapeVariations: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Rounded (Default)
        </h3>
        <div className="flex gap-3">
          <StatusBadge variant="success" rounded showDot>
            Success
          </StatusBadge>
          <StatusBadge variant="info" rounded icon={<Activity />}>
            Processing
          </StatusBadge>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Square</h3>
        <div className="flex gap-3">
          <StatusBadge variant="success" rounded={false} showDot>
            Success
          </StatusBadge>
          <StatusBadge variant="info" rounded={false} icon={<Activity />}>
            Processing
          </StatusBadge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison between rounded and square badge shapes.',
      },
    },
  },
};

export const AccessibilityFeatures: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Accessibility Features
      </h3>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Screen Reader Friendly
          </h4>
          <div className="flex gap-3">
            <StatusBadge variant="info" showDot animated>
              Scan in progress
            </StatusBadge>
            <StatusBadge variant="success" icon={<CheckCircle />}>
              Scan completed successfully
            </StatusBadge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Try using a screen reader to hear the status announcements
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Keyboard Navigation
          </h4>
          <div className="flex gap-3">
            <StatusBadge
              variant="warning"
              clickable
              icon={<RotateCcw />}
              onClick={() => alert('Retry action triggered')}
            >
              Retry Scan
            </StatusBadge>
            <StatusBadge
              variant="info"
              clickable
              icon={<Pause />}
              onClick={() => alert('Pause action triggered')}
            >
              Pause
            </StatusBadge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tab to focus, then use Enter or Space to activate
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            High Contrast Support
          </h4>
          <div className="bg-black p-4 rounded">
            <div className="flex gap-3">
              <StatusBadge variant="success" showDot>
                Completed
              </StatusBadge>
              <StatusBadge variant="error" showDot>
                Failed
              </StatusBadge>
              <StatusBadge variant="warning" showDot animated>
                Processing
              </StatusBadge>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Examples showing accessibility features including ARIA attributes and keyboard navigation.',
      },
    },
  },
};

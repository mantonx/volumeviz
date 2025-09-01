import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useRef, useState } from 'react';
import { ProgressBar } from './ProgressBar';
import type { ProgressBarProps, ProgressBarRef } from './ProgressBar.types';

const meta: Meta<typeof ProgressBar> = {
  title: 'UI/ProgressBar',
  component: ProgressBar,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A flexible progress bar component with multiple variants, sizes, and animation options.
Supports both determinate and indeterminate states for various use cases including
scan progress monitoring, file operations, and general loading states.

## Features
- Multiple visual variants (default, success, warning, error, info)
- Size options from xs to xl
- Animated and striped patterns
- Indeterminate state for unknown progress
- Accessibility compliant with ARIA attributes
- Imperative API via ref for programmatic control
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
      description: 'Progress value between 0 and 100',
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'warning', 'error', 'info'],
      description: 'Visual variant of the progress bar',
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Size of the progress bar',
    },
    showLabel: {
      control: { type: 'boolean' },
      description: 'Whether to show the percentage label',
    },
    label: {
      control: { type: 'text' },
      description: 'Custom label text (overrides percentage)',
    },
    animated: {
      control: { type: 'boolean' },
      description: 'Whether to animate the progress',
    },
    striped: {
      control: { type: 'boolean' },
      description: 'Whether to show striped pattern',
    },
    indeterminate: {
      control: { type: 'boolean' },
      description: 'Whether to show indeterminate state',
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
    value: 50,
    variant: 'default',
    size: 'md',
    showLabel: true,
  },
};

export const WithCustomLabel: Story = {
  args: {
    value: 75,
    variant: 'info',
    size: 'md',
    showLabel: true,
    label: 'Loading files...',
  },
};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    variant: 'default',
    size: 'md',
    animated: true,
    showLabel: true,
    label: 'Processing...',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Default (50%)
        </h3>
        <ProgressBar value={50} variant="default" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Success (85%)
        </h3>
        <ProgressBar value={85} variant="success" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Warning (65%)
        </h3>
        <ProgressBar value={65} variant="warning" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Error (25%)</h3>
        <ProgressBar value={25} variant="error" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Info (90%)</h3>
        <ProgressBar value={90} variant="info" showLabel />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Shows all available visual variants with different progress values.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Extra Small</h3>
        <ProgressBar value={60} size="xs" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Small</h3>
        <ProgressBar value={60} size="sm" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Medium</h3>
        <ProgressBar value={60} size="md" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Large</h3>
        <ProgressBar value={60} size="lg" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Extra Large</h3>
        <ProgressBar value={60} size="xl" showLabel />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows all available size options from xs to xl.',
      },
    },
  },
};

export const AnimatedStriped: Story = {
  args: {
    value: 70,
    variant: 'info',
    size: 'lg',
    animated: true,
    striped: true,
    showLabel: true,
    label: 'Indexing files...',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Progress bar with animated striped pattern, commonly used for ongoing operations.',
      },
    },
  },
};

export const StripedOnly: Story = {
  args: {
    value: 45,
    variant: 'warning',
    size: 'md',
    striped: true,
    showLabel: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Progress bar with striped pattern but no animation.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(30);
    const [variant, setVariant] =
      useState<ProgressBarProps['variant']>('default');
    const progressRef = useRef<ProgressBarRef>(null);

    const handleAnimate = () => {
      if (progressRef.current) {
        const targetValue = Math.floor(Math.random() * 100);
        progressRef.current.animateTo(targetValue, 1000);
        setValue(targetValue);
      }
    };

    const handleReset = () => {
      setValue(0);
      if (progressRef.current) {
        progressRef.current.setValue(0);
      }
    };

    const handleComplete = () => {
      setValue(100);
      setVariant('success');
      if (progressRef.current) {
        progressRef.current.animateTo(100, 800);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interactive Progress Bar
          </h3>
          <ProgressBar
            ref={progressRef}
            value={value}
            variant={variant}
            size="lg"
            showLabel
            animated
            striped
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAnimate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Animate to Random
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            disabled={value === 0}
          >
            Reset
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Complete
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-gray-700">Variant:</label>
          {(['default', 'success', 'warning', 'error', 'info'] as const).map(
            (v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={`px-2 py-1 text-xs rounded ${
                  variant === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {v}
              </button>
            ),
          )}
        </div>

        <div className="text-sm text-gray-600">Current value: {value}%</div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example demonstrating programmatic control via ref API and state updates.',
      },
    },
  },
};

export const ScanProgressExamples: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Scan Progress Scenarios
      </h3>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Volume Scanning (Phase 1/3)
          </h4>
          <ProgressBar
            value={35}
            variant="info"
            size="md"
            showLabel
            label="Discovering volumes..."
            animated
            striped
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Filesystem Indexing (Phase 2/3)
          </h4>
          <ProgressBar
            value={67}
            variant="info"
            size="md"
            showLabel
            label="Indexing files... 15,420 files"
            animated
            striped
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Media Enrichment (Phase 3/3)
          </h4>
          <ProgressBar
            value={89}
            variant="info"
            size="md"
            showLabel
            label="Processing metadata... 89%"
            animated
            striped
          />
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <h4 className="text-sm font-medium text-green-700 mb-2">
            Scan Complete
          </h4>
          <ProgressBar
            value={100}
            variant="success"
            size="md"
            showLabel
            label="Scan completed successfully"
          />
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <h4 className="text-sm font-medium text-red-700 mb-2">Scan Failed</h4>
          <ProgressBar
            value={45}
            variant="error"
            size="md"
            showLabel
            label="Error: Permission denied"
          />
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-700 mb-2">
            Scan Paused
          </h4>
          <ProgressBar
            value={72}
            variant="warning"
            size="md"
            showLabel
            label="Scan paused - 72% complete"
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Unknown Progress
          </h4>
          <ProgressBar
            indeterminate
            variant="default"
            size="md"
            showLabel
            label="Preparing scan..."
            animated
          />
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world examples showing how the progress bar would be used in scan monitoring scenarios.',
      },
    },
  },
};

export const EdgeCases: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Zero Progress
        </h3>
        <ProgressBar value={0} variant="default" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Complete Progress
        </h3>
        <ProgressBar value={100} variant="success" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Over 100% (Clamped)
        </h3>
        <ProgressBar value={150} variant="warning" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Negative Value (Clamped)
        </h3>
        <ProgressBar value={-20} variant="error" showLabel />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">No Label</h3>
        <ProgressBar value={75} variant="info" showLabel={false} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Very Long Label
        </h3>
        <ProgressBar
          value={60}
          variant="default"
          showLabel
          label="This is a very long label that might wrap or get truncated depending on the container width"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Edge cases and boundary conditions for the progress bar component.',
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
            Screen Reader Friendly (with aria-label)
          </h4>
          <ProgressBar
            value={65}
            variant="info"
            showLabel
            label="File upload progress"
            aria-label="File upload in progress, 65% complete"
          />
          <p className="text-xs text-gray-500 mt-1">
            Try using a screen reader to hear the progress announcement
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Keyboard Focusable Progress
          </h4>
          <div
            tabIndex={0}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            <ProgressBar
              value={80}
              variant="success"
              showLabel
              label="Keyboard accessible progress"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tab to focus and use arrow keys to adjust (in a real implementation)
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            High Contrast Variants
          </h4>
          <div className="bg-black p-4 rounded">
            <ProgressBar
              value={70}
              variant="success"
              size="lg"
              showLabel
              label="High contrast mode"
              className="contrast-more:bg-white"
            />
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

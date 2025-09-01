import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useState, useRef } from 'react';
import { ErrorSummary } from './ErrorSummary';
import type {
  ErrorSummaryProps,
  ErrorSummaryItem,
  ErrorSummaryRef,
  ScanErrorData,
} from './ErrorSummary.types';
import { createScanError, createScanErrors } from './ErrorSummary.types';

const meta: Meta<typeof ErrorSummary> = {
  title: 'Shared/ErrorSummary',
  component: ErrorSummary,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A comprehensive error management component for displaying, categorizing, and
managing errors from scan operations. Provides grouping, filtering, retry
mechanisms, and acknowledgment workflows for effective error handling.

## Features
- Error categorization and severity levels
- Grouping by category with expandable sections
- Retry and acknowledgment actions
- Detailed error information with collapsible details
- Multiple layout options (list, compact, grouped)
- Filtering and sorting capabilities
- Accessibility compliant with keyboard navigation
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    layout: {
      control: { type: 'select' },
      options: ['list', 'compact', 'grouped'],
      description: 'Layout style',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    maxItems: {
      control: { type: 'number' },
      description: 'Maximum number of errors to show',
    },
    showDetails: {
      control: { type: 'boolean' },
      description: 'Whether to show error details',
    },
    showTimestamps: {
      control: { type: 'boolean' },
      description: 'Whether to show timestamps',
    },
    showCounts: {
      control: { type: 'boolean' },
      description: 'Whether to show error counts',
    },
    showRetryActions: {
      control: { type: 'boolean' },
      description: 'Whether to show retry buttons',
    },
    showAcknowledgeActions: {
      control: { type: 'boolean' },
      description: 'Whether to show acknowledgment actions',
    },
    groupByCategory: {
      control: { type: 'boolean' },
      description: 'Whether to group errors by category',
    },
    collapseResolved: {
      control: { type: 'boolean' },
      description: 'Whether to auto-collapse resolved errors',
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Loading state',
    },
    emptyMessage: {
      control: { type: 'text' },
      description: 'Empty state message',
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

const createSampleErrors = (
  scenario: 'mixed' | 'critical' | 'resolved',
): ErrorSummaryItem[] => {
  const baseTime = new Date();

  const mixedErrors: ErrorSummaryItem[] = [
    {
      id: 'error-1',
      message: 'Permission denied accessing /restricted/directory',
      code: 'EACCES',
      severity: 'high',
      category: 'permission',
      timestamp: new Date(baseTime.getTime() - 300000), // 5 minutes ago
      context: {
        phase: 'filesystem_indexing',
        path: '/data/restricted/sensitive-files',
        volume: 'secure-storage',
      },
      details:
        "Error: EACCES: permission denied, scandir '/data/restricted/sensitive-files'",
      retryable: true,
      suggestion: 'Check file permissions or run with elevated privileges',
      count: 3,
      acknowledged: false,
      resolved: false,
    },
    {
      id: 'error-2',
      message: 'Network connection timeout',
      code: 'ETIMEDOUT',
      severity: 'medium',
      category: 'network',
      timestamp: new Date(baseTime.getTime() - 180000), // 3 minutes ago
      context: {
        phase: 'preview_generation',
        volume: 'remote-storage',
      },
      details: 'Error: connect ETIMEDOUT 192.168.1.100:443',
      retryable: true,
      suggestion: 'Verify network connectivity and try again',
      count: 1,
      acknowledged: false,
      resolved: false,
    },
    {
      id: 'error-3',
      message: 'File not found',
      code: 'ENOENT',
      severity: 'medium',
      category: 'filesystem',
      timestamp: new Date(baseTime.getTime() - 120000), // 2 minutes ago
      context: {
        phase: 'media_enrichment',
        path: '/data/media/missing-file.mp4',
        volume: 'media-storage',
      },
      details:
        "Error: ENOENT: no such file or directory, open '/data/media/missing-file.mp4'",
      retryable: false,
      suggestion: 'Ensure the file or directory exists and is accessible',
      count: 1,
      acknowledged: true,
      resolved: false,
    },
    {
      id: 'error-4',
      message: 'Insufficient disk space',
      code: 'ENOSPC',
      severity: 'critical',
      category: 'resource',
      timestamp: new Date(baseTime.getTime() - 60000), // 1 minute ago
      context: {
        phase: 'preview_generation',
        volume: 'temp-storage',
      },
      details: 'Error: ENOSPC: no space left on device, write',
      retryable: true,
      suggestion: 'Free up disk space or increase available storage',
      count: 1,
      acknowledged: false,
      resolved: false,
    },
    {
      id: 'error-5',
      message: 'Invalid file format',
      severity: 'low',
      category: 'validation',
      timestamp: new Date(baseTime.getTime() - 30000), // 30 seconds ago
      context: {
        phase: 'media_enrichment',
        path: '/data/documents/corrupted.pdf',
        volume: 'document-storage',
      },
      details: 'File appears to be corrupted or in an unsupported format',
      retryable: false,
      suggestion: 'Check input parameters and format',
      count: 2,
      acknowledged: false,
      resolved: false,
    },
  ];

  if (scenario === 'mixed') return mixedErrors;

  if (scenario === 'critical') {
    return mixedErrors.map((error) => ({
      ...error,
      severity: 'critical' as const,
      acknowledged: false,
      resolved: false,
    }));
  }

  return mixedErrors.map((error) => ({
    ...error,
    acknowledged: true,
    resolved: Math.random() > 0.5,
  }));
};

export const Default: Story = {
  args: {
    errors: createSampleErrors('mixed'),
    layout: 'list',
    size: 'md',
    showDetails: true,
    showTimestamps: true,
    showRetryActions: true,
  },
};

export const Critical: Story = {
  args: {
    errors: createSampleErrors('critical'),
    layout: 'list',
    size: 'md',
    showDetails: true,
    showTimestamps: true,
    showRetryActions: true,
    showAcknowledgeActions: true,
  },
};

export const Grouped: Story = {
  args: {
    errors: createSampleErrors('mixed'),
    layout: 'grouped',
    groupByCategory: true,
    size: 'md',
    showDetails: true,
    showRetryActions: true,
    showAcknowledgeActions: true,
  },
};

export const Compact: Story = {
  args: {
    errors: createSampleErrors('mixed').slice(0, 3),
    layout: 'compact',
    size: 'sm',
    showDetails: false,
    showTimestamps: false,
    showCounts: true,
  },
};

export const LayoutComparison: Story = {
  render: () => {
    const errors = createSampleErrors('mixed').slice(0, 3);

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            List Layout
          </h3>
          <ErrorSummary
            errors={errors}
            layout="list"
            showDetails
            showRetryActions
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Compact Layout
          </h3>
          <ErrorSummary
            errors={errors}
            layout="compact"
            showDetails={false}
            showCounts
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Grouped Layout
          </h3>
          <ErrorSummary
            errors={errors}
            layout="grouped"
            groupByCategory
            showDetails
            showRetryActions
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Comparison between different layout options.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => {
    const errors = createSampleErrors('mixed').slice(0, 2);

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Small</h3>
          <ErrorSummary
            errors={errors}
            size="sm"
            showDetails
            showRetryActions
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Medium</h3>
          <ErrorSummary
            errors={errors}
            size="md"
            showDetails
            showRetryActions
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Large</h3>
          <ErrorSummary
            errors={errors}
            size="lg"
            showDetails
            showRetryActions
            showTimestamps
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows all available size options from sm to lg.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => {
    const [errors, setErrors] = useState(createSampleErrors('mixed'));
    const [layout, setLayout] = useState<'list' | 'compact' | 'grouped'>(
      'list',
    );
    const [options, setOptions] = useState({
      showDetails: true,
      showTimestamps: true,
      showCounts: false,
      showRetryActions: true,
      showAcknowledgeActions: true,
      groupByCategory: false,
      collapseResolved: true,
    });
    const summaryRef = useRef<ErrorSummaryRef>(null);

    const handleErrorClick = (error: ErrorSummaryItem) => {
      alert(
        `Error clicked: ${error.message}\nSeverity: ${error.severity}\nCategory: ${error.category}`,
      );
    };

    const handleRetry = (error: ErrorSummaryItem) => {
      alert(`Retrying: ${error.message}`);
      setErrors((prev) =>
        prev.map((e) => (e.id === error.id ? { ...e, resolved: true } : e)),
      );
    };

    const handleAcknowledge = (error: ErrorSummaryItem) => {
      setErrors((prev) =>
        prev.map((e) => (e.id === error.id ? { ...e, acknowledged: true } : e)),
      );
    };

    const handleDismiss = (error: ErrorSummaryItem) => {
      setErrors((prev) => prev.filter((e) => e.id !== error.id));
    };

    const handleClearAll = () => {
      setErrors([]);
    };

    const addRandomError = () => {
      const categories = [
        'permission',
        'network',
        'filesystem',
        'timeout',
        'resource',
        'validation',
      ] as const;
      const severities = ['low', 'medium', 'high', 'critical'] as const;
      const messages = [
        'Connection refused',
        'Access denied',
        'File not found',
        'Operation timeout',
        'Memory allocation failed',
        'Invalid format',
      ];

      const newError: ErrorSummaryItem = {
        id: `error-${Date.now()}`,
        message: messages[Math.floor(Math.random() * messages.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        timestamp: new Date(),
        retryable: Math.random() > 0.3,
        count: Math.floor(Math.random() * 3) + 1,
        acknowledged: false,
        resolved: false,
      };

      setErrors((prev) => [newError, ...prev]);
    };

    const resetErrors = () => {
      setErrors(createSampleErrors('mixed'));
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interactive Error Summary
          </h3>

          <ErrorSummary
            ref={summaryRef}
            errors={errors}
            layout={layout}
            maxItems={10}
            showDetails={options.showDetails}
            showTimestamps={options.showTimestamps}
            showCounts={options.showCounts}
            showRetryActions={options.showRetryActions}
            showAcknowledgeActions={options.showAcknowledgeActions}
            groupByCategory={options.groupByCategory}
            collapseResolved={options.collapseResolved}
            onErrorClick={handleErrorClick}
            onRetry={handleRetry}
            onAcknowledge={handleAcknowledge}
            onDismiss={handleDismiss}
            onClearAll={handleClearAll}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={addRandomError}
            className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Add Random Error
          </button>
          <button
            onClick={resetErrors}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Reset Errors
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">Layout:</label>
          {(['list', 'compact', 'grouped'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-3 py-1 text-sm rounded ${
                layout === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Options:</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(options).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>Total errors: {errors.length}</p>
          <p>Unresolved: {errors.filter((e) => !e.resolved).length}</p>
          <p>
            Critical: {errors.filter((e) => e.severity === 'critical').length}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example demonstrating all error summary features and actions.',
      },
    },
  },
};

export const ScanErrorExample: Story = {
  render: () => {
    const [scanErrors, setScanErrors] = useState<ErrorSummaryItem[]>([]);

    const scanErrorData: ScanErrorData[] = [
      {
        message: 'Permission denied accessing directory',
        code: 'EACCES',
        path: '/data/restricted/admin-files',
        volume: 'secure-volume',
        phase: 'filesystem_indexing',
        timestamp: new Date(Date.now() - 300000),
        details: 'User lacks read permissions for this directory',
        retryable: true,
      },
      {
        message: 'Network timeout during file transfer',
        code: 'ETIMEDOUT',
        volume: 'remote-backup',
        phase: 'preview_generation',
        timestamp: new Date(Date.now() - 180000),
        retryable: true,
      },
      {
        message: 'Corrupted media file detected',
        path: '/media/videos/corrupted.mp4',
        volume: 'media-storage',
        phase: 'media_enrichment',
        timestamp: new Date(Date.now() - 120000),
        details: 'File header indicates corruption or unsupported codec',
        retryable: false,
      },
      {
        message: 'Disk space exhausted',
        code: 'ENOSPC',
        volume: 'temp-storage',
        phase: 'preview_generation',
        timestamp: new Date(Date.now() - 60000),
        details: 'Cannot write thumbnail: No space left on device',
        retryable: true,
      },
    ];

    const generateScanErrors = () => {
      const errors = createScanErrors(scanErrorData);
      setScanErrors(errors);
    };

    const addSingleError = () => {
      const singleErrorData: ScanErrorData = {
        message: 'Invalid file encoding detected',
        code: 'EINVAL',
        path: `/data/files/invalid-${Date.now()}.txt`,
        volume: 'data-volume',
        phase: 'validation',
        timestamp: new Date(),
        retryable: false,
      };

      const newError = createScanError(singleErrorData);
      setScanErrors((prev) => [newError, ...prev]);
    };

    const handleRetry = (error: ErrorSummaryItem) => {
      alert(
        `Retrying scan operation for: ${error.context?.path || error.message}`,
      );
      setScanErrors((prev) =>
        prev.map((e) => (e.id === error.id ? { ...e, resolved: true } : e)),
      );
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Scan Error Management
          </h3>

          <ErrorSummary
            errors={scanErrors}
            layout="list"
            showDetails
            showTimestamps
            showRetryActions
            showAcknowledgeActions
            groupByCategory={false}
            onRetry={handleRetry}
            onAcknowledge={(error) => {
              setScanErrors((prev) =>
                prev.map((e) =>
                  e.id === error.id ? { ...e, acknowledged: true } : e,
                ),
              );
            }}
            onClearAll={() => setScanErrors([])}
            emptyMessage="No scan errors found - all operations completed successfully!"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateScanErrors}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Generate Scan Errors
          </button>
          <button
            onClick={addSingleError}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
          >
            Add Single Error
          </button>
          <button
            onClick={() => setScanErrors([])}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            This example uses <code>createScanError</code> and{' '}
            <code>createScanErrors</code> utilities to convert scan error data
            into error summary items.
          </p>
          <p>
            Error categorization and severity are automatically determined based
            on error codes and messages.
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Example using scan-specific error utilities with automatic categorization.',
      },
    },
  },
};

export const StateExamples: Story = {
  render: () => {
    const [currentState, setCurrentState] = useState<
      'normal' | 'loading' | 'empty'
    >('normal');
    const errors = createSampleErrors('mixed');

    const getProps = () => {
      switch (currentState) {
        case 'loading':
          return { errors: [], isLoading: true };
        case 'empty':
          return { errors: [] };
        default:
          return { errors };
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Error Summary States
          </h3>

          <ErrorSummary
            {...getProps()}
            showDetails
            showRetryActions
            emptyMessage="No errors detected - system is healthy!"
          />
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-gray-700">State:</label>
          {(['normal', 'loading', 'empty'] as const).map((state) => (
            <button
              key={state}
              onClick={() => setCurrentState(state)}
              className={`px-3 py-1 text-sm rounded ${
                currentState === state
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates loading, empty, and normal states.',
      },
    },
  },
};

export const FilteringExample: Story = {
  render: () => {
    const [filter, setFilter] = useState<
      'all' | 'critical' | 'retryable' | 'unresolved'
    >('all');
    const errors = createSampleErrors('mixed');

    const getFilter = () => {
      switch (filter) {
        case 'critical':
          return (error: ErrorSummaryItem) => error.severity === 'critical';
        case 'retryable':
          return (error: ErrorSummaryItem) => !!error.retryable;
        case 'unresolved':
          return (error: ErrorSummaryItem) =>
            !error.resolved && !error.acknowledged;
        default:
          return undefined;
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Filtered Error Summary
          </h3>

          <ErrorSummary
            errors={errors}
            filter={getFilter()}
            showDetails
            showRetryActions
            showAcknowledgeActions
          />
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-gray-700">Filter:</label>
          {(['all', 'critical', 'retryable', 'unresolved'] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-sm rounded ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ),
          )}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates error filtering by severity and status.',
      },
    },
  },
};

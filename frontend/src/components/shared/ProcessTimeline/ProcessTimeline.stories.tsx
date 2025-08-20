import type { Meta, StoryObj } from '@storybook/react';
import { useState, useRef } from 'react';
import { Search, FolderOpen, Image, Video, CheckCircle } from 'lucide-react';
import { ProcessTimeline } from './ProcessTimeline';
import type {
  ProcessTimelineProps,
  ProcessTimelinePhase,
  ProcessTimelineRef,
} from './ProcessTimeline.types';
import {
  createScanTimeline,
  SCAN_PHASE_CONFIGS,
} from './ProcessTimeline.types';

const meta: Meta<typeof ProcessTimeline> = {
  title: 'Shared/ProcessTimeline',
  component: ProcessTimeline,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
A comprehensive timeline component for displaying multi-phase processes
like scan operations. Combines ProgressBar and StatusBadge components
to provide detailed progress tracking with phase-by-phase visibility.

## Features
- Horizontal and vertical orientations
- Progress tracking for active phases
- Status badges with animations
- Error handling and retry mechanisms
- Timestamp and duration display
- Clickable phases for navigation
- Accessibility compliant with keyboard navigation
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical'],
      description: 'Layout orientation',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Size variant',
    },
    status: {
      control: { type: 'select' },
      options: ['idle', 'running', 'completed', 'failed', 'paused'],
      description: 'Overall process status',
    },
    showProgress: {
      control: { type: 'boolean' },
      description: 'Whether to show progress bars',
    },
    showDescriptions: {
      control: { type: 'boolean' },
      description: 'Whether to show phase descriptions',
    },
    showTimestamps: {
      control: { type: 'boolean' },
      description: 'Whether to show timestamps',
    },
    showDurations: {
      control: { type: 'boolean' },
      description: 'Whether to show durations',
    },
    animated: {
      control: { type: 'boolean' },
      description: 'Whether to animate transitions',
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

// Sample data
const createSamplePhases = (
  scenario: 'idle' | 'running' | 'completed' | 'failed',
): ProcessTimelinePhase[] => {
  const basePhases: ProcessTimelinePhase[] = [
    {
      id: 'discovery',
      label: 'Volume Discovery',
      description: 'Scanning Docker environment for available volumes',
      status: 'pending',
      icon: <Search />,
      duration: { estimated: 10 },
    },
    {
      id: 'indexing',
      label: 'Filesystem Indexing',
      description: 'Building directory tree and cataloging files',
      status: 'pending',
      icon: <FolderOpen />,
      duration: { estimated: 120 },
    },
    {
      id: 'enrichment',
      label: 'Metadata Enrichment',
      description: 'Extracting EXIF, media properties, and file details',
      status: 'pending',
      icon: <Image />,
      duration: { estimated: 90 },
    },
    {
      id: 'previews',
      label: 'Preview Generation',
      description: 'Creating thumbnails and video previews',
      status: 'pending',
      icon: <Video />,
      duration: { estimated: 60 },
    },
    {
      id: 'completion',
      label: 'Finalizing',
      description: 'Updating indexes and cleaning up',
      status: 'pending',
      icon: <CheckCircle />,
      duration: { estimated: 15 },
    },
  ];

  switch (scenario) {
    case 'running':
      return basePhases.map((phase, index) => {
        if (index === 0) {
          return {
            ...phase,
            status: 'completed' as const,
            timestamps: {
              startedAt: new Date(Date.now() - 300000),
              completedAt: new Date(Date.now() - 280000),
            },
            duration: { ...phase.duration, actual: 8 },
          };
        }
        if (index === 1) {
          return {
            ...phase,
            status: 'active' as const,
            progress: 67,
            timestamps: {
              startedAt: new Date(Date.now() - 280000),
            },
            metadata: {
              filesProcessed: 15420,
              totalFiles: 23000,
              currentPath: '/data/media/movies/collection',
            },
          };
        }
        return phase;
      });

    case 'completed':
      return basePhases.map((phase, index) => ({
        ...phase,
        status: 'completed' as const,
        timestamps: {
          startedAt: new Date(Date.now() - (300000 - index * 60000)),
          completedAt: new Date(Date.now() - (240000 - index * 60000)),
        },
        duration: {
          ...phase.duration,
          actual: Math.max(
            5,
            (phase.duration?.estimated || 30) - Math.random() * 10,
          ),
        },
        metadata:
          index === 1
            ? {
                filesProcessed: 23000,
                totalFiles: 23000,
              }
            : undefined,
      }));

    case 'failed':
      return basePhases.map((phase, index) => {
        if (index === 0) {
          return {
            ...phase,
            status: 'completed' as const,
            timestamps: {
              startedAt: new Date(Date.now() - 300000),
              completedAt: new Date(Date.now() - 280000),
            },
            duration: { ...phase.duration, actual: 12 },
          };
        }
        if (index === 1) {
          return {
            ...phase,
            status: 'failed' as const,
            progress: 23,
            timestamps: {
              startedAt: new Date(Date.now() - 280000),
            },
            error: {
              message: 'Permission denied accessing /restricted/directory',
              code: 'EACCES',
              details:
                'The scan process lacks sufficient permissions to read this directory',
            },
            metadata: {
              filesProcessed: 5200,
              totalFiles: 23000,
            },
          };
        }
        return phase;
      });

    default:
      return basePhases;
  }
};

// Basic Examples
export const Default: Story = {
  args: {
    phases: createSamplePhases('idle'),
    orientation: 'vertical',
    size: 'md',
    showProgress: true,
    showDescriptions: true,
  },
};

export const Running: Story = {
  args: {
    phases: createSamplePhases('running'),
    currentPhase: 'indexing',
    status: 'running',
    orientation: 'vertical',
    size: 'md',
    showProgress: true,
    showDescriptions: true,
    animated: true,
  },
};

export const Completed: Story = {
  args: {
    phases: createSamplePhases('completed'),
    status: 'completed',
    orientation: 'vertical',
    size: 'md',
    showProgress: false,
    showDescriptions: true,
    showTimestamps: true,
    showDurations: true,
  },
};

export const Failed: Story = {
  args: {
    phases: createSamplePhases('failed'),
    currentPhase: 'indexing',
    status: 'failed',
    orientation: 'vertical',
    size: 'md',
    showProgress: true,
    showDescriptions: true,
  },
};

// Orientation Examples
export const OrientationComparison: Story = {
  render: () => {
    const phases = createSamplePhases('running');

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Vertical Layout
          </h3>
          <ProcessTimeline
            phases={phases}
            currentPhase="indexing"
            orientation="vertical"
            showProgress
            showDescriptions
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Horizontal Layout
          </h3>
          <ProcessTimeline
            phases={phases}
            currentPhase="indexing"
            orientation="horizontal"
            showProgress
            showDescriptions={false}
          />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Comparison between vertical and horizontal timeline orientations.',
      },
    },
  },
};

// Size Examples
export const AllSizes: Story = {
  render: () => {
    const phases = createSamplePhases('running').slice(0, 3);

    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Small</h3>
          <ProcessTimeline
            phases={phases}
            currentPhase="indexing"
            size="sm"
            showProgress
            showDescriptions={false}
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Medium</h3>
          <ProcessTimeline
            phases={phases}
            currentPhase="indexing"
            size="md"
            showProgress
            showDescriptions
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Large</h3>
          <ProcessTimeline
            phases={phases}
            currentPhase="indexing"
            size="lg"
            showProgress
            showDescriptions
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

// Interactive Example
export const Interactive: Story = {
  render: () => {
    const [currentScenario, setCurrentScenario] = useState<
      'idle' | 'running' | 'completed' | 'failed'
    >('idle');
    const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(
      'vertical',
    );
    const [showOptions, setShowOptions] = useState({
      progress: true,
      descriptions: true,
      timestamps: false,
      durations: false,
    });
    const timelineRef = useRef<ProcessTimelineRef>(null);

    const phases = createSamplePhases(currentScenario);
    const currentPhase = currentScenario === 'running' ? 'indexing' : undefined;

    const handlePhaseClick = (phase: ProcessTimelinePhase) => {
      alert(`Clicked phase: ${phase.label} (${phase.status})`);
    };

    const handleRetryPhase = (phase: ProcessTimelinePhase) => {
      alert(`Retrying phase: ${phase.label}`);
      setCurrentScenario('running');
    };

    const handleScrollToPhase = (phaseId: string) => {
      timelineRef.current?.scrollToPhase(phaseId);
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Interactive Process Timeline
          </h3>

          <div className="border rounded-lg p-4 bg-gray-50">
            <ProcessTimeline
              ref={timelineRef}
              phases={phases}
              currentPhase={currentPhase}
              status={currentScenario === 'idle' ? 'idle' : currentScenario}
              orientation={orientation}
              showProgress={showOptions.progress}
              showDescriptions={showOptions.descriptions}
              showTimestamps={showOptions.timestamps}
              showDurations={showOptions.durations}
              onPhaseClick={handlePhaseClick}
              onRetryPhase={handleRetryPhase}
              animated
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">Scenario:</label>
          {(['idle', 'running', 'completed', 'failed'] as const).map(
            (scenario) => (
              <button
                key={scenario}
                onClick={() => setCurrentScenario(scenario)}
                className={`px-3 py-1 text-sm rounded ${
                  currentScenario === scenario
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-700">Orientation:</label>
          {(['vertical', 'horizontal'] as const).map((orient) => (
            <button
              key={orient}
              onClick={() => setOrientation(orient)}
              className={`px-3 py-1 text-sm rounded ${
                orientation === orient
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {orient.charAt(0).toUpperCase() + orient.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Display Options:</label>
          <div className="flex flex-wrap gap-4">
            {Object.entries(showOptions).map(([key, value]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setShowOptions((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="rounded border-gray-300"
                />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-sm text-gray-700">Scroll to phase:</label>
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => handleScrollToPhase(phase.id)}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              {phase.label}
            </button>
          ))}
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive example demonstrating all timeline features and programmatic control.',
      },
    },
  },
};

// Real Scan Data Example
export const RealScanExample: Story = {
  render: () => {
    const [progress, setProgress] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    // Simulate real scan progress
    const scanProgressData = [
      {
        phase: 'discovery',
        progress: 100,
        status: 'completed' as const,
        startedAt: new Date(Date.now() - 180000),
        completedAt: new Date(Date.now() - 170000),
        filesProcessed: 5,
        totalFiles: 5,
      },
      {
        phase: 'indexing',
        progress: progress,
        status: (progress === 100
          ? 'completed'
          : isRunning
            ? 'running'
            : 'pending') as const,
        startedAt: isRunning ? new Date(Date.now() - 120000) : undefined,
        completedAt:
          progress === 100 ? new Date(Date.now() - 30000) : undefined,
        filesProcessed: Math.floor((progress / 100) * 45230),
        totalFiles: 45230,
        currentPath: '/data/media/tv-shows/collection',
      },
    ];

    const phases = createScanTimeline(scanProgressData);

    const startScan = () => {
      setIsRunning(true);
      setProgress(0);

      const interval = setInterval(() => {
        setProgress((prev) => {
          const next = prev + Math.random() * 5;
          if (next >= 100) {
            clearInterval(interval);
            setIsRunning(false);
            return 100;
          }
          return next;
        });
      }, 500);
    };

    const resetScan = () => {
      setProgress(0);
      setIsRunning(false);
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Real Scan Progress Simulation
          </h3>

          <div className="border rounded-lg p-4 bg-gray-50">
            <ProcessTimeline
              phases={phases}
              currentPhase={isRunning ? 'indexing' : undefined}
              status={
                isRunning ? 'running' : progress === 100 ? 'completed' : 'idle'
              }
              showProgress
              showDescriptions
              showTimestamps
              animated
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={startScan}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Scanning...' : 'Start Scan'}
          </button>
          <button
            onClick={resetScan}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Reset
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <p>
            This example uses the <code>createScanTimeline</code> utility to
            convert real scan progress data into timeline phases.
          </p>
          <p>
            Progress: {Math.round(progress)}% | Status:{' '}
            {isRunning ? 'Running' : progress === 100 ? 'Complete' : 'Idle'}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Example using real scan data with the createScanTimeline utility function.',
      },
    },
  },
};

// Error Handling Example
export const ErrorHandling: Story = {
  render: () => {
    const [phases, setPhases] = useState(createSamplePhases('failed'));

    const handleRetryPhase = (phase: ProcessTimelinePhase) => {
      setPhases((prev) =>
        prev.map((p) =>
          p.id === phase.id
            ? { ...p, status: 'active' as const, progress: 0, error: undefined }
            : p,
        ),
      );

      // Simulate progress
      setTimeout(() => {
        setPhases((prev) =>
          prev.map((p) =>
            p.id === phase.id
              ? { ...p, status: 'completed' as const, progress: 100 }
              : p,
          ),
        );
      }, 2000);
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Error Handling & Retry
          </h3>

          <ProcessTimeline
            phases={phases}
            status="failed"
            showProgress
            showDescriptions
            onRetryPhase={handleRetryPhase}
            animated
          />
        </div>

        <div className="text-sm text-gray-600">
          <p>
            Click the "Retry" button in the failed phase to simulate recovery.
          </p>
          <p>Error phases show detailed error information and retry options.</p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates error handling and retry functionality for failed phases.',
      },
    },
  },
};

// Compact Timeline
export const CompactTimeline: Story = {
  args: {
    phases: createSamplePhases('running').slice(0, 4),
    currentPhase: 'indexing',
    orientation: 'horizontal',
    size: 'sm',
    showProgress: false,
    showDescriptions: false,
    showTimestamps: false,
    showDurations: false,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Compact horizontal timeline suitable for headers or small spaces.',
      },
    },
  },
};

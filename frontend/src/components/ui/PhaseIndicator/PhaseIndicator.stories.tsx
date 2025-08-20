import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { action } from '@storybook/addon-actions';
import { 
  Search, 
  Database, 
  Image, 
  CheckCircle,
  Settings,
  Upload
} from 'lucide-react';

import { PhaseIndicator } from './PhaseIndicator';
import type { Phase, PhaseStatus } from './PhaseIndicator.types';

const meta: Meta<typeof PhaseIndicator> = {
  title: 'UI/PhaseIndicator',
  component: PhaseIndicator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A flexible multi-step process visualization component for displaying scan phases and progress.',
      },
    },
  },
  argTypes: {
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
    },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    showDescriptions: {
      control: 'boolean',
    },
    showProgress: {
      control: 'boolean',
    },
    showConnectors: {
      control: 'boolean',
    },
    animated: {
      control: 'boolean',
    },
    clickable: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PhaseIndicator>;

// Sample phases for scan monitoring
const createScanPhases = (activePhaseIndex: number = 1): Phase[] => [
  {
    id: 'prepare',
    label: 'Preparation',
    description: 'Preparing scan configuration',
    status: activePhaseIndex > 0 ? 'completed' : activePhaseIndex === 0 ? 'active' : 'pending',
    icon: <Settings className="w-4 h-4" />,
    progress: activePhaseIndex === 0 ? 85 : undefined,
    clickable: true,
  },
  {
    id: 'scan',
    label: 'Volume Scan',
    description: 'Scanning filesystem structure',
    status: activePhaseIndex > 1 ? 'completed' : activePhaseIndex === 1 ? 'active' : 'pending',
    icon: <Search className="w-4 h-4" />,
    progress: activePhaseIndex === 1 ? 45 : undefined,
    clickable: true,
  },
  {
    id: 'index',
    label: 'Indexing',
    description: 'Building file index database',
    status: activePhaseIndex > 2 ? 'completed' : activePhaseIndex === 2 ? 'active' : 'pending',
    icon: <Database className="w-4 h-4" />,
    progress: activePhaseIndex === 2 ? 72 : undefined,
    clickable: true,
  },
  {
    id: 'metadata',
    label: 'Metadata',
    description: 'Extracting file metadata',
    status: activePhaseIndex > 3 ? 'completed' : activePhaseIndex === 3 ? 'active' : 'pending',
    icon: <Image className="w-4 h-4" />,
    progress: activePhaseIndex === 3 ? 28 : undefined,
    clickable: true,
  },
  {
    id: 'complete',
    label: 'Complete',
    description: 'Scan completed successfully',
    status: activePhaseIndex > 4 ? 'completed' : activePhaseIndex === 4 ? 'active' : 'pending',
    icon: <CheckCircle className="w-4 h-4" />,
    clickable: true,
  },
];

// Default story
export const Default: Story = {
  args: {
    phases: createScanPhases(1),
    orientation: 'horizontal',
    size: 'md',
    showDescriptions: true,
    showProgress: true,
    showConnectors: true,
    animated: true,
    clickable: false,
    onPhaseClick: action('Phase clicked'),
    onPhaseHover: action('Phase hovered'),
  },
};

// Different sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Small</h3>
        <PhaseIndicator
          phases={createScanPhases(1)}
          size="sm"
          showDescriptions={false}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Medium</h3>
        <PhaseIndicator
          phases={createScanPhases(1)}
          size="md"
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Large</h3>
        <PhaseIndicator
          phases={createScanPhases(1)}
          size="lg"
        />
      </div>
    </div>
  ),
};

// Orientations
export const Orientations: Story = {
  render: () => (
    <div className="flex gap-12">
      <div>
        <h3 className="text-lg font-semibold mb-4">Horizontal</h3>
        <PhaseIndicator
          phases={createScanPhases(2)}
          orientation="horizontal"
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Vertical</h3>
        <PhaseIndicator
          phases={createScanPhases(2)}
          orientation="vertical"
        />
      </div>
    </div>
  ),
};

// Different statuses
export const Statuses: Story = {
  render: () => {
    const statusPhases: Phase[] = [
      {
        id: 'pending',
        label: 'Pending',
        description: 'Waiting to start',
        status: 'pending',
        clickable: true,
      },
      {
        id: 'active',
        label: 'Active',
        description: 'Currently running',
        status: 'active',
        progress: 65,
        clickable: true,
      },
      {
        id: 'completed',
        label: 'Completed',
        description: 'Successfully finished',
        status: 'completed',
        clickable: true,
      },
      {
        id: 'failed',
        label: 'Failed',
        description: 'Process failed',
        status: 'failed',
        clickable: true,
      },
      {
        id: 'skipped',
        label: 'Skipped',
        description: 'Phase was skipped',
        status: 'skipped',
        clickable: true,
      },
    ];

    return (
      <PhaseIndicator
        phases={statusPhases}
        onPhaseClick={action('Phase clicked')}
        clickable
      />
    );
  },
};

// Interactive example
export const Interactive: Story = {
  render: () => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(1);
    const [isAnimating, setIsAnimating] = useState(false);
    
    const phases = createScanPhases(activePhaseIndex);

    const handlePhaseClick = (phase: Phase) => {
      const newIndex = phases.findIndex(p => p.id === phase.id);
      setActivePhaseIndex(newIndex);
      action('Phase clicked')(phase);
    };

    const simulateProgress = () => {
      if (isAnimating) return;
      
      setIsAnimating(true);
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        setActivePhaseIndex(currentIndex);
        currentIndex++;
        
        if (currentIndex > phases.length) {
          clearInterval(interval);
          setIsAnimating(false);
          setActivePhaseIndex(phases.length);
        }
      }, 1500);
    };

    return (
      <div className="space-y-6">
        <PhaseIndicator
          phases={phases}
          activePhase={phases[activePhaseIndex]?.id}
          clickable
          onPhaseClick={handlePhaseClick}
          onPhaseHover={action('Phase hovered')}
        />
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setActivePhaseIndex(Math.max(0, activePhaseIndex - 1))}
            disabled={activePhaseIndex === 0 || isAnimating}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          
          <button
            onClick={() => setActivePhaseIndex(Math.min(phases.length - 1, activePhaseIndex + 1))}
            disabled={activePhaseIndex === phases.length - 1 || isAnimating}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Next
          </button>
          
          <button
            onClick={simulateProgress}
            disabled={isAnimating}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {isAnimating ? 'Simulating...' : 'Simulate Progress'}
          </button>
          
          <button
            onClick={() => setActivePhaseIndex(0)}
            disabled={isAnimating}
            className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>
    );
  },
};

// Compact version
export const Compact: Story = {
  args: {
    phases: createScanPhases(2),
    size: 'sm',
    showDescriptions: false,
    showProgress: false,
    showConnectors: true,
    animated: false,
  },
};

// Minimal version
export const Minimal: Story = {
  args: {
    phases: createScanPhases(2),
    size: 'sm',
    showDescriptions: false,
    showProgress: false,
    showConnectors: false,
    animated: false,
  },
};

// With custom icons
export const WithCustomIcons: Story = {
  args: {
    phases: [
      {
        id: 'upload',
        label: 'Upload',
        description: 'Upload files to server',
        status: 'completed',
        icon: <Upload className="w-4 h-4" />,
      },
      {
        id: 'process',
        label: 'Process',
        description: 'Processing uploaded files',
        status: 'active',
        progress: 55,
        icon: <Settings className="w-4 h-4" />,
      },
      {
        id: 'complete',
        label: 'Complete',
        description: 'Files processed successfully',
        status: 'pending',
        icon: <CheckCircle className="w-4 h-4" />,
      },
    ],
  },
};

// Error handling
export const WithErrors: Story = {
  render: () => {
    const errorPhases: Phase[] = [
      {
        id: 'start',
        label: 'Start',
        description: 'Process started',
        status: 'completed',
      },
      {
        id: 'validate',
        label: 'Validate',
        description: 'Validation step',
        status: 'completed',
      },
      {
        id: 'process',
        label: 'Process',
        description: 'Processing failed due to network error',
        status: 'failed',
      },
      {
        id: 'backup',
        label: 'Backup',
        description: 'Backup step (skipped due to failure)',
        status: 'skipped',
      },
      {
        id: 'complete',
        label: 'Complete',
        description: 'Process completion',
        status: 'pending',
        disabled: true,
      },
    ];

    return (
      <PhaseIndicator
        phases={errorPhases}
        clickable
        onPhaseClick={action('Phase clicked')}
      />
    );
  },
};
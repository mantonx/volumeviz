/**
 * OnboardingPage Storybook Stories
 * Visual documentation for onboarding wizard flow
 */

import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingPage } from './OnboardingPage';

const meta = {
  title: 'Pages/OnboardingPage',
  component: OnboardingPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Multi-step onboarding wizard for configuring Docker volume tracking with preset strategies and live preview.',
      },
    },
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof OnboardingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default onboarding flow starting at discovery step
 */
export const Default: Story = {
  args: {},
};

/**
 * Onboarding with no Docker mounts discovered
 */
export const NoMountsFound: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Shows warning message when no Docker mounts are discovered, with demo data fallback.',
      },
    },
    mockData: {
      mounts: [],
    },
  },
};

/**
 * Discovery step with rich mount data
 */
export const DiscoveryStep: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Discovery step showing Docker mount statistics, compose projects, and services.',
      },
    },
  },
};

/**
 * Preset selection step
 */
export const PresetSelection: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Preset selection screen with Server Default, Strict, and Custom options.',
      },
    },
  },
};

/**
 * Preview step with tracking results
 */
export const PreviewStep: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Preview configuration showing how many mounts will be tracked based on selected preset.',
      },
    },
  },
};

/**
 * Completion step
 */
export const CompletionStep: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Final step showing setup completion with tracked mount count.',
      },
    },
  },
};

/**
 * Mobile viewport
 */
export const Mobile: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Responsive design optimized for mobile devices.',
      },
    },
  },
};

/**
 * Tablet viewport
 */
export const Tablet: Story = {
  args: {},
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Responsive design optimized for tablet devices.',
      },
    },
  },
};

/**
 * Dark mode
 */
export const DarkMode: Story = {
  args: {},
  parameters: {
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        story: 'Onboarding wizard in dark mode.',
      },
    },
  },
};

/**
 * With many compose projects
 */
export const ManyProjects: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Discovery step showing a system with many Docker Compose projects and services.',
      },
    },
  },
};

/**
 * Server preset selected
 */
export const ServerPresetSelected: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Preset selection with Server Default preset highlighted.',
      },
    },
  },
};

/**
 * Strict preset selected
 */
export const StrictPresetSelected: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          'Preset selection with Strict preset (volumes only) highlighted.',
      },
    },
  },
};

/**
 * Loading state during discovery
 */
export const Loading: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Loading state shown while scanning Docker mounts.',
      },
    },
  },
};

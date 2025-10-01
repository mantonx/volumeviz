/**
 * Main application feature tour configuration
 * Defines the step-by-step tour shown after onboarding
 */

import type { TourStep } from '@/components/ui/FeatureTour';

export const APP_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: 'Navigation Sidebar',
    description:
      'Use the sidebar to navigate between different sections of VolumeViz. Access your volumes, browse files, view trends, and manage alerts.',
    placement: 'right',
  },
  {
    target: '[data-tour="dashboard-stats"]',
    title: 'Storage Overview',
    description:
      'Get a quick view of your total storage usage, number of tracked volumes, and recent activity. These cards update in real-time as you scan volumes.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="recent-scans"]',
    title: 'Recent Volumes',
    description:
      'See your most recently scanned volumes here with their current size and scan status. Click on any volume to view detailed information.',
    placement: 'top',
  },
  {
    target: '[data-tour="volumes-link"]',
    title: 'Manage Volumes',
    description:
      'View all your Docker volumes, start scans, and get detailed analytics for each volume. This is the main hub for volume management.',
    placement: 'right',
    action: {
      label: 'Go to Volumes',
      onClick: () => {
        window.location.href = '/volumes';
      },
    },
  },
  {
    target: '[data-tour="files-link"]',
    title: 'Browse & Search Files',
    description:
      'Explore files within volumes or search across all volumes at once. You can switch between browse and search modes with a simple tab.',
    placement: 'right',
  },
  {
    target: '[data-tour="trends-link"]',
    title: 'Analyze Trends',
    description:
      'Dive deep into storage trends, capacity predictions, and file type distributions to understand your storage usage patterns over time.',
    placement: 'right',
  },
  {
    target: '[data-tour="user-menu"]',
    title: 'User Menu',
    description:
      'Access your account settings and sign out from here. Advanced features like tracking rules and mount management can be found in Settings.',
    placement: 'bottom',
  },
];

export const APP_TOUR_ID = 'main-app-tour';

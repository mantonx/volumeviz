/**
 * Shared Storybook utilities and helpers
 *
 * This file provides reusable utilities for all component stories,
 * eliminating the need for @storybook/addon-actions and providing
 * consistent patterns across all stories.
 */

/**
 * Simple action replacement for demo purposes
 * Logs interactions to the browser console
 */
export const action =
  (name: string) =>
  (...args: any[]) => {
    console.log(`🎬 ${name}:`, ...args);
  };

/**
 * Mock data generators for common story props
 */
export const mockData = {
  user: {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    avatar: 'https://via.placeholder.com/40',
  },

  files: [
    { id: 1, name: 'document.pdf', type: 'application/pdf', size: 1024000 },
    { id: 2, name: 'image.jpg', type: 'image/jpeg', size: 2048000 },
    { id: 3, name: 'video.mp4', type: 'video/mp4', size: 10485760 },
    { id: 4, name: 'archive.zip', type: 'application/zip', size: 5242880 },
  ],

  volumes: [
    { id: 'vol-1', name: 'app-data', size: '2.5GB', status: 'active' },
    { id: 'vol-2', name: 'database', size: '8.1GB', status: 'active' },
    { id: 'vol-3', name: 'logs', size: '500MB', status: 'inactive' },
  ],
};

/**
 * Common story decorators
 */
export const decorators = {
  withPadding: (Story: any) => (
    <div className="p-4">
      <Story />
    </div>
  ),

  withCenteredLayout: (Story: any) => (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Story />
    </div>
  ),

  withDarkBackground: (Story: any) => (
    <div className="bg-gray-900 p-4 min-h-screen">
      <div className="dark">
        <Story />
      </div>
    </div>
  ),
};

/**
 * Common argTypes for Storybook controls
 */
export const commonArgTypes = {
  onClick: {
    action: 'clicked',
    description: 'Click event handler',
  },

  onChange: {
    action: 'changed',
    description: 'Change event handler',
  },

  onSubmit: {
    action: 'submitted',
    description: 'Submit event handler',
  },

  className: {
    control: { type: 'text' },
    description: 'Additional CSS classes',
  },

  disabled: {
    control: { type: 'boolean' },
    description: 'Whether the component is disabled',
  },
};

/**
 * Utility to create consistent story metadata
 */
export const createStoryMeta = (
  title: string,
  component: any,
  description?: string,
) => ({
  title,
  component,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          description ||
          `${component.name} component stories and documentation.`,
      },
    },
  },
  tags: ['autodocs'],
});

/**
 * Sleep utility for demo purposes
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format file size utility
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Generate random data for dynamic stories
 */
export const generateRandomData = {
  id: () => Math.random().toString(36).substr(2, 9),

  number: (min: number = 0, max: number = 100) =>
    Math.floor(Math.random() * (max - min + 1)) + min,

  boolean: () => Math.random() > 0.5,

  text: (length: number = 10) => Math.random().toString(36).substr(2, length),

  email: () => {
    const domains = ['example.com', 'test.org', 'demo.net'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `user${Math.floor(Math.random() * 1000)}@${domain}`;
  },
};

export default {
  action,
  mockData,
  decorators,
  commonArgTypes,
  createStoryMeta,
  sleep,
  formatFileSize,
  generateRandomData,
};

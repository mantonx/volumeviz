/**
 * Dark Theme Definition
 *
 * Modern dark theme with true blacks, excellent contrast, and sophisticated elevation.
 * Uses a refined slate palette with subtle blue undertones for depth and polish.
 */

import { primitives } from '../tokens/primitives';
import type { Theme } from './light';

export const darkTheme: Theme = {
  colors: {
    // Text colors - vibrant and clear on dark backgrounds
    '--color-text-primary': primitives.gray[50],       // Bright white for primary text
    '--color-text-secondary': primitives.gray[400],    // Clear medium gray
    '--color-text-tertiary': primitives.gray[500],     // Subtle tertiary text
    '--color-text-inverse': primitives.gray[900],
    '--color-text-disabled': primitives.gray[600],
    '--color-text-link': primitives.blue[400],
    '--color-text-link-hover': primitives.blue[300],
    '--color-text-success': primitives.green[400],
    '--color-text-warning': primitives.yellow[400],
    '--color-text-error': primitives.red[400],
    '--color-text-info': primitives.blue[400],

    // Background colors - true black base with clear elevation
    '--color-bg-primary': primitives.gray[950],        // True black base (#020617)
    '--color-bg-secondary': primitives.gray[900],      // Slightly elevated (#0f172a)
    '--color-bg-tertiary': primitives.gray[800],       // More elevated (#1e293b)
    '--color-bg-inverse': primitives.gray[50],
    '--color-bg-elevated': primitives.gray[900],       // Cards/panels float above base (#0f172a)
    '--color-bg-overlay': 'rgba(2, 6, 23, 0.9)',       // Deep overlay
    '--color-bg-hover': 'rgba(51, 65, 85, 0.4)',       // Subtle hover effect
    '--color-bg-selected': 'rgba(59, 130, 246, 0.15)', // Subtle blue selection

    // Border colors - visible but not harsh
    '--color-border-default': 'rgba(51, 65, 85, 0.5)',    // Subtle borders with transparency
    '--color-border-subtle': 'rgba(30, 41, 59, 0.5)',     // Very subtle dividers
    '--color-border-strong': primitives.gray[600],         // Emphasized borders
    '--color-border-focus': primitives.blue[500],
    '--color-border-error': primitives.red[700],

    // Interactive colors - vibrant and accessible
    '--color-interactive-default': primitives.blue[500],
    '--color-interactive-hover': primitives.blue[400],
    '--color-interactive-active': primitives.blue[600],
    '--color-interactive-disabled': primitives.gray[700],
    '--color-interactive-subtle': primitives.gray[800],
    '--color-interactive-subtle-hover': primitives.gray[700],

    // Status colors - adjusted for dark backgrounds with proper contrast
    '--color-status-success': primitives.green[500],
    '--color-status-success-bg': 'rgba(34, 197, 94, 0.15)',
    '--color-status-warning': primitives.yellow[500],
    '--color-status-warning-bg': 'rgba(234, 179, 8, 0.15)',
    '--color-status-error': primitives.red[500],
    '--color-status-error-bg': 'rgba(239, 68, 68, 0.15)',
    '--color-status-info': primitives.blue[500],
    '--color-status-info-bg': 'rgba(59, 130, 246, 0.15)',

    // Brand colors
    '--color-brand-primary': primitives.blue[500],
    '--color-brand-primary-hover': primitives.blue[400],
    '--color-brand-secondary': primitives.purple[500],
  },

  // Typography (same as light theme)
  typography: {
    '--font-family-sans':
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    '--font-family-mono':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  // Shadows - dramatic and layered for depth perception
  shadows: {
    '--shadow-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(51, 65, 85, 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 65, 85, 0.4)',
    '--shadow-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 65, 85, 0.5)',
    '--shadow-2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(51, 65, 85, 0.6)',
    '--shadow-inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.5)',
  },
} as const;

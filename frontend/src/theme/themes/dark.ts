/**
 * Dark Theme Definition
 *
 * Maps semantic token names to actual color values for the dark theme.
 * These CSS variables are applied to :root when dark theme is active.
 */

import { primitives } from '../tokens/primitives';
import type { Theme } from './light';

export const darkTheme: Theme = {
  colors: {
    // Text colors - lighter shades for dark backgrounds
    '--color-text-primary': primitives.gray[50],
    '--color-text-secondary': primitives.gray[300],
    '--color-text-tertiary': primitives.gray[400],
    '--color-text-inverse': primitives.gray[900],
    '--color-text-disabled': primitives.gray[600],
    '--color-text-link': primitives.blue[400],
    '--color-text-link-hover': primitives.blue[300],
    '--color-text-success': primitives.green[400],
    '--color-text-warning': primitives.yellow[400],
    '--color-text-error': primitives.red[400],
    '--color-text-info': primitives.blue[400],

    // Background colors - darker shades
    '--color-bg-primary': primitives.gray[950],
    '--color-bg-secondary': primitives.gray[900],
    '--color-bg-tertiary': primitives.gray[800],
    '--color-bg-inverse': primitives.gray[50],
    '--color-bg-elevated': primitives.gray[900],
    '--color-bg-overlay': 'rgba(0, 0, 0, 0.75)',
    '--color-bg-hover': primitives.gray[800],
    '--color-bg-selected': primitives.blue[900],

    // Border colors - medium-dark shades for visibility
    '--color-border-default': primitives.gray[700],
    '--color-border-subtle': primitives.gray[800],
    '--color-border-strong': primitives.gray[600],
    '--color-border-focus': primitives.blue[500],
    '--color-border-error': primitives.red[700],

    // Interactive colors - vibrant for visibility
    '--color-interactive-default': primitives.blue[500],
    '--color-interactive-hover': primitives.blue[400],
    '--color-interactive-active': primitives.blue[600],
    '--color-interactive-disabled': primitives.gray[700],
    '--color-interactive-subtle': primitives.gray[800],
    '--color-interactive-subtle-hover': primitives.gray[700],

    // Status colors - adjusted for dark backgrounds
    '--color-status-success': primitives.green[500],
    '--color-status-success-bg': primitives.green[900],
    '--color-status-warning': primitives.yellow[500],
    '--color-status-warning-bg': primitives.yellow[900],
    '--color-status-error': primitives.red[500],
    '--color-status-error-bg': primitives.red[900],
    '--color-status-info': primitives.blue[500],
    '--color-status-info-bg': primitives.blue[900],

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

  // Shadows - more pronounced for dark theme
  shadows: {
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.5)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)',
    '--shadow-lg':
      '0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)',
    '--shadow-xl':
      '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
    '--shadow-2xl': '0 25px 50px -12px rgb(0 0 0 / 0.75)',
    '--shadow-inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.5)',
  },
} as const;

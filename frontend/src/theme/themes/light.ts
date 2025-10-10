/**
 * Light Theme Definition
 *
 * Maps semantic token names to actual color values for the light theme.
 * These CSS variables are applied to :root when light theme is active.
 */

import { primitives } from '../tokens/primitives';

export const lightTheme = {
  colors: {
    // Text colors
    '--color-text-primary': primitives.gray[900],
    '--color-text-secondary': primitives.gray[700],
    '--color-text-tertiary': primitives.gray[600],
    '--color-text-inverse': primitives.gray[50],
    '--color-text-disabled': primitives.gray[400],
    '--color-text-link': primitives.blue[600],
    '--color-text-link-hover': primitives.blue[700],
    '--color-text-success': primitives.green[700],
    '--color-text-warning': primitives.yellow[700],
    '--color-text-error': primitives.red[700],
    '--color-text-info': primitives.blue[700],

    // Background colors
    '--color-bg-primary': '#ffffff',
    '--color-bg-secondary': primitives.gray[50],
    '--color-bg-tertiary': primitives.gray[100],
    '--color-bg-inverse': primitives.gray[900],
    '--color-bg-elevated': '#ffffff',
    '--color-bg-overlay': 'rgba(0, 0, 0, 0.5)',
    '--color-bg-hover': primitives.gray[50],
    '--color-bg-selected': primitives.blue[50],

    // Border colors
    '--color-border-default': primitives.gray[200],
    '--color-border-subtle': primitives.gray[100],
    '--color-border-strong': primitives.gray[300],
    '--color-border-focus': primitives.blue[500],
    '--color-border-error': primitives.red[300],

    // Interactive colors
    '--color-interactive-default': primitives.blue[600],
    '--color-interactive-hover': primitives.blue[700],
    '--color-interactive-active': primitives.blue[800],
    '--color-interactive-disabled': primitives.gray[300],
    '--color-interactive-subtle': primitives.gray[100],
    '--color-interactive-subtle-hover': primitives.gray[200],

    // Status colors
    '--color-status-success': primitives.green[600],
    '--color-status-success-bg': primitives.green[50],
    '--color-status-warning': primitives.yellow[600],
    '--color-status-warning-bg': primitives.yellow[50],
    '--color-status-error': primitives.red[600],
    '--color-status-error-bg': primitives.red[50],
    '--color-status-info': primitives.blue[600],
    '--color-status-info-bg': primitives.blue[50],

    // Brand colors
    '--color-brand-primary': primitives.blue[600],
    '--color-brand-primary-hover': primitives.blue[700],
    '--color-brand-secondary': primitives.purple[600],
  },

  // Typography
  typography: {
    '--font-family-sans':
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    '--font-family-mono':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  // Shadows
  shadows: {
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg':
      '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '--shadow-xl':
      '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '--shadow-2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    '--shadow-inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },
} as const;

/**
 * Type for theme structure
 */
export type Theme = typeof lightTheme;

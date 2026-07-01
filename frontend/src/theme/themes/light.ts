/**
 * Light Theme Definition
 *
 * Professional, refined color palette with excellent contrast and modern aesthetics.
 * Uses slate tones for a sophisticated, polished appearance.
 */

import { primitives } from '../tokens/primitives';

export const lightTheme = {
  colors: {
    // Text colors - refined hierarchy with better contrast
    '--color-text-primary': primitives.gray[900],      // Deep slate for primary text
    '--color-text-secondary': primitives.gray[600],    // Medium slate for secondary
    '--color-text-tertiary': primitives.gray[500],     // Lighter slate for tertiary
    '--color-text-inverse': primitives.gray[50],
    '--color-text-disabled': primitives.gray[400],
    '--color-text-link': primitives.blue[600],
    '--color-text-link-hover': primitives.blue[700],
    '--color-text-success': primitives.green[700],
    '--color-text-warning': primitives.yellow[700],
    '--color-text-error': primitives.red[700],
    '--color-text-info': primitives.blue[700],

    // Background colors - subtle elevation through refined grays
    '--color-bg-primary': primitives.gray[50],          // Very light gray base for less eye strain
    '--color-bg-secondary': '#ffffff',                  // Pure white for cards
    '--color-bg-tertiary': primitives.gray[100],        // Slightly more visible
    '--color-bg-inverse': primitives.gray[900],
    '--color-bg-elevated': '#ffffff',                   // Cards/modals stay white
    '--color-bg-overlay': 'rgba(15, 23, 42, 0.6)',     // Slate overlay
    '--color-bg-hover': primitives.gray[100],          // Slightly stronger hover
    '--color-bg-selected': primitives.blue[50],

    // Border colors - refined contrast
    '--color-border-default': primitives.gray[200],    // Clean, visible borders
    '--color-border-subtle': primitives.gray[100],     // Very subtle dividers
    '--color-border-strong': primitives.gray[300],     // Emphasized borders
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

  // Shadows - refined and professional with subtle depth
  shadows: {
    '--shadow-sm': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
    '--shadow-md': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    '--shadow-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    '--shadow-xl': '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    '--shadow-2xl': '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)',
    '--shadow-inner': 'inset 0 2px 4px 0 rgba(15, 23, 42, 0.06)',
  },
} as const;

/**
 * Type for theme structure. Declared structurally (not `typeof lightTheme`)
 * so other themes (e.g. dark.ts) can use different color values for the
 * same CSS variable keys, rather than being locked to light theme's literals.
 */
export type Theme = {
  colors: Record<keyof typeof lightTheme.colors, string>;
  typography: Record<keyof typeof lightTheme.typography, string>;
  shadows: Record<keyof typeof lightTheme.shadows, string>;
};

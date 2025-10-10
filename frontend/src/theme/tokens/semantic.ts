/**
 * Semantic Tokens
 *
 * These tokens map to CSS variables and provide semantic meaning.
 * They reference the primitive colors but give purpose-based names.
 *
 * Usage:
 * - Use these in your components instead of primitive colors
 * - The actual values are set by the theme (light/dark)
 */

export const semanticTokens = {
  colors: {
    // Text colors - for all text content
    text: {
      primary: 'var(--color-text-primary)',       // Main text, headings
      secondary: 'var(--color-text-secondary)',   // Supporting text, labels
      tertiary: 'var(--color-text-tertiary)',     // Muted text, placeholders
      inverse: 'var(--color-text-inverse)',       // Text on dark backgrounds
      disabled: 'var(--color-text-disabled)',     // Disabled state text
      link: 'var(--color-text-link)',             // Link text
      linkHover: 'var(--color-text-link-hover)',  // Link hover state
      success: 'var(--color-text-success)',       // Success message text
      warning: 'var(--color-text-warning)',       // Warning message text
      error: 'var(--color-text-error)',           // Error message text
      info: 'var(--color-text-info)',             // Info message text
    },

    // Background colors - for surfaces and containers
    background: {
      primary: 'var(--color-bg-primary)',         // Main page background
      secondary: 'var(--color-bg-secondary)',     // Secondary surfaces (cards)
      tertiary: 'var(--color-bg-tertiary)',       // Tertiary surfaces (hover states)
      inverse: 'var(--color-bg-inverse)',         // Inverse backgrounds
      elevated: 'var(--color-bg-elevated)',       // Modals, popovers, dropdowns
      overlay: 'var(--color-bg-overlay)',         // Modal overlay, backdrop
      hover: 'var(--color-bg-hover)',             // Hover state for rows/items
      selected: 'var(--color-bg-selected)',       // Selected state for rows/items
    },

    // Border colors - for dividers and outlines
    border: {
      default: 'var(--color-border-default)',     // Default borders
      subtle: 'var(--color-border-subtle)',       // Subtle dividers
      strong: 'var(--color-border-strong)',       // Emphasized borders
      focus: 'var(--color-border-focus)',         // Focus rings
      error: 'var(--color-border-error)',         // Error state borders
    },

    // Interactive colors - for buttons, links, and interactive elements
    interactive: {
      default: 'var(--color-interactive-default)',     // Default button/link color
      hover: 'var(--color-interactive-hover)',         // Hover state
      active: 'var(--color-interactive-active)',       // Active/pressed state
      disabled: 'var(--color-interactive-disabled)',   // Disabled state
      subtle: 'var(--color-interactive-subtle)',       // Subtle interactive elements
      subtleHover: 'var(--color-interactive-subtle-hover)', // Subtle hover
    },

    // Status colors - for alerts, badges, and status indicators
    status: {
      success: 'var(--color-status-success)',     // Success states
      successBg: 'var(--color-status-success-bg)', // Success background
      warning: 'var(--color-status-warning)',     // Warning states
      warningBg: 'var(--color-status-warning-bg)', // Warning background
      error: 'var(--color-status-error)',         // Error states
      errorBg: 'var(--color-status-error-bg)',     // Error background
      info: 'var(--color-status-info)',           // Info states
      infoBg: 'var(--color-status-info-bg)',       // Info background
    },

    // Brand colors - for branding elements
    brand: {
      primary: 'var(--color-brand-primary)',       // Primary brand color
      primaryHover: 'var(--color-brand-primary-hover)', // Primary hover
      secondary: 'var(--color-brand-secondary)',   // Secondary brand color
    },
  },

  // Spacing tokens - consistent spacing scale
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
    '4xl': '6rem',    // 96px
  },

  // Typography tokens
  typography: {
    fontFamily: {
      sans: 'var(--font-family-sans)',
      mono: 'var(--font-family-mono)',
    },
    fontSize: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  // Shadow tokens
  shadows: {
    none: 'none',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
    '2xl': 'var(--shadow-2xl)',
    inner: 'var(--shadow-inner)',
  },

  // Border radius tokens
  radii: {
    none: '0',
    sm: '0.125rem',    // 2px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px',
  },

  // Z-index scale
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
} as const;

/**
 * Type helpers for semantic tokens
 */
export type TextColor = keyof typeof semanticTokens.colors.text;
export type BackgroundColor = keyof typeof semanticTokens.colors.background;
export type BorderColor = keyof typeof semanticTokens.colors.border;
export type StatusColor = keyof typeof semanticTokens.colors.status;

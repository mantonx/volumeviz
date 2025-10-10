import { semanticTokens } from './src/theme/tokens/semantic';

export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './.storybook/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Semantic color tokens
      colors: {
        // Text colors
        text: {
          primary: semanticTokens.colors.text.primary,
          secondary: semanticTokens.colors.text.secondary,
          tertiary: semanticTokens.colors.text.tertiary,
          inverse: semanticTokens.colors.text.inverse,
          disabled: semanticTokens.colors.text.disabled,
          link: semanticTokens.colors.text.link,
          'link-hover': semanticTokens.colors.text.linkHover,
          success: semanticTokens.colors.text.success,
          warning: semanticTokens.colors.text.warning,
          error: semanticTokens.colors.text.error,
          info: semanticTokens.colors.text.info,
        },

        // Background colors
        background: {
          primary: semanticTokens.colors.background.primary,
          secondary: semanticTokens.colors.background.secondary,
          tertiary: semanticTokens.colors.background.tertiary,
          inverse: semanticTokens.colors.background.inverse,
          elevated: semanticTokens.colors.background.elevated,
          overlay: semanticTokens.colors.background.overlay,
          hover: semanticTokens.colors.background.hover,
          selected: semanticTokens.colors.background.selected,
        },

        // Border colors
        border: {
          DEFAULT: semanticTokens.colors.border.default,
          subtle: semanticTokens.colors.border.subtle,
          strong: semanticTokens.colors.border.strong,
          focus: semanticTokens.colors.border.focus,
          error: semanticTokens.colors.border.error,
        },

        // Interactive colors
        interactive: {
          DEFAULT: semanticTokens.colors.interactive.default,
          hover: semanticTokens.colors.interactive.hover,
          active: semanticTokens.colors.interactive.active,
          disabled: semanticTokens.colors.interactive.disabled,
          subtle: semanticTokens.colors.interactive.subtle,
          'subtle-hover': semanticTokens.colors.interactive.subtleHover,
        },

        // Status colors
        status: {
          success: semanticTokens.colors.status.success,
          'success-bg': semanticTokens.colors.status.successBg,
          warning: semanticTokens.colors.status.warning,
          'warning-bg': semanticTokens.colors.status.warningBg,
          error: semanticTokens.colors.status.error,
          'error-bg': semanticTokens.colors.status.errorBg,
          info: semanticTokens.colors.status.info,
          'info-bg': semanticTokens.colors.status.infoBg,
        },

        // Brand colors
        brand: {
          primary: semanticTokens.colors.brand.primary,
          'primary-hover': semanticTokens.colors.brand.primaryHover,
          secondary: semanticTokens.colors.brand.secondary,
        },
      },

      // Spacing scale
      spacing: semanticTokens.spacing,

      // Typography
      fontSize: semanticTokens.typography.fontSize,
      fontWeight: semanticTokens.typography.fontWeight,
      lineHeight: semanticTokens.typography.lineHeight,
      fontFamily: {
        sans: semanticTokens.typography.fontFamily.sans,
        mono: semanticTokens.typography.fontFamily.mono,
      },

      // Shadows
      boxShadow: semanticTokens.shadows,

      // Border radius
      borderRadius: semanticTokens.radii,

      // Z-index scale
      zIndex: semanticTokens.zIndex,
    },
  },
  plugins: [],
};

# Design Token Implementation Plan
## Proper Dark & Light Mode System for VolumeViz

**Date**: October 10, 2025
**Status**: Planning Phase
**Priority**: High

---

## Executive Summary

This document outlines a comprehensive plan to implement a proper design token system for VolumeViz, replacing the current ad-hoc approach of hardcoded Tailwind classes with a centralized, maintainable theme system.

### Current State Analysis

**Findings from Research:**
- ✅ Theme atoms already exist (`frontend/src/atoms/theme/`)
- ✅ Basic theme types defined (`'light' | 'dark' | 'system'`)
- ✅ Jotai atoms for theme management with localStorage persistence
- ⚠️ **1,911 instances** of `dark:` classes across 110 files (ad-hoc implementation)
- ⚠️ No centralized design token system
- ⚠️ Tailwind config has minimal customization
- ⚠️ Inconsistent color usage (some components use `gray-500`, others `gray-600`, etc.)
- ⚠️ No semantic color naming (e.g., `--color-text-primary`)

### Problems with Current Approach

1. **Maintainability**: Changing a color requires finding/replacing across hundreds of files
2. **Consistency**: Different developers use different gray shades for similar purposes
3. **Accessibility**: No centralized way to ensure WCAG contrast ratios
4. **Theming**: Cannot easily add new themes (e.g., high contrast, custom brand themes)
5. **Performance**: Tailwind dark mode classes increase bundle size
6. **Developer Experience**: Hard to know which color to use for a specific purpose

---

## Proposed Solution: Design Token System

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Design Token System                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────┐         ┌─────────────────┐        │
│  │ Token Definitions│         │ Theme Provider  │        │
│  │                  │────────▶│                 │        │
│  │ - Primitives     │         │ - Light theme   │        │
│  │ - Semantic       │         │ - Dark theme    │        │
│  │ - Component      │         │ - System detect │        │
│  └────────────────┘         └─────────────────┘        │
│                                      │                   │
│                                      ▼                   │
│                          ┌──────────────────────┐       │
│                          │   CSS Variables      │       │
│                          │   (Runtime theming)  │       │
│                          └──────────────────────┘       │
│                                      │                   │
│                                      ▼                   │
│                          ┌──────────────────────┐       │
│                          │    Components        │       │
│                          │  (Use semantic tokens)│       │
│                          └──────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Token Definition & Infrastructure (Week 1)

### 1.1 Define Primitive Tokens

Create base color palette that doesn't change between themes.

**File**: `frontend/src/theme/tokens/primitives.ts`

```typescript
export const primitives = {
  // Brand colors (consistent across themes)
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // Primary brand color
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral palette
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },

  // Semantic colors
  red: { /* error states */ },
  green: { /* success states */ },
  yellow: { /* warning states */ },
  orange: { /* info states */ },
};
```

### 1.2 Define Semantic Tokens

Map primitive tokens to semantic purposes.

**File**: `frontend/src/theme/tokens/semantic.ts`

```typescript
export const semanticTokens = {
  colors: {
    // Text colors
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary: 'var(--color-text-tertiary)',
      inverse: 'var(--color-text-inverse)',
      disabled: 'var(--color-text-disabled)',
      link: 'var(--color-text-link)',
      linkHover: 'var(--color-text-link-hover)',
    },

    // Background colors
    background: {
      primary: 'var(--color-bg-primary)',
      secondary: 'var(--color-bg-secondary)',
      tertiary: 'var(--color-bg-tertiary)',
      inverse: 'var(--color-bg-inverse)',
      elevated: 'var(--color-bg-elevated)',
      overlay: 'var(--color-bg-overlay)',
    },

    // Border colors
    border: {
      default: 'var(--color-border-default)',
      subtle: 'var(--color-border-subtle)',
      strong: 'var(--color-border-strong)',
      focus: 'var(--color-border-focus)',
    },

    // Interactive states
    interactive: {
      default: 'var(--color-interactive-default)',
      hover: 'var(--color-interactive-hover)',
      active: 'var(--color-interactive-active)',
      disabled: 'var(--color-interactive-disabled)',
    },

    // Status colors
    status: {
      success: 'var(--color-status-success)',
      warning: 'var(--color-status-warning)',
      error: 'var(--color-status-error)',
      info: 'var(--color-status-info)',
    },
  },

  // Spacing tokens
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Typography tokens
  typography: {
    fontFamily: {
      sans: 'var(--font-family-sans)',
      mono: 'var(--font-family-mono)',
    },
    fontSize: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
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
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },

  // Border radius tokens
  radii: {
    none: '0',
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
};
```

### 1.3 Create Theme Definitions

Map semantic tokens to CSS variables for each theme.

**File**: `frontend/src/theme/themes/light.ts`

```typescript
import { primitives } from '../tokens/primitives';

export const lightTheme = {
  colors: {
    // Text
    '--color-text-primary': primitives.gray[900],
    '--color-text-secondary': primitives.gray[700],
    '--color-text-tertiary': primitives.gray[600],
    '--color-text-inverse': primitives.gray[50],
    '--color-text-disabled': primitives.gray[400],
    '--color-text-link': primitives.blue[600],
    '--color-text-link-hover': primitives.blue[700],

    // Background
    '--color-bg-primary': '#ffffff',
    '--color-bg-secondary': primitives.gray[50],
    '--color-bg-tertiary': primitives.gray[100],
    '--color-bg-inverse': primitives.gray[900],
    '--color-bg-elevated': '#ffffff',
    '--color-bg-overlay': 'rgba(0, 0, 0, 0.5)',

    // Border
    '--color-border-default': primitives.gray[200],
    '--color-border-subtle': primitives.gray[100],
    '--color-border-strong': primitives.gray[300],
    '--color-border-focus': primitives.blue[500],

    // Interactive
    '--color-interactive-default': primitives.blue[500],
    '--color-interactive-hover': primitives.blue[600],
    '--color-interactive-active': primitives.blue[700],
    '--color-interactive-disabled': primitives.gray[300],

    // Status
    '--color-status-success': primitives.green[500],
    '--color-status-warning': primitives.yellow[500],
    '--color-status-error': primitives.red[500],
    '--color-status-info': primitives.blue[500],
  },

  shadows: {
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },
};
```

**File**: `frontend/src/theme/themes/dark.ts`

```typescript
import { primitives } from '../tokens/primitives';

export const darkTheme = {
  colors: {
    // Text
    '--color-text-primary': primitives.gray[50],
    '--color-text-secondary': primitives.gray[300],
    '--color-text-tertiary': primitives.gray[400],
    '--color-text-inverse': primitives.gray[900],
    '--color-text-disabled': primitives.gray[600],
    '--color-text-link': primitives.blue[400],
    '--color-text-link-hover': primitives.blue[300],

    // Background
    '--color-bg-primary': primitives.gray[950],
    '--color-bg-secondary': primitives.gray[900],
    '--color-bg-tertiary': primitives.gray[800],
    '--color-bg-inverse': primitives.gray[50],
    '--color-bg-elevated': primitives.gray[900],
    '--color-bg-overlay': 'rgba(0, 0, 0, 0.75)',

    // Border
    '--color-border-default': primitives.gray[700],
    '--color-border-subtle': primitives.gray[800],
    '--color-border-strong': primitives.gray[600],
    '--color-border-focus': primitives.blue[500],

    // Interactive
    '--color-interactive-default': primitives.blue[500],
    '--color-interactive-hover': primitives.blue[400],
    '--color-interactive-active': primitives.blue[600],
    '--color-interactive-disabled': primitives.gray[700],

    // Status
    '--color-status-success': primitives.green[400],
    '--color-status-warning': primitives.yellow[400],
    '--color-status-error': primitives.red[400],
    '--color-status-info': primitives.blue[400],
  },

  shadows: {
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.5)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.5)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.5)',
    '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.5)',
  },
};
```

### 1.4 Update Tailwind Configuration

Extend Tailwind to use our design tokens.

**File**: `frontend/@tailwind.config.js`

```javascript
import { semanticTokens } from './src/theme/tokens/semantic';

export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './.storybook/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic color tokens
        text: {
          primary: semanticTokens.colors.text.primary,
          secondary: semanticTokens.colors.text.secondary,
          tertiary: semanticTokens.colors.text.tertiary,
          inverse: semanticTokens.colors.text.inverse,
          disabled: semanticTokens.colors.text.disabled,
          link: semanticTokens.colors.text.link,
          'link-hover': semanticTokens.colors.text.linkHover,
        },
        background: {
          primary: semanticTokens.colors.background.primary,
          secondary: semanticTokens.colors.background.secondary,
          tertiary: semanticTokens.colors.background.tertiary,
          inverse: semanticTokens.colors.background.inverse,
          elevated: semanticTokens.colors.background.elevated,
          overlay: semanticTokens.colors.background.overlay,
        },
        border: {
          DEFAULT: semanticTokens.colors.border.default,
          subtle: semanticTokens.colors.border.subtle,
          strong: semanticTokens.colors.border.strong,
          focus: semanticTokens.colors.border.focus,
        },
        interactive: {
          DEFAULT: semanticTokens.colors.interactive.default,
          hover: semanticTokens.colors.interactive.hover,
          active: semanticTokens.colors.interactive.active,
          disabled: semanticTokens.colors.interactive.disabled,
        },
        status: {
          success: semanticTokens.colors.status.success,
          warning: semanticTokens.colors.status.warning,
          error: semanticTokens.colors.status.error,
          info: semanticTokens.colors.status.info,
        },
      },
      spacing: semanticTokens.spacing,
      fontSize: semanticTokens.typography.fontSize,
      fontWeight: semanticTokens.typography.fontWeight,
      lineHeight: semanticTokens.typography.lineHeight,
      boxShadow: semanticTokens.shadows,
      borderRadius: semanticTokens.radii,
    },
  },
  plugins: [],
};
```

---

## Phase 2: Theme Provider Implementation (Week 2)

### 2.1 Create Theme Provider Component

**File**: `frontend/src/providers/theme/ThemeProvider.tsx`

```typescript
import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { themeAtom, resolvedThemeAtom } from '@/atoms/theme/theme.atoms';
import { lightTheme } from '@/theme/themes/light';
import { darkTheme } from '@/theme/themes/dark';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme] = useAtom(themeAtom);
  const [resolvedTheme] = useAtom(resolvedThemeAtom);

  useEffect(() => {
    // Apply theme CSS variables to :root
    const root = document.documentElement;
    const themeVars = resolvedTheme === 'dark' ? darkTheme : lightTheme;

    // Apply color variables
    Object.entries(themeVars.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply shadow variables
    Object.entries(themeVars.shadows).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Toggle dark class on root element for Tailwind
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Listen for system theme changes when theme is set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Trigger re-render by forcing theme atom update
      // (This is handled by the resolvedThemeAtom computed atom)
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
};
```

### 2.2 Create useTheme Hook

**File**: `frontend/src/hooks/useTheme.ts`

```typescript
import { useAtom } from 'jotai';
import { themeAtom, resolvedThemeAtom } from '@/atoms/theme/theme.atoms';
import type { Theme, ResolvedTheme } from '@/atoms/theme/theme.types';

export const useTheme = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  const [resolvedTheme] = useAtom(resolvedThemeAtom);

  return {
    theme,           // 'light' | 'dark' | 'system'
    resolvedTheme,   // 'light' | 'dark'
    setTheme,        // (theme: Theme) => void
    isLight: resolvedTheme === 'light',
    isDark: resolvedTheme === 'dark',
  };
};
```

### 2.3 Create Theme Toggle Component

**File**: `frontend/src/components/ui/ThemeToggle/ThemeToggle.tsx`

```typescript
import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const;

  return (
    <div className="flex gap-1 p-1 bg-background-secondary rounded-lg">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
            transition-colors
            ${theme === value
              ? 'bg-background-primary text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
            }
          `}
          aria-label={`Switch to ${label} theme`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};
```

---

## Phase 3: Component Migration Strategy (Weeks 3-4)

### 3.1 Create Migration Guide

**File**: `docs/projects/THEME_MIGRATION_GUIDE.md`

#### Before (Old Approach)
```tsx
// ❌ Hardcoded Tailwind classes
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <h1 className="text-gray-900 dark:text-white">Title</h1>
  <p className="text-gray-500 dark:text-gray-400">Description</p>
</div>
```

#### After (Design Token Approach)
```tsx
// ✅ Semantic token classes
<div className="bg-background-primary text-text-primary">
  <h1 className="text-text-primary">Title</h1>
  <p className="text-text-secondary">Description</p>
</div>
```

### 3.2 Component Migration Priority List

**High Priority** (User-facing, frequently used):
1. ✅ VolumeTable (already started)
2. Header/Navigation
3. Sidebar
4. Dashboard cards
5. Modal components
6. Form inputs
7. Buttons

**Medium Priority**:
8. Charts and visualizations
9. File explorer
10. Search components
11. Alert components

**Low Priority**:
12. Storybook stories
13. Test fixtures
14. Admin pages

### 3.3 Automated Migration Tool

Create a codemod to assist with migration:

**File**: `scripts/migrate-to-tokens.js`

```javascript
// Simple find/replace patterns
const migrations = [
  // Text colors
  { from: /text-gray-900 dark:text-white/g, to: 'text-text-primary' },
  { from: /text-gray-700 dark:text-gray-200/g, to: 'text-text-secondary' },
  { from: /text-gray-500 dark:text-gray-400/g, to: 'text-text-tertiary' },

  // Backgrounds
  { from: /bg-white dark:bg-gray-900/g, to: 'bg-background-primary' },
  { from: /bg-gray-50 dark:bg-gray-800/g, to: 'bg-background-secondary' },

  // Borders
  { from: /border-gray-200 dark:border-gray-700/g, to: 'border-border' },

  // ... more patterns
];
```

---

## Phase 4: Testing & Quality Assurance (Week 5)

### 4.1 Visual Regression Testing

- Take screenshots of all major pages in both themes
- Compare before/after migration
- Use tools like Percy or Chromatic

### 4.2 Accessibility Testing

- Verify WCAG 2.1 AA contrast ratios
- Test with screen readers
- Keyboard navigation testing

### 4.3 Performance Testing

- Measure bundle size impact
- CSS variable performance in different browsers
- Theme switching performance

---

## Phase 5: Documentation & Training (Week 6)

### 5.1 Developer Documentation

Create comprehensive docs:
- Token naming conventions
- How to add new tokens
- When to use which token
- Common patterns and examples

### 5.2 Design Documentation

- Color palette reference
- Accessibility guidelines
- Dark mode best practices

### 5.3 Migration Training

- Team walkthrough session
- Code review guidelines
- Q&A and troubleshooting

---

## Success Metrics

1. **Consistency**: All components use semantic tokens
2. **Performance**: No significant bundle size increase
3. **Accessibility**: All text meets WCAG AA contrast requirements
4. **Maintainability**: Can change entire color scheme in <30 minutes
5. **Developer Experience**: Developers report easier theming workflow

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing components | High | Gradual migration, comprehensive testing |
| Performance regression | Medium | Monitor bundle size, optimize CSS variables |
| Team adoption resistance | Medium | Clear documentation, training sessions |
| Third-party library conflicts | Low | Test integrations early |

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Token Definition | Week 1 | Complete token system, Tailwind config |
| Phase 2: Provider Implementation | Week 2 | ThemeProvider, useTheme hook, Toggle component |
| Phase 3: Component Migration | Weeks 3-4 | Migrate all components |
| Phase 4: Testing & QA | Week 5 | Pass all tests, accessibility audit |
| Phase 5: Documentation | Week 6 | Complete docs, training materials |

**Total Duration**: 6 weeks

---

## Future Enhancements

After initial implementation:
- [ ] Add high-contrast theme for accessibility
- [ ] Add custom brand themes (for white-label deployments)
- [ ] Implement theme preview in settings
- [ ] Add component-specific theming (e.g., chart colors)
- [ ] Create Figma plugin for design-to-code workflow

---

## References

- [Design Tokens Community Group](https://www.designtokens.org/)
- [Tailwind CSS Theming Guide](https://tailwindcss.com/docs/theme)
- [Material Design Token System](https://m3.material.io/foundations/design-tokens/overview)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

**Next Steps**: Review this plan with the team and get approval to proceed with Phase 1.

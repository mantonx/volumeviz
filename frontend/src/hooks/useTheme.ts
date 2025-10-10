/**
 * useTheme Hook
 *
 * Provides access to theme state and control.
 * Wraps the existing Jotai theme atoms for convenient use in components.
 */

import { useAtom } from 'jotai';
import { themeAtom, resolvedThemeAtom } from '@/atoms/theme/theme.atoms';
import type { Theme, ResolvedTheme } from '@/atoms/theme/theme.types';

interface UseThemeReturn {
  /** Current theme setting ('light' | 'dark' | 'system') */
  theme: Theme;
  /** Resolved theme ('light' | 'dark') - what's actually applied */
  resolvedTheme: ResolvedTheme;
  /** Function to change the theme */
  setTheme: (theme: Theme) => void;
  /** True if the resolved theme is light */
  isLight: boolean;
  /** True if the resolved theme is dark */
  isDark: boolean;
  /** True if theme is set to follow system preference */
  isSystem: boolean;
}

/**
 * Hook to access and control the application theme.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, isDark } = useTheme();
 *
 *   return (
 *     <button onClick={() => setTheme(isDark ? 'light' : 'dark')}>
 *       Toggle theme
 *     </button>
 *   );
 * }
 * ```
 */
export const useTheme = (): UseThemeReturn => {
  const [theme, setTheme] = useAtom(themeAtom);
  const [resolvedTheme] = useAtom(resolvedThemeAtom);

  return {
    theme,
    resolvedTheme,
    setTheme,
    isLight: resolvedTheme === 'light',
    isDark: resolvedTheme === 'dark',
    isSystem: theme === 'system',
  };
};

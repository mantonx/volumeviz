/**
 * ThemeProvider Component
 *
 * Manages theme state and applies CSS variables to the document root.
 * Integrates with existing Jotai theme atoms for state management.
 */

import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import { themeAtom, resolvedThemeAtom } from '@/atoms/theme/theme.atoms';
import { lightTheme } from '@/theme/themes/light';
import { darkTheme } from '@/theme/themes/dark';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme] = useAtom(themeAtom);
  const [resolvedTheme] = useAtom(resolvedThemeAtom);

  // Apply theme CSS variables to :root
  useEffect(() => {
    const root = document.documentElement;
    const themeVars = resolvedTheme === 'dark' ? darkTheme : lightTheme;

    // Apply color variables
    Object.entries(themeVars.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply typography variables
    Object.entries(themeVars.typography).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply shadow variables
    Object.entries(themeVars.shadows).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Toggle dark class on root element for Tailwind's dark mode
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Log theme change for debugging
    console.log(`[Theme] Applied ${resolvedTheme} theme`);
  }, [resolvedTheme]);

  // Listen for system theme changes when theme is set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      console.log(
        `[Theme] System preference changed to ${e.matches ? 'dark' : 'light'}`,
      );
      // The resolvedThemeAtom will automatically update based on system preference
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
};

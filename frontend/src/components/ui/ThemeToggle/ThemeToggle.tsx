/**
 * ThemeToggle Component
 *
 * A segmented control for switching between light, dark, and system themes.
 * Integrates with the useTheme hook for state management.
 */

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/atoms/theme/theme.types';

interface ThemeOption {
  value: Theme;
  icon: typeof Sun;
  label: string;
}

const themeOptions: ThemeOption[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

interface ThemeToggleProps {
  /** Show labels next to icons */
  showLabels?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showLabels = true,
  size = 'md',
}) => {
  const { theme, setTheme } = useTheme();

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className="flex gap-1 p-1 bg-background-secondary rounded-lg border border-border-subtle"
      role="radiogroup"
      aria-label="Theme selection"
    >
      {themeOptions.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`
            flex items-center gap-2 rounded-md font-medium
            transition-all duration-200
            ${sizeClasses[size]}
            ${
              theme === value
                ? 'bg-background-primary text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
            }
          `}
          aria-label={`Switch to ${label} theme`}
          aria-checked={theme === value}
          role="radio"
        >
          <Icon className={iconSizes[size]} />
          {showLabels && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
};

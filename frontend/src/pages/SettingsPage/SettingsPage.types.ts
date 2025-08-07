/**
 * Available theme options for VolumeViz application.
 *
 * - light: Force light theme regardless of system preference
 * - dark: Force dark theme regardless of system preference
 * - system: Follow system/browser theme preference automatically
 */
export type ThemeOption = 'light' | 'dark' | 'system';

/**
 * Props for the SettingsPage component.
 *
 * Currently the SettingsPage doesn't require any props as it manages
 * its own state through Jotai atoms for persistent storage.
 */
export interface SettingsPageProps {
  // No props required currently - future extensibility placeholder
}

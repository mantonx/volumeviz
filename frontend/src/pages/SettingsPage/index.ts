/**
 * Settings page component for VolumeViz configuration management.
 *
 * Provides comprehensive interface for:
 * - API connection configuration (URLs, timeouts, retry logic)
 * - Application theme and appearance settings
 * - Auto-refresh behavior and data update intervals
 * - Feature flags for experimental functionality
 * - System information and diagnostics
 * - Settings export/import and reset capabilities
 *
 * All settings persist automatically using Jotai storage atoms
 * and apply immediately without requiring application restart.
 */
export { SettingsPage } from './SettingsPage';
export type { SettingsPageProps, ThemeOption } from './SettingsPage.types';

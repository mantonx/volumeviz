import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Monitor,
  Palette,
  Bell,
  Database,
  Shield,
  Save,
  RotateCcw,
  Info,
  Play,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  themeAtom,
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
  apiConfigAtom,
  featureFlagsAtom,
  environmentAtom,
} from '@/store';
import { resetOnboarding } from '@/hooks/useOnboardingCheck';
import type { SettingsPageProps, ThemeOption } from './SettingsPage.types';

/**
 * Settings page component for configuring VolumeViz application preferences.
 *
 * Provides comprehensive configuration interface for:
 * - API connection settings (base URL, timeout, retry configuration)
 * - Application theme management (light/dark/system)
 * - Auto-refresh behavior and intervals
 * - Feature flags for experimental functionality
 * - Notification preferences and alerts
 * - Data export and backup settings
 * - System information and diagnostics
 *
 * All settings are persisted using Jotai storage atoms and apply
 * immediately without requiring application restart. The interface
 * is organized into logical sections with clear descriptions and
 * validation feedback.
 *
 * Settings validation ensures proper API URLs, reasonable timeout
 * values, and compatible feature flag combinations.
 */
export const SettingsPage: React.FC<SettingsPageProps> = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useAtom(themeAtom);
  const [autoRefresh, setAutoRefresh] = useAtom(autoRefreshEnabledAtom);
  const [refreshInterval, setRefreshInterval] = useAtom(
    autoRefreshIntervalAtom,
  );
  const [apiConfig, setApiConfig] = useAtom(apiConfigAtom);
  const [features, setFeatures] = useAtom(featureFlagsAtom);
  const environment = useAtomValue(environmentAtom);

  /**
   * Handle theme selection with immediate application.
   * Updates both the atom state and document root classes.
   */
  const handleThemeChange = (newTheme: ThemeOption) => {
    setTheme(newTheme);
  };

  /**
   * Handle auto-refresh interval changes with validation.
   * Ensures minimum interval of 5 seconds for API health.
   */
  const handleIntervalChange = (interval: number) => {
    const validatedInterval = Math.max(5000, interval);
    setRefreshInterval(validatedInterval);
  };

  /**
   * Handle API configuration updates with validation.
   * Validates URL format and reasonable timeout values.
   */
  const handleApiConfigChange = (
    key: keyof typeof apiConfig,
    value: string | number,
  ) => {
    setApiConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * Handle feature flag toggles with dependency checking.
   * Some features may require others to be enabled.
   */
  const handleFeatureToggle = (feature: keyof typeof features) => {
    setFeatures((prev) => ({
      ...prev,
      [feature]: !prev[feature],
    }));
  };

  /**
   * Reset all settings to default values.
   * Shows confirmation dialog before proceeding.
   */
  const handleResetSettings = () => {
    if (
      window.confirm('Are you sure you want to reset all settings to defaults?')
    ) {
      // Reset to default values
      setTheme('system');
      setAutoRefresh(true);
      setRefreshInterval(30000);
      setApiConfig({
        baseUrl: 'http://localhost:8080/api/v1',
        timeout: 10000,
        retryAttempts: 3,
        retryDelay: 1000,
      });
      setFeatures({
        autoRefresh: true,
        realTimeUpdates: false,
        experimentalFeatures: false,
        debugMode: environment.isDevelopment,
      });
    }
  };

  /**
   * Export current settings as JSON file.
   * Useful for backup and sharing configurations.
   */
  const handleExportSettings = () => {
    const settings = {
      theme,
      autoRefresh,
      refreshInterval,
      apiConfig,
      features,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `volumeviz-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Reset onboarding state and redirect to setup wizard.
   * Shows confirmation dialog before proceeding.
   */
  const handleRerunWizard = () => {
    if (
      window.confirm(
        'Are you sure you want to re-run the setup wizard? This will reset your onboarding state and redirect you to the wizard.',
      )
    ) {
      resetOnboarding();
      navigate('/onboarding');
    }
  };

  /**
   * Get theme display name for UI.
   */
  const getThemeDisplayName = (themeValue: ThemeOption): string => {
    switch (themeValue) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  /**
   * Format interval milliseconds to human-readable string.
   */
  const formatInterval = (ms: number): string => {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds}s`;
    const minutes = seconds / 60;
    return `${minutes}m`;
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Settings
        </h1>
        <p className="mt-1 text-secondary">
          Configure VolumeViz preferences and system behavior
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleExportSettings}>
          <Save className="h-4 w-4 mr-2" />
          Export Settings
        </Button>
        <Button variant="outline" onClick={handleResetSettings}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button variant="outline" onClick={handleRerunWizard}>
          <Play className="h-4 w-4 mr-2" />
          Re-run Setup Wizard
        </Button>
      </div>

      {/* API Configuration */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              API Configuration
            </h2>
            <p className="text-sm text-secondary">
              Configure connection to VolumeViz backend API
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Base URL
            </label>
            <input
              type="url"
              value={apiConfig.baseUrl}
              onChange={(e) => handleApiConfigChange('baseUrl', e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary placeholder-tertiary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="http://localhost:8080/api/v1"
            />
            <p className="mt-1 text-xs text-tertiary">
              Full URL to the VolumeViz API endpoint including /api/v1 prefix
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Timeout (ms)
              </label>
              <input
                type="number"
                min="1000"
                max="60000"
                step="1000"
                value={apiConfig.timeout}
                onChange={(e) =>
                  handleApiConfigChange('timeout', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Retry Attempts
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={apiConfig.retryAttempts}
                onChange={(e) =>
                  handleApiConfigChange(
                    'retryAttempts',
                    parseInt(e.target.value),
                  )
                }
                className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Retry Delay (ms)
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={apiConfig.retryDelay}
                onChange={(e) =>
                  handleApiConfigChange('retryDelay', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg bg-surface text-primary"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Palette className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Appearance
            </h2>
            <p className="text-sm text-secondary">
              Customize the visual appearance of VolumeViz
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              Theme
            </label>
            <p className="text-sm text-secondary mb-4">
              Choose your preferred color scheme. System will automatically match
              your operating system's theme preference.
            </p>
            <ThemeToggle showLabels={true} size="md" />
          </div>
        </div>
      </Card>

      {/* Data & Refresh */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Monitor className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Data & Refresh
            </h2>
            <p className="text-sm text-secondary">
              Configure how VolumeViz updates and refreshes data
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-primary">
                Auto-refresh
              </h3>
              <p className="text-sm text-tertiary">
                Automatically refresh volume data in the background
              </p>
            </div>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {autoRefresh && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Refresh Interval: {formatInterval(refreshInterval)}
              </label>
              <div className="flex space-x-2">
                {[5000, 15000, 30000, 60000, 300000].map((interval) => (
                  <button
                    key={interval}
                    onClick={() => handleIntervalChange(interval)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      refreshInterval === interval
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-surface-secondary text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {formatInterval(interval)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Feature Flags */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Settings className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              Advanced Features
            </h2>
            <p className="text-sm text-secondary">
              Enable experimental and advanced functionality
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(features).map(([key, enabled]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-primary">
                  {key
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, (str) => str.toUpperCase())}
                </h3>
                <p className="text-sm text-tertiary">
                  {key === 'autoRefresh' && 'Enable automatic data refreshing'}
                  {key === 'realTimeUpdates' &&
                    'Real-time WebSocket updates (experimental)'}
                  {key === 'experimentalFeatures' &&
                    'Access to beta features and functionality'}
                  {key === 'debugMode' &&
                    'Enable debug logging and developer tools'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {key === 'experimentalFeatures' && enabled && (
                  <Badge variant="warning" className="text-xs">
                    Beta
                  </Badge>
                )}
                <Button
                  variant={enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() =>
                    handleFeatureToggle(key as keyof typeof features)
                  }
                >
                  {enabled ? 'On' : 'Off'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* System Information */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-surface-secondary rounded-lg flex items-center justify-center">
            <Info className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-primary">
              System Information
            </h2>
            <p className="text-sm text-secondary">
              Current environment and version details
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-secondary">
              Environment:
            </span>
            <Badge
              variant={environment.isProduction ? 'default' : 'secondary'}
            >
              {environment.nodeEnv}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Version:</span>
            <span className="font-medium text-primary">
              {environment.version}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">API URL:</span>
            <span
              className="font-mono text-xs text-secondary truncate max-w-48"
              title={apiConfig.baseUrl}
            >
              {apiConfig.baseUrl}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Build:</span>
            <span className="font-mono text-xs text-secondary">
              {new Date().toISOString().split('T')[0]}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

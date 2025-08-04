import React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  Settings,
  Monitor,
  Palette,
  Bell,
  Database,
  Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  themeAtom,
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
  apiConfigAtom,
  featureFlagsAtom,
  environmentAtom,
} from '@/store';

export const SettingsPage: React.FC = () => {
  const [theme, setTheme] = useAtom(themeAtom);
  const [autoRefresh, setAutoRefresh] = useAtom(autoRefreshEnabledAtom);
  const [refreshInterval, setRefreshInterval] = useAtom(
    autoRefreshIntervalAtom,
  );
  const [apiConfig] = useAtom(apiConfigAtom);
  const [features, setFeatures] = useAtom(featureFlagsAtom);
  const environment = useAtomValue(environmentAtom);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleIntervalChange = (interval: number) => {
    setRefreshInterval(interval);
  };

  const handleFeatureToggle = (feature: string) => {
    setFeatures((prev) => ({
      ...prev,
      [feature]: !prev[feature],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure VolumeViz preferences and behavior
        </p>
      </div>

      {/* Environment Info */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Monitor className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Environment
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current deployment environment
              </p>
            </div>
          </div>
          <Badge
            variant={environment === 'production' ? 'success' : 'secondary'}
          >
            {environment}
          </Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance Settings */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Palette className="h-6 w-6 text-purple-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Appearance
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customize the look and feel
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Theme
              </label>
              <div className="mt-2 flex space-x-2">
                {(['light', 'dark', 'system'] as const).map((themeOption) => (
                  <Button
                    key={themeOption}
                    variant={theme === themeOption ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleThemeChange(themeOption)}
                    className="capitalize"
                  >
                    {themeOption}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Data & Refresh Settings */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="h-6 w-6 text-green-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Data & Refresh
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Control data fetching behavior
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto Refresh
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically refresh data
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
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Refresh Interval
                </label>
                <div className="mt-2 flex space-x-2">
                  {[10000, 30000, 60000, 300000].map((interval) => (
                    <Button
                      key={interval}
                      variant={
                        refreshInterval === interval ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => handleIntervalChange(interval)}
                    >
                      {interval / 1000}s
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* API Configuration */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="h-6 w-6 text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                API Configuration
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Backend connection settings
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Base URL
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {apiConfig.baseUrl}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Timeout
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {apiConfig.timeout / 1000}s
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Retry Attempts
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {apiConfig.retryAttempts}
              </p>
            </div>
          </div>
        </Card>

        {/* Feature Flags */}
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Shield className="h-6 w-6 text-orange-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Features
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable or disable features
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(features).map(([feature, enabled]) => (
              <div key={feature} className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
                <Button
                  variant={enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFeatureToggle(feature)}
                >
                  {enabled ? 'On' : 'Off'}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Advanced Actions
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reset settings or clear cached data
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" size="sm">
              Clear Cache
            </Button>
            <Button variant="outline" size="sm">
              Reset Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

/**
 * SystemSettingsPage - Admin page for system configuration
 *
 * Features:
 * - Configure system-wide settings
 * - Authentication settings
 * - Storage settings
 * - Notification settings
 * - API settings
 */

import React, { useState, FormEvent } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface SystemSettings {
  // Authentication
  jwtExpirationMinutes: number;
  refreshTokenExpirationDays: number;
  maxLoginAttempts: number;

  // Storage
  maxScanConcurrency: number;
  scanIntervalMinutes: number;
  retentionDays: number;

  // Notifications
  enableEmailNotifications: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;

  // API
  apiRateLimitPerMinute: number;
  enableSwagger: boolean;
  corsAllowedOrigins: string;
}

const defaultSettings: SystemSettings = {
  jwtExpirationMinutes: 60,
  refreshTokenExpirationDays: 7,
  maxLoginAttempts: 5,
  maxScanConcurrency: 3,
  scanIntervalMinutes: 60,
  retentionDays: 90,
  enableEmailNotifications: false,
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUsername: '',
  apiRateLimitPerMinute: 100,
  enableSwagger: true,
  corsAllowedOrigins: '*',
};

export const SystemSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      // TODO: Call API to save settings
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(
    key: K,
    value: SystemSettings[K]
  ) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            System Settings
          </h1>
          <p className="mt-2 text-secondary">
            Configure system-wide settings and preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">Settings saved successfully!</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Authentication Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
              <Settings className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              Authentication
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                JWT Expiration (minutes)
              </label>
              <input
                type="number"
                value={settings.jwtExpirationMinutes}
                onChange={(e) =>
                  updateSetting('jwtExpirationMinutes', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Refresh Token Expiration (days)
              </label>
              <input
                type="number"
                value={settings.refreshTokenExpirationDays}
                onChange={(e) =>
                  updateSetting('refreshTokenExpirationDays', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Max Login Attempts
              </label>
              <input
                type="number"
                value={settings.maxLoginAttempts}
                onChange={(e) =>
                  updateSetting('maxLoginAttempts', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>
          </div>
        </Card>

        {/* Storage Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900">
              <Settings className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              Storage & Scanning
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Max Concurrent Scans
              </label>
              <input
                type="number"
                value={settings.maxScanConcurrency}
                onChange={(e) =>
                  updateSetting('maxScanConcurrency', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Scan Interval (minutes)
              </label>
              <input
                type="number"
                value={settings.scanIntervalMinutes}
                onChange={(e) =>
                  updateSetting('scanIntervalMinutes', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Data Retention (days)
              </label>
              <input
                type="number"
                value={settings.retentionDays}
                onChange={(e) =>
                  updateSetting('retentionDays', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Settings className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <h2 className="text-xl font-semibold text-primary">
              Notifications
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="enable-email"
                type="checkbox"
                checked={settings.enableEmailNotifications}
                onChange={(e) =>
                  updateSetting('enableEmailNotifications', e.target.checked)
                }
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="enable-email"
                className="ml-2 block text-sm text-primary"
              >
                Enable Email Notifications
              </label>
            </div>

            {settings.enableEmailNotifications && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.smtpHost}
                    onChange={(e) => updateSetting('smtpHost', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) =>
                      updateSetting('smtpPort', parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    value={settings.smtpUsername}
                    onChange={(e) => updateSetting('smtpUsername', e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* API Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900">
              <Settings className="h-5 w-5 text-orange-600 dark:text-orange-300" />
            </div>
            <h2 className="text-xl font-semibold text-primary">API</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Rate Limit (requests/minute)
              </label>
              <input
                type="number"
                value={settings.apiRateLimitPerMinute}
                onChange={(e) =>
                  updateSetting('apiRateLimitPerMinute', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                CORS Allowed Origins
              </label>
              <input
                type="text"
                value={settings.corsAllowedOrigins}
                onChange={(e) => updateSetting('corsAllowedOrigins', e.target.value)}
                placeholder="* or https://example.com"
                className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-surface text-primary"
              />
            </div>

            <div className="flex items-center">
              <input
                id="enable-swagger"
                type="checkbox"
                checked={settings.enableSwagger}
                onChange={(e) => updateSetting('enableSwagger', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="enable-swagger"
                className="ml-2 block text-sm text-primary"
              >
                Enable Swagger API Documentation
              </label>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SystemSettingsPage;

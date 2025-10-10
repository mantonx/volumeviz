import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { X, Save, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils';
import { useAlertDestinations } from '@/hooks/useAlerts';
import type {
  AlertDestination,
  UpdateAlertDestinationParams,
} from '@/api/alerts';

export interface EditDestinationModalProps {
  destination: AlertDestination;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormState {
  name: string;
  description: string;
  is_enabled: boolean;
  config: Record<string, any>;
}

export const EditDestinationModal: React.FC<EditDestinationModalProps> = ({
  destination,
  open,
  onClose,
  onSuccess,
}) => {
  const { updateDestination, operationLoading, operationError } =
    useAlertDestinations();
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    is_enabled: true,
    config: {},
  });
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const isLoading = operationLoading[`updateDestination_${destination.id}`];
  const error = operationError[`updateDestination_${destination.id}`];

  // Initialize form with destination data
  useEffect(() => {
    if (destination) {
      setFormState({
        name: destination.name,
        description: destination.description || '',
        is_enabled: destination.is_enabled,
        config: destination.config || {},
      });
      setValidationErrors({});
    }
  }, [destination]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formState.name.trim()) {
      errors.name = 'Name is required';
    }

    // Type-specific validation
    switch (destination.type) {
      case 'webhook':
        if (!formState.config.url?.trim()) {
          errors.url = 'Webhook URL is required';
        } else if (!isValidUrl(formState.config.url)) {
          errors.url = 'Please enter a valid URL';
        }
        break;
      case 'slack':
        if (!formState.config.webhook_url?.trim()) {
          errors.webhook_url = 'Slack webhook URL is required';
        } else if (!isValidUrl(formState.config.webhook_url)) {
          errors.webhook_url = 'Please enter a valid Slack webhook URL';
        }
        break;
      case 'pushover':
        if (!formState.config.user_key?.trim()) {
          errors.user_key = 'Pushover user key is required';
        }
        if (!formState.config.api_token?.trim()) {
          errors.api_token = 'Pushover API token is required';
        }
        break;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const params: UpdateAlertDestinationParams = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
        config: formState.config,
        is_enabled: formState.is_enabled,
      };

      await updateDestination(destination.id, params);
      onSuccess();
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const updateConfig = (key: string, value: any) => {
    setFormState((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  const renderConfigFields = () => {
    switch (destination.type) {
      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Webhook URL *
              </label>
              <input
                type="url"
                value={formState.config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-md bg-surface',
                  validationErrors.url
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-line',
                )}
                placeholder="https://example.com/webhook"
              />
              {validationErrors.url && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.url}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                HTTP Method
              </label>
              <select
                value={formState.config.method || 'POST'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Content Type
              </label>
              <input
                type="text"
                value={formState.config.content_type || 'application/json'}
                onChange={(e) => updateConfig('content_type', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                placeholder="application/json"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Custom Headers (JSON)
              </label>
              <textarea
                value={
                  formState.config.headers
                    ? JSON.stringify(formState.config.headers, null, 2)
                    : '{}'
                }
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value || '{}');
                    updateConfig('headers', headers);
                  } catch {
                    // Invalid JSON, keep the text as-is for user to fix
                    updateConfig('headers', e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface font-mono text-sm"
                rows={3}
                placeholder='{"Authorization": "Bearer token"}'
              />
            </div>
          </div>
        );

      case 'slack':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Slack Webhook URL *
              </label>
              <input
                type="url"
                value={formState.config.webhook_url || ''}
                onChange={(e) => updateConfig('webhook_url', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-md bg-surface',
                  validationErrors.webhook_url
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-line',
                )}
                placeholder="https://hooks.slack.com/services/..."
              />
              {validationErrors.webhook_url && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.webhook_url}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Channel
              </label>
              <input
                type="text"
                value={formState.config.channel || ''}
                onChange={(e) => updateConfig('channel', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                placeholder="#alerts"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Username
              </label>
              <input
                type="text"
                value={formState.config.username || ''}
                onChange={(e) => updateConfig('username', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                placeholder="VolumeViz"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Icon Emoji
              </label>
              <input
                type="text"
                value={formState.config.icon_emoji || ''}
                onChange={(e) => updateConfig('icon_emoji', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                placeholder=":warning:"
              />
            </div>
          </div>
        );

      case 'pushover':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                User Key *
              </label>
              <input
                type="text"
                value={formState.config.user_key || ''}
                onChange={(e) => updateConfig('user_key', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-md bg-surface',
                  validationErrors.user_key
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-line',
                )}
                placeholder="Your Pushover user key"
              />
              {validationErrors.user_key && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.user_key}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                API Token *
              </label>
              <input
                type="text"
                value={formState.config.api_token || ''}
                onChange={(e) => updateConfig('api_token', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-md bg-surface',
                  validationErrors.api_token
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-line',
                )}
                placeholder="Your application's API token"
              />
              {validationErrors.api_token && (
                <p className="text-red-600 text-sm mt-1">
                  {validationErrors.api_token}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Priority
              </label>
              <select
                value={formState.config.priority || '0'}
                onChange={(e) =>
                  updateConfig('priority', parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
              >
                <option value="-2">Lowest</option>
                <option value="-1">Low</option>
                <option value="0">Normal</option>
                <option value="1">High</option>
                <option value="2">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Sound
              </label>
              <input
                type="text"
                value={formState.config.sound || ''}
                onChange={(e) => updateConfig('sound', e.target.value)}
                className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                placeholder="pushover"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={onClose}
        />

        <Card className="relative w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-primary">
              Edit Destination
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={cn(
                    'w-full px-3 py-2 border rounded-md bg-surface',
                    validationErrors.name
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-line',
                  )}
                  placeholder="My Alert Destination"
                />
                {validationErrors.name && (
                  <p className="text-red-600 text-sm mt-1">
                    {validationErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formState.description}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-line rounded-md bg-surface"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Type
                </label>
                <div className="px-3 py-2 bg-surface-secondary border border-line rounded-md text-secondary capitalize">
                  {destination.type}
                </div>
                <p className="text-xs text-tertiary mt-1">
                  Type cannot be changed after creation
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={formState.is_enabled}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      is_enabled: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_enabled"
                  className="ml-2 text-sm text-secondary"
                >
                  Enable this destination
                </label>
              </div>
            </div>

            {/* Type-specific configuration */}
            <div>
              <h3 className="text-lg font-medium text-primary mb-4">
                {destination.type.charAt(0).toUpperCase() +
                  destination.type.slice(1)}{' '}
                Configuration
              </h3>
              {renderConfigFields()}
            </div>

            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-line">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

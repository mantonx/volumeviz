/**
 * SystemSettingsPage - Admin page showing the running process's real
 * configuration.
 *
 * This is read-only, not editable. Every value here is loaded once from the
 * environment when the backend process starts (scan interval/concurrency,
 * retention windows, rate limits, CORS origins, etc) - none of it is
 * runtime-editable state, so there's nothing for a "Save" button to persist
 * without restarting the process and changing the underlying env vars.
 */

import React from 'react';
import { Settings, ShieldCheck, Gauge, Globe, ScanSearch, Clock3, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useGetApiV1SystemConfig } from '@/api/orval-generated/api';

const StatusPill: React.FC<{ enabled?: boolean }> = ({ enabled }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      enabled
        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
        : 'bg-surface-secondary text-tertiary'
    }`}
  >
    {enabled ? 'Enabled' : 'Disabled'}
  </span>
);

const ConfigRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between py-2 border-b border-line last:border-0">
    <span className="text-sm text-secondary">{label}</span>
    <span className="text-sm font-medium text-primary">{value}</span>
  </div>
);

export const SystemSettingsPage: React.FC = () => {
  const { data, isLoading, isError } = useGetApiV1SystemConfig();
  const config = data?.status === 200 ? data.data : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">System Settings</h1>
        <p className="mt-2 text-secondary">
          The backend's currently active configuration. These values are read once from
          environment variables when the process starts - changing any of them means updating
          the env var and restarting, not editing them here.
        </p>
      </div>

      {isError && (
        <div className="text-center py-12">
          <Settings className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-primary">Couldn't load configuration</h3>
          <p className="mt-1 text-sm text-tertiary">
            There was a problem reaching the server. Try again shortly.
          </p>
        </div>
      )}

      {!isError && !isLoading && config && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Settings className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Server</h2>
            </div>
            <ConfigRow label="Mode" value={config.server?.mode ?? '—'} />
            <ConfigRow label="Database" value={config.server?.database_type ?? '—'} />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900">
                <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Authentication</h2>
            </div>
            <ConfigRow label="Auth enforcement" value={<StatusPill enabled={config.auth?.enabled} />} />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900">
                <Gauge className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Rate Limiting</h2>
            </div>
            <ConfigRow label="Status" value={<StatusPill enabled={config.rate_limit?.enabled} />} />
            <ConfigRow label="Requests / minute" value={config.rate_limit?.requests_per_minute ?? '—'} />
            <ConfigRow label="Burst" value={config.rate_limit?.burst ?? '—'} />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900">
                <Globe className="h-5 w-5 text-teal-600 dark:text-teal-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">CORS</h2>
            </div>
            <div className="text-sm text-secondary mb-2">Allowed origins</div>
            <div className="flex flex-wrap gap-2">
              {(config.cors?.allowed_origins ?? []).map((origin) => (
                <code
                  key={origin}
                  className="bg-surface-secondary px-2 py-1 rounded text-xs text-primary"
                >
                  {origin}
                </code>
              ))}
              {(config.cors?.allowed_origins ?? []).length === 0 && (
                <span className="text-sm text-tertiary">None configured</span>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900">
                <ScanSearch className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Scanning</h2>
            </div>
            <ConfigRow label="Status" value={<StatusPill enabled={config.scan?.enabled} />} />
            <ConfigRow
              label="Interval"
              value={
                config.scan?.interval_seconds
                  ? `${Math.round(config.scan.interval_seconds / 60)} min`
                  : '—'
              }
            />
            <ConfigRow label="Concurrency" value={config.scan?.concurrency ?? '—'} />
            <ConfigRow
              label="Bind mounts"
              value={<StatusPill enabled={config.scan?.bind_mounts_enabled} />}
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Data Retention</h2>
            </div>
            <ConfigRow label="Status" value={<StatusPill enabled={config.retention?.enabled} />} />
            <ConfigRow label="Scan jobs" value={`${config.retention?.scan_jobs_days ?? '—'} days`} />
            <ConfigRow
              label="Scan metrics"
              value={`${config.retention?.scan_metrics_days ?? '—'} days`}
            />
            <ConfigRow
              label="Scan phases"
              value={`${config.retention?.scan_phases_days ?? '—'} days`}
            />
            <ConfigRow
              label="File metadata"
              value={`${config.retention?.file_metadata_days ?? '—'} days`}
            />
            <ConfigRow
              label="Inactive files"
              value={`${config.retention?.inactive_files_days ?? '—'} days`}
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900">
                <Bell className="h-5 w-5 text-rose-600 dark:text-rose-300" />
              </div>
              <h2 className="text-xl font-semibold text-primary">Alerts</h2>
            </div>
            <ConfigRow label="Status" value={<StatusPill enabled={config.alerts?.enabled} />} />
            <ConfigRow
              label="Evaluation interval"
              value={`${config.alerts?.evaluation_interval_minutes ?? '—'} min`}
            />
          </Card>
        </div>
      )}
    </div>
  );
};

export default SystemSettingsPage;

/**
 * NotificationsDropdown - real, wired-to-live-data notifications.
 *
 * Surfaces three genuinely real event sources already used elsewhere in the
 * app (Dashboard's alert banner, the scan-progress subsystem): firing
 * alerts, actively-running scans, and scan errors from the last 24 hours.
 * No invented notification types — if a source has nothing to show, it's
 * simply omitted, and an empty overall state is shown honestly rather than
 * padded with placeholder content.
 */
import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useGetApiV1Alerts,
  useGetApiV1ScansActive,
  useGetApiV1ScansRecentErrors,
} from '@/api/orval-generated/api';

interface ActiveScanItem {
  volume_id?: string;
  volume_name?: string;
  phase?: string;
}

interface RecentErrorItem {
  volume_id?: string;
  error_message?: string;
  phase?: string;
  occurred_at?: string;
}

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const { data: alertsData, isFetching: alertsFetching } = useGetApiV1Alerts(
    { limit: 5, offset: 0, status: 'firing' },
    { query: { enabled: isOpen, staleTime: 30 * 1000 } },
  );
  const { data: scansData, isFetching: scansFetching } = useGetApiV1ScansActive(
    { limit: 5, offset: 0 },
    { query: { enabled: isOpen, staleTime: 30 * 1000 } },
  );
  const { data: errorsData, isFetching: errorsFetching } =
    useGetApiV1ScansRecentErrors(
      { limit: 5, hours: 24 },
      { query: { enabled: isOpen, staleTime: 30 * 1000 } },
    );

  const alerts =
    alertsData?.status === 200 ? alertsData.data.alerts ?? [] : [];
  const activeScans =
    scansData?.status === 200
      ? ((scansData.data as any)?.active_scans as ActiveScanItem[] ?? [])
      : [];
  const recentErrors =
    errorsData?.status === 200
      ? ((errorsData.data as any)?.recent_errors as RecentErrorItem[] ?? [])
      : [];

  const isLoading = alertsFetching || scansFetching || errorsFetching;
  const badgeCount = alerts.length + recentErrors.length;
  const hasAnything = badgeCount > 0 || activeScans.length > 0;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-secondary hover:text-primary"
        title="Notifications"
        aria-label="View notifications"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-elevated rounded-lg shadow-lg border border-line py-1 z-50">
          <div className="px-4 py-2 border-b border-line">
            <p className="text-sm font-medium text-primary">Notifications</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-secondary">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </div>
            ) : !hasAnything ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-tertiary mx-auto mb-2" />
                <p className="text-sm text-secondary">
                  Nothing to report right now
                </p>
                <p className="text-xs text-tertiary mt-1">
                  No firing alerts, active scans, or recent errors
                </p>
              </div>
            ) : (
              <div className="py-1">
                {alerts.map((alert) => (
                  <Link
                    key={`alert-${alert.id}`}
                    to="/alerts"
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        {alert.rule?.name ?? 'Alert firing'}
                      </p>
                      <p className="text-xs text-tertiary truncate">
                        {alert.entity_type ?? 'resource'}{' '}
                        {alert.entity_id ?? ''}
                      </p>
                    </div>
                  </Link>
                ))}

                {recentErrors.map((err, i) => (
                  <div
                    key={`error-${i}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        Scan error
                        {err.volume_id ? ` on ${err.volume_id}` : ''}
                      </p>
                      <p className="text-xs text-tertiary truncate">
                        {err.error_message ?? 'Unknown error'}
                      </p>
                    </div>
                  </div>
                ))}

                {activeScans.map((scan, i) => (
                  <div
                    key={`scan-${i}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <Loader2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0 animate-spin" />
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        Scanning {scan.volume_name ?? scan.volume_id}
                      </p>
                      {scan.phase && (
                        <p className="text-xs text-tertiary truncate">
                          {scan.phase}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-line">
              <Link
                to="/alerts"
                onClick={() => setIsOpen(false)}
                className="text-xs text-blue-600 hover:underline"
              >
                View all alerts
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

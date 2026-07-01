import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import type {
  HistoricalDataUpdate,
  StatisticsUpdate,
  SystemHealthUpdate,
  ErrorEvent,
  ScanProgressData,
  PerformanceMetrics,
} from './types';

// =============================================================================
// VOLUMEVIZ-SPECIFIC REAL-TIME DATA ATOMS
// =============================================================================

// Historical Data
export const historicalUpdatesAtom = atomWithReset<HistoricalDataUpdate[]>([]);

// System Statistics
export const systemStatisticsAtom = atomWithReset<StatisticsUpdate | null>(
  null,
);

// System Health
export const systemHealthAtom = atomWithReset<SystemHealthUpdate | null>(null);

// Error Events
export const errorEventsAtom = atomWithReset<ErrorEvent[]>([]);

// Scan Progress Data (by volume ID)
export const scanProgressAtom = atomWithReset<Record<string, ScanProgressData>>(
  {},
);

// Capacity Alerts
export const capacityAlertsAtom = atomWithReset<StatisticsUpdate[]>([]);

// Performance Metrics
export const performanceMetricsAtom = atomWithReset<PerformanceMetrics | null>(
  null,
);

// =============================================================================
// DERIVED ATOMS (Computed values)
// =============================================================================

// Get recent historical updates (last 10)
export const recentHistoricalUpdatesAtom = atom((get) => {
  const updates = get(historicalUpdatesAtom);
  return updates.slice(0, 10);
});

// Get recent errors (last 5)
export const recentErrorsAtom = atom((get) => {
  const errors = get(errorEventsAtom);
  return errors.slice(0, 5);
});

// Get critical errors
export const criticalErrorsAtom = atom((get) => {
  const errors = get(errorEventsAtom);
  return errors.filter((error) => error.severity === 'critical');
});

// Get system health score
export const systemHealthScoreAtom = atom((get) => {
  const health = get(systemHealthAtom);
  return health?.health_score ?? 0;
});

// Get active scans count
export const activeScansCountAtom = atom((get) => {
  const scanProgress = get(scanProgressAtom);
  return Object.values(scanProgress).filter(
    (scan) => scan.overall_status === 'running',
  ).length;
});

// =============================================================================
// ACTION ATOMS (For updating state)
// =============================================================================

// Add historical update
export const addHistoricalUpdateAtom = atom(
  null,
  (get, set, update: HistoricalDataUpdate) => {
    const current = get(historicalUpdatesAtom);
    set(historicalUpdatesAtom, [update, ...current.slice(0, 49)]); // Keep last 50
  },
);

// Update system statistics
export const updateSystemStatisticsAtom = atom(
  null,
  (_get, set, stats: StatisticsUpdate) => {
    set(systemStatisticsAtom, stats);

    // Also update performance metrics if available
    if (stats.performance_data) {
      set(performanceMetricsAtom, stats.performance_data);
    }
  },
);

// Update system health
export const updateSystemHealthAtom = atom(
  null,
  (_get, set, health: SystemHealthUpdate) => {
    set(systemHealthAtom, health);
  },
);

// Add error event
export const addErrorEventAtom = atom(null, (get, set, error: ErrorEvent) => {
  const current = get(errorEventsAtom);
  set(errorEventsAtom, [error, ...current.slice(0, 19)]); // Keep last 20
});

// Update scan progress for a specific volume with monotonic progress guarantee
export const updateScanProgressAtom = atom(
  null,
  (
    get,
    set,
    { volumeId, progress }: { volumeId: string; progress: ScanProgressData },
  ) => {
    const current = get(scanProgressAtom);
    const existingProgress = current[volumeId];

    // Ensure monotonic progress: never decrease unless scan is reset
    let adjustedProgress = progress;
    if (existingProgress && progress.overall_progress < existingProgress.overall_progress) {
      // Only allow progress to decrease if scan_id changed (new scan started)
      if (progress.scan_id === existingProgress.scan_id) {
        // Same scan - preserve higher progress value and skip this update
        console.warn(
          `[Scan Progress] Monotonic violation detected for ${volumeId}: ${existingProgress.overall_progress}% → ${progress.overall_progress}%. Keeping higher value.`
        );
        adjustedProgress = {
          ...progress,
          overall_progress: existingProgress.overall_progress,
        };
      }
    }

    // Round progress to nearest 1% to reduce visual jitter
    adjustedProgress = {
      ...adjustedProgress,
      overall_progress: Math.round(adjustedProgress.overall_progress),
    };

    set(scanProgressAtom, {
      ...current,
      [volumeId]: adjustedProgress,
    });
  },
);

// Remove scan progress for a volume (when completed)
export const removeScanProgressAtom = atom(
  null,
  (get, set, volumeId: string) => {
    const current = get(scanProgressAtom);
    const { [volumeId]: _removed, ...rest } = current;
    set(scanProgressAtom, rest);
  },
);

// Add capacity alert
export const addCapacityAlertAtom = atom(
  null,
  (get, set, alert: StatisticsUpdate) => {
    const current = get(capacityAlertsAtom);
    set(capacityAlertsAtom, [alert, ...current.slice(0, 9)]); // Keep last 10
  },
);

// Clear all VolumeViz real-time data (useful for reset/reconnect)
export const clearVolumeVizDataAtom = atom(null, (_get, set) => {
  set(historicalUpdatesAtom, []);
  set(systemStatisticsAtom, null);
  set(systemHealthAtom, null);
  set(errorEventsAtom, []);
  set(scanProgressAtom, {});
  set(capacityAlertsAtom, []);
  set(performanceMetricsAtom, null);
});

// =============================================================================
// SELECTOR ATOMS (For specific data queries)
// =============================================================================

// Get scan progress for specific volume
export const getScanProgressForVolumeAtom = (volumeId: string) =>
  atom((get) => {
    const scanProgress = get(scanProgressAtom);
    return scanProgress[volumeId] ?? null;
  });

// Get alerts for specific volume
export const getAlertsForVolumeAtom = (volumeId: string) =>
  atom((get) => {
    const alerts = get(capacityAlertsAtom);
    return alerts.filter(
      (alert) =>
        alert.alert_data?.volume_id === volumeId ||
        alert.volume_stats?.volume_id === volumeId,
    );
  });

// Get errors for specific volume
export const getErrorsForVolumeAtom = (volumeId: string) =>
  atom((get) => {
    const errors = get(errorEventsAtom);
    return errors.filter((error) => error.volume_id === volumeId);
  });

// Get historical updates for specific volume
export const getHistoricalUpdatesForVolumeAtom = (volumeId: string) =>
  atom((get) => {
    const updates = get(historicalUpdatesAtom);
    return updates.filter((update) => update.volume_id === volumeId);
  });

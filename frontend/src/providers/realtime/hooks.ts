import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { useConnectionStatus, useWebSocketContext } from '../websocket';
import {
  historicalUpdatesAtom,
  recentHistoricalUpdatesAtom,
  systemStatisticsAtom,
  systemHealthAtom,
  systemHealthScoreAtom,
  errorEventsAtom,
  recentErrorsAtom,
  criticalErrorsAtom,
  scanProgressAtom,
  activeScansCountAtom,
  capacityAlertsAtom,
  performanceMetricsAtom,
  getScanProgressForVolumeAtom,
  getAlertsForVolumeAtom,
  getErrorsForVolumeAtom,
  getHistoricalUpdatesForVolumeAtom,
} from './atoms';

// =============================================================================
// CONNECTION STATUS HOOKS (delegated to generic layer)
// =============================================================================

export const useRealtimeConnectionStatus = () => {
  return useConnectionStatus();
};

// =============================================================================
// SYSTEM HEALTH HOOKS
// =============================================================================

export const useSystemHealth = () => {
  const health = useAtomValue(systemHealthAtom);
  const healthScore = useAtomValue(systemHealthScoreAtom);

  return {
    health,
    healthScore,
    isHealthy: healthScore >= 0.8,
    isDegraded: healthScore >= 0.5 && healthScore < 0.8,
    isCritical: healthScore < 0.5,
  };
};

export const useSystemStatistics = () => {
  const stats = useAtomValue(systemStatisticsAtom);
  const activeScans = useAtomValue(activeScansCountAtom);
  const performanceMetrics = useAtomValue(performanceMetricsAtom);

  return {
    stats,
    activeScans,
    performanceMetrics,
  };
};

// =============================================================================
// ERROR AND ALERT HOOKS
// =============================================================================

export const useRealtimeErrors = () => {
  const allErrors = useAtomValue(errorEventsAtom);
  const recentErrors = useAtomValue(recentErrorsAtom);
  const criticalErrors = useAtomValue(criticalErrorsAtom);

  return {
    allErrors,
    recentErrors,
    criticalErrors,
    hasCriticalErrors: criticalErrors.length > 0,
    errorCount: allErrors.length,
  };
};

export const useCapacityAlerts = () => {
  const alerts = useAtomValue(capacityAlertsAtom);

  const criticalAlerts = useMemo(
    () => alerts.filter((alert) => alert.alert_data?.severity === 'critical'),
    [alerts],
  );

  const warningAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.alert_data?.severity === 'high' ||
          alert.alert_data?.severity === 'medium',
      ),
    [alerts],
  );

  return {
    allAlerts: alerts,
    criticalAlerts,
    warningAlerts,
    hasCriticalAlerts: criticalAlerts.length > 0,
    hasWarnings: warningAlerts.length > 0,
  };
};

// =============================================================================
// HISTORICAL DATA HOOKS
// =============================================================================

export const useHistoricalData = () => {
  const allUpdates = useAtomValue(historicalUpdatesAtom);
  const recentUpdates = useAtomValue(recentHistoricalUpdatesAtom);

  return {
    allUpdates,
    recentUpdates,
    updateCount: allUpdates.length,
  };
};

// =============================================================================
// SCAN PROGRESS HOOKS
// =============================================================================

export const useScanProgress = () => {
  const scanProgress = useAtomValue(scanProgressAtom);
  const activeScansCount = useAtomValue(activeScansCountAtom);

  const activeScans = useMemo(
    () =>
      Object.values(scanProgress).filter(
        (scan) => scan.overall_status === 'running',
      ),
    [scanProgress],
  );

  const completedScans = useMemo(
    () =>
      Object.values(scanProgress).filter(
        (scan) => scan.overall_status === 'completed',
      ),
    [scanProgress],
  );

  const failedScans = useMemo(
    () =>
      Object.values(scanProgress).filter(
        (scan) => scan.overall_status === 'failed',
      ),
    [scanProgress],
  );

  return {
    scanProgress,
    activeScans,
    completedScans,
    failedScans,
    activeScansCount,
    hasActiveScans: activeScansCount > 0,
  };
};

// =============================================================================
// VOLUME-SPECIFIC HOOKS
// =============================================================================

export const useVolumeRealtimeData = (volumeId: string) => {
  const scanProgress = useAtomValue(getScanProgressForVolumeAtom(volumeId));
  const alerts = useAtomValue(getAlertsForVolumeAtom(volumeId));
  const errors = useAtomValue(getErrorsForVolumeAtom(volumeId));
  const historicalUpdates = useAtomValue(
    getHistoricalUpdatesForVolumeAtom(volumeId),
  );

  const isScanning = scanProgress?.overall_status === 'running';
  const hasErrors = errors.length > 0;
  const hasAlerts = alerts.length > 0;

  const criticalAlerts = useMemo(
    () => alerts.filter((alert) => alert.alert_data?.severity === 'critical'),
    [alerts],
  );

  const criticalErrors = useMemo(
    () => errors.filter((error) => error.severity === 'critical'),
    [errors],
  );

  return {
    // Scan data
    scanProgress,
    isScanning,

    // Alerts
    alerts,
    hasAlerts,
    criticalAlerts,
    hasCriticalAlerts: criticalAlerts.length > 0,

    // Errors
    errors,
    hasErrors,
    criticalErrors,
    hasCriticalErrors: criticalErrors.length > 0,

    // Historical data
    historicalUpdates,
    hasHistoricalData: historicalUpdates.length > 0,

    // Overall status
    needsAttention:
      hasErrors ||
      hasAlerts ||
      criticalErrors.length > 0 ||
      criticalAlerts.length > 0,
  };
};

// =============================================================================
// DASHBOARD SUMMARY HOOKS
// =============================================================================

export const useRealtimeDashboardSummary = () => {
  const { isConnected } = useRealtimeConnectionStatus();
  const { healthScore, health } = useSystemHealth();
  const { activeScansCount } = useScanProgress();
  const { criticalErrors, errorCount } = useRealtimeErrors();
  const { criticalAlerts, hasCriticalAlerts } = useCapacityAlerts();
  const stats = useAtomValue(systemStatisticsAtom);

  return {
    // Connection (delegated to generic layer)
    isConnected,

    // System health
    healthScore,
    systemHealth: health?.overall_health,
    isSystemHealthy: healthScore >= 0.8,

    // Activity
    activeScansCount,
    hasActiveScans: activeScansCount > 0,

    // Issues
    criticalErrorCount: criticalErrors.length,
    totalErrorCount: errorCount,
    criticalAlertCount: criticalAlerts.length,
    hasCriticalIssues: criticalErrors.length > 0 || hasCriticalAlerts,

    // System stats
    totalVolumes: stats?.system_stats?.total_volumes ?? 0,
    totalStorageBytes: stats?.system_stats?.total_storage_bytes ?? 0,

    // Overall status
    overallStatus: (() => {
      if (!isConnected) return 'disconnected';
      if (criticalErrors.length > 0 || hasCriticalAlerts) return 'critical';
      if (healthScore < 0.6) return 'degraded';
      if (activeScansCount > 0) return 'active';
      return 'healthy';
    })(),
  };
};

// =============================================================================
// WEBSOCKET ACTION HOOKS (delegated to generic layer)
// =============================================================================

export const useRealtimeActions = () => {
  const webSocketContext = useWebSocketContext();

  return {
    sendMessage: webSocketContext.sendMessage,
    subscribe: webSocketContext.subscribe,
    unsubscribe: webSocketContext.unsubscribe,
    reconnect: webSocketContext.reconnect,
    disconnect: webSocketContext.disconnect,
  };
};

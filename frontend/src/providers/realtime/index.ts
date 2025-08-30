// VolumeViz-specific realtime provider built on top of generic WebSocket layer
export { RealtimeProvider, useRealtime } from './RealtimeProvider';

// Export all domain-specific types
export * from './types';

// Export all domain-specific hooks
export * from './hooks';

// Re-export commonly used atoms for convenience
export {
  // Real-time data atoms
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

  // Action atoms
  addHistoricalUpdateAtom,
  updateSystemStatisticsAtom,
  updateSystemHealthAtom,
  addErrorEventAtom,
  updateScanProgressAtom,
  addCapacityAlertAtom,
  clearVolumeVizDataAtom,

  // Selector atoms
  getScanProgressForVolumeAtom,
  getAlertsForVolumeAtom,
  getErrorsForVolumeAtom,
  getHistoricalUpdatesForVolumeAtom,
} from './atoms';

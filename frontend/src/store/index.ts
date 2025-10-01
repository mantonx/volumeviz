// Modern atoms are now organized under /src/atoms/
// Legacy container atoms removed during modernization

// Theme atoms (migrated to /src/atoms/theme/)
export { themeAtom, resolvedThemeAtom, systemThemeAtom } from '@/atoms/theme';

// Volume atoms (moved to /src/atoms/volumes/)
export {
  volumesAtom,
  volumesLoadingAtom,
  volumesErrorAtom,
  volumeStatsAtom,
} from '@/atoms/volumes';

// UI atoms (moved to /src/atoms/ui/)
export { volumesViewModeAtom } from '@/atoms/ui';

// WebSocket atoms (migrated to /src/atoms/websocket/)
export {
  websocketStateAtom,
  websocketStatusAtom,
  websocketEnabledAtom,
  connectionStatusAtom,
} from '@/atoms/websocket';

// Settings atoms (migrated to /src/atoms/settings/)
export {
  autoRefreshEnabledAtom,
  autoRefreshIntervalAtom,
  apiConfigAtom,
  notificationsEnabledAtom,
  soundEnabledAtom,
  maxConcurrentScansAtom,
  debugModeAtom,
  verboseLoggingAtom,
  compactModeAtom,
  showTooltipsAtom,
  animationsEnabledAtom,
  experimentalFeaturesAtom,
  betaFeaturesAtom,
  featureFlagsAtom,
  environmentAtom,
  isProductionModeAtom,
  effectiveApiTimeoutAtom,
} from '@/atoms/settings';

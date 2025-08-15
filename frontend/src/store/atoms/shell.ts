import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Base API Configuration
export const apiBaseAtom = atomWithStorage<string>(
  'volumeviz-api-base',
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1',
);

// Polling Configuration
export const pollingIntervalAtom = atomWithStorage<number>(
  'volumeviz-polling-interval',
  parseInt(import.meta.env.VITE_POLLING_INTERVAL || '30000', 10),
);

export const pollingEnabledAtom = atomWithStorage<boolean>(
  'volumeviz-polling-enabled',
  import.meta.env.VITE_ENABLE_POLLING === 'true',
);

// Real-time Mode Configuration
export const realtimeModeAtom = atomWithStorage<
  'websocket' | 'polling' | 'hybrid'
>(
  'volumeviz-realtime-mode',
  'hybrid', // Default to hybrid mode (WebSocket with polling fallback)
);

// App Shell State
export const appInitializedAtom = atom<boolean>(false);
export const navigationModeAtom = atom<'main' | 'settings' | 'admin'>('main');
export const sidebarCollapsedAtom = atomWithStorage<boolean>(
  'volumeviz-sidebar-collapsed',
  false,
);

// Feature Flags from Environment
export const featureFlagsAtom = atom({
  enableWebSocket: import.meta.env.VITE_ENABLE_WEBSOCKET === 'true',
  enablePolling: import.meta.env.VITE_ENABLE_POLLING !== 'false',
  enableCharts: import.meta.env.VITE_ENABLE_CHARTS === 'true',
  enableRealtimeDashboard:
    import.meta.env.VITE_ENABLE_REALTIME_DASHBOARD === 'true',
  enableVolumeScanning: import.meta.env.VITE_ENABLE_VOLUME_SCANNING === 'true',
  enableMSW: import.meta.env.VITE_ENABLE_MSW === 'true',
});

// MSW Configuration
export const mswEnabledAtom = atom<boolean>(
  import.meta.env.VITE_ENABLE_MSW === 'true' && import.meta.env.DEV,
);

// Derived atoms for shell behavior
export const shouldUsePollingAtom = atom<boolean>((get) => {
  const realtimeMode = get(realtimeModeAtom);
  const pollingEnabled = get(pollingEnabledAtom);
  const featureFlags = get(featureFlagsAtom);

  if (!pollingEnabled || !featureFlags.enablePolling) {
    return false;
  }

  return realtimeMode === 'polling' || realtimeMode === 'hybrid';
});

export const shouldUseWebSocketAtom = atom<boolean>((get) => {
  const realtimeMode = get(realtimeModeAtom);
  const featureFlags = get(featureFlagsAtom);

  if (!featureFlags.enableWebSocket) {
    return false;
  }

  return realtimeMode === 'websocket' || realtimeMode === 'hybrid';
});

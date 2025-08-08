/**
 * Real-time configuration from environment variables
 */

export const realTimeConfig = {
  // WebSocket configuration
  websocket: {
    enabled: import.meta.env.VITE_ENABLE_WEBSOCKET === 'true',
    url: import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws',
  },

  // Polling configuration
  polling: {
    enabled: import.meta.env.VITE_ENABLE_POLLING !== 'false', // Default to true
    interval: parseInt(import.meta.env.VITE_POLLING_INTERVAL || '30000', 10),
  },

  // Scanning configuration
  scanning: {
    maxConcurrent: parseInt(
      import.meta.env.VITE_MAX_CONCURRENT_SCANS || '3',
      10,
    ),
  },

  // Debug configuration
  debug: {
    enabled: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  },
};

// Helper to get scan options with environment defaults
export function getDefaultScanOptions() {
  return {
    enablePolling: realTimeConfig.polling.enabled,
    pollingInterval: realTimeConfig.polling.interval,
    enableWebSocket: realTimeConfig.websocket.enabled,
    webSocketUrl: realTimeConfig.websocket.url,
    maxConcurrentScans: realTimeConfig.scanning.maxConcurrent,
  };
}

// Log configuration in development
if (import.meta.env.DEV && realTimeConfig.debug.enabled) {
  console.log('Real-time configuration:', realTimeConfig);
}
/**
 * Settings atoms
 * 
 * Jotai atoms for managing application settings and configuration.
 */

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Auto-refresh settings
export const autoRefreshEnabledAtom = atomWithStorage('auto-refresh-enabled', true);
export const autoRefreshIntervalAtom = atomWithStorage('auto-refresh-interval', 30000);

// API configuration
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export const apiConfigAtom = atomWithStorage<ApiConfig>('api-config', {
  baseUrl: '/api/v1',
  timeout: 10000,
  retryAttempts: 3,
});

// Notification settings
export const notificationsEnabledAtom = atomWithStorage('notifications-enabled', true);
export const soundEnabledAtom = atomWithStorage('sound-enabled', false);

// Performance settings
export const maxConcurrentScansAtom = atomWithStorage('max-concurrent-scans', 3);
export const cacheExpiryAtom = atomWithStorage('cache-expiry', 300000); // 5 minutes

// Debug settings
export const debugModeAtom = atomWithStorage('debug-mode', false);
export const verboseLoggingAtom = atomWithStorage('verbose-logging', false);

// Data retention settings
export const dataRetentionDaysAtom = atomWithStorage('data-retention-days', 90);
export const autoCleanupEnabledAtom = atomWithStorage('auto-cleanup-enabled', true);

// UI preferences
export const compactModeAtom = atomWithStorage('compact-mode', false);
export const showTooltipsAtom = atomWithStorage('show-tooltips', true);
export const animationsEnabledAtom = atomWithStorage('animations-enabled', true);

// Advanced settings
export const experimentalFeaturesAtom = atomWithStorage('experimental-features', false);
export const betaFeaturesAtom = atomWithStorage('beta-features', false);

// Feature flags
export interface FeatureFlags {
  enableWebSocket: boolean;
  enableRealTimeUpdates: boolean;
  enableAdvancedSearch: boolean;
  enableBulkOperations: boolean;
  enableMetadataExtraction: boolean;
  enablePreviewGeneration: boolean;
}

export const featureFlagsAtom = atomWithStorage<FeatureFlags>('feature-flags', {
  enableWebSocket: false,
  enableRealTimeUpdates: true,
  enableAdvancedSearch: true,
  enableBulkOperations: true,
  enableMetadataExtraction: true,
  enablePreviewGeneration: false,
});

// Environment information
export interface Environment {
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  version: string;
  buildTime?: string;
}

export const environmentAtom = atom<Environment>({
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  version: process.env.VITE_APP_VERSION || '0.1.0',
  buildTime: process.env.VITE_BUILD_TIME,
});

// Computed settings atoms
export const isProductionModeAtom = atom((get) => {
  const env = get(environmentAtom);
  return env.isProduction;
});

export const effectiveApiTimeoutAtom = atom((get) => {
  const config = get(apiConfigAtom);
  const isProduction = get(isProductionModeAtom);
  
  // Use longer timeout in production
  return isProduction ? config.timeout * 2 : config.timeout;
});
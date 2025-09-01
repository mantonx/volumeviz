/**
 * Environment configuration for VolumeViz
 * Centralizes all environment-specific settings
 */

export interface EnvironmentConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  buildId: string;
  features: {
    offlineMode: boolean;
    realtimeUpdates: boolean;
    advancedAnalytics: boolean;
    bulkOperations: boolean;
  };
  monitoring: {
    sentryDsn?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enablePerformanceTracking: boolean;
    enableErrorTracking: boolean;
  };
  api: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  query: {
    staleTime: number;
    cacheTime: number;
    retry: number;
    refetchOnWindowFocus: boolean;
    refetchOnReconnect: boolean;
  };
  sync: {
    enabled: boolean;
    interval: number;
    maxRetries: number;
    batchSize: number;
  };
  cache: {
    ttl: number;
    maxSize: number;
    persistenceKey: string;
  };
}

// Get environment from Vite
const env = import.meta.env;
const isProd = env.MODE === 'production';
const isStaging = env.MODE === 'staging';
const isDev = env.MODE === 'development';

// API URLs with fallbacks
const getApiUrl = (): string => {
  if (env.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
  if (isProd) return 'https://api.volumeviz.io';
  if (isStaging) return 'https://staging-api.volumeviz.io';
  return 'http://localhost:8080';
};

const getWsUrl = (): string => {
  if (env.VITE_WS_BASE_URL) return env.VITE_WS_BASE_URL;
  const apiUrl = getApiUrl();
  return apiUrl.replace(/^http/, 'ws');
};

// Build information
const getBuildInfo = () => ({
  version: env.VITE_APP_VERSION || '1.0.0',
  buildId: env.VITE_BUILD_ID || 'dev',
  buildTime: env.VITE_BUILD_TIME || new Date().toISOString(),
});

// Feature flags
const getFeatureFlags = () => ({
  offlineMode: env.VITE_FEATURE_OFFLINE !== 'false',
  realtimeUpdates: env.VITE_FEATURE_REALTIME !== 'false',
  advancedAnalytics: env.VITE_FEATURE_ANALYTICS === 'true' || isProd,
  bulkOperations: env.VITE_FEATURE_BULK_OPS !== 'false',
});

// Monitoring configuration
const getMonitoringConfig = () => ({
  sentryDsn: env.VITE_SENTRY_DSN,
  logLevel: (env.VITE_LOG_LEVEL || (isDev ? 'debug' : 'error')) as any,
  enablePerformanceTracking: env.VITE_ENABLE_PERF_TRACKING === 'true' || isProd,
  enableErrorTracking: env.VITE_ENABLE_ERROR_TRACKING !== 'false',
});

// API configuration
const getApiConfig = () => ({
  timeout: parseInt(env.VITE_API_TIMEOUT || '30000', 10),
  retryAttempts: parseInt(env.VITE_API_RETRY_ATTEMPTS || (isProd ? '3' : '1'), 10),
  retryDelay: parseInt(env.VITE_API_RETRY_DELAY || '1000', 10),
});

// React Query configuration
const getQueryConfig = () => ({
  staleTime: parseInt(env.VITE_QUERY_STALE_TIME || (isProd ? '60000' : '30000'), 10),
  cacheTime: parseInt(env.VITE_QUERY_CACHE_TIME || (isProd ? '300000' : '120000'), 10),
  retry: parseInt(env.VITE_QUERY_RETRY || (isProd ? '3' : '1'), 10),
  refetchOnWindowFocus: env.VITE_QUERY_REFETCH_ON_FOCUS !== 'false' && !isProd,
  refetchOnReconnect: env.VITE_QUERY_REFETCH_ON_RECONNECT !== 'false',
});

// Background sync configuration
const getSyncConfig = () => ({
  enabled: env.VITE_SYNC_ENABLED !== 'false',
  interval: parseInt(env.VITE_SYNC_INTERVAL || '30000', 10),
  maxRetries: parseInt(env.VITE_SYNC_MAX_RETRIES || '5', 10),
  batchSize: parseInt(env.VITE_SYNC_BATCH_SIZE || '10', 10),
});

// Cache configuration
const getCacheConfig = () => ({
  ttl: parseInt(env.VITE_CACHE_TTL || '86400000', 10), // 24 hours
  maxSize: parseInt(env.VITE_CACHE_MAX_SIZE || '52428800', 10), // 50MB
  persistenceKey: env.VITE_CACHE_KEY || 'volumeviz-cache',
});

// Main configuration object
export const config: EnvironmentConfig = {
  apiBaseUrl: getApiUrl(),
  wsBaseUrl: getWsUrl(),
  environment: env.MODE as any || 'development',
  version: getBuildInfo().version,
  buildId: getBuildInfo().buildId,
  features: getFeatureFlags(),
  monitoring: getMonitoringConfig(),
  api: getApiConfig(),
  query: getQueryConfig(),
  sync: getSyncConfig(),
  cache: getCacheConfig(),
};

// Environment checks
export const isDevelopment = isDev;
export const isProduction = isProd;
export const isStaging = isStaging;
export const isTest = env.MODE === 'test';

// Debug logging
if (isDevelopment) {
  console.log('🔧 Environment Configuration:', {
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
    wsBaseUrl: config.wsBaseUrl,
    version: config.version,
    features: config.features,
  });
}

// Validate required configuration
const validateConfig = () => {
  const required = ['apiBaseUrl', 'wsBaseUrl', 'environment'];
  const missing = required.filter(key => !config[key as keyof EnvironmentConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
  
  // Validate URLs
  try {
    new URL(config.apiBaseUrl);
    new URL(config.wsBaseUrl);
  } catch (error) {
    throw new Error(`Invalid URL configuration: ${error}`);
  }
};

// Run validation in non-test environments
if (!isTest) {
  validateConfig();
}

export default config;
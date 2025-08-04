import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// API Configuration
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'unknown';
  timestamp: number;
  checks: Record<
    string,
    {
      status: 'healthy' | 'unhealthy';
      message?: string;
      duration?: number;
    }
  >;
}

export interface ApiError {
  code?: string;
  message: string;
  details?: any;
  timestamp: number;
  endpoint?: string;
}

// API configuration atom
export const apiConfigAtom = atomWithStorage<ApiConfig>(
  'volumeviz-api-config',
  {
    baseUrl: import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1',
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
);

// API health state
export const apiHealthAtom = atom<HealthStatus>({
  status: 'unknown',
  timestamp: 0,
  checks: {},
});

export const apiHealthLoadingAtom = atom<boolean>(false);
export const apiHealthErrorAtom = atom<string | null>(null);

// Global API error state
export const apiErrorsAtom = atom<ApiError[]>([]);
export const lastApiErrorAtom = atom<ApiError | null>(null);

// Connection state
export const apiConnectedAtom = atom<boolean>(false);
export const apiConnectingAtom = atom<boolean>(false);

// Request tracking for loading states
export const activeRequestsAtom = atom<Set<string>>(new Set());
export const requestCountAtom = atom<number>(
  (get) => get(activeRequestsAtom).size,
);

// API statistics
export const apiStatsAtom = atom({
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  averageResponseTime: 0,
});

// Computed API status
export const apiStatusAtom = atom<
  'online' | 'offline' | 'connecting' | 'error'
>((get) => {
  const connected = get(apiConnectedAtom);
  const connecting = get(apiConnectingAtom);
  const health = get(apiHealthAtom);
  const lastError = get(lastApiErrorAtom);

  if (connecting) {
    return 'connecting';
  }

  if (!connected || health.status === 'unhealthy') {
    return 'offline';
  }

  if (lastError && Date.now() - lastError.timestamp < 60000) {
    // Error within last minute
    return 'error';
  }

  return 'online';
});

// Actions for managing API state
export const addApiErrorAtom = atom(
  null,
  (get, set, error: Omit<ApiError, 'timestamp'>) => {
    const fullError: ApiError = {
      ...error,
      timestamp: Date.now(),
    };

    const currentErrors = get(apiErrorsAtom);
    const updatedErrors = [fullError, ...currentErrors].slice(0, 10); // Keep last 10 errors

    set(apiErrorsAtom, updatedErrors);
    set(lastApiErrorAtom, fullError);
  },
);

export const clearApiErrorsAtom = atom(null, (get, set) => {
  set(apiErrorsAtom, []);
  set(lastApiErrorAtom, null);
});

export const addActiveRequestAtom = atom(
  null,
  (get, set, requestId: string) => {
    const requests = new Set(get(activeRequestsAtom));
    requests.add(requestId);
    set(activeRequestsAtom, requests);
  },
);

export const removeActiveRequestAtom = atom(
  null,
  (get, set, requestId: string) => {
    const requests = new Set(get(activeRequestsAtom));
    requests.delete(requestId);
    set(activeRequestsAtom, requests);
  },
);

// Environment detection
export const environmentAtom = atom<'development' | 'production' | 'test'>(
  () => {
    if (import.meta.env?.MODE === 'development') return 'development';
    if (import.meta.env?.MODE === 'test') return 'test';
    return 'production';
  },
);

// Feature flags
export const featureFlagsAtom = atomWithStorage<Record<string, boolean>>(
  'volumeviz-features',
  {
    autoRefresh: true,
    realTimeUpdates: false,
    experimentalFeatures: false,
    debugMode: import.meta.env?.MODE === 'development',
  },
);

// API debugging
export const apiDebugAtom = atom<boolean>((get) => {
  const environment = get(environmentAtom);
  const features = get(featureFlagsAtom);
  return environment === 'development' || features.debugMode;
});

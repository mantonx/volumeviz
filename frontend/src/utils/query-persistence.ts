import { QueryClient } from '@tanstack/react-query';

// Simple localStorage-based persistence for TanStack Query
export interface PersistedQuery {
  queryKey: any[];
  data: any;
  timestamp: number;
  staleTime?: number;
}

export class QueryPersister {
  private storageKey: string;
  private maxAge: number;

  constructor(
    storageKey = 'volumeviz-query-cache',
    maxAge = 1000 * 60 * 60 * 24,
  ) {
    this.storageKey = storageKey;
    this.maxAge = maxAge;
  }

  // Save query data to localStorage
  persistQuery(queryKey: any[], data: any, staleTime?: number) {
    try {
      const persistedQuery: PersistedQuery = {
        queryKey,
        data,
        timestamp: Date.now(),
        staleTime,
      };

      const key = this.getKeyFromQueryKey(queryKey);
      localStorage.setItem(
        `${this.storageKey}:${key}`,
        JSON.stringify(persistedQuery),
      );
    } catch (error) {
      console.warn('Failed to persist query:', error);
    }
  }

  // Restore query data from localStorage
  restoreQuery(queryKey: any[]): PersistedQuery | null {
    try {
      const key = this.getKeyFromQueryKey(queryKey);
      const stored = localStorage.getItem(`${this.storageKey}:${key}`);

      if (!stored) return null;

      const persisted: PersistedQuery = JSON.parse(stored);

      // Check if data is expired
      const age = Date.now() - persisted.timestamp;
      if (age > this.maxAge) {
        localStorage.removeItem(`${this.storageKey}:${key}`);
        return null;
      }

      // Check if data is stale
      if (persisted.staleTime && age > persisted.staleTime) {
        return null;
      }

      return persisted;
    } catch (error) {
      console.warn('Failed to restore query:', error);
      return null;
    }
  }

  // Clear all persisted queries
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.storageKey)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear persisted queries:', error);
    }
  }

  // Clean up expired queries
  cleanupExpired() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach((key) => {
        if (key.startsWith(this.storageKey)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const persisted: PersistedQuery = JSON.parse(stored);
              const age = now - persisted.timestamp;

              if (age > this.maxAge) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup expired queries:', error);
    }
  }

  private getKeyFromQueryKey(queryKey: any[]): string {
    return btoa(JSON.stringify(queryKey));
  }
}

// Enhanced QueryClient with persistence
export function createPersistedQueryClient(options: {
  storageKey?: string;
  maxAge?: number;
  staleTime?: number;
  gcTime?: number;
}) {
  const {
    storageKey = 'volumeviz-query-cache',
    maxAge = 1000 * 60 * 60 * 24, // 24 hours
    staleTime = 1000 * 60 * 5, // 5 minutes
    gcTime = 1000 * 60 * 60 * 24, // 24 hours
  } = options;

  const persister = new QueryPersister(storageKey, maxAge);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime,
        gcTime,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: 'always',
        // Custom query options for persistence
        meta: {
          persist: true,
        },
      },
      mutations: {
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        onSuccess: () => {
          // Invalidate related queries on successful mutations
          persister.cleanupExpired();
        },
      },
    },
  });

  // Restore queries on initialization
  if (typeof window !== 'undefined') {
    // Clean up expired queries on startup
    persister.cleanupExpired();

    // Listen to query cache changes for persistence
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'added' || event.type === 'updated') {
        const { query } = event;
        const { queryKey, data, meta } = query.state;

        // Only persist queries that have meta.persist = true
        if (meta?.persist && data && query.state.status === 'success') {
          persister.persistQuery(queryKey, data, query.options.staleTime);
        }
      }
    });

    // Set up periodic cleanup
    const cleanupInterval = setInterval(
      () => {
        persister.cleanupExpired();
      },
      1000 * 60 * 60,
    ); // Every hour

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(cleanupInterval);
      persister.cleanupExpired();
    });
  }

  return { queryClient, persister };
}

// Hook to use persisted query client
export function useQueryPersistence() {
  const queryClient = new QueryClient();
  const persister = new QueryPersister();

  return {
    persistQuery: persister.persistQuery.bind(persister),
    restoreQuery: persister.restoreQuery.bind(persister),
    clearAll: persister.clearAll.bind(persister),
    cleanupExpired: persister.cleanupExpired.bind(persister),
  };
}

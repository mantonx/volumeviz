/**
 * Comprehensive unit tests for BackgroundSyncManager
 * Tests offline queuing, retry logic, and sync operations
 */

import { BackgroundSyncManager, useBackgroundSync } from '../background-sync';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock window events
const mockEventListeners: Record<string, Function[]> = {};
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

beforeAll(() => {
  window.addEventListener = jest.fn((event, callback) => {
    if (!mockEventListeners[event]) {
      mockEventListeners[event] = [];
    }
    mockEventListeners[event].push(callback as Function);
  });

  window.removeEventListener = jest.fn((event, callback) => {
    if (mockEventListeners[event]) {
      const index = mockEventListeners[event].indexOf(callback as Function);
      if (index > -1) {
        mockEventListeners[event].splice(index, 1);
      }
    }
  });
});

afterAll(() => {
  window.addEventListener = originalAddEventListener;
  window.removeEventListener = originalRemoveEventListener;
});

// Helper to trigger network events
const triggerNetworkEvent = (type: 'online' | 'offline') => {
  Object.defineProperty(navigator, 'onLine', {
    value: type === 'online',
  });

  if (mockEventListeners[type]) {
    mockEventListeners[type].forEach((callback) => callback());
  }
};

describe('BackgroundSyncManager', () => {
  let syncManager: BackgroundSyncManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    syncManager = new BackgroundSyncManager();

    // Mock auth token
    mockLocalStorage.setItem('auth_token', 'test-token');

    // Default to online
    Object.defineProperty(navigator, 'onLine', { value: true });
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const status = syncManager.getSyncStatus();

      expect(status.isOnline).toBe(true);
      expect(status.pendingCount).toBe(0);
      expect(status.syncInProgress).toBe(false);
    });

    it('should set up event listeners for online/offline events', () => {
      expect(window.addEventListener).toHaveBeenCalledWith(
        'online',
        expect.any(Function),
      );
      expect(window.addEventListener).toHaveBeenCalledWith(
        'offline',
        expect.any(Function),
      );
    });
  });

  describe('addPendingOperation', () => {
    it('should add operation to pending queue', () => {
      const operationId = syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      expect(operationId).toMatch(/^\d+-[a-z0-9]+$/);

      const pending = syncManager.getPendingOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        id: operationId,
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
        retryCount: 0,
      });
    });

    it('should persist operations to localStorage', () => {
      syncManager.addPendingOperation({
        type: 'refresh',
        volumeId: 'test-volume-2',
        maxRetries: 5,
      });

      const stored = mockLocalStorage.getItem('volumeviz-pending-operations');
      expect(stored).toBeTruthy();

      const operations = JSON.parse(stored!);
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('refresh');
    });

    it('should trigger sync if online', async () => {
      const syncSpy = jest.spyOn(syncManager, 'syncPendingOperations');

      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('syncPendingOperations', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('should execute scan operations', async () => {
      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/volumes/test-volume/scan',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('should execute refresh operations', async () => {
      syncManager.addPendingOperation({
        type: 'refresh',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/volumes/test-volume/size/refresh',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should execute index operations', async () => {
      syncManager.addPendingOperation({
        type: 'index',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/volumes/test-volume/filesystem/index',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should execute update operations', async () => {
      const updateData = { name: 'updated-volume' };

      syncManager.addPendingOperation({
        type: 'update',
        volumeId: 'test-volume',
        data: updateData,
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/volumes/test-volume',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        }),
      );
    });

    it('should remove successful operations from queue', async () => {
      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      expect(syncManager.getPendingOperations()).toHaveLength(1);

      await syncManager.syncPendingOperations();

      expect(syncManager.getPendingOperations()).toHaveLength(0);
    });

    it('should increment retry count on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const operationId = syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      const pending = syncManager.getPendingOperations();
      const operation = pending.find((op) => op.id === operationId);
      expect(operation?.retryCount).toBe(1);
    });

    it('should remove operations that exceed max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 2,
      });

      // First attempt
      await syncManager.syncPendingOperations();
      expect(syncManager.getPendingOperations()).toHaveLength(1);

      // Second attempt
      await syncManager.syncPendingOperations();
      expect(syncManager.getPendingOperations()).toHaveLength(1);

      // Third attempt - should be removed
      await syncManager.syncPendingOperations();
      expect(syncManager.getPendingOperations()).toHaveLength(0);
    });

    it('should not sync when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });

      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not sync when already in progress', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      // Start first sync (won't complete immediately)
      const firstSync = syncManager.syncPendingOperations();

      // Try to start second sync
      await syncManager.syncPendingOperations();

      // Wait for first to complete
      await firstSync;

      // Should only have been called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('network event handling', () => {
    it('should update online status when going online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      syncManager = new BackgroundSyncManager();

      expect(syncManager.getSyncStatus().isOnline).toBe(false);

      triggerNetworkEvent('online');

      expect(syncManager.getSyncStatus().isOnline).toBe(true);
    });

    it('should update online status when going offline', () => {
      expect(syncManager.getSyncStatus().isOnline).toBe(true);

      triggerNetworkEvent('offline');

      expect(syncManager.getSyncStatus().isOnline).toBe(false);
    });

    it('should trigger sync when coming back online', async () => {
      const syncSpy = jest.spyOn(syncManager, 'syncPendingOperations');

      triggerNetworkEvent('online');

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe('clearPendingOperations', () => {
    it('should clear all pending operations', () => {
      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume-1',
        maxRetries: 3,
      });

      syncManager.addPendingOperation({
        type: 'refresh',
        volumeId: 'test-volume-2',
        maxRetries: 3,
      });

      expect(syncManager.getPendingOperations()).toHaveLength(2);

      syncManager.clearPendingOperations();

      expect(syncManager.getPendingOperations()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock localStorage error
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('LocalStorage error');
      });

      const operations = syncManager.getPendingOperations();
      expect(operations).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      jest.restoreAllMocks();
    });

    it('should handle missing auth token', async () => {
      mockLocalStorage.removeItem('auth_token');

      syncManager.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });

      await syncManager.syncPendingOperations();

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

describe('useBackgroundSync hook', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    Object.defineProperty(navigator, 'onLine', { value: true });
  });

  it('should provide sync status', () => {
    const { result } = renderHook(() => useBackgroundSync());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.syncInProgress).toBe(false);
  });

  it('should provide operation management functions', () => {
    const { result } = renderHook(() => useBackgroundSync());

    expect(typeof result.current.addPendingOperation).toBe('function');
    expect(typeof result.current.forceSync).toBe('function');
    expect(typeof result.current.clearPending).toBe('function');
  });

  it('should update status when operations are added', async () => {
    const { result } = renderHook(() => useBackgroundSync());

    expect(result.current.pendingCount).toBe(0);

    act(() => {
      result.current.addPendingOperation({
        type: 'scan',
        volumeId: 'test-volume',
        maxRetries: 3,
      });
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(1);
    });
  });

  it('should update status when network state changes', async () => {
    const { result } = renderHook(() => useBackgroundSync());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      triggerNetworkEvent('offline');
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useBackgroundSync());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

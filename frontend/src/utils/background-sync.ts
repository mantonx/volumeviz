// Background sync utilities for offline operations
import React from 'react';

export interface PendingOperation {
  id: string;
  type: 'scan' | 'refresh' | 'update' | 'index';
  volumeId?: string;
  data?: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export class BackgroundSyncManager {
  private storageKey = 'volumeviz-pending-operations';
  private isOnline = navigator.onLine;
  private syncInProgress = false;

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // Add operation to pending queue
  addPendingOperation(
    operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>,
  ): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pendingOperation: PendingOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const pending = this.getPendingOperations();
    pending.push(pendingOperation);
    this.savePendingOperations(pending);

    // Trigger sync if online
    if (this.isOnline) {
      this.syncPendingOperations();
    }

    return id;
  }

  // Get all pending operations
  getPendingOperations(): PendingOperation[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to get pending operations:', error);
      return [];
    }
  }

  // Save pending operations to storage
  private savePendingOperations(operations: PendingOperation[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(operations));
    } catch (error) {
      console.warn('Failed to save pending operations:', error);
    }
  }

  // Remove operation from pending queue
  private removePendingOperation(id: string): void {
    const pending = this.getPendingOperations();
    const filtered = pending.filter((op) => op.id !== id);
    this.savePendingOperations(filtered);
  }

  // Update retry count for operation
  private updateRetryCount(id: string): void {
    const pending = this.getPendingOperations();
    const operation = pending.find((op) => op.id === id);
    if (operation) {
      operation.retryCount++;
      this.savePendingOperations(pending);
    }
  }

  // Handle online event
  private handleOnline(): void {
    this.isOnline = true;
    console.log('Back online - syncing pending operations');
    this.syncPendingOperations();
  }

  // Handle offline event
  private handleOffline(): void {
    this.isOnline = false;
    console.log('Gone offline - operations will be queued');
  }

  // Sync all pending operations
  async syncPendingOperations(): Promise<void> {
    if (!this.isOnline || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    const pending = this.getPendingOperations();

    console.log(`Syncing ${pending.length} pending operations`);

    for (const operation of pending) {
      try {
        await this.executePendingOperation(operation);
        this.removePendingOperation(operation.id);
        console.log(`Successfully synced operation ${operation.id}`);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);

        // Update retry count
        this.updateRetryCount(operation.id);

        // Remove if max retries exceeded
        if (operation.retryCount >= operation.maxRetries) {
          console.warn(
            `Removing operation ${operation.id} after ${operation.maxRetries} failed attempts`,
          );
          this.removePendingOperation(operation.id);
        }
      }
    }

    this.syncInProgress = false;
  }

  // Execute a pending operation
  private async executePendingOperation(
    operation: PendingOperation,
  ): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No auth token available');
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    switch (operation.type) {
      case 'scan':
        if (!operation.volumeId) throw new Error('Volume ID required for scan');
        await fetch(`/api/v1/volumes/${operation.volumeId}/scan`, {
          method: 'POST',
          headers,
        });
        break;

      case 'refresh':
        if (!operation.volumeId)
          throw new Error('Volume ID required for refresh');
        await fetch(`/api/v1/volumes/${operation.volumeId}/size/refresh`, {
          method: 'POST',
          headers,
        });
        break;

      case 'update':
        if (!operation.volumeId || !operation.data) {
          throw new Error('Volume ID and data required for update');
        }
        await fetch(`/api/v1/volumes/${operation.volumeId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(operation.data),
        });
        break;

      case 'index':
        if (!operation.volumeId)
          throw new Error('Volume ID required for filesystem index');
        await fetch(`/api/v1/volumes/${operation.volumeId}/filesystem/index`, {
          method: 'POST',
          headers,
        });
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  // Clear all pending operations
  clearPendingOperations(): void {
    this.savePendingOperations([]);
  }

  // Get sync status
  getSyncStatus(): {
    isOnline: boolean;
    pendingCount: number;
    syncInProgress: boolean;
  } {
    return {
      isOnline: this.isOnline,
      pendingCount: this.getPendingOperations().length,
      syncInProgress: this.syncInProgress,
    };
  }

  // Force sync (for manual trigger)
  forcSync(): Promise<void> {
    return this.syncPendingOperations();
  }
}

// Global instance
export const backgroundSyncManager = new BackgroundSyncManager();

// React hook for background sync status
export function useBackgroundSync() {
  const [status, setStatus] = React.useState(
    backgroundSyncManager.getSyncStatus(),
  );

  React.useEffect(() => {
    const updateStatus = () => {
      setStatus(backgroundSyncManager.getSyncStatus());
    };

    // Update status periodically
    const interval = setInterval(updateStatus, 1000);

    // Update on network events
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return {
    ...status,
    addPendingOperation: backgroundSyncManager.addPendingOperation.bind(
      backgroundSyncManager,
    ),
    forceSync: backgroundSyncManager.forcSync.bind(backgroundSyncManager),
    clearPending: backgroundSyncManager.clearPendingOperations.bind(
      backgroundSyncManager,
    ),
  };
}

// Enhanced volume operations with offline support
export function createOfflineVolumeOperations() {
  return {
    scanVolume: (volumeId: string) => {
      if (navigator.onLine) {
        // Execute immediately if online
        return fetch(`/api/v1/volumes/${volumeId}/scan`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
      } else {
        // Queue for later if offline
        backgroundSyncManager.addPendingOperation({
          type: 'scan',
          volumeId,
          maxRetries: 3,
        });
        return Promise.resolve({ queued: true, offline: true });
      }
    },

    refreshVolumeSize: (volumeId: string) => {
      if (navigator.onLine) {
        return fetch(`/api/v1/volumes/${volumeId}/size/refresh`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
      } else {
        backgroundSyncManager.addPendingOperation({
          type: 'refresh',
          volumeId,
          maxRetries: 3,
        });
        return Promise.resolve({ queued: true, offline: true });
      }
    },

    indexFilesystem: (volumeId: string) => {
      if (navigator.onLine) {
        return fetch(`/api/v1/volumes/${volumeId}/filesystem/index`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
        });
      } else {
        backgroundSyncManager.addPendingOperation({
          type: 'index',
          volumeId,
          maxRetries: 5,
        });
        return Promise.resolve({ queued: true, offline: true });
      }
    },

    updateVolume: (volumeId: string, data: any) => {
      if (navigator.onLine) {
        return fetch(`/api/v1/volumes/${volumeId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
      } else {
        backgroundSyncManager.addPendingOperation({
          type: 'update',
          volumeId,
          data,
          maxRetries: 5,
        });
        return Promise.resolve({ queued: true, offline: true });
      }
    },
  };
}

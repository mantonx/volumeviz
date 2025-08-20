import { useState, useEffect, useCallback, useRef } from 'react';
import { atom, useAtom } from 'jotai';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { ScanOperation } from '@/components/domain/ScanManagerDashboard';
import type { ScanNotification } from '@/components/domain/ScanNotificationCenter';
import type { ScanData } from '@/components/domain/ScanProgressModal';

// Atoms for global scan state
export const activeScanOperationsAtom = atom<ScanOperation[]>([]);
export const scanNotificationsAtom = atom<ScanNotification[]>([]);
export const scanProgressDataAtom = atom<Map<string, ScanData>>(new Map());

export interface UseScanMonitoringOptions {
  /** Auto-subscribe to scan events on mount */
  autoSubscribe?: boolean;
  /** Volume ID to filter scan events (optional) */
  volumeId?: string;
  /** Enable notifications for scan events */
  enableNotifications?: boolean;
  /** Max notifications to keep */
  maxNotifications?: number;
}

export interface UseScanMonitoringReturn {
  /** Active scan operations */
  scanOperations: ScanOperation[];
  /** Scan notifications */
  notifications: ScanNotification[];
  /** Get detailed scan data by ID */
  getScanData: (scanId: string) => ScanData | undefined;
  /** Start a new scan */
  startScan: (volumeId: string, options?: any) => Promise<void>;
  /** Pause a scan */
  pauseScan: (scanId: string) => Promise<void>;
  /** Resume a scan */
  resumeScan: (scanId: string) => Promise<void>;
  /** Cancel a scan */
  cancelScan: (scanId: string) => Promise<void>;
  /** Retry a failed scan */
  retryScan: (scanId: string) => Promise<void>;
  /** Clear completed scans */
  clearCompleted: () => void;
  /** Clear a notification */
  clearNotification: (notificationId: string) => void;
  /** Clear all notifications */
  clearAllNotifications: () => void;
  /** Mark notification as read */
  markNotificationAsRead: (notificationId: string) => void;
  /** Connection status */
  isConnected: boolean;
}

export const useScanMonitoring = (
  options: UseScanMonitoringOptions = {}
): UseScanMonitoringReturn => {
  const {
    autoSubscribe = true,
    volumeId,
    enableNotifications = true,
    maxNotifications = 50,
  } = options;

  const { on, off, send, isConnected } = useWebSocket();
  const [scanOperations, setScanOperations] = useAtom(activeScanOperationsAtom);
  const [notifications, setNotifications] = useAtom(scanNotificationsAtom);
  const [scanProgressData, setScanProgressData] = useAtom(scanProgressDataAtom);
  
  // Track subscribed scan IDs to avoid duplicates
  const subscribedScansRef = useRef<Set<string>>(new Set());

  // Convert WebSocket scan event to ScanOperation
  const convertToScanOperation = useCallback((event: any): ScanOperation => {
    return {
      scanId: event.scan_id || event.id,
      volumeId: event.volume_id,
      volumeName: event.volume_name || event.volume_id,
      status: event.status || 'pending',
      progress: event.progress || 0,
      phase: event.phase || 'initializing',
      startedAt: event.started_at || new Date().toISOString(),
      completedAt: event.completed_at,
      filesScanned: event.files_scanned || 0,
      foldersScanned: event.folders_scanned || 0,
      bytesScanned: event.bytes_scanned || 0,
      filesPerSecond: event.files_per_second || 0,
      bytesPerSecond: event.bytes_per_second || 0,
      currentPath: event.current_path || '',
      errorsCount: event.errors_count || 0,
      lastError: event.last_error,
      estimatedTimeRemaining: event.estimated_time_remaining,
    };
  }, []);

  // Convert scan event to ScanData for progress modal
  const convertToScanData = useCallback((event: any): ScanData => {
    return {
      context: {
        id: event.scan_id || event.id,
        volumeId: event.volume_id,
        volumeName: event.volume_name || event.volume_id,
        volumePath: event.volume_path || `/var/lib/docker/volumes/${event.volume_id}`,
        scanType: event.scan_type || 'full',
        trigger: event.trigger || 'manual',
        options: {
          includeHidden: event.include_hidden || false,
          enableMetadataExtraction: event.enable_metadata || true,
          maxDepth: event.max_depth,
          excludePatterns: event.exclude_patterns || [],
        },
      },
      status: event.status || 'pending',
      phases: event.phases || [],
      statistics: {
        processedFiles: event.files_scanned || 0,
        totalFiles: event.total_files || 0,
        processedSize: event.bytes_scanned || 0,
        totalSize: event.total_bytes || 0,
        skippedFiles: event.skipped_files || 0,
        errorFiles: event.error_files || 0,
        averageFileSize: event.average_file_size || 0,
        throughput: {
          filesPerSecond: event.files_per_second || 0,
          foldersPerSecond: event.folders_per_second || 0,
          bytesPerSecond: event.bytes_per_second || 0,
          averageThroughput: event.average_throughput || 0,
        },
        timing: {
          startTime: new Date(event.started_at || Date.now()),
          elapsedTime: event.elapsed_time || 0,
          remainingTime: event.estimated_time_remaining,
        },
      },
      errors: event.errors || [],
      warnings: event.warnings || [],
    };
  }, []);

  // Create notification from scan event
  const createNotification = useCallback((
    event: any,
    type: 'info' | 'success' | 'warning' | 'error'
  ): ScanNotification => {
    const messages: Record<string, string> = {
      scan_started: `Scan started for ${event.volume_name || event.volume_id}`,
      scan_progress: `Scanning ${event.volume_name}: ${event.progress}% complete`,
      scan_completed: `Scan completed for ${event.volume_name}`,
      scan_failed: `Scan failed for ${event.volume_name}: ${event.error || 'Unknown error'}`,
      scan_paused: `Scan paused for ${event.volume_name}`,
      scan_resumed: `Scan resumed for ${event.volume_name}`,
      scan_cancelled: `Scan cancelled for ${event.volume_name}`,
    };

    return {
      id: `${event.scan_id || event.id}_${Date.now()}`,
      type,
      title: messages[event.type] || 'Scan Update',
      message: event.message || '',
      timestamp: new Date().toISOString(),
      scanId: event.scan_id || event.id,
      volumeId: event.volume_id,
      volumeName: event.volume_name,
      read: false,
      persistent: type === 'error',
    };
  }, []);

  // Handle scan progress event
  const handleScanProgress = useCallback((event: any) => {
    // Filter by volume if specified
    if (volumeId && event.volume_id !== volumeId) {
      return;
    }

    const scanOp = convertToScanOperation(event);
    const scanData = convertToScanData(event);

    // Update scan operations
    setScanOperations((prev) => {
      const index = prev.findIndex((s) => s.scanId === scanOp.scanId);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = scanOp;
        return updated;
      }
      return [...prev, scanOp];
    });

    // Update scan progress data
    setScanProgressData((prev) => {
      const updated = new Map(prev);
      updated.set(scanOp.scanId, scanData);
      return updated;
    });

    // Create notification for significant events
    if (enableNotifications) {
      let notification: ScanNotification | null = null;

      switch (event.type) {
        case 'scan_started':
          notification = createNotification(event, 'info');
          break;
        case 'scan_completed':
          notification = createNotification(event, 'success');
          // Remove from active operations after a delay
          setTimeout(() => {
            setScanOperations((prev) =>
              prev.filter((s) => s.scanId !== scanOp.scanId)
            );
          }, 5000);
          break;
        case 'scan_failed':
          notification = createNotification(event, 'error');
          break;
        case 'scan_error':
          if (event.errors_count > 0) {
            notification = createNotification(event, 'warning');
          }
          break;
      }

      if (notification) {
        setNotifications((prev) => {
          const updated = [notification, ...prev];
          // Limit notifications
          if (updated.length > maxNotifications) {
            updated.splice(maxNotifications);
          }
          return updated;
        });
      }
    }
  }, [
    volumeId,
    enableNotifications,
    maxNotifications,
    convertToScanOperation,
    convertToScanData,
    createNotification,
    setScanOperations,
    setScanProgressData,
    setNotifications,
  ]);

  // Start a new scan
  const startScan = useCallback(async (volumeId: string, options: any = {}) => {
    console.log('[useScanMonitoring] Starting scan for volume:', volumeId, 'options:', options);
    try {
      const url = `/api/v1/volumes/${volumeId}/scan`;
      console.log('[useScanMonitoring] POST request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...options,
        }),
      });

      console.log('[useScanMonitoring] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useScanMonitoring] Error response:', errorText);
        throw new Error(`Failed to start scan: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[useScanMonitoring] Scan started successfully, response data:', data);
      
      // Subscribe to this scan's events
      if (data.scan_id && !subscribedScansRef.current.has(data.scan_id)) {
        send({
          type: 'subscribe',
          data: { scan_id: data.scan_id },
        });
        subscribedScansRef.current.add(data.scan_id);
      }
    } catch (error) {
      console.error('[useScanMonitoring] Failed to start scan:', error);
      throw error;
    }
  }, [send]);

  // Pause a scan (not implemented in backend yet)
  const pauseScan = useCallback(async (scanId: string) => {
    console.warn('Pause scan not implemented in backend yet:', scanId);
    // TODO: Implement when backend supports pause
  }, []);

  // Resume a scan (not implemented in backend yet)
  const resumeScan = useCallback(async (scanId: string) => {
    console.warn('Resume scan not implemented in backend yet:', scanId);
    // TODO: Implement when backend supports resume
  }, []);

  // Cancel a scan (not implemented in backend yet)
  const cancelScan = useCallback(async (scanId: string) => {
    console.warn('Cancel scan not implemented in backend yet:', scanId);
    // TODO: Implement when backend supports cancel
    
    // For now, just remove from UI
    setScanOperations((prev) =>
      prev.filter((s) => s.scanId !== scanId)
    );
  }, [setScanOperations]);

  // Retry a failed scan
  const retryScan = useCallback(async (scanId: string) => {
    const scanData = scanProgressData.get(scanId);
    if (scanData) {
      await startScan(scanData.context.volumeId, {
        scan_type: scanData.context.scanType,
        ...scanData.context.options,
      });
    }
  }, [scanProgressData, startScan]);

  // Clear completed scans
  const clearCompleted = useCallback(() => {
    setScanOperations((prev) =>
      prev.filter((s) => s.status !== 'completed' && s.status !== 'failed')
    );
  }, [setScanOperations]);

  // Clear a notification
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.filter((n) => n.id !== notificationId)
    );
  }, [setNotifications]);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);

  // Mark notification as read
  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  }, [setNotifications]);

  // Get scan data by ID
  const getScanData = useCallback((scanId: string): ScanData | undefined => {
    return scanProgressData.get(scanId);
  }, [scanProgressData]);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!autoSubscribe || !isConnected) {
      return;
    }

    // Subscribe to scan events
    const events = [
      'scan_started',
      'scan_progress',
      'scan_completed',
      'scan_failed',
      'scan_paused',
      'scan_resumed',
      'scan_cancelled',
      'scan_error',
    ];

    events.forEach((event) => {
      on(event, handleScanProgress);
    });

    // Subscribe to global scan updates
    send({
      type: 'subscribe',
      data: { channel: 'scans', volume_id: volumeId },
    });

    return () => {
      events.forEach((event) => {
        off(event, handleScanProgress);
      });

      // Unsubscribe from global scan updates
      send({
        type: 'unsubscribe',
        data: { channel: 'scans', volume_id: volumeId },
      });
    };
  }, [autoSubscribe, isConnected, volumeId, on, off, send, handleScanProgress]);

  return {
    scanOperations,
    notifications,
    getScanData,
    startScan,
    pauseScan,
    resumeScan,
    cancelScan,
    retryScan,
    clearCompleted,
    clearNotification,
    clearAllNotifications,
    markNotificationAsRead,
    isConnected,
  };
};
/**
 * Volume-specific WebSocket event types
 * Phase 3: Real-time volume size updates
 */

// Volume size updated event (Phase 3)
export interface VolumeSizeUpdatedEvent {
  volume_id: string;
  size_bytes: number;
  calculation_time: number; // seconds
  timestamp: string;
}

// Volume metadata updated event (future)
export interface VolumeMetadataUpdatedEvent {
  volume_id: string;
  metadata: Record<string, any>;
  timestamp: string;
}

// Volume scan progress event
export interface VolumeScanProgressEvent {
  volume_id: string;
  scan_id: string;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  files_scanned?: number;
  total_files?: number;
  timestamp: string;
}

// Union type for all volume events
export type VolumeEvent =
  | VolumeSizeUpdatedEvent
  | VolumeMetadataUpdatedEvent
  | VolumeScanProgressEvent;

// Event type constants
export const VolumeEventTypes = {
  SIZE_UPDATED: 'volume.size_updated',
  METADATA_UPDATED: 'volume.metadata_updated',
  SCAN_PROGRESS: 'volume.scan_progress',
} as const;

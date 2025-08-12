/**
 * Global type definitions for Cypress E2E tests
 */

/// <reference types="cypress" />

// Extend global window interface for test utilities
declare global {
  interface Window {
    // WebSocket test shim
    __TEST_WS__?: {
      state: 'connecting' | 'connected' | 'disconnected' | 'error';
      url: string;
      emit: (eventType: string, data: any) => void;
      on: (eventType: string, handler: (data: any) => void) => void;
      off: (eventType: string, handler: (data: any) => void) => void;
      connect: () => void;
      disconnect: () => void;
      reconnect: () => void;
      getState: () => any;
      cleanup: () => void;
      simulateError: (error: string) => void;
      simulateLatency: (ms: number) => void;
    };
    
    // Test data fixtures
    __TEST_DATA__?: any;
    
    // Test mode flag
    __TEST_MODE__?: boolean;
    
    // React reference for testing
    React?: any;
  }
}

// Volume data types for testing
export interface TestVolume {
  name: string;
  driver: string;
  created_at: string;
  size_bytes?: number;
  attachments_count: number;
  is_system: boolean;
  is_orphaned: boolean;
  labels: Record<string, string>;
}

// API response types for mocking
export interface TestApiResponse<T = any> {
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

// WebSocket event types for testing
export interface TestWebSocketEvent {
  type: string;
  ts: string;
  data: any;
}

// Scan operation types
export interface TestScanProgress {
  volume_id: string;
  progress: number;
  current_size: number;
  files_processed: number;
  method: 'du' | 'manual';
  started_at: string;
}

export interface TestScanComplete {
  volume_id: string;
  total_size: number;
  file_count: number;
  directory_count: number;
  method: 'du' | 'manual';
  duration: number;
  scanned_at: string;
}

// Volume update types
export interface TestVolumeUpdate {
  volume_id: string;
  volume_name: string;
  action: 'created' | 'removed' | 'attached' | 'detached';
  details: Record<string, any>;
}

// Status pill state types
export interface TestStatusPillState {
  api: 'OK' | 'Error';
  websocket?: 'Connected' | 'Connecting' | 'Reconnecting' | 'Disconnected' | 'Error';
  hasWebSocket?: boolean;
}

// Cypress environment variables
export interface TestEnvironment {
  API_BASE_URL: string;
  WS_URL: string;
  ENABLE_WEBSOCKET: boolean;
  ENABLE_DEV_PANEL: boolean;
  COMMAND_TIMEOUT: number;
  RESPONSE_TIMEOUT: number;
  DEBUG_WS?: boolean;
}

// Export for module compatibility
export {};
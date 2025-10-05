// =============================================================================
// COMPREHENSIVE REAL-TIME EVENT TYPES
// =============================================================================

// Historical Data Event Types
export interface HistoricalDataUpdate {
  volume_id: string;
  scan_id: string;
  update_type: 'scan_completed' | 'data_archived' | 'trends_updated';
  total_size: number;
  file_count: number;
  directory_count: number;
  scan_duration_ms: number;
  method: string;
  completed_at: string;
  trend_data?: TrendData;
}

export interface TrendData {
  growth_rate_percent: number;
  size_change_bytes: number;
  file_count_change: number;
  last_compared_scan: string;
  trend_direction: 'growing' | 'shrinking' | 'stable';
}

// Statistics Event Types
export interface StatisticsUpdate {
  update_type: 'usage_snapshot' | 'performance_metrics' | 'capacity_alert';
  timestamp: string;
  system_stats?: SystemStatistics;
  volume_stats?: VolumeStatistics;
  performance_data?: PerformanceMetrics;
  alert_data?: AlertInformation;
}

export interface SystemStatistics {
  total_volumes: number;
  active_scans: number;
  total_storage_bytes: number;
  total_files: number;
  total_directories: number;
  average_growth_rate: number;
  system_health_score: number;
}

export interface VolumeStatistics {
  volume_id: string;
  current_size: number;
  file_count: number;
  directory_count: number;
  growth_rate_percent: number;
  last_scan_time: string;
  scan_frequency: string;
  health_status: string;
}

export interface PerformanceMetrics {
  average_scan_duration_ms: number;
  scans_per_hour: number;
  system_load: number;
  memory_usage_percent: number;
  disk_io_rate_mbps: number;
  network_latency_ms: number;
  error_rate_percent: number;
}

export interface AlertInformation {
  alert_id: string;
  alert_type: 'capacity' | 'performance' | 'error' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  volume_id?: string;
  title: string;
  message: string;
  action_required: boolean;
  created_at: string;
}

// System Health Event Types
export interface SystemHealthUpdate {
  timestamp: string;
  overall_health: 'healthy' | 'degraded' | 'critical';
  health_score: number; // 0.0 - 1.0
  components: ComponentHealth[];
  recent_events: SystemEvent[];
  recommendations?: string[];
}

export interface ComponentHealth {
  component_name: 'scanner' | 'database' | 'websocket' | 'storage';
  status: 'healthy' | 'warning' | 'error';
  last_checked: string;
  response_time_ms?: number;
  error_count: number;
  details?: string;
}

export interface SystemEvent {
  event_id: string;
  event_type: 'startup' | 'shutdown' | 'error' | 'recovery' | 'maintenance';
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Error Event Types
export interface ErrorEvent {
  error_id: string;
  timestamp: string;
  error_type:
    | 'scan_error'
    | 'system_error'
    | 'network_error'
    | 'database_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  volume_id?: string;
  scan_id?: string;
  error_message: string;
  technical_details: string;
  user_impact: string;
  resolution?: string;
  context?: Record<string, any>;
}

// Scan Progress Event Types
export interface ScanPhaseProgress {
  phase_name: string;
  phase_order: number;
  status: string;
  progress: number;
  items_processed: number;
  items_total: number;
  items_successful: number;
  items_failed: number;
  bytes_processed: number;
  bytes_total: number;
  items_per_second: number;
  bytes_per_second: number;
  current_item?: string;
  sub_phase?: string; // Current sub-phase or enricher (e.g., "ffprobe", "exif")
  current_depth: number;
  started_at?: string;
  completed_at?: string;
  estimated_end_time?: string;
  error_message?: string;
  error_count: number;
}

export interface ScanError {
  error_type: string;
  error_category: string;
  severity: string;
  component: string;
  operation: string;
  item_path?: string;
  item_name?: string;
  error_message: string;
  technical_details?: string;
  occurred_at: string;
  retry_count: number;
}

export interface PerformanceStats {
  elapsed_seconds: number;
  estimated_remaining_seconds: number;
  estimation_confidence: string;
  overall_items_per_second: number;
  overall_bytes_per_second: number;
  error_rate: number;
}

export interface ScanProgressData {
  scan_id: string;
  volume_id: string;
  overall_status: string;
  overall_progress: number;
  phases: ScanPhaseProgress[];
  recent_errors: ScanError[];
  performance_stats?: PerformanceStats;
  started_at?: string;
  completed_at?: string;
  metadata?: Record<string, any>;
}

// WebSocket Message Types
export interface RealtimeMessage {
  type: string;
  data: any;
  timestamp: string;
  room?: string;
  metadata?: Record<string, any>;
}

export interface SubscriptionMessage {
  action: 'subscribe' | 'unsubscribe';
  event: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

// Connection State Types
export interface ConnectionMetrics {
  latency: number | null;
  reconnectAttempts: number;
  connectedAt?: Date;
  connectionStatus: number; // ReadyState
  isConnected: boolean;
}

// Event Listener Types
export type EventCallback<T = any> = (data: T) => void;
export type EventCleanupFunction = () => void;
export type EventListener<T = any> = (
  callback: EventCallback<T>,
) => EventCleanupFunction;

// Realtime Context Value Interface
export interface RealtimeContextValue {
  // Connection state
  connectionStatus: number;
  isConnected: boolean;

  // Connection metrics
  latency: number | null;
  reconnectAttempts: number;
  connectedAt?: Date;

  // Message handling
  lastMessage: MessageEvent<any> | null;
  sendMessage: (message: any) => void;

  // Subscription management
  subscribe: (event: string, filters?: Record<string, any>) => void;
  unsubscribe: (event: string, filters?: Record<string, any>) => void;

  // Event listeners - Scan Events
  onScanProgress: EventListener<ScanProgressData>;
  onScanEvent: (
    callback: (type: string, data: any) => void,
  ) => EventCleanupFunction;
  onVolumeUpdate: EventListener<any>;
  onVolumeState: EventListener<any>;
  onScanStatus: EventListener<any>;

  // Event listeners - Comprehensive Real-time Events
  onHistoricalDataUpdate: EventListener<HistoricalDataUpdate>;
  onStatisticsUpdate: EventListener<StatisticsUpdate>;
  onSystemHealthUpdate: EventListener<SystemHealthUpdate>;
  onErrorEvent: EventListener<ErrorEvent>;

  // Event listeners - Specific Event Types (for convenience)
  onUsageSnapshot: EventListener<StatisticsUpdate>;
  onPerformanceMetrics: EventListener<StatisticsUpdate>;
  onCapacityAlert: EventListener<StatisticsUpdate>;
  onSystemAlert: EventListener<SystemHealthUpdate>;
  onCriticalError: EventListener<ErrorEvent>;
}

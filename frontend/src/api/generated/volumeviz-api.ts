/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

/** @format int64 */
export enum TimeDuration {
  MinDuration = -9223372036854776000,
  MaxDuration = 9223372036854776000,
  Nanosecond = 1,
  Microsecond = 1000,
  Millisecond = 1000000,
  Second = 1000000000,
  Minute = 60000000000,
  Hour = 3600000000000,
}

export enum InternalApiV1DiagRealtimeMode {
  ModeWebSocket = "ws",
  ModePolling = "polling",
  ModeSSE = "sse",
}

export interface AsyncScanResponse {
  /** @example "scan_tv-shows-readonly_1640995200" */
  scan_id?: string;
  /** @example "started" */
  status?: string;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface BulkScanRequest {
  /** @example false */
  async?: boolean;
  /** @example "du" */
  method?: string;
  /** @example ["tv-shows-readonly","movies-readonly"] */
  volume_ids: string[];
}

export interface DailyStats {
  /** @example "2023-01-01" */
  date?: string;
  /** @example 2500 */
  file_count?: number;
  /** @example 150 */
  folder_count?: number;
  /** @example 52428800 */
  growth?: number;
  /** @example 5.12 */
  growth_rate?: number;
  /** @example 1073741824 */
  size_bytes?: number;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface DockerHealth {
  /** @example "1.41" */
  api_version?: string;
  /** @example "2021-07-30T19:52:10.000000000+00:00" */
  build_time?: string;
  /** @example "75249d8" */
  git_commit?: string;
  /** @example "go1.16.6" */
  go_version?: string;
  /** @example "Docker daemon is responsive" */
  message?: string;
  /** @example "healthy" */
  status?: string;
  /** @example "20.10.8" */
  version?: string;
}

export interface ErrorResponse {
  /** @example "VOLUME_NOT_FOUND" */
  code?: string;
  details?: Record<string, any>;
  /** @example "Volume not found" */
  error?: string;
  /** @example "Additional error details" */
  message?: string;
}

export interface ExtensionOption {
  /** @example 1250 */
  file_count?: number;
  /** @example "MP4 Files" */
  label?: string;
  /** @example "mp4" */
  value?: string;
}

export interface FileDetailsResponse {
  checksums?: Record<string, string>;
  created?: string;
  /** @example 1073741824 */
  disk_usage?: number;
  /** @example "mp4" */
  extension?: string;
  /** @example 123 */
  id?: number;
  is_symlink?: boolean;
  /** @example "video" */
  media_kind?: string;
  /** @example "video/mp4" */
  mime_type?: string;
  modified?: string;
  /** @example "movie.mp4" */
  name?: string;
  /** @example "/media/movies/movie.mp4" */
  path?: string;
  permissions?: FilePermissions;
  /** @example 1073741824 */
  size?: number;
  symlink_target?: string;
  /** @example "media-library" */
  volume_id?: string;
}

export interface FileMetadataResponse {
  /** @example true */
  enriched?: boolean;
  /** @example 123 */
  file_id?: number;
  metadata?: Record<string, any>;
  updated_at?: string;
}

export interface FilePermissions {
  /** @example 1000 */
  gid?: number;
  /** @example "users" */
  group?: string;
  /** @example 644 */
  mode?: number;
  /** @example "user" */
  owner?: string;
  /** @example 1000 */
  uid?: number;
}

export interface FilesystemCapabilitiesResponse {
  /** @example true */
  enabled?: boolean;
  features?: Record<string, boolean>;
  /** @example ["sha256","md5"] */
  supported_hash_algorithms?: string[];
  /** @example ["image","video","audio"] */
  supported_media_kinds?: string[];
}

export interface FilesystemCapacity {
  /**
   * Available space in bytes
   * @example 114419344240640
   */
  available_bytes?: number;
  /**
   * Filesystem block size
   * @example 1024
   */
  block_size?: number;
  /**
   * Free blocks available
   * @example 111737640860
   */
  free_blocks?: number;
  /**
   * Total blocks
   * @example 260720725420
   */
  total_blocks?: number;
  /**
   * Total filesystem capacity in bytes
   * @example 266978022830080
   */
  total_bytes?: number;
  /**
   * Usage percentage (0-100)
   * @example 57.14
   */
  usage_percent?: number;
  /**
   * Used space in bytes
   * @example 152558678589440
   */
  used_bytes?: number;
}

export interface FilesystemIndexingResponse {
  /** @example 1073741824 */
  bytes_processed?: number;
  /** @example 3 */
  current_depth?: number;
  /** @example "/data/movies/action" */
  current_path?: string;
  /** @example 2 */
  errors_count?: number;
  /** @example 150.2 */
  files_per_sec?: number;
  /** @example 2500 */
  files_scanned?: number;
  /** @example 10.5 */
  folders_per_sec?: number;
  /** @example 150 */
  folders_scanned?: number;
  /** @example "Permission denied on /data/restricted" */
  last_error?: string;
  /** @example "2023-01-01T10:30:00Z" */
  last_update?: string;
  /** @example "Indexing in progress" */
  message?: string;
  /** @example "2023-01-01T10:00:00Z" */
  started_at?: string;
  /** @example "running" */
  status?: "pending" | "running" | "completed" | "failed";
  /** @example "tv-shows" */
  volume_id?: string;
}

export interface FilterMetadataResponse {
  extensions?: ExtensionOption[];
  media_kinds?: MediaKindOption[];
  mime_types?: MimeTypeOption[];
}

export interface FolderSizeInfo {
  /** @example 1 */
  dir_count?: number;
  /** @example 5368709120 */
  disk_usage_bytes_recursive?: number;
  /** @example 24 */
  file_count?: number;
  /** @example 123 */
  id?: number;
  /** @example "Season 1" */
  name?: string;
  /** @example "/data/tv-shows/Series/Season 1" */
  path?: string;
  /** @example 25.5 */
  percentage_of_volume?: number;
  /** @example 5368709120 */
  size_bytes_recursive?: number;
}

export interface MediaCapabilitiesResponse {
  /** @example true */
  enabled?: boolean;
  /** @example 10737418240 */
  max_file_size?: number;
  /** @example true */
  metadata_supported?: boolean;
  /** @example ["mp4","avi","mkv","jpg","png"] */
  supported_formats?: string[];
  /** @example ["video","image","audio"] */
  supported_kinds?: string[];
  /** @example true */
  thumbnail_supported?: boolean;
}

export interface MediaEnrichmentResponse {
  /** @example "/data/movies/action/movie.mp4" */
  current_file?: string;
  /** @example 5 */
  errors_count?: number;
  /** @example 25.5 */
  files_per_sec?: number;
  /** @example 450 */
  files_processed?: number;
  /** @example "Unsupported codec in file" */
  last_error?: string;
  /** @example "2023-01-01T10:30:00Z" */
  last_update?: string;
  /** @example "Enriching media files" */
  message?: string;
  /** @example "2023-01-01T10:00:00Z" */
  started_at?: string;
  /** @example "running" */
  status?: "pending" | "running" | "completed" | "failed";
  /** @example 1000 */
  total_files?: number;
  /** @example "tv-shows" */
  volume_id?: string;
}

export interface MediaEnrichmentStatusResponse {
  /** @example 12 */
  errors_count?: number;
  /** @example 855 */
  files_processed?: number;
  /** @example "2023-01-01T11:30:00Z" */
  last_update?: string;
  /** @example "Enrichment completed with minor errors" */
  message?: string;
  /** @example 85.5 */
  progress?: number;
  /** @example "2023-01-01T10:00:00Z" */
  started_at?: string;
  /** @example "completed" */
  status?: "pending" | "running" | "completed" | "failed";
  /** @example 1000 */
  total_files?: number;
  /** @example "tv-shows" */
  volume_id?: string;
}

export interface MediaKindOption {
  /** @example 5000 */
  file_count?: number;
  /** @example "Video" */
  label?: string;
  /** @example "video" */
  value?: string;
}

export interface MimeTypeOption {
  /** @example 1250 */
  file_count?: number;
  /** @example "MP4 Video" */
  label?: string;
  /** @example "video/mp4" */
  value?: string;
}

export interface RefreshRequest {
  /** @example false */
  async?: boolean;
  /** @example "du" */
  method?: string;
}

export interface ScanResponse {
  /** @example false */
  cached?: boolean;
  result?: ScanResult;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface ScanResult {
  /** @example false */
  cache_hit?: boolean;
  /** @example 1204 */
  directory_count?: number;
  /** @example 13248000000 */
  duration?: TimeDuration;
  /** @example 12543 */
  file_count?: number;
  /** @example "cifs" */
  filesystem_type?: string;
  /** @example 8589934592 */
  largest_file?: number;
  /** @example "du" */
  method?: string;
  scanned_at?: string;
  /** @example 70640394854400 */
  total_size?: number;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface StatsSummary {
  /** @example 1048576 */
  average_growth?: number;
  /** @example "increasing" */
  growth_trend?: "increasing" | "decreasing" | "stable";
  /** @example 2500 */
  total_files?: number;
  /** @example 150 */
  total_folders?: number;
  /** @example 1073741824 */
  total_size?: number;
}

export interface TopFoldersResponse {
  folders?: FolderSizeInfo[];
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface VolumeStatsResponse {
  daily_stats?: DailyStats[];
  /** @example "30d" */
  period?: "7d" | "30d" | "90d" | "365d";
  summary?: StatsSummary;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface VolumeV1 {
  /** @example 2 */
  attachments_count?: number;
  /** @example "2023-01-01T10:00:00Z" */
  created_at?: string;
  /** @example "local" */
  driver?: string;
  filesystem_capacity?: FilesystemCapacity;
  /** @example false */
  is_orphaned?: boolean;
  /** @example false */
  is_system?: boolean;
  /** @example {"com.docker.compose.project":"media"} */
  labels?: Record<string, string>;
  /** @example "2023-01-01T12:00:00Z" */
  last_scan_at?: string;
  /** @example "/var/lib/docker/volumes/tv-shows-readonly/_data" */
  mountpoint?: string;
  /** @example "tv-shows-readonly" */
  name?: string;
  /** @example "local" */
  scope?: string;
  /** @example 1073741824 */
  size_bytes?: number;
}

export type GinH = Record<string, any>;

export interface GithubComMantonxVolumevizInternalApiUtilsPagedResponse {
  data?: any;
  filters?: Record<string, any>;
  page?: number;
  page_size?: number;
  sort?: string;
  total?: number;
}

export interface GithubComMantonxVolumevizInternalModelsAlert {
  annotations?: Record<string, string>;
  created_at?: string;
  /** For deduplication */
  dedupe_key?: string;
  ends_at?: string;
  /** e.g., volume_id, container_id */
  entity_id?: string;
  /** e.g., "volume", "container" */
  entity_type?: string;
  id?: number;
  labels?: Record<string, string>;
  /** Relationships */
  rule?: GithubComMantonxVolumevizInternalModelsAlertRule;
  rule_id?: number;
  starts_at?: string;
  /** "firing", "resolved" */
  status?: string;
  updated_at?: string;
  value?: number;
}

export interface GithubComMantonxVolumevizInternalModelsAlertDestination {
  config?: Record<string, any>;
  created_at?: string;
  id?: number;
  is_enabled?: boolean;
  name?: string;
  /** "webhook", "slack", "pushover" */
  type?: string;
  updated_at?: string;
}

export interface GithubComMantonxVolumevizInternalModelsAlertRoute {
  created_at?: string;
  /** Relationships */
  destination?: GithubComMantonxVolumevizInternalModelsAlertDestination;
  destination_id?: number;
  id?: number;
  is_enabled?: boolean;
  /** Label matchers */
  matchers?: Record<string, string>;
  name?: string;
  /** Lower number = higher priority */
  priority?: number;
  updated_at?: string;
}

export interface GithubComMantonxVolumevizInternalModelsAlertRule {
  /** e.g., "gt", "lt", "eq" */
  condition?: string;
  created_at?: string;
  description?: string;
  /** How long condition must persist */
  for?: TimeDuration;
  id?: number;
  /** How often to evaluate */
  interval?: TimeDuration;
  is_enabled?: boolean;
  labels?: Record<string, string>;
  name?: string;
  query?: string;
  threshold?: number;
  updated_at?: string;
}

export interface GithubComMantonxVolumevizInternalModelsCreateAlertDestinationParams {
  config: Record<string, any>;
  is_enabled?: boolean;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  type: "webhook" | "slack" | "pushover";
}

export interface GithubComMantonxVolumevizInternalModelsCreateAlertRouteParams {
  destination_id: number;
  is_enabled?: boolean;
  matchers: Record<string, string>;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  /** @min 0 */
  priority?: number;
}

export interface GithubComMantonxVolumevizInternalModelsCreateAlertRuleParams {
  condition: "gt" | "lt" | "eq" | "ne" | "gte" | "lte";
  /** @maxLength 500 */
  description?: string;
  /** @min 0 */
  for?: TimeDuration;
  interval: TimeDuration;
  is_enabled?: boolean;
  labels?: Record<string, string>;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  query: string;
  threshold: number;
}

export interface GithubComMantonxVolumevizInternalModelsErrorResponse {
  code?: string;
  details?: string;
  error?: string;
  message?: string;
}

export interface GithubComMantonxVolumevizInternalModelsFilesystemIndexingRequest {
  delta_mode?: boolean;
  full_scan?: boolean;
}

export interface GithubComMantonxVolumevizInternalModelsUpdateAlertDestinationParams {
  config: Record<string, any>;
  id?: number;
  is_enabled?: boolean;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  type: "webhook" | "slack" | "pushover";
}

export interface GithubComMantonxVolumevizInternalModelsUpdateAlertRouteParams {
  destination_id: number;
  id?: number;
  is_enabled?: boolean;
  matchers: Record<string, string>;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  /** @min 0 */
  priority?: number;
}

export interface GithubComMantonxVolumevizInternalModelsUpdateAlertRuleParams {
  condition: "gt" | "lt" | "eq" | "ne" | "gte" | "lte";
  /** @maxLength 500 */
  description?: string;
  /** @min 0 */
  for?: TimeDuration;
  id?: number;
  interval: TimeDuration;
  is_enabled?: boolean;
  labels?: Record<string, string>;
  /**
   * @minLength 1
   * @maxLength 100
   */
  name: string;
  query: string;
  threshold: number;
}

export interface GithubComMantonxVolumevizInternalServicesRulesActionBreakdown {
  exclude?: number;
  include?: number;
  unmatched?: number;
}

export interface GithubComMantonxVolumevizInternalServicesRulesConditionResult {
  error?: any;
  field_name?: string;
  matched?: boolean;
  operator?: string;
  value?: string;
}

export interface GithubComMantonxVolumevizInternalServicesRulesConflictAnalysis {
  conflicting_rules?: GithubComMantonxVolumevizInternalServicesRulesRuleConflict[];
  has_conflicts?: boolean;
  /** how conflicts are resolved */
  resolution?: string;
}

export interface GithubComMantonxVolumevizInternalServicesRulesMountPreview {
  /** whether action would change */
  action_changed?: boolean;
  /** all matching rules (if detailed) */
  all_matches?: GithubComMantonxVolumevizInternalServicesRulesRuleMatchSummary[];
  /** rule conflicts if any */
  conflict_details?: GithubComMantonxVolumevizInternalServicesRulesConflictAnalysis;
  /** current tracking status */
  current_action?: string;
  mount?: GithubComMantonxVolumevizInternalServicesRulesMountSummary;
  /** predicted action based on rules */
  preview_action?: string;
  /** highest priority matching rule */
  winning_rule?: GithubComMantonxVolumevizInternalServicesRulesRuleMatchSummary;
}

export interface GithubComMantonxVolumevizInternalServicesRulesMountSummary {
  compose_project?: string;
  compose_services?: string[];
  container_count?: number;
  id?: number;
  is_orphaned?: boolean;
  is_tracked?: boolean;
  mount_id?: string;
  mount_type?: string;
  source_path?: string;
  volume_name?: string;
}

export interface GithubComMantonxVolumevizInternalServicesRulesPreviewRequest {
  /** DryRun mode - if true, doesn't create evaluation records */
  dry_run?: boolean;
  /** IncludeRuleDetails whether to include detailed rule condition matching info */
  include_rule_details?: boolean;
  /** IncludeUnmatched whether to include mounts that don't match any rules */
  include_unmatched?: boolean;
  /** MountIDs to limit preview to specific mounts (if empty, all mounts are evaluated) */
  mount_ids?: string[];
  /** RuleIDs to include in preview (if empty, all enabled rules are used) */
  rule_ids?: number[];
}

export interface GithubComMantonxVolumevizInternalServicesRulesPreviewResponse {
  completed_at?: string;
  errors?: string[];
  execution_time_ms?: number;
  mount_previews?: GithubComMantonxVolumevizInternalServicesRulesMountPreview[];
  preview_id?: string;
  requested_at?: string;
  rule_performance?: GithubComMantonxVolumevizInternalServicesRulesRulePerformanceResult[];
  summary?: GithubComMantonxVolumevizInternalServicesRulesPreviewSummary;
  warnings?: string[];
}

export interface GithubComMantonxVolumevizInternalServicesRulesPreviewSummary {
  action_breakdown?: Record<string, number>;
  mounts_evaluated?: number;
  mounts_excluded?: number;
  mounts_included?: number;
  mounts_matched?: number;
  mounts_unmatched?: number;
  project_breakdown?: Record<
    string,
    GithubComMantonxVolumevizInternalServicesRulesActionBreakdown
  >;
  rules_evaluated?: number;
  total_mounts?: number;
  type_breakdown?: Record<
    string,
    GithubComMantonxVolumevizInternalServicesRulesActionBreakdown
  >;
}

export interface GithubComMantonxVolumevizInternalServicesRulesRuleConflict {
  /** description of the conflict */
  conflict?: string;
  rule1?: GithubComMantonxVolumevizInternalServicesRulesRuleMatchSummary;
  rule2?: GithubComMantonxVolumevizInternalServicesRulesRuleMatchSummary;
}

export interface GithubComMantonxVolumevizInternalServicesRulesRuleMatchSummary {
  action?: string;
  execution_time_ms?: number;
  /** 0.0-1.0 based on condition matches */
  match_confidence?: number;
  matched?: boolean;
  matched_conditions?: GithubComMantonxVolumevizInternalServicesRulesConditionResult[];
  priority?: number;
  rule_id?: number;
  rule_name?: string;
}

export interface GithubComMantonxVolumevizInternalServicesRulesRulePerformanceResult {
  avg_execution_time_ms?: number;
  mounts_evaluated?: number;
  mounts_matched?: number;
  rule_id?: number;
  rule_name?: string;
  total_execution_time_ms?: number;
}

export interface InternalApiV1DiagRealtimeDiagnostics {
  active_connections?: number;
  features?: string[];
  mode?: InternalApiV1DiagRealtimeMode;
  polling_enabled?: boolean;
  polling_interval_ms?: number;
  sse_enabled?: boolean;
  websocket_enabled?: boolean;
  websocket_url?: string;
}

/** Applied filters for the file query */
export interface InternalApiV1ExplorerAppliedFilters {
  /** @example "pdf" */
  file_type?: string;
  /** @example 10485760 */
  max_size?: number;
  /** @example "application/pdf" */
  mime_type?: string;
  /** @example 1024 */
  min_size?: number;
}

/** Enhanced file item with performance and metadata information */
export interface InternalApiV1ExplorerEnhancedFileItem {
  /** @example 1024000 */
  disk_usage?: number;
  /** @example "pdf" */
  extension?: string;
  /** @example 123 */
  id?: number;
  /** @example false */
  is_directory?: boolean;
  /** @example "document" */
  media_kind?: string;
  /** @example "application/pdf" */
  media_type?: string;
  /** @example "2024-01-15T10:30:00Z" */
  modified_time?: string;
  /** @example "document.pdf" */
  name?: string;
  /** @example "/home/user/documents/document.pdf" */
  path?: string;
  /** @example 1024000 */
  size?: number;
}

/** File or directory information for explorer browsing */
export interface InternalApiV1ExplorerFileInfo {
  /** @example "pdf" */
  extension?: string;
  /** @example false */
  is_directory?: boolean;
  /** @example "application/pdf" */
  media_type?: string;
  /** @example "2024-01-15T10:30:00Z" */
  modified_time?: string;
  /** @example "document.pdf" */
  name?: string;
  /** @example "/home/user/documents/document.pdf" */
  path?: string;
  /** @example 1024000 */
  size?: number;
}

/** A folder item with parent/child relationship information */
export interface InternalApiV1ExplorerFolderBrowsingItem {
  /** @example 42 */
  file_count?: number;
  /** @example 5 */
  folder_count?: number;
  /** @example true */
  has_children?: boolean;
  /** @example 123 */
  id?: number;
  /** @example true */
  is_directory?: boolean;
  /** @example "documents" */
  name?: string;
  /** @example "/home/user/documents" */
  path?: string;
  /** @example 1073741824 */
  total_size?: number;
}

/** Response containing folder hierarchy with parent/child relationships */
export interface InternalApiV1ExplorerFolderBrowsingResponse {
  children?: InternalApiV1ExplorerFolderBrowsingItem[];
  /** A folder item with parent/child relationship information */
  current?: InternalApiV1ExplorerFolderBrowsingItem;
  /** @example "/home/user/documents" */
  current_path?: string;
  /** @example 100 */
  limit?: number;
  /** @example 1 */
  page?: number;
  /** A folder item with parent/child relationship information */
  parent?: InternalApiV1ExplorerFolderBrowsingItem;
  /** @example 15 */
  total_children?: number;
  /** @example 2 */
  total_pages?: number;
  /** @example "vol_123" */
  volume_id?: string;
}

/** A node in the hierarchical folder structure */
export interface InternalApiV1ExplorerFolderNode {
  children?: InternalApiV1ExplorerFolderNode[];
  /** @example 15 */
  file_count?: number;
  /** @example 3 */
  folder_count?: number;
  /** @example "documents" */
  name?: string;
  /** @example "/home/user/documents" */
  path?: string;
  /** @example 52428800 */
  total_size?: number;
}

/** Response containing files in a folder with pagination */
export interface InternalApiV1ExplorerGetFilesByFolderResponse {
  files?: InternalApiV1ExplorerFileInfo[];
  /** @example 100 */
  limit?: number;
  /** @example 1 */
  page?: number;
  /** @example 250 */
  total_count?: number;
  /** @example 3 */
  total_pages?: number;
}

/** Response containing hierarchical folder structure */
export interface InternalApiV1ExplorerGetFolderTreeResponse {
  tree?: InternalApiV1ExplorerFolderNode[];
}

/** Response containing immediate children of a path */
export interface InternalApiV1ExplorerGetTreeChildrenResponse {
  children?: InternalApiV1ExplorerTreeChildItem[];
  /** @example 100 */
  limit?: number;
  /** @example 1 */
  page?: number;
  /** @example "/home/user" */
  parent_path?: string;
  /** @example 25 */
  total_count?: number;
  /** @example 1 */
  total_pages?: number;
}

/** Enhanced response for paginated file listing with performance metadata */
export interface InternalApiV1ExplorerPaginatedFileResponse {
  /** @example false */
  cache_hit?: boolean;
  files?: InternalApiV1ExplorerEnhancedFileItem[];
  /** Applied filters for the file query */
  filters?: InternalApiV1ExplorerAppliedFilters;
  /** @example true */
  has_more?: boolean;
  /** @example 50 */
  limit?: number;
  /** @example 1 */
  page?: number;
  /** @example 45 */
  query_time_ms?: number;
  /** @example "name" */
  sort_by?: string;
  /** @example "asc" */
  sort_order?: string;
  /** @example 1250 */
  total_count?: number;
  /** @example 25 */
  total_pages?: number;
}

/** A child file or folder in tree navigation */
export interface InternalApiV1ExplorerTreeChildItem {
  /** @example "pdf" */
  extension?: string;
  /** @example true */
  has_children?: boolean;
  /** @example true */
  is_directory?: boolean;
  /** @example "application/pdf" */
  media_type?: string;
  /** @example "documents" */
  name?: string;
  /** @example "/home/user/documents" */
  path?: string;
  /** @example 1024000 */
  size?: number;
}

export interface InternalApiV1MetadataFileDurationItem {
  duration_seconds?: number;
  id?: number;
  media_type?: string;
  name?: string;
  path?: string;
  size?: number;
}

export interface InternalApiV1MetadataFileLocationItem {
  id?: number;
  latitude?: number;
  longitude?: number;
  media_type?: string;
  name?: string;
  path?: string;
  size?: number;
}

export interface InternalApiV1MetadataFileResolutionItem {
  height?: number;
  id?: number;
  media_type?: string;
  name?: string;
  path?: string;
  size?: number;
  width?: number;
}

export interface InternalApiV1MetadataGetFilesByDurationResponse {
  files?: InternalApiV1MetadataFileDurationItem[];
  limit?: number;
  page?: number;
  total_count?: number;
  total_pages?: number;
}

export interface InternalApiV1MetadataGetFilesByLocationResponse {
  files?: InternalApiV1MetadataFileLocationItem[];
  limit?: number;
  page?: number;
  total_count?: number;
  total_pages?: number;
}

export interface InternalApiV1MetadataGetFilesByResolutionResponse {
  files?: InternalApiV1MetadataFileResolutionItem[];
  limit?: number;
  page?: number;
  total_count?: number;
  total_pages?: number;
}

export interface InternalApiV1MountsDiscoverMountsRequest {
  /** @example false */
  force?: boolean;
}

export interface InternalApiV1MountsDiscoverMountsResponse {
  /** @example "Mount discovery completed successfully" */
  message?: string;
  /** @example true */
  triggered?: boolean;
}

export interface InternalApiV1MountsMountCatalogResponse {
  /** @example "myapp" */
  compose_project?: string;
  /** @example ["web","api"] */
  compose_services?: string[];
  /** @example "3.8" */
  compose_version?: string;
  /** @example 2 */
  container_count?: number;
  /**
   * @format date-time
   * @example "2024-01-01T12:00:00Z"
   */
  created_at?: string;
  /** @example "docker_engine" */
  discovery_source?: string;
  /**
   * @format date-time
   * @example "2024-01-01T12:00:00Z"
   */
  first_discovered_at?: string;
  /** @example 1 */
  id?: number;
  /** @example false */
  is_orphaned?: boolean;
  /** @example true */
  is_tracked?: boolean;
  /**
   * @format date-time
   * @example "2024-01-01T14:30:00Z"
   */
  last_seen_at?: string;
  /** @example "vol_abc123" */
  mount_id?: string;
  /** @example "volume" */
  mount_type?: "volume" | "bind" | "tmpfs";
  /** @example "/var/lib/docker/volumes/my-app-data/_data" */
  source_path?: string;
  /** @format date-time */
  tracking_disabled_at?: string;
  /**
   * @format date-time
   * @example "2024-01-01T12:00:00Z"
   */
  tracking_enabled_at?: string;
  /**
   * @format date-time
   * @example "2024-01-01T14:30:00Z"
   */
  updated_at?: string;
  /** @example "local" */
  volume_driver?: string;
  /** @example "my-app-data" */
  volume_name?: string;
  /** @example "local" */
  volume_scope?: string;
}

export interface InternalApiV1MountsMountCatalogSummaryResponse {
  /** @example 8 */
  bind_mounts?: number;
  /** @example 5 */
  compose_projects?: number;
  /** @example 3 */
  orphaned_mounts?: number;
  /** @example 2 */
  tmpfs_mounts?: number;
  /** @example 25 */
  total_mounts?: number;
  /** @example 20 */
  tracked_mounts?: number;
  /** @example 15 */
  volume_mounts?: number;
}

export interface InternalApiV1PreviewsPreviewRequest {
  file_hash?: string;
  file_id: number;
  file_path: string;
  mime_type: string;
  size: "small" | "medium" | "large";
  time_offset?: string;
  type: "thumbnail" | "poster" | "cover";
}

export interface InternalApiV1PreviewsPreviewResponse {
  cache_hit?: boolean;
  created_at?: string;
  etag?: string;
  file_id?: number;
  file_size?: number;
  format?: string;
  height?: number;
  id?: number;
  processing_ms?: number;
  size?: string;
  type?: string;
  url?: string;
  width?: number;
}

export interface InternalApiV1RulesApplyTrackingRulesRequest {
  dry_run?: boolean;
}

export interface InternalApiV1RulesApplyTrackingRulesResponse {
  applied_at?: string;
  changes?: InternalApiV1RulesTrackingChange[];
  changes_count?: number;
  dry_run?: boolean;
}

export interface InternalApiV1RulesConditionRequest {
  /** @example "source_type" */
  field_name:
    | "source_type"
    | "docker_volume_name"
    | "host_path"
    | "compose_project"
    | "compose_service"
    | "container_image"
    | "container_name"
    | "read_only"
    | "is_orphaned"
    | "driver";
  /** @example false */
  is_case_sensitive?: boolean;
  /** @example "equals" */
  operator:
    | "equals"
    | "not_equals"
    | "prefix"
    | "suffix"
    | "contains"
    | "not_contains"
    | "regex"
    | "not_regex"
    | "glob"
    | "in"
    | "not_in";
  /** @example "volume" */
  value?: string;
  /** @example ["volume","bind"] */
  values?: string[];
}

export interface InternalApiV1RulesCreateMountOverrideRequest {
  action: "include" | "exclude";
  created_by?: string;
  mount_id: string;
  reason?: string;
}

export interface InternalApiV1RulesCreateRuleRequest {
  /** @example "include" */
  action: "include" | "exclude";
  /** @minItems 1 */
  conditions: InternalApiV1RulesConditionRequest[];
  /** @example "admin" */
  created_by?: string;
  /** @example "Include all named Docker volumes for tracking" */
  description?: string;
  /** @example true */
  is_enabled?: boolean;
  /** @example "Include Docker Volumes" */
  name: string;
  /**
   * @min 1
   * @max 1000
   * @example 100
   */
  priority?: number;
}

export interface InternalApiV1RulesListMountOverridesResponse {
  overrides?: InternalApiV1RulesMountOverrideResponse[];
  total?: number;
}

export interface InternalApiV1RulesListRuleTemplatesResponse {
  templates?: InternalApiV1RulesRuleTemplate[];
  total?: number;
}

export interface InternalApiV1RulesListRulesResponse {
  rules?: InternalApiV1RulesRuleResponse[];
  total?: number;
}

export interface InternalApiV1RulesMountOverrideResponse {
  action?: string;
  created_at?: string;
  created_by?: string;
  id?: number;
  mount_id?: string;
  reason?: string;
  updated_at?: string;
}

export interface InternalApiV1RulesRuleConfigUpdate {
  id: number;
  is_enabled?: boolean;
  priority?: number;
}

export interface InternalApiV1RulesRuleResponse {
  /** @example "include" */
  action?: "include" | "exclude";
  conditions?: InternalApiV1RulesConditionRequest[];
  /** @format date-time */
  created_at?: string;
  /** @example "admin" */
  created_by?: string;
  /** @example "Include all named Docker volumes for tracking" */
  description?: string;
  /** @example 1 */
  id?: number;
  /** @example true */
  is_enabled?: boolean;
  /** @format date-time */
  last_evaluation_at?: string;
  /** @format date-time */
  last_matched_at?: string;
  /** @example 5 */
  match_count?: number;
  /** @example "Include Docker Volumes" */
  name?: string;
  /**
   * @min 1
   * @max 1000
   * @example 100
   */
  priority?: number;
  /** @format date-time */
  updated_at?: string;
}

export interface InternalApiV1RulesRuleTemplate {
  category?: string;
  created_at?: string;
  description?: string;
  id?: number;
  is_builtin?: boolean;
  last_used_at?: string;
  name?: string;
  tags?: string[];
  template_data?: Record<string, any>;
  updated_at?: string;
  usage_count?: number;
}

export interface InternalApiV1RulesTrackingChange {
  mount_id?: string;
  mount_name?: string;
  mount_type?: string;
  new_action?: string;
  old_action?: string;
  rule_name?: string;
  rule_priority?: number;
}

export interface InternalApiV1RulesTrackingRulesConfigResponse {
  enabled?: number;
  rules?: InternalApiV1RulesRuleResponse[];
  total?: number;
}

export interface InternalApiV1RulesUpdateRuleRequest {
  action?: "include" | "exclude";
  conditions?: InternalApiV1RulesConditionRequest[];
  description?: string;
  is_enabled?: boolean;
  name?: string;
  priority?: number;
}

export interface InternalApiV1RulesUpdateTrackingRulesConfigRequest {
  rules: InternalApiV1RulesRuleConfigUpdate[];
}

export interface InternalApiV1SearchCreateSavedSearchRequest {
  description?: string;
  is_public?: boolean;
  metadata?: Record<string, any>;
  name: string;
  query: InternalApiV1SearchSearchFilesRequest;
  tags?: string[];
}

export interface InternalApiV1SearchFileResult {
  audio_codec?: string;
  camera_model?: string;
  capture_date?: string;
  created_time?: string;
  disk_usage?: number;
  /** Media metadata */
  duration_ms?: number;
  extension?: string;
  gps_lat?: number;
  gps_lon?: number;
  has_gps?: boolean;
  height?: number;
  id?: number;
  media_kind?: string;
  metadata?: Record<string, any>;
  mime_type?: string;
  modified_time?: string;
  name?: string;
  path?: string;
  preview_url?: string;
  size?: number;
  video_codec?: string;
  volume_id?: string;
  width?: number;
}

export interface InternalApiV1SearchListSavedSearchesResponse {
  page?: number;
  per_page?: number;
  searches?: InternalApiV1SearchSavedSearch[];
  total_count?: number;
}

export interface InternalApiV1SearchSavedSearch {
  created_at?: string;
  description?: string;
  id?: number;
  is_public?: boolean;
  last_run_at?: string;
  metadata?: Record<string, any>;
  name: string;
  query?: InternalApiV1SearchSearchFilesRequest;
  run_count?: number;
  tags?: string[];
  updated_at?: string;
}

export interface InternalApiV1SearchSearchFilesRequest {
  /** Media metadata filters */
  durationFrom?: number;
  /** Max duration in ms */
  durationTo?: number;
  /** Glob pattern for path matching */
  glob?: string;
  /** Has GPS coordinates */
  hasGps?: boolean;
  /** Has subtitles */
  hasSubs?: boolean;
  /** Has computed hash */
  hashPresent?: boolean;
  /** Max height in pixels */
  maxHeight?: number;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Max width in pixels */
  maxWidth?: number;
  /** Media filters */
  mediaKind?: string;
  /** MIME type filters */
  mime?: string[];
  /** Min height in pixels */
  minHeight?: number;
  /** Size filters */
  minSize?: number;
  /** Min width in pixels (video/image) */
  minWidth?: number;
  /** Time filters */
  mtimeFrom?: string;
  /** Modified time to */
  mtimeTo?: string;
  /** Sort order: asc, desc */
  order?: string;
  /**
   * Pagination and sorting
   * @min 1
   */
  page?: number;
  /** Path prefix filter */
  path?: string;
  /**
   * @min 1
   * @max 100
   */
  perPage?: number;
  /** Text search */
  q?: string;
  /** Regex pattern for path matching */
  regex?: string;
  /** Sort field: relevance, name, size, mtime, ctime, duration, type, media_kind */
  sort?: string;
}

export interface InternalApiV1SearchSearchFilesResponse {
  files?: InternalApiV1SearchFileResult[];
  filters?: any;
  page?: number;
  per_page?: number;
  query_time_ms?: number;
  total_count?: number;
  total_pages?: number;
}

export interface InternalApiV1SearchSearchSuggestion {
  /** Number of matching files */
  count?: number;
  /** Optional description */
  description?: string;
  /** Suggested text */
  text?: string;
  /** Type: "filename", "extension", "path", "recent" */
  type?: string;
}

export interface InternalApiV1SearchSearchSuggestionsResponse {
  query_time_ms?: number;
  suggestions?: InternalApiV1SearchSearchSuggestion[];
}

export interface InternalApiV1SearchUpdateSavedSearchRequest {
  description?: string;
  is_public?: boolean;
  metadata?: Record<string, any>;
  name?: string;
  query?: InternalApiV1SearchSearchFilesRequest;
  tags?: string[];
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<
  FullRequestParams,
  "body" | "method" | "query" | "path"
>;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown>
  extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "http://localhost:8080/api/v1";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) =>
    fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter(
      (key) => "undefined" !== typeof query[key],
    );
    return keys
      .map((key) =>
        Array.isArray(query[key])
          ? this.addArrayQueryParam(query, key)
          : this.addQueryParam(query, key),
      )
      .join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.JsonApi]: (input: any) =>
      input !== null && (typeof input === "object" || typeof input === "string")
        ? JSON.stringify(input)
        : input,
    [ContentType.Text]: (input: any) =>
      input !== null && typeof input !== "string"
        ? JSON.stringify(input)
        : input,
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob
            ? property
            : typeof property === "object" && property !== null
              ? JSON.stringify(property)
              : `${property}`,
        );
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(
    params1: RequestParams,
    params2?: RequestParams,
  ): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (
    cancelToken: CancelToken,
  ): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...(requestParams.headers || {}),
          ...(type && type !== ContentType.FormData
            ? { "Content-Type": type }
            : {}),
        },
        signal:
          (cancelToken
            ? this.createAbortSignal(cancelToken)
            : requestParams.signal) || null,
        body:
          typeof body === "undefined" || body === null
            ? null
            : payloadFormatter(body),
      },
    ).then(async (response) => {
      const r = response.clone() as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const data = !responseFormat
        ? r
        : await response[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title VolumeViz API
 * @version 1.0
 * @license MIT (https://github.com/mantonx/volumeviz/blob/main/LICENSE)
 * @termsOfService https://github.com/mantonx/volumeviz
 * @baseUrl http://localhost:8080/api/v1
 * @contact API Support <support@volumeviz.io> (https://github.com/mantonx/volumeviz/issues)
 *
 * Docker volume monitoring API with comprehensive volume discovery, size calculation, and container attachment tracking. Focus on user-mounted volumes only.
 *
 * ## Volume-First Approach
 * - Automatic discovery and filtering of user-mounted volumes
 * - Excludes Docker infrastructure volumes (container filesystems, tmp volumes)
 * - Real-time volume usage monitoring and size calculation
 * - Container attachment tracking for each volume
 *
 * ## Features
 * - Multi-method volume size calculation (du, find, stat)
 * - Asynchronous scanning with progress tracking for large volumes
 * - High-performance caching with TTL-based invalidation
 * - Comprehensive Prometheus metrics integration
 * - Circuit breaker patterns for resilience
 *
 * ## Performance SLO
 * - 95th percentile response time < 500ms for volume listing
 * - Supports 1000+ volumes with concurrent access
 * - Memory usage < 100MB during large volume scans
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  alerts = {
    /**
     * @description Get a list of alerts with pagination and filtering
     *
     * @tags alerts
     * @name AlertsList
     * @summary List alerts
     * @request GET:/alerts
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    alertsList: (
      query?: {
        /** Number of items to return (default: 50, max: 100) */
        limit?: number;
        /** Number of items to skip (default: 0) */
        offset?: number;
        /** Filter by status (firing, resolved) */
        status?: string;
        /** Filter by rule ID */
        rule_id?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a specific alert by ID
     *
     * @tags alerts
     * @name AlertsDetail
     * @summary Get alert
     * @request GET:/alerts/{id}
     * @response `200` `GithubComMantonxVolumevizInternalModelsAlert` OK
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    alertsDetail: (id: number, params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlert,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/${id}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get delivery history with pagination and filtering
     *
     * @tags alerts
     * @name DeliveriesList
     * @summary Get delivery history
     * @request GET:/alerts/deliveries
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    deliveriesList: (
      query?: {
        /** Number of items to return (default: 50, max: 100) */
        limit?: number;
        /** Number of items to skip (default: 0) */
        offset?: number;
        /** Filter by alert ID */
        alert_id?: number;
        /** Filter by destination ID */
        destination_id?: number;
        /** Filter by delivery status */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/deliveries`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a list of alert destinations with pagination
     *
     * @tags alerts
     * @name DestinationsList
     * @summary List alert destinations
     * @request GET:/alerts/destinations
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsList: (
      query?: {
        /** Number of items to return (default: 50, max: 100) */
        limit?: number;
        /** Number of items to skip (default: 0) */
        offset?: number;
        /** Filter by enabled status */
        enabled?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/destinations`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new alert destination
     *
     * @tags alerts
     * @name DestinationsCreate
     * @summary Create alert destination
     * @request POST:/alerts/destinations
     * @response `201` `GithubComMantonxVolumevizInternalModelsAlertDestination` Created
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsCreate: (
      destination: GithubComMantonxVolumevizInternalModelsCreateAlertDestinationParams,
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertDestination,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/destinations`,
        method: "POST",
        body: destination,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an alert destination
     *
     * @tags alerts
     * @name DestinationsDelete
     * @summary Delete alert destination
     * @request DELETE:/alerts/destinations/{id}
     * @response `204` `void` No Content
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsDelete: (id: number, params: RequestParams = {}) =>
      this.request<void, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/destinations/${id}`,
        method: "DELETE",
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get a specific alert destination by ID
     *
     * @tags alerts
     * @name DestinationsDetail
     * @summary Get alert destination
     * @request GET:/alerts/destinations/{id}
     * @response `200` `GithubComMantonxVolumevizInternalModelsAlertDestination` OK
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsDetail: (id: number, params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertDestination,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/destinations/${id}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing alert destination
     *
     * @tags alerts
     * @name DestinationsUpdate
     * @summary Update alert destination
     * @request PUT:/alerts/destinations/{id}
     * @response `200` `GinH` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsUpdate: (
      id: number,
      destination: GithubComMantonxVolumevizInternalModelsUpdateAlertDestinationParams,
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/destinations/${id}`,
        method: "PUT",
        body: destination,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Send a test message to an alert destination
     *
     * @tags alerts
     * @name DestinationsTestCreate
     * @summary Test alert destination
     * @request POST:/alerts/destinations/{id}/test
     * @response `200` `GinH` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    destinationsTestCreate: (
      id: number,
      request: GinH,
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/destinations/${id}/test`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Manually trigger evaluation of all alert rules
     *
     * @tags alerts
     * @name EngineEvaluateCreate
     * @summary Trigger alert evaluation
     * @request POST:/alerts/engine/evaluate
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    engineEvaluateCreate: (params: RequestParams = {}) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/engine/evaluate`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get comprehensive alerts engine status and statistics
     *
     * @tags alerts
     * @name EngineStatusList
     * @summary Get alerts engine status
     * @request GET:/alerts/engine/status
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    engineStatusList: (params: RequestParams = {}) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/engine/status`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a list of alert routes with pagination
     *
     * @tags alerts
     * @name RoutesList
     * @summary List alert routes
     * @request GET:/alerts/routes
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    routesList: (
      query?: {
        /** Number of items to return (default: 50, max: 100) */
        limit?: number;
        /** Number of items to skip (default: 0) */
        offset?: number;
        /** Filter by destination ID */
        destination_id?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/routes`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new alert route (rule -> destination mapping)
     *
     * @tags alerts
     * @name RoutesCreate
     * @summary Create alert route
     * @request POST:/alerts/routes
     * @response `201` `GithubComMantonxVolumevizInternalModelsAlertRoute` Created
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    routesCreate: (
      route: GithubComMantonxVolumevizInternalModelsCreateAlertRouteParams,
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertRoute,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/routes`,
        method: "POST",
        body: route,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an alert route
     *
     * @tags alerts
     * @name RoutesDelete
     * @summary Delete alert route
     * @request DELETE:/alerts/routes/{id}
     * @response `204` `void` No Content
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    routesDelete: (id: number, params: RequestParams = {}) =>
      this.request<void, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/routes/${id}`,
        method: "DELETE",
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get a specific alert route by ID
     *
     * @tags alerts
     * @name RoutesDetail
     * @summary Get alert route
     * @request GET:/alerts/routes/{id}
     * @response `200` `GithubComMantonxVolumevizInternalModelsAlertRoute` OK
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    routesDetail: (id: number, params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertRoute,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/routes/${id}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing alert route
     *
     * @tags alerts
     * @name RoutesUpdate
     * @summary Update alert route
     * @request PUT:/alerts/routes/{id}
     * @response `200` `GinH` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    routesUpdate: (
      id: number,
      route: GithubComMantonxVolumevizInternalModelsUpdateAlertRouteParams,
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/routes/${id}`,
        method: "PUT",
        body: route,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a list of alert rules with pagination
     *
     * @tags alerts
     * @name RulesList
     * @summary List alert rules
     * @request GET:/alerts/rules
     * @response `200` `GinH` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesList: (
      query?: {
        /** Number of items to return (default: 50, max: 100) */
        limit?: number;
        /** Number of items to skip (default: 0) */
        offset?: number;
        /** Filter by enabled status */
        enabled?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/rules`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Create a new alert rule
     *
     * @tags alerts
     * @name RulesCreate
     * @summary Create alert rule
     * @request POST:/alerts/rules
     * @response `201` `GithubComMantonxVolumevizInternalModelsAlertRule` Created
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesCreate: (
      rule: GithubComMantonxVolumevizInternalModelsCreateAlertRuleParams,
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertRule,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/rules`,
        method: "POST",
        body: rule,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete an alert rule and all associated alerts
     *
     * @tags alerts
     * @name RulesDelete
     * @summary Delete alert rule
     * @request DELETE:/alerts/rules/{id}
     * @response `204` `void` No Content
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesDelete: (id: number, params: RequestParams = {}) =>
      this.request<void, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/rules/${id}`,
        method: "DELETE",
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get a specific alert rule by ID
     *
     * @tags alerts
     * @name RulesDetail
     * @summary Get alert rule
     * @request GET:/alerts/rules/{id}
     * @response `200` `GithubComMantonxVolumevizInternalModelsAlertRule` OK
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesDetail: (id: number, params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsAlertRule,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/alerts/rules/${id}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing alert rule
     *
     * @tags alerts
     * @name RulesUpdate
     * @summary Update alert rule
     * @request PUT:/alerts/rules/{id}
     * @response `200` `GinH` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesUpdate: (
      id: number,
      rule: GithubComMantonxVolumevizInternalModelsUpdateAlertRuleParams,
      params: RequestParams = {},
    ) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/rules/${id}`,
        method: "PUT",
        body: rule,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Test an alert rule against current metrics without creating alerts
     *
     * @tags alerts
     * @name RulesTestCreate
     * @summary Test alert rule
     * @request POST:/alerts/rules/{id}/test
     * @response `200` `GinH` OK
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    rulesTestCreate: (id: number, params: RequestParams = {}) =>
      this.request<GinH, GithubComMantonxVolumevizInternalModelsErrorResponse>({
        path: `/alerts/rules/${id}/test`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  api = {
    /**
     * @description Get information about available real-time communication methods
     *
     * @tags Diagnostics
     * @name V1DiagRealtimeList
     * @summary Get real-time diagnostics
     * @request GET:/api/v1/diag/realtime
     * @response `200` `InternalApiV1DiagRealtimeDiagnostics` OK
     */
    v1DiagRealtimeList: (params: RequestParams = {}) =>
      this.request<InternalApiV1DiagRealtimeDiagnostics, any>({
        path: `/api/v1/diag/realtime`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Browse folders with parent/child relationships for navigation breadcrumbs and tree structure
     *
     * @tags Explorer
     * @name V1ExplorerBrowseList
     * @summary Browse folder hierarchy
     * @request GET:/api/v1/explorer/browse
     * @response `200` `InternalApiV1ExplorerFolderBrowsingResponse` Folder browsing data retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume or folder not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerBrowseList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Folder path to browse
         * @example "/home/user/documents"
         */
        path?: string;
        /**
         * Include parent folder info
         * @example true
         */
        include_parent?: boolean;
        /**
         * Include child folders
         * @example true
         */
        include_children?: boolean;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerFolderBrowsingResponse, GinH>({
        path: `/api/v1/explorer/browse`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files and directories within a specific folder path with pagination, sorting, and filtering support
     *
     * @tags Explorer
     * @name V1ExplorerFilesList
     * @summary Get files in folder
     * @request GET:/api/v1/explorer/files
     * @response `200` `InternalApiV1ExplorerGetFilesByFolderResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume or folder not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Folder path
         * @example "/home/user/documents"
         */
        path?: string;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
        /**
         * Sort field: name, size, modified (default: name)
         * @example "name"
         */
        sort_by?: string;
        /**
         * Sort order: asc, desc (default: asc)
         * @example "asc"
         */
        sort_order?: string;
        /**
         * Filter by file type/extension
         * @example "pdf"
         */
        file_type?: string;
        /**
         * Minimum file size in bytes
         * @example 1024
         */
        min_size?: number;
        /**
         * Maximum file size in bytes
         * @example 10485760
         */
        max_size?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFilesByFolderResponse, GinH>({
        path: `/api/v1/explorer/files`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by file extension with pagination support
     *
     * @tags Explorer
     * @name V1ExplorerFilesByExtensionList
     * @summary Get files by extension
     * @request GET:/api/v1/explorer/files/by-extension
     * @response `200` `InternalApiV1ExplorerGetFilesByFolderResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesByExtensionList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * File extension to filter by
         * @example "pdf"
         */
        extension: string;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFilesByFolderResponse, GinH>({
        path: `/api/v1/explorer/files/by-extension`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by media type (MIME type) with pagination support
     *
     * @tags Explorer
     * @name V1ExplorerFilesByMediaTypeList
     * @summary Get files by media type
     * @request GET:/api/v1/explorer/files/by-media-type
     * @response `200` `InternalApiV1ExplorerGetFilesByFolderResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesByMediaTypeList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Media type to filter by
         * @example "image/jpeg"
         */
        media_type: string;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFilesByFolderResponse, GinH>({
        path: `/api/v1/explorer/files/by-media-type`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Enhanced file listing endpoint with database-level pagination, advanced filtering, and performance optimizations
     *
     * @tags Explorer
     * @name V1ExplorerFilesPaginatedList
     * @summary Get files with optimized pagination
     * @request GET:/api/v1/explorer/files/paginated
     * @response `200` `InternalApiV1ExplorerPaginatedFileResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume or folder not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesPaginatedList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Folder path
         * @example "/home/user/documents"
         */
        path?: string;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 50, max: 200)
         * @example 50
         */
        limit?: number;
        /**
         * Sort field: name, size, modified (default: name)
         * @example "name"
         */
        sort_by?: string;
        /**
         * Sort order: asc, desc (default: asc)
         * @example "asc"
         */
        sort_order?: string;
        /**
         * Filter by file type/extension
         * @example "pdf"
         */
        file_type?: string;
        /**
         * Filter by MIME type
         * @example "application/pdf"
         */
        mime_type?: string;
        /**
         * Minimum file size in bytes
         * @example 1024
         */
        min_size?: number;
        /**
         * Maximum file size in bytes
         * @example 10485760
         */
        max_size?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerPaginatedFileResponse, GinH>({
        path: `/api/v1/explorer/files/paginated`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files that were modified within the specified number of days
     *
     * @tags Explorer
     * @name V1ExplorerFilesRecentList
     * @summary Get recent files
     * @request GET:/api/v1/explorer/files/recent
     * @response `200` `InternalApiV1ExplorerGetFilesByFolderResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesRecentList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Number of days to look back (default: 7)
         * @example 7
         */
        days?: number;
        /**
         * Maximum number of files to return (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFilesByFolderResponse, GinH>({
        path: `/api/v1/explorer/files/recent`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Search for files by name pattern with fuzzy matching support
     *
     * @tags Explorer
     * @name V1ExplorerFilesSearchList
     * @summary Search files by name
     * @request GET:/api/v1/explorer/files/search
     * @response `200` `InternalApiV1ExplorerGetFilesByFolderResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerFilesSearchList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Search query/pattern
         * @example "document"
         */
        query: string;
        /**
         * Maximum number of files to return (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFilesByFolderResponse, GinH>({
        path: `/api/v1/explorer/files/search`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve hierarchical folder structure with optional depth limit and directory-only filtering
     *
     * @tags Explorer
     * @name V1ExplorerTreeList
     * @summary Get folder tree
     * @request GET:/api/v1/explorer/tree
     * @response `200` `InternalApiV1ExplorerGetFolderTreeResponse` Folder tree retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume or root path not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerTreeList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Root path to start tree from
         * @example "/home/user"
         */
        root_path?: string;
        /**
         * Maximum tree depth (default: 3)
         * @example 3
         */
        max_depth?: number;
        /**
         * Include only directories (default: true)
         * @example true
         */
        dirs_only?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetFolderTreeResponse, GinH>({
        path: `/api/v1/explorer/tree`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get immediate children of a folder path for lazy tree loading with pagination support
     *
     * @tags Explorer
     * @name V1ExplorerTreeChildrenList
     * @summary Get tree children
     * @request GET:/api/v1/explorer/tree/children
     * @response `200` `InternalApiV1ExplorerGetTreeChildrenResponse` Children retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume or parent folder not found
     * @response `500` `GinH` Internal server error
     */
    v1ExplorerTreeChildrenList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Parent path (empty for root)
         * @example "/home/user"
         */
        path?: string;
        /**
         * Include files in results
         * @example false
         */
        include_files?: boolean;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1ExplorerGetTreeChildrenResponse, GinH>({
        path: `/api/v1/explorer/tree/children`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by video/audio duration with pagination support
     *
     * @tags metadata
     * @name V1MetadataFilesByDurationList
     * @summary Get files by duration
     * @request GET:/api/v1/metadata/files/by-duration
     * @response `200` `InternalApiV1MetadataGetFilesByDurationResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `500` `GinH` Internal server error
     */
    v1MetadataFilesByDurationList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Minimum duration in seconds
         * @example 60
         */
        min_duration?: number;
        /**
         * Maximum duration in seconds
         * @example 3600
         */
        max_duration?: number;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1MetadataGetFilesByDurationResponse, GinH>({
        path: `/api/v1/metadata/files/by-duration`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by GPS coordinates with pagination support
     *
     * @tags metadata
     * @name V1MetadataFilesByLocationList
     * @summary Get files by location
     * @request GET:/api/v1/metadata/files/by-location
     * @response `200` `InternalApiV1MetadataGetFilesByLocationResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `500` `GinH` Internal server error
     */
    v1MetadataFilesByLocationList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * GPS latitude
         * @format float64
         * @example 37.7749
         */
        latitude?: number;
        /**
         * GPS longitude
         * @format float64
         * @example -122.4194
         */
        longitude?: number;
        /**
         * Search radius in kilometers
         * @format float64
         * @example 10
         */
        radius?: number;
        /**
         * Filter files that have GPS data
         * @example true
         */
        has_location?: boolean;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1MetadataGetFilesByLocationResponse, GinH>({
        path: `/api/v1/metadata/files/by-location`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by media kind (video, image, audio, document, etc.) with pagination
     *
     * @tags Metadata
     * @name V1MetadataFilesByMediaKindList
     * @summary Get files by media kind
     * @request GET:/api/v1/metadata/files/by-media-kind
     * @response `200` `GinH` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `404` `GinH` Volume not found
     * @response `500` `GinH` Internal server error
     */
    v1MetadataFilesByMediaKindList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Media kind to filter by
         * @example "video"
         */
        media_kind: string;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 50, max: 200)
         * @example 50
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GinH>({
        path: `/api/v1/metadata/files/by-media-kind`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Retrieve files filtered by image/video resolution with pagination support
     *
     * @tags metadata
     * @name V1MetadataFilesByResolutionList
     * @summary Get files by resolution
     * @request GET:/api/v1/metadata/files/by-resolution
     * @response `200` `InternalApiV1MetadataGetFilesByResolutionResponse` Files retrieved successfully
     * @response `400` `GinH` Invalid request parameters
     * @response `500` `GinH` Internal server error
     */
    v1MetadataFilesByResolutionList: (
      query: {
        /**
         * Volume ID
         * @example "vol_123"
         */
        volume_id: string;
        /**
         * Image/video width
         * @example 1920
         */
        width?: number;
        /**
         * Image/video height
         * @example 1080
         */
        height?: number;
        /**
         * Minimum width
         * @example 1024
         */
        min_width?: number;
        /**
         * Maximum width
         * @example 4096
         */
        max_width?: number;
        /**
         * Minimum height
         * @example 768
         */
        min_height?: number;
        /**
         * Maximum height
         * @example 2160
         */
        max_height?: number;
        /**
         * Page number (default: 1)
         * @example 1
         */
        page?: number;
        /**
         * Items per page (default: 100, max: 500)
         * @example 100
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1MetadataGetFilesByResolutionResponse, GinH>({
        path: `/api/v1/metadata/files/by-resolution`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get available MIME types, media kinds, and extensions for filter dropdowns
     *
     * @tags metadata
     * @name V1MetadataFiltersList
     * @summary Get filter metadata
     * @request GET:/api/v1/metadata/filters
     * @response `200` `FilterMetadataResponse` OK
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    v1MetadataFiltersList: (params: RequestParams = {}) =>
      this.request<
        FilterMetadataResponse,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/api/v1/metadata/filters`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
 * @description Returns paginated list of Docker mount catalog entries with advanced filtering, search, and sorting capabilities
 *
 * @tags docker-mounts
 * @name V1MountsList
 * @summary List mount catalog entries
 * @request GET:/api/v1/mounts
 * @response `200` `(GinH & {
    filters?: GinH,
    mounts?: (InternalApiV1MountsMountCatalogResponse)[],
    pagination?: GinH,

})` OK
 * @response `400` `GinH` Bad Request
 * @response `500` `GinH` Internal Server Error
 */
    v1MountsList: (
      query?: {
        /**
         * Page number (default: 1)
         * @min 1
         * @example 1
         */
        page?: number;
        /**
         * Page size (default: 25)
         * @min 1
         * @max 100
         * @example 25
         */
        page_size?: number;
        /**
         * Sort by: mount_type, compose_project, last_seen, container_count
         * @example ""mount_type""
         */
        sort?: string;
        /**
         * Search query for general text search across mount fields
         * @example ""myapp""
         */
        q?: string;
        /**
         * Filter by mount ID (partial match)
         * @example ""vol_""
         */
        mount_id?: string;
        /**
         * Filter by volume name (partial match)
         * @example ""data""
         */
        volume_name?: string;
        /**
         * Filter by Compose project (partial match)
         * @example ""myproject""
         */
        compose_project?: string;
        /**
         * Filter by Compose service (partial match)
         * @example ""web""
         */
        compose_service?: string;
        /**
         * Filter by mount type
         * @example ""volume""
         */
        type?: "volume" | "bind" | "tmpfs";
        /**
         * Filter by status
         * @example ""active""
         */
        status?: "orphaned" | "active";
        /**
         * Filter by orphaned status
         * @example ""false""
         */
        is_orphaned?: "true" | "false";
        /**
         * Filter by tracking status
         * @example ""true""
         */
        is_tracked?: "true" | "false";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        GinH & {
          filters?: GinH;
          mounts?: InternalApiV1MountsMountCatalogResponse[];
          pagination?: GinH;
        },
        GinH
      >({
        path: `/api/v1/mounts`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Returns detailed metadata for a specific mount including volume info, compose metadata, and tracking status
     *
     * @tags docker-mounts
     * @name V1MountsDetail
     * @summary Get mount details
     * @request GET:/api/v1/mounts/{id}
     * @response `200` `InternalApiV1MountsMountCatalogResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `500` `GinH` Internal Server Error
     */
    v1MountsDetail: (id: string, params: RequestParams = {}) =>
      this.request<InternalApiV1MountsMountCatalogResponse, GinH>({
        path: `/api/v1/mounts/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Enable or disable tracking for a specific mount. When tracking is enabled, the mount will be included in volume scans and analysis.
     *
     * @tags docker-mounts
     * @name V1MountsTrackingUpdate
     * @summary Update mount tracking status
     * @request PUT:/api/v1/mounts/{mount_id}/tracking
     * @response `200` `InternalApiV1MountsMountCatalogResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `501` `GinH` Not Implemented
     */
    v1MountsTrackingUpdate: (
      mountId: string,
      request: {
        is_tracked?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1MountsMountCatalogResponse, GinH>({
        path: `/api/v1/mounts/${mountId}/tracking`,
        method: "PUT",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Triggers discovery and cataloging of Docker mounts from the Docker Engine. Scans all running containers and volumes to build/update the mount catalog.
     *
     * @tags docker-mounts
     * @name V1MountsDiscoverCreate
     * @summary Trigger mount discovery
     * @request POST:/api/v1/mounts/discover
     * @response `200` `InternalApiV1MountsDiscoverMountsResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `500` `GinH` Internal Server Error
     */
    v1MountsDiscoverCreate: (
      request: InternalApiV1MountsDiscoverMountsRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1MountsDiscoverMountsResponse, GinH>({
        path: `/api/v1/mounts/discover`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Returns summary statistics for the Docker mount catalog including counts by type, orphaned status, and tracking status
     *
     * @tags docker-mounts
     * @name V1MountsSummaryList
     * @summary Get mount catalog summary
     * @request GET:/api/v1/mounts/summary
     * @response `200` `InternalApiV1MountsMountCatalogSummaryResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1MountsSummaryList: (params: RequestParams = {}) =>
      this.request<InternalApiV1MountsMountCatalogSummaryResponse, GinH>({
        path: `/api/v1/mounts/summary`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Lists all tracking rules with optional filtering by enabled status or action
     *
     * @tags tracking-rules
     * @name V1RulesList
     * @summary List tracking rules
     * @request GET:/api/v1/rules
     * @response `200` `InternalApiV1RulesListRulesResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesList: (
      query?: {
        /** Filter by enabled status */
        enabled?: boolean;
        /** Filter by action (include/exclude) */
        action?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesListRulesResponse, GinH>({
        path: `/api/v1/rules`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Creates a new tracking rule for mount filtering
     *
     * @tags tracking-rules
     * @name V1RulesCreate
     * @summary Create a new tracking rule
     * @request POST:/api/v1/rules
     * @response `201` `InternalApiV1RulesRuleResponse` Created
     * @response `400` `GinH` Bad Request
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesCreate: (
      rule: InternalApiV1RulesCreateRuleRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesRuleResponse, GinH>({
        path: `/api/v1/rules`,
        method: "POST",
        body: rule,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Deletes a tracking rule by ID
     *
     * @tags tracking-rules
     * @name V1RulesDelete
     * @summary Delete a tracking rule
     * @request DELETE:/api/v1/rules/{id}
     * @response `204` `void` No Content
     * @response `400` `GinH` Bad Request
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesDelete: (id: number, params: RequestParams = {}) =>
      this.request<void, GinH>({
        path: `/api/v1/rules/${id}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Retrieves a single tracking rule by its ID
     *
     * @tags tracking-rules
     * @name V1RulesDetail
     * @summary Get a tracking rule by ID
     * @request GET:/api/v1/rules/{id}
     * @response `200` `InternalApiV1RulesRuleResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     */
    v1RulesDetail: (id: number, params: RequestParams = {}) =>
      this.request<InternalApiV1RulesRuleResponse, GinH>({
        path: `/api/v1/rules/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Updates an existing tracking rule
     *
     * @tags tracking-rules
     * @name V1RulesUpdate
     * @summary Update a tracking rule
     * @request PUT:/api/v1/rules/{id}
     * @response `200` `InternalApiV1RulesRuleResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesUpdate: (
      id: number,
      rule: InternalApiV1RulesUpdateRuleRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesRuleResponse, GinH>({
        path: `/api/v1/rules/${id}`,
        method: "PUT",
        body: rule,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Disables a tracking rule by setting is_enabled to false
     *
     * @tags tracking-rules
     * @name V1RulesDisableUpdate
     * @summary Disable a tracking rule
     * @request PUT:/api/v1/rules/{id}/disable
     * @response `200` `InternalApiV1RulesRuleResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesDisableUpdate: (id: number, params: RequestParams = {}) =>
      this.request<InternalApiV1RulesRuleResponse, GinH>({
        path: `/api/v1/rules/${id}/disable`,
        method: "PUT",
        format: "json",
        ...params,
      }),

    /**
     * @description Enables a tracking rule by setting is_enabled to true
     *
     * @tags tracking-rules
     * @name V1RulesEnableUpdate
     * @summary Enable a tracking rule
     * @request PUT:/api/v1/rules/{id}/enable
     * @response `200` `InternalApiV1RulesRuleResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `500` `GinH` Internal Server Error
     */
    v1RulesEnableUpdate: (id: number, params: RequestParams = {}) =>
      this.request<InternalApiV1RulesRuleResponse, GinH>({
        path: `/api/v1/rules/${id}/enable`,
        method: "PUT",
        format: "json",
        ...params,
      }),

    /**
     * @description Lists available rule templates for quick rule creation
     *
     * @tags tracking-rules
     * @name V1RulesTemplatesList
     * @summary Get rule templates
     * @request GET:/api/v1/rules/templates
     * @response `200` `InternalApiV1RulesListRuleTemplatesResponse` OK
     */
    v1RulesTemplatesList: (
      query?: {
        /** Filter by template category */
        category?: string;
        /** Filter builtin templates only */
        builtin?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesListRuleTemplatesResponse, any>({
        path: `/api/v1/rules/templates`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * @description Search files across volumes with text search and metadata filters
     *
     * @tags Search
     * @name V1SearchFilesList
     * @summary Search files with advanced filters
     * @request GET:/api/v1/search/files
     * @response `200` `InternalApiV1SearchSearchFilesResponse` OK
     */
    v1SearchFilesList: (
      query?: {
        /** Text search query */
        q?: string;
        /** Path prefix filter */
        path?: string;
        /** Glob pattern */
        glob?: string;
        /** Regex pattern */
        regex?: string;
        /** Media kind filter */
        mediaKind?: string;
        /** MIME type filters */
        mime?: string[];
        /** Minimum file size */
        minSize?: number;
        /** Maximum file size */
        maxSize?: number;
        /** Modified time from */
        mtimeFrom?: string;
        /** Modified time to */
        mtimeTo?: string;
        /** Min duration in ms */
        durationFrom?: number;
        /** Max duration in ms */
        durationTo?: number;
        /** Min width in pixels */
        minWidth?: number;
        /** Max width in pixels */
        maxWidth?: number;
        /** Min height in pixels */
        minHeight?: number;
        /** Max height in pixels */
        maxHeight?: number;
        /** Has GPS coordinates */
        hasGps?: boolean;
        /** Has subtitles */
        hasSubs?: boolean;
        /** Has computed hash */
        hashPresent?: boolean;
        /** Page number */
        page?: number;
        /** Items per page */
        perPage?: number;
        /** Sort field */
        sort?: string;
        /** Sort order */
        order?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1SearchSearchFilesResponse, any>({
        path: `/api/v1/search/files`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get a list of all saved searches
     *
     * @tags Search
     * @name V1SearchSavedList
     * @summary List saved searches
     * @request GET:/api/v1/search/saved
     * @response `200` `InternalApiV1SearchListSavedSearchesResponse` OK
     */
    v1SearchSavedList: (
      query?: {
        /** Page number */
        page?: number;
        /** Items per page */
        perPage?: number;
        /** Filter by tags */
        tags?: string[];
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1SearchListSavedSearchesResponse, any>({
        path: `/api/v1/search/saved`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Save a search query for later use
     *
     * @tags Search
     * @name V1SearchSavedCreate
     * @summary Create a saved search
     * @request POST:/api/v1/search/saved
     * @response `201` `InternalApiV1SearchSavedSearch` Created
     */
    v1SearchSavedCreate: (
      search: InternalApiV1SearchCreateSavedSearchRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1SearchSavedSearch, any>({
        path: `/api/v1/search/saved`,
        method: "POST",
        body: search,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete a saved search by ID
     *
     * @tags Search
     * @name V1SearchSavedDelete
     * @summary Delete a saved search
     * @request DELETE:/api/v1/search/saved/{id}
     * @response `204` `void` No content
     */
    v1SearchSavedDelete: (id: number, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/v1/search/saved/${id}`,
        method: "DELETE",
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get details of a specific saved search
     *
     * @tags Search
     * @name V1SearchSavedDetail
     * @summary Get a saved search
     * @request GET:/api/v1/search/saved/{id}
     * @response `200` `InternalApiV1SearchSavedSearch` OK
     */
    v1SearchSavedDetail: (id: number, params: RequestParams = {}) =>
      this.request<InternalApiV1SearchSavedSearch, any>({
        path: `/api/v1/search/saved/${id}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Update an existing saved search
     *
     * @tags Search
     * @name V1SearchSavedUpdate
     * @summary Update a saved search
     * @request PUT:/api/v1/search/saved/{id}
     * @response `200` `InternalApiV1SearchSavedSearch` OK
     */
    v1SearchSavedUpdate: (
      id: number,
      search: InternalApiV1SearchUpdateSavedSearchRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1SearchSavedSearch, any>({
        path: `/api/v1/search/saved/${id}`,
        method: "PUT",
        body: search,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Execute a saved search and return results
     *
     * @tags Search
     * @name V1SearchSavedRunCreate
     * @summary Run a saved search
     * @request POST:/api/v1/search/saved/{id}/run
     * @response `200` `InternalApiV1SearchSearchFilesResponse` OK
     */
    v1SearchSavedRunCreate: (id: number, params: RequestParams = {}) =>
      this.request<InternalApiV1SearchSearchFilesResponse, any>({
        path: `/api/v1/search/saved/${id}/run`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get intelligent search suggestions based on partial query
     *
     * @tags Search
     * @name V1SearchSuggestionsList
     * @summary Get search suggestions
     * @request GET:/api/v1/search/suggestions
     * @response `200` `InternalApiV1SearchSearchSuggestionsResponse` OK
     */
    v1SearchSuggestionsList: (
      query: {
        /** Partial query string */
        q: string;
        /**
         * Maximum suggestions to return (1-20)
         * @default 10
         */
        limit?: number;
        /** Suggestion type filter */
        type?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1SearchSearchSuggestionsResponse, any>({
        path: `/api/v1/search/suggestions`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Applies tracking rules to update mount tracking status in the catalog
     *
     * @tags tracking-rules-apply
     * @name V1TrackingApplyCreate
     * @summary Apply tracking rules
     * @request POST:/api/v1/tracking/apply
     * @response `200` `InternalApiV1RulesApplyTrackingRulesResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingApplyCreate: (
      request: InternalApiV1RulesApplyTrackingRulesRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesApplyTrackingRulesResponse, GinH>({
        path: `/api/v1/tracking/apply`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Lists all per-mount tracking overrides
     *
     * @tags tracking-overrides
     * @name V1TrackingOverridesList
     * @summary List mount tracking overrides
     * @request GET:/api/v1/tracking/overrides
     * @response `200` `InternalApiV1RulesListMountOverridesResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingOverridesList: (params: RequestParams = {}) =>
      this.request<InternalApiV1RulesListMountOverridesResponse, GinH>({
        path: `/api/v1/tracking/overrides`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Creates a per-mount tracking override that supersedes rule-based decisions
     *
     * @tags tracking-overrides
     * @name V1TrackingOverridesCreate
     * @summary Create mount tracking override
     * @request POST:/api/v1/tracking/overrides
     * @response `201` `InternalApiV1RulesMountOverrideResponse` Created
     * @response `400` `GinH` Bad Request
     * @response `404` `GinH` Not Found
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingOverridesCreate: (
      override: InternalApiV1RulesCreateMountOverrideRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesMountOverrideResponse, GinH>({
        path: `/api/v1/tracking/overrides`,
        method: "POST",
        body: override,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Deletes a per-mount tracking override by mount ID
     *
     * @tags tracking-overrides
     * @name V1TrackingOverridesDelete
     * @summary Delete mount tracking override
     * @request DELETE:/api/v1/tracking/overrides/{mount_id}
     * @response `204` `void` No Content
     * @response `400` `GinH` Bad Request
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingOverridesDelete: (mountId: string, params: RequestParams = {}) =>
      this.request<void, GinH>({
        path: `/api/v1/tracking/overrides/${mountId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * @description Previews how tracking rules would be applied to the current mount catalog
     *
     * @tags tracking-rules-preview
     * @name V1TrackingPreviewCreate
     * @summary Preview tracking rules evaluation
     * @request POST:/api/v1/tracking/preview
     * @response `200` `GithubComMantonxVolumevizInternalServicesRulesPreviewResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingPreviewCreate: (
      request: GithubComMantonxVolumevizInternalServicesRulesPreviewRequest,
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalServicesRulesPreviewResponse,
        GinH
      >({
        path: `/api/v1/tracking/preview`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Returns the complete tracking rules configuration with priority ordering
     *
     * @tags tracking-rules-config
     * @name V1TrackingRulesList
     * @summary Get tracking rules configuration
     * @request GET:/api/v1/tracking/rules
     * @response `200` `InternalApiV1RulesTrackingRulesConfigResponse` OK
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingRulesList: (params: RequestParams = {}) =>
      this.request<InternalApiV1RulesTrackingRulesConfigResponse, GinH>({
        path: `/api/v1/tracking/rules`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * @description Updates tracking rules configuration including priority reordering and enable/disable
     *
     * @tags tracking-rules-config
     * @name V1TrackingRulesUpdate
     * @summary Update tracking rules configuration
     * @request PUT:/api/v1/tracking/rules
     * @response `200` `InternalApiV1RulesTrackingRulesConfigResponse` OK
     * @response `400` `GinH` Bad Request
     * @response `500` `GinH` Internal Server Error
     */
    v1TrackingRulesUpdate: (
      config: InternalApiV1RulesUpdateTrackingRulesConfigRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1RulesTrackingRulesConfigResponse, GinH>({
        path: `/api/v1/tracking/rules`,
        method: "PUT",
        body: config,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  files = {
    /**
     * @description Get existing preview or generate new preview for a specific file
     *
     * @tags previews
     * @name PreviewList
     * @summary Get or generate preview by file ID
     * @request GET:/files/{file_id}/preview
     * @response `200` `File` Preview file data
     * @response `400` `GinH` Bad request
     * @response `404` `GinH` File not found
     * @response `500` `GinH` Internal server error
     */
    previewList: (
      fileId: number,
      query?: {
        /**
         * Preview type
         * @default "thumbnail"
         */
        type?: "thumbnail" | "poster" | "cover";
        /**
         * Preview size
         * @default "medium"
         */
        size?: "small" | "medium" | "large";
        /** Time offset for video thumbnails (e.g., '5.0' for 5 seconds) */
        offset?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<File, GinH>({
        path: `/files/${fileId}/preview`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Get comprehensive information about a specific file including metadata
     *
     * @tags files
     * @name DetailsList
     * @summary Get file details
     * @request GET:/files/{id}/details
     * @response `200` `FileDetailsResponse` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    detailsList: (id: number, params: RequestParams = {}) =>
      this.request<
        FileDetailsResponse,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/files/${id}/details`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get enriched metadata for a specific file (media properties, EXIF, etc.)
     *
     * @tags files
     * @name MetadataList
     * @summary Get file metadata
     * @request GET:/files/{id}/metadata
     * @response `200` `FileMetadataResponse` OK
     * @response `400` `GithubComMantonxVolumevizInternalModelsErrorResponse` Bad Request
     * @response `404` `GithubComMantonxVolumevizInternalModelsErrorResponse` Not Found
     * @response `500` `GithubComMantonxVolumevizInternalModelsErrorResponse` Internal Server Error
     */
    metadataList: (
      id: number,
      query?: {
        /** Metadata kind filter */
        kind?: "media" | "exif" | "ffmpeg";
      },
      params: RequestParams = {},
    ) =>
      this.request<
        FileMetadataResponse,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/files/${id}/metadata`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  filesystem = {
    /**
     * @description Get information about filesystem indexing capabilities and configuration
     *
     * @tags filesystem
     * @name CapabilitiesList
     * @summary Get filesystem indexing capabilities
     * @request GET:/filesystem/capabilities
     * @response `200` `FilesystemCapabilitiesResponse` OK
     */
    capabilitiesList: (params: RequestParams = {}) =>
      this.request<FilesystemCapabilitiesResponse, any>({
        path: `/filesystem/capabilities`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  health = {
    /**
     * @description Get database connection status via store interface
     *
     * @tags health
     * @name DatabaseList
     * @summary Check database health
     * @request GET:/health/database
     * @response `200` `GinH` OK
     * @response `503` `ErrorResponse` Service Unavailable
     */
    databaseList: (params: RequestParams = {}) =>
      this.request<GinH, ErrorResponse>({
        path: `/health/database`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get Docker daemon connection status and version information
     *
     * @tags health
     * @name DockerList
     * @summary Check Docker health
     * @request GET:/health/docker
     * @response `200` `DockerHealth` OK
     * @response `503` `ErrorResponse` Service Unavailable
     */
    dockerList: (params: RequestParams = {}) =>
      this.request<DockerHealth, ErrorResponse>({
        path: `/health/docker`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get Docker events service status and metrics
     *
     * @tags health
     * @name EventsList
     * @summary Check Docker events health
     * @request GET:/health/events
     * @response `200` `GinH` OK
     * @response `503` `ErrorResponse` Service Unavailable
     */
    eventsList: (params: RequestParams = {}) =>
      this.request<GinH, ErrorResponse>({
        path: `/health/events`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get scan scheduler status and metrics
     *
     * @tags health
     * @name SchedulerList
     * @summary Check scan scheduler health
     * @request GET:/health/scheduler
     * @response `200` `GinH` OK
     * @response `503` `ErrorResponse` Service Unavailable
     */
    schedulerList: (params: RequestParams = {}) =>
      this.request<GinH, ErrorResponse>({
        path: `/health/scheduler`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  media = {
    /**
     * @description Get information about available media enrichers and their capabilities
     *
     * @tags media
     * @name CapabilitiesList
     * @summary Get media enrichment capabilities
     * @request GET:/media/capabilities
     * @response `200` `MediaCapabilitiesResponse` OK
     */
    capabilitiesList: (params: RequestParams = {}) =>
      this.request<MediaCapabilitiesResponse, any>({
        path: `/media/capabilities`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  previews = {
    /**
     * @description Generate a new preview (thumbnail, poster, or cover) for a file
     *
     * @tags previews
     * @name PreviewsCreate
     * @summary Generate preview
     * @request POST:/previews
     * @response `201` `InternalApiV1PreviewsPreviewResponse` Preview generated successfully
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    previewsCreate: (
      request: InternalApiV1PreviewsPreviewRequest,
      params: RequestParams = {},
    ) =>
      this.request<InternalApiV1PreviewsPreviewResponse, GinH>({
        path: `/previews`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Delete all previews for a specific file
     *
     * @tags previews
     * @name PreviewsDelete
     * @summary Delete preview
     * @request DELETE:/previews/{file_id}
     * @response `204` `void` Previews deleted successfully
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    previewsDelete: (fileId: number, params: RequestParams = {}) =>
      this.request<void, GinH>({
        path: `/previews/${fileId}`,
        method: "DELETE",
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Serve a preview file by file ID
     *
     * @tags previews
     * @name PreviewsDetail
     * @summary Get preview file
     * @request GET:/previews/{file_id}
     * @response `200` `File` Preview file data
     * @response `400` `GinH` Bad request
     * @response `404` `GinH` Preview not found
     * @response `500` `GinH` Internal server error
     */
    previewsDetail: (
      fileId: number,
      query?: {
        /** Preview type */
        type?: "thumbnail" | "poster" | "cover";
        /** Preview size */
        size?: "small" | "medium" | "large";
      },
      params: RequestParams = {},
    ) =>
      this.request<File, GinH>({
        path: `/previews/${fileId}`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * @description Check the health status of the preview service and its dependencies
     *
     * @tags previews
     * @name HealthList
     * @summary Preview service health check
     * @request GET:/previews/health
     * @response `200` `GinH` Service health status
     */
    healthList: (params: RequestParams = {}) =>
      this.request<GinH, any>({
        path: `/previews/health`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get statistics about preview generation and usage
     *
     * @tags previews
     * @name StatsList
     * @summary Get preview statistics
     * @request GET:/previews/stats
     * @response `200` `GinH` Preview statistics
     * @response `500` `GinH` Internal server error
     */
    statsList: (params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/previews/stats`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get list of supported media types for preview generation
     *
     * @tags previews
     * @name SupportedList
     * @summary Get supported media types
     * @request GET:/previews/supported
     * @response `200` `GinH` Supported media types
     */
    supportedList: (params: RequestParams = {}) =>
      this.request<GinH, any>({
        path: `/previews/supported`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  reports = {
    /**
     * @description Get paginated list of volumes that are not attached to any containers
     *
     * @tags volumes
     * @name OrphanedList
     * @summary Get orphaned volumes
     * @request GET:/reports/orphaned
     * @response `200` `GithubComMantonxVolumevizInternalApiUtilsPagedResponse` Paginated list of orphaned volumes
     * @response `400` `ErrorResponse` Bad request
     * @response `500` `ErrorResponse` Internal server error
     */
    orphanedList: (
      query?: {
        /** Page number for pagination (default: 1) */
        page?: number;
        /** Number of items per page (default: 25, max: 100) */
        page_size?: number;
        /** Sort field and direction (e.g., 'name:asc', 'size_bytes:desc'). Available fields: name, size_bytes, created_at */
        sort?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalApiUtilsPagedResponse,
        ErrorResponse
      >({
        path: `/reports/orphaned`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  scans = {
    /**
     * @description Get the status of a volume scan by volume ID or scan ID
     *
     * @tags scan
     * @name StatusList
     * @summary Get scan status
     * @request GET:/scans/{id}/status
     * @response `200` `GinH` Scan status information
     * @response `400` `GinH` Bad request
     * @response `404` `GinH` Scan not found
     * @response `500` `GinH` Internal server error
     */
    statusList: (id: string, params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/scans/${id}/status`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  stats = {
    /**
     * @description Get daily aggregated statistics for a volume
     *
     * @tags stats
     * @name DailyList
     * @summary Get daily stats
     * @request GET:/stats/daily
     * @response `200` `VolumeStatsResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    dailyList: (
      query: {
        /** Volume ID */
        volume_id: string;
        /** Number of days to retrieve */
        days?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<VolumeStatsResponse, ErrorResponse>({
        path: `/stats/daily`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get statistics aggregated by media type (images, videos, documents, etc.)
     *
     * @tags stats
     * @name MediaList
     * @summary Get media statistics
     * @request GET:/stats/media
     * @response `200` `GinH` Media statistics
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    mediaList: (
      query: {
        /** Volume ID */
        volume_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, ErrorResponse>({
        path: `/stats/media`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed storage usage statistics including size distribution and growth trends
     *
     * @tags stats
     * @name StorageList
     * @summary Get storage statistics
     * @request GET:/stats/storage
     * @response `200` `GinH` Storage statistics
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    storageList: (
      query: {
        /** Volume ID */
        volume_id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, ErrorResponse>({
        path: `/stats/storage`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the largest folders in a volume by total size
     *
     * @tags stats
     * @name TopFoldersList
     * @summary Get top folders by size
     * @request GET:/stats/top-folders
     * @response `200` `TopFoldersResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    topFoldersList: (
      query: {
        /** Volume ID */
        volume_id: string;
        /** Number of folders to return */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<TopFoldersResponse, ErrorResponse>({
        path: `/stats/top-folders`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  system = {
    /**
     * @description Get detailed system information including service version and Docker status
     *
     * @tags system
     * @name InfoList
     * @summary Get system information
     * @request GET:/system/info
     * @response `200` `GinH` System information
     * @response `500` `GinH` Internal server error
     */
    infoList: (params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/system/info`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get API version information and available endpoints
     *
     * @tags system
     * @name VersionList
     * @summary Get API version
     * @request GET:/system/version
     * @response `200` `GinH` API version information
     */
    versionList: (params: RequestParams = {}) =>
      this.request<GinH, any>({
        path: `/system/version`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  trends = {
    /**
     * @description Get aggregated trends summary for all volumes in the system
     *
     * @tags trends
     * @name SummaryList
     * @summary Get all volumes trends summary
     * @request GET:/trends/summary
     * @response `200` `GinH` All volumes trends summary
     * @response `500` `GinH` Internal server error
     */
    summaryList: (params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/trends/summary`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get trend analysis for a specific volume over a specified time period
     *
     * @tags trends
     * @name VolumesDetail
     * @summary Get volume trends
     * @request GET:/trends/volumes/{volumeId}
     * @response `200` `GinH` Volume trends data
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumesDetail: (
      volumeId: string,
      query?: {
        /** Number of days to analyze (default: 30, max: 365) */
        days?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get 7-day trend summary for a volume
     *
     * @tags trends
     * @name Volumes7DayList
     * @summary Get 7-day trend
     * @request GET:/trends/volumes/{volumeId}/7day
     * @response `200` `GinH` 7-day trend summary
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumes7DayList: (volumeId: string, params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}/7day`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get 30-day trend summary for a volume
     *
     * @tags trends
     * @name Volumes30DayList
     * @summary Get 30-day trend
     * @request GET:/trends/volumes/{volumeId}/30day
     * @response `200` `GinH` 30-day trend summary
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumes30DayList: (volumeId: string, params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}/30day`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get growth deltas (changes) for a volume over time
     *
     * @tags trends
     * @name VolumesDeltasList
     * @summary Get volume growth deltas
     * @request GET:/trends/volumes/{volumeId}/deltas
     * @response `200` `GinH` Volume growth deltas
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumesDeltasList: (
      volumeId: string,
      query?: {
        /**
         * Delta type (daily, weekly)
         * @default "daily"
         */
        type?: string;
        /** Number of deltas to return (default: 30) */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}/deltas`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get step series data for a volume suitable for time-series charting
     *
     * @tags trends
     * @name VolumesSeriesList
     * @summary Get volume step series
     * @request GET:/trends/volumes/{volumeId}/series
     * @response `200` `GinH` Volume step series data
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumesSeriesList: (
      volumeId: string,
      query?: {
        /**
         * Series type (daily, weekly)
         * @default "daily"
         */
        type?: string;
        /** Number of days to include (default: 30) */
        days?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}/series`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Calculate the trend slope for a volume to determine growth rate
     *
     * @tags trends
     * @name VolumesSlopeList
     * @summary Get volume trend slope
     * @request GET:/trends/volumes/{volumeId}/slope
     * @response `200` `GinH` Volume trend slope data
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    volumesSlopeList: (
      volumeId: string,
      query?: {
        /**
         * Trend type (daily, weekly)
         * @default "daily"
         */
        type?: string;
        /** Number of days to analyze (default: 30) */
        days?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GinH, GinH>({
        path: `/trends/volumes/${volumeId}/slope`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  volumes = {
    /**
     * @description Get paginated list of Docker volumes with filtering, sorting, and search capabilities
     *
     * @tags volumes
     * @name VolumesList
     * @summary List Docker volumes
     * @request GET:/volumes
     * @response `200` `GithubComMantonxVolumevizInternalApiUtilsPagedResponse` Paginated list of volumes
     * @response `400` `ErrorResponse` Bad request
     * @response `500` `ErrorResponse` Internal server error
     */
    volumesList: (
      query?: {
        /** Page number for pagination (default: 1) */
        page?: number;
        /** Number of items per page (default: 25, max: 100) */
        page_size?: number;
        /** Sort field and direction (e.g., 'name:asc', 'created_at:desc'). Available fields: name, driver, created_at, size_bytes */
        sort?: string;
        /** Search query to filter volumes by name */
        q?: string;
        /** Filter by volume driver */
        driver?: "local" | "nfs" | "cifs" | "overlay2";
        /** Filter orphaned volumes (not attached to any container) */
        orphaned?: boolean;
        /** Include system volumes (default: false) */
        system?: boolean;
        /** Filter volumes created after date (RFC3339 format) */
        created_after?: string;
        /** Filter volumes created before date (RFC3339 format) */
        created_before?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        GithubComMantonxVolumevizInternalApiUtilsPagedResponse,
        ErrorResponse
      >({
        path: `/volumes`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Manually trigger filesystem indexing for a specific volume
     *
     * @tags filesystem
     * @name FilesystemIndexCreate
     * @summary Trigger filesystem indexing
     * @request POST:/volumes/{id}/filesystem/index
     * @response `202` `FilesystemIndexingResponse` Indexing started
     * @response `400` `ErrorResponse` Bad Request
     * @response `409` `ErrorResponse` Indexing already in progress
     * @response `503` `ErrorResponse` Filesystem indexing not enabled
     */
    filesystemIndexCreate: (
      id: string,
      request: GithubComMantonxVolumevizInternalModelsFilesystemIndexingRequest,
      params: RequestParams = {},
    ) =>
      this.request<FilesystemIndexingResponse, ErrorResponse>({
        path: `/volumes/${id}/filesystem/index`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Manually trigger media metadata enrichment for a specific volume
     *
     * @tags media
     * @name MediaEnrichCreate
     * @summary Trigger media enrichment
     * @request POST:/volumes/{id}/media/enrich
     * @response `202` `MediaEnrichmentResponse` Enrichment started
     * @response `400` `ErrorResponse` Bad Request
     * @response `503` `ErrorResponse` Media enrichment not enabled
     */
    mediaEnrichCreate: (id: string, params: RequestParams = {}) =>
      this.request<MediaEnrichmentResponse, ErrorResponse>({
        path: `/volumes/${id}/media/enrich`,
        method: "POST",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the current status of media enrichment for a volume
     *
     * @tags media
     * @name MediaStatusList
     * @summary Get media enrichment status
     * @request GET:/volumes/{id}/media/status
     * @response `200` `MediaEnrichmentStatusResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `503` `ErrorResponse` Media enrichment not enabled
     */
    mediaStatusList: (id: string, params: RequestParams = {}) =>
      this.request<MediaEnrichmentStatusResponse, ErrorResponse>({
        path: `/volumes/${id}/media/status`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the status of a volume scan by volume ID or scan ID
     *
     * @tags scan
     * @name ScanStatusList
     * @summary Get scan status
     * @request GET:/volumes/{id}/scan/status
     * @response `200` `GinH` Scan status information
     * @response `400` `GinH` Bad request
     * @response `404` `GinH` Scan not found
     * @response `500` `GinH` Internal server error
     */
    scanStatusList: (id: string, params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/volumes/${id}/scan/status`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the current size and statistics of a Docker volume
     *
     * @tags scan
     * @name SizeList
     * @summary Get volume size
     * @request GET:/volumes/{id}/size
     * @response `200` `ScanResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    sizeList: (id: string, params: RequestParams = {}) =>
      this.request<ScanResponse, ErrorResponse>({
        path: `/volumes/${id}/size`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Clear cache and recalculate volume size, optionally async
     *
     * @tags scan
     * @name SizeRefreshCreate
     * @summary Refresh volume size
     * @request POST:/volumes/{id}/size/refresh
     * @response `200` `ScanResponse` Sync scan completed
     * @response `202` `AsyncScanResponse` Async scan started
     * @response `400` `ErrorResponse` Bad Request
     * @response `500` `ErrorResponse` Internal Server Error
     */
    sizeRefreshCreate: (
      id: string,
      request: RefreshRequest,
      params: RequestParams = {},
    ) =>
      this.request<ScanResponse, ErrorResponse>({
        path: `/volumes/${id}/size/refresh`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed information about a specific Docker volume by name
     *
     * @tags volumes
     * @name VolumesDetail
     * @summary Get volume details
     * @request GET:/volumes/{name}
     * @response `200` `VolumeV1` Volume details
     * @response `400` `ErrorResponse` Bad request
     * @response `404` `ErrorResponse` Volume not found
     * @response `500` `ErrorResponse` Internal server error
     */
    volumesDetail: (name: string, params: RequestParams = {}) =>
      this.request<VolumeV1, ErrorResponse>({
        path: `/volumes/${name}`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get list of containers that have the specified volume mounted
     *
     * @tags volumes
     * @name AttachmentsList
     * @summary Get volume attachments
     * @request GET:/volumes/{name}/attachments
     * @response `200` `GithubComMantonxVolumevizInternalApiUtilsPagedResponse` List of container attachments
     * @response `400` `ErrorResponse` Bad request
     * @response `404` `ErrorResponse` Volume not found
     * @response `500` `ErrorResponse` Internal server error
     */
    attachmentsList: (name: string, params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalApiUtilsPagedResponse,
        ErrorResponse
      >({
        path: `/volumes/${name}/attachments`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed statistics and usage information for a specific volume
     *
     * @tags volumes
     * @name StatsList
     * @summary Get volume statistics
     * @request GET:/volumes/{name}/stats
     * @response `200` `VolumeStatsResponse` Volume statistics
     * @response `400` `ErrorResponse` Bad request
     * @response `404` `ErrorResponse` Volume not found
     * @response `500` `ErrorResponse` Internal server error
     */
    statsList: (name: string, params: RequestParams = {}) =>
      this.request<VolumeStatsResponse, ErrorResponse>({
        path: `/volumes/${name}/stats`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the current status of filesystem indexing for a volume
     *
     * @tags filesystem
     * @name FilesystemStatusList
     * @summary Get filesystem indexing status
     * @request GET:/volumes/{volumeId}/filesystem/status
     * @response `200` `FilesystemIndexingResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `503` `ErrorResponse` Filesystem indexing not enabled
     */
    filesystemStatusList: (
      id: string,
      volumeId: string,
      params: RequestParams = {},
    ) =>
      this.request<FilesystemIndexingResponse, ErrorResponse>({
        path: `/volumes/${volumeId}/filesystem/status`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Scan multiple volumes at once, with support for async processing
     *
     * @tags scan
     * @name BulkScanCreate
     * @summary Bulk scan volumes
     * @request POST:/volumes/bulk-scan
     * @response `200` `GinH` Bulk scan results
     * @response `400` `GinH` Bad request
     * @response `500` `GinH` Internal server error
     */
    bulkScanCreate: (request: BulkScanRequest, params: RequestParams = {}) =>
      this.request<GinH, GinH>({
        path: `/volumes/bulk-scan`,
        method: "POST",
        body: request,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
}

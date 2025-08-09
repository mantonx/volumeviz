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

/** Docker volume database model with complete metadata */
export interface Volume {
  /**
   * Internal database ID
   * @example 1
   */
  id?: number;
  /**
   * Docker volume identifier (unique)
   * @example "web-data"
   */
  volume_id?: string;
  /**
   * Volume name
   * @example "web-data"
   */
  name: string;
  /**
   * Volume driver type
   * @example "local"
   */
  driver: "local" | "nfs" | "cifs" | "overlay2";
  /**
   * Host filesystem mount point
   * @example "/var/lib/docker/volumes/web-data/_data"
   */
  mountpoint?: string;
  /**
   * Volume labels as key-value pairs
   * @example {"environment":"production","backup":"daily"}
   */
  labels?: Record<string, string>;
  /**
   * Volume driver options
   * @example {"type":"none"}
   */
  options?: Record<string, string>;
  /**
   * Volume scope
   * @default "local"
   */
  scope?: "local" | "global";
  /**
   * Volume status
   * @default "active"
   */
  status?: "active" | "inactive" | "error";
  /**
   * Timestamp of last successful scan
   * @format date-time
   */
  last_scanned?: string | null;
  /**
   * Timestamp of last successful scan (alias for last_scanned)
   * @format date-time
   */
  last_scan_at?: string | null;
  /**
   * Whether the volume is currently active
   * @default true
   */
  is_active?: boolean;
  /**
   * Volume creation timestamp
   * @format date-time
   */
  created_at: string;
  /**
   * Last update timestamp
   * @format date-time
   */
  updated_at?: string;
  /**
   * Volume size in bytes
   * @format int64
   */
  size_bytes?: number | null;
  /**
   * Number of containers using this volume
   * @default 0
   */
  attachments_count?: number;
  /**
   * Whether this is a system/internal volume
   * @default false
   */
  is_system?: boolean;
  /**
   * Whether this volume has no container attachments
   * @default false
   */
  is_orphaned?: boolean;
}

/** Volume size calculation result */
export interface VolumeSize {
  /** Internal database ID */
  id?: number;
  /** Associated volume identifier */
  volume_id: string;
  /**
   * Total volume size in bytes
   * @format int64
   * @min 0
   */
  total_size: number;
  /**
   * Number of files in volume
   * @format int64
   * @min 0
   */
  file_count?: number;
  /**
   * Number of directories in volume
   * @format int64
   * @min 0
   */
  directory_count?: number;
  /**
   * Size of largest file in bytes
   * @format int64
   * @min 0
   */
  largest_file?: number;
  /** Scan method used */
  scan_method: "diskus" | "du" | "native";
  /**
   * Scan duration in nanoseconds
   * @format int64
   */
  scan_duration?: number;
  /**
   * Detected filesystem type
   * @example "ext4"
   */
  filesystem_type?: string;
  /** MD5 checksum of scan result */
  checksum_md5?: string | null;
  /**
   * Whether the scan result is valid
   * @default true
   */
  is_valid?: boolean;
  /** Error message if scan failed */
  error_message?: string | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** Asynchronous scan job tracking */
export interface ScanJob {
  /** Internal database ID */
  id?: number;
  /**
   * Unique scan identifier
   * @example "scan_web-data_1640995200"
   */
  scan_id: string;
  /** Associated volume identifier */
  volume_id: string;
  /** Current job status */
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  /**
   * Scan progress percentage
   * @min 0
   * @max 100
   */
  progress?: number;
  /** Scan method being used */
  method: "diskus" | "du" | "native";
  /**
   * Job start timestamp
   * @format date-time
   */
  started_at?: string | null;
  /**
   * Job completion timestamp
   * @format date-time
   */
  completed_at?: string | null;
  /** Error message if job failed */
  error_message?: string | null;
  /** Associated VolumeSize result ID */
  result_id?: number | null;
  /**
   * Estimated completion time in nanoseconds
   * @format int64
   */
  estimated_duration?: number | null;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** Docker container database model */
export interface Container {
  /** Internal database ID */
  id?: number;
  /** Docker container identifier (unique) */
  container_id: string;
  /** Container name */
  name: string;
  /** Container image */
  image: string;
  /** Container state */
  state:
    | "created"
    | "running"
    | "paused"
    | "restarting"
    | "removing"
    | "exited"
    | "dead";
  /** Container status description */
  status?: string;
  /** Container labels */
  labels?: Record<string, string>;
  /** @format date-time */
  started_at?: string | null;
  /** @format date-time */
  finished_at?: string | null;
  /** @default true */
  is_active?: boolean;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** Container-volume mount relationship */
export interface VolumeMount {
  id?: number;
  /** Associated volume identifier */
  volume_id: string;
  /** Associated container identifier */
  container_id: string;
  /** Mount path inside container */
  mount_path: string;
  /**
   * Access mode
   * @default "rw"
   */
  access_mode?: "rw" | "ro";
  /** @default true */
  is_active?: boolean;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** Historical volume metrics for analytics */
export interface VolumeMetrics {
  id?: number;
  volume_id: string;
  /**
   * Metrics collection timestamp
   * @format date-time
   */
  metric_timestamp: string;
  /** @format int64 */
  total_size: number;
  /** @format int64 */
  file_count?: number;
  /** @format int64 */
  directory_count?: number;
  /**
   * Growth rate in bytes per day
   * @format double
   */
  growth_rate?: number | null;
  /**
   * Number of scans per day
   * @default 0
   */
  access_frequency?: number;
  /**
   * Number of containers using this volume
   * @default 0
   */
  container_count?: number;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** System component health monitoring */
export interface SystemHealth {
  id?: number;
  /** System component name */
  component: "docker" | "database" | "filesystem" | "scanner";
  /** Health status */
  status: "healthy" | "warning" | "critical" | "unknown";
  /** @format date-time */
  last_check_at: string;
  /**
   * Response time in milliseconds
   * @format int64
   */
  response_time?: number | null;
  error_message?: string | null;
  /** Additional component-specific metadata */
  metadata?: Record<string, string>;
  /** @format date-time */
  created_at?: string;
  /** @format date-time */
  updated_at?: string;
}

/** Database migration history */
export interface MigrationHistory {
  id?: number;
  /**
   * Migration version identifier
   * @example "001"
   */
  version: string;
  /**
   * Migration description
   * @example "Initial schema creation"
   */
  description: string;
  /** @format date-time */
  applied_at?: string;
  /** SQL for rolling back this migration */
  rollback_sql?: string | null;
  /** MD5 checksum of migration SQL */
  checksum: string;
  /**
   * Migration execution time in milliseconds
   * @format int64
   */
  execution_time?: number;
}

/** Overall database migration status */
export interface MigrationStatus {
  /** Total number of available migrations */
  total_migrations: number;
  /** Number of applied migrations */
  applied_count: number;
  /** Number of pending migrations */
  pending_count: number;
  applied_migrations?: MigrationHistory[];
  /** List of pending migration versions */
  pending_migrations?: string[];
  /** Database migration history */
  last_applied?: MigrationHistory | null;
}

/** Database connection health status */
export interface DatabaseHealth {
  status: "healthy" | "degraded" | "unhealthy";
  /**
   * Database response time in nanoseconds
   * @format int64
   */
  response_time: number;
  /** Current open connections */
  open_connections?: number;
  /** Current idle connections */
  idle_connections?: number;
  /** Maximum allowed open connections */
  max_open_connections?: number;
  /** Error message if unhealthy */
  error?: string | null;
}

/** Comprehensive database statistics */
export interface DatabaseStats {
  /** Volume-related statistics */
  volume_stats: VolumeStats;
  /** Scan job statistics */
  scan_job_stats: ScanJobStats;
  /** Database connection health status */
  database_health: DatabaseHealth;
  /** Overall database migration status */
  migration_status: MigrationStatus;
}

/** Volume-related statistics */
export interface VolumeStats {
  /** Total number of volumes */
  total_volumes: number;
  /** Number of active volumes */
  active_volumes: number;
  /** Number of unique volume drivers */
  unique_drivers: number;
  /** Number of volumes that have been scanned */
  scanned_volumes: number;
  /** @format date-time */
  newest_volume?: string | null;
  /** @format date-time */
  oldest_volume?: string | null;
}

/** Scan job statistics */
export interface ScanJobStats {
  /** Total number of scan jobs (last 30 days) */
  total_jobs: number;
  /** Number of queued jobs */
  queued_jobs: number;
  /** Number of currently running jobs */
  running_jobs: number;
  /** Number of completed jobs */
  completed_jobs: number;
  /** Number of failed jobs */
  failed_jobs: number;
  /** Number of cancelled jobs */
  cancelled_jobs: number;
  /**
   * Average job duration in nanoseconds
   * @format int64
   */
  avg_duration?: number | null;
}

/** Database connection test result */
export interface ConnectionTestResult {
  /** Whether the connection test succeeded */
  success: boolean;
  /** Human-readable test result message */
  message: string;
  /** Error message if test failed */
  error?: string | null;
  /** Current open connections */
  open_connections?: number | null;
  /** Current idle connections */
  idle_connections?: number | null;
  /** Maximum allowed open connections */
  max_open_connections?: number | null;
}

/** Database table size and statistics information */
export interface TableSizeInfo {
  /** Database schema name */
  schema_name: string;
  /** Table name */
  table_name: string;
  /** Column name */
  column_name: string;
  /**
   * Number of distinct values in column
   * @format int64
   */
  distinct_values?: number | null;
  /**
   * Statistical correlation of column values
   * @format double
   */
  correlation?: number | null;
}

/** Slow query performance information */
export interface SlowQueryInfo {
  /** SQL query text */
  query: string;
  /**
   * Number of times query was executed
   * @format int64
   */
  calls: number;
  /**
   * Total execution time in milliseconds
   * @format double
   */
  total_time: number;
  /**
   * Average execution time in milliseconds
   * @format double
   */
  mean_time: number;
  /**
   * Minimum execution time in milliseconds
   * @format double
   */
  min_time: number;
  /**
   * Maximum execution time in milliseconds
   * @format double
   */
  max_time: number;
  /**
   * Standard deviation of execution time
   * @format double
   */
  stddev_time: number;
  /**
   * Total number of rows returned
   * @format int64
   */
  rows: number;
  /**
   * Cache hit percentage
   * @format double
   */
  hit_percent?: number | null;
}

export interface DockerHealth {
  /** Overall Docker daemon health status */
  status: "healthy" | "unhealthy" | "unknown";
  /** Human-readable status message */
  message: string;
  /** Docker engine version */
  version?: string;
  /** Docker API version */
  api_version?: string;
  /** Go version used to build Docker */
  go_version?: string;
  /** Git commit hash */
  git_commit?: string;
  /**
   * Docker build timestamp
   * @format date-time
   */
  build_time?: string;
}

export interface HealthStatus {
  status?: "healthy" | "unhealthy" | "degraded";
  /** @format date-time */
  timestamp?: string;
  checks?: Record<
    string,
    {
      status?: string;
      message?: string;
      duration?: string;
    }
  >;
}

export interface VolumeListResponse {
  /**
   * Total number of volumes
   * @min 0
   */
  total: number;
  volumes: VolumeResponse[];
}

export interface VolumeResponse {
  /** Unique volume identifier */
  id: string;
  /** Volume name */
  name: string;
  /** Volume driver (local, nfs, etc.) */
  driver: string;
  /** Host filesystem mount point */
  mountpoint: string;
  /**
   * Volume creation timestamp
   * @format date-time
   */
  created_at?: string;
  /** Volume labels */
  labels?: Record<string, string>;
  /** Volume driver options */
  options?: Record<string, string>;
  /** Volume scope (local, global) */
  scope?: string;
}

export interface VolumeContainer {
  /** Container ID */
  id: string;
  /** Container name */
  name: string;
  /** Container image */
  image?: string;
  /** Container state */
  state?: string;
  /** Volume mount path inside container */
  mount_path: string;
  /** Access mode (read-write or read-only) */
  access_mode: "rw" | "ro";
}

export interface VolumeStatistics {
  volume_id?: string;
  /** @format int64 */
  size_bytes?: number;
  file_count?: number;
  /** @format date-time */
  last_modified?: string;
  /** Number of containers using this volume */
  ref_count?: number;
}

export interface ScanResponse {
  /** Volume identifier */
  volume_id: string;
  /** Whether result was served from cache */
  cached: boolean;
  result: ScanResult;
}

export interface ScanResult {
  /** Volume identifier */
  volume_id: string;
  /**
   * Total volume size in bytes
   * @format int64
   * @min 0
   */
  total_size: number;
  /**
   * Number of files in volume
   * @min 0
   */
  file_count: number;
  /**
   * Number of directories in volume
   * @min 0
   */
  directory_count: number;
  /**
   * Size of largest file in bytes
   * @format int64
   * @min 0
   */
  largest_file?: number;
  /** Scan method used */
  method: "diskus" | "du" | "native";
  /**
   * Scan duration in nanoseconds
   * @format int64
   */
  duration: number;
  /** Whether scan was served from cache */
  cache_hit: boolean;
  /**
   * Scan completion timestamp
   * @format date-time
   */
  scanned_at: string;
  /** Detected filesystem type */
  filesystem_type?: string;
}

export interface RefreshRequest {
  /**
   * Preferred scan method
   * @default "diskus"
   */
  method?: "diskus" | "du" | "native";
  /**
   * Whether to perform async scan
   * @default false
   */
  async?: boolean;
}

export interface AsyncScanResponse {
  /** Unique scan identifier for status tracking */
  scan_id: string;
  /** Volume identifier */
  volume_id: string;
  /** Initial scan status */
  status: "started" | "queued";
}

export interface ScanProgress {
  /** Unique scan identifier */
  scan_id: string;
  /** Volume identifier */
  volume_id: string;
  /** Current scan status */
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  /**
   * Scan progress percentage
   * @min 0
   * @max 100
   */
  progress?: number;
  /** Scan method being used */
  method?: string;
  /**
   * Scan start timestamp
   * @format date-time
   */
  started_at?: string;
  /**
   * Scan completion timestamp (if completed)
   * @format date-time
   */
  completed_at?: string;
  /**
   * Estimated completion time (if running)
   * @format date-time
   */
  estimated_completion?: string;
  /** Error message (if failed) */
  error?: string;
  /** Scan result (if completed successfully) */
  result?: ScanResult;
}

export interface ScanMethod {
  /** Method name */
  name: string;
  /** Method description */
  description: string;
  /** Whether method is available on this system */
  available: boolean;
  /** Relative performance rating */
  performance: "high" | "medium" | "low";
  /** List of supported filesystems (* means all) */
  supports_filesystem?: string[];
}

export interface SystemInfo {
  application?: {
    name?: string;
    version?: string;
    /** @format date-time */
    build_time?: string;
    git_commit?: string;
  };
  docker?: DockerHealth;
  host?: {
    os?: string;
    architecture?: string;
    cpu_count?: number;
    /** @format int64 */
    memory_total?: number;
  };
}

export interface VersionInfo {
  version: string;
  /** @format date-time */
  build_time?: string;
  git_commit?: string;
  go_version?: string;
}

/** Paginated volumes response */
export interface PagedVolumes {
  data: Volume[];
  /** Current page number */
  page: number;
  /** Items per page */
  page_size: number;
  /** Total number of items */
  total: number;
  /** Applied sort order */
  sort?: string;
  /** Applied filters */
  filters?: object;
}

/** Detailed volume information with attachments */
export type VolumeDetail = Volume & {
  attachments?: Attachment[];
  /** Additional metadata */
  meta?: Record<string, any>;
};

/** Container attachment to a volume */
export interface Attachment {
  /** Container ID */
  container_id: string;
  /** Container name */
  container_name?: string;
  /** Mount path inside container */
  mount_path: string;
  /** Read-write access */
  rw: boolean;
  /**
   * When this attachment was first observed
   * @format date-time
   */
  first_seen?: string;
  /**
   * When this attachment was last observed
   * @format date-time
   */
  last_seen?: string;
}

/** List of volume attachments */
export interface AttachmentsList {
  data: Attachment[];
  /** Total number of attachments */
  total: number;
}

/** Paginated orphaned volumes response */
export interface PagedOrphanedVolumes {
  data: {
    name?: string;
    driver?: string;
    /** @format int64 */
    size_bytes?: number;
    /** @format date-time */
    created_at?: string;
    is_system?: boolean;
  }[];
  page: number;
  page_size: number;
  total: number;
}

/** Uniform error response format */
export interface Error {
  error: {
    /** Machine-readable error code */
    code:
      | "bad_request"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "rate_limited"
      | "internal";
    /** Human-readable error message */
    message: string;
    /** Additional error details */
    details?: Record<string, any>;
    /**
     * Request correlation ID for debugging
     * @format uuid
     */
    request_id: string;
  };
}

/** @example {"error":"Volume not found","code":"VOLUME_NOT_FOUND","details":"Volume 'web-data' does not exist or is not accessible","correlation_id":"req-123e4567-e89b-12d3-a456-426614174000"} */
export interface ErrorResponse {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code */
  code:
    | "VOLUME_NOT_FOUND"
    | "DOCKER_UNAVAILABLE"
    | "DOCKER_CONNECTION_ERROR"
    | "SCAN_IN_PROGRESS"
    | "SCAN_FAILED"
    | "INVALID_REQUEST"
    | "INTERNAL_ERROR"
    | "PERMISSION_DENIED"
    | "TIMEOUT"
    | "RATE_LIMITED";
  /** Additional error details or troubleshooting information */
  details?: string;
  /** Request correlation ID for debugging */
  correlation_id?: string;
}

export interface WebSocketMessage {
  /** Message type */
  type:
    | "volume_update"
    | "scan_progress"
    | "scan_complete"
    | "scan_error"
    | "ping"
    | "pong";
  /**
   * Message timestamp
   * @format date-time
   */
  timestamp: string;
  /** Message payload (varies by type) */
  data?: object;
  /** Related volume ID (if applicable) */
  volume_id?: string;
}

export type VolumeUpdateMessage = WebSocketMessage & {
  /** Updated volume list */
  data: VolumeResponse[];
};

export type ScanProgressMessage = WebSocketMessage & {
  /** Volume being scanned */
  volume_id: string;
  data: {
    /**
     * Progress percentage
     * @min 0
     * @max 100
     */
    progress: number;
    /**
     * Current calculated size in bytes
     * @format int64
     */
    current_size: number;
    /** Number of files processed */
    files_processed: number;
  };
};

export type ScanCompleteMessage = WebSocketMessage & {
  /** Volume that was scanned */
  volume_id: string;
  data: {
    /** Volume ID */
    volume_id: string;
    result: ScanResult;
  };
};

export type ScanErrorMessage = WebSocketMessage & {
  /** Volume that failed to scan */
  volume_id: string;
  data: {
    /** Error message */
    error: string;
    /** Error code */
    code: string;
  };
};

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
    [ContentType.FormData]: (input: any) =>
      Object.keys(input || {}).reduce((formData, key) => {
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
      }, new FormData()),
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
 * @version 1.0.0
 * @license MIT (https://github.com/mantonx/volumeviz/blob/main/LICENSE)
 * @termsOfService https://github.com/mantonx/volumeviz
 * @baseUrl http://localhost:8080/api/v1
 * @externalDocs https://github.com/mantonx/volumeviz/blob/main/docs/
 * @contact API Support <support@volumeviz.io> (https://github.com/mantonx/volumeviz/issues)
 *
 * Docker volume monitoring API with comprehensive volume discovery, size calculation,
 * and container attachment tracking. Focus on user-mounted volumes only.
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
  health = {
    /**
     * @description Get Docker daemon connection status and version information. Used for monitoring Docker API connectivity and version compatibility.
     *
     * @tags Health
     * @name GetDockerHealth
     * @summary Check Docker daemon health
     * @request GET:/health/docker
     * @secure
     * @response `200` `DockerHealth` Docker daemon is healthy and connected
     * @response `503` `ErrorResponse` Docker daemon is unavailable or unhealthy
     */
    getDockerHealth: (params: RequestParams = {}) =>
      this.request<DockerHealth, ErrorResponse>({
        path: `/health/docker`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Overall application health including all dependencies
     *
     * @tags Health
     * @name GetAppHealth
     * @summary Check application health
     * @request GET:/health/app
     * @secure
     * @response `200` `HealthStatus` Application is healthy
     */
    getAppHealth: (params: RequestParams = {}) =>
      this.request<HealthStatus, any>({
        path: `/health/app`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Kubernetes readiness probe endpoint
     *
     * @tags Health
     * @name GetReadiness
     * @summary Readiness probe
     * @request GET:/health/readiness
     * @secure
     * @response `200` `void` Application is ready to serve traffic
     */
    getReadiness: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/health/readiness`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * @description Kubernetes liveness probe endpoint
     *
     * @tags Health
     * @name GetLiveness
     * @summary Liveness probe
     * @request GET:/health/liveness
     * @secure
     * @response `200` `void` Application is alive
     */
    getLiveness: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/health/liveness`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  ws = {
    /**
     * @description Establishes a WebSocket connection for real-time volume updates and scan progress. ## Message Types ### Client to Server: - `ping`: Heartbeat message ### Server to Client: - `volume_update`: Volume data has changed - `scan_progress`: Scan progress update - `scan_complete`: Scan completed - `scan_error`: Scan failed - `pong`: Heartbeat response ## Usage Example: ```javascript const ws = new WebSocket('ws://localhost:8080/api/v1/ws'); ws.onmessage = (event) => { const message = JSON.parse(event.data); switch(message.type) { case 'volume_update': // Handle volume update break; case 'scan_complete': // Handle scan completion break; } }; ```
     *
     * @tags Real-time
     * @name ConnectWebSocket
     * @summary WebSocket endpoint for real-time updates
     * @request GET:/ws
     * @secure
     * @response `101` `void` Switching Protocols - WebSocket connection established
     * @response `400` `ErrorResponse` Bad Request - Invalid WebSocket headers
     */
    connectWebSocket: (params: RequestParams = {}) =>
      this.request<any, void | ErrorResponse>({
        path: `/ws`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  volumes = {
    /**
     * @description List volumes with pagination, sorting, and filters. **Performance**: Optimized for large volume sets (1000+ volumes). **SLO**: 95th percentile response time < 250ms.
     *
     * @tags Volumes
     * @name ListVolumes
     * @summary List Docker volumes
     * @request GET:/volumes
     * @secure
     * @response `200` `PagedVolumes` Paginated list of volumes
     * @response `401` `Error`
     * @response `429` `Error`
     * @response `500` `Error`
     */
    listVolumes: (
      query?: {
        /**
         * Page number
         * @min 1
         * @default 1
         */
        page?: number;
        /**
         * Items per page
         * @min 1
         * @max 200
         * @default 25
         */
        page_size?: number;
        /**
         * Sort field and direction (e.g., name:asc, size_bytes:desc)
         * @default "name:asc"
         * @example "size_bytes:desc,name:asc"
         */
        sort?: string;
        /** Search query (case-insensitive substring match on name and labels) */
        q?: string;
        /** Filter by exact driver match */
        driver?: "local" | "nfs" | "cifs" | "overlay2";
        /** Filter by orphaned status */
        orphaned?: boolean;
        /**
         * Include system/internal volumes
         * @default false
         */
        system?: boolean;
        /**
         * Filter volumes created after this timestamp
         * @format date-time
         */
        created_after?: string;
        /**
         * Filter volumes created before this timestamp
         * @format date-time
         */
        created_before?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<PagedVolumes, Error>({
        path: `/volumes`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed information about a specific Docker volume including metadata, labels, attachments, and usage statistics.
     *
     * @tags Volumes
     * @name GetVolume
     * @summary Get volume details
     * @request GET:/volumes/{name}
     * @secure
     * @response `200` `VolumeDetail` Volume details
     * @response `401` `Error`
     * @response `404` `Error`
     * @response `429` `Error`
     * @response `500` `Error`
     */
    getVolume: (name: string, params: RequestParams = {}) =>
      this.request<VolumeDetail, Error>({
        path: `/volumes/${name}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description List containers mounting the volume, including mount paths and access modes.
     *
     * @tags Volumes
     * @name GetVolumeAttachments
     * @summary Get volume attachments
     * @request GET:/volumes/{name}/attachments
     * @secure
     * @response `200` `AttachmentsList` List of container attachments
     * @response `401` `Error`
     * @response `404` `Error`
     * @response `429` `Error`
     * @response `500` `Error`
     */
    getVolumeAttachments: (name: string, params: RequestParams = {}) =>
      this.request<AttachmentsList, Error>({
        path: `/volumes/${name}/attachments`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get usage statistics and metadata for a volume
     *
     * @tags Volumes
     * @name GetVolumeStats
     * @summary Get volume statistics
     * @request GET:/volumes/{volumeId}/stats
     * @secure
     * @response `200` `VolumeStats` Volume statistics
     */
    getVolumeStats: (volumeId: string, params: RequestParams = {}) =>
      this.request<VolumeStats, any>({
        path: `/volumes/${volumeId}/stats`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the current size and file statistics of a Docker volume. Results are cached with TTL-based invalidation for performance. **Performance**: - Cache hit: < 5ms response time - Cache miss: varies by volume size and scan method - Large volumes (100GB+): typically < 30 seconds
     *
     * @tags Scanning
     * @name GetVolumeSize
     * @summary Get volume size
     * @request GET:/volumes/{volumeId}/size
     * @secure
     * @response `200` `ScanResponse` Volume size information
     * @response `404` `ErrorResponse` Volume not found
     * @response `500` `ErrorResponse` Scan failed
     */
    getVolumeSize: (
      volumeId: string,
      query?: {
        /**
         * Preferred scan method (fallback chain will be used if unavailable)
         * @default "diskus"
         * @example "diskus"
         */
        method?: "diskus" | "du" | "native";
      },
      params: RequestParams = {},
    ) =>
      this.request<ScanResponse, ErrorResponse>({
        path: `/volumes/${volumeId}/size`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Force a fresh scan of the volume, bypassing cache. Supports both synchronous and asynchronous scanning modes. **Synchronous mode**: Returns results immediately (default) **Asynchronous mode**: Returns scan ID for status tracking
     *
     * @tags Scanning
     * @name RefreshVolumeSize
     * @summary Refresh volume size
     * @request POST:/volumes/{volumeId}/size/refresh
     * @secure
     * @response `200` `ScanResponse` Synchronous scan completed
     * @response `202` `AsyncScanResponse` Asynchronous scan started
     * @response `400` `ErrorResponse` Invalid request
     */
    refreshVolumeSize: (
      volumeId: string,
      data?: RefreshRequest,
      params: RequestParams = {},
    ) =>
      this.request<ScanResponse, ErrorResponse>({
        path: `/volumes/${volumeId}/size/refresh`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get the status of an ongoing or completed volume scan. Used with asynchronous scanning to track progress.
     *
     * @tags Scanning
     * @name GetScanStatus
     * @summary Get scan status
     * @request GET:/volumes/{volumeId}/scan/status
     * @secure
     * @response `200` `ScanProgress` Scan status information
     * @response `404` `ErrorResponse` Scan not found
     */
    getScanStatus: (
      volumeId: string,
      query?: {
        /**
         * Scan ID (optional, returns latest scan if omitted)
         * @example "scan_web-data_1640995200"
         */
        scan_id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<ScanProgress, ErrorResponse>({
        path: `/volumes/${volumeId}/scan/status`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
 * @description Initiate scanning for multiple volumes simultaneously. Useful for refreshing cache for many volumes efficiently.
 *
 * @tags Scanning
 * @name BulkScanVolumes
 * @summary Bulk scan volumes
 * @request POST:/volumes/bulk-scan
 * @secure
 * @response `202` `{
    scan_ids?: (string)[],
    total_volumes?: number,
    status?: string,

}` Bulk scan initiated
 */
    bulkScanVolumes: (
      data: {
        /**
         * @maxItems 100
         * @minItems 1
         */
        volume_ids: string[];
        /** @default "diskus" */
        method?: "diskus" | "du" | "native";
        /** @default true */
        async?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<
        {
          scan_ids?: string[];
          total_volumes?: number;
          status?: string;
        },
        any
      >({
        path: `/volumes/bulk-scan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  reports = {
    /**
     * @description Get all volumes with zero attachments (no containers mounting them). Useful for identifying volumes that can be cleaned up.
     *
     * @tags Reports
     * @name GetOrphanedVolumesReport
     * @summary Get orphaned volumes report
     * @request GET:/reports/orphaned
     * @secure
     * @response `200` `PagedOrphanedVolumes` Paginated list of orphaned volumes
     * @response `401` `Error`
     * @response `429` `Error`
     * @response `500` `Error`
     */
    getOrphanedVolumesReport: (
      query?: {
        /**
         * Page number
         * @min 1
         * @default 1
         */
        page?: number;
        /**
         * Items per page
         * @min 1
         * @max 200
         * @default 25
         */
        page_size?: number;
        /**
         * Sort field and direction
         * @default "size_bytes:desc"
         */
        sort?: string;
        /**
         * Include system/internal volumes
         * @default false
         */
        system?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<PagedOrphanedVolumes, Error>({
        path: `/reports/orphaned`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),
  };
  scans = {
    /**
     * @description Retrieve the status of an asynchronous scan using its scan ID. This complements the volume-based endpoint.
     *
     * @tags Scanning
     * @name GetScanStatusById
     * @summary Get scan status by scan ID
     * @request GET:/scans/{scanId}/status
     * @secure
     * @response `200` `ScanProgress` Scan status information
     * @response `404` `ErrorResponse` Scan not found
     */
    getScanStatusById: (scanId: string, params: RequestParams = {}) =>
      this.request<ScanProgress, ErrorResponse>({
        path: `/scans/${scanId}/status`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),
  };
  scanMethods = {
    /**
 * @description Get list of available volume scanning methods and their capabilities. Used to determine optimal scan method for different volume types.
 *
 * @tags Scanning
 * @name GetScanMethods
 * @summary Get available scan methods
 * @request GET:/scan-methods
 * @secure
 * @response `200` `{
    methods?: (ScanMethod)[],

}` Available scan methods
 */
    getScanMethods: (params: RequestParams = {}) =>
      this.request<
        {
          methods?: ScanMethod[];
        },
        any
      >({
        path: `/scan-methods`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),
  };
  system = {
    /**
     * @description Get comprehensive system information including Docker and host details
     *
     * @tags System
     * @name GetSystemInfo
     * @summary Get system information
     * @request GET:/system/info
     * @secure
     * @response `200` `SystemInfo` System information
     */
    getSystemInfo: (params: RequestParams = {}) =>
      this.request<SystemInfo, any>({
        path: `/system/info`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get VolumeViz application version and build information
     *
     * @tags System
     * @name GetSystemVersion
     * @summary Get application version
     * @request GET:/system/version
     * @secure
     * @response `200` `VersionInfo` Version information
     */
    getSystemVersion: (params: RequestParams = {}) =>
      this.request<VersionInfo, any>({
        path: `/system/version`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),
  };
  database = {
    /**
     * @description Get comprehensive database health information including connection status, performance metrics, and resource usage for monitoring and alerting.
     *
     * @tags Database
     * @name GetDatabaseHealth
     * @summary Get database health
     * @request GET:/database/health
     * @secure
     * @response `200` `DatabaseHealth` Database is healthy
     * @response `503` `DatabaseHealth` Database is unhealthy
     */
    getDatabaseHealth: (params: RequestParams = {}) =>
      this.request<DatabaseHealth, DatabaseHealth>({
        path: `/database/health`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Test database connectivity and return detailed connection information
     *
     * @tags Database
     * @name TestDatabaseConnection
     * @summary Test database connection
     * @request GET:/database/test-connection
     * @secure
     * @response `200` `ConnectionTestResult` Connection test successful
     * @response `503` `ConnectionTestResult` Connection test failed
     */
    testDatabaseConnection: (params: RequestParams = {}) =>
      this.request<ConnectionTestResult, ConnectionTestResult>({
        path: `/database/test-connection`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get comprehensive database statistics including volume counts, scan job metrics, and performance data for operational monitoring.
     *
     * @tags Database
     * @name GetDatabaseStats
     * @summary Get database statistics
     * @request GET:/database/stats
     * @secure
     * @response `200` `DatabaseStats` Database statistics retrieved successfully
     * @response `500` `ErrorResponse` Failed to get database statistics
     */
    getDatabaseStats: (params: RequestParams = {}) =>
      this.request<DatabaseStats, ErrorResponse>({
        path: `/database/stats`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed information about database migrations including applied, pending, and completion status for deployment monitoring.
     *
     * @tags Database
     * @name GetMigrationStatus
     * @summary Get migration status
     * @request GET:/database/migrations/status
     * @secure
     * @response `200` `MigrationStatus` Migration status retrieved successfully
     * @response `500` `ErrorResponse` Failed to get migration status
     */
    getMigrationStatus: (params: RequestParams = {}) =>
      this.request<MigrationStatus, ErrorResponse>({
        path: `/database/migrations/status`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get complete history of applied database migrations with execution details
     *
     * @tags Database
     * @name GetMigrationHistory
     * @summary Get migration history
     * @request GET:/database/migrations/history
     * @secure
     * @response `200` `(MigrationHistory)[]` Migration history retrieved successfully
     * @response `500` `ErrorResponse` Failed to get migration history
     */
    getMigrationHistory: (params: RequestParams = {}) =>
      this.request<MigrationHistory[], ErrorResponse>({
        path: `/database/migrations/history`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Apply all pending database migrations. Use with caution in production environments. This endpoint should typically be called during deployment processes.
     *
     * @tags Database
     * @name ApplyPendingMigrations
     * @summary Apply pending migrations
     * @request POST:/database/migrations/apply
     * @secure
     * @response `200` `MigrationStatus` Migrations applied successfully
     * @response `400` `ErrorResponse` No pending migrations or validation error
     * @response `500` `ErrorResponse` Failed to apply migrations
     */
    applyPendingMigrations: (params: RequestParams = {}) =>
      this.request<MigrationStatus, ErrorResponse>({
        path: `/database/migrations/apply`,
        method: "POST",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Rollback a specific database migration by version. Use with extreme caution in production environments as this can result in data loss.
     *
     * @tags Database
     * @name RollbackMigration
     * @summary Rollback migration
     * @request POST:/database/migrations/{version}/rollback
     * @secure
     * @response `200` `MigrationStatus` Migration rolled back successfully
     * @response `400` `ErrorResponse` Invalid version or validation error
     * @response `404` `ErrorResponse` Migration not found
     * @response `500` `ErrorResponse` Failed to rollback migration
     */
    rollbackMigration: (version: string, params: RequestParams = {}) =>
      this.request<MigrationStatus, ErrorResponse>({
        path: `/database/migrations/${version}/rollback`,
        method: "POST",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get storage usage information for all database tables
     *
     * @tags Database
     * @name GetTableSizes
     * @summary Get table sizes
     * @request GET:/database/performance/table-sizes
     * @secure
     * @response `200` `(TableSizeInfo)[]` Table sizes retrieved successfully
     * @response `500` `ErrorResponse` Failed to get table sizes
     */
    getTableSizes: (params: RequestParams = {}) =>
      this.request<TableSizeInfo[], ErrorResponse>({
        path: `/database/performance/table-sizes`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get information about slow-running database queries for performance analysis. Requires pg_stat_statements extension to be enabled.
     *
     * @tags Database
     * @name GetSlowQueries
     * @summary Get slow queries
     * @request GET:/database/performance/slow-queries
     * @secure
     * @response `200` `(SlowQueryInfo)[]` Slow queries retrieved successfully
     * @response `500` `ErrorResponse` Failed to get slow queries
     */
    getSlowQueries: (
      query?: {
        /**
         * Maximum number of queries to return
         * @min 1
         * @max 100
         * @default 10
         */
        limit?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<SlowQueryInfo[], ErrorResponse>({
        path: `/database/performance/slow-queries`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),
  };
}

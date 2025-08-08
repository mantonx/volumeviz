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
export interface VolumeType {
  /**
   * Internal database ID
   * @example 1
   */
  id?: number;
  /**
   * Docker volume identifier (unique)
   * @example "web-data"
   */
  volume_id: string;
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
  mountpoint: string;
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
   * Whether the volume is currently active
   * @default true
   */
  is_active: boolean;
  /**
   * Volume creation timestamp
   * @format date-time
   */
  created_at?: string;
  /**
   * Last update timestamp
   * @format date-time
   */
  updated_at?: string;
}

/** Volume size calculation result */
export interface VolumeSizeType {
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
export interface ScanJobType {
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
export interface ContainerType {
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
export interface VolumeMountType {
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
export interface VolumeMetricsType {
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
export interface SystemHealthType {
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
export interface MigrationHistoryType {
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
export interface MigrationStatusType {
  /** Total number of available migrations */
  total_migrations: number;
  /** Number of applied migrations */
  applied_count: number;
  /** Number of pending migrations */
  pending_count: number;
  applied_migrations?: MigrationHistoryType[];
  /** List of pending migration versions */
  pending_migrations?: string[];
  /** Database migration history */
  last_applied?: MigrationHistoryType | null;
}

/** Database connection health status */
export interface DatabaseHealthType {
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
export interface DatabaseStatsType {
  /** Volume-related statistics */
  volume_stats: VolumeStatsType;
  /** Scan job statistics */
  scan_job_stats: ScanJobStatsType;
  /** Database connection health status */
  database_health: DatabaseHealthType;
  /** Overall database migration status */
  migration_status: MigrationStatusType;
}

/** Volume-related statistics */
export interface VolumeStatsType {
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
export interface ScanJobStatsType {
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
export interface ConnectionTestResultType {
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
export interface TableSizeInfoType {
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
export interface SlowQueryInfoType {
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

export interface DockerHealthType {
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

export interface HealthStatusType {
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

export interface VolumeListResponseType {
  /**
   * Total number of volumes
   * @min 0
   */
  total: number;
  volumes: VolumeResponseType[];
}

export interface VolumeResponseType {
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

export interface VolumeContainerType {
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

export interface VolumeStatisticsType {
  volume_id?: string;
  /** @format int64 */
  size_bytes?: number;
  file_count?: number;
  /** @format date-time */
  last_modified?: string;
  /** Number of containers using this volume */
  ref_count?: number;
}

export interface ScanResponseType {
  /** Volume identifier */
  volume_id: string;
  /** Whether result was served from cache */
  cached: boolean;
  result: ScanResultType;
}

export interface ScanResultType {
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

export interface RefreshRequestType {
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

export interface AsyncScanResponseType {
  /** Unique scan identifier for status tracking */
  scan_id: string;
  /** Volume identifier */
  volume_id: string;
  /** Initial scan status */
  status: "started" | "queued";
}

export interface ScanProgressType {
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
  result?: ScanResultType;
}

export interface ScanMethodType {
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

export interface SystemInfoType {
  application?: {
    name?: string;
    version?: string;
    /** @format date-time */
    build_time?: string;
    git_commit?: string;
  };
  docker?: DockerHealthType;
  host?: {
    os?: string;
    architecture?: string;
    cpu_count?: number;
    /** @format int64 */
    memory_total?: number;
  };
}

export interface VersionInfoType {
  version: string;
  /** @format date-time */
  build_time?: string;
  git_commit?: string;
  go_version?: string;
}

/** @example {"error":"Volume not found","code":"VOLUME_NOT_FOUND","details":"Volume 'web-data' does not exist or is not accessible","correlation_id":"req-123e4567-e89b-12d3-a456-426614174000"} */
export interface ErrorResponseType {
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

export interface WebSocketMessageType {
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

export type VolumeUpdateMessageType = WebSocketMessageType & {
  /** Updated volume list */
  data: VolumeResponseType[];
};

export type ScanProgressMessageType = WebSocketMessageType & {
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

export type ScanCompleteMessageType = WebSocketMessageType & {
  /** Volume that was scanned */
  volume_id: string;
  data: {
    /** Volume ID */
    volume_id: string;
    result: ScanResultType;
  };
};

export type ScanErrorMessageType = WebSocketMessageType & {
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
 * Docker volume monitoring and visualization API with comprehensive volume discovery,
 * size calculation, and performance monitoring capabilities.
 *
 * ## Features
 * - Real-time Docker volume discovery and monitoring
 * - Pluggable volume size calculation with multiple scan methods
 * - High-performance caching with TTL-based invalidation
 * - Async scanning with progress tracking
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
     * @response `200` `DockerHealthType` Docker daemon is healthy and connected
     * @response `503` `ErrorResponseType` Docker daemon is unavailable or unhealthy
     */
    getDockerHealth: (params: RequestParams = {}) =>
      this.request<DockerHealthType, ErrorResponseType>({
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
     * @response `200` `HealthStatusType` Application is healthy
     */
    getAppHealth: (params: RequestParams = {}) =>
      this.request<HealthStatusType, any>({
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
     * @response `400` `ErrorResponseType` Bad Request - Invalid WebSocket headers
     */
    connectWebSocket: (params: RequestParams = {}) =>
      this.request<any, void | ErrorResponseType>({
        path: `/ws`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  volumes = {
    /**
     * @description Get a list of all Docker volumes with optional filtering. Supports filtering by driver type and labels for advanced volume management. **Performance**: Optimized for large volume sets (1000+ volumes). **SLO**: 95th percentile response time < 500ms.
     *
     * @tags Volumes
     * @name ListVolumes
     * @summary List Docker volumes
     * @request GET:/volumes
     * @secure
     * @response `200` `VolumeListResponseType` List of Docker volumes
     * @response `500` `ErrorResponseType` Internal server error
     */
    listVolumes: (
      query?: {
        /**
         * Filter volumes by driver type
         * @example "local"
         */
        driver?: "local" | "nfs" | "cifs" | "overlay2";
        /**
         * Filter volumes by label key
         * @example "environment"
         */
        label_key?: string;
        /**
         * Filter volumes by label value (requires label_key)
         * @example "production"
         */
        label_value?: string;
        /**
         * Limit number of results (for pagination)
         * @min 1
         * @max 1000
         * @default 100
         */
        limit?: number;
        /**
         * Offset for pagination
         * @min 0
         * @default 0
         */
        offset?: number;
        /**
         * Filter to only show user-mounted volumes (excludes Docker infrastructure volumes)
         * @default false
         * @example true
         */
        user_only?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<VolumeListResponseType, ErrorResponseType>({
        path: `/volumes`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed information about a specific Docker volume including metadata, labels, and usage statistics if available.
     *
     * @tags Volumes
     * @name GetVolume
     * @summary Get volume details
     * @request GET:/volumes/{volumeId}
     * @secure
     * @response `200` `VolumeResponseType` Volume details
     * @response `404` `ErrorResponseType` Volume not found
     */
    getVolume: (volumeId: string, params: RequestParams = {}) =>
      this.request<VolumeResponseType, ErrorResponseType>({
        path: `/volumes/${volumeId}`,
        method: "GET",
        secure: true,
        format: "json",
        ...params,
      }),

    /**
 * @description Get all containers that are currently using the specified volume, including mount information and access modes.
 *
 * @tags Volumes
 * @name GetVolumeContainers
 * @summary Get volume containers
 * @request GET:/volumes/{volumeId}/containers
 * @secure
 * @response `200` `{
    volume_id?: string,
    containers?: (VolumeContainerType)[],

}` List of containers using the volume
 */
    getVolumeContainers: (volumeId: string, params: RequestParams = {}) =>
      this.request<
        {
          volume_id?: string;
          containers?: VolumeContainerType[];
        },
        any
      >({
        path: `/volumes/${volumeId}/containers`,
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
     * @response `200` `VolumeStatsType` Volume statistics
     */
    getVolumeStats: (volumeId: string, params: RequestParams = {}) =>
      this.request<VolumeStatsType, any>({
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
     * @response `200` `ScanResponseType` Volume size information
     * @response `404` `ErrorResponseType` Volume not found
     * @response `500` `ErrorResponseType` Scan failed
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
      this.request<ScanResponseType, ErrorResponseType>({
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
     * @response `200` `ScanResponseType` Synchronous scan completed
     * @response `202` `AsyncScanResponseType` Asynchronous scan started
     * @response `400` `ErrorResponseType` Invalid request
     */
    refreshVolumeSize: (
      volumeId: string,
      data?: RefreshRequestType,
      params: RequestParams = {},
    ) =>
      this.request<ScanResponseType, ErrorResponseType>({
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
     * @response `200` `ScanProgressType` Scan status information
     * @response `404` `ErrorResponseType` Scan not found
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
      this.request<ScanProgressType, ErrorResponseType>({
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
    methods?: (ScanMethodType)[],

}` Available scan methods
 */
    getScanMethods: (params: RequestParams = {}) =>
      this.request<
        {
          methods?: ScanMethodType[];
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
     * @response `200` `SystemInfoType` System information
     */
    getSystemInfo: (params: RequestParams = {}) =>
      this.request<SystemInfoType, any>({
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
     * @response `200` `VersionInfoType` Version information
     */
    getSystemVersion: (params: RequestParams = {}) =>
      this.request<VersionInfoType, any>({
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
     * @response `200` `DatabaseHealthType` Database is healthy
     * @response `503` `DatabaseHealthType` Database is unhealthy
     */
    getDatabaseHealth: (params: RequestParams = {}) =>
      this.request<DatabaseHealthType, DatabaseHealthType>({
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
     * @response `200` `ConnectionTestResultType` Connection test successful
     * @response `503` `ConnectionTestResultType` Connection test failed
     */
    testDatabaseConnection: (params: RequestParams = {}) =>
      this.request<ConnectionTestResultType, ConnectionTestResultType>({
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
     * @response `200` `DatabaseStatsType` Database statistics retrieved successfully
     * @response `500` `ErrorResponseType` Failed to get database statistics
     */
    getDatabaseStats: (params: RequestParams = {}) =>
      this.request<DatabaseStatsType, ErrorResponseType>({
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
     * @response `200` `MigrationStatusType` Migration status retrieved successfully
     * @response `500` `ErrorResponseType` Failed to get migration status
     */
    getMigrationStatus: (params: RequestParams = {}) =>
      this.request<MigrationStatusType, ErrorResponseType>({
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
     * @response `200` `(MigrationHistoryType)[]` Migration history retrieved successfully
     * @response `500` `ErrorResponseType` Failed to get migration history
     */
    getMigrationHistory: (params: RequestParams = {}) =>
      this.request<MigrationHistoryType[], ErrorResponseType>({
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
     * @response `200` `MigrationStatusType` Migrations applied successfully
     * @response `400` `ErrorResponseType` No pending migrations or validation error
     * @response `500` `ErrorResponseType` Failed to apply migrations
     */
    applyPendingMigrations: (params: RequestParams = {}) =>
      this.request<MigrationStatusType, ErrorResponseType>({
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
     * @response `200` `MigrationStatusType` Migration rolled back successfully
     * @response `400` `ErrorResponseType` Invalid version or validation error
     * @response `404` `ErrorResponseType` Migration not found
     * @response `500` `ErrorResponseType` Failed to rollback migration
     */
    rollbackMigration: (version: string, params: RequestParams = {}) =>
      this.request<MigrationStatusType, ErrorResponseType>({
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
     * @response `200` `(TableSizeInfoType)[]` Table sizes retrieved successfully
     * @response `500` `ErrorResponseType` Failed to get table sizes
     */
    getTableSizes: (params: RequestParams = {}) =>
      this.request<TableSizeInfoType[], ErrorResponseType>({
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
     * @response `200` `(SlowQueryInfoType)[]` Slow queries retrieved successfully
     * @response `500` `ErrorResponseType` Failed to get slow queries
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
      this.request<SlowQueryInfoType[], ErrorResponseType>({
        path: `/database/performance/slow-queries`,
        method: "GET",
        query: query,
        secure: true,
        format: "json",
        ...params,
      }),
  };
}

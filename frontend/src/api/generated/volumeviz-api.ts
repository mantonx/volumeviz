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

export interface AsyncScanResponse {
  /** @example "scan_tv-shows-readonly_1640995200" */
  scan_id?: string;
  /** @example "started" */
  status?: string;
  /** @example "tv-shows-readonly" */
  volume_id?: string;
}

export interface ErrorResponse {
  /** @example "VOLUME_NOT_FOUND" */
  code?: string;
  details?: Record<string, any>;
  /** @example "Volume not found" */
  error?: string;
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

export interface VolumeListResponse {
  /** @example 1 */
  total?: number;
  volumes?: VolumeResponse[];
}

export interface VolumeResponse {
  created_at?: string;
  /** @example "local" */
  driver?: string;
  /** @example "tv-shows-readonly" */
  id?: string;
  labels?: Record<string, string>;
  /** @example "/var/lib/docker/volumes/tv-shows-readonly/_data" */
  mountpoint?: string;
  /** @example "tv-shows-readonly" */
  name?: string;
  options?: Record<string, string>;
}

export interface GithubComMantonxVolumevizInternalModelsDockerHealth {
  api_version?: string;
  build_time?: string;
  git_commit?: string;
  go_version?: string;
  message?: string;
  status?: string;
  version?: string;
}

export interface GithubComMantonxVolumevizInternalModelsErrorResponse {
  code?: string;
  details?: string;
  error?: string;
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
 * @version 1.0
 * @license MIT (https://github.com/mantonx/volumeviz/blob/main/LICENSE)
 * @termsOfService https://github.com/mantonx/volumeviz
 * @baseUrl http://localhost:8080/api/v1
 * @contact API Support <support@volumeviz.io> (https://github.com/mantonx/volumeviz/issues)
 *
 * Docker volume monitoring and visualization API
 */
export class Api<
  SecurityDataType extends unknown,
> extends HttpClient<SecurityDataType> {
  health = {
    /**
     * @description Get Docker daemon connection status and version information
     *
     * @tags health
     * @name DockerList
     * @summary Check Docker health
     * @request GET:/health/docker
     * @response `200` `GithubComMantonxVolumevizInternalModelsDockerHealth` OK
     * @response `503` `GithubComMantonxVolumevizInternalModelsErrorResponse` Service Unavailable
     */
    dockerList: (params: RequestParams = {}) =>
      this.request<
        GithubComMantonxVolumevizInternalModelsDockerHealth,
        GithubComMantonxVolumevizInternalModelsErrorResponse
      >({
        path: `/health/docker`,
        method: "GET",
        type: ContentType.Json,
        format: "json",
        ...params,
      }),
  };
  volumes = {
    /**
     * @description Get a list of all Docker volumes with optional filtering
     *
     * @tags volumes
     * @name VolumesList
     * @summary List Docker volumes
     * @request GET:/volumes
     * @response `200` `VolumeListResponse` OK
     * @response `500` `ErrorResponse` Internal Server Error
     */
    volumesList: (
      query?: {
        /**
         * Filter by driver type
         * @example "local"
         */
        driver?: string;
        /** Filter by label key */
        label_key?: string;
        /** Filter by label value */
        label_value?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<VolumeListResponse, ErrorResponse>({
        path: `/volumes`,
        method: "GET",
        query: query,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * @description Get detailed information about a specific Docker volume
     *
     * @tags volumes
     * @name VolumesDetail
     * @summary Get volume details
     * @request GET:/volumes/{id}
     * @response `200` `VolumeResponse` OK
     * @response `400` `ErrorResponse` Bad Request
     * @response `404` `ErrorResponse` Not Found
     * @response `500` `ErrorResponse` Internal Server Error
     */
    volumesDetail: (id: string, params: RequestParams = {}) =>
      this.request<VolumeResponse, ErrorResponse>({
        path: `/volumes/${id}`,
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
  };
}

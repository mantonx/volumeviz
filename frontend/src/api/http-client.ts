/**
 * Enhanced HTTP client with error handling, retries, and Jotai integration
 */

import { useMemo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  apiConfigAtom,
  addApiErrorAtom,
  addActiveRequestAtom,
  removeActiveRequestAtom,
  apiConnectedAtom,
  apiConnectingAtom,
} from '@/store/atoms/api';
import type { ApiError } from '@/store/atoms/api';

export interface RequestOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  skipErrorHandling?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: any;
  message?: string;
}

class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetryAttempts: number;
  private defaultRetryDelay: number;
  private setApiError: (error: Omit<ApiError, 'timestamp'>) => void;
  private addActiveRequest: (id: string) => void;
  private removeActiveRequest: (id: string) => void;
  private setConnected: (connected: boolean) => void;
  private setConnecting: (connecting: boolean) => void;

  constructor(
    baseUrl: string,
    timeout = 10000,
    retryAttempts = 3,
    retryDelay = 1000,
    setApiError: (error: Omit<ApiError, 'timestamp'>) => void,
    addActiveRequest: (id: string) => void,
    removeActiveRequest: (id: string) => void,
    setConnected: (connected: boolean) => void,
    setConnecting: (connecting: boolean) => void,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultTimeout = timeout;
    this.defaultRetryAttempts = retryAttempts;
    this.defaultRetryDelay = retryDelay;
    this.setApiError = setApiError;
    this.addActiveRequest = addActiveRequest;
    this.removeActiveRequest = removeActiveRequest;
    this.setConnected = setConnected;
    this.setConnecting = setConnecting;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions,
  ): Promise<Response> {
    const timeout = options.timeout || this.defaultTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async retryRequest<T>(
    url: string,
    options: RequestOptions,
    attempt = 1,
  ): Promise<ApiResponse<T>> {
    const maxAttempts = options.retryAttempts ?? this.defaultRetryAttempts;
    const retryDelay = options.retryDelay ?? this.defaultRetryDelay;

    try {
      this.setConnecting(true);
      const response = await this.fetchWithTimeout(url, options);
      this.setConnected(true);
      this.setConnecting(false);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };
    } catch (error) {
      this.setConnecting(false);

      if (attempt < maxAttempts) {
        await this.delay(retryDelay * attempt); // Exponential backoff
        return this.retryRequest<T>(url, options, attempt + 1);
      }

      this.setConnected(false);
      throw error;
    }
  }

  private handleError(
    error: any,
    endpoint: string,
    skipErrorHandling = false,
  ): never {
    const apiError: Omit<ApiError, 'timestamp'> = {
      message: error.message || 'Unknown error occurred',
      endpoint,
    };

    if (error.name === 'AbortError') {
      apiError.code = 'TIMEOUT';
      apiError.message = 'Request timed out';
    } else if (error.message.includes('HTTP')) {
      const match = error.message.match(/HTTP (\d+):/);
      if (match) {
        apiError.code = `HTTP_${match[1]}`;
      }
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'Network error - check your connection';
    }

    if (!skipErrorHandling) {
      this.setApiError(apiError);
    }

    throw error;
  }

  async request<T = any>(
    method: string,
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const requestId = this.generateRequestId();
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const requestOptions: RequestOptions = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      this.addActiveRequest(requestId);
      const response = await this.retryRequest<T>(url, requestOptions);
      return response;
    } catch (error) {
      this.handleError(error, endpoint, options.skipErrorHandling);
    } finally {
      this.removeActiveRequest(requestId);
    }
  }

  async get<T = any>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, options);
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, {
      ...options,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, {
      ...options,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, {
      ...options,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, options);
  }
}

// Hook to create HTTP client with Jotai state integration
export function useHttpClient(): HttpClient {
  const [apiConfig] = useAtom(apiConfigAtom);
  const setApiError = useSetAtom(addApiErrorAtom);
  const addActiveRequest = useSetAtom(addActiveRequestAtom);
  const removeActiveRequest = useSetAtom(removeActiveRequestAtom);
  const setConnected = useSetAtom(apiConnectedAtom);
  const setConnecting = useSetAtom(apiConnectingAtom);

  return useMemo(
    () =>
      new HttpClient(
        apiConfig.baseUrl,
        apiConfig.timeout,
        apiConfig.retryAttempts,
        apiConfig.retryDelay,
        setApiError,
        addActiveRequest,
        removeActiveRequest,
        setConnected,
        setConnecting,
      ),
    [
      apiConfig.baseUrl,
      apiConfig.timeout,
      apiConfig.retryAttempts,
      apiConfig.retryDelay,
      setApiError,
      addActiveRequest,
      removeActiveRequest,
      setConnected,
      setConnecting,
    ],
  );
}

// Singleton instance for use outside of React components
let httpClientInstance: HttpClient | null = null;

export function createHttpClient(
  baseUrl: string,
  setApiError: (error: Omit<ApiError, 'timestamp'>) => void,
  addActiveRequest: (id: string) => void,
  removeActiveRequest: (id: string) => void,
  setConnected: (connected: boolean) => void,
  setConnecting: (connecting: boolean) => void,
): HttpClient {
  httpClientInstance = new HttpClient(
    baseUrl,
    10000,
    3,
    1000,
    setApiError,
    addActiveRequest,
    removeActiveRequest,
    setConnected,
    setConnecting,
  );
  return httpClientInstance;
}

export function getHttpClient(): HttpClient {
  if (!httpClientInstance) {
    throw new Error(
      'HTTP client not initialized. Call createHttpClient first.',
    );
  }
  return httpClientInstance;
}

export default HttpClient;

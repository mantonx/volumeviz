// Use relative URL in development (Vite proxy handles it), absolute in production
const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string) || '';

interface FetchConfig extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
}

export class FetchError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.data = data;
  }
}

export const customFetchClient = async <T = any>(
  url: string,
  config?: FetchConfig,
): Promise<T> => {
  const { params, timeout = 30000, ...fetchConfig } = config || {};

  // Build URL with query params
  // The url parameter may already include query params from Orval, so we need to parse it
  const [pathname, existingQuery] = url.split('?');
  const baseUrl = API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1';
  const fullUrl = new URL(`${baseUrl}${pathname}`, window.location.origin);

  // Add existing query params from the url
  if (existingQuery) {
    new URLSearchParams(existingQuery).forEach((value, key) => {
      fullUrl.searchParams.append(key, value);
    });
  }

  // Add additional params from config
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        fullUrl.searchParams.append(key, String(value));
      }
    });
  }

  // Add authorization header
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(fetchConfig.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && fetchConfig.body) {
    headers.set('Content-Type', 'application/json');
  }

  // Add cache-busting headers for GET requests to prevent stale data
  const method = fetchConfig.method?.toUpperCase() || 'GET';
  if (method === 'GET') {
    if (!headers.has('Cache-Control')) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (!headers.has('Pragma')) {
      headers.set('Pragma', 'no-cache');
    }
    if (!headers.has('Expires')) {
      headers.set('Expires', '0');
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fullUrl.toString(), {
      ...fetchConfig,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-2xx responses
    if (!response.ok) {
      if (response.status === 401) {
        // Handle token expiration - clear all auth data
        console.error('[AUTH] 401 Unauthorized - clearing auth data and redirecting to login', {
          url: fullUrl.toString(),
          hasToken: !!token,
          tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
        });
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      const errorData = await response.json().catch(() => ({}));
      throw new FetchError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData,
      );
    }

    // Parse response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    // For non-JSON responses, return the response itself
    return response as any;
  } catch (error: any) {
    if (error instanceof FetchError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default customFetchClient;

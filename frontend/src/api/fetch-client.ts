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

  // Add /api/v1 prefix if the path doesn't already have it
  // Some OpenAPI paths include /api/v1, some don't - we need to handle both
  let fullPath = pathname;
  if (!pathname.startsWith('/api/v1')) {
    fullPath = `/api/v1${pathname}`;
  }

  const baseUrl = API_BASE_URL || '';
  const fullUrl = new URL(`${baseUrl}${fullPath}`, window.location.origin);

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
      // A 401 from these auth endpoints reflects a credentials check
      // (wrong password), not an expired session - the caller already
      // handles that response itself, so don't blow away the session.
      const isCredentialsCheck = /\/auth\/(login|change-password)$/.test(pathname);
      if (response.status === 401 && !isCredentialsCheck) {
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

    // Parse response. Orval's generated types (httpClient: 'fetch') model
    // each endpoint's success response as { data, status: <literal 2xx> },
    // matching the shape components discriminate on via `.status === 200`
    // — wrap here so the runtime actually satisfies what the generated
    // types (and every caller using that pattern) already assume.
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return { data, status: response.status, headers: response.headers } as any;
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

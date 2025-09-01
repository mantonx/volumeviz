const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:8080';

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
  config?: FetchConfig
): Promise<T> => {
  const { params, timeout = 30000, ...fetchConfig } = config || {};
  
  // Build URL with query params
  const fullUrl = new URL(url, `${API_BASE_URL}/api/v1`);
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
        // Handle token expiration
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new FetchError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
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
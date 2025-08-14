/**
 * Alerts API service
 * Provides functions for managing alert rules, destinations, routes, and delivery history
 */

import { getErrorMessage } from '@/utils/errorHandling';

// Create API client instance
const API_BASE_URL =
  import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1';

// Types for alerts system
export interface AlertRule {
  id: number;
  name: string;
  description?: string;
  query: string;
  condition:
    | 'greater'
    | 'greater_equal'
    | 'less'
    | 'less_equal'
    | 'equal'
    | 'not_equal';
  threshold: number;
  interval: string; // duration string like "5m"
  for?: string; // duration string like "10m"
  labels?: Record<string, string>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertDestination {
  id: number;
  name: string;
  description?: string;
  type: 'webhook' | 'slack' | 'pushover';
  config: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertRoute {
  id: number;
  name: string;
  description?: string;
  destination_id: number;
  matchers: Record<string, string>;
  priority: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: number;
  rule_id: number;
  entity_id: string;
  entity_type: string;
  dedupe_key: string;
  status: 'firing' | 'resolved';
  value?: number;
  starts_at: string;
  ends_at?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rule?: AlertRule;
}

export interface AlertDelivery {
  id: number;
  alert_id: number;
  destination_id: number;
  route_id: number;
  status: 'pending' | 'delivered' | 'failed';
  attempt_count: number;
  max_attempts: number;
  next_attempt_at?: string;
  error_message?: string;
  request_payload?: string;
  response_payload?: string;
  response_status?: number;
  created_at: string;
  updated_at: string;
}

export interface EngineStats {
  enabled: boolean;
  evaluation_interval: string;
  queue_size: number;
  rules: number;
  destinations: number;
  alerts: {
    total_alerts: number;
    firing_alerts: number;
    resolved_alerts: number;
    active_rules: number;
    affected_entities: number;
  };
  deliveries: {
    total_deliveries: number;
    successful_deliveries: number;
    failed_deliveries: number;
    pending_deliveries: number;
    avg_attempts: number;
  };
  service: {
    total_processed: number;
    successful_sent: number;
    failed: number;
    retries: number;
    currently_pending: number;
    average_latency: number;
    last_processed_at: string;
    workers_running: number;
  };
  providers_enabled: string[];
}

// API Request/Response types
export interface CreateAlertRuleParams {
  name: string;
  description?: string;
  query: string;
  condition: string;
  threshold: number;
  interval: string;
  for?: string;
  labels?: Record<string, string>;
  is_enabled?: boolean;
}

export interface UpdateAlertRuleParams {
  name?: string;
  description?: string;
  query?: string;
  condition?: string;
  threshold?: number;
  interval?: string;
  for?: string;
  labels?: Record<string, string>;
  is_enabled?: boolean;
}

export interface CreateAlertDestinationParams {
  name: string;
  description?: string;
  type: string;
  config: Record<string, any>;
  is_enabled?: boolean;
}

export interface UpdateAlertDestinationParams {
  name?: string;
  description?: string;
  type?: string;
  config?: Record<string, any>;
  is_enabled?: boolean;
}

export interface CreateAlertRouteParams {
  name: string;
  description?: string;
  destination_id: number;
  matchers: Record<string, string>;
  priority?: number;
  is_enabled?: boolean;
}

export interface UpdateAlertRouteParams {
  name?: string;
  description?: string;
  destination_id?: number;
  matchers?: Record<string, string>;
  priority?: number;
  is_enabled?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface TestDestinationRequest {
  message: string;
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Failed to parse error response, use default message
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json();
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// Alert Rules API
export const alertRulesApi = {
  async list(
    params: { limit?: number; offset?: number; enabled?: boolean } = {},
  ): Promise<PaginatedResponse<AlertRule>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.enabled !== undefined)
      searchParams.set('enabled', params.enabled.toString());

    const query = searchParams.toString();
    return apiCall(`/alerts/rules${query ? `?${query}` : ''}`);
  },

  async get(id: number): Promise<AlertRule> {
    return apiCall(`/alerts/rules/${id}`);
  },

  async create(params: CreateAlertRuleParams): Promise<AlertRule> {
    return apiCall(`/alerts/rules`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async update(id: number, params: UpdateAlertRuleParams): Promise<void> {
    return apiCall(`/alerts/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(id: number): Promise<void> {
    return apiCall(`/alerts/rules/${id}`, {
      method: 'DELETE',
    });
  },

  async test(
    id: number,
  ): Promise<{ rule: AlertRule; results: any; tested_at: string }> {
    return apiCall(`/alerts/rules/${id}/test`, {
      method: 'POST',
    });
  },
};

// Alert Destinations API
export const alertDestinationsApi = {
  async list(
    params: { limit?: number; offset?: number; enabled?: boolean } = {},
  ): Promise<PaginatedResponse<AlertDestination>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.enabled !== undefined)
      searchParams.set('enabled', params.enabled.toString());

    const query = searchParams.toString();
    return apiCall(`/alerts/destinations${query ? `?${query}` : ''}`);
  },

  async get(id: number): Promise<AlertDestination> {
    return apiCall(`/alerts/destinations/${id}`);
  },

  async create(
    params: CreateAlertDestinationParams,
  ): Promise<AlertDestination> {
    return apiCall(`/alerts/destinations`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async update(
    id: number,
    params: UpdateAlertDestinationParams,
  ): Promise<void> {
    return apiCall(`/alerts/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(id: number): Promise<void> {
    return apiCall(`/alerts/destinations/${id}`, {
      method: 'DELETE',
    });
  },

  async test(
    id: number,
    params: TestDestinationRequest,
  ): Promise<{ message: string; tested_at: string }> {
    return apiCall(`/alerts/destinations/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

// Alert Routes API
export const alertRoutesApi = {
  async list(
    params: { limit?: number; offset?: number; destination_id?: number } = {},
  ): Promise<PaginatedResponse<AlertRoute>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.destination_id)
      searchParams.set('destination_id', params.destination_id.toString());

    const query = searchParams.toString();
    return apiCall(`/alerts/routes${query ? `?${query}` : ''}`);
  },

  async get(id: number): Promise<AlertRoute> {
    return apiCall(`/alerts/routes/${id}`);
  },

  async create(params: CreateAlertRouteParams): Promise<AlertRoute> {
    return apiCall(`/alerts/routes`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async update(id: number, params: UpdateAlertRouteParams): Promise<void> {
    return apiCall(`/alerts/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(id: number): Promise<void> {
    return apiCall(`/alerts/routes/${id}`, {
      method: 'DELETE',
    });
  },
};

// Alerts API
export const alertsApi = {
  async list(
    params: {
      limit?: number;
      offset?: number;
      status?: string;
      rule_id?: number;
    } = {},
  ): Promise<PaginatedResponse<Alert>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.status) searchParams.set('status', params.status);
    if (params.rule_id) searchParams.set('rule_id', params.rule_id.toString());

    const query = searchParams.toString();
    return apiCall(`/alerts${query ? `?${query}` : ''}`);
  },

  async get(id: number): Promise<Alert> {
    return apiCall(`/alerts/${id}`);
  },
};

// Alert Deliveries API
export const alertDeliveriesApi = {
  async list(
    params: {
      limit?: number;
      offset?: number;
      alert_id?: number;
      destination_id?: number;
      status?: string;
    } = {},
  ): Promise<PaginatedResponse<AlertDelivery>> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.alert_id)
      searchParams.set('alert_id', params.alert_id.toString());
    if (params.destination_id)
      searchParams.set('destination_id', params.destination_id.toString());
    if (params.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    return apiCall(`/alerts/deliveries${query ? `?${query}` : ''}`);
  },
};

// Engine API
export const alertEngineApi = {
  async getStatus(): Promise<{ engine: EngineStats; retrieved_at: string }> {
    return apiCall(`/alerts/engine/status`);
  },

  async triggerEvaluation(): Promise<{
    message: string;
    triggered_at: string;
  }> {
    return apiCall(`/alerts/engine/evaluate`, {
      method: 'POST',
    });
  },
};

/**
 * React hooks for managing alerts system
 */

import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  alertRulesApi,
  alertDestinationsApi,
  alertRoutesApi,
  alertsApi,
  alertDeliveriesApi,
  alertEngineApi,
} from '@/api/alerts';
import type {
  CreateAlertRuleParams,
  UpdateAlertRuleParams,
  CreateAlertDestinationParams,
  UpdateAlertDestinationParams,
  CreateAlertRouteParams,
  UpdateAlertRouteParams,
  TestDestinationRequest,
} from '@/api/alerts';
import {
  alertRulesAtom,
  alertRulesLoadingAtom,
  alertRulesErrorAtom,
  alertRulesLastUpdatedAtom,
  alertRulesPaginationAtom,
  alertDestinationsAtom,
  alertDestinationsLoadingAtom,
  alertDestinationsErrorAtom,
  alertDestinationsLastUpdatedAtom,
  alertDestinationsPaginationAtom,
  alertRoutesAtom,
  alertRoutesLoadingAtom,
  alertRoutesErrorAtom,
  alertRoutesLastUpdatedAtom,
  alertRoutesPaginationAtom,
  alertsAtom,
  alertsLoadingAtom,
  alertsErrorAtom,
  alertsLastUpdatedAtom,
  alertsPaginationAtom,
  alertDeliveriesAtom,
  alertDeliveriesLoadingAtom,
  alertDeliveriesErrorAtom,
  alertDeliveriesLastUpdatedAtom,
  alertDeliveriesPaginationAtom,
  alertEngineStatsAtom,
  alertEngineStatsLoadingAtom,
  alertEngineStatsErrorAtom,
  alertEngineStatsLastUpdatedAtom,
  alertOperationLoadingAtom,
  alertOperationErrorAtom,
} from '@/store/atoms/alerts';

// Hook for managing alert rules
export function useAlertRules() {
  const [rules, setRules] = useAtom(alertRulesAtom);
  const [loading, setLoading] = useAtom(alertRulesLoadingAtom);
  const [error, setError] = useAtom(alertRulesErrorAtom);
  const setLastUpdated = useSetAtom(alertRulesLastUpdatedAtom);
  const [pagination, setPagination] = useAtom(alertRulesPaginationAtom);
  const [operationLoading, setOperationLoading] = useAtom(
    alertOperationLoadingAtom,
  );
  const [operationError, setOperationError] = useAtom(alertOperationErrorAtom);

  const fetchRules = useCallback(
    async (
      params: {
        limit?: number;
        offset?: number;
        enabled?: boolean;
      } = {},
    ) => {
      try {
        setLoading(true);
        setError(null);

        const response = await alertRulesApi.list({
          limit: params.limit || pagination.limit,
          offset: params.offset || pagination.offset,
          enabled: params.enabled,
        });

        setRules(response.data);
        setPagination({
          limit: response.pagination.limit,
          offset: response.pagination.offset,
          total: response.pagination.total,
        });
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch alert rules',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      setRules,
      setLoading,
      setError,
      setLastUpdated,
      setPagination,
      pagination.limit,
      pagination.offset,
    ],
  );

  const createRule = useCallback(
    async (params: CreateAlertRuleParams) => {
      const operationKey = 'createRule';
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        const newRule = await alertRulesApi.create(params);
        setRules((prev) => [newRule, ...prev]);
        setLastUpdated(new Date());
        return newRule;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create alert rule';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setRules, setLastUpdated, setOperationLoading, setOperationError],
  );

  const updateRule = useCallback(
    async (id: number, params: UpdateAlertRuleParams) => {
      const operationKey = `updateRule_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        await alertRulesApi.update(id, params);

        // Refresh the updated rule
        const updatedRule = await alertRulesApi.get(id);
        setRules((prev) =>
          prev.map((rule) => (rule.id === id ? updatedRule : rule)),
        );
        setLastUpdated(new Date());
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update alert rule';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setRules, setLastUpdated, setOperationLoading, setOperationError],
  );

  const deleteRule = useCallback(
    async (id: number) => {
      const operationKey = `deleteRule_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        await alertRulesApi.delete(id);
        setRules((prev) => prev.filter((rule) => rule.id !== id));
        setLastUpdated(new Date());
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete alert rule';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setRules, setLastUpdated, setOperationLoading, setOperationError],
  );

  const testRule = useCallback(
    async (id: number) => {
      const operationKey = `testRule_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        const result = await alertRulesApi.test(id);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to test alert rule';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setOperationLoading, setOperationError],
  );

  return {
    rules,
    loading,
    error,
    pagination,
    operationLoading,
    operationError,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    testRule,
  };
}

// Hook for managing alert destinations
export function useAlertDestinations() {
  const [destinations, setDestinations] = useAtom(alertDestinationsAtom);
  const [loading, setLoading] = useAtom(alertDestinationsLoadingAtom);
  const [error, setError] = useAtom(alertDestinationsErrorAtom);
  const setLastUpdated = useSetAtom(alertDestinationsLastUpdatedAtom);
  const [pagination, setPagination] = useAtom(alertDestinationsPaginationAtom);
  const [operationLoading, setOperationLoading] = useAtom(
    alertOperationLoadingAtom,
  );
  const [operationError, setOperationError] = useAtom(alertOperationErrorAtom);

  const fetchDestinations = useCallback(
    async (
      params: {
        limit?: number;
        offset?: number;
        enabled?: boolean;
      } = {},
    ) => {
      try {
        setLoading(true);
        setError(null);

        const response = await alertDestinationsApi.list({
          limit: params.limit || pagination.limit,
          offset: params.offset || pagination.offset,
          enabled: params.enabled,
        });

        setDestinations(response.data);
        setPagination({
          limit: response.pagination.limit,
          offset: response.pagination.offset,
          total: response.pagination.total,
        });
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch alert destinations',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      setDestinations,
      setLoading,
      setError,
      setLastUpdated,
      setPagination,
      pagination.limit,
      pagination.offset,
    ],
  );

  const createDestination = useCallback(
    async (params: CreateAlertDestinationParams) => {
      const operationKey = 'createDestination';
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        const newDestination = await alertDestinationsApi.create(params);
        setDestinations((prev) => [newDestination, ...prev]);
        setLastUpdated(new Date());
        return newDestination;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to create alert destination';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setDestinations, setLastUpdated, setOperationLoading, setOperationError],
  );

  const updateDestination = useCallback(
    async (id: number, params: UpdateAlertDestinationParams) => {
      const operationKey = `updateDestination_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        await alertDestinationsApi.update(id, params);

        // Refresh the updated destination
        const updatedDestination = await alertDestinationsApi.get(id);
        setDestinations((prev) =>
          prev.map((dest) => (dest.id === id ? updatedDestination : dest)),
        );
        setLastUpdated(new Date());
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to update alert destination';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setDestinations, setLastUpdated, setOperationLoading, setOperationError],
  );

  const deleteDestination = useCallback(
    async (id: number) => {
      const operationKey = `deleteDestination_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        await alertDestinationsApi.delete(id);
        setDestinations((prev) => prev.filter((dest) => dest.id !== id));
        setLastUpdated(new Date());
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to delete alert destination';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setDestinations, setLastUpdated, setOperationLoading, setOperationError],
  );

  const testDestination = useCallback(
    async (id: number, params: TestDestinationRequest) => {
      const operationKey = `testDestination_${id}`;
      try {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
        setOperationError((prev) => ({ ...prev, [operationKey]: null }));

        const result = await alertDestinationsApi.test(id, params);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to test alert destination';
        setOperationError((prev) => ({
          ...prev,
          [operationKey]: errorMessage,
        }));
        throw err;
      } finally {
        setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
      }
    },
    [setOperationLoading, setOperationError],
  );

  return {
    destinations,
    loading,
    error,
    pagination,
    operationLoading,
    operationError,
    fetchDestinations,
    createDestination,
    updateDestination,
    deleteDestination,
    testDestination,
  };
}

// Hook for managing alert engine
export function useAlertEngine() {
  const [stats, setStats] = useAtom(alertEngineStatsAtom);
  const [loading, setLoading] = useAtom(alertEngineStatsLoadingAtom);
  const [error, setError] = useAtom(alertEngineStatsErrorAtom);
  const setLastUpdated = useSetAtom(alertEngineStatsLastUpdatedAtom);
  const [operationLoading, setOperationLoading] = useAtom(
    alertOperationLoadingAtom,
  );
  const [operationError, setOperationError] = useAtom(alertOperationErrorAtom);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await alertEngineApi.getStatus();
      setStats(response.engine);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch engine stats',
      );
    } finally {
      setLoading(false);
    }
  }, [setStats, setLoading, setError, setLastUpdated]);

  const triggerEvaluation = useCallback(async () => {
    const operationKey = 'triggerEvaluation';
    try {
      setOperationLoading((prev) => ({ ...prev, [operationKey]: true }));
      setOperationError((prev) => ({ ...prev, [operationKey]: null }));

      const result = await alertEngineApi.triggerEvaluation();
      // Refresh stats after triggering evaluation
      await fetchStats();
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to trigger evaluation';
      setOperationError((prev) => ({ ...prev, [operationKey]: errorMessage }));
      throw err;
    } finally {
      setOperationLoading((prev) => ({ ...prev, [operationKey]: false }));
    }
  }, [fetchStats, setOperationLoading, setOperationError]);

  return {
    stats,
    loading,
    error,
    operationLoading,
    operationError,
    fetchStats,
    triggerEvaluation,
  };
}

// Hook for managing alert deliveries
export function useAlertDeliveries() {
  const [deliveries, setDeliveries] = useAtom(alertDeliveriesAtom);
  const [loading, setLoading] = useAtom(alertDeliveriesLoadingAtom);
  const [error, setError] = useAtom(alertDeliveriesErrorAtom);
  const setLastUpdated = useSetAtom(alertDeliveriesLastUpdatedAtom);
  const [pagination, setPagination] = useAtom(alertDeliveriesPaginationAtom);

  const fetchDeliveries = useCallback(
    async (
      params: {
        limit?: number;
        offset?: number;
        alert_id?: number;
        destination_id?: number;
        status?: string;
      } = {},
    ) => {
      try {
        setLoading(true);
        setError(null);

        const response = await alertDeliveriesApi.list({
          limit: params.limit || pagination.limit,
          offset: params.offset || pagination.offset,
          alert_id: params.alert_id,
          destination_id: params.destination_id,
          status: params.status,
        });

        setDeliveries(response.data);
        setPagination({
          limit: response.pagination.limit,
          offset: response.pagination.offset,
          total: response.pagination.total,
        });
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fetch alert deliveries',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      setDeliveries,
      setLoading,
      setError,
      setLastUpdated,
      setPagination,
      pagination.limit,
      pagination.offset,
    ],
  );

  return {
    deliveries,
    loading,
    error,
    pagination,
    fetchDeliveries,
  };
}

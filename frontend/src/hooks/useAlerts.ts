/**
 * Alert management hooks
 *
 * Provides centralized, ergonomic hooks for managing alert rules, alert
 * destinations, and alert deliveries on top of the Orval-generated API
 * client. Each hook exposes:
 *   - a plain array of the underlying entity (never undefined)
 *   - isLoading / error (stringified, never the raw ErrorResponse object)
 *   - refetch
 *   - simple mutation wrappers with call signatures a component can use
 *     directly, without knowing about the `{ id, data }` / `.mutateAsync`
 *     shape the generated hooks expect.
 */

import { useMemo } from 'react';
import {
  useGetAlertsRules,
  usePostAlertsRules,
  useDeleteAlertsRulesId,
  usePutAlertsRulesId,
  usePostAlertsRulesIdTest,
  useGetAlertsDestinations,
  usePostAlertsDestinations,
  useDeleteAlertsDestinationsId,
  usePutAlertsDestinationsId,
  usePostAlertsDestinationsIdTest,
  useGetAlertsDeliveries,
  type GithubComMantonxVolumevizInternalModelsAlertRule as AlertRule,
  type GithubComMantonxVolumevizInternalModelsAlertDestination as AlertDestination,
  type GithubComMantonxVolumevizInternalModelsAlertDelivery as AlertDelivery,
  type GithubComMantonxVolumevizInternalModelsOffsetPagination as OffsetPagination,
  type GithubComMantonxVolumevizInternalModelsCreateAlertRuleParams as CreateAlertRuleParams,
  type GithubComMantonxVolumevizInternalModelsUpdateAlertRuleParams as UpdateAlertRuleParams,
  type GithubComMantonxVolumevizInternalModelsCreateAlertDestinationParams as CreateAlertDestinationParams,
  type GithubComMantonxVolumevizInternalModelsUpdateAlertDestinationParams as UpdateAlertDestinationParams,
  type GetAlertsDeliveriesParams,
} from '@/api/orval-generated/api';

// Re-export the real backend model types + params so components can import
// them from this single module instead of reaching into the generated file.
export type {
  AlertRule,
  AlertDestination,
  AlertDelivery,
  CreateAlertRuleParams,
  UpdateAlertRuleParams,
  CreateAlertDestinationParams,
  UpdateAlertDestinationParams,
};

/** Shape of the `results` field returned by POST /alerts/rules/{id}/test. The
 * alert engine's evaluator returns `interface{}` on the Go side, so this is
 * intentionally loosely typed. */
export type TestAlertRuleResult = unknown;

/** Turn whatever error shape TanStack Query / our fetch client hands back
 * into a plain, displayable string. Never leak the raw ErrorResponse object
 * to the UI. */
function stringifyError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const data = (err.data as Record<string, unknown>) ?? err;
    const message =
      (data?.message as string) ||
      (data?.error as string) ||
      (err.message as string);
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return 'An unexpected error occurred';
}

// ---------------------------------------------------------------------------
// Alert Rules
// ---------------------------------------------------------------------------

export const useAlertRules = () => {
  const rulesQuery = useGetAlertsRules(undefined);
  const createMutation = usePostAlertsRules();
  const deleteMutation = useDeleteAlertsRulesId();
  const updateMutation = usePutAlertsRulesId();
  const testMutation = usePostAlertsRulesIdTest();

  const rules: AlertRule[] = useMemo(() => {
    const data = rulesQuery.data;
    return data?.status === 200 ? (data.data.rules ?? []) : [];
  }, [rulesQuery.data]);

  const createRule = async (params: CreateAlertRuleParams): Promise<void> => {
    await createMutation.mutateAsync({ data: params });
    await rulesQuery.refetch();
  };

  const updateRule = async (
    id: number,
    params: UpdateAlertRuleParams,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id, data: params });
    await rulesQuery.refetch();
  };

  const deleteRule = async (id: number): Promise<void> => {
    await deleteMutation.mutateAsync({ id });
    await rulesQuery.refetch();
  };

  const testRule = async (id: number): Promise<TestAlertRuleResult> => {
    const response = await testMutation.mutateAsync({ id });
    return response.status === 200 ? response.data.results : undefined;
  };

  return {
    rules,
    isLoading: rulesQuery.isLoading,
    error: stringifyError(rulesQuery.error),
    refetch: rulesQuery.refetch,

    createRule,
    updateRule,
    deleteRule,
    testRule,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: testMutation.isPending,

    createError: stringifyError(createMutation.error),
    updateError: stringifyError(updateMutation.error),
    deleteError: stringifyError(deleteMutation.error),
    testError: stringifyError(testMutation.error),
  };
};

// ---------------------------------------------------------------------------
// Alert Destinations
// ---------------------------------------------------------------------------

export const useAlertDestinations = () => {
  const destinationsQuery = useGetAlertsDestinations(undefined);
  const createMutation = usePostAlertsDestinations();
  const deleteMutation = useDeleteAlertsDestinationsId();
  const updateMutation = usePutAlertsDestinationsId();
  const testMutation = usePostAlertsDestinationsIdTest();

  const destinations: AlertDestination[] = useMemo(() => {
    const data = destinationsQuery.data;
    return data?.status === 200 ? (data.data.destinations ?? []) : [];
  }, [destinationsQuery.data]);

  const createDestination = async (
    params: CreateAlertDestinationParams,
  ): Promise<void> => {
    await createMutation.mutateAsync({ data: params });
    await destinationsQuery.refetch();
  };

  const updateDestination = async (
    id: number,
    params: UpdateAlertDestinationParams,
  ): Promise<void> => {
    await updateMutation.mutateAsync({ id, data: params });
    await destinationsQuery.refetch();
  };

  const deleteDestination = async (id: number): Promise<void> => {
    await deleteMutation.mutateAsync({ id });
    await destinationsQuery.refetch();
  };

  const testDestination = async (
    id: number,
  ): Promise<{ message: string; tested_at?: string }> => {
    const response = await testMutation.mutateAsync({ id, data: {} });
    return response.status === 200
      ? { message: response.data.message ?? '', tested_at: response.data.tested_at }
      : { message: 'Test failed' };
  };

  return {
    destinations,
    isLoading: destinationsQuery.isLoading,
    error: stringifyError(destinationsQuery.error),
    refetch: destinationsQuery.refetch,

    createDestination,
    updateDestination,
    deleteDestination,
    testDestination,

    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTesting: testMutation.isPending,

    createError: stringifyError(createMutation.error),
    updateError: stringifyError(updateMutation.error),
    deleteError: stringifyError(deleteMutation.error),
    testError: stringifyError(testMutation.error),
  };
};

// ---------------------------------------------------------------------------
// Alert Deliveries (History)
// ---------------------------------------------------------------------------

export const useAlertDeliveries = (params?: GetAlertsDeliveriesParams) => {
  const deliveriesQuery = useGetAlertsDeliveries(params);

  const deliveries: AlertDelivery[] = useMemo(() => {
    const data = deliveriesQuery.data;
    return data?.status === 200 ? (data.data.deliveries ?? []) : [];
  }, [deliveriesQuery.data]);

  const pagination: OffsetPagination = useMemo(() => {
    const data = deliveriesQuery.data;
    return data?.status === 200
      ? (data.data.pagination ?? { limit: 50, offset: 0, total: 0 })
      : { limit: 50, offset: 0, total: 0 };
  }, [deliveriesQuery.data]);

  return {
    deliveries,
    pagination,
    isLoading: deliveriesQuery.isLoading,
    error: stringifyError(deliveriesQuery.error),
    refetch: deliveriesQuery.refetch,
  };
};

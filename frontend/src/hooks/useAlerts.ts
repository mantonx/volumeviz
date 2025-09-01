/**
 * Alert management hooks
 * 
 * Provides centralized hooks for managing alerts, alert rules, and alert destinations
 * using the modern Orval-generated API hooks.
 */

import {
  useGetAlerts,
  useGetAlertsId,
  useGetAlertsDeliveries,
  useGetAlertsDestinations,
  usePostAlertsDestinations,
  useDeleteAlertsDestinationsId,
  useGetAlertsDestinationsId,
  usePutAlertsDestinationsId,
  useGetAlertsRules,
  usePostAlertsRules,
  useDeleteAlertsRulesId,
  useGetAlertsRulesId,
  usePutAlertsRulesId,
  usePostAlertsRulesIdTest,
  usePostAlertsDestinationsIdTest,
} from '@/api/orval-generated/api';

// Alert Rules Management
export const useAlertRules = () => {
  const getRules = useGetAlertsRules();
  const createRule = usePostAlertsRules();
  const deleteRule = useDeleteAlertsRulesId();
  const getRule = useGetAlertsRulesId;
  const updateRule = usePutAlertsRulesId();
  const testRule = usePostAlertsRulesIdTest();

  return {
    rules: getRules.data,
    isLoading: getRules.isLoading,
    error: getRules.error,
    refetch: getRules.refetch,
    createRule: createRule.mutate,
    createRuleAsync: createRule.mutateAsync,
    deleteRule: deleteRule.mutate,
    deleteRuleAsync: deleteRule.mutateAsync,
    updateRule: updateRule.mutate,
    updateRuleAsync: updateRule.mutateAsync,
    testRule: testRule.mutate,
    testRuleAsync: testRule.mutateAsync,
    getRule,
    isCreating: createRule.isPending,
    isDeleting: deleteRule.isPending,
    isUpdating: updateRule.isPending,
    isTesting: testRule.isPending,
  };
};

// Alert Destinations Management
export const useAlertDestinations = () => {
  const getDestinations = useGetAlertsDestinations();
  const createDestination = usePostAlertsDestinations();
  const deleteDestination = useDeleteAlertsDestinationsId();
  const getDestination = useGetAlertsDestinationsId;
  const updateDestination = usePutAlertsDestinationsId();
  const testDestination = usePostAlertsDestinationsIdTest();

  return {
    destinations: getDestinations.data,
    isLoading: getDestinations.isLoading,
    error: getDestinations.error,
    refetch: getDestinations.refetch,
    createDestination: createDestination.mutate,
    createDestinationAsync: createDestination.mutateAsync,
    deleteDestination: deleteDestination.mutate,
    deleteDestinationAsync: deleteDestination.mutateAsync,
    updateDestination: updateDestination.mutate,
    updateDestinationAsync: updateDestination.mutateAsync,
    testDestination: testDestination.mutate,
    testDestinationAsync: testDestination.mutateAsync,
    getDestination,
    isCreating: createDestination.isPending,
    isDeleting: deleteDestination.isPending,
    isUpdating: updateDestination.isPending,
    isTesting: testDestination.isPending,
  };
};

// Alert Deliveries (History) Management
export const useAlertDeliveries = () => {
  const getDeliveries = useGetAlertsDeliveries();

  return {
    deliveries: getDeliveries.data,
    isLoading: getDeliveries.isLoading,
    error: getDeliveries.error,
    refetch: getDeliveries.refetch,
  };
};

// Individual Alert Management
export const useAlert = (alertId: string) => {
  const getAlert = useGetAlertsId(alertId);

  return {
    alert: getAlert.data,
    isLoading: getAlert.isLoading,
    error: getAlert.error,
    refetch: getAlert.refetch,
  };
};

// All Alerts Management
export const useAlerts = () => {
  const getAlerts = useGetAlerts();

  return {
    alerts: getAlerts.data,
    isLoading: getAlerts.isLoading,
    error: getAlerts.error,
    refetch: getAlerts.refetch,
  };
};
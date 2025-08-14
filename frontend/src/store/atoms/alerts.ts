/**
 * Jotai atoms for alerts management state
 */

import { atom } from 'jotai';
import type {
  AlertRule,
  AlertDestination,
  AlertRoute,
  Alert,
  AlertDelivery,
  EngineStats,
} from '@/api/alerts';

// Alert Rules State
export const alertRulesAtom = atom<AlertRule[]>([]);
export const alertRulesLoadingAtom = atom<boolean>(false);
export const alertRulesErrorAtom = atom<string | null>(null);
export const alertRulesLastUpdatedAtom = atom<Date | null>(null);

// Alert Destinations State
export const alertDestinationsAtom = atom<AlertDestination[]>([]);
export const alertDestinationsLoadingAtom = atom<boolean>(false);
export const alertDestinationsErrorAtom = atom<string | null>(null);
export const alertDestinationsLastUpdatedAtom = atom<Date | null>(null);

// Alert Routes State
export const alertRoutesAtom = atom<AlertRoute[]>([]);
export const alertRoutesLoadingAtom = atom<boolean>(false);
export const alertRoutesErrorAtom = atom<string | null>(null);
export const alertRoutesLastUpdatedAtom = atom<Date | null>(null);

// Alerts State
export const alertsAtom = atom<Alert[]>([]);
export const alertsLoadingAtom = atom<boolean>(false);
export const alertsErrorAtom = atom<string | null>(null);
export const alertsLastUpdatedAtom = atom<Date | null>(null);

// Alert Deliveries State
export const alertDeliveriesAtom = atom<AlertDelivery[]>([]);
export const alertDeliveriesLoadingAtom = atom<boolean>(false);
export const alertDeliveriesErrorAtom = atom<string | null>(null);
export const alertDeliveriesLastUpdatedAtom = atom<Date | null>(null);

// Engine State
export const alertEngineStatsAtom = atom<EngineStats | null>(null);
export const alertEngineStatsLoadingAtom = atom<boolean>(false);
export const alertEngineStatsErrorAtom = atom<string | null>(null);
export const alertEngineStatsLastUpdatedAtom = atom<Date | null>(null);

// UI State
export const selectedAlertDestinationAtom = atom<AlertDestination | null>(null);
export const selectedAlertRuleAtom = atom<AlertRule | null>(null);
export const selectedAlertRouteAtom = atom<AlertRoute | null>(null);

// Pagination State
export const alertRulesPaginationAtom = atom({
  limit: 25,
  offset: 0,
  total: 0,
});

export const alertDestinationsPaginationAtom = atom({
  limit: 25,
  offset: 0,
  total: 0,
});

export const alertRoutesPaginationAtom = atom({
  limit: 25,
  offset: 0,
  total: 0,
});

export const alertsPaginationAtom = atom({
  limit: 25,
  offset: 0,
  total: 0,
});

export const alertDeliveriesPaginationAtom = atom({
  limit: 25,
  offset: 0,
  total: 0,
});

// Operation State (for tracking async operations)
export const alertOperationLoadingAtom = atom<Record<string, boolean>>({});
export const alertOperationErrorAtom = atom<Record<string, string | null>>({});

import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { organizationIdAtom } from '@/atoms/organization';
import { customFetchClient } from '@/api/fetch-client';
import { VolumeFilters, Volume } from './volumes.types';

// Volume filters atom
export const volumeFiltersAtom = atom<VolumeFilters>({
  searchTerm: '',
  organizationId: null,
  status: 'all',
  sortBy: 'name',
});

// Selected volume atom
export const selectedVolumeAtom = atom<string | null>(null);

// Legacy alias for compatibility
export const volumesAtom = atomWithQuery((get) => {
  const filters = get(volumeFiltersAtom);
  const orgId = get(organizationIdAtom);

  return {
    queryKey: ['volumes', 'list', { ...filters, organization_id: orgId }],
    queryFn: async () => {
      if (!orgId) return [];
      return customFetchClient<{ data: Volume[] }>('/volumes', {
        params: { ...filters, organization_id: orgId },
      }).then((res) => res.data);
    },
    enabled: !!orgId,
  };
});

// Volumes list atom with organization context
export const volumesListAtom = atomWithQuery((get) => {
  const filters = get(volumeFiltersAtom);
  const orgId = get(organizationIdAtom);

  return {
    queryKey: ['volumes', 'list', { ...filters, organization_id: orgId }],
    queryFn: async () => {
      if (!orgId) return [];
      return customFetchClient<{ data: Volume[] }>('/volumes', {
        params: { ...filters, organization_id: orgId },
      }).then((res) => res.data);
    },
    enabled: !!orgId,
  };
});

// Volume details atom
export const volumeDetailsAtom = atomWithQuery((get) => {
  const volumeId = get(selectedVolumeAtom);

  return {
    queryKey: ['volumes', 'detail', volumeId],
    queryFn: async () => {
      if (!volumeId) return null;
      return customFetchClient<Volume>(`/volumes/${volumeId}`);
    },
    enabled: !!volumeId,
  };
});

// Volume stats atom
export const volumeStatsAtom = atomWithQuery((get) => {
  const volumeId = get(selectedVolumeAtom);

  return {
    queryKey: ['volumes', 'stats', volumeId],
    queryFn: async () => {
      if (!volumeId) return null;
      return customFetchClient(`/volumes/${volumeId}/stats`);
    },
    enabled: !!volumeId,
    refetchInterval: 30000, // Refresh every 30 seconds
  };
});

// Last refresh timestamp atom
export const lastRefreshAtom = atom<number>(Date.now());

// Legacy compatibility atoms for components expecting simple state
export const volumesLoadingAtom = atom<boolean>(false);
export const volumesErrorAtom = atom<string | null>(null);

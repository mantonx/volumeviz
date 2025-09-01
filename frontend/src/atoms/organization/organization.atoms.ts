import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { customFetchClient } from '@/api/fetch-client';

// Primary organization atom
export const organizationIdAtom = atom<number | null>(null);

// Current user atom with organization context
export const currentUserAtom = atomWithQuery(() => ({
  queryKey: ['auth', 'currentUser'],
  queryFn: async () => {
    return customFetchClient('/auth/me');
  },
}));

// Derived atom that syncs organization from user
export const userOrganizationAtom = atom(
  (get) => {
    const user = get(currentUserAtom);
    return user.data?.organization_id ?? null;
  },
  (get, set, orgId: number) => {
    set(organizationIdAtom, orgId);
  }
);

// Organization details atom
export const organizationDetailsAtom = atomWithQuery((get) => {
  const orgId = get(organizationIdAtom);
  return {
    queryKey: ['orgs', 'detail', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      return customFetchClient(`/organizations/${orgId}`);
    },
    enabled: !!orgId,
  };
});

// Organization stats atom
export const organizationStatsAtom = atomWithQuery((get) => {
  const orgId = get(organizationIdAtom);
  return {
    queryKey: ['orgs', 'stats', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      return customFetchClient(`/organizations/${orgId}/stats`, {
        params: { include_growth: true }
      });
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refresh every minute
  };
});
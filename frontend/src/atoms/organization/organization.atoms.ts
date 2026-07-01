import { atom } from 'jotai';
import { atomWithQuery } from 'jotai-tanstack-query';
import { customFetchClient } from '@/api/fetch-client';

// Helper function to decode JWT and extract organization ID
function getOrganizationFromToken(): number | null {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;

  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));

    // Extract organization_id from claims (backend uses org_id)
    return payload.org_id ?? payload.organization_id ?? null;
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

// Primary organization atom - extracts ID directly from JWT token
// Make it a writable atom that can be updated
export const organizationIdAtom = atom<number | null>(
  getOrganizationFromToken()
);

// Helper atom to refresh org ID from token
export const refreshOrganizationAtom = atom(null, (_get, set) => {
  const newOrgId = getOrganizationFromToken();
  console.log('[refreshOrganizationAtom] Refreshing org ID:', newOrgId);
  set(organizationIdAtom, newOrgId);
});

// Derived atom that provides the organization ID
export const userOrganizationAtom = atom((get) => {
  return get(organizationIdAtom);
});

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
        params: { include_growth: true },
      });
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refresh every minute
  };
});

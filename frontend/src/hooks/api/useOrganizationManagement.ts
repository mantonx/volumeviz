import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import {
  useGetOrganizationsMe,
  usePutOrganizationsMe,
  InternalOrganizationsUpdateOrganizationRequest,
} from '@/api/orval-generated/api';
import { organizationIdAtom } from '@/atoms/organization';

export interface UseOrganizationManagementReturn {
  // Organization data
  organization: any;
  stats: any;
  limits: any;
  isLoading: boolean;
  error: any;
  refetch: () => void;

  // Organization mutations
  updateOrganization: {
    mutateAsync: (
      data: InternalOrganizationsUpdateOrganizationRequest,
    ) => Promise<any>;
    isLoading: boolean;
  };
}

export function useOrganizationManagement(
  organizationId?: string,
): UseOrganizationManagementReturn {
  const queryClient = useQueryClient();

  // Fetch current organization data
  const {
    data: orgData,
    isLoading,
    error,
    refetch,
  } = useGetOrganizationsMe({
    query: {
      enabled: true,
      refetchInterval: 60000, // Refresh every minute
    },
  });

  // Update organization mutation
  const updateOrgMutation = usePutOrganizationsMe({
    mutation: {
      onSuccess: (data) => {
        // Invalidate organization queries
        queryClient.invalidateQueries({
          queryKey: ['getOrganizationsMe'],
        });
        queryClient.invalidateQueries({ queryKey: ['orgs'] });
      },
    },
  });

  return {
    // Data
    organization: orgData?.data?.organization,
    stats: orgData?.data?.stats,
    limits: orgData?.data?.limits,
    isLoading,
    error: error as Error | null,
    refetch,

    // Mutations
    updateOrganization: {
      mutateAsync: async (
        data: InternalOrganizationsUpdateOrganizationRequest,
      ) => {
        return updateOrgMutation.mutateAsync({ data });
      },
      isLoading: updateOrgMutation.isPending,
    },
  };
}

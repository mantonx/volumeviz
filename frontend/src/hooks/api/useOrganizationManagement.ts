import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { 
  useGetApiV1OrganizationsMe,
  usePutApiV1OrganizationsMe,
  InternalApiV1OrganizationsUpdateOrganizationRequest 
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
    mutateAsync: (data: InternalApiV1OrganizationsUpdateOrganizationRequest) => Promise<any>;
    isLoading: boolean;
  };
}

export function useOrganizationManagement(organizationId?: string): UseOrganizationManagementReturn {
  const queryClient = useQueryClient();
  
  // Fetch current organization data
  const { 
    data: orgData, 
    isLoading, 
    error,
    refetch 
  } = useGetApiV1OrganizationsMe({
    query: {
      enabled: true,
      refetchInterval: 60000, // Refresh every minute
    },
  });

  // Update organization mutation
  const updateOrgMutation = usePutApiV1OrganizationsMe({
    mutation: {
      onSuccess: (data) => {
        // Invalidate organization queries
        queryClient.invalidateQueries({ queryKey: ['getApiV1OrganizationsMe'] });
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
      mutateAsync: async (data: InternalApiV1OrganizationsUpdateOrganizationRequest) => {
        return updateOrgMutation.mutateAsync({ data });
      },
      isLoading: updateOrgMutation.isPending,
    },
  };
}
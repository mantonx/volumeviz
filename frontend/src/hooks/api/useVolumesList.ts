import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { useGetVolumes } from '@/api/orval-generated/api';
import { organizationIdAtom, volumeFiltersAtom } from '@/atoms';

export interface UseVolumesListOptions {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export function useVolumesList(options: UseVolumesListOptions = {}) {
  const { enabled = true, page = 1, pageSize = 25 } = options;

  const orgId = useAtomValue(organizationIdAtom);
  const filters = useAtomValue(volumeFiltersAtom);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: any = {
      page,
      page_size: pageSize,
      system: false, // Hide anonymous 64-char system volumes by default
    };

    // Add search if available
    if (filters.searchTerm) {
      params.q = filters.searchTerm;
    }

    // Add organization filter if available
    if (orgId) {
      params.organization_id = orgId;
    }

    // Add status filter
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        params.is_active = true;
      } else if (filters.status === 'inactive') {
        params.is_active = false;
      }
    }

    // Add orphaned filter
    if (filters.orphaned) {
      params.orphaned = true;
    }

    // Add sorting
    if (filters.sortBy) {
      const sortDirections: Record<string, string> = {
        name: 'name:asc',
        size: 'size_bytes:desc',
        created: 'created_at:desc',
      };
      params.sort = sortDirections[filters.sortBy] || 'name:asc';
    }

    return params;
  }, [page, pageSize, filters, orgId]);

  // Use the generated hook
  const { data, isLoading, error, refetch, isFetching, isRefetching } =
    useGetVolumes(queryParams, {
      query: {
        enabled: enabled, // Fetch volumes regardless of org (backend handles filtering)
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchInterval: false,
        refetchIntervalInBackground: false,
      },
    });

  // Transform data to match expected format
  const volumes = useMemo(() => {
    if (!data?.data) return [];
    return data.data;
  }, [data]);

  const pagination = useMemo(() => {
    // API returns pagination data at root level: { data, total, page, page_size }
    if (!data) {
      return {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      };
    }

    const total = (data as any).total || 0;
    const currentPage = (data as any).page || page;
    const limit = (data as any).page_size || pageSize;
    const totalPages = Math.ceil(total / limit);
    const hasMore = currentPage < totalPages;

    return {
      page: currentPage,
      pageSize: limit,
      total,
      totalPages,
      hasNext: hasMore,
      hasPrevious: currentPage > 1,
    };
  }, [data, page, pageSize]);

  return {
    volumes,
    pagination,
    isLoading,
    isFetching,
    isRefetching,
    error: error as Error | null,
    refetch,
    // Legacy compatibility
    data: volumes,
    loading: isLoading,
    paginationMeta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      sort: queryParams.sort,
      filters: filters,
    },
  };
}

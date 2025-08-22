import { useState, useCallback, useEffect, useMemo } from 'react';
import { Api } from '@/api/generated/Api';
import type { 
  VolumeV1, 
  FilesystemCapacity,
  InternalApiV1MountsMountCatalogResponse as MountCatalogEntry 
} from '@/api/generated/Api';
import { getErrorMessage } from '@/utils/errorHandling';

// Create configured API client instance
// Force baseUrl to avoid environment/cache issues
const api = new Api({
  baseUrl: 'http://localhost:8080',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Double-force the baseUrl to ensure it's correct
api.baseUrl = 'http://localhost:8080';

// Combined volume and mount data structure that preserves all API fields
export interface VolumeMount extends VolumeV1 {
  // Override/add specific fields for the unified view
  id: string;
  name: string;
  path: string;
  type: 'volume' | 'bind' | 'tmpfs';
  compose_project?: string;
  compose_services?: string[];
  containers: string[];
  container_count?: number;
  readonly: boolean;
  status: 'tracked' | 'untracked' | 'orphaned';
  last_seen: string;
  growth_rate?: number;
  mount_point?: string;
  
  // Additional metadata
  source_type: 'volume' | 'mount';
  volume_scope?: string;
  
  // Explicitly include filesystem capacity (inherited from VolumeV1)
  filesystem_capacity?: FilesystemCapacity;
}

export interface VolumesAndMountsParams {
  page?: number;
  page_size?: number;
  sort?: string;
  q?: string;
  
  // Volume filters
  driver?: 'local' | 'nfs' | 'cifs' | 'overlay2';
  orphaned?: boolean;
  system?: boolean;
  
  // Mount filters  
  type?: 'volume' | 'bind' | 'tmpfs';
  compose_project?: string;
  compose_service?: string;
  is_tracked?: boolean;
}

export interface VolumesAndMountsPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  sort?: string;
  filters?: Record<string, any>;
}

export function useVolumesAndMounts() {
  const [data, setData] = useState<VolumeMount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationMeta, setPaginationMeta] = useState<VolumesAndMountsPaginationMeta>({
    page: 1,
    pageSize: 25,
    total: 0,
  });

  // Transform volume data to VolumeMount format
  const transformVolume = useCallback((volume: VolumeV1): VolumeMount => {
    return {
      id: volume.name || 'unknown',
      name: volume.name || 'unknown',
      path: volume.mountpoint || 'unknown',
      type: 'volume',
      driver: volume.driver,
      compose_project: volume.labels?.['com.docker.compose.project'],
      compose_services: volume.labels?.['com.docker.compose.service'] 
        ? [volume.labels['com.docker.compose.service']]
        : [],
      containers: volume.container_names || [], // Use container names from API
      container_count: volume.attachments_count || 0,
      readonly: false, // Volumes are typically read-write
      status: volume.is_orphaned ? 'orphaned' : 'tracked',
      last_seen: volume.last_scan_at || volume.created_at || new Date().toISOString(),
      size_bytes: volume.size_bytes,
      created_at: volume.created_at || new Date().toISOString(),
      mount_point: volume.mountpoint,
      filesystem_capacity: volume.filesystem_capacity,
      source_type: 'volume',
      volume_scope: volume.scope,
      attachments_count: volume.attachments_count,
      is_system: volume.is_system,
      labels: volume.labels,
    };
  }, []);

  // Transform mount data to VolumeMount format
  const transformMount = useCallback((mount: MountCatalogEntry): VolumeMount => {
    return {
      id: mount.mount_id || mount.id?.toString() || 'unknown',
      name: mount.volume_name || mount.mount_id || 'unknown',
      path: mount.source_path || 'unknown',
      type: mount.mount_type || 'volume',
      driver: mount.volume_driver,
      compose_project: mount.compose_project,
      compose_services: mount.compose_services || [],
      containers: [], // Container names not available from API  
      container_count: mount.container_count || 0,
      readonly: false, // TODO: Determine from mount options
      status: mount.is_orphaned 
        ? 'orphaned' 
        : mount.is_tracked 
          ? 'tracked' 
          : 'untracked',
      last_seen: mount.last_seen_at || mount.updated_at || new Date().toISOString(),
      created_at: mount.created_at || mount.first_discovered_at || new Date().toISOString(),
      mount_point: mount.source_path,
      source_type: 'mount',
      volume_scope: mount.volume_scope,
    };
  }, []);

  // Fetch combined volumes and mounts data
  const fetchData = useCallback(async (params?: VolumesAndMountsParams) => {
    setLoading(true);
    setError(null);

    try {
      const page = params?.page || 1;
      const pageSize = params?.page_size || 25;

      // Special handling for untracked filter - only fetch mounts since volumes don't have tracking
      let volumesResponse: any = { data: { data: [], total: 0 } };
      let mountsResponse: any;

      if (params?.is_tracked === false) {
        // Only fetch untracked mounts - volumes are always tracked
        const mountsData = await api.api.v1MountsList({
          page,
          page_size: pageSize,
          sort: params?.sort,
          q: params?.q,
          type: params?.type,
          compose_project: params?.compose_project,
          compose_service: params?.compose_service,
          is_tracked: 'false',
          is_orphaned: params?.orphaned?.toString() as 'true' | 'false',
        });
        mountsResponse = { data: mountsData };
      } else if (params?.is_tracked === true) {
        // Fetch tracked items - both volumes and tracked mounts
        const [volData, mountData] = await Promise.all([
          fetch(`${api.baseUrl}/api/v1/volumes?${new URLSearchParams({
            page: page.toString(),
            page_size: Math.max(1, Math.ceil(pageSize / 2)).toString(),
            ...(params?.sort && { sort: params.sort }),
            ...(params?.q && { q: params.q }),
            ...(params?.driver && { driver: params.driver }),
            ...(params?.orphaned && { orphaned: params.orphaned.toString() }),
            ...(params?.system && { system: params.system.toString() }),
          })}`)
            .then(res => res.json()),
          
          api.api.v1MountsList({
            page,
            page_size: Math.max(1, Math.ceil(pageSize / 2)),
            sort: params?.sort,
            q: params?.q,
            type: params?.type,
            compose_project: params?.compose_project,
            compose_service: params?.compose_service,
            is_tracked: 'true',
            is_orphaned: params?.orphaned?.toString() as 'true' | 'false',
          }),
        ]);
        volumesResponse = { data: volData };
        mountsResponse = { data: mountData };
      } else {
        // No tracking filter - fetch both normally
        const [volData, mountData] = await Promise.all([
          fetch(`${api.baseUrl}/api/v1/volumes?${new URLSearchParams({
            page: page.toString(),
            page_size: Math.max(1, Math.ceil(pageSize / 2)).toString(),
            ...(params?.sort && { sort: params.sort }),
            ...(params?.q && { q: params.q }),
            ...(params?.driver && { driver: params.driver }),
            ...(params?.orphaned && { orphaned: params.orphaned.toString() }),
            ...(params?.system && { system: params.system.toString() }),
          })}`)
            .then(res => res.json()),
          
          api.api.v1MountsList({
            page,
            page_size: Math.max(1, Math.ceil(pageSize / 2)),
            sort: params?.sort,
            q: params?.q,
            type: params?.type,
            compose_project: params?.compose_project,
            compose_service: params?.compose_service,
            is_orphaned: params?.orphaned?.toString() as 'true' | 'false',
          }),
        ]);
        volumesResponse = { data: volData };
        mountsResponse = { data: mountData };
      }

      // Transform data
      const volumeData = volumesResponse.data?.data || [];
      const mountData = mountsResponse.data?.mounts || [];

      const transformedVolumes = volumeData.map(transformVolume);
      const transformedMounts = mountData.map(transformMount);

      // Combine and deduplicate data
      const combined = [...transformedVolumes, ...transformedMounts];
      const deduped = combined.reduce((acc, item) => {
        const existing = acc.find(existing => 
          existing.name === item.name && existing.type === item.type
        );
        if (!existing) {
          acc.push(item);
        }
        return acc;
      }, [] as VolumeMount[]);

      // Sort combined data if needed
      if (params?.sort) {
        const [field, direction] = params.sort.split(':');
        deduped.sort((a, b) => {
          const aValue = a[field as keyof VolumeMount];
          const bValue = b[field as keyof VolumeMount];
          
          let comparison = 0;
          if (aValue < bValue) comparison = -1;
          else if (aValue > bValue) comparison = 1;
          
          return direction === 'desc' ? -comparison : comparison;
        });
      }

      setData(deduped);
      setPaginationMeta({
        page,
        pageSize,
        total: (volumesResponse.data?.total || 0) + (mountsResponse.data?.pagination?.total || 0),
        sort: params?.sort,
        filters: params,
      });

    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      console.error('Failed to fetch volumes and mounts:', err);
    } finally {
      setLoading(false);
    }
  }, [transformVolume, transformMount]);

  // Bulk operations
  const updateTrackingStatus = useCallback(async (
    items: VolumeMount[], 
    tracked: boolean
  ): Promise<void> => {
    const promises = items.map(async (item) => {
      if (item.source_type === 'mount' && item.id) {
        // Update mount tracking status
        return api.api.v1MountsTrackingUpdate(
          item.id,
          { is_tracked: tracked }
        );
      }
      // For volumes, tracking is implicit (they're always tracked unless orphaned)
      return Promise.resolve();
    });

    await Promise.all(promises);
    
    // Refresh data after update
    // Note: We'll need to pass current params here in a real implementation
    await fetchData();
  }, [fetchData]);

  const bulkTrack = useCallback(async (selectedIds: string[]): Promise<void> => {
    const selectedItems = data.filter(item => selectedIds.includes(item.id));
    await updateTrackingStatus(selectedItems, true);
  }, [data, updateTrackingStatus]);

  const bulkUntrack = useCallback(async (selectedIds: string[]): Promise<void> => {
    const selectedItems = data.filter(item => selectedIds.includes(item.id));
    await updateTrackingStatus(selectedItems, false);
  }, [data, updateTrackingStatus]);

  const bulkHide = useCallback(async (selectedIds: string[]): Promise<void> => {
    // For now, hiding means untracking
    // In the future this could involve a separate "hidden" status
    await bulkUntrack(selectedIds);
  }, [bulkUntrack]);

  // Trigger mount discovery
  const triggerDiscovery = useCallback(async (): Promise<void> => {
    await api.api.v1MountsDiscoverCreate({ force: true });
    // Refresh data after discovery
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    paginationMeta,
    fetchData,
    bulkTrack,
    bulkUntrack,
    bulkHide,
    triggerDiscovery,
  };
}
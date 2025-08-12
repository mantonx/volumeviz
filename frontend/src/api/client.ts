/**
 * VolumeViz API Client
 *
 * Pre-configured API client with type safety for VolumeViz backend
 */

import {
  Api,
  type PagedVolumes,
  type ScanResponse,
  type Volume,
  type RefreshRequest,
} from './generated/Api';

// Create configured API client
const volumeVizApi = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Export typed API methods
export const volumeApi = {
  // Volume operations
  async listVolumes(filters?: {
    page?: number;
    page_size?: number;
    sort?: string;
    q?: string;
    driver?: 'local' | 'nfs' | 'cifs' | 'overlay2';
    orphaned?: boolean;
    system?: boolean;
    created_after?: string;
    created_before?: string;
  }) {
    const response = await volumeVizApi.volumes.listVolumes(filters);
    return response.data;
  },

  async getVolume(name: string) {
    const response = await volumeVizApi.volumes.getVolume(name);
    return response.data;
  },

  // Scan operations
  async getVolumeSize(volumeId: string) {
    const response = await volumeVizApi.volumes.getVolumeSize(volumeId);
    return response.data;
  },

  async refreshVolumeSize(
    volumeId: string,
    options?: RefreshRequest,
  ) {
    const response = await volumeVizApi.volumes.refreshVolumeSize(
      volumeId,
      options || {},
    );
    return response.data;
  },

  // Health checks
  async checkDockerHealth() {
    const response = await volumeVizApi.health.getDockerHealth();
    return response.data;
  },
};

// Export types for use in components
export type {
  PagedVolumes,
  Volume as VolumeResponse,
  VolumeDetail,
  ScanResponse,
  ScanProgress,
  ErrorResponse,
  RefreshRequest,
} from './generated/Api';

// Legacy type aliases for backwards compatibility
export type VolumeListResponse = PagedVolumes;
export type AsyncScanResponse = ScanResponse;

export default volumeVizApi;

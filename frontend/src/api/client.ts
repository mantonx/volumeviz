/**
 * VolumeViz API Client
 * 
 * Pre-configured API client with type safety for VolumeViz backend
 */

import { Api, type VolumeListResponse, type ScanResponse, type AsyncScanResponse } from './generated/volumeviz-api';

// Create configured API client
const volumeVizApi = new Api({
  baseUrl: process.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Export typed API methods
export const volumeApi = {
  // Volume operations
  async listVolumes(filters?: { driver?: string; label_key?: string; label_value?: string }) {
    const response = await volumeVizApi.volumes.volumesList(filters);
    return response.data as VolumeListResponse;
  },

  async getVolume(id: string) {
    const response = await volumeVizApi.volumes.volumesDetail(id);
    return response.data;
  },

  // Scan operations
  async getVolumeSize(id: string) {
    const response = await volumeVizApi.volumes.volumesSize(id);
    return response.data as ScanResponse;
  },

  async refreshVolumeSize(id: string, options?: { async?: boolean; method?: string }) {
    const response = await volumeVizApi.volumes.volumesSizeRefresh(id, options);
    return response.data as ScanResponse | AsyncScanResponse;
  },

  // Health checks
  async checkDockerHealth() {
    const response = await volumeVizApi.health.dockerList();
    return response.data;
  },
};

// Export types for use in components
export type {
  VolumeListResponse,
  VolumeResponse,
  ScanResponse,
  ScanResult,
  AsyncScanResponse,
  ErrorResponse,
  RefreshRequest,
} from './generated/volumeviz-api';

export default volumeVizApi;
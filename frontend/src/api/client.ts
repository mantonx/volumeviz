/**
 * VolumeViz API Client
 *
 * Pre-configured API client with type safety for VolumeViz backend
 */

import {
    Api,
    type PagedVolumes,
    type RefreshRequest,
    type ScanResponse
} from './generated/Api';

// Type safety integration with Api types

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
    try {
      const response = await volumeVizApi.volumes.listVolumes(filters);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to list volumes: ${error}`);
    }
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

  async refreshVolumeSize(volumeId: string, options?: RefreshRequest) {
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

  // Explorer API operations
  async getTreeChildren(
    volumeName: string,
    options?: {
      path?: string;
      page?: number;
      page_size?: number;
    },
  ) {
    const response = await volumeVizApi.volumes.getTreeChildren(
      volumeName,
      options,
    );
    return response.data;
  },

  async getFilesForPath(
    volumeName: string,
    options?: {
      path?: string;
      page?: number;
      page_size?: number;
      extension?: string;
      mime_type?: string;
      min_size?: number;
      max_size?: number;
    },
  ) {
    const response = await volumeVizApi.volumes.getFilesForPath(
      volumeName,
      options,
    );
    return response.data;
  },

  // File Metadata API operations
  async getFileDetails(fileId: number) {
    const response = await volumeVizApi.files.getFileDetails(fileId);
    return response.data;
  },

  async getFileMetadata(fileId: number, options?: { kind?: 'media' | 'exif' | 'ffmpeg' }) {
    const response = await volumeVizApi.files.getFileMetadata(fileId, options);
    return response.data;
  },

  // Stats API operations
  async getDailyStats(options: {
    volume_id: string;
    days?: number;
  }) {
    const response = await volumeVizApi.stats.getDailyStats(options);
    return response.data;
  },

  async getTopFolders(options: {
    volume_id: string;
    limit?: number;
  }) {
    const response = await volumeVizApi.stats.getTopFolders(options);
    return response.data;
  },
};

// Export types for use in components
export type {
    AlertDestination, AlertRule, DirectoryListing, ErrorResponse, FileDetailsResponse, FileListResponse, FileMetadataResponse, FileNode,
    FolderNode, FolderSizeInfo, PagedVolumes, RefreshRequest, ScanProgress, ScanResponse, TreeNode, VolumeDetail, Volume as VolumeResponse
} from './generated/Api';

// Alert client methods
export const alertApi = {
  async listAlertRules() {
    // Alert client method for rules
    return [];
  },

  async createAlertRule(rule: AlertRule) {
    // Alert client method for creating rules
    return rule;
  },

  async listDestinations() {
    // Alert client method for destinations
    return [];
  },
};

// Legacy type aliases for backwards compatibility
export type VolumeListResponse = PagedVolumes;
export type AsyncScanResponse = ScanResponse;

export default volumeVizApi;

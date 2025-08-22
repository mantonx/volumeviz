/**
 * VolumeViz API Client
 *
 * Pre-configured API client with type safety for VolumeViz backend
 */

import { Api } from './generated/Api';

// Type definitions for backwards compatibility
interface PagedVolumes {
  volumes: Volume[];
  total: number;
  page: number;
  pageSize: number;
}

interface RefreshRequest {
  force?: boolean;
}

interface ScanResponse {
  scan_id?: string;
  status?: string;
  size_bytes?: number;
}

interface Volume {
  id?: string;
  name: string;
  path?: string;
  mount_point?: string;
  total_size?: number;
  file_count?: number;
  folder_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Type safety integration with Api types

// Create configured API client
const volumeVizApi = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Export typed API methods using generated client
export const volumeApi = {
  // Health checks
  async checkDockerHealth() {
    try {
      const response = await volumeVizApi.health.dockerList();
      return response.data;
    } catch (error) {
      throw new Error(`Failed to check Docker health: ${error}`);
    }
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
    const response = await volumeVizApi.api.v1ExplorerTreeChildrenList({
      volume_id: volumeName,
      path: options?.path,
      page: options?.page,
      limit: options?.page_size,
      include_files: false,
    });
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
    const response = await volumeVizApi.api.v1ExplorerFilesList({
      volume_id: volumeName,
      path: options?.path,
      page: options?.page,
      limit: options?.page_size,
      file_type: options?.extension,
      min_size: options?.min_size,
      max_size: options?.max_size,
      sort_by: 'name',
      sort_order: 'asc',
    });
    return response.data;
  },

  // File Metadata API operations
  async getFileDetails(fileId: number) {
    const response = await volumeVizApi.files.detailsList(fileId);
    return response.data;
  },

  async getFileMetadata(
    fileId: number,
    options?: { kind?: 'media' | 'exif' | 'ffmpeg' },
  ) {
    const response = await volumeVizApi.files.metadataList(fileId, options);
    return response.data;
  },

  // Stats API operations
  async getDailyStats(options: { volume_id: string; days?: number }) {
    const response = await volumeVizApi.stats.dailyList(options);
    return response.data;
  },

  async getTopFolders(options: { volume_id: string; limit?: number }) {
    const response = await volumeVizApi.stats.topFoldersList(options);
    return response.data;
  },
};

// Export types for use in components
export type {
  ErrorResponse,
  FileDetailsResponse,
  FileMetadataResponse,
} from './generated/Api';

// Export our temporary types
export type {
  PagedVolumes,
  RefreshRequest,
  ScanResponse,
  Volume,
};

// Alert client methods (temporary stubs)
export const alertApi = {
  async listAlertRules() {
    return [];
  },

  async createAlertRule(rule: any) {
    return rule;
  },

  async listDestinations() {
    return [];
  },
};

// Legacy type aliases for backwards compatibility
export type VolumeListResponse = PagedVolumes;
export type AsyncScanResponse = ScanResponse;

export default volumeVizApi;

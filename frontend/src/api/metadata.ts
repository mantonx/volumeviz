/**
 * Metadata API Client
 *
 * Provides typed API functions for metadata operations
 */

import { Api } from './generated/Api';

// Create configured API client
const api = new Api({
  baseUrl:
    (import.meta.env?.VITE_API_URL as string) || 'http://localhost:8080/api/v1',
  baseApiParams: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
});

// Filter metadata types
export interface MimeTypeOption {
  value: string;
  label: string;
  file_count: number;
}

export interface MediaKindOption {
  value: string;
  label: string;
  file_count: number;
}

export interface ExtensionOption {
  value: string;
  label: string;
  file_count: number;
}

export interface FilterMetadataResponse {
  mime_types: MimeTypeOption[];
  media_kinds: MediaKindOption[];
  extensions: ExtensionOption[];
}

// Metadata API client
export const metadataApi = {
  /**
   * Get available filter metadata (MIME types, media kinds, extensions)
   */
  async getFilterMetadata(): Promise<FilterMetadataResponse> {
    try {
      const response = await fetch(`${api.baseUrl}/metadata/filters`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          'Filter metadata API error:',
          response.status,
          response.statusText,
          errorText,
        );
        throw new Error(
          `Failed to get filter metadata: ${response.status} ${response.statusText}: ${errorText}`,
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get filter metadata: ${error}`);
    }
  },
};

export default metadataApi;

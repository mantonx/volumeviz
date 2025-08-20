/**
 * usePreview Hook
 *
 * Manages preview generation, caching, and state for file previews
 */

import { useState, useEffect, useCallback } from 'react';

interface UsePreviewOptions {
  fileId: string;
  mediaType: string;
  size?: 'small' | 'medium' | 'large';
  timeOffset?: number; // For video thumbnails
  enabled?: boolean;
}

interface PreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
}

interface PreviewMetadata {
  id: string;
  file_id: string;
  type: 'thumbnail' | 'poster' | 'cover';
  size: string;
  format: string;
  content_hash: string;
  storage_path: string;
  processing_ms: number;
  created_at: string;
  accessed_at: string;
}

interface GeneratePreviewResponse {
  metadata: PreviewMetadata;
  cache_hit: boolean;
  processing_ms: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const canGeneratePreview = (mediaType: string): boolean => {
  return (
    mediaType.startsWith('image/') ||
    mediaType.startsWith('video/') ||
    mediaType.startsWith('audio/')
  );
};

const getPreviewType = (
  mediaType: string,
): 'thumbnail' | 'poster' | 'cover' => {
  if (mediaType.startsWith('image/')) return 'thumbnail';
  if (mediaType.startsWith('video/')) return 'poster';
  if (mediaType.startsWith('audio/')) return 'cover';
  return 'thumbnail';
};

export const usePreview = ({
  fileId,
  mediaType,
  size = 'medium',
  timeOffset = 5.0,
  enabled = true,
}: UsePreviewOptions) => {
  const [state, setState] = useState<PreviewState>({
    url: null,
    loading: false,
    error: null,
    cached: false,
  });

  const generatePreview = useCallback(async () => {
    if (!enabled || !canGeneratePreview(mediaType)) {
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const previewType = getPreviewType(mediaType);

      // First, try to generate/get the preview
      const generateUrl = `${API_BASE}/api/v1/previews/${fileId}/generate`;
      const generateParams = new URLSearchParams({
        type: previewType,
        size,
        ...(previewType === 'poster' && { time_offset: timeOffset.toString() }),
      });

      const generateResponse = await fetch(`${generateUrl}?${generateParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!generateResponse.ok) {
        throw new Error(
          `Failed to generate preview: ${generateResponse.statusText}`,
        );
      }

      const generateData: GeneratePreviewResponse =
        await generateResponse.json();

      // Now get the preview URL
      const previewUrl = `${API_BASE}/api/v1/previews/${fileId}`;
      const previewParams = new URLSearchParams({
        size,
        ...(previewType === 'poster' && { time_offset: timeOffset.toString() }),
      });

      const finalUrl = `${previewUrl}?${previewParams}`;

      setState({
        url: finalUrl,
        loading: false,
        error: null,
        cached: generateData.cache_hit,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [fileId, mediaType, size, timeOffset, enabled]);

  const checkPreviewExists = useCallback(async () => {
    if (!enabled || !canGeneratePreview(mediaType)) {
      return false;
    }

    try {
      const previewUrl = `${API_BASE}/api/v1/previews/${fileId}`;
      const previewParams = new URLSearchParams({
        size,
        ...(getPreviewType(mediaType) === 'poster' && {
          time_offset: timeOffset.toString(),
        }),
      });

      const response = await fetch(`${previewUrl}?${previewParams}`, {
        method: 'HEAD', // Only check if it exists
      });

      return response.ok;
    } catch {
      return false;
    }
  }, [fileId, mediaType, size, timeOffset, enabled]);

  const getPreviewUrl = useCallback(() => {
    if (!canGeneratePreview(mediaType)) {
      return null;
    }

    const previewType = getPreviewType(mediaType);
    const url = `${API_BASE}/api/v1/previews/${fileId}`;
    const params = new URLSearchParams({
      size,
      ...(previewType === 'poster' && { time_offset: timeOffset.toString() }),
    });

    return `${url}?${params}`;
  }, [fileId, mediaType, size, timeOffset]);

  // Auto-generate preview when dependencies change
  useEffect(() => {
    if (enabled && canGeneratePreview(mediaType)) {
      // First check if preview exists
      checkPreviewExists().then((exists) => {
        if (exists) {
          setState({
            url: getPreviewUrl(),
            loading: false,
            error: null,
            cached: true,
          });
        } else {
          generatePreview();
        }
      });
    }
  }, [
    fileId,
    mediaType,
    size,
    timeOffset,
    enabled,
    generatePreview,
    checkPreviewExists,
    getPreviewUrl,
  ]);

  return {
    ...state,
    generatePreview,
    checkPreviewExists,
    getPreviewUrl,
    canGenerate: canGeneratePreview(mediaType),
    previewType: getPreviewType(mediaType),
  };
};

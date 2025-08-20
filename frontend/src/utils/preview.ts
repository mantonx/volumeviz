/**
 * Preview URL utilities for VolumeViz
 *
 * Provides utilities for building preview image URLs and handling responsive images
 */

export type PreviewSize = 'small' | 'medium' | 'large';
export type PreviewType = 'thumbnail' | 'poster' | 'cover';

export interface PreviewUrlOptions {
  size?: PreviewSize;
  timeOffset?: number; // For video posters
}

/**
 * Build a preview URL for a file
 */
export function buildPreviewUrl(
  fileId: number,
  options: PreviewUrlOptions = {},
): string {
  // Use relative path to leverage Vite proxy configuration
  const baseUrl = '/api/v1';
  const { size = 'medium', timeOffset } = options;

  const params = new URLSearchParams({
    size,
  });

  if (timeOffset !== undefined) {
    params.append('time_offset', timeOffset.toString());
  }

  return `${baseUrl}/previews/${fileId}?${params}`;
}

/**
 * Check if a file supports preview generation based on MIME type
 */
export function canGeneratePreview(mimeType?: string): boolean {
  if (!mimeType) return false;

  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/')
  );
}

/**
 * Determine the preview type based on MIME type
 */
export function getPreviewType(mimeType?: string): PreviewType {
  if (!mimeType) return 'thumbnail';

  if (mimeType.startsWith('image/')) return 'thumbnail';
  if (mimeType.startsWith('video/')) return 'poster';
  if (mimeType.startsWith('audio/')) return 'cover';

  return 'thumbnail';
}

/**
 * Build srcset for responsive images
 */
export function buildPreviewSrcSet(
  fileId: number,
  options: PreviewUrlOptions = {},
): string {
  const sizes: PreviewSize[] = ['small', 'medium', 'large'];
  const sizeMap: Record<PreviewSize, string> = {
    small: '256w',
    medium: '512w',
    large: '1024w',
  };

  return sizes
    .map((size) => {
      const url = buildPreviewUrl(fileId, { ...options, size });
      return `${url} ${sizeMap[size]}`;
    })
    .join(', ');
}

/**
 * Get appropriate sizes attribute for responsive images
 */
export function getPreviewSizes(
  context: 'grid' | 'list' | 'detail' = 'list',
): string {
  switch (context) {
    case 'grid':
      return '(max-width: 768px) 128px, (max-width: 1024px) 192px, 256px';
    case 'list':
      return '(max-width: 768px) 48px, 64px';
    case 'detail':
      return '(max-width: 768px) 90vw, (max-width: 1024px) 60vw, 50vw';
    default:
      return '64px';
  }
}

/**
 * Create a blur data URL for progressive loading
 */
export function createBlurDataUrl(width = 64, height = 64): string {
  // Simple SVG blur placeholder
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <rect width="100%" height="100%" fill="url(#grad)" opacity="0.3"/>
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e5e7eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d1d5db;stop-opacity:1" />
        </linearGradient>
      </defs>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Handle preview image loading errors with fallback
 */
export function handlePreviewError(
  event: React.SyntheticEvent<HTMLImageElement>,
): void {
  const img = event.currentTarget;

  // Don't retry if already using fallback
  if (img.src.includes('data:image/svg+xml')) {
    return;
  }

  // Set a fallback image
  img.src = createBlurDataUrl();
  img.alt = 'Preview not available';
}

/**
 * Preload a preview image
 */
export function preloadPreview(
  fileId: number,
  options: PreviewUrlOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to preload preview'));
    img.src = buildPreviewUrl(fileId, options);
  });
}

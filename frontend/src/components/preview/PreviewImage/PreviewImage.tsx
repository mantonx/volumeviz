/**
 * PreviewImage Component
 *
 * Displays optimized WebP previews with lazy loading, placeholder states,
 * and progressive enhancement using <picture> element with srcset.
 */

import { cn } from '@/utils';
import { AlertCircleIcon, ImageIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface PreviewImageProps {
  fileId: string;
  fileName: string;
  mediaType: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  alt?: string;
  lazy?: boolean;
  showBlurUp?: boolean;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onClick?: () => void;
}

interface PreviewState {
  loading: boolean;
  error: boolean;
  loaded: boolean;
  blurUpLoaded: boolean;
}

const API_BASE =
  typeof window !== 'undefined'
    ? (window as any).env?.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    : 'http://localhost:8080';

const getPreviewUrl = (
  fileId: string,
  size: string,
  timeOffset?: number,
): string => {
  const url = new URL(`${API_BASE}/api/v1/previews/${fileId}`);
  url.searchParams.set('size', size);
  if (timeOffset !== undefined) {
    url.searchParams.set('time_offset', timeOffset.toString());
  }
  return url.toString();
};

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

export const PreviewImage: React.FC<PreviewImageProps> = ({
  fileId,
  fileName,
  mediaType,
  size = 'medium',
  className = '',
  alt,
  lazy = true,
  showBlurUp = true,
  onLoad,
  onError,
  onClick,
}) => {
  const [state, setState] = useState<PreviewState>({
    loading: true,
    error: false,
    loaded: false,
    blurUpLoaded: false,
  });

  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isInView, setIsInView] = useState(!lazy);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' },
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy]);

  const handleLoad = useCallback(() => {
    setState((prev) => ({ ...prev, loading: false, loaded: true }));
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    const error = new Error(`Failed to load preview for ${fileName}`);
    setState((prev) => ({ ...prev, loading: false, error: true }));
    onError?.(error);
  }, [fileName, onError]);

  const handleBlurUpLoad = useCallback(() => {
    setState((prev) => ({ ...prev, blurUpLoaded: true }));
  }, []);

  // Don't render anything if we can't generate a preview
  if (!canGeneratePreview(mediaType)) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded',
          'min-h-[64px] min-w-[64px]',
          size === 'small' && 'h-16 w-16',
          size === 'medium' && 'h-32 w-32',
          size === 'large' && 'h-48 w-48',
          className,
        )}
      >
        <ImageIcon className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  const previewType = getPreviewType(mediaType);
  const displayAlt = alt || `${previewType} for ${fileName}`;

  // Create srcset for responsive images
  const createSrcSet = () => {
    const small = getPreviewUrl(fileId, 'small');
    const medium = getPreviewUrl(fileId, 'medium');
    const large = getPreviewUrl(fileId, 'large');

    return `${small} 256w, ${medium} 512w, ${large} 1024w`;
  };

  const createSizes = () => {
    switch (size) {
      case 'small':
        return '(max-width: 256px) 256px, 256px';
      case 'medium':
        return '(max-width: 512px) 512px, 512px';
      case 'large':
        return '(max-width: 1024px) 1024px, 1024px';
      default:
        return '(max-width: 512px) 512px, 512px';
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded bg-gray-100 dark:bg-gray-800',
        'flex items-center justify-center',
        size === 'small' && 'h-16 w-16',
        size === 'medium' && 'h-32 w-32',
        size === 'large' && 'h-48 w-48',
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className,
      )}
      onClick={onClick}
      ref={imgRef}
    >
      {/* Loading placeholder */}
      {state.loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-full" />
          <div className="absolute">
            <ImageIcon className="w-6 h-6 text-gray-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Error state */}
      {state.error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center text-gray-500">
            <AlertCircleIcon className="w-6 h-6 mb-1" />
            <span className="text-xs">Failed to load</span>
          </div>
        </div>
      )}

      {/* Blur-up placeholder (small version loaded first) */}
      {showBlurUp && isInView && !state.error && (
        <img
          src={getPreviewUrl(fileId, 'small')}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            'filter blur-sm scale-105', // Slightly blur and scale to hide edges
            state.blurUpLoaded && state.loaded ? 'opacity-0' : 'opacity-60',
          )}
          onLoad={handleBlurUpLoad}
          loading="eager"
        />
      )}

      {/* Main preview image */}
      {isInView && !state.error && (
        <picture>
          <source
            srcSet={createSrcSet()}
            sizes={createSizes()}
            type="image/webp"
          />
          <img
            src={getPreviewUrl(fileId, size)}
            alt={displayAlt}
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
              state.loaded ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={handleLoad}
            onError={handleError}
            loading={lazy ? 'lazy' : 'eager'}
            decoding="async"
          />
        </picture>
      )}

      {/* Preview type indicator for video/audio */}
      {(mediaType.startsWith('video/') || mediaType.startsWith('audio/')) && (
        <div className="absolute bottom-1 right-1 bg-black bg-opacity-50 rounded px-1 py-0.5">
          <span className="text-white text-xs">
            {mediaType.startsWith('video/') ? 'Video' : 'Audio'}
          </span>
        </div>
      )}
    </div>
  );
};

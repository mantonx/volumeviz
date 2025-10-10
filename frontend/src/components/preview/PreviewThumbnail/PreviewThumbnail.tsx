/**
 * PreviewThumbnail Component
 *
 * Displays thumbnail previews for search results with lazy loading and responsive images
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  buildPreviewUrl,
  buildPreviewSrcSet,
  getPreviewSizes,
  canGeneratePreview,
  createBlurDataUrl,
  handlePreviewError,
} from '@/utils/preview';
import { getFileIcon } from '@/utils/fileIcons';
import { useImageLoader } from '@/utils/imageLoadingManager';

export interface PreviewThumbnailProps {
  fileId: number;
  fileName: string;
  mimeType?: string;
  mediaKind?: string;
  size?: 'small' | 'medium' | 'large';
  context?: 'grid' | 'list' | 'detail';
  lazy?: boolean;
  showBlurUp?: boolean;
  className?: string;
  onClick?: () => void;
  priority?: number;
}

export const PreviewThumbnail: React.FC<PreviewThumbnailProps> = ({
  fileId,
  fileName,
  mimeType,
  mediaKind,
  size = 'medium',
  context = 'list',
  lazy = true,
  showBlurUp = true,
  className = '',
  onClick,
  priority = 0,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { loadImage } = useImageLoader();

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1,
      },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isInView]);

  // Determine if we should show preview or fallback icon
  const shouldShowPreview =
    canGeneratePreview(mimeType) && !hasError && isInView;

  // Load image through the loading manager when in view
  useEffect(() => {
    if (!isInView || !shouldShowPreview || hasError) return;

    const previewUrl = buildPreviewUrl(fileId, { size });

    loadImage(previewUrl, priority)
      .then(() => {
        // Image is now in browser cache, the img element should load quickly
        // Force a reload if the src doesn't match
        if (imgRef.current) {
          const currentSrc = imgRef.current.src;
          if (!currentSrc.includes(previewUrl)) {
            imgRef.current.src = previewUrl;
          }
        }
      })
      .catch((error) => {
        // If it's a 404 (preview not yet generated), show fallback but don't mark as error
        // This allows retrying later when the preview might be available
        if (error.status === 404) {
          setHasError(true); // Show fallback icon for now
        } else {
          setHasError(true); // Permanent error
        }
      });
  }, [fileId, size, priority, isInView, shouldShowPreview, hasError]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Handle image error
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    handlePreviewError(event);
  };

  // Get file extension for fallback icon
  const getFileExtension = (filename: string) => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
  };

  // Get fallback icon info
  const fileIconInfo = getFileIcon(
    mediaKind,
    mimeType,
    getFileExtension(fileName),
  );

  // Calculate container dimensions based on context
  const getDimensions = () => {
    switch (context) {
      case 'grid':
        return 'w-32 h-32 sm:w-40 sm:h-40';
      case 'list':
        return 'w-12 h-12 sm:w-16 sm:h-16';
      case 'detail':
        return 'w-64 h-64 sm:w-80 sm:h-80';
      default:
        return 'w-16 h-16';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`
        ${getDimensions()}
        relative overflow-hidden rounded-lg bg-surface-secondary flex items-center justify-center
        ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {shouldShowPreview ? (
        <>
          {/* Blur-up placeholder */}
          {showBlurUp && !isLoaded && (
            <img
              src={createBlurDataUrl()}
              alt=""
              className="absolute inset-0 w-full h-full object-cover filter blur-sm"
              aria-hidden="true"
            />
          )}

          {/* Main preview image */}
          <img
            ref={imgRef}
            src={buildPreviewUrl(fileId, { size })}
            srcSet={buildPreviewSrcSet(fileId, { size })}
            sizes={getPreviewSizes(context)}
            alt={`Preview of ${fileName}`}
            onLoad={handleLoad}
            onError={handleImageError}
            className={`
              w-full h-full object-cover transition-opacity duration-300
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            loading={lazy ? 'lazy' : 'eager'}
            role="img"
            tabIndex={onClick ? 0 : -1}
            onKeyDown={(e) => {
              if (onClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onClick();
              }
            }}
          />

          {/* Loading indicator */}
          {!isLoaded && !hasError && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="status"
              aria-label="Loading preview image"
            >
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </>
      ) : (
        /* Fallback icon */
        <div
          className={`
            w-full h-full flex items-center justify-center
            ${fileIconInfo.bgColor} ${fileIconInfo.color}
            ${context === 'grid' ? 'text-4xl' : context === 'detail' ? 'text-6xl' : 'text-2xl'}
            ${onClick ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' : ''}
          `}
          role="img"
          aria-label={`${fileIconInfo.name || mediaKind || 'File'} icon for ${fileName}`}
          tabIndex={onClick ? 0 : -1}
          onKeyDown={(e) => {
            if (onClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onClick();
            }
          }}
        >
          {fileIconInfo.icon}
        </div>
      )}

      {/* Media type indicator for videos and audio */}
      {shouldShowPreview &&
        (mimeType?.startsWith('video/') || mimeType?.startsWith('audio/')) && (
          <div
            className="absolute top-2 right-2 bg-black/50 text-white rounded px-1.5 py-0.5 text-xs font-medium"
            aria-label={
              mimeType?.startsWith('video/') ? 'Video file' : 'Audio file'
            }
          >
            {mimeType?.startsWith('video/') ? '▶' : '♪'}
          </div>
        )}

      {/* Error state for screen readers */}
      {hasError && (
        <span className="sr-only">
          Preview image failed to load for {fileName}
        </span>
      )}
    </div>
  );
};

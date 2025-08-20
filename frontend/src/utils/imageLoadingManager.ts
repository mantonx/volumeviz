/**
 * Image Loading Manager
 *
 * Provides concurrency control and queueing for image requests to prevent overwhelming the browser
 */

interface ImageLoadRequest {
  url: string;
  priority: number;
  resolve: (success: boolean) => void;
  reject: (error: Error) => void;
  retries: number;
}

export class ImageLoadingManager {
  private queue: ImageLoadRequest[] = [];
  private activeRequests = new Set<string>();
  private maxConcurrent: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    options: {
      maxConcurrent?: number;
      maxRetries?: number;
      retryDelay?: number;
    } = {},
  ) {
    this.maxConcurrent = options.maxConcurrent || 6;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Load an image with priority and concurrency control
   */
  loadImage(url: string, priority: number = 0): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Check if already loading this URL
      if (this.activeRequests.has(url)) {
        // Return a promise that resolves when the existing request completes
        this.waitForExistingRequest(url).then(resolve).catch(reject);
        return;
      }

      const request: ImageLoadRequest = {
        url,
        priority,
        resolve,
        reject,
        retries: 0,
      };

      this.enqueueRequest(request);
      this.processQueue();
    });
  }

  /**
   * Preload multiple images with priority
   */
  preloadImages(urls: string[], priority: number = -1): Promise<boolean[]> {
    return Promise.all(urls.map((url) => this.loadImage(url, priority)));
  }

  /**
   * Clear the queue and cancel pending requests
   */
  clearQueue(): void {
    this.queue.forEach((request) => {
      request.reject(new Error('Request cancelled'));
    });
    this.queue = [];
  }

  /**
   * Get current loading statistics
   */
  getStats(): {
    queueLength: number;
    activeRequests: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      maxConcurrent: this.maxConcurrent,
    };
  }

  private enqueueRequest(request: ImageLoadRequest): void {
    // Insert request based on priority (higher priority first)
    const insertIndex = this.queue.findIndex(
      (existing) => existing.priority < request.priority,
    );

    if (insertIndex === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(insertIndex, 0, request);
    }
  }

  private processQueue(): void {
    // Process as many requests as we can up to the concurrency limit
    while (
      this.queue.length > 0 &&
      this.activeRequests.size < this.maxConcurrent
    ) {
      const request = this.queue.shift()!;
      this.executeRequest(request);
    }
  }

  private async executeRequest(request: ImageLoadRequest): Promise<void> {
    this.activeRequests.add(request.url);

    try {
      const success = await this.loadImageInternal(request.url);
      request.resolve(success);
    } catch (error) {
      if (request.retries < this.maxRetries) {
        // Retry after delay
        request.retries++;
        setTimeout(() => {
          this.enqueueRequest(request);
          this.processQueue();
        }, this.retryDelay * request.retries);
      } else {
        request.reject(error as Error);
      }
    } finally {
      this.activeRequests.delete(request.url);
      this.processQueue(); // Process next request in queue
    }
  }

  private loadImageInternal(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        img.onabort = null;
      };

      img.onload = () => {
        cleanup();
        resolve(true);
      };

      img.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.onabort = () => {
        cleanup();
        reject(new Error(`Image load aborted: ${url}`));
      };

      // Set a timeout for the request
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Image load timeout: ${url}`));
      }, 30000); // 30 second timeout

      img.onload = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(true);
      };

      img.src = url;
    });
  }

  private waitForExistingRequest(url: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (!this.activeRequests.has(url)) {
          clearInterval(checkInterval);
          // Try to load again (might be in cache now)
          this.loadImageInternal(url).then(resolve).catch(reject);
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error(`Timeout waiting for existing request: ${url}`));
      }, 30000);
    });
  }
}

// Global singleton instance
export const imageLoadingManager = new ImageLoadingManager({
  maxConcurrent: 6,
  maxRetries: 2,
  retryDelay: 1000,
});

/**
 * Hook for using the image loading manager in React components
 */
export function useImageLoader() {
  const loadImage = (url: string, priority: number = 0) => {
    return imageLoadingManager.loadImage(url, priority);
  };

  const preloadImages = (urls: string[], priority: number = -1) => {
    return imageLoadingManager.preloadImages(urls, priority);
  };

  const getStats = () => {
    return imageLoadingManager.getStats();
  };

  return {
    loadImage,
    preloadImages,
    getStats,
  };
}

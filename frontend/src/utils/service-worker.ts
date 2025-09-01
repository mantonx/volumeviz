// Service Worker Registration and Management
import React from 'react';
import { logger } from './logger';
export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  registration?: ServiceWorkerRegistration;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private listeners: ((status: ServiceWorkerStatus) => void)[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    if (!this.isSupported()) {
      logger.debug('Service Workers not supported');
      return;
    }

    try {
      await this.register();
      this.setupUpdateHandling();
      this.setupMessageHandling();
    } catch (error) {
      console.error('Service Worker initialization failed:', error);
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'caches' in window;
  }

  private async register(): Promise<void> {
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      logger.debug('Service Worker registered:', this.registration);
      
      this.notifyListeners();
      
      // Check for updates periodically
      setInterval(() => {
        this.checkForUpdates();
      }, 60000); // Check every minute

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  private setupUpdateHandling(): void {
    if (!this.registration) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New version available
            this.updateAvailable = true;
            logger.debug('New service worker available');
            this.notifyListeners();
          }
        }
      });
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New service worker has taken control
      logger.debug('Service worker updated');
      window.location.reload();
    });
  }

  private setupMessageHandling(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      
      if (data.type === 'BACKGROUND_SYNC_TRIGGERED') {
        // Trigger background sync in the app
        window.dispatchEvent(new CustomEvent('sw-background-sync', {
          detail: { timestamp: data.timestamp }
        }));
      }
    });
  }

  async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      await this.registration.update();
    } catch (error) {
      console.warn('Service worker update check failed:', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) return;

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) return false;

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      this.notifyListeners();
      return result;
    } catch (error) {
      console.error('Service worker unregistration failed:', error);
      return false;
    }
  }

  getStatus(): ServiceWorkerStatus {
    return {
      isSupported: this.isSupported(),
      isRegistered: !!this.registration,
      isActive: !!this.registration?.active,
      registration: this.registration || undefined,
    };
  }

  hasUpdate(): boolean {
    return this.updateAvailable;
  }

  onStatusChange(callback: (status: ServiceWorkerStatus) => void): () => void {
    this.listeners.push(callback);
    
    // Call immediately with current status
    callback(this.getStatus());
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(callback => callback(status));
  }

  // Cache management methods
  async getCacheStatus(): Promise<{ size: number; names: string[] }> {
    if (!this.isSupported()) {
      return { size: 0, names: [] };
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        totalSize += keys.length;
      }

      return { size: totalSize, names: cacheNames };
    } catch (error) {
      console.error('Failed to get cache status:', error);
      return { size: 0, names: [] };
    }
  }

  async clearCache(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      logger.debug('All caches cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  // Background sync methods
  async registerBackgroundSync(): Promise<void> {
    if (!this.registration || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('Background sync not supported');
      return;
    }

    try {
      // @ts-ignore - sync is not in the types yet
      await this.registration.sync.register('volumeviz-sync');
      logger.debug('Background sync registered');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
}

// Global instance
export const serviceWorkerManager = new ServiceWorkerManager();

// React hook for service worker status
export function useServiceWorker() {
  const [status, setStatus] = React.useState<ServiceWorkerStatus>(
    serviceWorkerManager.getStatus()
  );
  const [hasUpdate, setHasUpdate] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = serviceWorkerManager.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setHasUpdate(serviceWorkerManager.hasUpdate());
    });

    return unsubscribe;
  }, []);

  return {
    ...status,
    hasUpdate,
    skipWaiting: serviceWorkerManager.skipWaiting.bind(serviceWorkerManager),
    checkForUpdates: serviceWorkerManager.checkForUpdates.bind(serviceWorkerManager),
    unregister: serviceWorkerManager.unregister.bind(serviceWorkerManager),
    clearCache: serviceWorkerManager.clearCache.bind(serviceWorkerManager),
    getCacheStatus: serviceWorkerManager.getCacheStatus.bind(serviceWorkerManager),
  };
}

// Utility to check if app is running standalone (PWA)
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Install prompt handling
export class InstallPromptManager {
  private deferredPrompt: any = null;
  private isInstallable = false;
  private listeners: ((installable: boolean) => void)[] = [];

  constructor() {
    this.setupInstallPrompt();
  }

  private setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      logger.debug('Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      this.notifyListeners();
    });

    window.addEventListener('appinstalled', () => {
      logger.debug('App installed');
      this.deferredPrompt = null;
      this.isInstallable = false;
      this.notifyListeners();
    });
  }

  async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        logger.debug('User accepted install prompt');
      } else {
        logger.debug('User dismissed install prompt');
      }

      this.deferredPrompt = null;
      this.isInstallable = false;
      this.notifyListeners();

      return choiceResult.outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  isInstallPromptAvailable(): boolean {
    return this.isInstallable && !isPWA();
  }

  onInstallabilityChange(callback: (installable: boolean) => void): () => void {
    this.listeners.push(callback);
    
    // Call immediately with current status
    callback(this.isInstallPromptAvailable());
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const installable = this.isInstallPromptAvailable();
    this.listeners.forEach(callback => callback(installable));
  }
}

export const installPromptManager = new InstallPromptManager();
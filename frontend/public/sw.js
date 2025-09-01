// VolumeViz Service Worker for Enhanced Offline Support
const CACHE_NAME = 'volumeviz-v1';
const API_CACHE_NAME = 'volumeviz-api-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  // Add critical assets that should be cached
];

// API endpoints that can be cached
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/volumes(?:\?.*)?$/,
  /\/api\/v1\/organizations\/me$/,
  /\/api\/v1\/volumes\/[^/]+\/size$/,
  /\/api\/v1\/volumes\/[^/]+\/media-status$/,
];

// API endpoints that should never be cached
const NON_CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/volumes\/[^/]+\/scan$/,
  /\/api\/v1\/volumes\/[^/]+\/size\/refresh$/,
  /\/api\/v1\/volumes\/[^/]+\/filesystem\/index$/,
  /\/api\/v1\/auth\//,
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isGET = request.method === 'GET';
  
  // Check if this API endpoint should never be cached
  const shouldNotCache = NON_CACHEABLE_API_PATTERNS.some(pattern => 
    pattern.test(url.pathname)
  );

  if (shouldNotCache) {
    // Always go to network for non-cacheable endpoints
    try {
      return await fetch(request);
    } catch (error) {
      // Return error response for failed mutations
      return new Response(
        JSON.stringify({ 
          error: 'Network unavailable', 
          offline: true,
          message: 'This operation requires an internet connection'
        }), 
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // For cacheable GET requests, try cache-first strategy
  if (isGET) {
    const isCacheable = CACHEABLE_API_PATTERNS.some(pattern => 
      pattern.test(url.pathname)
    );

    if (isCacheable) {
      try {
        // Try network first for fresh data
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
          // Cache successful response
          const cache = await caches.open(API_CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // Fallback to cache if network fails
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Add offline header to indicate stale data
          const response = cachedResponse.clone();
          response.headers.set('X-Served-From-Cache', 'true');
          return response;
        }
        
        // No cache available
        return new Response(
          JSON.stringify({ 
            error: 'Network unavailable', 
            offline: true,
            message: 'No cached data available'
          }), 
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  }

  // For non-cacheable requests, just try network
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Network unavailable', 
        offline: true 
      }), 
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleStaticRequest(request) {
  const url = new URL(request.url);
  
  // For navigation requests, try network first, fallback to cache
  if (request.mode === 'navigate') {
    try {
      const networkResponse = await fetch(request);
      return networkResponse;
    } catch (error) {
      // Fallback to cached index.html for SPA routing
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match('/');
      return cachedResponse || new Response('Offline', { status: 503 });
    }
  }

  // For other assets, try cache first
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  // If not in cache, try network and cache the result
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Handle background sync events
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'volumeviz-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  console.log('Performing background sync...');
  
  try {
    // Get all clients to notify them about sync
    const clients = await self.clients.matchAll();
    
    // Send message to clients to trigger sync
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_TRIGGERED',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Handle push notifications (for future enhancement)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  // TODO: Implement push notification handling
});

// Handle message events from clients
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'CACHE_STATUS_CHECK') {
    event.ports[0].postMessage({
      type: 'CACHE_STATUS_RESPONSE',
      cacheSize: getCacheSize()
    });
  }
});

async function getCacheSize() {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      totalSize += requests.length;
    }
    
    return totalSize;
  } catch (error) {
    return 0;
  }
}
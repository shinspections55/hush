const CACHE_NAME = 'hush-v7';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/lobby.html',
  '/silentdraft.html',
  '/rankings.html',
  '/styles.css',
  '/silentdraft.css',
  '/rankings.css',
  '/HUSHBKGD.png',
  '/scripts.js',
  '/dashboard.js',
  '/silentdraft.js',
  '/theme-utils.js',
  '/preferences.js',
  '/firebase-config.js',
  '/firebase-auth.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/socket.io/socket.io.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Caching static assets');
      // Cache each asset independently so one miss does not cancel the entire install.
      await Promise.all(
        STATIC_ASSETS.map(async (assetPath) => {
          try {
            await cache.add(assetPath);
          } catch (error) {
            console.warn('[Service Worker] Failed to cache asset:', assetPath, error);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip unsupported request mode/cache combo (can throw in service workers).
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Always let service worker scripts come from network path directly.
  if (url.pathname === '/service-worker.js' || url.pathname === '/sw-register.js') {
    return;
  }

  // For API calls, try network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log('[Service Worker] Serving from cache:', url.pathname);
              return cached;
            }
            return new Response(JSON.stringify({ error: 'offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // For core page assets, prefer network so style/script updates apply immediately.
  const isCorePageAsset =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    /\.(?:html|css|js)$/i.test(url.pathname);

  if (isCorePageAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            return caches.match(request, { ignoreSearch: true }).then((cachedIgnoreSearch) => {
              if (cachedIgnoreSearch) {
                return cachedIgnoreSearch;
              }

              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
              return new Response('Offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          });
        })
    );
    return;
  }

  // For static assets, use cache first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          // Network failed and not in exact cache lookup.
          // Retry cache lookup ignoring query params for versioned assets.
          return caches.match(request, { ignoreSearch: true }).then((cachedIgnoreSearch) => {
            if (cachedIgnoreSearch) {
              return cachedIgnoreSearch;
            }

            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
            return new Response('Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

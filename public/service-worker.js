// MVOC Malaysia Service Worker
const CACHE_NAME = 'mvoc-pwa-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // For Firestore API and Firebase services, bypass cache completely
  if (
    url.includes('firestore.googleapis.com') || 
    url.includes('identitytoolkit') || 
    url.includes('firebase') ||
    url.includes('googleapis.com')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 10 second timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout (10000ms)')), 10000);
      });

      // Network fetch promise
      const networkFetchPromise = (async () => {
        const response = await fetch(event.request);
        if (response && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      })();

      try {
        // Race the network fetch against the 10-second timeout
        const freshResponse = await Promise.race([networkFetchPromise, timeoutPromise]);
        return freshResponse;
      } catch (err) {
        console.warn(`[Service Worker] Network fallback/timeout triggered for of: ${url}. Error:`, err);

        // Retrieve from cache
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          console.log(`[Service Worker] Retreived cached asset fallback for: ${url}`);
          return cachedResponse;
        }

        // Handle offline scenario when both network and cache fail
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return new Response(
            '<div style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 48px; background: #0F2D52; color: white; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">' +
            '<h2 style="font-weight: 900; letter-spacing: -0.025em; margin-bottom: 8px;">Network Timed Out / Offline</h2>' +
            '<p style="color: rgba(255,255,255,0.7); max-width: 320px; font-size: 14px;">The connection took too long or you are offline, and this resource has not been cached yet.</p>' +
            '<button onclick="window.location.reload()" style="margin-top: 24px; padding: 10px 24px; border: none; background: #10B981; color: white; font-weight: 700; border-radius: 9999px; cursor: pointer;">Reload Page</button>' +
            '</div>',
            {
              headers: { 'Content-Type': 'text/html' }
            }
          );
        }

        return new Response('Asset not stored in cache and network could not be reached.', { status: 504, statusText: 'Gateway Timeout' });
      }
    })()
  );
});

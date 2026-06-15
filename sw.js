const CACHE_NAME = 'talbaktem-v11';
const STATIC_ASSETS = [
  './',
  '/index.html',
  '/firebase-config.js',
  '/manifest.json',
  '/offline.html',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/hero1.webp',
  '/hero2.webp',
  '/hero3.webp',
  '/cat-apt.webp',
  '/cat-car.webp',
  '/cat-equip.webp',
  '/cat-free.webp',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&family=Poppins:wght@200;300;400;700;800;900&family=Raleway:wght@200;300;400&display=swap'
];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Fetch - cache first for static, network first for API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  
  // Network first for Firebase/API calls
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis') || url.hostname.includes('cloudinary') || url.hostname.includes('workers.dev')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  
  // Cache first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Update cache in background
        fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(e.request, res));
        }).catch(() => {});
        return cached;
      }
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') {
          // Fallback to index.html for SPA routing or offline.html if completely offline
          return caches.match('/index.html') || caches.match('/offline.html');
        }
      });
    })
  );
});

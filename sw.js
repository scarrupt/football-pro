const CACHE_NAME = 'fpip-v16';

const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/constants.js',
  './js/utils.js',
  './js/badges.js',
  './js/notifications.js',
  './js/export.js',
  './js/pages/home.js',
  './js/pages/planner.js',
  './js/pages/log.js',
  './js/pages/progress.js',
  './js/pages/badges_page.js',
  './js/pages/player.js',
  './js/pages/match_watch.js',
  './icons/icon.svg',
  './u14_academy_sessions.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, toCache);
        });
        return response;
      }).catch(() => cached);
    })
  );
});

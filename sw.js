const version = '0.0.2';
const CACHE_NAME = 'paraboard-' + version;
const STATIC_FILES = ['/dist/bundle.js', '/index.html', '/style.css'];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(STATIC_FILES);
      })
      .catch(err => {
        console.error(err);
        return new Promise((resolve, reject) => {
          reject('ERROR: ' + err);
        });
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(getByNetworkFallingBackByCache(event.request));
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (CACHE_NAME !== cacheName && cacheName.startsWith('paraboard-')) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

const getByNetworkFallingBackByCache = (request, showAlert = false) => {
  return caches.open(CACHE_NAME).then(cache => {
    return fetch(request)
      .then(networkResponse => {
        cache.put(request, networkResponse.clone());
        return networkResponse;
      })
      .catch(() => {
        if (showAlert) {
          alert('You are in offline mode. The data may be outdated.');
        }

        return caches.match(request);
      });
  });
};

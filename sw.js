const CACHE = 'ommen-v2';

const files = [
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'icon-192x192.png',
  'icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(files))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {

  event.waitUntil(

    caches.keys().then(keys =>

      Promise.all(

        keys.map(key => {

          if (key !== CACHE) {
            return caches.delete(key);
          }

        })

      )

    )

  );

  self.clients.claim();

});

self.addEventListener('fetch', event => {

  event.respondWith(

    caches.match(event.request)
      .then(response => response || fetch(event.request))

  );

});

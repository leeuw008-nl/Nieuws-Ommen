// sw.js v305 FINAL - FIX #6 #7 #8 - push met titel + highlight + ECHT omlijnd + guard lege pushes
const CACHE_NAME = 'ommen-v305-final';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

// FIX #6: lege pushes negeren, FIX #7: titel tonen, FIX #8: ECHT rood omlijnd
self.addEventListener('push', function(event) {
  console.log('[SW v305] push ontvangen');
  let data = {};
  try {
    if (event.data) { data = event.data.json(); }
  } catch (e) {
    try { data = JSON.parse(event.data.text()); } catch (e2) { data = { title: event.data.text(), body: '', url: '' }; }
  }

  const hasValidLink = data.url && typeof data.url === 'string' && data.url.startsWith('http') && data.url.length > 10;
  const hasValidTitle = data.title && typeof data.title === 'string' && data.title.trim().length > 3;
  const isEcht = data.isEcht || data.type === 'echt' || data.source?.includes('ECHT');

  // #6 FIX: geen link en geen echtId = SKIP (nietszeggend bericht)
  if (!hasValidLink && !data.echtId) {
    console.log('[SW v305 #6] SKIP lege push zonder link', data);
    return;
  }

  const title = (data.title || (isEcht ? 'Belangrijk bericht' : 'Nieuw artikel')).slice(0, 100);
  const body = (data.body || data.description || '').slice(0, 150);

  // Deep-link: ?highlight= en ?echt= voor omlijnd weergave
  let appUrl = '/';
  if (data.echtId) {
    appUrl = `/?echt=${encodeURIComponent(data.echtId)}&highlight=${encodeURIComponent(data.echtId)}`;
  } else if (data.url) {
    appUrl = `/?highlight=${encodeURIComponent(data.url)}`;
  }

  const options = {
    body: body || (isEcht ? 'Tik om belangrijk bericht te lezen' : 'Nieuw artikel beschikbaar'),
    icon: data.icon || '/icon-192.png',
    badge: '/badge.png',
    data: {
      url: data.url || appUrl,
      appUrl: appUrl,
      echtId: data.echtId || null,
      isEcht: isEcht,
      source: data.source || '',
      title: data.title || ''
    },
    tag: data.url || data.echtId || title, // voorkomt dubbele notificaties
    renotify: false,
    requireInteraction: isEcht, // ECHT blijft staan tot geklikt
    vibrate: isEcht ? [300, 100, 300, 100, 300] : [200, 100, 200]
  };

  console.log('[SW v305] Toon push', title, data.url || data.echtId);

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const articleUrl = event.notification.data?.url;
  const appUrl = event.notification.data?.appUrl;
  const echtId = event.notification.data?.echtId;

  let urlToOpen = '/';
  if (appUrl) urlToOpen = appUrl;
  else if (echtId) urlToOpen = `/?echt=${encodeURIComponent(echtId)}&highlight=${encodeURIComponent(echtId)}`;
  else if (articleUrl) urlToOpen = `/?highlight=${encodeURIComponent(articleUrl)}`;

  console.log('[SW v305] click ->', urlToOpen);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data?.type === 'SET_FILTERS') {
    console.log('[SW v305] SET_FILTERS', event.data.sources);
  }
});

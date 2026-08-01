self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  console.log('PUSH ONTVANGEN', event);
  let data = { title: 'Test Ommen Nieuws ✅', body: 'Testmelding (fallback)', url: 'https://leeuw008-nl.github.io/Nieuws-Ommen/' };
  try {
    if (event.data) {
      const txt = event.data.text();
      console.log('Push data text:', txt);
      data = JSON.parse(txt);
    }
  } catch (err) {
    console.log('Push parse error, gebruik fallback', err);
  }
  
  const options = {
    body: data.body || 'Nieuw nieuws in Ommen',
    icon: 'https://leeuw008-nl.github.io/Nieuws-Ommen/icon-192x192.png',
    badge: 'https://leeuw008-nl.github.io/Nieuws-Ommen/icon-192x192.png',
    data: { url: data.url || '/' },
    vibrate: [200,100,200]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ommen Nieuws', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Service Worker MINIMAL - geen icon, geen badge, alleen titel+body - MOET werken
self.addEventListener('install', e => {
  console.log('MINIMAL SW install');
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  console.log('MINIMAL SW activate');
  e.waitUntil(self.clients.claim());
});
self.addEventListener('push', event => {
  console.log('MINIMAL PUSH event', event.data ? 'with data' : 'no data');
  let title = 'Nieuws Ommen';
  let body = 'Nieuw artikel';
  let url = './';
  try {
    if (event.data) {
      const text = event.data.text();
      console.log('PUSH text:', text);
      try {
        const data = JSON.parse(text);
        title = data.title || title;
        body = data.body || text || body;
        url = data.url || url;
        console.log('PUSH parsed', title, body);
      } catch {
        body = text || body;
      }
    }
  } catch (err) {
    console.error('PUSH parse error', err);
  }
  console.log('Showing notification', title, body);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      data: { url: url },
      tag: 'test-' + Date.now()
    }).then(() => console.log('showNotification OK')).catch(err => console.error('showNotification FAILED', err))
  );
});
self.addEventListener('notificationclick', event => {
  console.log('CLICK', event.notification.data);
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(clients.openWindow(url));
});

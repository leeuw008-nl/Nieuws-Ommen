// Service Worker v17 FINAL - ROBUUST met BRON weergave, geen externe icon
const VERSION = 'v17-FINAL-BRON';
const CACHE_NAME = 'nieuws-ommen-v17';

self.addEventListener('install', e => {
  console.log(`[SW ${VERSION}] Install`);
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  console.log(`[SW ${VERSION}] Activate`);
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  console.log(`[SW ${VERSION}] Push received`, event.data ? 'WITH data' : 'NO data');
  let title = 'Nieuws Ommen';
  let body = 'Nieuw artikel beschikbaar';
  let url = './';
  let source = 'Algemeen';
  let tag = 'ommen-' + Date.now();

  try {
    if (event.data) {
      const text = event.data.text();
      console.log(`[SW ${VERSION}] text:`, text.slice(0,300));
      try {
        const data = JSON.parse(text);
        title = data.title || title;
        body = data.body || body;
        url = data.url || url;
        source = data.source || source;
        tag = data.tag || tag;
        // Als source niet al in title zit, voeg toe
        if (source && source !== 'Algemeen' && !title.includes(source)) {
          title = `${source}: ${title}`;
        }
        console.log(`[SW ${VERSION}] parsed`, {title, body, source, url});
      } catch {
        // Plain text
        body = text;
        console.log(`[SW ${VERSION}] plain text body`, body.slice(0,100));
      }
    }
  } catch (err) {
    console.error(`[SW ${VERSION}] error`, err);
    title = 'Nieuws Ommen - Nieuw artikel';
    body = 'Er is nieuw nieuws uit Ommen!';
  }

  console.log(`[SW ${VERSION}] SHOWING`, title);
  const options = {
    body: body,
    data: { url: url, source: source },
    tag: tag,
    renotify: true,
    requireInteraction: false
    // GEEN icon/badge om CORS issues te vermijden - Chrome gebruikt dan default browser icon
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log(`[SW ${VERSION}] showNotification OK`))
      .catch(err => {
        console.error(`[SW ${VERSION}] showNotification FAILED`, err);
        // Fallback nog simpeler
        return self.registration.showNotification('Nieuws Ommen', { body: 'Nieuw artikel uit Ommen!', tag: tag });
      })
  );
});

self.addEventListener('notificationclick', event => {
  console.log(`[SW ${VERSION}] Click`, event.notification.data);
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener('notificationclose', event => {
  console.log(`[SW ${VERSION}] Closed`);
});

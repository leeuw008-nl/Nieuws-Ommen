self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'Nieuw Ommen nieuws!', body: 'Er is een nieuw artikel', url: '/' };
    event.waitUntil(self.registration.showNotification(data.title, {
        body: data.body,
        icon: './icon-192x192.png',
        data: { url: data.url || '/' }
    }));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow('/'));
});

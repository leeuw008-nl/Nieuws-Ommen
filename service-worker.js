// service-worker.js - plaats in root naast index.html
self.addEventListener('push', function(event) {
    let data = { title: 'Nieuw Ommen nieuws!', body: 'Er is een nieuw artikel', url: '/' };
    try { if(event.data) data = JSON.parse(event.data.text()); } catch(e){}
    
    const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: data.url },
        vibrate: [100, 50, 100],
        tag: 'ommen-nieuws'
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
});

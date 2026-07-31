// service-worker.js - voor Ommen Nieuws (GitHub Pages submap) - FIXED 31-07-2026
self.addEventListener('install', function(event) {
    self.skipWaiting();
    console.log('Ommen SW install #2367');
});

self.addEventListener('activate', function(event) {
    event.waitUntil(clients.claim());
    console.log('Ommen SW activate');
});

self.addEventListener('push', function(event) {
    console.log('Push ontvangen!', event);
    let data = { title: 'Nieuw Ommen nieuws!', body: 'Er is een nieuw artikel op Ommen Nieuws', url: './' };
    try { 
        if(event.data){
            const text = event.data.text();
            console.log('Push data:', text);
            if(text && text.startsWith('{')){
                const parsed = JSON.parse(text);
                data = {...data, ...parsed};
            } else if(text) {
                data.body = text;
            }
        } 
    } catch(e){
        console.log('Push parse fail, defaults', e);
    }
    
    const options = {
        body: data.body,
        icon: './icon-192x192.png',
        badge: './icon-192x192.png',
        data: { url: data.url || './' },
        vibrate: [100, 50, 100],
        tag: 'ommen-nieuws',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options).catch(err => {
            console.error('showNotification met icon failed:', err);
            // Fallback zonder icon
            return self.registration.showNotification(data.title, {
                body: data.body,
                data: { url: data.url || './' },
                tag: 'ommen-nieuws',
                vibrate: [100, 50, 100]
            });
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    let urlToOpen = event.notification.data?.url || './';
    if(urlToOpen === '/') urlToOpen = './';
    const fullUrl = new URL(urlToOpen, self.registration.scope).href;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url.includes('Nieuws-Ommen') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

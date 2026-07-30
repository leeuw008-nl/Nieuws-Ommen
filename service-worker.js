// service-worker.js - voor Ommen Nieuws (GitHub Pages submap)
self.addEventListener('push', function(event) {
    let data = { title: 'Nieuw Ommen nieuws!', body: 'Er is een nieuw artikel op Ommen Nieuws', url: './' };
    try { 
        if(event.data){
            const text = event.data.text();
            if(text && text.startsWith('{')){
                const parsed = JSON.parse(text);
                data = {...data, ...parsed};
            }
        } 
    } catch(e){}
    const options = {
        body: data.body,
        icon: './icon-192x192.png',
        badge: './icon-192x192.png',
        data: { url: data.url || './' },
        vibrate: [100, 50, 100],
        tag: 'ommen-nieuws',
        renotify: true
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
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

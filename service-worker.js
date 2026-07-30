// service-worker.js - voor Ommen Nieuws (GitHub Pages submap)
self.addEventListener('push', function(event) {
    // Worker stuurt nu zonder payload, dus we gebruiken defaults
    let data = { title: 'Nieuw Ommen nieuws!', body: 'Er is een nieuw artikel op Ommen Nieuws', url: './' };
    try { 
        if(event.data){
            const text = event.data.text();
            // probeer JSON, anders is het lege push
            if(text && text.startsWith('{')){
                const parsed = JSON.parse(text);
                data = {...data, ...parsed};
            }
        } 
    } catch(e){
        console.log('Push data parse failed, using defaults', e);
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
    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    // Fix voor GitHub Pages submap: gebruik scope of ./ 
    let urlToOpen = event.notification.data?.url || './';
    // Zorg dat we naar de juiste submap gaan
    if(urlToOpen === '/') urlToOpen = './';
    // Maak absolute URL binnen scope
    const fullUrl = new URL(urlToOpen, self.registration.scope).href;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Als site al open is, focus die tab
            for (let client of windowClients) {
                if (client.url.includes('Nieuws-Ommen') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Anders nieuwe tab openen
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});

self.addEventListener('notificationclose', function(event) {
    // optioneel: analytics
});

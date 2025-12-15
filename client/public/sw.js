console.log("Service Worker Loaded...");

self.addEventListener('push', e => {
    const data = e.data.json();
    console.log("Push Recieved...");
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/vite.svg' // Standard Vite icon for now
    });
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // If a window is already open, focus it.
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        return client.focus();
                    }
                }
                return client.focus();
            }
            // Otherwise, open a new window.
            return clients.openWindow('/');
        })
    );
});

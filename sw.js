/* ==========================================================================
   TaskQuest Service Worker (sw.js)
   ========================================================================== */

self.addEventListener('install', event => {
    // Force immediate activation
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // Claim control of all client tabs immediately
    event.waitUntil(self.clients.claim());
});

// Handle notification click events
self.addEventListener('notificationclick', event => {
    event.notification.close(); // Close the notification popup

    // Try to find an existing window/tab and focus it
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                // Check if the client matches our app's path
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no tab is open, open a new one
            if (self.clients.openWindow) {
                return self.clients.openWindow('/');
            }
        })
    );
});

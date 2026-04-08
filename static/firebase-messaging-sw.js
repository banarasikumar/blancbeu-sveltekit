// Firebase Cloud Messaging service worker.
// Registered explicitly at scope /firebase-cloud-messaging-push-scope
// (separate from VitePWA's SW at /).
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyC4jkARU5-Ohb5w71Bi9eXY3A4ozOidyro",
    authDomain: "blancbeu-60b2a.firebaseapp.com",
    projectId: "blancbeu-60b2a",
    storageBucket: "blancbeu-60b2a.firebasestorage.app",
    messagingSenderId: "344944570615",
    appId: "1:344944570615:web:fbc270a00f54fc152863f2",
    measurementId: "G-PJK4Y0R8RE"
});

const messaging = firebase.messaging();

// Primary handler — Firebase SDK routes background pushes here
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] onBackgroundMessage', payload);
    const title = payload.notification?.title || 'New Booking!';
    const icon = payload.data?.icon || '/pwa-192x192.png';
    return self.registration.showNotification(title, {
        body: payload.notification?.body || '',
        icon,
        badge: icon,
        tag: 'booking-notification',
        renotify: true,
        vibrate: [200, 100, 200],
        data: payload.data || {}
    });
});

// Fallback — catches pushes that Firebase SDK might not handle
// (e.g. if the compat SDK hasn't fully initialised in time)
self.addEventListener('push', (event) => {
    // Firebase SDK sets an internal flag when it handles the push.
    // If the notification is already shown by onBackgroundMessage, skip.
    if (event.__handled) return;

    console.log('[FCM-SW] push event fallback', event);
    let data = {};
    try { data = event.data?.json() || {}; } catch (e) { /* empty */ }

    const title = data.notification?.title || 'New Booking!';
    const body = data.notification?.body || '';
    const icon = data.data?.icon || '/pwa-192x192.png';

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge: icon,
            tag: 'booking-notification',
            renotify: true,
            vibrate: [200, 100, 200],
            data: data.data || {}
        })
    );
});

// Open the staff app when the notification is tapped
self.addEventListener('notificationclick', (event) => {
    console.log('[FCM-SW] notificationclick', event);
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Focus an existing staff tab if one is open
            for (const client of windowClients) {
                if (client.url.includes('/staff') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new tab
            return clients.openWindow('/staff/dashboard');
        })
    );
});

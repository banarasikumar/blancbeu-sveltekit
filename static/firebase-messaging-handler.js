// Firebase background message handler — imported into the VitePWA-generated service worker
// via workbox.importScripts in vite.config.ts.
// This replaces the standalone firebase-messaging-sw.js approach.

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

messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message', payload);
    const notificationTitle = payload.notification?.title || 'New Booking!';
    // Use icon sent with the message (data.icon), otherwise fall back to the generic app icon
    const icon = payload.data?.icon || '/pwa-192x192.png';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon,
        badge: icon,
        tag: 'booking-notification',
        renotify: true,
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

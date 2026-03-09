import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
const firebaseApp = initializeApp({
    apiKey: "AIzaSyC4jkARU5-Ohb5w71Bi9eXY3A4ozOidyro",
    authDomain: "blancbeu-60b2a.firebaseapp.com",
    projectId: "blancbeu-60b2a",
    storageBucket: "blancbeu-60b2a.firebasestorage.app",
    messagingSenderId: "344944570615",
    appId: "1:344944570615:web:fbc270a00f54fc152863f2",
    measurementId: "G-PJK4Y0R8RE"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/logo.png', // Or another appropriate icon
        badge: '/logo.png' // Or another appropriate icon
    };

    self.registration.showNotification(notificationTitle,
        notificationOptions);
});

import { browser } from '$app/environment';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '$lib/firebase';

/**
 * Request push notification permission for a logged-in user and save their FCM token.
 * Called after a successful booking so the user can receive status updates.
 * Returns true if permission was granted and token saved.
 */
export async function requestUserNotificationPermission(userId: string): Promise<boolean> {
    if (!browser || !('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;

    try {
        const { isSupported } = await import('firebase/messaging');
        const supported = await isSupported();
        if (!supported) return false;

        const { app } = await import('$lib/firebase');
        if (!app) return false;

        const { getMessaging, getToken } = await import('firebase/messaging');
        const msgInstance = getMessaging(app);

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        // Use the main VitePWA SW at / which now includes Firebase messaging.
        const swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const token = await getToken(msgInstance, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (token) {
            await setDoc(doc(db, 'users', userId), {
                fcmTokens: arrayUnion(token),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log('[UserNotifications] Token saved for user', userId);
            return true;
        }
        return false;
    } catch (err) {
        console.warn('[UserNotifications] Could not save token:', err);
        return false;
    }
}

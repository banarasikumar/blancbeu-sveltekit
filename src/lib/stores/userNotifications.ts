import { browser } from '$app/environment';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '$lib/firebase';

export interface NotificationResult {
    success: boolean;
    token?: string;
    error?: string;
    step?: string;
}

/**
 * Request push notification permission for a logged-in user and save their FCM token.
 * Called after a successful booking so the user can receive status updates.
 * Returns detailed result object with success status, token, and error info.
 */
export async function requestUserNotificationPermission(userId: string): Promise<NotificationResult> {
    console.log('[UserNotifications] Starting notification permission request for user:', userId);

    // Check browser environment
    if (!browser) {
        console.warn('[UserNotifications] Not in browser environment');
        return { success: false, error: 'Not in browser environment', step: 'browser_check' };
    }

    if (!('Notification' in window)) {
        console.warn('[UserNotifications] Notifications not supported in this browser');
        return { success: false, error: 'Notifications not supported', step: 'api_check' };
    }

    console.log('[UserNotifications] Notification permission status:', Notification.permission);

    if (Notification.permission === 'denied') {
        console.warn('[UserNotifications] Notification permission previously denied');
        return { success: false, error: 'Permission previously denied by user', step: 'permission_check' };
    }

    try {
        // Check if messaging is supported
        console.log('[UserNotifications] Checking Firebase messaging support...');
        const { isSupported } = await import('firebase/messaging');
        const supported = await isSupported();
        if (!supported) {
            console.warn('[UserNotifications] Firebase messaging not supported in this browser');
            return { success: false, error: 'Firebase messaging not supported', step: 'messaging_support' };
        }
        console.log('[UserNotifications] Firebase messaging is supported');

        // Get Firebase app
        console.log('[UserNotifications] Getting Firebase app...');
        const { app } = await import('$lib/firebase');
        if (!app) {
            console.error('[UserNotifications] Firebase app not initialized');
            return { success: false, error: 'Firebase app not initialized', step: 'firebase_app' };
        }
        console.log('[UserNotifications] Firebase app obtained');

        // Initialize messaging
        console.log('[UserNotifications] Initializing messaging...');
        const { getMessaging, getToken } = await import('firebase/messaging');
        const msgInstance = getMessaging(app);
        console.log('[UserNotifications] Messaging instance created');

        // Request permission
        console.log('[UserNotifications] Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('[UserNotifications] Permission result:', permission);

        if (permission !== 'granted') {
            console.warn('[UserNotifications] Permission not granted:', permission);
            return { success: false, error: `Permission ${permission}`, step: 'permission_request' };
        }

        // Wait for service worker
        console.log('[UserNotifications] Waiting for service worker...');
        const swRegistration = await navigator.serviceWorker.ready;
        console.log('[UserNotifications] Service worker ready, scope:', swRegistration.scope);

        // Get VAPID key
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error('[UserNotifications] VITE_FIREBASE_VAPID_KEY not configured');
            return { success: false, error: 'VAPID key not configured', step: 'vapid_key' };
        }
        console.log('[UserNotifications] VAPID key available (first 10 chars):', vapidKey.substring(0, 10) + '...');

        // Get FCM token
        console.log('[UserNotifications] Getting FCM token...');
        const token = await getToken(msgInstance, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            console.error('[UserNotifications] getToken returned null/undefined');
            return { success: false, error: 'Failed to get FCM token', step: 'get_token' };
        }

        console.log('[UserNotifications] FCM token obtained (first 20 chars):', token.substring(0, 20) + '...');

        // Save token to Firestore
        console.log('[UserNotifications] Saving token to Firestore for user:', userId);
        await setDoc(doc(db, 'users', userId), {
            fcmTokens: arrayUnion(token),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('[UserNotifications] SUCCESS: Token saved for user', userId);
        return { success: true, token: token, step: 'complete' };

    } catch (err: any) {
        console.error('[UserNotifications] ERROR in requestUserNotificationPermission:', err);
        console.error('[UserNotifications] Error stack:', err.stack);
        return {
            success: false,
            error: err.message || 'Unknown error',
            step: 'exception'
        };
    }
}

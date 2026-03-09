import { writable } from 'svelte/store';
import { getToken, type Messaging } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, messaging } from '$lib/firebase';

export type NotificationsState = 'default' | 'granted' | 'denied' | 'unsupported';

export const notificationStatus = writable<NotificationsState>('default');

export function checkNotificationStatus() {
    if (!('Notification' in window)) {
        notificationStatus.set('unsupported');
        return;
    }
    notificationStatus.set(Notification.permission as NotificationsState);
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('[Notifications] This browser does not support desktop notifications');
        return false;
    }

    try {
        if (!messaging) {
            console.warn('[Notifications] Messaging not supported or initialized');
            return false;
        }
        console.log('[Notifications] Requesting permission...');
        const permission = await Notification.requestPermission();
        notificationStatus.set(permission as NotificationsState);

        if (permission === 'granted') {
            console.log('[Notifications] Permission granted. Getting token...');
            // Get token
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
            });

            if (token) {
                console.log('[Notifications] Token received, saving to user profile');
                // Save token to user profile
                const userRef = doc(db, 'users', userId);
                // We store it as an array to support multiple devices in the future if needed
                await updateDoc(userRef, {
                    fcmTokens: [token],
                    updatedAt: new Date().toISOString()
                });
                return true;
            } else {
                console.warn('[Notifications] No registration token available.');
                return false;
            }
        } else {
            console.log('[Notifications] Permission not granted:', permission);
            return false;
        }
    } catch (error) {
        console.error('[Notifications] Error requesting permission:', error);
        return false;
    }
}

export async function disableNotifications(userId: string): Promise<boolean> {
    try {
        if (!messaging) return false;
        console.log('[Notifications] Disabling notifications for device...');

        // Get the current token
        const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
        });

        if (token) {
            // Remove token from Firestore
            const userRef = doc(db, 'users', userId);

            // Note: If you want to support multiple devices natively in the future, 
            // you should read the array, filter out this specific token, and update.
            // For now, replacing with empty array completely disables it for this user.
            await updateDoc(userRef, {
                fcmTokens: [],
                updatedAt: new Date().toISOString()
            });
            console.log('[Notifications] Token removed from database. Notifications disabled.');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Notifications] Error disabling notifications:', error);
        return false;
    }
}

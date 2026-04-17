import { writable } from 'svelte/store';
import { getToken, getMessaging, isSupported } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { browser } from '$app/environment';

// ---------------------------------------------------------------------------
// Sound preference — persisted in localStorage
// ---------------------------------------------------------------------------
const SOUND_PREF_KEY = 'blancbeu_staff_sound';
const SOUND_TYPE_KEY = 'blancbeu_staff_sound_type';
const CUSTOM_SOUND_KEY = 'blancbeu_staff_custom_sound';

export type SoundType = 'iphone' | 'livechat' | 'notification' | 'custom';

export const AVAILABLE_SOUNDS = [
	{ id: 'iphone' as SoundType, name: 'iPhone', path: '/sounds/Iphone.mp3' },
	{ id: 'livechat' as SoundType, name: 'Live Chat', path: '/sounds/livechat.mp3' },
	{ id: 'notification' as SoundType, name: 'Notification', path: '/sounds/notification.mp3' }
];

function createSoundStore() {
	const initial = browser ? localStorage.getItem(SOUND_PREF_KEY) !== 'false' : true;
	const { subscribe, set, update } = writable<boolean>(initial);
	return {
		subscribe,
		toggle() {
			update((v) => {
				const next = !v;
				if (browser) localStorage.setItem(SOUND_PREF_KEY, String(next));
				return next;
			});
		},
		set(val: boolean) {
			set(val);
			if (browser) localStorage.setItem(SOUND_PREF_KEY, String(val));
		}
	};
}

function createSoundTypeStore() {
	const initial: SoundType = browser 
		? (localStorage.getItem(SOUND_TYPE_KEY) as SoundType) || 'iphone'
		: 'iphone';
	const { subscribe, set } = writable<SoundType>(initial);
	
	return {
		subscribe,
		set(type: SoundType) {
			if (browser) localStorage.setItem(SOUND_TYPE_KEY, type);
			set(type);
		},
		getCurrentSound(): { type: SoundType; path: string } {
			const currentType = browser 
				? (localStorage.getItem(SOUND_TYPE_KEY) as SoundType) || 'iphone'
				: 'iphone';
			
			if (currentType === 'custom') {
				const customPath = browser ? localStorage.getItem(CUSTOM_SOUND_KEY) : null;
				return { type: 'custom', path: customPath || AVAILABLE_SOUNDS[0].path };
			}
			
			const sound = AVAILABLE_SOUNDS.find(s => s.id === currentType);
			return { type: currentType, path: sound?.path || AVAILABLE_SOUNDS[0].path };
		}
	};
}

function createCustomSoundStore() {
	const initial = browser ? localStorage.getItem(CUSTOM_SOUND_KEY) || '' : '';
	const { subscribe, set } = writable<string>(initial);
	
	return {
		subscribe,
		set(path: string) {
			if (browser) localStorage.setItem(CUSTOM_SOUND_KEY, path);
			set(path);
		},
		clear() {
			if (browser) localStorage.removeItem(CUSTOM_SOUND_KEY);
			set('');
		}
	};
}

export const soundEnabled = createSoundStore();
export const selectedSoundType = createSoundTypeStore();
export const customSoundPath = createCustomSoundStore();

export type NotificationsState = 'default' | 'granted' | 'denied' | 'unsupported';

export const notificationStatus = writable<NotificationsState>('default');

// ── Persistent "Listening for orders" notification ──
// Keeps a silent ongoing notification in the Android tray so the OS is less
// likely to kill the browser process when the app is swiped from recents.
export async function showListeningNotification() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') {
        console.log('[Notifications] Skipping persistent notification — permission not granted');
        return;
    }
    try {
        console.log('[Notifications] Waiting for service worker...');
        const reg = await navigator.serviceWorker.ready;
        console.log('[Notifications] SW ready, checking existing notifications...');
        const existing = await reg.getNotifications({ tag: 'staff-listening' });
        if (existing.length > 0) {
            console.log('[Notifications] Persistent notification already showing');
            return;
        }
        await reg.showNotification('BStaff — Listening for orders', {
            tag: 'staff-listening',
            body: 'You will be notified of new bookings',
            icon: '/staff-icon-192.png',
            badge: '/staff-icon-192.png',
            requireInteraction: true,
            data: { type: 'staff-listening' }
        });
        console.log('[Notifications] Persistent listening notification shown');
    } catch (e) {
        console.warn('[Notifications] Could not show listening notification:', e);
    }
}

export async function closeListeningNotification() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        const notifs = await reg.getNotifications({ tag: 'staff-listening' });
        notifs.forEach((n: Notification) => n.close());
    } catch (e) { /* ignore */ }
}

export function checkNotificationStatus() {
    if (!('Notification' in window)) {
        notificationStatus.set('unsupported');
        return;
    }
    notificationStatus.set(Notification.permission as NotificationsState);
}

export interface StaffNotificationResult {
    success: boolean;
    token?: string;
    error?: string;
    step?: string;
}

export async function requestNotificationPermission(userId: string): Promise<StaffNotificationResult> {
    console.log('[StaffNotifications] Starting permission request for user:', userId);

    if (!browser) {
        console.warn('[StaffNotifications] Not in browser environment');
        return { success: false, error: 'Not in browser', step: 'browser_check' };
    }

    if (!('Notification' in window)) {
        console.warn('[StaffNotifications] This browser does not support desktop notifications');
        return { success: false, error: 'Browser does not support notifications', step: 'api_check' };
    }

    try {
        // Initialize messaging here directly — the module-level export is set
        // asynchronously and may still be null when this function is called.
        console.log('[StaffNotifications] Checking messaging support...');
        const supported = await isSupported();
        if (!supported) {
            console.warn('[StaffNotifications] Messaging not supported in this browser');
            return { success: false, error: 'Messaging not supported', step: 'messaging_support' };
        }
        console.log('[StaffNotifications] Messaging is supported');

        const { app } = await import('$lib/firebase');
        if (!app) {
            console.error('[StaffNotifications] Firebase app not initialized');
            return { success: false, error: 'Firebase not initialized', step: 'firebase_app' };
        }
        console.log('[StaffNotifications] Firebase app obtained');

        const msgInstance = getMessaging(app);
        console.log('[StaffNotifications] Messaging instance created');

        console.log('[StaffNotifications] Requesting permission...');
        const permission = await Notification.requestPermission();
        notificationStatus.set(permission as NotificationsState);
        console.log('[StaffNotifications] Permission result:', permission);

        if (permission !== 'granted') {
            console.warn('[StaffNotifications] Permission not granted:', permission);
            return { success: false, error: `Permission ${permission}`, step: 'permission_request' };
        }

        console.log('[StaffNotifications] Permission granted. Getting token...');
        const swRegistration = await navigator.serviceWorker.ready;
        console.log('[StaffNotifications] Using active SW, scope:', swRegistration.scope);

        // Get VAPID key
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.error('[StaffNotifications] VITE_FIREBASE_VAPID_KEY not configured');
            return { success: false, error: 'VAPID key not configured', step: 'vapid_key' };
        }
        console.log('[StaffNotifications] VAPID key available');

        const token = await getToken(msgInstance, {
            vapidKey: vapidKey,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            console.warn('[StaffNotifications] No registration token available from getToken');
            return { success: false, error: 'Failed to get FCM token', step: 'get_token' };
        }

        console.log('[StaffNotifications] Token received (first 20 chars):', token.substring(0, 20) + '...');
        console.log('[StaffNotifications] Saving token to user profile for user:', userId);

        // Save token to user profile
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            fcmTokens: arrayUnion(token),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('[StaffNotifications] SUCCESS: Token saved for user', userId);

        // Now that permission is granted, show the persistent notification
        showListeningNotification();

        return { success: true, token: token, step: 'complete' };

    } catch (error: any) {
        console.error('[StaffNotifications] Error requesting permission:', error);
        console.error('[StaffNotifications] Error stack:', error.stack);
        return { success: false, error: error.message || 'Unknown error', step: 'exception' };
    }
}

export async function disableNotifications(userId: string): Promise<boolean> {
    try {
        console.log('[Notifications] Disabling notifications for device...');
        // Clearing fcmTokens in Firestore is sufficient to stop receiving pushes.
        // We do NOT depend on getToken() here — it can fail (messaging uninitialized,
        // VAPID issue, SW error) and would silently leave tokens in the database.
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            fcmTokens: [],
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[Notifications] Tokens cleared. Notifications disabled.');
        return true;
    } catch (error) {
        console.error('[Notifications] Error disabling notifications:', error);
        return false;
    }
}

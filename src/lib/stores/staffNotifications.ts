import { writable } from 'svelte/store';
import { getToken, type Messaging } from 'firebase/messaging';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db, messaging } from '$lib/firebase';
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
            // Use the already-active VitePWA SW — do not re-register manually.
            // Re-registering sw.js causes getToken to fail on second enable.
            const swRegistration = await navigator.serviceWorker.ready;
            console.log('[Notifications] Using active SW, scope:', swRegistration.scope);
            const token = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: swRegistration
            });

            if (token) {
                console.log('[Notifications] Token received, saving to user profile');
                // Save token to user profile
                const userRef = doc(db, 'users', userId);
                // We store it as an array to support multiple devices in the future if needed
                await setDoc(userRef, {
                    fcmTokens: arrayUnion(token),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                // Now that permission is granted, show the persistent notification
                showListeningNotification();
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

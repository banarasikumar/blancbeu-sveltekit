import { writable, get } from 'svelte/store';
import { getToken, getMessaging, isSupported } from 'firebase/messaging';
import { doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

// ---------------------------------------------------------------------------
// Per-app push enabled state — persisted in Firestore at account level
// ---------------------------------------------------------------------------
// These flags are stored on the user document as `staffPushEnabled` / `adminPushEnabled`.
// They allow each app to independently enable/disable push notifications without
// affecting the other app, even when both apps share the same Firebase user.

export const staffPushEnabled = writable<boolean>(true);
export const adminPushEnabled = writable<boolean>(true);

// Track which app context we're in, set during loadPushEnabled
let _currentAppContext: 'staff' | 'admin' = 'staff';

/**
 * Load the push enabled state for a specific app from local device storage.
 * Call this on mount in the respective app's settings/profile page.
 */
export async function loadPushEnabled(userId: string, appType: 'staff' | 'admin'): Promise<boolean> {
    _currentAppContext = appType;
    if (!browser) return true;
    
    try {
        const key = `blancbeu_${appType}_push_enabled`;
        const stored = localStorage.getItem(key);
        // Default to true if never set
        const enabled = stored !== 'false';
        
        if (appType === 'admin') {
            adminPushEnabled.set(enabled);
        } else {
            staffPushEnabled.set(enabled);
        }
        return enabled;
    } catch (e) {
        console.error(`[Notifications] Failed to load ${appType} push enabled state:`, e);
    }
    return true; // default to enabled
}

/**
 * Save the push enabled state for a specific app to local device storage.
 */
export async function savePushEnabled(userId: string, appType: 'staff' | 'admin', enabled: boolean): Promise<boolean> {
    if (!browser) return false;
    
    try {
        const key = `blancbeu_${appType}_push_enabled`;
        localStorage.setItem(key, enabled.toString());
        
        if (appType === 'admin') {
            adminPushEnabled.set(enabled);
        } else {
            staffPushEnabled.set(enabled);
        }
        console.log(`[Notifications] Saved ${appType} push enabled locally = ${enabled}`);
        return true;
    } catch (e) {
        console.error(`[Notifications] Failed to save ${appType} push enabled locally:`, e);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Sound preference — persisted in localStorage
// ---------------------------------------------------------------------------
const SOUND_PREF_KEY = 'blancbeu_staff_sound';
const SOUND_TYPE_KEY = 'blancbeu_staff_sound_type';

export type SoundType = 'default' | 'iphone' | 'livechat' | 'notification';

export const AVAILABLE_SOUNDS = [
	{ id: 'default' as SoundType, name: 'System Default', path: '' },
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
		? (localStorage.getItem(SOUND_TYPE_KEY) as SoundType) || 'default'
		: 'default';
	const { subscribe, set } = writable<SoundType>(initial);
	
	return {
		subscribe,
		set(type: SoundType) {
			if (browser) localStorage.setItem(SOUND_TYPE_KEY, type);
			set(type);
		},
		getCurrentSound(): { type: SoundType; path: string } {
			const currentType = browser 
				? (localStorage.getItem(SOUND_TYPE_KEY) as SoundType) || 'default'
				: 'default';
			
			const sound = AVAILABLE_SOUNDS.find(s => s.id === currentType);
			return { type: currentType, path: sound?.path || AVAILABLE_SOUNDS[0].path };
		}
	};
}

export const soundEnabled = createSoundStore();
export const selectedSoundType = createSoundTypeStore();

export async function savePreferredSound(userId: string, type: SoundType) {
    selectedSoundType.set(type);
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            preferredSound: type,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[StaffNotifications] Saved preferred sound to Firestore:', type);
    } catch (e) {
        console.error('[StaffNotifications] Failed to save preferred sound to Firestore:', e);
    }
}

export async function ensureNotificationChannels() {
    if (!Capacitor.isNativePlatform()) return;
    try {
        const channels = AVAILABLE_SOUNDS.map(s => ({
            id: `sound_${s.id}`,
            name: `Bookings (${s.name})`,
            description: `Notifications with ${s.name} sound`,
            importance: 5,
            visibility: 1,
            sound: s.id,
            vibration: true,
        }));
        channels.push({
            id: 'bookings',
            name: 'Bookings (Default)',
            description: 'Default booking notifications',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true,
        });

        for (const ch of channels) {
            await PushNotifications.createChannel(ch as any);
        }
        console.log('[StaffNotifications] Created native notification channels');
    } catch (e) {
        console.error('[StaffNotifications] Failed to create channels:', e);
    }
}

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

/**
 * Check notification status, combining OS permission with per-app Firestore flag.
 * If the user has opted out at the app level (Firestore flag = false), we report
 * 'default' (i.e. "off") even if the OS permission is 'granted'.
 */
export async function checkNotificationStatus(userId?: string, appType?: 'staff' | 'admin') {
    // If userId and appType provided, load the Firestore push enabled state
    if (userId && appType) {
        const enabled = await loadPushEnabled(userId, appType);
        if (!enabled) {
            // User has explicitly disabled push for this app — show as "off"
            notificationStatus.set('default');
            return;
        }
    }

    if (Capacitor.isNativePlatform()) {
        try {
            await ensureNotificationChannels();
            const permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'granted') {
                notificationStatus.set('granted');
            } else if (permStatus.receive === 'denied') {
                notificationStatus.set('denied');
            } else {
                notificationStatus.set('default');
            }
        } catch (e) {
            notificationStatus.set('unsupported');
        }
        return;
    }

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

export async function requestNotificationPermission(userId: string, appType: 'staff' | 'admin' = _currentAppContext): Promise<StaffNotificationResult> {
    console.log(`[StaffNotifications] Starting permission request for user: ${userId} (app: ${appType})`);
    _currentAppContext = appType;

    if (Capacitor.isNativePlatform()) {
        try {
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }
            if (permStatus.receive !== 'granted') {
                notificationStatus.set('denied');
                return { success: false, error: 'Permission denied', step: 'permission_request' };
            }
            
            notificationStatus.set('granted');
            await PushNotifications.register();
            
            return new Promise((resolve) => {
                let resolved = false;
                
                const regListener = PushNotifications.addListener('registration', async (token) => {
                    if (resolved) return;
                    resolved = true;
                    regListener.then(l => l.remove());
                    errListener.then(l => l.remove());
                    
                    console.log('[StaffNotifications] Native push registration success, token:', token.value);
                    try {
                        const userRef = doc(db, 'users', userId);
                        const tokenField = appType === 'admin' ? 'adminFcmTokens' : 'staffFcmTokens';
                        
                        if (typeof window !== 'undefined') {
                            localStorage.setItem(`blancbeu_${appType}_current_token`, token.value);
                        }

                        await setDoc(userRef, {
                            fcmTokens: arrayUnion(token.value),
                            [tokenField]: arrayUnion(token.value),
                            updatedAt: new Date().toISOString()
                        }, { merge: true });
                        // Also mark push as enabled for this app in Firestore
                        await savePushEnabled(userId, appType, true);
                        resolve({ success: true, token: token.value, step: 'complete' });
                    } catch (err: any) {
                        resolve({ success: false, error: err.message, step: 'save_token' });
                    }
                });

                const errListener = PushNotifications.addListener('registrationError', (error: any) => {
                    if (resolved) return;
                    resolved = true;
                    regListener.then(l => l.remove());
                    errListener.then(l => l.remove());
                    resolve({ success: false, error: error.error, step: 'registration' });
                });
                
                setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    regListener.then(l => l.remove());
                    errListener.then(l => l.remove());
                    resolve({ success: false, error: 'Registration timeout', step: 'registration' });
                }, 10000);
            });
        } catch (e: any) {
             console.error('[StaffNotifications] Error in native push request:', e);
             return { success: false, error: e.message, step: 'exception' };
        }
    }

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
        const tokenField = appType === 'admin' ? 'adminFcmTokens' : 'staffFcmTokens';
        
        if (typeof window !== 'undefined') {
            localStorage.setItem(`blancbeu_${appType}_current_token`, token);
        }

        await setDoc(userRef, {
            fcmTokens: arrayUnion(token),
            [tokenField]: arrayUnion(token),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Also mark push as enabled for this app in Firestore
        await savePushEnabled(userId, appType, true);

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

/**
 * Disable notifications for a specific app instance.
 * Sets the local preference to false and removes the current device's FCM token from Firestore.
 */
export async function disableNotifications(userId: string, appType: 'staff' | 'admin' = _currentAppContext): Promise<boolean> {
    try {
        console.log(`[Notifications] Disabling ${appType} notifications for this device...`);
        const success = await savePushEnabled(userId, appType, false);
        if (!success) return false;
        
        // Remove the token from Firestore so the server stops sending to this device
        if (browser) {
            const { removeToken } = await import('$lib/capacitor/pushService');
            await removeToken(userId, appType);
            
            if (Capacitor.isNativePlatform()) {
                await PushNotifications.removeAllListeners();
            }
        }
        
        notificationStatus.set('default');
        console.log(`[Notifications] ${appType} notifications disabled for this device.`);
        return true;
    } catch (error) {
        console.error('[Notifications] Error disabling notifications:', error);
        return false;
    }
}

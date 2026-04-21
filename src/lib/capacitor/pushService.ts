/**
 * pushService.ts — Unified push notification bridge for Blancbeu.
 *
 * Strategy:
 *   • If running inside the Capacitor native APK  → use @capacitor/push-notifications
 *     which routes through Google Play Services (FCM) for rock-solid delivery.
 *   • If running in the browser (PWA)              → fall back to firebase/messaging
 *     (existing behaviour, unchanged).
 *
 * Callers only need to call:
 *   const stop = await initPush(userId, onForegroundMessage);
 *   // later:
 *   stop();
 */

import type { MessagePayload } from 'firebase/messaging';

// Capacitor is a global that exists inside the native shell WebView.
// In a plain browser it is undefined, so we guard with a runtime check.
function isNative(): boolean {
	try {
		// @ts-ignore — Capacitor is injected by the native shell
		return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
	} catch {
		return false;
	}
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushMessage {
	title: string;
	body: string;
	data?: Record<string, string>;
}

type ForegroundHandler = (msg: PushMessage) => void;
type Unsubscribe = () => void;

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Persist a push token to Firestore under the authenticated user document.
 * We tag each token with its platform so the backend can target them correctly.
 */
async function saveToken(
	userId: string,
	token: string,
	platform: 'web' | 'android'
): Promise<void> {
	const { doc, setDoc, arrayUnion } = await import('firebase/firestore');
	const { db } = await import('$lib/firebase');

	// Store the token in the same fcmTokens array field on the user document
	// that notifyStaff/+server.ts and broadcast/+server.ts read from.
	const userRef = doc(db, 'users', userId);
	await setDoc(
		userRef,
		{
			fcmTokens: arrayUnion(token),
			fcmPlatform: platform,
			updatedAt: new Date().toISOString()
		},
		{ merge: true }
	);
}

// ─── Native path (Capacitor + FCM via Google Play Services) ──────────────────

async function initNativePush(userId: string, onMessage: ForegroundHandler): Promise<Unsubscribe> {
	// Dynamic import — this package only exists in the native build context.
	const { PushNotifications } = await import('@capacitor/push-notifications');

	// ── Track app foreground/background state ──────────────────────────
	// When the app is in the background, the OS handles push display via
	// Google Play Services (with system sound). When the app comes back to
	// foreground, Capacitor may fire pushNotificationReceived for the same
	// message. We suppress the duplicate by tracking state transitions.
	let isAppInForeground = true;
	let lastResumedAt = Date.now();
	let appStateListener: { remove: () => void } | null = null;

	try {
		const { App } = await import('@capacitor/app');
		const state = await App.getState();
		isAppInForeground = state.isActive;
		lastResumedAt = Date.now();

		const handle = await App.addListener('appStateChange', (state) => {
			if (state.isActive) {
				// App just came to foreground — mark the time so we can
				// ignore push events that arrive within a brief window
				// (these are OS-delivered background notifications being
				// re-delivered to the WebView).
				lastResumedAt = Date.now();
				isAppInForeground = true;
			} else {
				isAppInForeground = false;
			}
		});
		appStateListener = handle;
	} catch (e) {
		console.warn('[PushService] Could not track app state:', e);
	}

	// 1. Request OS-level permission
	const permResult = await PushNotifications.requestPermissions();
	if (permResult.receive !== 'granted') {
		console.warn('[PushService] Native push permission denied');
		return () => {};
	}

	// 2. Create the explicit Android Notification Channels for background OS handling
	try {
		await PushNotifications.createChannel({
			id: 'bookings',
			name: 'Core Notifications',
			description: 'General system updates and notifications',
			importance: 5, // 5 = MAXIMUM (High priority, shows on screen)
			visibility: 1, // 1 = PUBLIC (Show on lockscreen)
			vibration: true
		});
		await PushNotifications.createChannel({
			id: 'general',
			name: 'Broadcasts',
			description: 'System-wide broadcasts and announcements',
			importance: 4, // 4 = HIGH
			visibility: 1,
			vibration: true
		});
		console.log('[PushService] Android Notification Channels successfully verified.');
	} catch (e) {
		console.warn('[PushService] Could not create explicit notification channels:', e);
	}

	// 3. Register with FCM — triggers the 'registration' event below
	await PushNotifications.register();

	// 3. Persist the FCM device token when we receive it
	const regListener = await PushNotifications.addListener('registration', async (token) => {
		console.log('[PushService] Native FCM token:', token.value);
		await saveToken(userId, token.value, 'android');
	});

	// 4. Handle token errors
	const errListener = await PushNotifications.addListener('registrationError', (err) => {
		console.error('[PushService] Native FCM registration error:', err);
	});

	// 5. Handle foreground push messages (app is open)
	//    IMPORTANT: Only fire onMessage if the app was genuinely in the foreground
	//    when the push arrived. If the app just resumed from background (within
	//    the last 2 seconds), suppress the handler to avoid duplicate sounds.
	const fgListener = await PushNotifications.addListener(
		'pushNotificationReceived',
		(notification) => {
			const timeSinceResume = Date.now() - lastResumedAt;

			// If the app is not in foreground, or just resumed within 6 seconds,
			// this is a background-delivered notification being re-fired — suppress it.
			if (!isAppInForeground || timeSinceResume < 6000) {
				console.log(
					'[PushService] Suppressing duplicate foreground handler (bg→fg transition)',
					{ isAppInForeground, timeSinceResume }
				);
				return;
			}

			onMessage({
				title: notification.title ?? 'New Booking!',
				body: notification.body ?? '',
				data: notification.data as Record<string, string>
			});
		}
	);

	// 6. Handle notification tap (background / closed → app opens)
	const tapListener = await PushNotifications.addListener(
		'pushNotificationActionPerformed',
		(action) => {
			const data = action.notification.data as Record<string, string> | undefined;
			// Navigate to relevant screen if a route is provided in the payload
			if (data?.route) {
				import('$app/navigation').then(({ goto }) => goto(data.route));
			}
		}
	);

	// Return cleanup function
	return () => {
		regListener.remove();
		errListener.remove();
		fgListener.remove();
		tapListener.remove();
		if (appStateListener) appStateListener.remove();
	};
}

// ─── Web / PWA path (Firebase Messaging via browser push API) ─────────────────

async function initWebPush(userId: string, onMessage: ForegroundHandler): Promise<Unsubscribe> {
	const { isSupported, getMessaging, getToken, onMessage: onFCMMessage } = await import(
		'firebase/messaging'
	);
	const supported = await isSupported();
	if (!supported) {
		console.warn('[PushService] Web push not supported in this browser');
		return () => {};
	}

	const { app } = await import('$lib/firebase');
	if (!app) return () => {};

	const messaging = getMessaging(app);

	// Request a web FCM token using the VAPID key from env
	try {
		const token = await getToken(messaging, {
			vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
			serviceWorkerRegistration: await navigator.serviceWorker.ready
		});
		if (token) {
			await saveToken(userId, token, 'web');
		}
	} catch (err) {
		console.error('[PushService] Web token error:', err);
	}

	// Listen for foreground messages (background is handled by sw.ts)
	const unsub = onFCMMessage(messaging, (payload: MessagePayload) => {
		onMessage({
			title: payload.notification?.title ?? 'New Booking!',
			body: payload.notification?.body ?? '',
			data: payload.data as Record<string, string>
		});
	});

	return unsub;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize push notifications for the given user.
 *
 * @param userId  - Firebase Auth UID
 * @param onMessage - Callback for foreground messages (show toast / sound)
 * @returns Unsubscribe function — call in onDestroy()
 */
export async function initPush(userId: string, onMessage: ForegroundHandler): Promise<Unsubscribe> {
	if (isNative()) {
		console.log('[PushService] Running in native Capacitor shell → using FCM native path');
		return initNativePush(userId, onMessage);
	} else {
		console.log('[PushService] Running in browser → using FCM web push path');
		return initWebPush(userId, onMessage);
	}
}

/**
 * Returns true if we are running inside the Capacitor native app.
 * Useful for hiding/showing PWA-specific UI (e.g. install prompt).
 */
export { isNative };

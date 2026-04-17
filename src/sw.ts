/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

// ── Firebase Messaging — background push handler ──────────────────────
// firebase/messaging/sw is the correct SW entry point for Firebase v9+ modular SDK.
// It intercepts the push event internally and routes background messages here.
const firebaseApp = initializeApp({
	apiKey: 'AIzaSyC4jkARU5-Ohb5w71Bi9eXY3A4ozOidyro',
	authDomain: 'blancbeu-60b2a.firebaseapp.com',
	projectId: 'blancbeu-60b2a',
	storageBucket: 'blancbeu-60b2a.firebasestorage.app',
	messagingSenderId: '344944570615',
	appId: '1:344944570615:web:fbc270a00f54fc152863f2'
});

const swMessaging = getMessaging(firebaseApp);

async function hasActiveAppClient(): Promise<boolean> {
	const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	return clients.some((client) => {
		try {
			const url = new URL(client.url);
			return (
				url.pathname.startsWith('/admin') ||
				url.pathname.startsWith('/staff') ||
				url.pathname.startsWith('/you')
			);
		} catch {
			return false;
		}
	});
}

onBackgroundMessage(swMessaging, async (payload) => {
	// Guard: if running inside the Capacitor native APK, the OS handles push
	// delivery via Google Play Services. We must not duplicate it here.
	// Capacitor injects the global object into the WebView at runtime.
	try {
		// @ts-ignore
		if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) return;
	} catch {
		// Not in Capacitor — continue normally
	}

	// If an app tab is already open, do not spam system notifications.
	// The UI can handle real-time updates/toasts in-app.
	if (await hasActiveAppClient()) return;

	const title = payload.notification?.title ?? 'New Booking!';
	const body = payload.notification?.body ?? '';
	const icon = (payload.data?.['icon'] as string | undefined) ?? '/staff-icon-192.png';
	self.registration.showNotification(title, {
		body,
		icon,
		badge: icon,
		tag: 'booking-notification',
		renotify: true,
		vibrate: [200, 100, 200],
		data: payload.data ?? {}
	} as NotificationOptions);
});


// ── Lifecycle ────────────────────────────────────────────────
self.skipWaiting();
self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// ── Precache static build assets (manifest injected by VitePWA) ──
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime Caching Strategies ───────────────────────────────

// 1. Navigation requests (HTML pages) — NetworkFirst, 3 s timeout
//    First online visit caches the server-rendered HTML.
//    Subsequent offline visits serve the cached HTML instantly.
//    Combined with Firestore's persistent cache, the full dashboard renders offline.
registerRoute(
	new NavigationRoute(
		new NetworkFirst({
			cacheName: 'pages-cache',
			networkTimeoutSeconds: 3,
			plugins: [
				new CacheableResponsePlugin({ statuses: [0, 200] }),
				new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })
			]
		})
	)
);

// 2. Google Fonts stylesheets — StaleWhileRevalidate (CSS changes rarely)
registerRoute(
	/^https:\/\/fonts\.googleapis\.com\/.*/i,
	new StaleWhileRevalidate({
		cacheName: 'google-fonts-stylesheets',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 })
		]
	})
);

// 3. Google Fonts webfont files — CacheFirst (immutable font binaries)
registerRoute(
	/^https:\/\/fonts\.gstatic\.com\/.*/i,
	new CacheFirst({
		cacheName: 'google-fonts-webfonts',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 })
		]
	})
);

// 4. Firebase Storage images — CacheFirst
registerRoute(
	/^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
	new CacheFirst({
		cacheName: 'firebase-storage-cache',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })
		]
	})
);

// 5. All other images — CacheFirst
registerRoute(
	({ request }) => request.destination === 'image',
	new CacheFirst({
		cacheName: 'images-cache',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })
		]
	})
);

// 6. JS & CSS from external CDNs — StaleWhileRevalidate
registerRoute(
	({ url, request }) =>
		url.origin !== self.location.origin &&
		(request.destination === 'script' || request.destination === 'style'),
	new StaleWhileRevalidate({
		cacheName: 'cdn-resources',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 })
		]
	})
);

// 7. Audio files (notification sounds) — CacheFirst
registerRoute(
	({ request, url }) => request.destination === 'audio' || /\.mp3$/i.test(url.pathname),
	new CacheFirst({
		cacheName: 'audio-cache',
		plugins: [
			new CacheableResponsePlugin({ statuses: [0, 200] }),
			new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 90 * 24 * 60 * 60 })
		]
	})
);

// ── Persistent "Listening for orders" notification click handler ──
self.addEventListener('notificationclick', (event) => {
	const data = event.notification.data;

	// Persistent listening notification — open/focus dashboard, keep notification alive
	if (data?.type === 'staff-listening') {
		event.waitUntil(
			self.clients
				.matchAll({ type: 'window', includeUncontrolled: true })
				.then((windowClients) => {
					for (const client of windowClients) {
						if (client.url.includes('/staff') && 'focus' in client) {
							return client.focus();
						}
					}
					return self.clients.openWindow('/staff/dashboard');
				})
		);
		return;
	}
});

/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// ── FCM background push handler ─────────────────────────────
// Handles push events when the app tab is closed or the PWA is killed.
// We parse the FCM payload manually — no Firebase SDK needed in the SW.
self.addEventListener('push', (event) => {
	let payload: any = {};
	try { payload = event.data?.json() ?? {}; } catch { /* ignore */ }

	// FCM wraps the message under notification + data keys
	const title = payload.notification?.title
		?? payload.data?.title
		?? 'New Booking!';
	const body = payload.notification?.body
		?? payload.data?.body
		?? '';
	const icon = payload.data?.icon ?? '/staff-icon-192.png';

	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			icon,
			badge: icon,
			tag: 'booking-notification',
			renotify: true,
			vibrate: [200, 100, 200],
			data: payload.data ?? {}
		} as NotificationOptions)
	);
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

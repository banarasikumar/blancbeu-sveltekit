<script lang="ts">
	import '$lib/styles/admin.css';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		adminAuthState,
		adminUser,
		initAdminAuth,
		destroyAdminAuth
	} from '$lib/stores/adminAuth';
	import { soundEnabled } from '$lib/stores/staffNotifications';
	import { playNotificationChime } from '$lib/utils/notificationSound';
	import {
		initBookingListener,
		initUserListener,
		initServiceListener,
		destroyListeners,
		allBookings,
		getBookingTimestamp,
		updateBookingStatus,
		getBookingDateTime
	} from '$lib/stores/adminData';
	import {
		initRecycleBinListener,
		destroyRecycleBinListener,
		cleanupExpiredItems
	} from '$lib/stores/adminRecycleBin';
	import AdminNav from '$lib/components/admin/AdminNav.svelte';
	import AdminHeader from '$lib/components/admin/AdminHeader.svelte';
	import AdminToast from '$lib/components/admin/AdminToast.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';

	import { theme } from '$lib/stores/theme';

	let { children } = $props();

	// Derive page title from path
	let pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path.includes('/admin/import-walkins')) return 'Import Walk-ins';
		if (path.includes('/admin/recycle-bin')) return 'Recycle Bin';
		if (path.includes('/admin/bookings')) return 'Bookings';
		if (path.includes('/admin/users')) return 'Users';
		if (path.includes('/admin/services')) return 'Services';
		if (path.includes('/admin/settings')) return 'Settings';
		if (path.includes('/admin/invoice')) return 'Invoice';
		if (path.includes('/admin/notify')) return 'Notify';
		if (path.includes('/admin/login')) return '';
		return 'Dashboard';
	});

	let isLoginPage = $derived(page.url.pathname.includes('/admin/login'));

	// Derived theme color for Android address bar (Admin)
	let metaThemeColor = $derived.by(() => {
		if ($theme === 'clean') return '#FFFFFF'; // or #F5F5F7
		if ($theme === 'glitch') return '#E6E6FA';
		return '#1C1C1E'; // Admin Surface Color (Gold Theme Header) or #000000
	});

	let unsubFcm: (() => void) | null = null;

	onMount(() => {
		// Initialize auth - this is async but we don't need to await it
		// The auth state subscription will handle UI updates
		initAdminAuth().catch((err) => {
			console.error('[AdminLayout] Failed to initialize auth:', err);
		});

		// Unregister the old Firebase SW at the custom scope if still present
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((regs) => {
				for (const reg of regs) {
					if (reg.scope.includes('firebase-cloud-messaging-push-scope')) {
						reg.unregister();
						console.log('[Admin] Unregistered old Firebase SW at', reg.scope);
					}
				}
			});
		}

		// Foreground FCM handler — fires when admin app is open
		import('firebase/messaging').then(({ onMessage, isSupported, getMessaging }) => {
			isSupported().then((supported) => {
				if (!supported) return;
				import('$lib/firebase').then(({ app }) => {
					if (!app) return;
					const msgInstance = getMessaging(app);
					unsubFcm = onMessage(msgInstance, (payload) => {
						const title = payload.notification?.title ?? 'New Booking!';
						const body = payload.notification?.body ?? '';
						if (get(soundEnabled)) playNotificationChime();
						showToast(body ? `${title}: ${body}` : title, 'success');
					});
				});
			});
		});

		// Watch auth state and redirect accordingly
		const unsub = adminAuthState.subscribe((state) => {
			if (state === 'unauthenticated' || state === 'denied') {
				if (!page.url.pathname.includes('/admin/login')) {
					goto('/admin/login');
				}
			}
			if (state === 'authorized') {
				// Start data listeners
				initBookingListener();
				initUserListener();
				initServiceListener();
				initRecycleBinListener();

				// Auto-cleanup expired recycle bin items (>30 days old)
				cleanupExpiredItems().then((count) => {
					if (count > 0) {
						showToast(`Auto-removed ${count} expired item(s) from Recycle Bin`, 'success');
					}
				});

				// If on login page, redirect to dashboard
				if (page.url.pathname.includes('/admin/login')) {
					goto('/admin');
				}
			}
		});

		return () => unsub();
	});

	onDestroy(() => {
		if (unsubFcm) unsubFcm();
		destroyAdminAuth();
		destroyListeners();
		destroyRecycleBinListener();
	});

	// --- Auto-Cancel Overdue Logic ---
	$effect(() => {
		if ($adminAuthState !== 'authorized') return;

		const now = Date.now();
		// 24 Hours in milliseconds
		const twentyFourHours = 24 * 60 * 60 * 1000;

		// Iterate over all bookings to find overdue pending ones
		const overdueBookings = $allBookings.filter((b) => {
			if ((b.status || 'pending').toLowerCase() !== 'pending') return false;

			// Use the new helper that respects Time
			const bookingDate = getBookingDateTime(b);
			if (!bookingDate) return false; // Safety fallback

			// Check if appointment date/time + 24 hours is in the past
			return now > bookingDate.getTime() + twentyFourHours;
		});

		if (overdueBookings.length > 0) {
			console.log(`[Auto-Cancel] Found ${overdueBookings.length} overdue bookings.`);
			// Prevent multiple toasts/loops by checking if we just did this?
			// The status change removes them from the list, so the effect re-runs and finds 0.
			// But we need to be careful about not spamming if updates take time.

			let cancelledCount = 0;
			for (const b of overdueBookings) {
				// We don't have local processingIds here, but we can just fire and forget
				// checking status again to be safe
				if (b.status === 'cancelled') continue;

				updateBookingStatus(b.id, 'cancelled')
					.then(() => {
						cancelledCount++;
						if (cancelledCount === overdueBookings.length) {
							showToast(`Auto-cancelled ${cancelledCount} overdue bookings`, 'success');
						}
					})
					.catch((err) => console.error(`Failed to auto-cancel ${b.id}`, err));
			}
		}
	});
</script>

<svelte:head>
	<title>Blancbeu Admin{pageTitle ? ` — ${pageTitle}` : ''}</title>
	<meta name="description" content="Blancbeu Administration Panel" />
	<meta name="theme-color" content={metaThemeColor} />
	<link rel="manifest" href="/admin/manifest.json" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
	/>
</svelte:head>

<div class="admin-app">
	{#if $adminAuthState === 'loading' || $adminAuthState === 'checking'}
		<!-- Show loading spinner during auth initialization -->
		<div class="admin-loading">
			<div class="admin-spinner"></div>
			<p style="margin-top: 16px; color: var(--color-text-secondary);">Loading...</p>
		</div>
	{:else if isLoginPage}
		{@render children()}
	{:else if $adminAuthState === 'authorized'}
		<div class="admin-layout">
			<AdminHeader title={pageTitle} />
			<main class="admin-main">
				<div class="admin-content">
					{@render children()}
				</div>
			</main>
			<AdminNav />
		</div>
		<AdminToast />
	{:else}
		<!-- Fallback: redirect handled by subscription above -->
		<div class="admin-loading">
			<div class="admin-spinner"></div>
		</div>
	{/if}

	<!-- Mount Install Prompt globally for the admin view regardless of auth state -->
	<InstallPrompt />
</div>

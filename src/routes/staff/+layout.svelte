<script lang="ts">
	import '$lib/styles/staffTheme.css';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import { staffAuthState, initStaffAuth, destroyStaffAuth } from '$lib/stores/staffAuth';
	import {
		initStaffDataListener,
		destroyStaffDataListeners,
		upcomingBookings
	} from '$lib/stores/staffData';
	import { initTheme, destroyTheme, resolvedTheme } from '$lib/stores/staffTheme';
	import { soundEnabled, selectedSoundType, customSoundPath, AVAILABLE_SOUNDS, showListeningNotification, closeListeningNotification } from '$lib/stores/staffNotifications';
	import { notifications } from '$lib/stores/staffNotificationsList';
	import { playNotificationChime, playNotificationSound, playSelectedNotificationSound } from '$lib/utils/notificationSound';
	import StaffNav from '$lib/components/staff/StaffNav.svelte';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffBgAnimation from '$lib/components/staff/StaffBgAnimation.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import { initPush, isNative } from '$lib/capacitor/pushService';

	let { children } = $props();

	let isLoginPage = $derived(page.url.pathname.includes('/staff/login'));
	let pendingCount = $derived($upcomingBookings.filter((b) => b.status === 'pending').length);

	// Dynamic page titles
	let currentTitle = $derived(
		page.url.pathname.includes('dashboard')
			? 'Dashboard'
			: page.url.pathname.includes('schedule')
				? 'Schedule'
				: page.url.pathname.includes('bookings')
					? 'Bookings'
					: page.url.pathname.includes('notifications')
						? 'Notifications'
						: page.url.pathname.includes('settings')
							? 'Settings'
							: page.url.pathname.includes('profile')
								? 'Profile'
								: 'Blancbeu Stylist'
	);

	let isNavVisible = $derived(
		!page.url.pathname.includes('/staff/bookings/') || page.url.pathname.endsWith('/bookings')
	);

	// Derived theme color for mobile status bar & address bar
	let metaThemeColor = $derived($resolvedTheme === 'dark' ? '#16161d' : '#ffffff');

	let unsub: (() => void) | null = null;
	let unsubPush: (() => void) | null = null;
	// Deep-link listener handle (native only)
	let appUrlListener: { remove: () => void } | null = null;

	onMount(() => {
		initTheme();
		initStaffAuth();

		unsub = staffAuthState.subscribe(async (state) => {
			if (state === 'unauthenticated' || state === 'denied') {
				closeListeningNotification();
				if (!isLoginPage) {
					goto('/staff/login');
				}
			}
			if (state === 'authorized') {
				initStaffDataListener();
				showListeningNotification();
				if (isLoginPage) {
					goto('/staff/dashboard');
				}

				// ── Push notifications ──────────────────────────────────────
				// Get the authenticated user's UID to store the FCM token.
				import('$lib/firebase').then(async ({ auth }) => {
					const uid = auth?.currentUser?.uid;
					if (!uid) return;

					// initPush picks the right path automatically:
					//   native APK → Capacitor + FCM via GPS (reliable)
					//   browser PWA → firebase/messaging (existing behaviour)
					unsubPush = await initPush(uid, 'staff', (msg) => {
						playSelectedNotificationSound(0.7);
						showToast(msg.body ? `${msg.title}: ${msg.body}` : msg.title, 'success');
						notifications.add({
							type: 'booking',
							title: msg.title,
							message: msg.body,
							data: msg.data
						});
					});
				});
			}
		});

		// ── Old Firebase SW cleanup (browser only) ──────────────────────
		if (!isNative() && 'serviceWorker' in navigator) {
			navigator.serviceWorker.getRegistrations().then((regs) => {
				for (const reg of regs) {
					if (reg.scope.includes('firebase-cloud-messaging-push-scope')) {
						reg.unregister();
						console.log('[Staff] Unregistered old Firebase SW at', reg.scope);
					}
				}
			});
		}

		// ── Deep-link handler (native APK only) ─────────────────────────
		// When a push notification is tapped, Capacitor fires appUrlOpen.
		// We parse the URL and navigate within the SvelteKit router.
		if (isNative()) {
			import('@capacitor/app').then(({ App }) => {
				App.addListener('appUrlOpen', (data) => {
					try {
						const url = new URL(data.url);
						const path = url.pathname + url.search;
						
						// If URL domain is our native staff domain, map relative paths strictly into /staff
						if (url.hostname.includes('staff.blancbeu.in')) {
							const routedPath = path.startsWith('/staff') ? path : `/staff${path === '/' ? '' : path}`;
							goto(routedPath);
						} else if (path.startsWith('/staff')) {
							// For vercel.app domains which inherently have the /staff prefix
							goto(path);
						}
					} catch {
						console.warn('[Staff] Invalid deep-link URL:', data.url);
					}
				}).then((handle) => {
					appUrlListener = handle;
				});
			});
		}
	});

	onDestroy(() => {
		if (unsub) unsub();
		// Stop push listener (works for both native and web paths)
		if (unsubPush) unsubPush();
		// Remove native deep-link listener if it was registered
		if (appUrlListener) appUrlListener.remove();
		destroyStaffAuth();
		destroyStaffDataListeners();
		destroyTheme();
	});
</script>

<svelte:head>
	<meta name="theme-color" content={metaThemeColor} />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="msapplication-navbutton-color" content={metaThemeColor} />
</svelte:head>

<div class="staff-app {$resolvedTheme}">
	<!-- Global animated background — always visible, pauses when tab hidden -->
	<StaffBgAnimation />

	{#if $staffAuthState === 'loading' || $staffAuthState === 'checking'}
		<!-- Localized loader if Firebase Auth takes longer than splash screen -->
		<div class="loading-screen" in:fade={{ duration: 300 }}>
			<div class="loading-brand">
				<div class="brand-mark">
					<span class="brand-mark-letter">B</span>
					<div class="brand-mark-ring"></div>
				</div>
				<h1 class="brand-text">Blancbeu</h1>
				<span class="brand-sub">Stylist Portal</span>
			</div>
			<div class="loading-dots">
				<div class="dot dot-1"></div>
				<div class="dot dot-2"></div>
				<div class="dot dot-3"></div>
			</div>
		</div>
	{:else if isLoginPage}
		{@render children()}
	{:else if $staffAuthState === 'authorized'}
		<div class="staff-layout">
			<div class="staff-header-container">
				<StaffHeader title={currentTitle} />
			</div>

			<main class="staff-main {!isNavVisible ? 'no-nav' : ''}">
				{@render children()}
			</main>

			<div class="staff-nav-container">
				{#if isNavVisible}
					<StaffNav />
				{/if}
			</div>
		</div>
	{:else}
		<div class="loading-screen">
			<div class="access-denied">
				<div class="denied-icon">🔒</div>
				<h2>Access Restricted</h2>
				<p>You don't have permission to access the staff portal.</p>
				<button class="s-btn s-btn-primary s-btn-lg" onclick={() => goto('/staff/login')}>
					Back to Login
				</button>
			</div>
		</div>
	{/if}
	<Toast />

	<!-- Mount Install Prompt globally for the staff view regardless of auth state -->
	<InstallPrompt />
</div>

<style>
	/* Layout Shell */
	.staff-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		min-height: 100dvh;
		max-width: 600px;
		margin: 0 auto;
		background: var(--s-bg-secondary);
		box-shadow: var(--s-shadow-lg);
		position: relative;
		z-index: 1;
	}

	.staff-header-container {
		position: sticky;
		top: 0;
		z-index: var(--s-z-sticky);
	}

	.staff-main {
		flex: 1;
		padding: var(--s-space-lg) var(--s-space-lg);
		padding-bottom: calc(var(--s-nav-height) + 24px);
		overflow-x: hidden;
		transition: padding-bottom 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(body:has(.modal-backdrop)) .staff-main {
		padding-bottom: 24px !important;
	}

	.staff-main.no-nav {
		padding-bottom: 24px;
	}

	.staff-nav-container {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: var(--s-z-sticky);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	:global(.staff-nav-container > *) {
		pointer-events: auto;
		max-width: 600px;
		width: 100%;
	}

	/* Loading Screen */
	.loading-screen {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 36px;
		z-index: 1;
	}

	.loading-brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		animation: s-fadeIn 0.7s var(--s-ease);
	}

	.brand-mark {
		position: relative;
		width: 76px;
		height: 76px;
		border-radius: 22px;
		background: var(--s-grad-hero);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 32px rgba(124, 58, 237, 0.45), 0 0 0 1px rgba(255,255,255,0.1);
		animation: s-float 3s ease-in-out infinite;
	}

	.brand-mark-letter {
		font-family: var(--s-font-display);
		font-size: 2.2rem;
		font-weight: 800;
		position: relative;
		z-index: 1;
		background: linear-gradient(135deg, #fff 0%, var(--s-accent-light) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.brand-mark-ring {
		position: absolute;
		inset: -6px;
		border-radius: 28px;
		border: 2px solid transparent;
		background: var(--s-grad-aurora) border-box;
		-webkit-mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
		mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
		-webkit-mask-composite: destination-out;
		mask-composite: exclude;
		animation: s-spin 4s linear infinite;
		opacity: 0.7;
	}

	.brand-text {
		font-family: var(--s-font-display);
		font-size: 1.75rem;
		font-weight: 800;
		background: var(--s-grad-aurora);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.03em;
		margin-top: 4px;
	}

	.brand-sub {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--s-text-tertiary);
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.loading-dots {
		display: flex;
		gap: 10px;
	}

	.loading-dots .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		animation: s-bounce 1.4s ease-in-out infinite;
	}

	.dot-1 { background: var(--s-accent-2); }
	.dot-2 { background: var(--s-accent-3); animation-delay: 0.18s; }
	.dot-3 { background: var(--s-accent); animation-delay: 0.36s; }

	/* Access Denied */
	.access-denied {
		text-align: center;
		padding: 32px;
		animation: s-fadeInUp 0.4s var(--s-ease);
		background: var(--s-bg-glass-strong);
		backdrop-filter: var(--s-blur-strong);
		border-radius: var(--s-radius-2xl);
		border: 1px solid var(--s-border);
		max-width: 340px;
		width: 90%;
	}

	.denied-icon {
		font-size: 3rem;
		margin-bottom: 16px;
	}

	.access-denied h2 {
		margin: 0 0 8px 0;
		font-family: var(--s-font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.access-denied p {
		margin: 0 0 24px 0;
		color: var(--s-text-secondary);
		font-size: 0.95rem;
	}
</style>

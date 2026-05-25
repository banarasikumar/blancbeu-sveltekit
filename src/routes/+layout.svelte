<script lang="ts">
	import '$lib/styles/app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import NotificationPrompt from '$lib/components/NotificationPrompt.svelte';
	import SplashScreen from '$lib/components/layout/SplashScreen.svelte';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { onNavigate, afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { initAuth, user } from '$lib/stores/auth';
	import { playNotificationChime } from '$lib/utils/notificationSound';
	import { page } from '$app/state';
	import { restoreScrollPosition, saveScrollPosition, scrollPositions } from '$lib/stores/scroll';
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	import { theme, THEME_COLORS } from '$lib/stores/theme';
	import { initAppServiceListener } from '$lib/stores/appData';
	import { tryOnPicker } from '$lib/stores/tryOnPicker';

	// Dynamic Import for Simulator
	let { children } = $props();
	let mounted = $state(false);
	let isDesktop = $state(false);
	let SimulatorComponent = $state<any>(null);
	let unsubUserFcm: (() => void) | null = null;
	let notificationPromptRef: any = $state(null);
	let showWelcomeModal = $state(false);
	let welcomeUser: any = $state(null);

	let isHomePage = $derived(page.url.pathname === '/');
	let isTryOnPage = $derived(page.url.pathname.startsWith('/try-on'));
	let isImmersivePage = $derived(isHomePage || isTryOnPage);
	let isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));
	let isStaffRoute = $derived(page.url.pathname.startsWith('/staff'));
	let isShowcaseRoute = $derived(page.url.pathname.startsWith('/showcase'));

	let currentAppType = $derived(isAdminRoute ? 'admin' : isStaffRoute ? 'staff' : 'user');

	let showSplash = $state(true);

	// Derived theme color for address bar (Android Chrome, Safari, Edge, etc.)
	let metaThemeColor = $derived(isShowcaseRoute ? '#0B081F' : THEME_COLORS[$theme]);
	let appleStatusBarStyle = $derived(isShowcaseRoute ? 'black-translucent' : ($theme === 'gold' ? 'black-translucent' : 'default'));

	onMount(async () => {
		// CRITICAL: Disable browser's native scroll restoration.
		// Without this, the browser restores scroll positions from history on navigation,
		// overriding our custom per-route scroll management.
		if (typeof history !== 'undefined') {
			history.scrollRestoration = 'manual';
		}

		// Capacitor Native Soft Routing
		// Instead of triggering hard HTTP reloads via window.location.replace which instantly breaks offline SPA architectures,
		// we securely push the application down the internal Svelte client routes exactly upon boot!
		if (typeof window !== 'undefined' && window.location.pathname === '/') {
			if (navigator.userAgent.includes('BlancbeuStaffNative')) {
				goto('/staff', { replaceState: true });
				return;
			} else if (navigator.userAgent.includes('BlancbeuAdminNative')) {
				goto('/admin', { replaceState: true });
				return;
			}
		}

		// Only init global user-app services if NOT on an admin or staff route.
		// Admin and Staff layouts initialize their own dedicated Auth and Data listeners.
		if (!isAdminRoute && !isStaffRoute && !isShowcaseRoute) {
			initAuth();
			initAppServiceListener();

			// Foreground FCM handler for the customer app using unified pushService
			import('$lib/capacitor/pushService').then(({ initPush }) => {
				// Subscribe to user store to get the current UID
				const unsubUser = user.subscribe((currentUser) => {
					initPush(currentUser?.uid, 'user', (payload) => {
						const title = payload.title ?? 'Booking Update';
						const body = payload.body ?? '';
						playNotificationChime(0.45);
						import('$lib/stores/toast').then(({ showToast }) => {
							showToast(body ? `${title}: ${body}` : title, 'success');
						});
					}).then((unsub) => {
						unsubUserFcm = unsub;
					});
				});
			});
		}

		// Welcome Modal: Check if user needs to see it
		if (!isAdminRoute && !isStaffRoute && !isShowcaseRoute) {
			user.subscribe(async (currentUser) => {
				if (!currentUser?.uid) {
					showWelcomeModal = false;
					welcomeUser = null;
					return;
				}
				try {
					const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
					if (userDoc.exists()) {
						const data = userDoc.data();
						if (data.profileCompleted && !data.welcomeBonusClaimed) {
							welcomeUser = currentUser;
							showWelcomeModal = true;
						}
					}
				} catch (e) {
					console.warn('[Layout] Could not check welcome bonus status:', e);
				}
			});
		}

		// Check for desktop environment to load simulator
		const isDesktopDevice = window.matchMedia('(min-width: 768px)').matches;
		isDesktop = isDesktopDevice;

		if (isDesktopDevice) {
			// Dynamically import the simulator code only if needed
			const module = await import('$lib/components/layout/MobileSimulator.svelte');
			SimulatorComponent = module.default;
		}

		// Mark as mounted AFTER we've determined the device type
		mounted = true;
	});

	onDestroy(() => {
		if (unsubUserFcm) unsubUserFcm();
	});

	// Save scroll position BEFORE navigation so we capture the accurate position
	// before the DOM changes. This is more reliable than only saving in MobileNav click.
	beforeNavigate(({ from }) => {
		if (from?.url) {
			saveScrollPosition(from.url.pathname);
		}
	});

	// Centralized Scroll Handling
	afterNavigate(async ({ to, from }) => {
		if (!to?.url) return;

		// CRASH FIX: If navigating to the same page (e.g. clicking "You" while on "You"),
		// DO NOT try to restore history. Just scroll to top.
		if (from?.url && from.url.pathname === to.url.pathname) {
			console.log('[Layout] Same route navigation. Forcing top scroll, skipping restore.');
			const container = document.getElementById('mobile-viewport') || window;
			container.scrollTo(0, 0);
			return;
		}

		// wait for tick to ensure DOM is updated
		// Using setTimeout(0) is often safer than tick() for pure DOM read/write separation
		await new Promise((r) => setTimeout(r, 0));

		// Normal Navigation: Restore or Reset
		// restoreScrollPosition returns true if restored.
		const restored = restoreScrollPosition(to.url.pathname);

		if (!restored) {
			// If not restored (new page), ensure we are at top
			const container = document.getElementById('mobile-viewport') || window;
			container.scrollTo(0, 0);
		}
	});

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		// Disable view transitions on desktop simulator for instant "mobile app" feel
		// View transitions can sometimes cause a perceived delay or double-frame on simpler layouts
		if (isDesktop) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<!-- Dynamic Manifest and Favicon -->
	{#if isAdminRoute}
		<link rel="icon" href="/admin-favicon.png" />
		<link rel="manifest" href="/admin/manifest.json" />
	{:else if isStaffRoute}
		<link rel="icon" href="/staff-favicon.png" />
		<link rel="manifest" href="/staff/manifest.json" />
	{:else}
		<link rel="icon" href="/favicon.png" />
		<link rel="manifest" href="/manifest.json" />
	{/if}

	<!-- Mobile browser address bar & status bar color -->
	<meta name="theme-color" content={metaThemeColor} />
	<!-- iOS Safari status bar -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content={appleStatusBarStyle} />
	<!-- Microsoft Edge / Windows Phone -->
	<meta name="msapplication-navbutton-color" content={metaThemeColor} />
</svelte:head>

{#if showSplash && !isShowcaseRoute}
	<!-- We keep it alive for at least the animation minimum, but let the individual layout control when to turn it off strictly -->
	<SplashScreen appType={currentAppType} onComplete={() => (showSplash = false)} />
{/if}

{#if isAdminRoute || isStaffRoute || isShowcaseRoute}
	<!-- Admin, Staff & Showcase routes: pass through directly -->
	{@render children()}
{:else if !mounted}
	<!-- Pre-mount overlay: CSS hides on mobile, shows on desktop -->
	<div class="pre-mount-overlay"></div>
	<!-- Also render mobile content immediately for mobile users -->
	<div class="mobile-only-premount" id="app-root">
		<Header />
		<main class="app-content" class:immersive={isHomePage}>
			{@render children()}
		</main>
		{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
			<MobileNav />
		{/if}
		<InstallPrompt />
		<NotificationPrompt bind:this={notificationPromptRef} />
		<Toast />
		{#if showWelcomeModal && welcomeUser}
			<WelcomeModal user={welcomeUser} onClose={() => (showWelcomeModal = false)} />
		{/if}
		{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
			<AssistantOrb />
		{/if}
	</div>
{:else if isDesktop}
	{#if SimulatorComponent}
		<SimulatorComponent>
			<div id="app-root">
				<Header />
				<main class="app-content" class:immersive={isHomePage}>
					{@render children()}
				</main>
				{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
					<MobileNav />
				{/if}
				<InstallPrompt onClosed={() => notificationPromptRef?.show()} />
				<NotificationPrompt bind:this={notificationPromptRef} />
				<Toast />
				{#if showWelcomeModal && welcomeUser}
					<WelcomeModal user={welcomeUser} onClose={() => (showWelcomeModal = false)} />
				{/if}
				{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
					<AssistantOrb />
				{/if}
			</div>
		</SimulatorComponent>
	{/if}
{:else}
	<div id="app-root">
		<Header />
		<main class="app-content" class:immersive={isHomePage}>
			{@render children()}
		</main>
		{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
			<MobileNav />
		{/if}
		<InstallPrompt />
		<NotificationPrompt bind:this={notificationPromptRef} />
		<Toast />
		{#if showWelcomeModal && welcomeUser}
			<WelcomeModal user={welcomeUser} onClose={() => (showWelcomeModal = false)} />
		{/if}
		{#if !page.url.pathname.startsWith('/assistant') && !$tryOnPicker.active}
			<AssistantOrb />
		{/if}
	</div>
{/if}

<style>
	#app-root {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		/* Enable Container Queries globally */
		container-type: inline-size;
		container-name: app-root;
	}

	.app-content {
		padding-top: 56px; /* Header height */
		padding-bottom: 80px; /* Nav height + spacing */
		min-height: 100%;
		width: 100%;
		transition: padding-top 0.4s ease;
	}

	.app-content.immersive {
		padding-top: 0;
	}

	/* Pre-mount overlay: Hidden on mobile, visible on desktop */
	.pre-mount-overlay {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: 99999;
		display: none; /* Hidden by default (for mobile) */
	}

	@media (min-width: 768px) {
		.pre-mount-overlay {
			display: block; /* Show on desktop */
		}
	}

	/* Mobile SSR content: Shown on mobile, hidden on desktop */
	.mobile-only-premount {
		display: block; /* Show on mobile */
	}

	@media (min-width: 768px) {
		.mobile-only-premount {
			display: none; /* Hide on desktop (overlay covers anyway) */
		}
	}
</style>

<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/styles/app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import { initAuth } from '$lib/stores/auth';
	import { page } from '$app/state';
	import { restoreScrollPosition, saveScrollPosition, scrollPositions } from '$lib/stores/scroll';

	import { theme, THEME_COLORS } from '$lib/stores/theme';
	import { initAppServiceListener } from '$lib/stores/appData';

	// Dynamic Import for Simulator
	let { children } = $props();
	let mounted = $state(false);
	let isDesktop = $state(false);
	let SimulatorComponent = $state<any>(null);

	let isHomePage = $derived(page.url.pathname === '/');
	let isAdminRoute = $derived(page.url.pathname.startsWith('/admin'));

	// Derived theme color for address bar (Android Chrome, Safari, Edge, etc.)
	let metaThemeColor = $derived(THEME_COLORS[$theme]);
	let appleStatusBarStyle = $derived($theme === 'gold' ? 'black-translucent' : 'default');

	onMount(async () => {
		initAuth();
		initAppServiceListener();

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
	<link rel="icon" href={favicon} />

	<!-- Dynamic Manifest -->
	{#if isAdminRoute}
		<!-- Use admin manifest if available, or fallback/nothing for now -->
		<!-- We will add admin manifest later -->
	{:else}
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

{#if isAdminRoute}
	<!-- Admin routes: pass through directly to (admin)/+layout.svelte -->
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
		<MobileNav />
		<Toast />
	</div>
{:else if isDesktop}
	{#if SimulatorComponent}
		<svelte:component this={SimulatorComponent}>
			<div id="app-root">
				<Header />
				<main class="app-content" class:immersive={isHomePage}>
					{@render children()}
				</main>
				<MobileNav />
				<Toast />
			</div>
		</svelte:component>
	{/if}
{:else}
	<div id="app-root">
		<Header />
		<main class="app-content" class:immersive={isHomePage}>
			{@render children()}
		</main>
		<MobileNav />
		<Toast />
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

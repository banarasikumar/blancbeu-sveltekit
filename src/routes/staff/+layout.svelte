<script lang="ts">
	import '$lib/styles/staffTheme.css';
	import { onMount, onDestroy } from 'svelte';
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
	import StaffNav from '$lib/components/staff/StaffNav.svelte';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import Toast from '$lib/components/Toast.svelte';

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
					: page.url.pathname.includes('settings')
						? 'Settings'
						: page.url.pathname.includes('profile')
							? 'Profile'
							: 'Blancbeu Stylist'
	);

	let unsub: (() => void) | null = null;

	onMount(() => {
		initTheme();
		initStaffAuth();

		unsub = staffAuthState.subscribe((state) => {
			if (state === 'unauthenticated' || state === 'denied') {
				if (!isLoginPage) {
					goto('/staff/login');
				}
			}
			if (state === 'authorized') {
				initStaffDataListener();
				if (isLoginPage) {
					goto('/staff/dashboard');
				}
			}
		});
	});

	onDestroy(() => {
		if (unsub) unsub();
		destroyStaffAuth();
		destroyStaffDataListeners();
		destroyTheme();
	});
</script>

<div class="staff-app {$resolvedTheme}">
	{#if $staffAuthState === 'loading' || $staffAuthState === 'checking'}
		<div class="loading-screen">
			<div class="loading-brand">
				<div class="brand-mark">B</div>
				<div class="brand-text">Blancbeu</div>
				<div class="brand-sub">Stylist Portal</div>
			</div>
			<div class="loading-dots">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</div>
		</div>
	{:else if isLoginPage}
		{@render children()}
	{:else if $staffAuthState === 'authorized'}
		<div class="staff-layout">
			<div class="staff-header-container">
				<StaffHeader title={currentTitle} notificationCount={pendingCount} />
			</div>

			<main class="staff-main">
				{@render children()}
			</main>

			<div class="staff-nav-container">
				<StaffNav />
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
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
		background: var(--s-bg-primary);
	}

	.loading-brand {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		animation: s-fadeIn 0.6s var(--s-ease);
	}

	.brand-mark {
		width: 64px;
		height: 64px;
		border-radius: var(--s-radius-xl);
		background: linear-gradient(135deg, var(--s-brand), var(--s-accent));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--s-font-display);
		font-size: 2rem;
		font-weight: 800;
		box-shadow: var(--s-shadow-lg);
	}

	.brand-text {
		font-family: var(--s-font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--s-text-primary);
		letter-spacing: -0.02em;
		margin-top: 4px;
	}

	.brand-sub {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--s-text-secondary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.loading-dots {
		display: flex;
		gap: 8px;
	}

	.loading-dots .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--s-accent);
		animation: s-bounce 1.4s ease-in-out infinite;
	}

	.loading-dots .dot:nth-child(2) {
		animation-delay: 0.16s;
	}
	.loading-dots .dot:nth-child(3) {
		animation-delay: 0.32s;
	}

	/* Access Denied */
	.access-denied {
		text-align: center;
		padding: 32px;
		animation: s-fadeInUp 0.4s var(--s-ease);
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

<script lang="ts">
	import '$lib/styles/app.css'; // Use main app styles for now
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import { staffAuthState, initStaffAuth, destroyStaffAuth } from '$lib/stores/staffAuth';
	import { initStaffDataListener, destroyStaffDataListeners } from '$lib/stores/staffData';
	// We will create these components next
	// import StaffNav from '$lib/components/staff/StaffNav.svelte';
	// import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let { children } = $props();

	let isLoginPage = $derived(page.url.pathname.includes('/staff/login'));

	onMount(() => {
		initStaffAuth();

		const unsub = staffAuthState.subscribe((state) => {
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

		return () => unsub();
	});

	onDestroy(() => {
		destroyStaffAuth();
		destroyStaffDataListeners();
	});
</script>

<div class="staff-app">
	{#if $staffAuthState === 'loading' || $staffAuthState === 'checking'}
		<div class="loading-screen">
			<div class="spinner"></div>
			<p>Connecting...</p>
		</div>
	{:else if isLoginPage}
		{@render children()}
	{:else if $staffAuthState === 'authorized'}
		<div class="staff-layout">
			<!-- <StaffHeader /> -->
			<main class="staff-main">
				{@render children()}
			</main>
			<!-- <StaffNav /> -->
		</div>
	{:else}
		<div class="loading-screen">
			<p>Access Denied</p>
		</div>
	{/if}
	<Toast />
</div>

<style>
	.staff-app {
		min-height: 100vh;
		background: #f5f5f7; /* Light gray background like admin */
		color: #1c1c1e;
		font-family: 'Inter', sans-serif;
	}

	.loading-screen {
		height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(0, 0, 0, 0.1);
		border-top-color: #000;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.staff-layout {
		padding-bottom: 80px; /* Space for bottom nav */
	}

	.staff-main {
		padding: 16px;
		max-width: 600px; /* Mobile focused max width */
		margin: 0 auto;
	}
</style>

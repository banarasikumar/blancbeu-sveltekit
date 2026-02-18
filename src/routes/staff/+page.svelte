<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { staffAuthState } from '$lib/stores/staffAuth';

	onMount(() => {
		// Layout handles the auth check and redirect logic mostly.
		// But we need this page to exist so /staff isn't a 404.
		// We can just let the layout do its thing, or force a redirect here.

		const unsub = staffAuthState.subscribe((state) => {
			if (state === 'authorized') {
				goto('/staff/dashboard');
			} else if (state === 'unauthenticated' || state === 'denied') {
				goto('/staff/login');
			}
		});

		return () => unsub();
	});
</script>

<div class="redirecting">
	<p>Redirecting to Staff App...</p>
</div>

<style>
	.redirecting {
		height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #8e8e93;
	}
</style>

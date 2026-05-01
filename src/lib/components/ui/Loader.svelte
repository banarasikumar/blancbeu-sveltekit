<script lang="ts">
	import { onMount } from 'svelte';

	// Props with defaults
	let {
		size = 120,
		message = '',
		fullPage = true,
		height = '60vh'
	}: {
		size?: number;
		message?: string;
		fullPage?: boolean;
		height?: string;
	} = $props();

	let mounted = $state(false);
	let DotLottieSvelte = $state<any>(null);

	// Dynamically import dotlottie-svelte only on client
	onMount(async () => {
		try {
			const module = await import('@lottiefiles/dotlottie-svelte');
			DotLottieSvelte = module.DotLottieSvelte;
		} catch (e) {
			console.warn('DotLottie failed to load, falling back to CSS spinner', e);
		}
		mounted = true;
	});
</script>

<div
	class="loader-container"
	class:full-page={fullPage}
	style={fullPage ? `height: ${height};` : ''}
>
	<div class="loader-inner">
		{#if mounted && DotLottieSvelte}
			<div class="lottie-wrapper" style="width: {size}px; height: {size}px;">
				<svelte:component
					this={DotLottieSvelte}
					src="/LoadingDotsInYellow.lottie"
					autoplay
					loop
				/>
			</div>
		{:else}
			<!-- CSS Fallback spinner (shows immediately, before Lottie loads) -->
			<div class="fallback-spinner"></div>
		{/if}

		{#if message}
			<p class="loader-message">{message}</p>
		{/if}
	</div>
</div>

<style>
	.loader-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
	}

	.loader-container.full-page {
		min-height: 200px;
	}

	.loader-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.lottie-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		/* Prevent layout shift */
		flex-shrink: 0;
	}

	.loader-message {
		color: var(--color-text-secondary, #888);
		font-size: 0.9rem;
		margin: 0;
		text-align: center;
		animation: fadeInMsg 0.5s ease;
	}

	/* CSS Fallback spinner - matches existing app design */
	.fallback-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-accent-gold, #d4af37);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes fadeInMsg {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>

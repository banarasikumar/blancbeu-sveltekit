<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		appType?: 'user' | 'staff' | 'admin';
		durationMs?: number;
		onComplete?: () => void;
	}

	let { appType = 'user', durationMs = 2000, onComplete }: Props = $props();

	let show = $state(true);

	// Determine specific styling/text based on app type
	let appName = $derived.by(() => {
		if (appType === 'staff') return 'Stylist Portal';
		if (appType === 'admin') return 'Admin Portal';
		return 'Blancbeu'; // User app default
	});

	let appThemeClass = $derived(`splash-${appType}`);

	onMount(() => {
		// Minimum duration to guarantee the animation completes visually
		// even if hydration is very fast.
		const timer = setTimeout(() => {
			show = false;
			if (onComplete) onComplete();
		}, durationMs);

		return () => clearTimeout(timer);
	});
</script>

{#if show}
	<div class="splash-container {appThemeClass}" out:fade={{ duration: 600 }}>
		<div class="splash-content">
			<div class="logo-box">
				<span class="logo-letter">B</span>
			</div>

			<div class="text-container">
				{#if appType === 'user'}
					<h1 class="brand-name">Blancbeu</h1>
				{:else}
					<h1 class="brand-name">Blancbeu</h1>
					<p class="app-descriptor">{appName}</p>
				{/if}
			</div>

			<!-- Subtle loading indicator -->
			<div class="loading-bar-container">
				<div class="loading-bar-fill"></div>
			</div>
		</div>
	</div>
{/if}

<style>
	.splash-container {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2147483647; /* Maximum z-index to stay above absolutely everything */
		background-color: var(--theme-color, #ffffff);
		color: var(--text-color, #1c1c1e);
		transition: background-color 0.4s ease;
	}

	/* Theme Overrides for Splash specifically */
	.splash-admin {
		--theme-color: #1c1c1e;
		--text-color: #ffffff;
		--accent-grad: linear-gradient(135deg, #d4af37, #fdf5e6);
	}

	.splash-staff {
		--theme-color: #ffffff; /* Or whatever staff bg usually is */
		--text-color: #1c1c1e;
		--accent-grad: linear-gradient(135deg, #ef4444, #f87171);
	}

	.splash-user {
		/* Inherits from global light/dark theme but forces a nice default */
		--theme-color: #ffffff;
		--text-color: #1c1c1e;
		--accent-grad: linear-gradient(135deg, #1c1c1e, #3f3f46);
	}

	@media (prefers-color-scheme: dark) {
		.splash-user {
			--theme-color: #1c1c1e;
			--text-color: #ffffff;
			--accent-grad: linear-gradient(135deg, #fdf5e6, #a1a1aa);
		}
	}

	.splash-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 24px;
	}

	/* Animated Logo Box */
	.logo-box {
		width: 80px;
		height: 80px;
		background: var(--accent-grad);
		border-radius: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--theme-color); /* Contrast color */
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);

		/* Animations */
		animation: splash-scale-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;

		/* Admin Theme Logo text should always be dark for gold gradient */
		.splash-admin & {
			color: #1c1c1e;
		}
		/* Staff Theme Logo text should always be light for red gradient */
		.splash-staff & {
			color: #ffffff;
		}
		/* User Theme adapt */
		.splash-user & {
			color: var(--theme-color);
		}
	}

	.logo-letter {
		font-family: 'Cinzel', serif;
		font-size: 48px;
		font-weight: 700;
		line-height: 1;
		margin-top: 4px; /* Optical optical alignment for Cinzel */
	}

	/* Text Container Animations */
	.text-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		overflow: hidden;
	}

	.brand-name {
		font-family: 'Cinzel', serif;
		font-size: 32px;
		font-weight: 600;
		letter-spacing: 0.05em;
		margin: 0;
		opacity: 0;
		transform: translateY(20px);
		animation: splash-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
	}

	.app-descriptor {
		font-family: 'Outfit', sans-serif;
		font-size: 14px;
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		margin: 0;
		opacity: 0;
		transform: translateY(10px);
		color: var(--text-color);
		opacity: 0.6;
		animation: splash-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
	}

	/* Subtle Loading indicator under logo */
	.loading-bar-container {
		width: 120px;
		height: 2px;
		background: rgba(128, 128, 128, 0.2);
		border-radius: 2px;
		margin-top: 16px;
		overflow: hidden;
		opacity: 0;
		animation: splash-fade-in 0.4s ease 0.8s forwards;
	}

	.loading-bar-fill {
		height: 100%;
		background: var(--text-color);
		width: 30%;
		border-radius: 2px;
		animation: splash-loading 1.5s ease-in-out infinite alternate;
	}

	/* CSS Animations */
	@keyframes splash-scale-in {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes splash-fade-up {
		0% {
			transform: translateY(20px);
			opacity: 0;
		}
		100% {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes splash-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes splash-loading {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(350%);
		}
	}
</style>

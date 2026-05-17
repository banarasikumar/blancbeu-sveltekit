<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	export let visible: boolean = true;

	let orbRef: HTMLAnchorElement;
</script>

{#if visible}
	<a
		href="/assistant"
		bind:this={orbRef}
		class="assistant-orb"
		in:fly={{ x: 50, duration: 600, delay: 500 }}
		out:fade={{ duration: 300 }}
		aria-label="Open Virtual Assistant"
	>
		<!-- Glow layers -->
		<div class="glow-layer pulse-1"></div>
		<div class="glow-layer pulse-2"></div>

		<!-- The Avatar -->
		<div class="avatar-container">
			<img src="/Assistant.webp" alt="AI Assistant" class="avatar-img" />
		</div>

		<!-- Sparkle accent -->
		<svg
			class="sparkle-icon"
			width="12"
			height="12"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M12 2C12 2 13.5 7.5 14.5 9.5C15.5 11.5 18 12 22 12C18 12 15.5 12.5 14.5 14.5C13.5 16.5 12 22 12 22C12 22 10.5 16.5 9.5 14.5C8.5 12.5 6 12 2 12C6 12 8.5 11.5 9.5 9.5C10.5 7.5 12 2 12 2Z"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
				fill="currentColor"
			/>
		</svg>
	</a>
{/if}

<style>
	.assistant-orb {
		position: fixed;
		top: 65%;
		right: 0;
		transform: translateY(-50%);
		width: 44px;
		height: 52px;
		box-sizing: border-box;
		background: rgba(10, 10, 10, 0.25);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.15);
		border-right: none;
		border-radius: 26px 0 0 26px;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding-left: 3px;
		cursor: pointer;
		z-index: 990; /* Just below modals */
		box-shadow:
			-4px 6px 20px rgba(0, 0, 0, 0.3),
			inset 1px 1px 0px rgba(255, 255, 255, 0.05);
		transition:
			transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1),
			background 0.3s ease,
			border-color 0.3s ease,
			opacity 0.3s ease;
		-webkit-tap-highlight-color: transparent;
		text-decoration: none;
		opacity: 0.85;
	}

	.assistant-orb:active {
		transform: translateY(-50%) scale(0.92);
		opacity: 1;
	}

	@media (hover: hover) {
		.assistant-orb:hover {
			opacity: 1;
			background: rgba(15, 15, 15, 0.4);
			border-color: rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.3);
		}
	}

	.glow-layer {
		position: absolute;
		left: 3px;
		top: 7px;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.3) 0%, transparent 70%);
		pointer-events: none;
	}

	.pulse-1 {
		animation: pulseOrb 4s infinite alternate ease-in-out;
	}

	.pulse-2 {
		animation: pulseOrb 6s infinite alternate-reverse ease-in-out;
		opacity: 0.4;
	}

	@keyframes pulseOrb {
		0% {
			transform: scale(0.8);
			opacity: 0.4;
		}
		100% {
			transform: scale(1.4);
			opacity: 0.8;
		}
	}

	.avatar-container {
		position: relative;
		width: 38px;
		height: 38px;
		border-radius: 50%;
		overflow: hidden;
		border: 1px solid rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.5);
		box-shadow: 0 0 10px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.3);
		z-index: 2;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background: var(--gradient-gold, #000);
	}

	.sparkle-icon {
		position: absolute;
		top: -4px;
		left: -4px;
		color: var(--color-accent-gold, #d4af37);
		filter: drop-shadow(0 0 4px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.8));
		z-index: 3;
		animation: floatSparkle 2s infinite alternate ease-in-out;
	}

	@keyframes floatSparkle {
		0% {
			transform: translateY(0) scale(0.9);
			opacity: 0.8;
		}
		100% {
			transform: translateY(-3px) scale(1.1);
			opacity: 1;
		}
	}
</style>

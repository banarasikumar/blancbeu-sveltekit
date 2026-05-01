<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { requestNotificationToken } from '$lib/capacitor/pushService';
	import { user } from '$lib/stores/auth';

	let isVisible = $state(false);

	/**
	 * Show the notification prompt.
	 * Checks if the user has already seen it or already granted permission.
	 */
	export function show() {
		if (!browser) return;
		if (localStorage.getItem('notif_prompt_dismissed') === 'true') return;
		if ('Notification' in window && Notification.permission === 'granted') return;
		if ('Notification' in window && Notification.permission === 'denied') return;

		isVisible = true;
	}

	async function handleAllow() {
		isVisible = false;
		localStorage.setItem('notif_prompt_dismissed', 'true');
		await requestNotificationToken($user?.uid, 'user');
	}

	function handleDismiss() {
		isVisible = false;
		localStorage.setItem('notif_prompt_dismissed', 'true');
	}
</script>

{#if isVisible}
	<!-- Slim bottom banner — no overlay, no blocking -->
	<div class="notif-banner-wrapper" transition:fly={{ y: 100, duration: 500, opacity: 0 }}>
		<div class="notif-banner">
			<!-- Animated bell -->
			<div class="bell-ring">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
				</svg>
			</div>

			<div class="notif-text">
				<span class="notif-title">Stay in the loop ✨</span>
				<span class="notif-sub">Get booking updates & exclusive offers</span>
			</div>

			<button class="notif-allow-btn" onclick={handleAllow}>
				Allow
			</button>

			<button class="notif-close" onclick={handleDismiss} aria-label="Dismiss">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.notif-banner-wrapper {
		position: fixed;
		bottom: 80px; /* Above MobileNav */
		left: 0;
		right: 0;
		z-index: 9999;
		display: flex;
		justify-content: center;
		padding: 0 12px;
		pointer-events: none;
	}

	.notif-banner {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 420px;
		padding: 12px 14px;
		background: linear-gradient(135deg, rgba(30, 30, 34, 0.95), rgba(18, 18, 20, 0.98));
		border: 1px solid rgba(212, 175, 55, 0.25);
		border-radius: 16px;
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05) inset,
			0 0 30px rgba(212, 175, 55, 0.06);
	}

	/* Animated bell icon */
	.bell-ring {
		flex-shrink: 0;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05));
		border: 1px solid rgba(212, 175, 55, 0.25);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #D4AF37;
		animation: ring-wobble 3s ease-in-out infinite;
	}

	@keyframes ring-wobble {
		0%, 85%, 100% { transform: rotate(0deg); }
		88% { transform: rotate(12deg); }
		91% { transform: rotate(-10deg); }
		94% { transform: rotate(6deg); }
		97% { transform: rotate(-3deg); }
	}

	/* Text area */
	.notif-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.notif-title {
		font-family: var(--font-body, sans-serif);
		font-size: 0.82rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.01em;
	}

	.notif-sub {
		font-family: var(--font-body, sans-serif);
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.55);
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* CTA button */
	.notif-allow-btn {
		flex-shrink: 0;
		padding: 8px 18px;
		background: linear-gradient(135deg, #E2C25D, #C4A23A);
		color: #000;
		font-family: var(--font-body, sans-serif);
		font-size: 0.78rem;
		font-weight: 800;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
		position: relative;
		overflow: hidden;
	}

	.notif-allow-btn::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 60%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
		transform: skewX(-25deg);
		animation: btn-shimmer 2.5s infinite 1s;
	}

	@keyframes btn-shimmer {
		0%, 60% { left: -100%; }
		100% { left: 200%; }
	}

	.notif-allow-btn:hover {
		transform: scale(1.06);
		box-shadow: 0 6px 18px rgba(212, 175, 55, 0.4);
	}

	.notif-allow-btn:active {
		transform: scale(0.96);
	}

	/* Close button */
	.notif-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.35);
		padding: 4px;
		cursor: pointer;
		border-radius: 50%;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.notif-close:hover {
		color: rgba(255, 255, 255, 0.8);
		background: rgba(255, 255, 255, 0.1);
	}
</style>

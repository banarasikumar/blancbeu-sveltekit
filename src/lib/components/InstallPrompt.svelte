<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let deferredPrompt: any = $state(null);
	let isVisible = $state(false);

	onMount(() => {
		// Listen for the 'beforeinstallprompt' event
		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			// Stash the event so it can be triggered later.
			deferredPrompt = e;
			// Update UI notify the user they can install the PWA
			isVisible = true;
			console.log('PWA install prompt captured');
		});

		// Optional: Check if already installed (standalone mode) to be double sure,
		// though the event won't fire if installed.
		if (window.matchMedia('(display-mode: standalone)').matches) {
			isVisible = false;
		}
	});

	async function installApp() {
		if (!deferredPrompt) return;

		// Show the install prompt
		deferredPrompt.prompt();

		// Wait for the user to respond to the prompt
		const { outcome } = await deferredPrompt.userChoice;
		console.log(`User response to the install prompt: ${outcome}`);

		// We've used the prompt, and can't use it again, throw it away
		deferredPrompt = null;
		isVisible = false;
	}
	// Enhanced Pulse Animation
	$effect(() => {
		if (isVisible) {
			const interval = setInterval(() => {
				const btn = document.querySelector('.install-btn') as HTMLElement;
				if (btn) {
					btn.style.transform = 'scale(1.05)';
					setTimeout(() => (btn.style.transform = 'scale(1)'), 200);
				}
			}, 3000);
			return () => clearInterval(interval);
		}
	});

	function closePrompt() {
		isVisible = false;
	}
</script>

{#if isVisible}
	<div class="install-prompt-container" in:fly={{ y: 50, duration: 600 }} out:fade>
		<div class="glass-panel">
			<button class="close-btn" onclick={closePrompt} aria-label="Close Install Prompt">
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>

			<div class="content">
				<div class="text-group">
					<span class="subtext">For Better Experience</span>
					<h3 class="title">Get the App</h3>
				</div>
				<button class="install-btn" onclick={installApp}> Install & Get ₹500 Coupon </button>
			</div>
		</div>
	</div>
{/if}

<style>
	.install-prompt-container {
		position: fixed;
		bottom: 24px;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		z-index: 9999;
		padding: 0 16px;
		pointer-events: none;
	}

	.glass-panel {
		pointer-events: auto;
		background: var(--color-bg-glass-heavy);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid var(--color-border-strong);
		padding: 20px 24px;
		border-radius: var(--radius-lg);
		box-shadow:
			0 10px 40px -10px rgba(0, 0, 0, 0.5),
			0 0 20px rgba(212, 175, 55, 0.1); /* Subtle gold glow */
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		position: relative;
		overflow: hidden;
	}

	/* Shine effect overlay */
	.glass-panel::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 50%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
		transform: skewX(-25deg);
		animation: shine 6s infinite;
		pointer-events: none;
	}

	@keyframes shine {
		0%,
		40% {
			left: -100%;
		}
		50% {
			left: 200%;
		}
		100% {
			left: 200%;
		}
	}

	.close-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		background: rgba(255, 255, 255, 0.05);
		border: none;
		border-radius: 50%;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 10;
		opacity: 0.6;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--color-text-secondary);
		opacity: 1;
	}

	.content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 16px;
	}

	.text-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.subtext {
		font-family: var(--font-body);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-accent-gold);
		font-weight: 600;
		opacity: 0.9;
	}

	.title {
		font-family: var(--font-heading);
		font-size: 1.25rem;
		color: var(--color-text-primary);
		margin: 0;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.install-btn {
		background: var(--gradient-gold);
		color: #000;
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 0.85rem;
		padding: 12px 20px;
		border-radius: var(--radius-full);
		border: none;
		box-shadow:
			0 4px 15px rgba(212, 175, 55, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		white-space: nowrap;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		position: relative;
		overflow: hidden;
	}

	.install-btn:hover {
		transform: translateY(-2px);
		box-shadow:
			0 8px 25px rgba(212, 175, 55, 0.5),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}

	.install-btn:active {
		transform: scale(0.96) translateY(0);
	}
</style>

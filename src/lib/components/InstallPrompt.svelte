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
			console.log("PWA install prompt captured");
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
</script>

{#if isVisible}
	<div class="install-prompt-container" in:fly={{ y: 50, duration: 500 }} out:fade>
		<div class="glass-panel">
			<div class="content">
				<div class="text-group">
					<span class="subtext">For Better Experience</span>
					<h3 class="title">Get the App</h3>
				</div>
				<button class="install-btn" onclick={installApp}>
					Install App
				</button>
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
		pointer-events: none; /* Let clicks pass through outside the card */
	}

	.glass-panel {
		pointer-events: auto;
		background: var(--color-bg-glass-heavy);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--color-border-strong);
		padding: 16px 20px;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card), 0 0 20px rgba(0,0,0,0.2);
		width: 100%;
		max-width: 400px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
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
		gap: 2px;
	}

	.subtext {
		font-family: var(--font-body);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-accent-gold);
		font-weight: 600;
	}

	.title {
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: var(--color-text-primary);
		margin: 0;
		font-weight: 700;
	}

	.install-btn {
		background: var(--gradient-gold);
		color: #000; /* Gold usually looks best with black text */
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 0.9rem;
		padding: 10px 20px;
		border-radius: var(--radius-full);
		border: none;
		box-shadow: var(--shadow-gold);
		white-space: nowrap;
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
	}

	.install-btn:active {
		transform: scale(0.95);
	}
</style>

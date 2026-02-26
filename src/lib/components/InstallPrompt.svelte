<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';

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

		// For testing UI if needed during dev, uncomment:
		// setTimeout(() => isVisible = true, 1000);
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

	function closePrompt() {
		isVisible = false;
	}
</script>

{#if isVisible}
	<div class="install-overlay" transition:fade={{ duration: 300 }}>
		<div
			class="premium-install-card"
			in:fly={{ y: 200, duration: 800, delay: 200, opacity: 0 }}
			out:fly={{ y: 100, duration: 400, opacity: 0 }}
		>
			<!-- Animated glowing background behind the card content -->
			<div class="card-bg-glow"></div>

			<!-- Close Button -->
			<button class="close-btn" onclick={closePrompt} aria-label="Close Install Prompt">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>

			<div class="card-content">
				<!-- App Icon with Sparkle -->
				<div class="app-icon-wrapper">
					<div class="app-icon" in:scale={{ duration: 600, delay: 600, start: 0.8, opacity: 0 }}>
						<span class="icon-letter">B</span>
						<!-- Sparkle Icon -->
						<div class="sparkle-icon">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
								<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
							</svg>
						</div>
					</div>
					<div class="icon-glow"></div>
				</div>

				<!-- Text Information -->
				<div class="app-details">
					<div class="badge-wrapper">
						<span class="exclusive-badge">For Better Experience</span>
					</div>
					<h3 class="app-title">Blancbeu App</h3>
					
					<div class="app-rating">
						<div class="stars">
							{#each Array(5) as _}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-accent-gold)" stroke="var(--color-accent-gold)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
								</svg>
							{/each}
						</div>
						<span class="rating-text">4.9 (2.5k)</span>
					</div>
					
					<p class="app-desc">Install now & get a <strong>₹500 Coupon</strong> for your first booking!</p>
				</div>

				<!-- Action Button -->
				<div class="action-area">
					<button class="install-btn" onclick={installApp}>
						<span class="btn-text">Install App</span>
						<svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="7 10 12 15 17 10"></polyline>
							<line x1="12" y1="15" x2="12" y2="3"></line>
						</svg>
						<div class="btn-shine"></div>
					</button>
					<span class="secure-text">Fast & Secure Download</span>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.install-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 99999;
		padding: 24px 20px;
	}

	.premium-install-card {
		position: relative;
		width: 100%;
		max-width: 380px;
		background: linear-gradient(145deg, #18181b, #09090b);
		border-radius: 32px;
		padding: 36px 28px;
		overflow: hidden;
		box-shadow: 
			0 25px 50px -12px rgba(0, 0, 0, 0.8),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			inset 0 0 0 1px rgba(255, 255, 255, 0.05);
	}

	.card-bg-glow {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(
			circle at 50% 0%, 
			rgba(212, 175, 55, 0.18) 0%, 
			rgba(0,0,0,0) 45%
		);
		pointer-events: none;
		animation: breathe 6s ease-in-out infinite alternate;
	}

	@keyframes breathe {
		0% { transform: scale(1) translateY(0); }
		100% { transform: scale(1.05) translateY(-20px); }
	}

	.close-btn {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(255,255,255,0.06);
		border: 1px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.7);
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 10;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.close-btn:hover {
		background: rgba(255,255,255,0.15);
		color: #fff;
		transform: scale(1.1);
	}

	.card-content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 24px;
	}

	.app-icon-wrapper {
		position: relative;
		width: 90px;
		height: 90px;
		margin-bottom: 4px;
	}

	.app-icon {
		position: relative;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #27272a, #09090b);
		border-radius: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(212, 175, 55, 0.4);
		box-shadow: 
			0 15px 35px rgba(0,0,0,0.6),
			inset 0 2px 0 rgba(255,255,255,0.15),
			inset 0 0 20px rgba(212, 175, 55, 0.1);
		z-index: 2;
	}

	.icon-letter {
		font-family: var(--font-heading, serif);
		font-size: 3rem;
		font-weight: 800;
		background: linear-gradient(to right, #D4AF37, #FFF5D1, #D4AF37);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-size: 200% auto;
		animation: text-shine 4s linear infinite;
	}

	@keyframes text-shine {
		to { background-position: 200% center; }
	}

	.sparkle-icon {
		position: absolute;
		top: -8px;
		right: -8px;
		color: #FFF5D1;
		animation: twinkle 2.5s infinite ease-in-out alternate;
		filter: drop-shadow(0 0 8px rgba(255, 245, 209, 0.8));
	}

	@keyframes twinkle {
		0% { transform: scale(0.9) rotate(-5deg); opacity: 0.8; }
		100% { transform: scale(1.3) rotate(15deg); opacity: 1; }
	}

	.icon-glow {
		position: absolute;
		inset: -15px;
		background: var(--color-accent-gold, #D4AF37);
		filter: blur(25px);
		opacity: 0.25;
		border-radius: 40px;
		z-index: 1;
		animation: pulse-glow 4s infinite alternate;
	}

	@keyframes pulse-glow {
		0% { opacity: 0.2; transform: scale(0.9); }
		100% { opacity: 0.4; transform: scale(1.1); }
	}

	.app-details {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.badge-wrapper {
		background: rgba(212, 175, 55, 0.1);
		border: 1px solid rgba(212, 175, 55, 0.25);
		padding: 6px 14px;
		border-radius: 20px;
		margin-bottom: 8px;
		box-shadow: 0 4px 10px rgba(0,0,0,0.2);
	}

	.exclusive-badge {
		font-family: var(--font-body, sans-serif);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--color-accent-gold, #D4AF37);
		font-weight: 800;
	}

	.app-title {
		font-family: var(--font-heading, serif);
		font-size: 2rem;
		color: #ffffff;
		margin: 0;
		font-weight: 700;
		letter-spacing: -0.03em;
		text-shadow: 0 2px 10px rgba(0,0,0,0.5);
	}

	.app-rating {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.stars {
		display: flex;
		gap: 3px;
	}

	.rating-text {
		font-family: var(--font-body, sans-serif);
		font-size: 0.85rem;
		color: rgba(255,255,255,0.7);
		font-weight: 600;
	}

	.app-desc {
		font-family: var(--font-body, sans-serif);
		font-size: 1.05rem;
		color: rgba(255,255,255,0.85);
		margin: 0;
		line-height: 1.5;
		padding: 0 12px;
	}

	.app-desc strong {
		color: var(--color-accent-gold, #D4AF37);
		font-weight: 700;
		text-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
	}

	.action-area {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		margin-top: 12px;
	}

	.install-btn {
		width: 100%;
		background: linear-gradient(135deg, #E2C25D, #AA7C11);
		color: #000;
		font-family: var(--font-body, sans-serif);
		font-weight: 800;
		font-size: 1.15rem;
		padding: 18px 24px;
		border-radius: 20px;
		border: none;
		box-shadow: 
			0 12px 30px rgba(212, 175, 55, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.5),
			inset 0 -2px 0 rgba(0, 0, 0, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		cursor: pointer;
		position: relative;
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.btn-icon {
		transition: transform 0.3s ease;
	}

	.install-btn:hover {
		transform: translateY(-3px);
		box-shadow: 
			0 16px 35px rgba(212, 175, 55, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.6),
			inset 0 -2px 0 rgba(0, 0, 0, 0.1);
	}

	.install-btn:hover .btn-icon {
		transform: translateY(2px);
	}

	.install-btn:active {
		transform: scale(0.97);
	}

	.btn-shine {
		position: absolute;
		top: 0;
		left: -100%;
		width: 50%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
		transform: skewX(-25deg);
		animation: shine 3s infinite;
	}

	@keyframes shine {
		0%, 60% { left: -100%; }
		100% { left: 200%; }
	}

	.secure-text {
		font-family: var(--font-body, sans-serif);
		font-size: 0.75rem;
		color: rgba(255,255,255,0.5);
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		letter-spacing: 0.5px;
	}
	
	.secure-text::before {
		content: '✓';
		color: #4caf50;
		font-weight: bold;
		font-size: 1rem;
		text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
	}
</style>

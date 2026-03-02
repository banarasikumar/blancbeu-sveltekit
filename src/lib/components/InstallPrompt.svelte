<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { page } from '$app/state';

	import { browser } from '$app/environment';

	let deferredPrompt: any = $state(null);
	let isVisible = $state(false);

	// Dynamically determine which app we are currently viewing
	let appType = $derived(
		page.url.pathname.startsWith('/admin')
			? 'admin'
			: page.url.pathname.startsWith('/staff')
				? 'staff'
				: 'user'
	);

	let appTitle = $derived(
		appType === 'admin' ? 'Admin Portal' : appType === 'staff' ? 'Stylist Portal' : 'Blancbeu App'
	);

	let appDesc = $derived(
		appType === 'admin'
			? 'Manage the salon anywhere.'
			: appType === 'staff'
				? 'Manage your schedule on the go.'
				: 'Install now & get a <strong>₹500 Coupon</strong> for your first booking!'
	);

	let appIconUrl = $derived(
		appType === 'admin'
			? '/admin-icon-512.png'
			: appType === 'staff'
				? '/staff-icon-512.png'
				: '/pwa-512x512.png'
	);

	let themeProps = $derived(
		appType === 'admin'
			? {
					glow: 'rgba(212, 175, 55, 0.18)',
					btnLine: 'linear-gradient(135deg, #27272a, #09090b)',
					textGlow: '#D4AF37',
					border: 'rgba(212, 175, 55, 0.4)',
					btnText: '#fff'
				}
			: appType === 'staff'
				? {
						glow: 'rgba(239, 68, 68, 0.18)',
						btnLine: 'linear-gradient(135deg, #EF4444, #B91C1C)',
						textGlow: '#EF4444',
						border: 'rgba(239, 68, 68, 0.4)',
						btnText: '#fff'
					}
				: {
						glow: 'rgba(212, 175, 55, 0.18)',
						btnLine: 'linear-gradient(135deg, #E2C25D, #AA7C11)',
						textGlow: '#D4AF37',
						border: 'rgba(212, 175, 55, 0.4)',
						btnText: '#000'
					}
	);

	onMount(() => {
		if (!browser) return; // Prevent SSR crash

		// Listen for the 'beforeinstallprompt' event.
		// If this fires, we know definitively from the OS that the EXACT app logic path
		// we are currently browsing is NOT installed.
		// We do NOT check for standalone mode here to allow installing Admin/Staff PWAs
		// even when opened inside the standalone User PWA shell.
		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevent the mini-infobar from appearing on mobile
			e.preventDefault();
			deferredPrompt = e;
			isVisible = true; // Show our custom "Install App" banner
			console.log(`[PWA] Strictly scoped install prompt captured for: ${appType}`);
		});
	});

	async function handleAction() {
		if (!deferredPrompt) return; // Unlikely, since button is tied to isVisible

		// Show the native browser install prompt
		deferredPrompt.prompt();

		const { outcome } = await deferredPrompt.userChoice;
		console.log(`[PWA] User response to the install prompt: ${outcome}`);

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
			style="--card-glow: {themeProps.glow}; --btn-gradient: {themeProps.btnLine}; --text-glow: {themeProps.textGlow}; --icon-border: {themeProps.border}; --btn-text: {themeProps.btnText};"
		>
			<div class="card-bg-glow"></div>

			<button class="close-btn" onclick={closePrompt} aria-label="Close Install Prompt">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>

			<div class="card-content">
				<!-- App Icon -->
				<div class="app-icon-wrapper">
					<div class="app-icon" in:scale={{ duration: 600, delay: 600, start: 0.8, opacity: 0 }}>
						<img src={appIconUrl} alt="{appTitle} Icon" class="real-icon" />

						<!-- Sparkle Icon -->
						{#if appType === 'user'}
							<div class="sparkle-icon">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
									<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
								</svg>
							</div>
						{/if}
					</div>
					<div class="icon-glow"></div>
				</div>

				<!-- Text Information -->
				<div class="app-details">
					<div class="badge-wrapper">
						<span class="exclusive-badge">For Better Experience</span>
					</div>
					<h3 class="app-title">{appTitle}</h3>

					{#if appType === 'user'}
						<div class="app-rating">
							<div class="stars">
								{#each Array(5) as _}
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="var(--color-accent-gold)"
										stroke="var(--color-accent-gold)"
										stroke-width="1"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polygon
											points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
										></polygon>
									</svg>
								{/each}
							</div>
							<span class="rating-text">4.9 (2.5k)</span>
						</div>
					{/if}

					<p class="app-desc">{@html appDesc}</p>
				</div>

				<!-- Action Button -->
				<div class="action-area">
					<button class="install-btn" onclick={handleAction}>
						<span class="btn-text">Install App</span>
						<svg
							class="btn-icon"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
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
		background: radial-gradient(circle at 50% 0%, var(--card-glow) 0%, rgba(0, 0, 0, 0) 45%);
		pointer-events: none;
		animation: breathe 6s ease-in-out infinite alternate;
	}

	@keyframes breathe {
		0% {
			transform: scale(1) translateY(0);
		}
		100% {
			transform: scale(1.05) translateY(-20px);
		}
	}

	.close-btn {
		position: absolute;
		top: 20px;
		right: 20px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.7);
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
		background: rgba(255, 255, 255, 0.15);
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
		border: 1px solid var(--icon-border);
		box-shadow:
			0 15px 35px rgba(0, 0, 0, 0.6),
			inset 0 2px 0 rgba(255, 255, 255, 0.15);
		z-index: 2;
		overflow: hidden;
	}

	.real-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.sparkle-icon {
		position: absolute;
		top: -8px;
		right: -8px;
		color: #fff5d1;
		animation: twinkle 2.5s infinite ease-in-out alternate;
		filter: drop-shadow(0 0 8px rgba(255, 245, 209, 0.8));
	}

	@keyframes twinkle {
		0% {
			transform: scale(0.9) rotate(-5deg);
			opacity: 0.8;
		}
		100% {
			transform: scale(1.3) rotate(15deg);
			opacity: 1;
		}
	}

	.icon-glow {
		position: absolute;
		inset: -15px;
		background: var(--text-glow);
		filter: blur(25px);
		opacity: 0.25;
		border-radius: 40px;
		z-index: 1;
		animation: pulse-glow 4s infinite alternate;
	}

	@keyframes pulse-glow {
		0% {
			opacity: 0.2;
			transform: scale(0.9);
		}
		100% {
			opacity: 0.4;
			transform: scale(1.1);
		}
	}

	.app-details {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
	}

	.badge-wrapper {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		padding: 6px 14px;
		border-radius: 20px;
		margin-bottom: 8px;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
	}

	.exclusive-badge {
		font-family: var(--font-body, sans-serif);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--text-glow);
		font-weight: 800;
	}

	.app-title {
		font-family: var(--font-heading, serif);
		font-size: 2rem;
		color: #ffffff;
		margin: 0;
		font-weight: 700;
		letter-spacing: -0.03em;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
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
		color: rgba(255, 255, 255, 0.7);
		font-weight: 600;
	}

	.app-desc {
		font-family: var(--font-body, sans-serif);
		font-size: 1.05rem;
		color: rgba(255, 255, 255, 0.85);
		margin: 0;
		line-height: 1.5;
		padding: 0 12px;
	}

	:global(.app-desc strong) {
		color: var(--text-glow);
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
		background: var(--btn-gradient);
		color: var(--btn-text);
		font-family: var(--font-body, sans-serif);
		font-weight: 800;
		font-size: 1.15rem;
		padding: 18px 24px;
		border-radius: 20px;
		border: none;
		box-shadow:
			0 12px 30px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
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
			0 16px 35px rgba(0, 0, 0, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.2),
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
		pointer-events: none;
	}

	@keyframes shine {
		0%,
		60% {
			left: -100%;
		}
		100% {
			left: 200%;
		}
	}

	.secure-text {
		font-family: var(--font-body, sans-serif);
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
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

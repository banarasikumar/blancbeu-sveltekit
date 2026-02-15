<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { elasticOut, cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';
	import {
		Check,
		ArrowRight,
		Star,
		Share2,
		Download,
		Calendar,
		Clock,
		QrCode,
		Sparkles,
		Heart
	} from 'lucide-svelte';
	import html2canvas from 'html2canvas';

	export let userName = 'Guest';
	export let selectedDate: string | null = null;
	export let selectedTime: string | null = null;
	export let cartItems: any[] = [];
	export let totalPrice = 0;
	export let paymentType = 'pay_at_salon';
	export let bookingId = '';

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

	// --- SHINE / GLIMMER ---
	let cardElement: HTMLDivElement;
	let overlayElement: HTMLDivElement;
	let glimmerX = 50;
	let glimmerY = 50;
	let isDownloading = false;

	async function downloadTicket() {
		if (!overlayElement || isDownloading) return;

		isDownloading = true;

		// 1. Reset shine for a clean capture
		const prevGlimmerX = glimmerX;
		const prevGlimmerY = glimmerY;
		glimmerX = 50;
		glimmerY = 50;
		// Wait for Svelte to update DOM
		await new Promise((r) => setTimeout(r, 100));

		try {
			const canvas = await html2canvas(overlayElement, {
				backgroundColor: '#050505', // Force dark background (matches theme)
				scale: 3, // HD Resolution (3x)
				useCORS: true,
				logging: false,
				onclone: (clonedDoc) => {
					// FIX: Handle text gradient clipping issue in html2canvas
					const accentText = clonedDoc.querySelector('.italic-accent') as HTMLElement;
					if (accentText) {
						accentText.style.background = 'none';
						accentText.style.webkitTextFillColor = 'initial';
						accentText.style.color = '#ffffff'; // Fallback to white for clean look
						accentText.style.textShadow = '0 0 20px rgba(255,255,255,0.5)'; // Add glow instead
					}

					// Also fix the main headline if needed
					const headline = clonedDoc.querySelector('.serif-headline') as HTMLElement;
					if (headline) {
						headline.style.color = '#e0e0e0';
					}

					// Hide buttons in clone (alternative to ignoreElements)
					const actions = clonedDoc.querySelector('.actions-row') as HTMLElement;
					if (actions) actions.style.display = 'none';
				}
			});

			const image = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.href = image;
			link.download = `Blancbeu-Ticket-${bookingId || 'Booking'}.png`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (err) {
			console.error('Download failed', err);
			alert('Could not download ticket. Please try taking a screenshot.');
		} finally {
			// Restore state
			glimmerX = prevGlimmerX;
			glimmerY = prevGlimmerY;
			isDownloading = false;
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (!cardElement || isDownloading) return;
		const rect = cardElement.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Shine follows mouse position
		glimmerX = (x / rect.width) * 100;
		glimmerY = (y / rect.height) * 100;
	}

	function handleMouseLeave() {
		glimmerX = 50;
		glimmerY = 50;
	}

	function handleDeviceOrientation(e: DeviceOrientationEvent) {
		if (!cardElement || isDownloading) return;

		// Subtle tilt detection for shine sweep
		const tiltX = e.beta || 0; // Forward/Back tilt (-180..180)
		const tiltY = e.gamma || 0; // Left/Right tilt (-90..90)

		// Map tilt to glimmer position — high sensitivity for even small movements
		glimmerX = Math.max(0, Math.min(100, 50 + tiltY * 1.8));
		glimmerY = Math.max(0, Math.min(100, 50 + tiltX * 1.2));
	}

	onMount(() => {
		if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
			window.addEventListener('deviceorientation', handleDeviceOrientation, true);
		}

		return () => {
			if (window.DeviceOrientationEvent) {
				window.removeEventListener('deviceorientation', handleDeviceOrientation);
			}
		};
	});
</script>

```svelte
<!-- PRISMATIC BACKGROUND -->
<div class="diamond-overlay" bind:this={overlayElement} in:fade={{ duration: 800 }}>
	<div class="prism-bg">
		<div class="prism-light p1"></div>
		<div class="prism-light p2"></div>
		<div class="prism-light p3"></div>
	</div>

	<div class="diamond-content">
		<!-- EDITORIAL HEADER -->
		<div class="editorial-header" in:fly={{ y: -30, duration: 1000, easing: cubicOut }}>
			<div class="status-pill-holo">
				<Heart size={14} class="mr-1" fill="#FF4D4D" stroke="none" />
				<span>CONFIRMED</span>
			</div>
			<h1 class="serif-headline">
				Appointment Booked,<br />
				<span class="italic-accent">Beautiful.</span>
			</h1>
			<p class="status-subtext">
				It's official. Your request has been received.<br />
				We'll confirm shortly and can't wait to see you shine.
			</p>
		</div>

		<!-- DIAMOND CARD -->
		<div
			class="camera-rig"
			on:mousemove={handleMouseMove}
			on:mouseleave={handleMouseLeave}
			role="group"
			aria-label="Booking Confirmation Card"
		>
			<div
				class="diamond-card"
				bind:this={cardElement}
				style="
					--glimmer-x: {glimmerX}%;
					--glimmer-y: {glimmerY}%;
				"
				in:fly={{ y: 50, duration: 1200, delay: 200, easing: elasticOut }}
			>
				<!-- Glass Visual Layer (Separated for text sharpness) -->
				<div class="glass-panel">
					<div class="glimmer-layer"></div>
					<div class="noise-layer"></div>
				</div>

				<!-- Content Layer (Promoted) -->
				<div class="card-body">
					<div class="ticket-header">
						<span class="brand-small">BLANCBEU EXCLUSIVE</span>
						<!-- Holographic Badge Moved Here -->
						<div class="holo-badge">
							<div class="holo-shimmer"></div>
							<span>VIP<br />PASS</span>
						</div>
					</div>

					<div class="ticket-split">
						<!-- LEFT: DATE -->
						<div class="split-col left">
							<span class="label-tiny">DATE</span>
							<div class="date-group">
								<span class="day">{selectedDate ? new Date(selectedDate).getDate() : '--'}</span>
								<span class="month"
									>{selectedDate
										? new Date(selectedDate)
												.toLocaleDateString('en-US', { month: 'short' })
												.toUpperCase()
										: ''}</span
								>
							</div>
						</div>

						<div class="vertical-divider"></div>

						<!-- RIGHT: TIME -->
						<div class="split-col right">
							<span class="label-tiny">TIME</span>
							<div class="time-group">
								<span class="time">{selectedTime?.replace(/\s?[AP]M/i, '') || '--'}</span>
								<span class="ampm">{selectedTime?.match(/[AP]M/i)?.[0] || ''}</span>
							</div>
						</div>
					</div>

					<div class="service-preview">
						<span class="label-tiny">EXPERIENCE</span>
						<div class="service-scroll">
							{#each cartItems as item, i}
								<span class="service-text">{item.name}{i < cartItems.length - 1 ? ' • ' : ''}</span>
							{/each}
						</div>
					</div>

					<!-- QR Code Section -->
					<div class="qr-section">
						<div class="qr-box">
							<QrCode size={56} color="var(--color-text-primary)" strokeWidth={1.5} />
							<div class="scan-lines"></div>
						</div>
						<div class="qr-info">
							<span class="label-tiny">BOOKING ID</span>
							<span class="id-text">{bookingId || '...'}</span>
						</div>
					</div>
				</div>

				<!-- Card Footer (Guest) -->
				<div class="card-bottom">
					<div class="guest-row">
						<span class="label-tiny">GUEST</span>
						<span class="guest-name">{userName}</span>
					</div>
					<div class="total-tag">
						{paymentType === 'free' ? 'PAY AT SALON' : fmt(totalPrice)}
					</div>
				</div>
			</div>
		</div>

		<!-- ACTIONS -->
		<div class="actions-row" in:fade={{ duration: 1000, delay: 600 }}>
			<a href="/" class="btn-diamond">
				<span>Return Home</span>
			</a>
			<div class="secondary-actions">
				<button class="icon-btn" aria-label="Share appointment">
					<Share2 size={18} />
				</button>
				<button
					class="icon-btn"
					aria-label="Download ticket"
					on:click={downloadTicket}
					disabled={isDownloading}
				>
					{#if isDownloading}
						<div class="spinner-mini"></div>
					{:else}
						<Download size={18} />
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* --- ETHEREAL DIAMOND THEME ENGINE --- */

	.diamond-overlay {
		position: fixed;
		inset: 0;
		z-index: 1100;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background: var(--color-bg-primary); /* Dynamic Theme Background */
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		font-family: var(--font-body, sans-serif);
		color: var(--color-text-primary);
		transition:
			background 0.5s ease,
			color 0.5s ease;
	}

	/* PRISMATIC BG */
	.prism-bg {
		position: absolute;
		inset: 0;
		filter: blur(120px);
		opacity: 0.5;
		z-index: 0;
		pointer-events: none;
	}
	.prism-light {
		position: absolute;
		border-radius: 50%;
		animation: drift 20s infinite alternate ease-in-out;
		mix-blend-mode: screen;
	}
	:global([data-theme='clean']) .prism-light {
		mix-blend-mode: multiply;
	}
	:global([data-theme='glitch']) .prism-light {
		mix-blend-mode: difference;
	}

	.p1 {
		top: -20%;
		left: -20%;
		width: 80%;
		height: 80%;
		background: radial-gradient(circle, var(--color-accent-gold), transparent 70%);
	}
	.p2 {
		bottom: -20%;
		right: -20%;
		width: 70%;
		height: 70%;
		background: radial-gradient(circle, var(--color-accent-rose, #8e2de2), transparent 70%);
		animation-delay: -5s;
	}
	.p3 {
		top: 40%;
		left: 40%;
		width: 60%;
		height: 60%;
		background: radial-gradient(circle, var(--color-accent-gold), transparent 70%);
		animation-duration: 25s;
	}

	@keyframes drift {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(50px, -50px) scale(1.1);
		}
	}

	.diamond-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 16px; /* Fixed gap instead of space-evenly distribution */
		width: 100%;
		max-width: 420px;
		min-height: 100vh;
		min-height: 100dvh;
		padding: 24px 16px; /* Top padding for breathing room */
		padding-bottom: max(24px, env(safe-area-inset-bottom));
		box-sizing: border-box;
	}

	/* EDITORIAL HEADER - V7 COOL */
	.editorial-header {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px; /* Further reduced gap */
		flex-shrink: 0;
		width: 100%; /* Ensure full width availability */
	}
	.status-pill-holo {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 100px;
		backdrop-filter: blur(10px);
		color: var(--color-text-primary);
		font-weight: 700;
		font-size: 0.7rem;
		letter-spacing: 2px;
		box-shadow: 0 0 15px rgba(var(--color-shadow-rgb), 0.08);
	}

	.serif-headline {
		font-family: var(--font-heading, serif);
		font-size: clamp(2.8rem, 5vh, 4rem); /* Slightly tuned down for safety */
		line-height: 0.95;
		color: var(--color-text-primary);
		font-weight: 400;
		letter-spacing: -2px;
		text-transform: uppercase;
		margin-top: 4px;
	}
	.italic-accent {
		font-style: italic;
		font-weight: 300;
		background: linear-gradient(135deg, silver, #fff, silver); /* Metallic */
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	/* Theme Override for Headline Accent */
	:global([data-theme='clean']) .italic-accent {
		background: linear-gradient(135deg, #6b8e23, #a4b47d, #8a9a5b);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	:global([data-theme='glitch']) .italic-accent {
		background: linear-gradient(135deg, #6c5dd3, #ff00ff, #00ffff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.status-subtext {
		font-size: clamp(0.8rem, 2vh, 0.9rem);
		color: var(--color-text-secondary);
		opacity: 0.8;
		max-width: 100%; /* FULL WIDTH allowed */
		line-height: 1.35;
		margin-top: 2px;
		padding: 0 10px; /* Small padding to prevent edge touching */
	}

	/* DIAMOND CARD - V7 TEXTURE */
	.camera-rig {
		/* perspective: 1200px;  <-- REMOVED to fix blur */
		width: 100%;
		display: flex;
		justify-content: center;
		flex-shrink: 1; /* Allow shrinking if needed */
		min-height: 0; /* Enable flex shrinking */
	}

	.diamond-card {
		width: 100%;
		min-height: 420px; /* Ensure card has good height */
		/* background, border, shadow moved to .glass-panel */

		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 100%; /* Prevent overflow */
		-webkit-font-smoothing: antialiased;
	}

	/* NEW GLASS PANEL LAYER - PREMIUM CRYSTALLINE */
	.glass-panel {
		position: absolute;
		inset: 0;
		/* Crystalline Gradient: Theme-aware glass tint */
		background: linear-gradient(
			145deg,
			rgba(var(--color-bg-secondary-rgb), 0.3) 0%,
			rgba(var(--color-bg-secondary-rgb), 0.1) 100%
		);
		border-radius: 20px;
		/* Diamond Cut Border: Double rim effect */
		border: 1px solid var(--color-border);
		box-shadow:
			0 0 0 1px rgba(var(--color-shadow-rgb), 0.15),
			inset 0 0 20px rgba(var(--color-accent-gold-rgb), 0.05),
			0 20px 50px -10px rgba(var(--color-shadow-rgb), 0.25);

		/* Enhanced Blur */
		backdrop-filter: blur(40px) brightness(1.1);
		-webkit-backdrop-filter: blur(40px) brightness(1.1);

		z-index: 0;
		pointer-events: none;
	}

	/* NOISE TEXTURE */
	.noise-layer {
		position: absolute;
		inset: 0;
		opacity: 0.05;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
		pointer-events: none;
		z-index: 1;
		mix-blend-mode: overlay;
	}

	.glimmer-layer {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 80% 60% at var(--glimmer-x) var(--glimmer-y),
			rgba(255, 255, 255, 0.35) 0%,
			rgba(var(--color-accent-gold-rgb), 0.18) 30%,
			transparent 70%
		);
		pointer-events: none;
		mix-blend-mode: overlay;
		opacity: 0.8;
		z-index: 2;
		transition: background 0.3s ease-out;
		border-radius: 20px;
	}

	.card-body {
		padding: 18px; /* Slightly reduced */
		display: flex;
		flex-direction: column;
		gap: 12px; /* Tight gap */
		position: relative;
		z-index: 3; /* Ensure content is above glass layers */
		flex: 1;
		overflow-y: auto; /* Scrol content only if absolutely necessary */
		min-height: 0;

		/* Promote text layer to avoid blur from underlying backdrop filter */
		transform: translateZ(1px);
	}

	/* Custom Scrollbar for Card Body */
	.card-body::-webkit-scrollbar {
		width: 4px;
	}
	.card-body::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 4px;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 10px;
		border-bottom: 1px dashed var(--color-border);
		flex-shrink: 0;
	}
	.brand-small {
		font-size: 0.65rem;
		letter-spacing: 2px;
		color: var(--color-text-secondary);
		font-weight: 700;
	}
	.booking-id-tag {
		font-family: 'Geist Mono', monospace;
		font-size: 0.8rem;
		color: var(--color-accent-gold);
		background: rgba(212, 175, 55, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
	}

	/* TICKET SPLIT */
	.ticket-split {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	}
	.split-col {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.split-col.right {
		align-items: flex-end;
		text-align: right;
	}
	.label-tiny {
		font-size: 0.6rem;
		letter-spacing: 2px;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		font-weight: 600;
	}

	.date-group {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.day {
		font-size: 2.2rem;
		font-family: var(--font-heading);
		color: var(--color-text-primary);
		line-height: 0.9;
		letter-spacing: -1px;
	}
	.month {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		letter-spacing: 1px;
	}

	.vertical-divider {
		width: 1px;
		height: 32px;
		background: var(--color-border-strong);
		opacity: 1;
	}

	.time-group {
		display: flex;
		align-items: baseline;
		gap: 2px;
	}
	.time {
		font-size: 1.8rem;
		font-family: var(--font-heading);
		color: var(--color-text-primary);
		font-weight: 400;
		letter-spacing: -0.5px;
	}
	.ampm {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	/* SERVICE PREVIEW */
	.service-preview {
		padding: 8px 0;
		border-top: 1px dashed var(--color-border);
		border-bottom: 1px dashed var(--color-border);
		flex-shrink: 0;
	}
	.service-scroll {
		margin-top: 4px;
		font-size: 0.9rem;
		color: var(--color-text-primary);
		opacity: 0.9;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* QR SECTION */
	.qr-section {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--color-surface);
		padding: 8px;
		border-radius: 12px;
		flex-shrink: 0;
	}
	.qr-box {
		width: 50px; /* Smaller QR container */
		height: 50px;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.scan-lines {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			transparent 40%,
			var(--color-accent-gold) 50%,
			transparent 60%
		);
		opacity: 0.5;
		animation: scan 3s infinite linear;
		pointer-events: none;
	}
	@keyframes scan {
		0% {
			transform: translateY(-50%);
		}
		100% {
			transform: translateY(50%);
		}
	}
	.qr-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.id-text {
		font-family: 'Geist Mono', monospace;
		font-size: 0.95rem; /* Slightly smaller text */
		letter-spacing: 1px;
		color: var(--color-text-primary);
		font-weight: 600;
	}

	/* HOLOGRAPHIC BADGE - V7 COOL */
	.holo-badge {
		position: relative; /* Changed from absolute to flow with header */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 68px;
		height: 68px;
		flex-shrink: 0;
		border-radius: 50%;
		transform: rotate(-15deg);
		background: linear-gradient(135deg, #e0e0e0, #ffffff, #d4af37, #e0e0e0);
		background-size: 200% 200%;

		/* PREMIUM GOLD RIM */
		border: 2px solid rgba(255, 215, 0, 0.4);
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.4),
			/* Inner highlight */ 0 4px 15px rgba(0, 0, 0, 0.2);

		z-index: 20;
		animation:
			holo-shift 3s infinite linear,
			badge-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.8s backwards;
		overflow: hidden;

		/* Optical correction for placement in header */
		margin-right: -8px;
		margin-top: -4px;
		margin-bottom: -4px;
	}

	/* Holo Foil Effect */
	.holo-shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			45deg,
			transparent 25%,
			rgba(255, 0, 255, 0.2) 50%,
			rgba(0, 255, 255, 0.2) 75%,
			transparent 100%
		);
		background-size: 200% 200%;
		mix-blend-mode: color-dodge;
		animation: holo-shift 2s infinite linear reverse;
	}

	@keyframes holo-shift {
		0% {
			background-position: 0% 0%;
		}
		100% {
			background-position: 100% 100%;
		}
	}

	@keyframes badge-pop {
		0% {
			transform: scale(0) rotate(-45deg);
			opacity: 0;
		}
		100% {
			transform: scale(1) rotate(-15deg);
			opacity: 1;
		}
	}

	.holo-badge span {
		font-family: 'Geist Mono', monospace;
		font-size: 0.6rem;
		text-align: center;
		color: #333; /* Dark text on bright foil */
		font-weight: 900;
		line-height: 1;
		letter-spacing: 0.5px;
		z-index: 2;
	}

	/* CARD BOTTOM */
	.card-bottom {
		background: var(--color-surface);
		padding: 12px 18px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid var(--color-border);
		z-index: 3;
		position: relative;
		flex-shrink: 0;
	}
	.guest-row {
		display: flex;
		flex-direction: column;
	}
	.guest-name {
		font-size: 0.95rem;
		color: var(--color-text-primary);
		font-weight: 600;
	}
	.total-tag {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-text-primary);
		background: var(--color-bg-primary);
		padding: 4px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border);
	}

	/* ACTIONS */
	.actions-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		flex-shrink: 0;
		margin-bottom: constant(safe-area-inset-bottom);
		margin-bottom: env(safe-area-inset-bottom);
		padding-bottom: 4px; /* Slight lifting from bottom */
	}
	.btn-diamond {
		flex: 1;
		background: var(--color-text-primary); /* Contrast */
		color: var(--color-bg-primary); /* Contrast */
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.9rem;
		border-radius: 12px;
		letter-spacing: 1px;
		transition: all 0.3s ease;
	}
	.btn-diamond:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-gold);
	}

	.secondary-actions {
		display: flex;
		gap: 12px;
	}
	.icon-btn {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}
	.icon-btn:hover {
		background: var(--color-surface-hover);
		transform: scale(1.05);
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.spinner-mini {
		width: 18px;
		height: 18px;
		border: 2px solid var(--color-border);
		border-radius: 50%;
		border-top-color: var(--color-text-primary);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

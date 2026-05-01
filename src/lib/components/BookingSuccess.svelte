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
	import JsBarcode from 'jsbarcode';

	export let userName = 'Guest';
	export let selectedDate: string | null = null;
	export let selectedTime: string | null = null;
	export let cartItems: any[] = [];
	export let totalPrice = 0;
	export let originalTotal = 0;
	export let paymentType = 'pay_at_salon';
	export let bookingId = '';

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0
		}).format(n);

	function barcode(node: SVGElement | HTMLCanvasElement, text: string) {
		if (text) {
			JsBarcode(node, text, {
				format: 'CODE128',
				lineColor: '#000000', // We'll override with CSS filters if needed, but for barcode standard black is safest
				background: 'transparent',
				width: 2,
				height: 40,
				displayValue: false,
				margin: 0
			});
		}
		return {
			update(newText: string) {
				if (newText) {
					JsBarcode(node, newText, {
						format: 'CODE128',
						lineColor: '#000000',
						background: 'transparent',
						width: 2,
						height: 40,
						displayValue: false,
						margin: 0
					});
				}
			}
		};
	}

	// Derived: label for payment method shown in the ticket
	$: paymentLabel =
		paymentType === 'free'
			? '🏪 Pay at Salon'
			: paymentType === 'token'
				? '⚡ Book with ₹50'
				: '🔒 Paid Online';

	// Show strikethrough only when there's an actual discount
	$: showStrike = originalTotal > totalPrice && originalTotal > 0;

	// Determine if booking is instantly confirmed based on payment type
	$: isConfirmed = paymentType === 'full' || paymentType === 'token';

	// --- SHINE / GLIMMER ---
	let cardElement: HTMLDivElement;
	let overlayElement: HTMLDivElement;
	let glimmerX = 50;
	let glimmerY = 50;
	let isDownloading = false;
	let isSharing = false;

	async function generateTicketCanvas() {
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
					const actions = clonedDoc.querySelector('.actions-container') as HTMLElement;
					if (actions) actions.style.display = 'none';

					const diamondContent = clonedDoc.querySelector('.diamond-content') as HTMLElement;
					if (diamondContent) {
						// Remove the extra padding at bottom so the captured image doesn't have blank space
						diamondContent.style.paddingBottom = '24px';
					}
				}
			});
			return canvas;
		} finally {
			// Restore state
			glimmerX = prevGlimmerX;
			glimmerY = prevGlimmerY;
		}
	}

	async function downloadTicket() {
		if (!overlayElement || isDownloading || isSharing) return;

		isDownloading = true;

		try {
			const canvas = await generateTicketCanvas();
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
			isDownloading = false;
		}
	}

	async function shareTicket() {
		if (!overlayElement || isDownloading || isSharing) return;

		// 1. Check if the Web Share API is supported
		if (!navigator.share || !navigator.canShare) {
			alert('Sharing is not supported on this device/browser. Please download the ticket instead.');
			return;
		}

		isSharing = true;

		try {
			const canvas = await generateTicketCanvas();

			// Convert canvas to Blob
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
			if (!blob) throw new Error('Blob creation failed');

			// Create a File object from the blob
			const file = new File([blob], `Blancbeu-Ticket-${bookingId || 'Booking'}.png`, {
				type: 'image/png'
			});

			// Check if this file can be shared natively
			if (navigator.canShare({ files: [file] })) {
				await navigator.share({
					title: 'My Blancbeu Appointment',
					text: 'Here is my appointment ticket for Blancbeu!',
					files: [file]
				});
			} else {
				alert(
					'Your system does not support sharing images directly. Please download the ticket instead.'
				);
			}
		} catch (err: any) {
			// Don't show an error if the user just cancelled the share sheet
			if (err.name !== 'AbortError') {
				console.error('Share failed', err);
				alert('Could not share ticket. Please download it instead.');
			}
		} finally {
			isSharing = false;
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

	import { browser } from '$app/environment';
	import { requestNotificationToken } from '$lib/capacitor/pushService';
	import { user } from '$lib/stores/auth';
	import NotificationPrompt from '$lib/components/NotificationPrompt.svelte';

	let notifPromptRef: any;

	onMount(() => {
		if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
			window.addEventListener('deviceorientation', handleDeviceOrientation, true);
		}

		// Contextual trigger: after completing a booking, ask for notifications
		// after a 3-second delay so the user has time to enjoy their confirmation.
		if (browser) {
			setTimeout(() => {
				notifPromptRef?.show();
			}, 3000);
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
				{#if isConfirmed}
					It's official. Your request has been received and confirmed.<br />
					We can't wait to see you shine.
				{:else}
					It's official. Your request has been received.<br />
					We'll confirm shortly and can't wait to see you shine.
				{/if}
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
						<div class="brand-info">
							<span class="brand-small"
								>{isConfirmed ? 'CONFIRMED APPOINTMENT' : 'AWAITING CONFIRMATION'}</span
							>
							<h2 class="salon-name">Blancbeu Beauty Salon</h2>
						</div>
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

					<!-- Codes Section -->
					<div class="codes-wrapper">
						<div class="qr-row">
							<div class="qr-box">
								<QrCode size={56} color="var(--color-text-primary)" strokeWidth={1.5} />
								<div class="scan-lines"></div>
							</div>
							<div class="qr-info">
								<span class="label-tiny">BOOKING ID</span>
								<span class="id-text">{bookingId || '...'}</span>
							</div>
						</div>
						<div class="barcode-row">
							<svg use:barcode={bookingId || 'NO-ID'} class="barcode-svg"></svg>
						</div>
					</div>
				</div>

				<!-- Card Footer (Guest, Payment Method & Amount) -->
				<div class="card-bottom">
					<!-- LEFT: Guest Name -->
					<div class="guest-row">
						<span class="label-tiny">GUEST</span>
						<span class="guest-name">{userName}</span>
					</div>

					<!-- RIGHT: Payment Method & Amount -->
					<div class="payment-amount-right">
						<span class="payment-method-label">{paymentLabel}</span>
						<div class="amount-col">
							{#if showStrike}
								<span class="amount-original">{fmt(originalTotal)}</span>
							{/if}
							<span class="amount-final">{fmt(totalPrice)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ACTIONS BAR -->
	<div class="actions-container" in:fade={{ duration: 1000, delay: 600 }}>
		<div class="actions-row">
			<a href="/" class="btn-diamond">
				<span>Return Home</span>
			</a>
			<div class="secondary-actions">
				<button
					class="icon-btn"
					aria-label="Share appointment"
					on:click={shareTicket}
					disabled={isSharing}
				>
					{#if isSharing}
						<div class="spinner-mini"></div>
					{:else}
						<Share2 size={18} />
					{/if}
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

<NotificationPrompt bind:this={notifPromptRef} />

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
		overflow: hidden; /* Fix phantom scrolling gap */
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
		gap: 16px;
		width: 100%;
		max-width: 480px; /* Increased ticket size */
		padding: 24px 16px;
		padding-bottom: 100px; /* Space for the fixed bottom bar */
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
		background: linear-gradient(135deg, #d4af37, #f7e7ce, #d4af37); /* Gold metallic for dark bg */
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
		opacity: 0.9;
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
		/* Crystalline Gradient: Theme-aware glass tint — more opaque for dark mode readability */
		background: linear-gradient(
			145deg,
			rgba(var(--color-bg-secondary-rgb), 0.85) 0%,
			rgba(var(--color-bg-secondary-rgb), 0.75) 100%
		);
		border-radius: 20px;
		/* Diamond Cut Border: Double rim effect */
		border: 1px solid rgba(255, 255, 255, 0.25);
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.08),
			inset 0 0 30px rgba(var(--color-accent-gold-rgb), 0.08),
			0 20px 50px -10px rgba(0, 0, 0, 0.5);

		/* Enhanced Blur */
		backdrop-filter: blur(40px) brightness(1.1);
		-webkit-backdrop-filter: blur(40px) brightness(1.1);

		z-index: 0;
		pointer-events: none;
	}
	/* Light theme: stronger glass panel for better card visibility */
	:global([data-theme='clean']) .glass-panel {
		background: linear-gradient(
			145deg,
			rgba(255, 255, 255, 0.92) 0%,
			rgba(245, 245, 245, 0.88) 100%
		);
		border: 1px solid rgba(0, 0, 0, 0.15);
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.06),
			0 20px 50px -10px rgba(0, 0, 0, 0.12);
		backdrop-filter: blur(40px) brightness(1.02);
		-webkit-backdrop-filter: blur(40px) brightness(1.02);
	}
	:global([data-theme='glitch']) .glass-panel {
		background: linear-gradient(
			145deg,
			rgba(245, 245, 255, 0.85) 0%,
			rgba(235, 235, 250, 0.8) 100%
		);
		border: 1px solid rgba(108, 93, 211, 0.2);
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
			rgba(255, 255, 255, 0.2) 0%,
			rgba(var(--color-accent-gold-rgb), 0.1) 30%,
			transparent 70%
		);
		pointer-events: none;
		mix-blend-mode: soft-light;
		opacity: 0.6;
		z-index: 2;
		transition: background 0.3s ease-out;
		border-radius: 20px;
	}
	/* Light theme: use soft-light instead of overlay so glimmer is visible on white */
	:global([data-theme='clean']) .glimmer-layer,
	:global([data-theme='glitch']) .glimmer-layer {
		background: radial-gradient(
			ellipse 80% 60% at var(--glimmer-x) var(--glimmer-y),
			rgba(var(--color-accent-gold-rgb), 0.15) 0%,
			rgba(var(--color-accent-gold-rgb), 0.06) 30%,
			transparent 70%
		);
		mix-blend-mode: normal;
		opacity: 1;
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
		align-items: flex-start;
		padding-bottom: 12px;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
		flex-shrink: 0;
	}
	.brand-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.salon-name {
		font-family: var(--font-heading, serif);
		font-size: 1.4rem;
		color: var(--color-text-primary);
		font-weight: 500;
		letter-spacing: -0.5px;
		margin: 0;
		line-height: 1.1;
	}
	.brand-small {
		font-size: 0.65rem;
		letter-spacing: 2px;
		color: var(--color-accent-gold);
		font-weight: 700;
		opacity: 0.9;
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
		color: var(--color-accent-gold);
		text-transform: uppercase;
		font-weight: 600;
		opacity: 0.85;
	}
	/* Light themes: labels use secondary text */
	:global([data-theme='clean']) .label-tiny {
		color: var(--color-text-secondary);
		opacity: 1;
	}
	:global([data-theme='glitch']) .label-tiny {
		color: var(--color-text-secondary);
		opacity: 1;
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
		color: var(--color-text-primary);
		letter-spacing: 1px;
		opacity: 0.8;
	}

	.vertical-divider {
		width: 1px;
		height: 32px;
		background: rgba(255, 255, 255, 0.25);
		opacity: 1;
	}
	:global([data-theme='clean']) .vertical-divider,
	:global([data-theme='glitch']) .vertical-divider {
		background: var(--color-border-strong);
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
		color: var(--color-text-primary);
		font-weight: 500;
		opacity: 0.75;
	}

	/* SERVICE PREVIEW */
	.service-preview {
		padding: 8px 0;
		border-top: 1px dashed rgba(255, 255, 255, 0.18);
		border-bottom: 1px dashed rgba(255, 255, 255, 0.18);
		flex-shrink: 0;
	}
	:global([data-theme='clean']) .service-preview,
	:global([data-theme='glitch']) .service-preview {
		border-color: var(--color-border);
	}
	.service-scroll {
		margin-top: 4px;
		font-size: 0.9rem;
		color: var(--color-text-primary);
		opacity: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* CODES SECTION */
	.codes-wrapper {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: rgba(255, 255, 255, 0.08);
		padding: 12px;
		border-radius: 12px;
		flex-shrink: 0;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}
	/* Light themes: more visible codes section */
	:global([data-theme='clean']) .codes-wrapper {
		background: rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(0, 0, 0, 0.1);
	}
	:global([data-theme='glitch']) .codes-wrapper {
		background: rgba(108, 93, 211, 0.06);
		border: 1px solid rgba(108, 93, 211, 0.15);
	}
	.qr-row {
		display: flex;
		align-items: center;
		gap: 12px;
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
	.barcode-row {
		display: flex;
		justify-content: center;
		padding-top: 12px;
		border-top: 1px dashed rgba(255, 255, 255, 0.15);
		width: 100%;
	}
	:global([data-theme='clean']) .barcode-row,
	:global([data-theme='glitch']) .barcode-row {
		border-top-color: var(--color-border);
	}
	.barcode-svg {
		width: 100%;
		max-height: 40px;
		/* Default (Midnight Gold) theme is dark — invert black barcode to gold/white */
		filter: invert(1) brightness(1.2);
	}
	/* Light themes: barcode should stay black, so undo the invert */
	:global([data-theme='clean']) .barcode-svg,
	:global([data-theme='glitch']) .barcode-svg {
		filter: none;
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

	/* CARD BOTTOM — 2-column layout */
	.card-bottom {
		background: rgba(255, 255, 255, 0.06);
		padding: 12px 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
		z-index: 3;
		position: relative;
		flex-shrink: 0;
	}
	/* Light themes: card bottom needs distinct background */
	:global([data-theme='clean']) .card-bottom {
		background: rgba(0, 0, 0, 0.04);
		border-top: 1px solid rgba(0, 0, 0, 0.12);
	}
	:global([data-theme='glitch']) .card-bottom {
		background: rgba(108, 93, 211, 0.06);
		border-top: 1px solid rgba(108, 93, 211, 0.15);
	}
	.guest-row {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.guest-name {
		font-size: 0.9rem;
		color: var(--color-text-primary);
		font-weight: 600;
	}

	/* RIGHT: Payment method and amount */
	.payment-amount-right {
		display: flex;
		align-items: center;
		gap: 12px;
		text-align: right;
	}
	.payment-method-label {
		background: rgba(212, 175, 55, 0.12);
		border: 1px solid rgba(212, 175, 55, 0.35);
		color: #e8c84a;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.5px;
		padding: 6px 12px;
		border-radius: 100px;
		white-space: nowrap;
	}
	/* Light themes: payment label needs stronger contrast */
	:global([data-theme='clean']) .payment-method-label {
		background: rgba(107, 142, 35, 0.08);
		border-color: rgba(107, 142, 35, 0.3);
		color: #5a7a1e;
	}
	:global([data-theme='glitch']) .payment-method-label {
		background: rgba(108, 93, 211, 0.08);
		border-color: rgba(108, 93, 211, 0.3);
		color: #6c5dd3;
	}

	.amount-col {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 1px;
	}
	.amount-original {
		font-family: 'Geist Mono', monospace;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		text-decoration: line-through;
		opacity: 0.7;
	}
	.amount-final {
		font-family: 'Geist Mono', monospace;
		font-weight: 700;
		color: var(--color-text-primary);
		font-size: 1.25rem;
		line-height: 1.1;
	}

	/* ACTIONS BAR - FIXED BOTTOM */
	.actions-container {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 16px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		background: var(--color-bg-glass-heavy);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 1px solid var(--color-border-strong);
		z-index: 100;
		display: flex;
		justify-content: center;
		box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.08);
	}
	/* Light theme: actions bar needs solid bg */
	:global([data-theme='clean']) .actions-container {
		background: rgba(249, 249, 249, 0.95);
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
	}

	.actions-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 480px; /* Match ticket max width */
		flex-shrink: 0;
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

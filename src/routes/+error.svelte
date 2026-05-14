<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	let status = $derived(page.status);
	let error = $derived(page.error);

	let is404 = $derived(status === 404);
	let is500 = $derived(status >= 500);

	let displayTitle = $derived(
		is404 ? 'Page Not Found' : is500 ? 'Server Error' : 'Something Went Wrong'
	);
	let displayMessage = $derived(
		is404
			? "The page you're looking for doesn't exist or has been moved."
			: is500
				? "Our servers ran into a problem. We're working on it."
				: error?.message || 'An unexpected error occurred. Please try again.'
	);

	let displayIcon = $derived(is404 ? '🔍' : is500 ? '⚡' : '⚠️');

	// Animate particles on mount
	let mounted = $state(false);
	let particles: Array<{ x: number; y: number; size: number; delay: number; duration: number }> =
		$state([]);

	onMount(() => {
		// Generate floating particles
		particles = Array.from({ length: 20 }, () => ({
			x: Math.random() * 100,
			y: Math.random() * 100,
			size: Math.random() * 4 + 2,
			delay: Math.random() * 5,
			duration: Math.random() * 8 + 6
		}));

		setTimeout(() => (mounted = true), 50);
	});
</script>

<svelte:head>
	<title>{status} - {displayTitle}</title>
</svelte:head>

<div class="error-page" class:mounted>
	<!-- Ambient background -->
	<div class="ambient-layer">
		<div class="orb orb-1"></div>
		<div class="orb orb-2"></div>
		<div class="orb orb-3"></div>
	</div>

	<!-- Floating particles -->
	<div class="particles">
		{#each particles as p}
			<div
				class="particle"
				style="left: {p.x}%; top: {p.y}%; width: {p.size}px; height: {p.size}px; animation-delay: {p.delay}s; animation-duration: {p.duration}s;"
			></div>
		{/each}
	</div>

	<!-- Main content -->
	<div class="error-hero">
		<!-- Massive status code as background watermark -->
		<div class="watermark" aria-hidden="true">{status}</div>

		<!-- Icon -->
		<div class="error-icon">
			<div class="icon-ring">
				<div class="icon-ring-inner">
					<span class="icon-emoji">{displayIcon}</span>
				</div>
			</div>
		</div>

		<!-- Status code -->
		<div class="status-code">
			{#each String(status).split('') as digit, i}
				<span class="digit" style="animation-delay: {0.15 + i * 0.1}s">{digit}</span>
			{/each}
		</div>

		<!-- Separator -->
		<div class="separator">
			<div class="sep-line"></div>
			<div class="sep-dot"></div>
			<div class="sep-line"></div>
		</div>

		<!-- Title -->
		<h1 class="error-title">{displayTitle}</h1>

		<!-- Message -->
		<p class="error-desc">{displayMessage}</p>

		<!-- Actions -->
		<div class="actions">
			<a href="/" class="btn-primary" data-sveltekit-preload-data="hover">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
					<polyline points="9 22 9 12 15 12 15 22"></polyline>
				</svg>
				<span>Go Home</span>
			</a>

			<button class="btn-secondary" onclick={() => history.back()}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="19" y1="12" x2="5" y2="12"></line>
					<polyline points="12 19 5 12 12 5"></polyline>
				</svg>
				<span>Go Back</span>
			</button>
		</div>

		<!-- Decorative bottom detail -->
		<div class="footer-detail">
			<span class="footer-text">Error {status}</span>
			<span class="footer-dot">·</span>
			<span class="footer-text">Blancbeu</span>
		</div>
	</div>
</div>

<style>
	/* ===== FULL-PAGE ERROR LAYOUT ===== */
	.error-page {
		position: relative;
		width: 100%;
		min-height: calc(100vh - 136px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: 40px 24px;
		background: var(--color-bg-primary);
	}

	/* ===== AMBIENT BACKGROUND ===== */
	.ambient-layer {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0;
		animation: orbFadeIn 1.5s ease forwards;
	}

	.orb-1 {
		width: 280px;
		height: 280px;
		background: var(--color-accent-gold);
		top: -60px;
		right: -80px;
		opacity: 0.08;
		animation:
			orbFloat1 12s infinite alternate ease-in-out,
			orbFadeIn 1.5s ease forwards;
	}

	.orb-2 {
		width: 200px;
		height: 200px;
		background: var(--color-accent-rose);
		bottom: 10%;
		left: -60px;
		opacity: 0.06;
		animation:
			orbFloat2 10s infinite alternate ease-in-out,
			orbFadeIn 1.5s 0.3s ease forwards;
	}

	.orb-3 {
		width: 160px;
		height: 160px;
		background: var(--color-accent-gold);
		top: 40%;
		left: 50%;
		opacity: 0.04;
		animation:
			orbFloat3 14s infinite alternate ease-in-out,
			orbFadeIn 1.5s 0.6s ease forwards;
	}

	@keyframes orbFadeIn {
		to {
			opacity: 0.1;
		}
	}

	@keyframes orbFloat1 {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(-30px, 40px) scale(1.15);
		}
	}

	@keyframes orbFloat2 {
		0% {
			transform: translate(0, 0) scale(1);
		}
		100% {
			transform: translate(40px, -30px) scale(1.1);
		}
	}

	@keyframes orbFloat3 {
		0% {
			transform: translate(-50%, 0) scale(1);
		}
		100% {
			transform: translate(-50%, -40px) scale(1.2);
		}
	}

	/* ===== PARTICLES ===== */
	.particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
	}

	.particle {
		position: absolute;
		border-radius: 50%;
		background: var(--color-accent-gold);
		opacity: 0.15;
		animation: particleFloat linear infinite;
	}

	@keyframes particleFloat {
		0%,
		100% {
			transform: translateY(0) translateX(0);
			opacity: 0.08;
		}
		25% {
			transform: translateY(-20px) translateX(10px);
			opacity: 0.2;
		}
		50% {
			transform: translateY(-10px) translateX(-8px);
			opacity: 0.12;
		}
		75% {
			transform: translateY(-25px) translateX(5px);
			opacity: 0.18;
		}
	}

	/* ===== WATERMARK ===== */
	.watermark {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-family: var(--font-heading);
		font-size: clamp(12rem, 40vw, 20rem);
		font-weight: 700;
		color: var(--color-accent-gold);
		opacity: 0.03;
		line-height: 1;
		pointer-events: none;
		user-select: none;
		z-index: 0;
		letter-spacing: -8px;
	}

	/* ===== HERO CONTENT ===== */
	.error-hero {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		width: 100%;
		max-width: 380px;
	}

	/* ===== ICON ===== */
	.error-icon {
		margin-bottom: 28px;
		opacity: 0;
		transform: scale(0.5);
		animation: iconEntrance 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards;
	}

	@keyframes iconEntrance {
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.icon-ring {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			rgba(var(--color-accent-gold-rgb), 0.12),
			rgba(var(--color-accent-gold-rgb), 0.04)
		);
		border: 1px solid rgba(var(--color-accent-gold-rgb), 0.2);
		animation: ringPulse 3s infinite ease-in-out;
	}

	@keyframes ringPulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(var(--color-accent-gold-rgb), 0.1);
		}
		50% {
			box-shadow: 0 0 0 16px rgba(var(--color-accent-gold-rgb), 0);
		}
	}

	.icon-ring-inner {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-bg-glass);
		border: 1px solid rgba(var(--color-accent-gold-rgb), 0.15);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.icon-emoji {
		font-size: 1.8rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ===== STATUS CODE ===== */
	.status-code {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
	}

	.digit {
		font-family: var(--font-heading);
		font-size: 4.5rem;
		font-weight: 700;
		line-height: 1;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		opacity: 0;
		transform: translateY(30px);
		animation: digitSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes digitSlideUp {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ===== SEPARATOR ===== */
	.separator {
		display: flex;
		align-items: center;
		width: 120px;
		gap: 10px;
		margin-bottom: 20px;
		opacity: 0;
		animation: fadeIn 0.5s 0.5s ease forwards;
	}

	.sep-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(var(--color-accent-gold-rgb), 0.4),
			transparent
		);
	}

	.sep-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-accent-gold);
		box-shadow: 0 0 12px rgba(var(--color-accent-gold-rgb), 0.4);
		animation: dotGlow 2s infinite alternate ease-in-out;
	}

	@keyframes dotGlow {
		0% {
			box-shadow: 0 0 8px rgba(var(--color-accent-gold-rgb), 0.3);
			transform: scale(1);
		}
		100% {
			box-shadow: 0 0 18px rgba(var(--color-accent-gold-rgb), 0.6);
			transform: scale(1.2);
		}
	}

	/* ===== TITLE ===== */
	.error-title {
		font-family: var(--font-heading);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 0 0 12px 0;
		letter-spacing: 0.3px;
		opacity: 0;
		transform: translateY(16px);
		animation: slideUp 0.6s 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	/* ===== DESCRIPTION ===== */
	.error-desc {
		font-family: var(--font-body);
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
		margin: 0 0 36px 0;
		max-width: 300px;
		opacity: 0;
		transform: translateY(16px);
		animation: slideUp 0.6s 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes slideUp {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fadeIn {
		to {
			opacity: 1;
		}
	}

	/* ===== ACTIONS ===== */
	.actions {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		max-width: 280px;
		opacity: 0;
		transform: translateY(20px);
		animation: slideUp 0.6s 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.btn-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 15px 28px;
		border: none;
		border-radius: var(--radius-full);
		background: var(--gradient-gold);
		color: #000;
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 20px rgba(var(--color-accent-gold-rgb), 0.25);
	}

	.btn-primary:hover {
		transform: translateY(-3px);
		box-shadow: 0 8px 30px rgba(var(--color-accent-gold-rgb), 0.35);
	}

	.btn-primary:active {
		transform: translateY(0) scale(0.97);
	}

	.btn-secondary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 14px 28px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		color: var(--color-text-primary);
		font-family: var(--font-body);
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.3s ease;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.btn-secondary:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-border-hover);
		transform: translateY(-2px);
	}

	.btn-secondary:active {
		transform: translateY(0) scale(0.97);
	}

	/* ===== FOOTER DETAIL ===== */
	.footer-detail {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 48px;
		opacity: 0;
		animation: fadeIn 0.5s 1s ease forwards;
	}

	.footer-text {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--color-text-muted);
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}

	.footer-dot {
		color: var(--color-accent-gold);
		font-size: 0.9rem;
	}

	/* ===== MOUNT ANIMATION ===== */
	.error-page.mounted .error-hero {
		transform: none;
	}
</style>

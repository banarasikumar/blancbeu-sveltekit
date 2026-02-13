<script lang="ts">
	import { onMount } from 'svelte';
	import LazyImage from '$lib/components/ui/LazyImage.svelte';
	import { user } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	// Import images
	import img1 from '$lib/assets/home/1.webp';
	import img2 from '$lib/assets/home/2.webp';
	import img4 from '$lib/assets/home/4.webp';

	const slides = [
		{
			id: 1,
			src: img1,
			alt: 'Redefining Elegance',
			eyebrow: 'WELCOME TO BLANCBEU',
			title: 'Redefining Elegance',
			subtitle: 'Experience the pinnacle of luxury beauty services.'
		},
		{
			id: 2,
			src: img2,
			alt: 'Premium Spa',
			eyebrow: 'RELAX & REJUVENATE',
			title: 'Sanctuary of Peace',
			subtitle: 'Relax with our world-class spa treatments.'
		},
		{
			id: 3,
			src: img4,
			alt: 'Expert Styling',
			eyebrow: 'ARTISTRY IN MOTION',
			title: 'Expert Styling',
			subtitle: 'Where expert styling meets your personal vision.'
		}
	];

	let currentIndex = 0;
	let autoplayInterval: any;

	const nextSlide = () => {
		currentIndex = (currentIndex + 1) % slides.length;
	};

	const goToSlide = (index: number) => {
		currentIndex = index;
		resetTimer();
	};

	const resetTimer = () => {
		clearInterval(autoplayInterval);
		autoplayInterval = setInterval(nextSlide, 5000);
	};

	import { saveLoginState } from '$lib/services/authService';

	const handleBookAppointment = () => {
		if ($user) {
			goto('/booking');
		} else {
			saveLoginState('booking_intent'); // Use a flag or path
			// Actually, let's just save the path directly for simplicity in authService
			// But authService.ts has saveLoginState implementation that takes an 'action'
			// Let's check authService.ts again to match its API.
			// It takes (action: string | null).
			// We'll update authService to handle paths better, but for now let's pass a custom action 'redirect:/booking'
			// Or better, let's just update authService first to be cleaner.
			// Re-reading plan: "Modify handleBookAppointment, call saveLoginState('/booking')"
			// I will follow the plan and update authService to match.
			saveLoginState('/booking');
			goto('/login');
		}
	};

	onMount(() => {
		resetTimer();
		return () => clearInterval(autoplayInterval);
	});
</script>

<div class="hero-carousel">
	<!-- All slides stacked; only active one visible via CSS opacity (no flash) -->
	{#each slides as slide, index}
		<div class="slide-container" class:active={index === currentIndex}>
			<LazyImage
				src={slide.src}
				alt={slide.alt}
				width="100%"
				height="100%"
				className="hero-image"
				loading={index === 0 ? 'eager' : 'lazy'}
			/>
			<div class="overlay"></div>
			<div class="content">
				<div class="eyebrow-container">
					<span class="line"></span>
					<span class="eyebrow">{slide.eyebrow}</span>
					<span class="line"></span>
				</div>
				<h1 class="hero-title">{slide.title}</h1>
				<p class="hero-subtitle">{slide.subtitle}</p>
				<div class="cta-group">
					<button class="hero-btn primary" on:click={handleBookAppointment}>Book Appointment</button
					>
					<button class="hero-btn secondary" on:click={() => goto('/services')}
						>Explore Services</button
					>
				</div>
			</div>
		</div>
	{/each}

	<!-- Indicators OUTSIDE slides — always visible, never flicker -->
	<div class="indicators">
		{#each slides as _, i}
			<button
				class="dot"
				class:active={i === currentIndex}
				on:click={() => goToSlide(i)}
				aria-label="Go to slide {i + 1}"
			></button>
		{/each}
	</div>
</div>

<style>
	.hero-carousel {
		position: relative;
		width: 100%;
		height: 100dvh;
		min-height: 500px;
		overflow: hidden;
		background: var(--color-bg-secondary);
		--header-offset: 0px;
		--nav-height: 70px;
	}

	/* --- Slide transition via CSS opacity (eliminates initial flash) --- */
	.slide-container {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.8s ease;
		pointer-events: none;
	}

	.slide-container.active {
		opacity: 1;
		pointer-events: auto;
	}

	/* Gradient Overlay */
	.overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.95) 0%,
			rgba(0, 0, 0, 0.6) 40%,
			rgba(0, 0, 0, 0.2) 70%,
			rgba(0, 0, 0, 0.1) 100%
		);
		pointer-events: none;
		z-index: 1;
	}

	:global(.hero-image img) {
		object-position: top center;
	}

	/* --- Content: responsive bottom positioning --- */
	.content {
		position: absolute;
		left: 0;
		width: 100%;
		height: auto;
		/* bottom = navHeight + headerOffset + spacing for indicators + gap */
		bottom: calc(var(--nav-height) + var(--header-offset) + 38px);
		padding: 0 20px;
		z-index: 2;
		color: white;
		text-align: center;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		pointer-events: none;
	}

	.content > * {
		pointer-events: auto;
	}

	.eyebrow-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 12px;
		opacity: 0;
		animation: fadeUp 0.8s ease forwards 0.3s;
	}

	.hero-title {
		font-size: clamp(1.75rem, 5vw, 2.5rem);
		line-height: 1.1;
		margin-bottom: 12px;
		font-family: 'Cinzel', serif;
		color: white;
		text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		opacity: 0;
		animation: fadeUp 0.8s ease forwards 0.5s;
	}

	.hero-subtitle {
		font-size: clamp(0.8rem, 2.5vw, 1rem);
		color: rgba(255, 255, 255, 0.9);
		margin-bottom: clamp(16px, 2.5vh, 28px);
		max-width: 400px;
		line-height: 1.5;
		font-family: 'Inter', sans-serif;
		font-weight: 300;
		opacity: 0;
		animation: fadeUp 0.8s ease forwards 0.7s;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.cta-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(10px, 1.5vh, 16px);
		width: 100%;
		max-width: 320px;
		opacity: 0;
		animation: fadeUp 0.8s ease forwards 0.9s;
	}

	.hero-btn {
		width: auto;
		padding: clamp(12px, 2vh, 18px) 40px;
		font-size: clamp(0.875rem, 2.5vw, 1rem);
		font-weight: 600;
		transition:
			transform 0.2s,
			background 0.3s;
		border-radius: var(--radius-full);
		letter-spacing: 0.02em;
	}

	.hero-btn:active {
		transform: scale(0.98);
	}

	.hero-btn.primary {
		background: var(--gradient-gold);
		color: black;
		box-shadow: 0 10px 30px rgba(212, 175, 55, 0.3);
		border: none;
	}

	.hero-btn.secondary {
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
	}

	.hero-btn.secondary:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	@keyframes fadeUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* --- Indicators: always visible, responsive position above nav --- */
	.indicators {
		position: absolute;
		/* bottom = navHeight + headerOffset + small gap */
		bottom: calc(var(--nav-height) + var(--header-offset) + 16px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		z-index: 20;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		transition: all 0.3s;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.dot.active {
		width: 24px;
		border-radius: 12px;
		background: var(--color-accent-gold);
	}

	/* --- Responsive: short screens (landscape, iPhone SE) --- */
	@media (max-height: 600px) {
		.hero-carousel {
			--header-offset: 50px;
			--nav-height: 60px;
		}
	}
</style>

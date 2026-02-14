<script lang="ts">
	import { onMount } from 'svelte';

	// Import assets
	import hairBefore from '$lib/assets/stock/hair_color_before.png';
	import hairAfter from '$lib/assets/stock/hair_color_after.png';
	import keratinBefore from '$lib/assets/stock/keratin_before.png';
	import keratinAfter from '$lib/assets/stock/keratin_after.png';
	import makeupBefore from '$lib/assets/stock/makeup_zenz_before.png';
	import makeupAfter from '$lib/assets/stock/makeup_zenz_after.png';
	import nailsBefore from '$lib/assets/stock/nails_art_before.png';
	import nailsAfter from '$lib/assets/stock/nails_art_after.png';

	const transformations = [
		{
			category: 'hair',
			title: 'Hair Color Transformation',
			desc: 'Beautiful balayage highlights by our expert colorists',
			before: hairBefore,
			after: hairAfter
		},
		{
			category: 'hair',
			title: 'Keratin & Color Transformation',
			desc: 'Premium Keratin treatment with Rose Gold Balayage',
			before: keratinBefore,
			after: keratinAfter
		},
		{
			category: 'makeup',
			title: 'Celebrity Glam Makeup',
			desc: 'Red carpet ready look with flawless finish',
			before: makeupBefore,
			after: makeupAfter
		},
		{
			category: 'nails',
			title: 'Creative Nail Art',
			desc: 'Stunning extensions with custom hand-painted design',
			before: nailsBefore,
			after: nailsAfter
		}
	];

	let activeCategory = 'all';
	let currentIndex = 0;
	let sliderPosition = 50;
	let container: HTMLElement;
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let isHorizontalSwipe = false;
	let isVerticalSwipe = false;

	$: filteredItems =
		activeCategory === 'all'
			? transformations
			: transformations.filter((t) => t.category === activeCategory);

	$: currentItem = filteredItems[currentIndex] || filteredItems[0];

	$: if (filteredItems) {
		// Reset index when category changes
		currentIndex = 0;
		sliderPosition = 50;
	}

	const setCategory = (cat: string) => {
		activeCategory = cat;
	};

	const nextSlide = () => {
		currentIndex = (currentIndex + 1) % filteredItems.length;
		sliderPosition = 50;
	};

	const prevSlide = () => {
		currentIndex = (currentIndex - 1 + filteredItems.length) % filteredItems.length;
		sliderPosition = 50;
	};

	const handleStart = (e: MouseEvent | TouchEvent) => {
		isDragging = true;
		// Reset flags
		isHorizontalSwipe = false;
		isVerticalSwipe = false;

		if ('touches' in e) {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
		} else {
			// For mouse, we treat it as always valid for dragging the slider
			// preventing default behavior isn't usually necessary for mouse on desktop
			// but we can set flags if needed.
			startX = e.clientX;
			startY = e.clientY;
			isHorizontalSwipe = true; // Assume mouse drag on slider is always intended
		}
	};

	const handleEnd = () => {
		isDragging = false;
		isHorizontalSwipe = false;
		isVerticalSwipe = false;
	};

	const handleMove = (e: MouseEvent | TouchEvent) => {
		if (!isDragging || !container) return;

		let clientX;

		if ('touches' in e) {
			const touch = e.touches[0];
			clientX = touch.clientX;
			const clientY = touch.clientY;

			// If we haven't decided the direction yet
			if (!isHorizontalSwipe && !isVerticalSwipe) {
				const diffX = Math.abs(clientX - startX);
				const diffY = Math.abs(clientY - startY);

				// Increased threshold slightly to avoid jitter
				if (diffX > 5 || diffY > 5) {
					if (diffX > diffY) {
						isHorizontalSwipe = true;
					} else {
						isVerticalSwipe = true;
					}
				}
			}

			// If it's a vertical swipe, let the browser handle scrolling
			if (isVerticalSwipe) {
				return;
			}

			// If it's a horizontal swipe, prevent scrolling and update slider
			if (isHorizontalSwipe) {
				if (e.cancelable) e.preventDefault();
			} else {
				// If strictly neither (very small movement), do nothing or return
				return;
			}
		} else {
			// Mouse event
			clientX = e.clientX;
			e.preventDefault(); // Prevent text selection etc.
		}

		const rect = container.getBoundingClientRect();
		let pos = ((clientX - rect.left) / rect.width) * 100;
		pos = Math.max(0, Math.min(100, pos));
		sliderPosition = pos;
	};
	// Track container width to force inner elements to match it
	let containerWidth = 0;

	$: innerStyle = containerWidth ? `width: ${containerWidth}px` : 'width: 100%';

	// Handle resize observer to keep it synced if needed, but bind:clientWidth is enough usually
</script>

<section class="transformation-section container section-padding" id="transformations">
	<div class="section-header">
		<h2 class="section-title">
			<span class="title-decoration">✨</span>
			Transformation Gallery
			<span class="title-decoration">✨</span>
		</h2>
		<p class="section-subtitle">Witness the magic of our expert stylists</p>
	</div>

	<div class="filter-tabs">
		{#each ['all', 'hair', 'makeup', 'nails'] as cat}
			<button
				class="filter-btn"
				class:active={activeCategory === cat}
				on:click={() => setCategory(cat)}
			>
				{cat.charAt(0).toUpperCase() + cat.slice(1)}
			</button>
		{/each}
	</div>

	<div class="carousel-wrapper">
		<div class="carousel-card">
			<div
				class="comparison-slider"
				bind:this={container}
				bind:clientWidth={containerWidth}
				on:mousedown={handleStart}
				on:touchstart={handleStart}
				on:mousemove={handleMove}
				on:touchmove={handleMove}
				on:mouseup={handleEnd}
				on:touchend={handleEnd}
				on:mouseleave={handleEnd}
			>
				<!-- After Image Container (Background) -->
				<div class="after-container">
					<img src={currentItem.after} alt="After" class="after-img" />
					<div class="label-container after">
						<span class="label label-after">AFTER</span>
					</div>
				</div>

				<!-- Before Image Container (Foreground - Clipped) -->
				<div class="before-container" style="width: {sliderPosition}%">
					<div class="inner-fixed-wrapper" style={innerStyle}>
						<img src={currentItem.before} alt="Before" class="before-img" />
						<div class="label-container before">
							<span class="label label-before">BEFORE</span>
						</div>
					</div>
				</div>

				<!-- Slider Handle -->
				<div class="slider-handle" style="left: {sliderPosition}%">
					<div class="handle-line"></div>
					<div class="handle-circle">
						<span class="handle-icon">↔</span>
					</div>
				</div>
			</div>

			<div class="info-box">
				<h4>{currentItem.title}</h4>
				<p>{currentItem.desc}</p>
			</div>
		</div>

		<button class="nav-btn prev" on:click={prevSlide}>❮</button>
		<button class="nav-btn next" on:click={nextSlide}>❯</button>

		<!-- Dots -->
		<div class="dots">
			{#each filteredItems as _, i}
				<button class="dot" class:active={i === currentIndex} on:click={() => (currentIndex = i)}
				></button>
			{/each}
		</div>
	</div>
</section>

<style>
	.section-padding {
		padding-top: 60px;
		padding-bottom: 60px;
	}
	.section-header {
		text-align: center;
		margin-bottom: 30px;
	}
	.section-title {
		font-size: 2rem;
		color: var(--color-text-primary);
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.section-subtitle {
		color: var(--color-text-secondary);
	}

	.filter-tabs {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin-bottom: 30px;
		flex-wrap: wrap;
	}

	.filter-btn {
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: var(--color-text-secondary);
		padding: 8px 20px;
		border-radius: var(--radius-full);
		transition: all 0.3s;
	}

	.filter-btn.active,
	.filter-btn:hover {
		background: var(--color-accent-gold);
		border-color: var(--color-accent-gold);
		color: black;
	}

	.carousel-wrapper {
		position: relative;
		max-width: 500px; /* Reduced max-width for phone-like feel */
		margin: 0 auto;
	}

	.carousel-card {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-glass);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.comparison-slider {
		position: relative;
		width: 100%;
		aspect-ratio: 9/16; /* Taller, immersive aspect ratio */
		overflow: hidden;
		cursor: col-resize;
		user-select: none;
		touch-action: pan-y; /* Allow vertical scrolling, but we can preventDefault horizontal in JS */
	}

	/* Common image styles */
	.after-img,
	.before-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		display: block;
	}

	/* AFTER CONTAINER (Layer 1 - Background) */
	.after-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	/* BEFORE CONTAINER (Layer 2 - Foreground, Clipped) */
	.before-container {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		overflow: hidden; /* This creates the clip effect */
		background: #000; /* Fallback */
		border-right: 2px solid white; /* The "wipe" line */
		z-index: 10;
		will-change: width;
	}

	/* CRITICAL FIX: The wrapper inside before-container must match the PARENT width */
	.inner-fixed-wrapper {
		height: 100%;
		position: relative;
	}
	/* Width is set via inline style from JS to match parent exactly */

	/* Revert .before-img width hack since we now have the wrapper */
	.before-img {
		width: 100%;
		max-width: none;
		height: 100%;
	}

	.slider-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 40px; /* Interaction area */
		transform: translateX(-50%);
		z-index: 20;
		cursor: col-resize;
		/* Line and handle styling */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.handle-line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: rgba(255, 255, 255, 0.8);
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
	}

	.handle-circle {
		width: 44px;
		height: 44px;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(5px);
		border: 2px solid white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
	}

	.handle-icon {
		color: white;
		font-size: 18px;
		line-height: 1;
		font-weight: bold;
	}

	/* Labels */
	.label-container {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%; /* Now safely 100% of the inner fixed wrapper */
		height: 100%;
		pointer-events: none;
	}

	.label {
		position: absolute;
		bottom: 20px;
		padding: 6px 16px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		font-weight: 700;
		font-size: 0.85rem;
		letter-spacing: 0.1em;
		border-radius: 4px;
		text-transform: uppercase;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.label-before {
		left: 20px;
	}

	.label-after {
		right: 20px;
	}

	.info-box {
		padding: 20px;
		text-align: center;
		background: var(--color-bg-secondary);
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.info-box h4 {
		margin-bottom: 6px;
		color: var(--color-accent-gold);
		font-size: 1.2rem;
	}

	.nav-btn {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 30;
		transition: all 0.2s;
	}

	.nav-btn:hover {
		background: var(--color-accent-gold);
		color: black;
		border-color: var(--color-accent-gold);
	}

	.nav-btn.prev {
		left: -22px;
	}
	.nav-btn.next {
		right: -22px;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-top: 20px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		padding: 0;
		transition: all 0.3s;
	}

	.dot.active {
		background: var(--color-accent-gold);
		width: 24px;
		border-radius: 12px;
	}

	/* Mobile styles */
	@media (max-width: 768px) {
		.carousel-wrapper {
			max-width: 100%;
			margin: 0 10px; /* Slight margin */
		}

		/* Enable navigation buttons on mobile per user request */
		.nav-btn {
			display: flex;
			width: 36px;
			height: 36px;
			font-size: 14px;
		}

		.nav-btn.prev {
			left: 5px;
		}
		.nav-btn.next {
			right: 5px;
		}
	}
</style>

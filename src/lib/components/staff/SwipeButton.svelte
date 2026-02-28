<script lang="ts">
	let {
		onSwipe = () => {},
		text = 'Swipe to Complete ➔',
		successText = 'Completed!',
		disabled = false,
		isWorking = false
	} = $props<{
		onSwipe?: () => void;
		text?: string;
		successText?: string;
		disabled?: boolean;
		isWorking?: boolean;
	}>();

	let containerRef: HTMLDivElement;
	let thumbRef: HTMLDivElement;

	let isDragging = $state(false);
	let startX = $state(0);
	let currentX = $state(0);
	let isCompleted = $state(false);

	const THUMB_WIDTH = 52;

	function handleStart(e: TouchEvent | MouseEvent) {
		if (disabled || isWorking || isCompleted) return;
		isDragging = true;
		startX = e.type.includes('mouse')
			? (e as MouseEvent).clientX
			: (e as TouchEvent).touches[0].clientX;
	}

	function handleMove(e: TouchEvent | MouseEvent) {
		if (!isDragging) return;

		const clientX = e.type.includes('mouse')
			? (e as MouseEvent).clientX
			: (e as TouchEvent).touches[0].clientX;
		const deltaX = clientX - startX;
		const maxDist = containerRef.clientWidth - THUMB_WIDTH - 8; // 4px padding on each side

		if (deltaX < 0) {
			currentX = 0;
		} else if (deltaX >= maxDist) {
			currentX = maxDist;
			// Trigger completion precisely when hitting the end
			isDragging = false;
			isCompleted = true;
			onSwipe();
		} else {
			currentX = deltaX;
		}
	}

	function handleEnd() {
		if (!isDragging) return;
		isDragging = false;

		const maxDist = containerRef.clientWidth - THUMB_WIDTH - 8;

		if (currentX >= maxDist * 0.8) {
			// Snap to end if dragged > 80%
			currentX = maxDist;
			isCompleted = true;
			onSwipe();
		} else {
			// Snap back to start
			currentX = 0;
		}
	}

	$effect(() => {
		if (isDragging) {
			document.body.style.userSelect = 'none';
		} else {
			document.body.style.userSelect = '';
		}
	});

	// Reset if disabled/working state changes back
	$effect(() => {
		if (!isWorking && !disabled && isCompleted) {
			// Optional: reset state if parent indicates it's no longer 'completed'
			// But usually we just let it stay completed until unmounted.
		}
	});
</script>

<svelte:window
	on:mousemove={handleMove}
	on:mouseup={handleEnd}
	on:touchmove|nonpassive={handleMove}
	on:touchend={handleEnd}
/>

<div
	class="swipe-container"
	bind:this={containerRef}
	class:disabled
	class:working={isWorking}
	class:completed={isCompleted}
>
	<!-- Progress Background -->
	<div class="swipe-progress" style="width: {currentX + THUMB_WIDTH + 4}px;"></div>

	<!-- Text -->
	<div class="swipe-text" class:fade={isDragging && currentX > 20}>
		{#if isWorking}
			<span class="spinner"></span> {successText}...
		{:else if isCompleted}
			{successText}
		{:else}
			{text}
		{/if}
	</div>

	<!-- Thumb -->
	<div
		class="swipe-thumb"
		bind:this={thumbRef}
		style="transform: translateX({currentX}px);"
		onmousedown={handleStart}
		ontouchstart={handleStart}
		role="button"
		tabindex="0"
	>
		{#if isWorking}
			<span class="spinner thumb-spinner"></span>
		{:else if isCompleted}
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="white-icon"><polyline points="20 6 9 17 4 12"></polyline></svg
			>
		{:else}
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="white-icon"><polyline points="9 18 15 12 9 6"></polyline></svg
			>
		{/if}
	</div>
</div>

<style>
	.swipe-container {
		position: relative;
		width: 100%;
		height: 60px;
		background: #d1fae5; /* Light mint/green bg */
		border-radius: 16px; /* Rounded rectangle instead of full pill */
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		user-select: none;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
		border: 1px solid rgba(16, 185, 129, 0.1);
	}

	.swipe-container.disabled {
		opacity: 0.6;
		pointer-events: none;
		background: var(--s-bg-secondary);
	}

	.swipe-progress {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: #86efac; /* Visible green fill (Tailwind green-300) */
		border-radius: 16px;
		opacity: 1; /* Fully visible */
	}

	.swipe-container.completed {
		background: #10b981;
		transition: background 0.3s ease;
		border-color: #10b981;
	}
	.swipe-container.completed .swipe-progress {
		display: none;
	}

	.swipe-container.completed .swipe-text {
		color: white;
		margin-left: 0;
		font-weight: 700;
	}

	.swipe-text {
		position: relative;
		z-index: 1;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.05rem;
		font-weight: 700;
		color: #059669; /* Darker green text matching design */
		pointer-events: none;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.swipe-text.fade {
		opacity: 0.3;
	}

	.swipe-thumb {
		position: absolute;
		left: 4px; /* 4px padding */
		top: 4px;
		width: 52px;
		height: 52px;
		background: #10b981; /* Solid primary green from the start */
		border-radius: 14px; /* Curved rectangle matching the outer border radius visually */
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4); /* Green tinted shadow */
		cursor: grab;
		z-index: 2;
	}

	.white-icon {
		color: white; /* White arrow against green background */
	}

	/* Use transition only when NOT dragging (for snap-back) */
	.swipe-container:not(:active) .swipe-thumb,
	.swipe-container:not(:active) .swipe-progress {
		transition:
			transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28),
			width 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
	}

	.swipe-thumb:active {
		cursor: grabbing;
	}

	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-radius: 50%;
		border-top-color: white;
		animation: s-spin 1s ease-in-out infinite;
	}

	.thumb-spinner {
		border-color: rgba(16, 185, 129, 0.2);
		border-top-color: #10b981;
	}

	@keyframes s-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

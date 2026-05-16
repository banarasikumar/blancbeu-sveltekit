<script lang="ts">
	import { appServices } from '$lib/stores/appData';
	import ServiceHighlight from '$lib/components/home/ServiceHighlight.svelte';
	import StickyServiceFilter from '$lib/components/home/StickyServiceFilter.svelte';
	import { tryOnPicker, tryOnPickerCount } from '$lib/stores/tryOnPicker';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ArrowLeft, Check } from 'lucide-svelte';

	let selectedCategory = $state('All');
	let searchQuery = $state('');

	// Detect try-on picker mode from store
	let isTryOnMode = $derived($tryOnPicker.active);
	let pickerCount = $derived($tryOnPickerCount);

	// Filter active services first
	let activeServices = $derived($appServices.filter((s) => s.isActive !== false));

	// In try-on mode, only show Hair services
	let baseServices = $derived(
		isTryOnMode ? activeServices.filter((s) => s.category === 'Hair') : activeServices
	);

	// Extract unique categories from active services
	let categories = $derived(['All', ...new Set(activeServices.map((s) => s.category))]);

	let filteredServices = $derived(
		baseServices.filter((s) => {
			const categoryMatch = selectedCategory === 'All' || s.category === selectedCategory;
			const searchMatch =
				searchQuery.trim() === '' ||
				s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(s.description || '').toLowerCase().includes(searchQuery.toLowerCase());
			return categoryMatch && searchMatch;
		})
	);

	function handleDone() {
		goto('/try-on');
	}

	function handleBack() {
		tryOnPicker.deactivate();
		goto('/try-on');
	}
</script>

<div class="services-page container" class:picker-mode={isTryOnMode}>
	{#if isTryOnMode}
		<div class="picker-instruction-area">
			<p>Select 1 to 3 styles for your preview</p>
		</div>
	{:else}
		<header class="page-header">
			<h1>Our Services</h1>
			<p>Choose from our premium range</p>
		</header>
	{/if}

	<!-- Sticky Filter Bar -->
	<StickyServiceFilter bind:activeCategory={selectedCategory} {categories} bind:searchQuery />

	<!-- Grid -->
	<div class="services-grid-full">
		{#each filteredServices as service (service.id)}
			<ServiceHighlight {service} tryOnMode={isTryOnMode} />
		{/each}
	</div>

	{#if isTryOnMode}
		<div class="picker-done-bar">
			<button class="picker-done-btn" onclick={handleDone} disabled={pickerCount === 0}>
				<Check size={18} strokeWidth={3} />
				<span>Try-On Selected Styles</span>
				{#if pickerCount > 0}
					<span class="btn-count-pill">{pickerCount}/3</span>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.services-page {
		padding-top: 20px;
	}

	.page-header {
		text-align: center;
		margin-bottom: 20px;
	}

	.page-header h1 {
		font-size: 1.8rem;
		background: var(--gradient-gold);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.page-header p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.picker-instruction-area {
		text-align: center;
		margin-bottom: 20px;
	}

	.picker-instruction-area p {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		opacity: 0.8;
	}

	.back-btn:active {
		transform: scale(0.92);
	}

	/* Previous filter styles removed as they are now handled by StickyServiceFilter */

	.services-grid-full {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		padding-bottom: 20px;
	}

	.picker-mode .services-grid-full {
		padding-bottom: 100px;
	}

	/* Floating Done Bar */
	.picker-done-bar {
		position: fixed;
		bottom: 12px;
		left: 0;
		right: 0;
		padding: 0 20px;
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 1000;
		display: flex;
		justify-content: center;
		pointer-events: none; /* Allow clicks to pass through container */
	}

	.picker-done-btn {
		pointer-events: auto; /* Enable clicks for button */
		width: 100%;
		max-width: 400px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px 28px;
		background: var(--gradient-gold);
		color: #1a1a1a;
		border: none;
		border-radius: 999px;
		font-size: 1.05rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 175, 55, 0.2);
	}

	.btn-count-pill {
		background: rgba(0, 0, 0, 0.15);
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 0.85rem;
		font-weight: 800;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.picker-done-btn:active {
		transform: scale(0.97);
	}

	.picker-done-btn:disabled {
		background: rgba(212, 175, 55, 0.08);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1.5px solid rgba(212, 175, 55, 0.25);
		color: rgba(212, 175, 55, 0.4);
		box-shadow: none;
		cursor: not-allowed;
		transform: none;
	}

	.picker-done-btn:disabled :global(svg) {
		opacity: 0.6;
	}
</style>

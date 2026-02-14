<script lang="ts">
	import { appServices } from '$lib/stores/appData';
	import ServiceHighlight from '$lib/components/home/ServiceHighlight.svelte';
	import StickyServiceFilter from '$lib/components/home/StickyServiceFilter.svelte';

	let selectedCategory = $state('All');
	let searchQuery = $state('');

	// Filter active services first
	let activeServices = $derived($appServices.filter((s) => s.isActive !== false));

	// Extract unique categories from active services
	let categories = $derived(['All', ...new Set(activeServices.map((s) => s.category))]);

	let filteredServices = $derived(
		activeServices.filter((s) => {
			const categoryMatch = selectedCategory === 'All' || s.category === selectedCategory;
			const searchMatch =
				searchQuery.trim() === '' ||
				s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(s.description || '').toLowerCase().includes(searchQuery.toLowerCase());
			return categoryMatch && searchMatch;
		})
	);
</script>

<div class="services-page container">
	<header class="page-header">
		<h1>Our Services</h1>
		<p>Choose from our premium range</p>
	</header>

	<!-- Sticky Filter Bar -->
	<StickyServiceFilter bind:activeCategory={selectedCategory} {categories} bind:searchQuery />

	<!-- Grid -->
	<div class="services-grid-full">
		{#each filteredServices as service (service.id)}
			<ServiceHighlight {service} />
		{/each}
	</div>
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

	/* Previous filter styles removed as they are now handled by StickyServiceFilter */

	.services-grid-full {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		padding-bottom: 20px;
	}
</style>

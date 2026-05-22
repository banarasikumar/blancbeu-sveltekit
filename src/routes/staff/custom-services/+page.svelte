<script lang="ts">
	import { staffServices, customServices, deleteCustomService } from '$lib/stores/staffData';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';
	import { showToast } from '$lib/stores/toast';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let searchQuery = $state('');
	let filterTab = $state<'all' | 'standard' | 'custom'>('all');
	let sortBy = $state<'category' | 'name' | 'price'>('category');
	let expandedCategories = $state<Record<string, boolean>>({});

	// Load previously saved list states from local cache / localStorage
	onMount(() => {
		if (browser) {
			const cachedFilter = localStorage.getItem('staff_services_filter_tab');
			if (cachedFilter === 'all' || cachedFilter === 'standard' || cachedFilter === 'custom') {
				filterTab = cachedFilter;
			}
			const cachedSort = localStorage.getItem('staff_services_sort_by');
			if (cachedSort === 'category' || cachedSort === 'name' || cachedSort === 'price') {
				sortBy = cachedSort;
			}
			const cachedSearch = localStorage.getItem('staff_services_search_query');
			if (cachedSearch !== null) {
				searchQuery = cachedSearch;
			}
			const cachedExpanded = localStorage.getItem('staff_services_expanded_categories');
			if (cachedExpanded !== null) {
				try {
					expandedCategories = JSON.parse(cachedExpanded);
				} catch (e) {
					console.warn('[ServicesPage] Failed to parse cached expanded categories:', e);
				}
			}
		}
	});

	// Save list states dynamically to local cache / localStorage when they change
	$effect(() => {
		if (browser) {
			localStorage.setItem('staff_services_filter_tab', filterTab);
			localStorage.setItem('staff_services_sort_by', sortBy);
			localStorage.setItem('staff_services_search_query', searchQuery);
			localStorage.setItem('staff_services_expanded_categories', JSON.stringify(expandedCategories));
		}
	});

	// Combine services from both states and mark their types reactively using Svelte 5 store auto-subscriptions ($ prefix)
	let allServices = $derived.by(() => {
		const standard = ($staffServices || []).map((s) => ({
			...s,
			id: s.id || s.name,
			type: 'standard' as const
		}));
		const custom = ($customServices || []).map((s) => ({
			...s,
			type: 'custom' as const
		}));
		return [...standard, ...custom];
	});

	// Reactivity debug trace helper
	$effect(() => {
		console.log(
			`[ServicesPage] Reactive update: standard = ${($staffServices || []).length}, custom = ${($customServices || []).length}`
		);
	});

	// Filter services based on active tab and search query
	let filteredServices = $derived.by(() => {
		let query = searchQuery.toLowerCase().trim();
		let list = allServices;

		// Filter by tab
		if (filterTab === 'standard') {
			list = list.filter((s) => s.type === 'standard');
		} else if (filterTab === 'custom') {
			list = list.filter((s) => s.type === 'custom');
		}

		// Filter by search query
		if (query) {
			list = list.filter((s) => {
				const nameMatch = s.name?.toLowerCase().includes(query);
				const catMatch = s.category?.toLowerCase().includes(query);
				return nameMatch || catMatch;
			});
		}

		return list;
	});

	// Sort flat list (used for sorting by name or price)
	let sortedServices = $derived.by(() => {
		let list = [...filteredServices];
		if (sortBy === 'name') {
			return list.sort((a, b) => a.name.localeCompare(b.name));
		}
		if (sortBy === 'price') {
			return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
		}
		return list;
	});

	// Group services by category
	let groupedServices = $derived.by(() => {
		const groups: Record<string, typeof filteredServices> = {};
		for (const service of filteredServices) {
			const cat = service.category?.trim() || 'Other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(service);
		}

		// Sort category names alphabetically, putting 'Other' at the end
		const sortedKeys = Object.keys(groups).sort((a, b) => {
			if (a === 'Other') return 1;
			if (b === 'Other') return -1;
			return a.localeCompare(b);
		});

		return sortedKeys.reduce(
			(acc, key) => {
				// Within each category, sort standard first, then custom, then alphabetically by name
				acc[key] = groups[key].sort((a, b) => {
					if (a.type !== b.type) {
						return a.type === 'standard' ? -1 : 1;
					}
					return a.name.localeCompare(b.name);
				});
				return acc;
			},
			{} as Record<string, typeof filteredServices>
		);
	});

	// Auto-expand categories if there is a search query
	$effect(() => {
		if (searchQuery.trim()) {
			const activeCats = Object.keys(groupedServices);
			for (const cat of activeCats) {
				expandedCategories[cat] = true;
			}
		}
	});

	// Toggle collapsible category
	function toggleCategory(cat: string) {
		expandedCategories[cat] = expandedCategories[cat] === true ? false : true;
	}

	function isCategoryExpanded(cat: string): boolean {
		// By default, collapse categories
		return expandedCategories[cat] === true;
	}

	async function handleDelete(id: string) {
		if (confirm('Are you sure you want to delete this custom service?')) {
			try {
				await deleteCustomService(id);
				showToast('Custom service deleted', 'success');
			} catch (error) {
				showToast('Failed to delete custom service', 'error');
			}
		}
	}
</script>

<div class="custom-services-page s-stagger">

	<!-- Search & Filter Controls -->
	<section class="controls-section s-glass-strong">
		<!-- Search Bar -->
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				class="search-input"
				placeholder="Search services or categories..."
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="clear-search-btn" onclick={() => (searchQuery = '')} aria-label="Clear Search">✕</button>
			{/if}
		</div>

		<!-- Segmented Filter Tabs & Sorting -->
		<div class="filter-sort-row">
			<!-- Filter Tabs -->
			<div class="tabs-container">
				<button
					class="filter-tab"
					class:active={filterTab === 'all'}
					onclick={() => (filterTab = 'all')}
				>
					All <span class="tab-count">{allServices.length}</span>
				</button>
				<button
					class="filter-tab"
					class:active={filterTab === 'standard'}
					onclick={() => (filterTab = 'standard')}
				>
					Standard <span class="tab-count">{allServices.filter((s) => s.type === 'standard').length}</span>
				</button>
				<button
					class="filter-tab"
					class:active={filterTab === 'custom'}
					onclick={() => (filterTab = 'custom')}
				>
					Custom <span class="tab-count">{allServices.filter((s) => s.type === 'custom').length}</span>
				</button>
			</div>

			<!-- Sort controls -->
			<div class="sort-container">
				<span class="sort-label">Sort by:</span>
				<div class="sort-pill-group">
					<button
						class="sort-pill"
						class:active={sortBy === 'category'}
						onclick={() => (sortBy = 'category')}
					>
						Category
					</button>
					<button
						class="sort-pill"
						class:active={sortBy === 'name'}
						onclick={() => (sortBy = 'name')}
					>
						Name
					</button>
					<button
						class="sort-pill"
						class:active={sortBy === 'price'}
						onclick={() => (sortBy = 'price')}
					>
						Price
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Services Content -->
	<section class="services-content">
		{#if filteredServices.length > 0}
			{#if sortBy === 'category'}
				<!-- Grouped Accordion List (Separate Cards like in Screenshot) -->
				<div class="accordion-list">
					{#each Object.entries(groupedServices) as [cat, services] (cat)}
						{@const isExpanded = isCategoryExpanded(cat)}
						<div class="category-card" class:expanded={isExpanded}>
							<button class="category-header" onclick={() => toggleCategory(cat)}>
								<div class="category-header-title">
									<span class="folder-icon">📁</span>
									<span class="category-name">{cat}</span>
									<span class="category-badge">({services.length})</span>
								</div>
								<span class="chevron" class:expanded={isExpanded}>
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="6 9 12 15 18 9"></polyline>
									</svg>
								</span>
							</button>

							{#if isExpanded}
								<div class="category-content" transition:slide={{ duration: 250 }}>
									<div class="services-list-rows">
										{#each services as service (service.id || service.name)}
											{@render serviceRow(service)}
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<!-- Flat List View -->
				<div class="flat-list-card s-card">
					<div class="services-list-rows">
						{#each sortedServices as service (service.id || service.name)}
							{@render serviceRow(service)}
						{/each}
					</div>
				</div>
			{/if}
		{:else if searchQuery || filterTab !== 'all'}
			<EmptyState
				icon="🔍"
				title="No matches found"
				description="We couldn't find any services matching your search or filters."
			/>
		{:else}
			<EmptyState
				icon="✨"
				title="No services available"
				description="The service directories are currently empty."
			/>
		{/if}
	</section>
</div>

<!-- Reusable Svelte snippet for horizontal service row -->
{#snippet serviceRow(service)}
	<div class="service-row-item" class:custom-row={service.type === 'custom'}>
		<div class="service-row-left">
			<div class="service-title-group">
				<h3 class="service-name">{service.name}</h3>
				<span class="badge" class:badge-standard={service.type === 'standard'} class:badge-custom={service.type === 'custom'}>
					{service.type === 'standard' ? 'Standard' : 'Custom'}
				</span>
			</div>
			
			{#if sortBy !== 'category'}
				<span class="service-row-category">
					📁 {service.category || 'Other'}
				</span>
			{/if}
		</div>

		<div class="service-row-right">
			<div class="price-section">
				<span class="service-price">₹{service.price}</span>
				{#if service.mrp && service.mrp > service.price}
					<span class="service-mrp">MRP <s>₹{service.mrp}</s></span>
				{/if}
			</div>

			<div class="service-row-actions">
				{#if service.type === 'custom'}
					<button
						class="delete-row-btn"
						onclick={() => handleDelete(service.id)}
						title="Delete Custom Service"
						aria-label="Delete Custom Service"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<polyline points="3 6 5 6 21 6"></polyline>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
							<line x1="10" y1="11" x2="10" y2="17"></line>
							<line x1="14" y1="11" x2="14" y2="17"></line>
						</svg>
					</button>
				{:else}
					<span class="read-only-badge" title="Standard catalog service (read-only)">🔒</span>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<style>
	.custom-services-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
		padding-bottom: var(--s-space-3xl);
	}





	/* Search & Filter Controls Section */
	.controls-section {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
		padding: var(--s-space-lg);
		background: var(--s-bg-glass-strong);
		backdrop-filter: var(--s-blur-strong);
		-webkit-backdrop-filter: var(--s-blur-strong);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-2xl);
		box-shadow: var(--s-shadow-md);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		padding: 0 16px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.search-box:focus-within {
		border-color: var(--s-accent);
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
	}

	.search-icon {
		font-size: 1.1rem;
		opacity: 0.6;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		padding: 12px 10px;
		font-size: 0.92rem;
		color: var(--s-text-primary);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--s-text-secondary);
		opacity: 0.6;
	}

	.clear-search-btn {
		background: transparent;
		border: none;
		color: var(--s-text-secondary);
		font-size: 0.85rem;
		cursor: pointer;
		opacity: 0.5;
		padding: 4px 8px;
		transition: opacity 0.2s;
	}

	.clear-search-btn:hover {
		opacity: 1;
	}

	/* Filter and Sort Row */
	.filter-sort-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-space-md);
		flex-wrap: wrap;
	}

	.tabs-container {
		display: flex;
		gap: 4px;
		background: rgba(0, 0, 0, 0.04);
		padding: 3px;
		border-radius: var(--s-radius-xl);
	}

	:global(.staff-app.dark) .tabs-container {
		background: rgba(255, 255, 255, 0.04);
	}

	.filter-tab {
		background: transparent;
		border: none;
		padding: 6px 12px;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--s-text-secondary);
		border-radius: var(--s-radius-lg);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s ease;
	}

	.filter-tab:hover {
		color: var(--s-text-primary);
	}

	.filter-tab.active {
		background: var(--s-surface);
		color: var(--s-text-primary);
		box-shadow: var(--s-shadow-xs);
	}

	.tab-count {
		font-size: 0.72rem;
		background: rgba(0, 0, 0, 0.06);
		color: var(--s-text-secondary);
		padding: 1px 6px;
		border-radius: var(--s-radius-full);
		font-weight: 800;
	}

	:global(.staff-app.dark) .tab-count {
		background: rgba(255, 255, 255, 0.08);
	}

	.filter-tab.active .tab-count {
		background: var(--s-accent-2-bg);
		color: var(--s-accent-2);
	}

	/* Sorting Controls */
	.sort-container {
		display: flex;
		align-items: center;
		gap: var(--s-space-xs);
	}

	.sort-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--s-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.sort-pill-group {
		display: flex;
		gap: 4px;
	}

	.sort-pill {
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		padding: 5px 12px;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--s-text-secondary);
		border-radius: var(--s-radius-lg);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sort-pill:hover {
		border-color: var(--s-border-strong);
		color: var(--s-text-primary);
	}

	.sort-pill.active {
		background: #111116;
		border-color: #111116;
		color: #ffffff;
	}

	:global(.staff-app.dark) .sort-pill.active {
		background: #ffffff;
		border-color: #ffffff;
		color: #111116;
	}

	/* Services Display Layout */
	.services-content {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	/* Accordion Category Cards - Styled like the screenshot but highly polished */
	.accordion-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.category-card {
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.category-card:hover {
		border-color: var(--s-border-strong);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
	}

	.category-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: transparent;
		border: none;
		color: var(--s-text-primary);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.2s;
	}

	.category-header:hover {
		background: rgba(0, 0, 0, 0.01);
	}

	:global(.staff-app.dark) .category-header:hover {
		background: rgba(255, 255, 255, 0.01);
	}

	.category-header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.folder-icon {
		font-size: 1.1rem;
		opacity: 0.6;
	}

	.category-name {
		font-size: 1rem;
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.category-badge {
		font-size: 0.85rem;
		color: var(--s-text-tertiary);
		font-weight: 600;
	}

	.chevron {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		color: var(--s-text-secondary);
		opacity: 0.7;
	}

	.chevron.expanded {
		transform: rotate(-180deg);
		color: var(--s-accent);
		opacity: 1;
	}

	.category-content {
		border-top: 1px solid var(--s-border);
		background: rgba(0, 0, 0, 0.005);
	}

	:global(.staff-app.dark) .category-content {
		background: rgba(255, 255, 255, 0.003);
	}

	/* Flat List Card */
	.flat-list-card {
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		overflow: hidden;
	}

	/* Vertical List Row Layout */
	.services-list-rows {
		display: flex;
		flex-direction: column;
	}

	.service-row-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		border-bottom: 1px solid var(--s-border);
		transition: background-color 0.2s;
	}

	.services-list-rows .service-row-item:last-child {
		border-bottom: none;
	}

	.service-row-item:hover {
		background-color: rgba(0, 0, 0, 0.015);
	}

	:global(.staff-app.dark) .service-row-item:hover {
		background-color: rgba(255, 255, 255, 0.01);
	}

	/* Subtle row highlight for custom manual services */
	.service-row-item.custom-row {
		background-color: rgba(236, 72, 153, 0.008);
	}

	:global(.staff-app.dark) .service-row-item.custom-row {
		background-color: rgba(244, 63, 94, 0.005);
	}

	.service-row-item.custom-row:hover {
		background-color: rgba(236, 72, 153, 0.02);
	}

	/* Row Elements styling */
	.service-row-left {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex: 1;
		padding-right: var(--s-space-md);
	}

	.service-title-group {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.service-name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--s-text-primary);
		line-height: 1.3;
	}

	.badge {
		font-size: 0.6rem;
		font-weight: 800;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.badge-standard {
		background: rgba(99, 102, 241, 0.08);
		color: #4f46e5;
		border: 1px solid rgba(79, 70, 229, 0.12);
	}

	:global(.staff-app.dark) .badge-standard {
		background: rgba(129, 140, 248, 0.12);
		color: #a5b4fc;
		border: 1px solid rgba(129, 140, 248, 0.15);
	}

	.badge-custom {
		background: rgba(236, 72, 153, 0.08);
		color: #db2777;
		border: 1px solid rgba(219, 39, 119, 0.12);
	}

	:global(.staff-app.dark) .badge-custom {
		background: rgba(244, 63, 94, 0.12);
		color: #fda4af;
		border: 1px solid rgba(244, 63, 94, 0.15);
	}

	.service-row-category {
		font-size: 0.72rem;
		color: var(--s-text-tertiary);
		font-weight: 500;
	}

	.service-row-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.price-section {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.service-price {
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--s-text-primary);
		letter-spacing: -0.01em;
	}

	.service-mrp {
		font-size: 0.72rem;
		color: var(--s-text-tertiary);
		font-weight: 500;
	}

	.service-mrp s {
		opacity: 0.8;
	}

	.service-row-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
	}

	.read-only-badge {
		font-size: 0.75rem;
		opacity: 0.45;
		cursor: default;
	}

	.delete-row-btn {
		background: transparent;
		border: none;
		color: var(--s-text-tertiary);
		cursor: pointer;
		padding: 6px;
		border-radius: var(--s-radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.delete-row-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	:global(.staff-app.dark) .delete-row-btn:hover {
		color: #f87171;
		background: rgba(239, 68, 68, 0.15);
	}

	/* Responsive Layout Tweaks */
	@media (max-width: 600px) {
		.filter-sort-row {
			flex-direction: column;
			align-items: stretch;
			gap: 10px;
		}

		.tabs-container {
			justify-content: space-between;
		}

		.filter-tab {
			flex: 1;
			justify-content: center;
			padding: 6px 8px;
			font-size: 0.78rem;
		}

		.sort-container {
			justify-content: space-between;
		}

		.service-row-item {
			padding: 12px 14px;
		}

		.service-name {
			font-size: 0.9rem;
		}

		.service-price {
			font-size: 0.98rem;
		}
	}
</style>

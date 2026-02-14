<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Sparkles, Scissors, UserCheck, Palette, Droplet, Search, X } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';

	const dispatch = createEventDispatcher();

	export let activeCategory = 'All';
	export let categories: string[] = [];
	export let searchQuery = '';

	let isSearchOpen = false;
	let searchInput: HTMLInputElement;
	let filterBarElement: HTMLDivElement;

	// Internal helper to get icon
	function getIcon(cat: string) {
		switch (cat) {
			case 'Hair':
				return Scissors;
			case 'Skin':
				return UserCheck;
			case 'Makeup':
				return Palette;
			case 'Spa':
				return Droplet;
			default:
				return Sparkles;
		}
	}

	function selectCategory(category: string) {
		activeCategory = category;
		dispatch('filter', category);
	}

	async function toggleSearch() {
		isSearchOpen = !isSearchOpen;

		if (isSearchOpen) {
			await tick(); // Wait for DOM to update so searchInput/ID are ready

			// Find element by ID for direct scroll
			const el = document.getElementById('premium-search-bar');
			if (el) {
				// scrollIntoView is standard and respects scroll-margin-top
				el.scrollIntoView({
					behavior: 'smooth',
					block: 'start'
				});
			}

			// Focus input after a short delay to allow scroll to start
			setTimeout(() => {
				searchInput?.focus({ preventScroll: true });
			}, 300);
		} else {
			searchQuery = '';
		}
	}
</script>

<div id="premium-search-bar" class="service-filter-bar" bind:this={filterBarElement}>
	<div class="filter-wrapper">
		{#if !isSearchOpen}
			<div class="filter-container" transition:fade={{ duration: 200 }}>
				<div class="categories-scroll">
					{#each categories as cat}
						<button
							class="filter-btn"
							class:active={activeCategory === cat}
							on:click={() => selectCategory(cat)}
						>
							<div class="icon-wrapper">
								<svelte:component this={getIcon(cat)} size={16} />
							</div>
							<span>{cat}</span>
						</button>
					{/each}
				</div>

				<div class="divider"></div>

				<button
					class="icon-btn search-trigger"
					on:click={toggleSearch}
					aria-label="Search services"
				>
					<Search size={18} />
				</button>
			</div>
		{/if}

		{#if isSearchOpen}
			<div class="search-container" transition:fly={{ y: 20, duration: 300 }}>
				<Search size={18} class="search-icon-input" />
				<input
					bind:this={searchInput}
					type="text"
					placeholder="Search for a service..."
					bind:value={searchQuery}
					class="search-input"
				/>
				<button class="icon-btn close-search" on:click={toggleSearch}>
					<X size={18} />
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.service-filter-bar {
		position: sticky;
		top: 64px; /* Adjust based on header height */
		z-index: 90;
		background: rgba(var(--color-bg-primary-rgb), 0.85); /* Proper theme glass */
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		padding: 10px 0;
		margin-bottom: 20px;
		border-bottom: 1px solid rgba(var(--color-accent-gold-rgb), 0.1);
		scroll-margin-top: 54px; /* Tight fit: 64px header - 10px visual adjustment */
	}

	.filter-wrapper {
		position: relative;
		height: 44px; /* Fixed height to prevent layout shifts */
		display: flex;
		align-items: center;
		padding: 0 16px;
	}

	.filter-container {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 8px;
	}

	.categories-scroll {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-right: 8px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		flex: 1;
		align-items: center;
	}

	.categories-scroll::-webkit-scrollbar {
		display: none;
	}

	.divider {
		width: 1px;
		height: 20px;
		background: rgba(var(--color-text-primary-rgb), 0.1);
		margin: 0 2px;
	}

	.icon-btn {
		background: rgba(var(--color-text-primary-rgb), 0.05);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.1);
		color: var(--color-text-primary);
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
		flex-shrink: 0;
	}

	.icon-btn:hover {
		background: rgba(var(--color-text-primary-rgb), 0.15);
		transform: scale(1.05);
		border-color: var(--color-accent-gold);
	}

	.search-trigger {
		color: var(--color-accent-gold);
	}

	.filter-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 20px;
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.08);
		background: rgba(var(--color-text-primary-rgb), 0.03);
		color: var(--color-text-secondary);
		white-space: nowrap;
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.filter-btn:active {
		transform: scale(0.95);
	}

	.filter-btn.active {
		background: var(--gradient-gold);
		color: #000;
		border-color: transparent;
		box-shadow: 0 2px 8px rgba(var(--color-accent-gold-rgb), 0.25);
		font-weight: 600;
	}

	/* Search Container Styles */
	.search-container {
		position: absolute;
		inset: 0 16px;
		display: flex;
		align-items: center;
		background: rgba(var(--color-bg-secondary-rgb), 0.95);
		border: 1px solid rgba(var(--color-accent-gold-rgb), 0.3);
		border-radius: 24px;
		padding: 0 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	}

	:global(.search-icon-input) {
		color: var(--color-text-secondary);
		margin-right: 8px;
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text-primary);
		font-size: 0.95rem;
		outline: none;
		padding: 8px 0;
		font-family: var(--font-body);
	}

	.search-input::placeholder {
		color: var(--color-text-secondary);
		opacity: 0.5;
	}

	.close-search {
		width: 30px;
		height: 30px;
		background: transparent;
		border: none;
		color: var(--color-text-secondary);
	}

	.close-search:hover {
		color: var(--color-text-primary);
		background: rgba(var(--color-text-primary-rgb), 0.1);
	}

	.icon-wrapper {
		display: flex;
		align-items: center;
	}
</style>

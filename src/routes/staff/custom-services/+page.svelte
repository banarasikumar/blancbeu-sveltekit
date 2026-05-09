<script lang="ts">
	import { customServices, deleteCustomService } from '$lib/stores/staffData';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';
	import { showToast } from '$lib/stores/toast';

	let searchQuery = $state('');

	let filteredServices = $derived.by(() => {
		let query = searchQuery.toLowerCase().trim();
		if (!query) return $customServices;

		return $customServices.filter((s) => {
			const nameMatch = s.name?.toLowerCase().includes(query);
			const catMatch = s.category?.toLowerCase().includes(query);
			return nameMatch || catMatch;
		});
	});

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
	<!-- Header -->
	<header class="page-header">
		<div>
			<h1 class="page-title">Custom Services</h1>
			<p class="page-subtitle">Manage services created outside the standard catalog</p>
		</div>
	</header>

	<!-- Search Bar -->
	<section class="search-section">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				class="search-input"
				placeholder="Search custom services..."
				bind:value={searchQuery}
			/>
		</div>
	</section>

	<!-- Services List -->
	<section class="services-list">
		{#if filteredServices.length > 0}
			{#each filteredServices as service (service.id)}
				<div class="service-card s-card">
					<div class="service-info-main">
						<div class="service-details">
							<div class="service-header">
								<h3 class="service-name">{service.name}</h3>
								<span class="service-price">₹{service.price}</span>
							</div>
							<p class="service-category">
								<span class="icon">📁</span>
								{service.category || 'Uncategorized'}
							</p>
							{#if service.mrp && service.mrp > service.price}
								<p class="service-mrp">
									MRP: <s>₹{service.mrp}</s>
								</p>
							{/if}
						</div>
					</div>
					<div class="service-actions">
						<button
							class="s-btn s-btn-outline s-btn-sm danger-btn"
							onclick={() => handleDelete(service.id)}
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
							</svg>
							Delete
						</button>
					</div>
				</div>
			{/each}
		{:else if searchQuery}
			<EmptyState
				icon="🕵️"
				title="No services found"
				description="We couldn't find anything matching '{searchQuery}'."
			/>
		{:else}
			<EmptyState
				icon="✨"
				title="No custom services yet"
				description="When you add custom services during booking, they will appear here."
			/>
		{/if}
	</section>
</div>

<style>
	.custom-services-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-xl);
		padding-bottom: var(--s-space-3xl);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-title {
		font-family: var(--s-font-display);
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--s-text-primary);
		margin: 0;
	}

	.page-subtitle {
		font-size: 0.9rem;
		color: var(--s-text-secondary);
		margin: 4px 0 0;
	}

	/* Search Bar */
	.search-section {
		position: sticky;
		top: -16px;
		z-index: 10;
		padding-top: 16px;
		margin-top: -16px;
		background: linear-gradient(180deg, var(--s-bg-primary) 80%, transparent);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		padding: 0 16px;
		box-shadow: var(--s-shadow-sm);
		transition: all 0.3s ease;
	}

	.search-box:focus-within {
		border-color: var(--s-accent);
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.search-icon {
		font-size: 1.2rem;
		opacity: 0.5;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		padding: 16px;
		font-size: 1rem;
		color: var(--s-text-primary);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--s-text-secondary);
		opacity: 0.7;
	}

	/* Services List */
	.services-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	.service-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--s-space-lg);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		transition: all 0.3s ease;
	}

	.service-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--s-shadow-md);
		border-color: var(--s-border-strong);
	}

	.service-info-main {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		flex: 1;
	}

	.service-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	}

	.service-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.service-name {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.service-price {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--s-text-primary);
	}

	.service-category {
		margin: 0;
		font-size: 0.85rem;
		color: var(--s-text-secondary);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.service-mrp {
		margin: 4px 0 0 0;
		font-size: 0.85rem;
		color: var(--s-text-tertiary);
	}

	.service-category .icon {
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.service-actions {
		display: flex;
		align-items: center;
		margin-left: 16px;
	}

	.danger-btn {
		color: #ef4444;
		border-color: #fca5a5;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	
	.danger-btn:hover {
		background: #fef2f2;
		border-color: #ef4444;
	}

	:global(.staff-app.dark) .danger-btn {
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.3);
	}

	:global(.staff-app.dark) .danger-btn:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: #f87171;
	}

	@media (max-width: 480px) {
		.service-card {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--s-space-md);
		}

		.service-actions {
			margin-left: 0;
			width: 100%;
		}

		.service-actions .s-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>

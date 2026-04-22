<script lang="ts">
	import { onMount } from 'svelte';
	import { getRecentClients, searchUsersByName, searchUsersByPhone } from '$lib/stores/staffData';
	import type { AppUser } from '$lib/stores/adminData';
	import { goto } from '$app/navigation';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';

	let searchQuery = $state('');
	let isSearching = $state(false);
	let clients = $state<AppUser[]>([]);
	let defaultClients = $state<AppUser[]>([]);

	onMount(async () => {
		isSearching = true;
		try {
			defaultClients = await getRecentClients(20);
			clients = defaultClients;
		} catch (error) {
			console.error('Failed to load recent clients:', error);
		} finally {
			isSearching = false;
		}
	});

	let searchTimeout: ReturnType<typeof setTimeout>;

	function handleSearch() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(async () => {
			const query = searchQuery.trim();
			if (!query) {
				clients = defaultClients;
				return;
			}

			isSearching = true;
			try {
				let results: AppUser[] = [];
				if (/^\d+$/.test(query.replace(/[\s+-]/g, ''))) {
					// Looks like a phone number
					results = await searchUsersByPhone(query.replace(/\D/g, ''));
				} else {
					// Search by name
					results = await searchUsersByName(query);
				}
				clients = results;
			} catch (e) {
				console.error('Search failed:', e);
				clients = [];
			} finally {
				isSearching = false;
			}
		}, 400); // Debounce for 400ms
	}

	function handleViewHistory(client: AppUser) {
		// Assuming we can filter bookings by userId
		goto(`/staff/bookings?userId=${client.id}`);
	}

	function getInitial(name?: string) {
		return name ? name.charAt(0).toUpperCase() : '👤';
	}
</script>

<div class="clients-page s-stagger">
	<!-- Header -->
	<header class="page-header">
		<div>
			<h1 class="page-title">Clients Directory</h1>
			<p class="page-subtitle">Manage and search your customers</p>
		</div>
	</header>

	<!-- Search Bar -->
	<section class="search-section">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input 
				type="text" 
				class="search-input" 
				placeholder="Search by name or phone..." 
				bind:value={searchQuery}
				oninput={handleSearch}
			/>
			{#if isSearching}
				<div class="search-spinner"></div>
			{/if}
		</div>
	</section>

	<!-- Clients List -->
	<section class="clients-list">
		{#if clients.length > 0}
			{#each clients as client}
				<div class="client-card s-card">
					<div class="client-info-main">
						<div class="client-avatar">
							{#if client.photoURL}
								<img src={client.photoURL} alt={client.displayName || client.name || 'Client'} />
							{:else}
								<div class="avatar-fallback">{getInitial(client.displayName || client.name)}</div>
							{/if}
						</div>
						<div class="client-details">
							<h3 class="client-name">{client.displayName || client.name || 'Unnamed Client'}</h3>
							<p class="client-phone">
								<span class="icon">📞</span>
								{client.phone || client.phoneNumber || 'No phone number'}
							</p>
						</div>
					</div>
					<div class="client-actions">
						<button class="s-btn s-btn-outline s-btn-sm" onclick={() => handleViewHistory(client)}>
							View History
						</button>
					</div>
				</div>
			{/each}
		{:else if !isSearching && searchQuery}
			<EmptyState 
				icon="🕵️" 
				title="No clients found" 
				description="We couldn't find anyone matching '{searchQuery}'." 
			/>
		{:else if !isSearching && !searchQuery}
			<EmptyState 
				icon="👥" 
				title="No clients yet" 
				description="Your recent clients will appear here." 
			/>
		{/if}
	</section>
</div>

<style>
	.clients-page {
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

	.search-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid var(--s-border);
		border-top-color: var(--s-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Clients List */
	.clients-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	.client-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--s-space-lg);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		transition: all 0.3s ease;
	}

	.client-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--s-shadow-md);
		border-color: var(--s-border-strong);
	}

	.client-info-main {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
	}

	.client-avatar {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: var(--s-grad-hero);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: 700;
		font-size: 1.2rem;
		box-shadow: 0 4px 10px rgba(0,0,0,0.1);
	}

	.client-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.client-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.client-name {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.client-phone {
		margin: 0;
		font-size: 0.85rem;
		color: var(--s-text-secondary);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.client-phone .icon {
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.client-actions {
		display: flex;
		align-items: center;
	}

	@media (max-width: 480px) {
		.client-card {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--s-space-md);
		}
		
		.client-actions {
			width: 100%;
		}
		
		.client-actions .s-btn {
			width: 100%;
		}
	}
</style>

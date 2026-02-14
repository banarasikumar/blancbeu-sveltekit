<script lang="ts">
	import { goto } from '$app/navigation';
	import { allServices, type Service } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { deleteDoc, doc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		Search,
		Plus,
		MoreVertical,
		Briefcase,
		DollarSign,
		Clock,
		Trash2,
		Edit,
		X,
		Tags
	} from 'lucide-svelte';

	let searchQuery = $state('');
	let selectedService = $state<Service | null>(null);
	let sortBy = $state<'name' | 'price' | 'category'>('name');

	// Filtered & Sorted services
	let filteredServices = $derived.by(() => {
		let services = [...$allServices];

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			services = services.filter(
				(s) =>
					s.name.toLowerCase().includes(q) ||
					s.category.toLowerCase().includes(q) ||
					(s.description || '').toLowerCase().includes(q)
			);
		}

		return services.sort((a, b) => {
			if (sortBy === 'name') {
				return a.name.localeCompare(b.name);
			} else if (sortBy === 'price') {
				return a.price - b.price;
			} else {
				return a.category.localeCompare(b.category);
			}
		});
	});

	function openOptions(service: Service) {
		selectedService = service;
	}

	function closeSheet() {
		selectedService = null;
	}

	function goToAdd() {
		goto('/admin/services/add');
	}

	function goToCategories() {
		goto('/admin/services/categories');
	}

	function editService(service: Service) {
		closeSheet();
		goto(`/admin/services/add?id=${service.id}`);
	}

	async function toggleServiceStatus(service: Service, event: MouseEvent) {
		event.stopPropagation();
		try {
			const newStatus = !service.isActive; // Toggle
			await updateDoc(doc(db, 'services', service.id), {
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			});
			showToast(`Service ${newStatus ? 'enabled' : 'disabled'}`, 'success');
		} catch (error) {
			console.error('Error toggling service:', error);
			showToast('Failed to update service status', 'error');
		}
	}

	async function deleteService(service: Service) {
		if (!confirm(`Are you sure you want to delete "${service.name}"?`)) return;

		try {
			await deleteDoc(doc(db, 'services', service.id));
			showToast('Service deleted successfully', 'success');
			closeSheet();
		} catch (error) {
			console.error('Error deleting service:', error);
			showToast('Failed to delete service', 'error');
		}
	}
</script>

<!-- Header -->
<div class="admin-view-header">
	<h2 class="admin-view-title">Services</h2>
	<div style="font-size: 12px; color: var(--admin-text-secondary); font-weight: 600;">
		{filteredServices.length} Services
	</div>
</div>

<!-- Search, Sort & Add -->
<div class="admin-search-bar" style="display: flex; gap: 8px;">
	<div style="position: relative; flex: 1;">
		<Search size={16} class="admin-search-icon" />
		<input
			type="text"
			placeholder="Search services..."
			bind:value={searchQuery}
			style="width: 100%;"
		/>
	</div>
	<select class="admin-sort-select" bind:value={sortBy}>
		<option value="name">Name</option>
		<option value="price">Price (₹)</option>
		<option value="category">Category</option>
	</select>
	<button
		class="admin-icon-btn-secondary"
		onclick={goToCategories}
		aria-label="Manage Categories"
		style="margin-right: 4px;"
	>
		<Tags size={20} />
	</button>
	<button class="admin-icon-btn-primary" onclick={goToAdd} aria-label="Add Service">
		<Plus size={20} />
	</button>
</div>

<!-- Services List -->
{#if filteredServices.length === 0}
	<div class="admin-empty-state">
		<Briefcase size={44} color="var(--admin-text-tertiary)" />
		<p>No services found</p>
		<button class="admin-btn-primary" onclick={goToAdd} style="margin-top: 16px;">
			Add Your First Service
		</button>
	</div>
{:else}
	<div class="admin-list-container">
		{#each filteredServices as service (service.id)}
			<div class="admin-service-card" class:inactive={service.isActive === false}>
				{#if service.image}
					<img src={service.image} alt={service.name} class="admin-service-img" />
				{:else}
					<div class="admin-service-img-fallback">
						<Briefcase size={20} color="var(--admin-text-secondary)" />
					</div>
				{/if}

				<div class="admin-service-info">
					<div class="admin-service-header">
						<span class="admin-service-name">{service.name}</span>
						<div class="admin-service-price-container">
							{#if service.originalPrice}
								<span class="admin-service-original-price">₹{service.originalPrice}</span>
							{/if}
							<span class="admin-service-price">₹{service.price}</span>
						</div>
					</div>
					<div class="admin-service-details">
						<span class="admin-service-category">{service.category}</span>
						<span class="admin-service-dot">•</span>
						<div class="admin-service-duration">
							<Clock size={12} />
							{service.duration} min
						</div>
					</div>
				</div>

				<!-- Toggle Switch -->
				<button
					class="admin-toggle-btn"
					class:active={service.isActive !== false}
					onclick={(e) => toggleServiceStatus(service, e)}
					aria-label={service.isActive !== false ? 'Disable Service' : 'Enable Service'}
				>
					<div class="admin-toggle-thumb"></div>
				</button>

				<button class="admin-options-btn" onclick={() => openOptions(service)}>
					<MoreVertical size={18} />
				</button>
			</div>
		{/each}
	</div>
{/if}

<!-- Action Sheet -->
{#if selectedService}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="admin-action-sheet-overlay" onclick={closeSheet} role="dialog">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="admin-action-sheet" onclick={(e) => e.stopPropagation()} role="document">
			<div class="admin-action-sheet-header">
				<div>
					<h3>{selectedService.name}</h3>
					<span style="font-size: 12px; color: var(--admin-text-secondary);"
						>{selectedService.category}</span
					>
				</div>
				<button class="admin-header-btn" onclick={closeSheet} aria-label="Close">
					<X size={20} />
				</button>
			</div>

			<button class="admin-action-sheet-item" onclick={() => editService(selectedService!)}>
				<Edit size={18} color="var(--admin-accent)" />
				Edit Service
			</button>

			<button
				class="admin-action-sheet-item"
				onclick={() => deleteService(selectedService!)}
				style="color: var(--admin-red);"
			>
				<Trash2 size={18} color="var(--admin-red)" />
				Delete Service
			</button>

			<button class="admin-action-sheet-cancel" onclick={closeSheet}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	.admin-icon-btn-primary {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		border: none;
		background: var(--admin-accent);
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.admin-list-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 80px;
	}

	.admin-service-card {
		background: var(--admin-surface);
		border-radius: 16px;
		padding: 12px;
		display: flex;
		align-items: center;
		gap: 12px;
		position: relative;
	}

	.admin-service-img,
	.admin-service-img-fallback {
		width: 56px;
		height: 56px;
		border-radius: 10px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.admin-service-img-fallback {
		background: var(--admin-bg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.admin-service-info {
		flex: 1;
		min-width: 0;
	}

	.admin-service-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.admin-service-name {
		font-weight: 600;
		color: var(--admin-text);
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.admin-service-price-container {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.admin-service-original-price {
		font-size: 12px;
		color: var(--admin-text-tertiary);
		text-decoration: line-through;
	}

	.admin-service-price {
		font-weight: 700;
		color: var(--admin-accent);
		font-size: 15px;
	}

	.admin-service-details {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--admin-text-secondary);
	}

	.admin-service-category {
		background: var(--admin-bg);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
	}

	.admin-service-dot {
		color: var(--admin-text-tertiary);
	}

	.admin-service-duration {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.admin-icon-btn-secondary {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		color: var(--admin-text);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.admin-service-card.inactive {
		opacity: 0.6;
	}

	.admin-toggle-btn {
		width: 40px;
		height: 24px;
		border-radius: 12px;
		background: var(--admin-border);
		border: none;
		position: relative;
		cursor: pointer;
		margin-right: 8px;
		transition: background 0.3s ease;
		padding: 2px;
	}

	.admin-toggle-btn.active {
		background: var(--admin-accent);
	}

	.admin-toggle-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		position: absolute;
		top: 2px;
		left: 2px;
		transition: transform 0.3s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.admin-toggle-btn.active .admin-toggle-thumb {
		transform: translateX(16px);
	}
</style>

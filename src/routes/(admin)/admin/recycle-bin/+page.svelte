<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		recycledBookings,
		restoreBookings,
		permanentlyDelete,
		initRecycleBinListener,
		type RecycledBooking
	} from '$lib/stores/adminRecycleBin';
	import { formatFirestoreDate } from '$lib/stores/adminData';
	import {
		ArrowLeft,
		Trash2,
		RotateCcw,
		Square,
		CheckSquare,
		Search,
		Clock,
		AlertTriangle
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	let searchQuery = $state('');
	let isManageMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let isProcessing = $state(false);

	onMount(() => {
		initRecycleBinListener();
	});

	let filteredItems = $derived.by(() => {
		let items = $recycledBookings;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			items = items.filter(
				(b) =>
					b.userName?.toLowerCase().includes(q) ||
					b.userEmail?.toLowerCase().includes(q) ||
					b.id.toLowerCase().includes(q) ||
					JSON.stringify(b.servicesList || '').toLowerCase().includes(q) ||
					(b.serviceName || '').toLowerCase().includes(q)
			);
		}
		return items;
	});

	function toggleManageMode() {
		isManageMode = !isManageMode;
		if (!isManageMode) selectedIds = new Set();
	}

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function selectAll() {
		if (selectedIds.size === filteredItems.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(filteredItems.map((b) => b.id));
		}
	}

	function daysRemaining(deletedAt: string): number {
		const deleted = new Date(deletedAt).getTime();
		const expiry = deleted + 30 * 24 * 60 * 60 * 1000;
		const remaining = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
		return Math.max(0, remaining);
	}

	function formatDeletedDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getServices(b: RecycledBooking): string[] {
		const data =
			b.servicesList || (b.service ? b.service.split(',') : b.serviceName ? [b.serviceName] : []);
		if (!Array.isArray(data)) return [];
		return data.map((s: any) =>
			typeof s === 'string' ? s.trim() : s.name || s.serviceName || 'Unknown'
		);
	}

	async function handleRestore() {
		if (selectedIds.size === 0) return;
		if (!confirm(`Restore ${selectedIds.size} booking(s)?`)) return;
		isProcessing = true;
		try {
			const toRestore = $recycledBookings.filter((b) => selectedIds.has(b.id));
			const result = await restoreBookings(toRestore);
			if (result.restored > 0) {
				showToast(`Restored ${result.restored} booking(s)`, 'success');
			}
			if (result.errors > 0) {
				showToast(`${result.errors} failed to restore`, 'error');
			}
			selectedIds = new Set();
			isManageMode = false;
		} catch (e: any) {
			showToast('Restore failed: ' + e.message, 'error');
		} finally {
			isProcessing = false;
		}
	}

	async function handlePermanentDelete() {
		if (selectedIds.size === 0) return;
		if (
			!confirm(
				`Permanently delete ${selectedIds.size} booking(s)? This cannot be undone!`
			)
		)
			return;
		isProcessing = true;
		try {
			const toDelete = $recycledBookings.filter((b) => selectedIds.has(b.id));
			const result = await permanentlyDelete(toDelete);
			if (result.deleted > 0) {
				showToast(`Permanently deleted ${result.deleted} booking(s)`, 'success');
			}
			if (result.errors > 0) {
				showToast(`${result.errors} failed to delete`, 'error');
			}
			selectedIds = new Set();
			isManageMode = false;
		} catch (e: any) {
			showToast('Delete failed: ' + e.message, 'error');
		} finally {
			isProcessing = false;
		}
	}

	async function restoreSingle(item: RecycledBooking) {
		if (!confirm(`Restore booking #${item.id.slice(0, 8).toUpperCase()}?`)) return;
		try {
			const result = await restoreBookings([item]);
			if (result.restored > 0) showToast('Booking restored', 'success');
			else showToast('Restore failed', 'error');
		} catch {
			showToast('Restore failed', 'error');
		}
	}
</script>

<!-- Header -->
<div class="admin-view-header">
	<div style="display: flex; align-items: center; gap: 10px;">
		<button
			class="admin-recycle-btn"
			onclick={() => goto('/admin/bookings')}
			title="Back to Bookings"
		>
			<ArrowLeft size={18} />
		</button>
		<h2 class="admin-view-title" style="margin: 0;">Recycle Bin</h2>
	</div>
	<button
		class="admin-manage-btn"
		class:active={isManageMode}
		onclick={toggleManageMode}
	>
		{isManageMode ? 'Cancel' : 'Manage'}
	</button>
</div>

<p class="recycle-subtitle">
	<Clock size={12} />
	Items are automatically deleted after 30 days
</p>

<!-- Search -->
<div class="admin-search-bar">
	<Search size={16} class="admin-search-icon" />
	<input
		type="text"
		placeholder="Search deleted bookings..."
		bind:value={searchQuery}
	/>
</div>

<!-- Manage Toolbar -->
{#if isManageMode}
	<div class="admin-manage-toolbar">
		<button class="admin-manage-select-all" onclick={selectAll}>
			{#if selectedIds.size === filteredItems.length && filteredItems.length > 0}
				<CheckSquare size={18} />
			{:else}
				<Square size={18} />
			{/if}
			<span>
				{selectedIds.size === filteredItems.length && filteredItems.length > 0
					? 'Deselect All'
					: 'Select All'}
			</span>
		</button>
		<span class="admin-manage-count">{selectedIds.size} selected</span>
		<button
			class="recycle-restore-btn"
			disabled={selectedIds.size === 0 || isProcessing}
			onclick={handleRestore}
		>
			<RotateCcw size={14} />
			Restore
		</button>
		<button
			class="admin-manage-delete-btn"
			disabled={selectedIds.size === 0 || isProcessing}
			onclick={handlePermanentDelete}
		>
			<Trash2 size={14} />
			Delete Forever
		</button>
	</div>
{/if}

<!-- Results Count -->
<div class="admin-result-counter">
	<span>{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} in recycle bin</span>
</div>

<!-- Items -->
{#if filteredItems.length === 0}
	<div class="admin-empty-state">
		<Trash2 size={44} color="var(--admin-text-tertiary)" />
		<p>{searchQuery ? 'No matches found' : 'Recycle Bin is empty'}</p>
	</div>
{:else}
	{#each filteredItems as item (item.id)}
		{@const services = getServices(item)}
		{@const days = daysRemaining(item.deletedAt)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="admin-swipe-container"
		>
			<div
				class="admin-booking-card cancelled recycle-card"
				class:admin-card-selected={isManageMode && selectedIds.has(item.id)}
				role="region"
				onclick={() => isManageMode && toggleSelect(item.id)}
			>
				<div class="admin-booking-header">
					{#if isManageMode}
						<button
							class="admin-select-checkbox"
							class:checked={selectedIds.has(item.id)}
							onclick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
						>
							{#if selectedIds.has(item.id)}
								<CheckSquare size={20} />
							{:else}
								<Square size={20} />
							{/if}
						</button>
					{/if}
					<span class="admin-booking-id">#{item.id.slice(0, 8).toUpperCase()}</span>
					<span class="recycle-days-badge" class:urgent={days <= 5}>
						{#if days <= 0}
							Expiring...
						{:else}
							{days}d left
						{/if}
					</span>
				</div>

				<div class="admin-details-grid">
					<div class="admin-detail-item full-width">
						<span class="admin-detail-label">Client</span>
						<span class="admin-detail-value" style="font-weight: 700;">
							{item.userName || 'Guest'}
						</span>
					</div>

					{#if services.length > 0}
						<div class="admin-detail-item full-width">
							<span class="admin-detail-label">Services</span>
							<div class="admin-service-chips" style="margin-top: 4px;">
								{#each services as service}
									<span class="admin-service-chip" style="background: rgba(255,69,58,0.1); color: #dc2626;">
										{service}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					<div class="admin-detail-item">
						<span class="admin-detail-label">Deleted On</span>
						<span class="admin-detail-value" style="font-size: 11px;">
							{formatDeletedDate(item.deletedAt)}
						</span>
					</div>

					<div class="admin-detail-item">
						<span class="admin-detail-label">Status Was</span>
						<span class="admin-detail-value" style="text-transform: capitalize;">
							{item.status || 'unknown'}
						</span>
					</div>
				</div>

				{#if !isManageMode}
					<div class="recycle-card-actions">
						<button
							class="recycle-action-restore"
							onclick={(e) => { e.stopPropagation(); restoreSingle(item); }}
						>
							<RotateCcw size={14} />
							Restore
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/each}
{/if}

<style>
	.recycle-subtitle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--admin-text-secondary);
		margin: -4px 0 8px;
		font-weight: 500;
	}

	.recycle-card {
		opacity: 0.9 !important;
	}

	.recycle-days-badge {
		padding: 4px 10px;
		border-radius: var(--admin-radius-full);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		background: var(--admin-orange-light);
		color: var(--admin-orange);
		border: 1px solid rgba(255, 159, 10, 0.2);
	}

	.recycle-days-badge.urgent {
		background: linear-gradient(135deg, #FF453A, #dc2626);
		color: #fff;
		border: none;
		box-shadow: 0 2px 6px rgba(255, 69, 58, 0.3);
	}

	.recycle-card-actions {
		display: flex;
		gap: 8px;
		margin-top: 12px;
	}

	.recycle-action-restore {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: var(--admin-radius-md);
		background: linear-gradient(135deg, #30D158 0%, #28a745 100%);
		color: #fff;
		border: none;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(48, 209, 88, 0.25);
		transition: all 0.2s ease;
	}

	.recycle-action-restore:active {
		transform: scale(0.97);
	}

	.recycle-restore-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 7px 14px;
		border-radius: var(--admin-radius-md, 8px);
		background: linear-gradient(135deg, #30D158 0%, #28a745 100%);
		color: #fff;
		border: none;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(48, 209, 88, 0.25);
	}

	.recycle-restore-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		box-shadow: none;
	}

	.recycle-restore-btn:not(:disabled):active {
		transform: scale(0.96);
	}
</style>

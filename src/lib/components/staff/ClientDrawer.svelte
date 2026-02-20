<script lang="ts">
	import { getBookingHistory } from '$lib/stores/staffData';
	import StatusBadge from '$lib/components/staff/StatusBadge.svelte';
	import type { Booking } from '$lib/stores/adminData';

	let {
		isOpen = $bindable(false),
		userId = '',
		userName = '',
		userPhone = '',
		userEmail = ''
	}: {
		isOpen?: boolean;
		userId?: string;
		userName?: string;
		userPhone?: string;
		userEmail?: string;
	} = $props();

	let loading = $state(false);
	let history = $state<Booking[]>([]);

	$effect(() => {
		if (isOpen && userId) {
			loadHistory();
		}
	});

	async function loadHistory() {
		loading = true;
		history = await getBookingHistory(userId);
		loading = false;
	}

	let totalVisits = $derived(history.filter((b) => b.status === 'completed').length);
	let totalSpent = $derived(
		history
			.filter((b) => b.status === 'completed')
			.reduce((sum, b) => sum + (b.totalAmount || b.price || 0), 0)
	);

	// Most frequent service
	let favoriteService = $derived(() => {
		const counts: Record<string, number> = {};
		history.forEach((b) => {
			const name = b.servicesList?.[0]?.name || b.serviceName || '';
			if (name) counts[name] = (counts[name] || 0) + 1;
		});
		const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
		return sorted[0]?.[0] || 'N/A';
	});

	function formatDate(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function close() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="drawer-backdrop" onclick={close}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="drawer-panel" onclick={(e) => e.stopPropagation()}>
			<div class="s-modal-handle"></div>

			<!-- Header -->
			<div class="drawer-header">
				<div class="client-avatar-lg">
					{userName?.[0]?.toUpperCase() || 'G'}
				</div>
				<h2 class="client-name">{userName || 'Guest'}</h2>
				{#if userPhone}
					<a href="tel:{userPhone}" class="client-contact">📞 {userPhone}</a>
				{/if}
				{#if userEmail}
					<span class="client-email">{userEmail}</span>
				{/if}
				<button class="drawer-close" onclick={close}>✕</button>
			</div>

			<!-- Stats -->
			<div class="client-stats">
				<div class="cs-item">
					<span class="cs-value">{totalVisits}</span>
					<span class="cs-label">Visits</span>
				</div>
				<div class="cs-divider"></div>
				<div class="cs-item">
					<span class="cs-value">₹{totalSpent.toLocaleString()}</span>
					<span class="cs-label">Total Spent</span>
				</div>
				<div class="cs-divider"></div>
				<div class="cs-item">
					<span class="cs-value">{favoriteService()}</span>
					<span class="cs-label">Favorite</span>
				</div>
			</div>

			<!-- History -->
			<div class="history-section">
				<h3 class="history-title">Visit History</h3>

				{#if loading}
					<div class="history-loading">
						<div class="s-skeleton" style="height: 60px"></div>
						<div class="s-skeleton" style="height: 60px"></div>
						<div class="s-skeleton" style="height: 60px"></div>
					</div>
				{:else if history.length === 0}
					<p class="history-empty">No visit history yet.</p>
				{:else}
					<div class="history-list">
						{#each history as booking}
							<div class="history-item">
								<div class="hi-left">
									<span class="hi-date">{formatDate(booking.date)}</span>
									<span class="hi-time">{booking.time || ''}</span>
								</div>
								<div class="hi-center">
									<p class="hi-service">
										{#if booking.servicesList?.length}
											{booking.servicesList.map((s) => s.name).join(', ')}
										{:else}
											{booking.serviceName || 'Service'}
										{/if}
									</p>
									<span class="hi-price">₹{booking.totalAmount || booking.price || '-'}</span>
								</div>
								<StatusBadge status={booking.status} size="sm" />
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(4px);
		z-index: var(--s-z-modal, 400);
		display: flex;
		justify-content: flex-end;
		animation: s-fadeIn 0.2s var(--s-ease);
	}

	.drawer-panel {
		width: 90%;
		max-width: 380px;
		height: 100%;
		background: var(--s-bg-elevated);
		overflow-y: auto;
		padding: var(--s-space-lg) var(--s-space-xl);
		animation: s-slideInRight 0.35s var(--s-ease-spring);
		box-shadow: var(--s-shadow-xl);
		position: relative;
	}

	.drawer-close {
		position: absolute;
		top: var(--s-space-lg);
		right: var(--s-space-lg);
		background: var(--s-bg-tertiary);
		border: none;
		width: 32px;
		height: 32px;
		border-radius: var(--s-radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		color: var(--s-text-secondary);
		cursor: pointer;
	}

	.drawer-header {
		text-align: center;
		padding: var(--s-space-xl) 0;
	}

	.client-avatar-lg {
		width: 72px;
		height: 72px;
		border-radius: var(--s-radius-xl);
		background: linear-gradient(135deg, var(--s-accent), var(--s-accent-dark, #b08d4f));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 2rem;
		margin: 0 auto var(--s-space-md);
		box-shadow: var(--s-shadow-md);
	}

	.client-name {
		margin: 0 0 4px;
		font-family: var(--s-font-display);
		font-size: var(--s-text-xl);
		font-weight: 700;
	}

	.client-contact {
		font-size: var(--s-text-sm);
		color: var(--s-accent);
		text-decoration: none;
		display: block;
		font-weight: 500;
	}

	.client-email {
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
	}

	/* Stats */
	.client-stats {
		display: flex;
		justify-content: space-around;
		align-items: center;
		background: var(--s-surface);
		padding: var(--s-space-lg);
		border-radius: var(--s-radius-lg);
		border: 1px solid var(--s-border);
		margin-bottom: var(--s-space-xl);
	}

	.cs-item {
		text-align: center;
	}

	.cs-value {
		display: block;
		font-family: var(--s-font-display);
		font-size: var(--s-text-md);
		font-weight: 800;
		color: var(--s-text-primary);
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cs-label {
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.cs-divider {
		width: 1px;
		height: 28px;
		background: var(--s-border);
	}

	/* History */
	.history-title {
		font-family: var(--s-font-display);
		font-size: var(--s-text-md);
		font-weight: 700;
		margin: 0 0 var(--s-space-md);
	}

	.history-loading {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.history-empty {
		text-align: center;
		color: var(--s-text-tertiary);
		font-size: var(--s-text-sm);
		padding: var(--s-space-xl) 0;
	}

	.history-list {
		display: flex;
		flex-direction: column;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-md) 0;
		border-bottom: 1px solid var(--s-border);
	}

	.history-item:last-child {
		border-bottom: none;
	}

	.hi-left {
		flex-shrink: 0;
		width: 64px;
	}

	.hi-date {
		display: block;
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.hi-time {
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
	}

	.hi-center {
		flex: 1;
		min-width: 0;
	}

	.hi-service {
		margin: 0;
		font-size: var(--s-text-sm);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hi-price {
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		font-weight: 600;
	}
</style>

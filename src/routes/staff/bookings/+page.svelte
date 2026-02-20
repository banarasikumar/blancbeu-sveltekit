<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus, type Booking } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { startServiceTimer } from '$lib/stores/serviceTimer';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import ClientDrawer from '$lib/components/staff/ClientDrawer.svelte';
	import StatusBadge from '$lib/components/staff/StatusBadge.svelte';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// Filter from URL
	let urlFilter = $derived(page.url.searchParams.get('filter') || 'upcoming');

	let activeFilter = $state('upcoming');
	let searchQuery = $state('');

	// Sync filter from URL param on mount
	$effect(() => {
		if (urlFilter) activeFilter = urlFilter;
	});

	const filters = [
		{ key: 'upcoming', label: '📅 Upcoming', emoji: '📅' },
		{ key: 'pending', label: '⏳ Pending', emoji: '⏳' },
		{ key: 'today', label: '🕐 Today', emoji: '🕐' },
		{ key: 'completed', label: '✅ Done', emoji: '✅' },
		{ key: 'cancelled', label: '❌ Cancelled', emoji: '❌' },
		{ key: 'all', label: '📋 All', emoji: '📋' }
	];

	let filteredBookings = $derived(() => {
		let bookings = [...$staffBookings];
		const today = new Date().toISOString().split('T')[0];

		switch (activeFilter) {
			case 'upcoming':
				bookings = bookings.filter(
					(b) => b.status !== 'completed' && b.status !== 'cancelled' && b.date >= today
				);
				break;
			case 'pending':
				bookings = bookings.filter((b) => b.status === 'pending');
				break;
			case 'today':
				bookings = bookings.filter((b) => b.date === today);
				break;
			case 'completed':
				bookings = bookings.filter((b) => b.status === 'completed');
				break;
			case 'cancelled':
				bookings = bookings.filter((b) => b.status === 'cancelled');
				break;
		}

		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			bookings = bookings.filter(
				(b) =>
					b.userName?.toLowerCase().includes(q) ||
					b.serviceName?.toLowerCase().includes(q) ||
					b.servicesList?.some((s) => s.name.toLowerCase().includes(q))
			);
		}

		// Smart sort: newest-first for completed/cancelled, soonest-first otherwise
		const showNewestFirst = activeFilter === 'completed' || activeFilter === 'cancelled';
		return bookings.sort((a, b) => {
			const dateCmp = (a.date || '').localeCompare(b.date || '');
			if (dateCmp !== 0) return showNewestFirst ? -dateCmp : dateCmp;
			const timeCmp = (a.time || '').localeCompare(b.time || '');
			return showNewestFirst ? -timeCmp : timeCmp;
		});
	});

	// Modal
	let isModalOpen = $state(false);
	let modalMode = $state('create');
	let selectedBooking = $state<any>(null);

	// Client drawer
	let isDrawerOpen = $state(false);
	let drawerUserId = $state('');
	let drawerUserName = $state('');
	let drawerUserPhone = $state('');
	let drawerUserEmail = $state('');

	function openBooking(booking: any) {
		selectedBooking = booking;
		modalMode = 'edit';
		isModalOpen = true;
	}

	function openClient(booking: any) {
		drawerUserId = booking.userId || booking.userEmail || '';
		drawerUserName = booking.userName || 'Guest';
		drawerUserPhone = booking.userPhone || '';
		drawerUserEmail = booking.userEmail || '';
		isDrawerOpen = true;
	}

	async function quickAction(id: string, status: string, e?: Event) {
		e?.stopPropagation();
		if (status === 'cancelled' && !confirm('Cancel this booking?')) return;
		try {
			await updateBookingStatus(id, status);
			showToast(`Updated to ${status}`, 'success');
			if ('vibrate' in navigator) navigator.vibrate(10);
		} catch {
			showToast('Failed to update', 'error');
		}
	}

	function formatTime12h(time: string) {
		if (!time) return '';
		const cleaned = time.replace(/\s*(AM|PM)\s*/i, '').trim();
		const parts = cleaned.split(':');
		const h = parseInt(parts[0], 10);
		const m = parseInt(parts[1] || '0', 10);
		if (isNaN(h)) return time;
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${(isNaN(m) ? 0 : m).toString().padStart(2, '0')} ${ampm}`;
	}

	function formatDuration(mins: number) {
		if (mins >= 60) {
			const h = Math.floor(mins / 60);
			const m = mins % 60;
			return m > 0 ? `${h}h ${m}m` : `${h}h`;
		}
		return `${mins}m`;
	}

	function formatDate(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		const today = new Date();
		const todayStr = today.toISOString().split('T')[0];
		const yesterday = new Date(today);
		yesterday.setDate(today.getDate() - 1);
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		if (dateStr === todayStr) return 'Today';
		if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
		if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Group bookings by date
	let groupedBookings = $derived(() => {
		const groups: Record<string, any[]> = {};
		filteredBookings().forEach((b) => {
			const key = b.date || 'unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(b);
		});
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	});

	let pendingBadge = $derived($staffBookings.filter((b) => b.status === 'pending').length);
</script>

<div class="bookings-page">
	<!-- Search Bar -->
	<div class="search-section">
		<div class="search-wrap">
			<svg
				class="search-icon"
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			>
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				type="text"
				class="search-input"
				placeholder="Search clients or services..."
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => (searchQuery = '')}>✕</button>
			{/if}
		</div>
	</div>

	<!-- Filter Pills -->
	<div class="filter-pills s-scrollbar-hide">
		{#each filters as filter}
			<button
				class="filter-pill"
				class:active={activeFilter === filter.key}
				onclick={() => {
					activeFilter = filter.key;
					goto(`/staff/bookings?filter=${filter.key}`, { replaceState: true });
				}}
			>
				{filter.label}
				{#if filter.key === 'pending' && pendingBadge > 0}
					<span class="pill-badge">{pendingBadge}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Results Count -->
	<div class="results-bar">
		<span class="results-count">{filteredBookings().length} bookings</span>
	</div>

	<!-- Grouped Bookings -->
	{#if filteredBookings().length === 0}
		<EmptyState
			icon="🔍"
			title="No bookings found"
			description={searchQuery ? 'Try a different search' : 'No bookings match this filter'}
			actionLabel="Clear Filters"
			onAction={() => {
				searchQuery = '';
				activeFilter = 'all';
			}}
		/>
	{:else}
		<div class="bookings-list s-stagger">
			{#each groupedBookings() as [dateKey, bookings]}
				<div class="date-group">
					<div class="date-divider">
						<span class="dd-label">{formatDate(dateKey)}</span>
						<span class="dd-count">{bookings.length}</span>
					</div>

					{#each bookings as booking}
						<div
							class="booking-card s-card s-card-interactive"
							onclick={() => openBooking(booking)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
						>
							<!-- Status edge -->
							<div class="bc-edge {booking.status}"></div>

							<div class="bc-body">
								<div class="bc-top">
									<button
										class="bc-avatar"
										onclick={(e) => {
											e.stopPropagation();
											openClient(booking);
										}}
									>
										{booking.userName?.[0]?.toUpperCase() || 'G'}
									</button>
									<div class="bc-info">
										<h4 class="bc-name">{booking.userName || 'Guest'}</h4>
										<p class="bc-services">
											{#if booking.servicesList?.length}
												{booking.servicesList.map((s: any) => s.name).join(', ')}
											{:else}
												{booking.serviceName || 'Service'}
											{/if}
										</p>
									</div>
									<StatusBadge status={booking.status} size="sm" />
								</div>

								<div class="bc-meta">
									<span class="bc-meta-item">🕐 {formatTime12h(booking.time)}</span>
									{#if booking.servicesList?.some((s: any) => s.duration)}
										<span class="bc-meta-item"
											>⏱ {formatDuration(
												booking.servicesList.reduce((a: number, s: any) => a + (s.duration || 0), 0)
											)}</span
										>
									{/if}
									<span class="bc-meta-item price"
										>₹{booking.totalAmount || booking.price || '-'}</span
									>
								</div>

								<!-- Quick Actions -->
								<div class="bc-actions">
									{#if booking.status === 'pending'}
										<button
											class="qa s-btn s-btn-sm"
											style="background: var(--s-confirmed); color: white; flex: 1"
											onclick={(e) => quickAction(booking.id, 'confirmed', e)}>✓ Confirm</button
										>
										<button
											class="qa s-btn s-btn-sm s-btn-danger"
											onclick={(e) => quickAction(booking.id, 'cancelled', e)}>✕</button
										>
									{:else if booking.status === 'confirmed'}
										<button
											class="qa s-btn s-btn-sm s-btn-accent"
											style="flex: 1"
											onclick={async (e) => {
												e.stopPropagation();
												startServiceTimer(booking);
												showToast('Timer started!', 'success');
											}}>▶ Start</button
										>
									{:else if booking.status === 'in-progress'}
										<button
											class="qa s-btn s-btn-sm"
											style="background: var(--s-completed); color: white; flex: 1"
											onclick={(e) => {
												e.stopPropagation();
												goto(`/staff/bookings/${booking.id}`);
											}}>✓ Complete</button
										>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	<!-- FAB -->
	<button
		class="fab"
		onclick={() => {
			modalMode = 'create';
			selectedBooking = null;
			isModalOpen = true;
		}}
		aria-label="New booking"
	>
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
		>
			<line x1="12" y1="5" x2="12" y2="19"></line>
			<line x1="5" y1="12" x2="19" y2="12"></line>
		</svg>
	</button>
</div>

<BookingModal
	bind:isOpen={isModalOpen}
	mode={modalMode}
	existingBooking={selectedBooking}
	onClose={() => (isModalOpen = false)}
/>

<ClientDrawer
	bind:isOpen={isDrawerOpen}
	userId={drawerUserId}
	userName={drawerUserName}
	userPhone={drawerUserPhone}
	userEmail={drawerUserEmail}
/>

<style>
	.bookings-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	/* Search */
	.search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 14px;
		color: var(--s-text-tertiary);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 12px 40px 12px 42px;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		font-size: var(--s-text-base);
		color: var(--s-text-primary);
		outline: none;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.search-input:focus {
		border-color: var(--s-accent);
		box-shadow: 0 0 0 3px var(--s-accent-bg);
	}

	.search-input::placeholder {
		color: var(--s-text-tertiary);
	}

	.search-clear {
		position: absolute;
		right: 12px;
		background: var(--s-bg-tertiary);
		border: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		font-size: 0.7rem;
		color: var(--s-text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Filters */
	.filter-pills {
		display: flex;
		gap: var(--s-space-sm);
		overflow-x: auto;
		padding: 2px 0;
	}

	.filter-pill {
		flex-shrink: 0;
		padding: 7px 14px;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-full);
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		display: flex;
		align-items: center;
		gap: 4px;
		white-space: nowrap;
	}

	.filter-pill.active {
		background: var(--s-brand);
		color: white;
		border-color: var(--s-brand);
	}

	:global(.staff-app.dark) .filter-pill.active {
		background: var(--s-accent);
		color: #1a1a2e;
		border-color: var(--s-accent);
	}

	.filter-pill:active {
		transform: scale(0.95);
	}

	.pill-badge {
		background: white;
		color: var(--s-brand);
		width: 18px;
		height: 18px;
		border-radius: 50%;
		font-size: 0.6rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
	}

	.filter-pill.active .pill-badge {
		background: rgba(255, 255, 255, 0.3);
		color: white;
	}

	/* Results */
	.results-bar {
		padding: 0 2px;
	}

	.results-count {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Date Group */
	.date-group {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.date-divider {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--s-space-sm);
	}

	.dd-label {
		font-family: var(--s-font-display);
		font-size: var(--s-text-sm);
		font-weight: 700;
		color: var(--s-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.dd-count {
		font-size: var(--s-text-xs);
		background: var(--s-bg-tertiary);
		padding: 2px 8px;
		border-radius: var(--s-radius-full);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	/* Booking Card */
	.booking-card {
		display: flex;
		overflow: hidden;
	}

	.bc-edge {
		width: 4px;
		flex-shrink: 0;
	}

	.bc-edge.pending {
		background: var(--s-pending);
	}
	.bc-edge.confirmed {
		background: var(--s-confirmed);
	}
	.bc-edge.in-progress {
		background: var(--s-in-progress);
	}
	.bc-edge.completed {
		background: var(--s-completed);
	}
	.bc-edge.cancelled {
		background: var(--s-cancelled);
	}

	.bc-body {
		flex: 1;
		padding: var(--s-space-md) var(--s-space-lg);
	}

	.bc-top {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
	}

	.bc-avatar {
		width: 36px;
		height: 36px;
		border-radius: var(--s-radius-md);
		background: linear-gradient(135deg, var(--s-accent), var(--s-accent-dark, #b08d4f));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
		flex-shrink: 0;
		border: none;
		cursor: pointer;
		transition: transform var(--s-duration-fast) var(--s-ease);
	}

	.bc-avatar:active {
		transform: scale(0.9);
	}

	.bc-info {
		flex: 1;
		min-width: 0;
	}

	.bc-name {
		margin: 0;
		font-size: var(--s-text-base);
		font-weight: 600;
	}

	.bc-services {
		margin: 1px 0 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bc-meta {
		display: flex;
		gap: var(--s-space-md);
		margin-top: var(--s-space-sm);
		flex-wrap: wrap;
	}

	.bc-meta-item {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-tertiary);
	}

	.bc-meta-item.price {
		color: var(--s-text-primary);
		font-weight: 700;
	}

	.bc-actions {
		display: flex;
		gap: var(--s-space-sm);
		margin-top: var(--s-space-md);
	}

	/* FAB */
	.fab {
		position: fixed;
		bottom: calc(var(--s-nav-height, 68px) + 20px);
		right: 20px;
		width: 56px;
		height: 56px;
		border-radius: var(--s-radius-full);
		background: var(--s-brand);
		color: white;
		border: none;
		box-shadow: var(--s-shadow-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 50;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	:global(.staff-app.dark) .fab {
		background: var(--s-accent);
		color: #1a1a2e;
	}

	.fab:active {
		transform: scale(0.9);
		box-shadow: var(--s-shadow-xl);
	}
</style>

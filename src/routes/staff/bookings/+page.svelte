<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus, type Booking } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import {
		now,
		getElapsedSeconds,
		startServiceTimer,
		pauseTimer,
		resumeTimer
	} from '$lib/stores/serviceTimer';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import CircularProgress from '$lib/components/staff/CircularProgress.svelte';
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
		{ key: 'completed', label: '✅ Done', emoji: '✅' },
		{ key: 'all', label: '📋 All', emoji: '📋' },
		{ key: 'cancelled', label: '❌ Cancelled', emoji: '❌' }
	];

	let filteredBookings = $derived(() => {
		let bookings = [...$staffBookings];
		const today = new Date().toISOString().split('T')[0];

		switch (activeFilter) {
			case 'upcoming':
				// All of today's bookings (any status) + future active bookings
				bookings = bookings.filter((b) => {
					if (b.date === today) return true; // All today's bookings regardless of status
					if (b.date > today && b.status !== 'completed' && b.status !== 'cancelled') return true; // Future active
					return false;
				});
				break;
			case 'pending':
				bookings = bookings.filter((b) => b.status === 'pending');
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

		// Always sort newest-first
		return bookings.sort((a, b) => {
			const dateCmp = (b.date || '').localeCompare(a.date || '');
			if (dateCmp !== 0) return dateCmp;
			return (b.time || '').localeCompare(a.time || '');
		});
	});

	// Modal
	let isModalOpen = $state(false);
	let modalMode = $state('create');
	let selectedBooking = $state<any>(null);

	// Auto-open booking from URL query param
	let urlBookingId = $derived(page.url.searchParams.get('bookingId'));
	
	$effect(() => {
		if (urlBookingId && $staffBookings.length > 0) {
			const booking = $staffBookings.find(b => b.id === urlBookingId);
			if (booking) {
				selectedBooking = booking;
				modalMode = 'edit';
				isModalOpen = true;
				// Clean up URL after opening
				const url = new URL(page.url);
				url.searchParams.delete('bookingId');
				goto(url, { replaceState: true, keepFocus: true });
			}
		}
	});

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

	// Payment info helpers
	function getPaymentLabel(booking: any): string {
		const p = booking.payment;
		if (!p) return '';
		if (p.type === 'full') return 'Prepaid';
		if (p.type === 'token') return 'Token';
		if (p.type === 'free' || p.method === 'pay_at_salon') return 'Pay at Salon';
		return '';
	}

	function getPaymentMethodIcon(booking: any): string {
		const p = booking.payment;
		if (!p) return '';
		if (p.type === 'full') return '💳';
		if (p.type === 'token') return '🪙';
		return '🏪';
	}

	function getPaymentBadgeClass(booking: any): string {
		const p = booking.payment;
		if (!p) return '';
		if (p.type === 'full') return 'payment-prepaid';
		if (p.type === 'token') return 'payment-token';
		return 'payment-salon';
	}

	// Group bookings by date — for upcoming, split active vs done today
	let activeBookings = $derived(() => {
		const today = new Date().toISOString().split('T')[0];
		if (activeFilter === 'upcoming') {
			// Active = not completed/cancelled
			return filteredBookings().filter((b) => b.status !== 'completed' && b.status !== 'cancelled');
		}
		return filteredBookings();
	});

	let todayDoneBookings = $derived(() => {
		const today = new Date().toISOString().split('T')[0];
		if (activeFilter === 'upcoming') {
			return filteredBookings().filter(
				(b) => b.date === today && (b.status === 'completed' || b.status === 'cancelled')
			);
		}
		return [];
	});

	let groupedBookings = $derived(() => {
		const groups: Record<string, any[]> = {};
		activeBookings().forEach((b) => {
			const key = b.date || 'unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(b);
		});
		if (activeFilter === 'upcoming') {
			return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])); // chronological for upcoming
		}
		return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0])); // newest-first for all other filters
	});

	let filterCounts = $derived(() => {
		const today = new Date().toISOString().split('T')[0];
		const counts: Record<string, number> = {
			upcoming: 0,
			pending: 0,
			completed: 0,
			cancelled: 0,
			all: $staffBookings.length
		};
		
		for (const b of $staffBookings) {
			if (b.status === 'pending') counts.pending++;
			if (b.status === 'completed') counts.completed++;
			if (b.status === 'cancelled') counts.cancelled++;
			
			if (b.date === today) {
				counts.upcoming++;
			} else if (b.date > today && b.status !== 'completed' && b.status !== 'cancelled') {
				counts.upcoming++;
			}
		}
		return counts;
	});
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
				{#if filterCounts()[filter.key] > 0}
					<span class="pill-badge">{filterCounts()[filter.key]}</span>
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
		{#if activeFilter === 'upcoming'}
			<EmptyState
				icon="📅"
				title="No bookings for today"
				description={searchQuery ? 'Try a different search' : 'No upcoming bookings'}
				actionLabel={searchQuery ? "Clear Filters" : ""}
				onAction={() => {
					searchQuery = '';
				}}
			/>
		{:else}
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
		{/if}
	{:else}
		<div class="bookings-list s-stagger">
			{#if activeFilter === 'upcoming'}
				<div class="date-divider">
					<span class="dd-label">📅 Upcoming</span>
					<span class="dd-count">{activeBookings().length}</span>
				</div>
				{#if activeBookings().length === 0}
					<EmptyState
						icon="☕"
						title="All Caught Up!"
						description="No upcoming appointments. Time for a break?"
					/>
				{/if}
			{/if}
			{#each groupedBookings() as [dateKey, bookings]}
				<div class="date-group">
					<div class="date-divider">
						<span class="dd-label">{formatDate(dateKey)}</span>
						<span class="dd-count">{bookings.length}</span>
					</div>

					{#each bookings as booking}
						<div
							class="booking-card s-card s-card-interactive {booking.status === 'in-progress'
								? 'active-service-mode'
								: 'card-' + booking.status}"
							onclick={() => openBooking(booking)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
						>
							{#if booking.status === 'in-progress'}
								{@const elapsed = getElapsedSeconds(booking, $now)}
								{@const totalMins =
									booking.servicesList?.reduce((a: number, s: any) => a + (s.duration || 30), 0) ||
									30}
								{@const totalSeconds = totalMins * 60}
								{@const progress =
									totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0}
								{@const isOvertime = elapsed > totalSeconds}
								{@const remaining = Math.max(0, totalSeconds - elapsed)}
								{@const formattedElapsed = (() => {
									const h = Math.floor(elapsed / 3600);
									const m = Math.floor((elapsed % 3600) / 60);
									const s = elapsed % 60;
									return h > 0
										? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
										: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
								})()}
								{@const formattedRemaining = (() => {
									const h = Math.floor(remaining / 3600);
									const m = Math.floor((remaining % 3600) / 60);
									const s = remaining % 60;
									return h > 0
										? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
										: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
								})()}

								<div class="active-service-content">
									<div class="service-timer-header">
										<div class="timer-info">
											<span class="timer-label">
												{#if booking.isTimerRunning}
													🔴 In Service
												{:else}
													⏸ Paused
												{/if}
											</span>
											<h3 class="timer-client">{booking.userName || 'Guest'}</h3>
											<p class="timer-phone">
												{#if booking.userPhone}
													<svg
														class="phone-icon"
														width="12"
														height="12"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														><path
															d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
														/></svg
													>
													{booking.userPhone}
												{:else}
													<span class="no-phone">No phone number</span>
												{/if}
											</p>
											<p class="timer-service">
												{#if booking.servicesList?.length}
													{booking.servicesList.map((s: any) => s.name).join(', ')}
												{:else}
													{booking.serviceName || 'Service'}
												{/if}
											</p>
										</div>
										<CircularProgress
											{progress}
											size={72}
											strokeWidth={5}
											color={isOvertime ? 'var(--s-error)' : 'var(--s-accent)'}
										>
											<span class="timer-value" class:overtime={isOvertime}>
												{isOvertime ? '+' : ''}{formattedElapsed}
											</span>
										</CircularProgress>
									</div>
									<div class="timer-remaining">
										{#if isOvertime}
											<span class="overtime-text"
												>⚠️ Overtime — was expected {formatDuration(totalMins)}</span
											>
										{:else}
											<span class="remaining-text">{formattedRemaining} remaining</span>
										{/if}
									</div>
									{#if booking.payment}
										<div class="bc-payment timer-payment">
											<span class="payment-badge {getPaymentBadgeClass(booking)}">
												{getPaymentMethodIcon(booking)}
												{getPaymentLabel(booking)}
											</span>
											<span class="bc-meta-item price"
												>₹{booking.totalAmount || booking.price || '-'}</span
											>
											{#if booking.payment.type === 'token' && booking.payment.amount}
												<div class="payment-details">
													<span class="payment-paid">✓ ₹{booking.payment.amount} paid</span>
													<span class="payment-due"
														>• ₹{(booking.totalAmount || booking.price || 0) -
															booking.payment.amount} due</span
													>
												</div>
											{:else if booking.payment.type === 'full' && booking.payment.amount}
												<span class="payment-paid">✓ Fully paid</span>
											{/if}
										</div>
									{/if}
									<div class="timer-notes" class:notes-empty={!booking.notes}>
										<span class="timer-notes-icon">📝</span>
										<p class="timer-notes-text">
											{#if booking.notes}
												{booking.notes}
											{:else}
												<span class="notes-none">Notes: None</span>
											{/if}
										</p>
									</div>
									<div class="timer-actions">
										{#if !booking.isTimerRunning}
											<button
												class="timer-btn-outline"
												onclick={(e) => {
													e.stopPropagation();
													resumeTimer(booking);
												}}
											>
												▶ Resume
											</button>
										{:else}
											<button
												class="timer-btn-outline"
												onclick={(e) => {
													e.stopPropagation();
													pauseTimer(booking);
												}}
											>
												⏸ Pause
											</button>
										{/if}
										<button
											class="timer-btn-complete"
											onclick={(e) => {
												e.stopPropagation();
												goto(`/staff/bookings/${booking.id}`);
											}}
										>
											✓ Complete Service
										</button>
									</div>
								</div>
							{:else}
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
											<p class="bc-phone">
												{#if booking.userPhone}
													<svg
														class="phone-icon"
														width="12"
														height="12"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														><path
															d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
														/></svg
													>
													{booking.userPhone}
												{:else}
													<span class="no-phone">No phone number</span>
												{/if}
											</p>
											<p class="bc-services">
												{#if booking.servicesList?.length}
													{booking.servicesList.map((s: any) => s.name).join(', ')}
												{:else}
													{booking.serviceName || 'Service'}
												{/if}
											</p>
										</div>
										<div class="bc-badges">
											<StatusBadge status={booking.status} size="sm" />
											{#if booking.status === 'completed'}
												{#if booking.payment?.status === 'paid'}
													<span class="pay-tag paid">✓ Paid</span>
												{:else}
													<span class="pay-tag unpaid">Unpaid</span>
												{/if}
											{/if}
										</div>
									</div>

									<div class="bc-meta">
										<span class="bc-meta-item">🕐 {formatTime12h(booking.time)}</span>
										{#if booking.servicesList?.some((s: any) => s.duration)}
											<span class="bc-meta-item"
												>⏱ {formatDuration(
													booking.servicesList.reduce(
														(a: number, s: any) => a + (s.duration || 0),
														0
													)
												)}</span
											>
										{/if}
										<span class="bc-meta-item price"
											>₹{booking.totalAmount || booking.price || '-'}</span
										>
									</div>

									<!-- Payment Info -->
									{#if booking.payment}
										<div class="bc-payment">
											<span class="payment-badge {getPaymentBadgeClass(booking)}">
												{getPaymentMethodIcon(booking)}
												{getPaymentLabel(booking)}
											</span>
											{#if booking.payment.type === 'token' && booking.payment.amount}
												<div class="payment-details">
													<span class="payment-paid">✓ ₹{booking.payment.amount} paid</span>
													<span class="payment-due"
														>• ₹{(booking.totalAmount || booking.price || 0) -
															booking.payment.amount} due</span
													>
												</div>
											{:else if booking.payment.type === 'full' && booking.payment.amount}
												<span class="payment-paid">✓ Fully paid</span>
											{/if}
										</div>
									{/if}

									<!-- Premium Quick Actions -->
									<div class="bc-actions">
										{#if booking.status === 'pending'}
											<button
												class="bk-btn bk-btn-confirm"
												onclick={(e) => quickAction(booking.id, 'confirmed', e)}>✓ Confirm</button
											>
											<button
												class="bk-btn bk-btn-decline"
												onclick={(e) => quickAction(booking.id, 'cancelled', e)}>✕ Decline</button
											>
										{:else if booking.status === 'confirmed'}
											<button
												class="bk-btn bk-btn-start"
												onclick={async (e) => {
													e.stopPropagation();
													startServiceTimer(booking);
													showToast('Timer started!', 'success');
												}}>▶ Start</button
											>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		{#if todayDoneBookings().length > 0}
			<div class="done-today-section">
				<div class="date-divider done-divider">
					<span class="dd-label">✅ Completed / Cancelled Today</span>
					<span class="dd-count">{todayDoneBookings().length}</span>
				</div>
				{#each todayDoneBookings() as booking}
					<div
						class="booking-card s-card s-card-interactive card-{booking.status}"
						onclick={() => openBooking(booking)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
					>
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
									<p class="bc-phone">
										{#if booking.userPhone}
											<svg
												class="phone-icon"
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												><path
													d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
												/></svg
											>
											{booking.userPhone}
										{:else}
											<span class="no-phone">No phone number</span>
										{/if}
									</p>
									<p class="bc-services">
										{#if booking.servicesList?.length}
											{booking.servicesList.map((s: any) => s.name).join(', ')}
										{:else}
											{booking.serviceName || 'Service'}
										{/if}
									</p>
								</div>
								<div class="bc-badges">
									<StatusBadge status={booking.status} size="sm" />
									{#if booking.status === 'completed'}
										{#if booking.payment?.status === 'paid'}
											<span class="pay-tag paid">✓ Paid</span>
										{:else}
											<span class="pay-tag unpaid">Unpaid</span>
										{/if}
									{/if}
								</div>
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

							{#if booking.payment}
								<div class="bc-payment">
									<span class="payment-badge {getPaymentBadgeClass(booking)}">
										{getPaymentMethodIcon(booking)}
										{getPaymentLabel(booking)}
									</span>
									{#if booking.payment.type === 'token' && booking.payment.amount}
										<div class="payment-details">
											<span class="payment-paid">✓ ₹{booking.payment.amount} paid</span>
											<span class="payment-due"
												>• ₹{(booking.totalAmount || booking.price || 0) - booking.payment.amount} due</span
											>
										</div>
									{:else if booking.payment.type === 'full' && booking.payment.amount}
										<span class="payment-paid">✓ Fully paid</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
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

	/* ═══════════════════════════════════════════
	   ACTIVE SERVICE TIMER (In-Progress Cards)
	   ═══════════════════════════════════════════ */
	.booking-card.active-service-mode {
		background: var(--s-surface);
		border: 2px solid var(--s-accent);
		box-shadow: var(--s-shadow-glow);
		animation: s-scaleIn 0.4s var(--s-ease-spring);
	}

	.active-service-content {
		padding: var(--s-space-lg);
	}

	.service-timer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--s-space-md);
	}

	.timer-info {
		flex: 1;
		min-width: 0;
	}

	.timer-label {
		font-size: var(--s-text-xs);
		font-weight: 700;
		text-transform: uppercase;
		color: var(--s-accent);
		letter-spacing: 0.05em;
	}

	.timer-client {
		margin: 4px 0 2px;
		font-family: var(--s-font-display);
		font-size: var(--s-text-lg);
		font-weight: 700;
	}

	.timer-phone,
	.bc-phone {
		margin: 2px 0 0;
		font-size: 0.75rem;
		color: var(--s-text-tertiary);
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.phone-icon {
		flex-shrink: 0;
		opacity: 0.6;
	}

	.no-phone {
		font-style: italic;
		opacity: 0.6;
	}

	.timer-service {
		margin: 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
	}

	.timer-value {
		font-family: var(--s-font-display);
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--s-accent);
	}

	.timer-value.overtime {
		color: var(--s-error);
	}

	.timer-remaining {
		text-align: center;
		margin-bottom: var(--s-space-md);
	}

	.remaining-text {
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		font-weight: 500;
	}

	.overtime-text {
		font-size: var(--s-text-sm);
		color: var(--s-error);
		font-weight: 600;
	}

	.timer-actions {
		display: flex;
		gap: var(--s-space-md);
		margin-top: var(--s-space-sm);
	}

	.timer-notes {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: var(--s-space-sm);
		margin-bottom: var(--s-space-xs);
		padding: 10px 14px;
		background: #fef9c3;
		border-radius: var(--s-radius-md);
		border-left: 3px solid #eab308;
	}
	:global(.staff-app.dark) .timer-notes {
		background: rgba(234, 179, 8, 0.1);
		border-left-color: #facc15;
	}

	.timer-notes-icon {
		font-size: 0.9rem;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.timer-notes-text {
		margin: 0;
		font-size: var(--s-text-sm);
		font-weight: 500;
		color: #92400e;
		line-height: 1.4;
		font-style: italic;
	}
	:global(.staff-app.dark) .timer-notes-text {
		color: #fde68a;
	}

	.timer-notes.notes-empty {
		background: var(--s-bg-tertiary);
		border-left-color: var(--s-border);
	}
	:global(.staff-app.dark) .timer-notes.notes-empty {
		background: rgba(255, 255, 255, 0.04);
		border-left-color: rgba(255, 255, 255, 0.1);
	}

	.notes-none {
		color: var(--s-text-tertiary);
		font-style: italic;
		font-weight: 400;
	}

	.timer-btn-outline {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px 18px;
		border-radius: var(--s-radius-lg);
		font-weight: 700;
		font-size: 0.9rem;
		background: transparent;
		color: var(--s-text-primary);
		border: 1.5px solid var(--s-border-strong);
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.timer-btn-outline:active {
		transform: scale(0.97);
	}
	:global(.staff-app.dark) .timer-btn-outline {
		border-color: rgba(255, 255, 255, 0.2);
	}

	.timer-btn-complete {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 20px;
		border-radius: var(--s-radius-lg);
		font-weight: 700;
		font-size: 0.9rem;
		border: none;
		cursor: pointer;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
		transition: all 0.3s ease;
	}
	@media (hover: hover) {
		.timer-btn-complete:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
		}
	}
	.timer-btn-complete:active {
		transform: translateY(0);
	}
	:global(.staff-app.dark) .timer-btn-complete {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	/* ═══════════════════════════════════════════
	   BOOKING CARD — Premium Elevated Design
	   ═══════════════════════════════════════════ */
	.booking-card {
		display: flex;
		overflow: hidden;
		position: relative;
		border-radius: var(--s-radius-xl);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.04),
			0 6px 18px rgba(0, 0, 0, 0.06);
		transition:
			transform var(--s-duration-normal) var(--s-ease),
			box-shadow var(--s-duration-normal) var(--s-ease);
	}
	:global(.staff-app.dark) .booking-card {
		background: var(--s-surface-raised);
		border-color: var(--s-border-strong);
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.25),
			0 8px 24px rgba(0, 0, 0, 0.35);
	}
	@media (hover: hover) {
		.booking-card:hover {
			transform: translateY(-3px);
			box-shadow:
				0 6px 12px rgba(0, 0, 0, 0.08),
				0 12px 36px rgba(0, 0, 0, 0.12);
		}
		:global(.staff-app.dark) .booking-card:hover {
			box-shadow:
				0 8px 16px rgba(0, 0, 0, 0.35),
				0 16px 40px rgba(0, 0, 0, 0.45);
		}
	}
	.booking-card:active {
		transform: scale(0.985);
	}

	/* ── Status Left Accent Bar ── */
	.card-pending,
	.card-confirmed,
	.card-in-progress,
	.card-completed,
	.card-cancelled {
		padding-left: 4px;
	}
	.card-pending::before,
	.card-confirmed::before,
	.card-in-progress::before,
	.card-completed::before,
	.card-cancelled::before {
		content: '';
		position: absolute;
		left: 0;
		top: 8px;
		bottom: 8px;
		width: 3.5px;
		border-radius: 0 var(--s-radius-sm) var(--s-radius-sm) 0;
	}

	/* ── Status-Specific Styles ── */
	.card-pending {
		background: var(--s-pending-bg);
		border-color: var(--s-border);
	}
	.card-pending::before {
		background: var(--s-pending);
	}

	.card-confirmed {
		background: var(--s-confirmed-bg);
		border-color: var(--s-border);
	}
	.card-confirmed::before {
		background: var(--s-confirmed);
	}

	.card-in-progress {
		background: var(--s-in-progress-bg);
		border-color: var(--s-border);
	}
	.card-in-progress::before {
		background: var(--s-in-progress);
	}

	.card-completed {
		background: var(--s-completed-bg);
		border-color: var(--s-border);
	}
	.card-completed::before {
		background: var(--s-completed);
	}

	.card-cancelled {
		background: var(--s-cancelled-bg);
		border-color: var(--s-border);
		opacity: 0.75;
	}
	.card-cancelled::before {
		background: var(--s-cancelled);
	}

	.bc-body {
		flex: 1;
		padding: var(--s-space-lg);
	}

	.bc-top {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
	}

	.bc-avatar {
		width: 40px;
		height: 40px;
		border-radius: var(--s-radius-md);
		background: linear-gradient(135deg, var(--s-accent), var(--s-accent-dark, #b08d4f));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1rem;
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
		font-family: var(--s-font-display);
		font-size: var(--s-text-md);
		font-weight: 700;
	}

	.bc-services {
		margin: 2px 0 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bc-meta {
		display: flex;
		gap: var(--s-space-lg);
		margin-top: var(--s-space-md);
		padding: var(--s-space-md) 0;
		border-top: 1px solid var(--s-border);
		border-bottom: 1px solid var(--s-border);
		flex-wrap: wrap;
	}

	.bc-meta-item {
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.bc-meta-item.price {
		color: var(--s-text-primary);
		font-weight: 700;
	}

	/* ── Payment Info ── */
	.bc-payment {
		display: flex;
		align-items: center;
		gap: var(--s-space-sm);
		margin-top: var(--s-space-sm);
		flex-wrap: wrap;
	}

	.bc-payment.timer-payment {
		justify-content: center;
		margin-bottom: var(--s-space-sm);
		padding-top: var(--s-space-sm);
		border-top: 1px solid var(--s-border);
	}

	.payment-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-radius: var(--s-radius-full);
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		white-space: nowrap;
	}

	.payment-prepaid {
		background: rgba(16, 185, 129, 0.12);
		color: #059669;
	}
	:global(.staff-app.dark) .payment-prepaid {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}

	.payment-token {
		background: rgba(217, 164, 6, 0.12);
		color: #b45309;
	}
	:global(.staff-app.dark) .payment-token {
		background: rgba(217, 164, 6, 0.15);
		color: #fbbf24;
	}

	.payment-salon {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}
	:global(.staff-app.dark) .payment-salon {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}

	.payment-details {
		display: flex;
		align-items: center;
		gap: var(--s-space-sm);
	}

	.payment-paid {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: #059669;
	}
	:global(.staff-app.dark) .payment-paid {
		color: #34d399;
	}

	.payment-due {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-error, #ef4444);
	}

	.bc-actions {
		display: flex;
		gap: var(--s-space-md);
		margin-top: var(--s-space-md);
	}

	/* Premium Action Buttons */
	.bk-btn {
		flex: 1;
		padding: 10px 16px;
		border-radius: var(--s-radius-lg);
		font-weight: 700;
		font-size: 0.85rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: white;
	}
	.bk-btn:active {
		transform: scale(0.97);
	}

	.bk-btn-confirm {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
	}
	@media (hover: hover) {
		.bk-btn-confirm:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		}
	}

	.bk-btn-decline {
		flex: 0.5;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
	}
	@media (hover: hover) {
		.bk-btn-decline:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
		}
	}

	.bk-btn-start {
		background: linear-gradient(135deg, var(--s-accent) 0%, var(--s-accent-dark, #b08d4f) 100%);
		box-shadow: 0 2px 8px rgba(201, 169, 110, 0.2);
	}
	@media (hover: hover) {
		.bk-btn-start:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(201, 169, 110, 0.3);
		}
	}

	.bk-btn-complete {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
	}
	@media (hover: hover) {
		.bk-btn-complete:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
		}
	}

	:global(.staff-app.dark) .bk-btn-confirm,
	:global(.staff-app.dark) .bk-btn-decline,
	:global(.staff-app.dark) .bk-btn-start,
	:global(.staff-app.dark) .bk-btn-complete {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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

	/* Done Today Section */
	.done-today-section {
		margin-top: var(--s-space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.done-divider {
		padding-top: var(--s-space-md);
		border-top: 1px dashed var(--s-border);
	}

	.done-card {
		opacity: 0.75;
		transition: opacity 0.2s ease;
	}

	.done-card:hover {
		opacity: 1;
	}

	.no-upcoming-msg {
		text-align: center;
		color: var(--s-text-tertiary);
		font-size: var(--s-text-sm);
		padding: var(--s-space-md) 0;
		font-style: italic;
	}

	.bc-badges {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.pay-tag {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 99px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.pay-tag.paid {
		background: #dcfce7;
		color: #15803d;
		border: 1px solid #bbf7d0;
	}

	.pay-tag.unpaid {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}
</style>

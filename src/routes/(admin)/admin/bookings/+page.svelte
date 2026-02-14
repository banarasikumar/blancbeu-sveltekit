<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		allBookings,
		formatFirestoreDate,
		getBookingTimestamp,
		formatRelativeTime,
		calculateCountdown,
		updateBookingStatus,
		type Booking
	} from '$lib/stores/adminData';
	import { Search, Calendar, Check, Ban, ClipboardCheck } from 'lucide-svelte';

	// --- State ---
	let currentTab = $state<'unfinished' | 'finished'>('unfinished');
	let currentSort = $state<'createdAt' | 'date' | 'userName'>('createdAt');
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let currentPage = $state(1);
	let showDateModal = $state(false);
	let dateStart = $state('');
	let dateEnd = $state('');
	const itemsPerPage = 50;

	// --- Processing states ---
	let processingIds = $state<Record<string, 'processing' | 'vanishing'>>({});
	let confirmAction = $state<{ id: string; action: string } | null>(null);
	let confirmTimer: ReturnType<typeof setTimeout> | null = null;

	// --- Filter Chips ---
	const unfinishedChips = [
		{ label: 'All', value: 'all', color: 'var(--admin-accent)' },
		{ label: 'Confirmed', value: 'confirmed', color: 'var(--admin-green)' },
		{ label: 'Pending', value: 'pending', color: 'var(--admin-orange)' },
		{ label: 'Overdue', value: 'overdue', color: 'var(--admin-red)' }
	];

	const finishedChips = [
		{ label: 'All', value: 'all', color: 'var(--admin-accent)' },
		{ label: 'Completed', value: 'completed', color: 'var(--admin-green)' },
		{ label: 'Cancelled', value: 'cancelled', color: 'var(--admin-red)' }
	];

	let activeChips = $derived(currentTab === 'unfinished' ? unfinishedChips : finishedChips);

	// --- Filtered & sorted bookings ---
	let filteredBookings = $derived.by(() => {
		const now = Date.now();
		let filtered = $allBookings.filter((b) => {
			// Include processing/vanishing items
			if (processingIds[b.id]) return true;

			const s = (b.status || 'pending').toLowerCase();

			// Tab scoping
			let inScope = false;
			if (currentTab === 'unfinished') {
				inScope = ['pending', 'confirmed'].includes(s);
			} else {
				inScope = ['completed', 'cancelled', 'declined'].includes(s);
			}
			if (!inScope) return false;

			// Status filter
			if (statusFilter !== 'all') {
				if (statusFilter === 'overdue') {
					if (s !== 'pending') return false;
					const ts = getBookingTimestamp(b);
					if (ts > now) return false;
				} else {
					if (s !== statusFilter) return false;
				}
			}

			// Search
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const searchStr =
					`${b.id} ${b.userName} ${b.userEmail} ${b.userPhone || ''} ${JSON.stringify(b.services || '')} ${JSON.stringify(b.servicesList || '')}`.toLowerCase();
				if (!searchStr.includes(q)) return false;
			}

			// Date range
			if (dateStart || dateEnd) {
				const ts = getBookingTimestamp(b);
				if (dateStart) {
					const startTs = new Date(dateStart).setHours(0, 0, 0, 0);
					if (ts < startTs) return false;
				}
				if (dateEnd) {
					const endTs = new Date(dateEnd).setHours(23, 59, 59, 999);
					if (ts > endTs) return false;
				}
			}

			return true;
		});

		// Sort
		filtered.sort((a, b) => {
			if (currentSort === 'createdAt') {
				const tA = a.createdAt?.seconds || new Date(a.createdAt).getTime() || 0;
				const tB = b.createdAt?.seconds || new Date(b.createdAt).getTime() || 0;
				return tB - tA;
			}
			if (currentSort === 'date') {
				return getBookingTimestamp(a) - getBookingTimestamp(b);
			}
			if (currentSort === 'userName') {
				return (a.userName || '').localeCompare(b.userName || '');
			}
			return 0;
		});

		return filtered;
	});

	// Pagination
	let totalPages = $derived(Math.ceil(filteredBookings.length / itemsPerPage));
	let paginatedBookings = $derived.by(() => {
		if (currentTab === 'finished') {
			const start = (currentPage - 1) * itemsPerPage;
			return filteredBookings.slice(start, start + itemsPerPage);
		}
		return filteredBookings;
	});

	let resultText = $derived.by(() => {
		if (currentTab === 'finished') {
			const start = (currentPage - 1) * itemsPerPage;
			const end = Math.min(start + itemsPerPage, filteredBookings.length);
			return `Showing ${Math.min(start + 1, filteredBookings.length)}–${end} of ${filteredBookings.length}`;
		}
		return `Showing ${filteredBookings.length} results`;
	});

	// --- Tab Switch ---
	function switchTab(tab: 'unfinished' | 'finished') {
		currentTab = tab;
		statusFilter = 'all';
		searchQuery = '';
		dateStart = '';
		dateEnd = '';
		currentPage = 1;
	}

	// --- Update Booking ---
	async function handleStatusUpdate(bookingId: string, newStatus: string) {
		// Native confirm dialog removed as it was blocking execution on some devices
		// logic proceeds directly

		processingIds[bookingId] = 'processing';
		processingIds = { ...processingIds };

		try {
			await updateBookingStatus(bookingId, newStatus);

			processingIds[bookingId] = 'vanishing';
			processingIds = { ...processingIds };

			const msgs: Record<string, string> = {
				completed: 'Marked as Completed',
				confirmed: 'Booking Confirmed',
				cancelled: 'Booking Cancelled'
			};
			showToast(msgs[newStatus] || 'Status Updated', 'success');

			setTimeout(() => {
				delete processingIds[bookingId];
				processingIds = { ...processingIds };
			}, 700);
		} catch (e: any) {
			console.error('Firestore update error:', e);
			delete processingIds[bookingId];
			processingIds = { ...processingIds };
			showToast('Error: ' + e.message, 'error');
		}
	}

	// --- Date Range ---
	function applyDate() {
		if (!dateStart && !dateEnd) return;
		showDateModal = false;
		currentPage = 1;
	}

	function clearDate() {
		dateStart = '';
		dateEnd = '';
		showDateModal = false;
		currentPage = 1;
	}

	// --- Service Chips ---
	function getServices(b: Booking): string[] {
		const data =
			b.servicesList || (b.service ? b.service.split(',') : b.serviceName ? [b.serviceName] : []);
		if (!Array.isArray(data)) return [];
		return data.map((s: any) =>
			typeof s === 'string' ? s.trim() : s.name || s.serviceName || 'Unknown'
		);
	}

	const chipColors = [
		{ bg: 'rgba(212, 175, 55, 0.1)', text: '#D4AF37' }, // Gold
		{ bg: 'rgba(191, 90, 242, 0.1)', text: '#BF5AF2' }, // Purple
		{ bg: 'rgba(48, 209, 88, 0.1)', text: '#30D158' }, // Green
		{ bg: 'rgba(255, 159, 10, 0.1)', text: '#FF9F0A' }, // Orange
		{ bg: 'rgba(255, 55, 95, 0.1)', text: '#FF375F' }, // Pink
		{ bg: 'rgba(94, 92, 230, 0.1)', text: '#5E5CE6' }, // Indigo
		{ bg: 'rgba(100, 210, 255, 0.1)', text: '#64D2FF' }, // Light Blue
		{ bg: 'rgba(255, 214, 10, 0.1)', text: '#FFD60A' } // Yellow
	];

	// --- Avatar ---
	const avatarColors = ['#FF9F0A', '#30D158', '#D4AF37', '#BF5AF2', '#FF375F', '#AC8E68'];

	function getAvatarColor(name: string): string {
		const code = (name || 'U').charCodeAt(0);
		return avatarColors[code % avatarColors.length];
	}

	// --- Swipe ---
	let swipeStartX = 0;
	let swipeStartY = 0;
	let swipingId = $state<string | null>(null);
	let swipeOffsets = $state<Record<string, number>>({});

	function onTouchStart(e: TouchEvent, bookingId: string) {
		swipeStartX = e.touches[0].clientX;
		swipeStartY = e.touches[0].clientY;
		// Only start swipe if we are not already swiping another item or this item
		if (swipingId && swipingId !== bookingId) {
			// Close others
			swipingId = null;
			swipeOffsets = {};
		}
		swipingId = bookingId;
	}

	function onTouchMove(e: TouchEvent, bookingId: string) {
		if (swipingId !== bookingId) return;

		const currentX = e.touches[0].clientX;
		const currentY = e.touches[0].clientY;
		const diffX = currentX - swipeStartX;
		const diffY = currentY - swipeStartY;

		// If user is scrolling vertically more than horizontally, ignore swipe
		if (Math.abs(diffY) > Math.abs(diffX)) {
			return; // Allow native scroll
		}

		// Prevent native scroll if swiping horizontally
		if (Math.abs(diffX) > 10) {
			if (e.cancelable) e.preventDefault();
		}

		// Only allow swiping to the right (positive diffX) since actions are on the left
		if (diffX > 0 && diffX < 200) {
			swipeOffsets[bookingId] = diffX;
			swipeOffsets = { ...swipeOffsets };
		}
	}

	function onTouchEnd(e: TouchEvent, bookingId: string) {
		if (swipingId !== bookingId) return;

		const offset = swipeOffsets[bookingId] || 0;
		if (offset > 80) {
			// Changed threshold to 80px for easier activation
			swipeOffsets[bookingId] = 160; // Keep open
		} else {
			swipeOffsets[bookingId] = 0; // Close
			swipingId = null;
		}
		swipeOffsets = { ...swipeOffsets };
		// Don't nullify swipingId immediately if kept open, so we know which one is open?
		// Actually, if we keep open, we can reset swipingId or keep it.
		// Let's reset swipingId so other touches can start.
		swipingId = null;
	}

	function closeSwipe(bookingId: string) {
		if (swipeOffsets[bookingId] && swipeOffsets[bookingId] > 0) {
			swipeOffsets[bookingId] = 0;
			swipeOffsets = { ...swipeOffsets };
		}
	}
</script>

<!-- View Header -->
<div class="admin-view-header">
	<h2 class="admin-view-title">Bookings</h2>
	<select class="admin-sort-select" bind:value={currentSort} aria-label="Sort bookings">
		<option value="createdAt">Recent</option>
		<option value="date">Appt. Date</option>
		<option value="userName">Client Name</option>
	</select>
</div>

<!-- Segmented Tabs -->
<div class="admin-segmented">
	<button
		class="admin-segment-btn"
		class:active={currentTab === 'unfinished'}
		onclick={() => switchTab('unfinished')}
	>
		Unfinished
	</button>
	<button
		class="admin-segment-btn"
		class:active={currentTab === 'finished'}
		onclick={() => switchTab('finished')}
	>
		History
	</button>
</div>

<!-- Controls -->
<div class="admin-search-bar">
	<Search size={16} class="admin-search-icon" />
	<input
		type="text"
		placeholder="Search name, ID, service..."
		bind:value={searchQuery}
		oninput={() => (currentPage = 1)}
	/>
</div>

<div class="admin-filter-row">
	{#each activeChips as chip}
		<button
			class="admin-filter-chip"
			class:active={statusFilter === chip.value}
			style={statusFilter === chip.value
				? `background: ${chip.color}; border-color: ${chip.color}; color: #fff;`
				: ''}
			onclick={() => {
				statusFilter = chip.value;
				currentPage = 1;
			}}
		>
			{chip.label}
		</button>
	{/each}
	<button
		class="admin-filter-chip"
		class:active={!!dateStart}
		style={dateStart
			? 'background: var(--admin-accent); border-color: var(--admin-accent); color: #000; font-weight: 700;'
			: 'border-style: dashed;'}
		onclick={() => (showDateModal = true)}
	>
		<Calendar size={12} style="display:inline; vertical-align: middle; margin-right: 4px;" />
		{dateStart && dateEnd
			? `${new Date(dateStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${new Date(dateEnd).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
			: 'Date Range'}
	</button>
</div>

<div class="admin-result-counter">
	<span>{resultText}</span>
</div>

<!-- Bookings List -->
{#if paginatedBookings.length === 0}
	<div class="admin-empty-state">
		<ClipboardCheck size={44} color="var(--admin-text-tertiary)" />
		<p>No {currentTab} bookings</p>
	</div>
{:else}
	{#each paginatedBookings as booking (booking.id)}
		{@const status = (booking.status || 'pending').toLowerCase()}
		{@const statusClass = status === 'declined' ? 'cancelled' : status}
		{@const dateStr = formatFirestoreDate(booking.date)}
		{@const bookedOn = formatRelativeTime(booking.createdAt)}
		{@const countdown = calculateCountdown(booking.date, booking.time)}
		{@const services = getServices(booking)}
		{@const isProcessing = processingIds[booking.id] === 'processing'}
		{@const isVanishing = processingIds[booking.id] === 'vanishing'}
		{@const offset = swipeOffsets[booking.id] || 0}

		<div class="admin-swipe-container" class:admin-card-vanishing={isVanishing}>
			<!-- Swipe Actions -->
			<!-- Swipe Actions (Only render if this card is being swiped or is open) -->
			{#if currentTab === 'unfinished' && (swipingId === booking.id || offset !== 0)}
				<div class="admin-swipe-actions">
					<button
						class="admin-swipe-btn complete"
						onclick={(e) => {
							e.stopPropagation();
							handleStatusUpdate(booking.id, 'completed');
						}}
						ontouchend={(e) => {
							e.stopPropagation();
						}}
					>
						<Check size={18} />
						Complete
					</button>
					<button
						class="admin-swipe-btn cancel"
						onclick={(e) => {
							e.stopPropagation();
							handleStatusUpdate(booking.id, 'cancelled');
						}}
						ontouchend={(e) => {
							e.stopPropagation();
						}}
					>
						<Ban size={18} />
						Cancel
					</button>
				</div>
			{/if}

			<!-- Card -->
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="admin-swipe-content admin-booking-card {statusClass}"
				role="region"
				style="transform: translateX({offset}px); transition: {swipingId === booking.id
					? 'none'
					: 'transform 0.3s ease-out'};"
				ontouchstart={(e) => onTouchStart(e, booking.id)}
				ontouchmove={(e) => onTouchMove(e, booking.id)}
				ontouchend={(e) => onTouchEnd(e, booking.id)}
				onclick={() => closeSwipe(booking.id)}
			>
				{#if isProcessing}
					<div class="admin-processing-overlay">
						<div class="admin-spinner"></div>
						<span class="admin-processing-text">Processing...</span>
					</div>
				{/if}

				<!-- Header -->
				<div class="admin-booking-header">
					<span class="admin-booking-id">#{booking.id.slice(0, 8).toUpperCase()}</span>
					<span class="admin-status-badge {statusClass}">{status}</span>
				</div>

				<!-- Details Grid -->
				<div class="admin-details-grid">
					<!-- Appointment -->
					<div
						class="admin-detail-item full-width"
						style="background: var(--admin-accent-light); border-color: rgba(0,122,255,0.15);"
					>
						<span class="admin-detail-label">
							<Calendar size={10} /> Appointment
						</span>
						<div
							style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;"
						>
							<span class="admin-detail-value" style="font-size: 15px; font-weight: 700;">
								{dateStr} • {booking.time || '--:--'}
							</span>
							{#if countdown}
								<span
									class="admin-countdown"
									class:upcoming={!countdown.isOverdue}
									class:overdue={countdown.isOverdue}
								>
									{countdown.label}
								</span>
							{/if}
						</div>
					</div>

					<!-- Client -->
					<div class="admin-detail-item full-width">
						<span class="admin-detail-label">Client</span>
						<div style="display: flex; align-items: center; gap: 10px; margin-top: 4px;">
							{#if booking.userPhoto}
								<img src={booking.userPhoto} alt={booking.userName} class="admin-avatar-img" />
							{:else}
								<div
									class="admin-avatar-fallback"
									style="background: {getAvatarColor(booking.userName || '')};"
								>
									{(booking.userName || 'G').charAt(0).toUpperCase()}
								</div>
							{/if}
							<div style="min-width: 0;">
								<div style="font-size: 14px; font-weight: 700; color: var(--admin-text-primary);">
									{booking.userName || 'Guest'}
								</div>
								<div
									style="font-size: 12px; color: var(--admin-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
								>
									{booking.userEmail || 'No Email'}
								</div>
							</div>
						</div>
					</div>

					<!-- Services -->
					<div class="admin-detail-item full-width">
						<span class="admin-detail-label">Services</span>
						{#if services.length > 0}
							<div class="admin-service-chips" style="margin-top: 4px;">
								{#each services as service, i}
									{@const c = chipColors[(service.length + i) % chipColors.length]}
									<span class="admin-service-chip" style="background: {c.bg}; color: {c.text};">
										{service}
									</span>
								{/each}
							</div>
						{:else}
							<span style="color: var(--admin-text-secondary); font-style: italic; font-size: 13px;"
								>No services</span
							>
						{/if}
					</div>

					<!-- Contact -->
					<div class="admin-detail-item">
						<span class="admin-detail-label">Contact</span>
						<span class="admin-detail-value">{booking.userPhone || 'N/A'}</span>
					</div>

					<!-- Booked On -->
					<div class="admin-detail-item">
						<span class="admin-detail-label">Booked On</span>
						<span class="admin-detail-value" style="font-size: 11px; font-weight: 500;"
							>{bookedOn}</span
						>
					</div>

					<!-- Special Request -->
					<div class="admin-detail-item full-width">
						<span class="admin-detail-label">Special Request</span>
						{#if booking.notes}
							<span class="admin-detail-value" style="font-weight: 500; white-space: normal;"
								>{booking.notes}</span
							>
						{:else}
							<span style="font-size: 13px; color: var(--admin-text-secondary); font-style: italic;"
								>None</span
							>
						{/if}
					</div>
				</div>

				{#if currentTab === 'unfinished' && status === 'pending'}
					<div class="admin-card-actions">
						<button
							class="admin-action-btn confirm"
							class:awaiting={confirmAction?.id === booking.id &&
								confirmAction?.action === 'confirmed'}
							disabled={isProcessing}
							onclick={(e) => {
								e.stopPropagation();
								if (confirmAction?.id === booking.id && confirmAction?.action === 'confirmed') {
									confirmAction = null;
									handleStatusUpdate(booking.id, 'confirmed');
								} else {
									if (confirmTimer) clearTimeout(confirmTimer);
									confirmAction = { id: booking.id, action: 'confirmed' };
									confirmTimer = setTimeout(() => {
										confirmAction = null;
									}, 5000);
								}
							}}
						>
							<Check size={13} />
							{confirmAction?.id === booking.id && confirmAction?.action === 'confirmed'
								? 'Sure?'
								: 'Confirm'}
						</button>
						<button
							class="admin-action-btn cancel"
							class:awaiting={confirmAction?.id === booking.id &&
								confirmAction?.action === 'cancelled'}
							disabled={isProcessing}
							onclick={(e) => {
								e.stopPropagation();
								if (confirmAction?.id === booking.id && confirmAction?.action === 'cancelled') {
									confirmAction = null;
									handleStatusUpdate(booking.id, 'cancelled');
								} else {
									if (confirmTimer) clearTimeout(confirmTimer);
									confirmAction = { id: booking.id, action: 'cancelled' };
									confirmTimer = setTimeout(() => {
										confirmAction = null;
									}, 5000);
								}
							}}
						>
							<Ban size={13} />
							{confirmAction?.id === booking.id && confirmAction?.action === 'cancelled'
								? 'Sure?'
								: 'Cancel'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/each}
{/if}

<!-- Pagination -->
{#if currentTab === 'finished' && totalPages > 1}
	<div class="admin-pagination">
		<button
			disabled={currentPage === 1}
			onclick={() => {
				currentPage--;
			}}
		>
			Prev
		</button>
		<span>Page {currentPage} of {totalPages}</span>
		<button
			disabled={currentPage === totalPages}
			onclick={() => {
				currentPage++;
			}}
		>
			Next
		</button>
	</div>
{/if}

<!-- Date Range Modal -->
{#if showDateModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="admin-modal-overlay"
		onclick={() => (showDateModal = false)}
		role="dialog"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="admin-modal" onclick={(e) => e.stopPropagation()} role="document">
			<h3>Select Dates</h3>
			<p>Filter bookings by appointment date</p>

			<label for="date-start">From</label>
			<input type="date" id="date-start" bind:value={dateStart} />

			<label for="date-end">To</label>
			<input type="date" id="date-end" bind:value={dateEnd} />

			<div class="admin-modal-actions">
				<button class="admin-modal-btn secondary" onclick={() => (showDateModal = false)}
					>Cancel</button
				>
				<button class="admin-modal-btn primary" onclick={applyDate}>Apply</button>
			</div>
			<button class="admin-modal-clear" onclick={clearDate}>Clear Filter</button>
		</div>
	</div>
{/if}

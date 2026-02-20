<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { startServiceTimer } from '$lib/stores/serviceTimer';
	import StatusBadge from '$lib/components/staff/StatusBadge.svelte';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import { onMount } from 'svelte';

	let viewMode = $state<'day' | 'week' | 'month'>('day');
	let selectedDate = $state(new Date());

	// Modal state
	let isModalOpen = $state(false);
	let modalMode = $state('edit');
	let selectedBooking = $state<any>(null);

	const formatDateKey = (d: Date) => d.toISOString().split('T')[0];

	// Current time indicator
	let currentTimePercent = $state(0);
	let currentTimeLabel = $state('');

	function updateCurrentTime() {
		const now = new Date();
		const h = now.getHours();
		const m = now.getMinutes();
		// Business hours 8AM - 10PM (14 hours range)
		const startHour = 8;
		const endHour = 22;
		const totalMinutes = (endHour - startHour) * 60;
		const currentMinutes = (h - startHour) * 60 + m;
		currentTimePercent = Math.max(0, Math.min(100, (currentMinutes / totalMinutes) * 100));
		currentTimeLabel = `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
	}

	onMount(() => {
		updateCurrentTime();
		const interval = setInterval(updateCurrentTime, 60000);
		return () => clearInterval(interval);
	});

	// Time slots for the ruler
	const timeSlots = Array.from({ length: 15 }, (_, i) => {
		const h = i + 8; // 8AM to 10PM
		return {
			hour: h,
			label: h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`
		};
	});

	function getDaysOfWeek(current: Date) {
		const week = [];
		const start = new Date(current);
		start.setDate(current.getDate() - current.getDay());
		for (let i = 0; i < 7; i++) {
			const day = new Date(start);
			day.setDate(start.getDate() + i);
			week.push(day);
		}
		return week;
	}

	let dailyBookings = $derived(
		$staffBookings
			.filter((b) => b.date && b.date === formatDateKey(selectedDate))
			.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
	);

	let weekDays = $derived(getDaysOfWeek(selectedDate));

	function getDayStats(date: Date) {
		const key = formatDateKey(date);
		const bookings = $staffBookings.filter((b) => b.date === key);
		const completed = bookings.filter((b) => b.status === 'completed').length;
		return {
			count: bookings.length,
			completed,
			hasPending: bookings.some((b) => b.status === 'pending'),
			hasInProgress: bookings.some((b) => b.status === 'in-progress'),
			isToday: key === formatDateKey(new Date()),
			revenue: bookings
				.filter((b) => b.status === 'completed')
				.reduce((s, b) => s + (b.totalAmount || b.price || 0), 0)
		};
	}

	// Month calendar data
	function getMonthDays(date: Date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const days = [];
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
		return days;
	}

	let monthDays = $derived(getMonthDays(selectedDate));

	function changeDate(amount: number) {
		const newDate = new Date(selectedDate);
		if (viewMode === 'day') newDate.setDate(selectedDate.getDate() + amount);
		else if (viewMode === 'week') newDate.setDate(selectedDate.getDate() + amount * 7);
		else newDate.setMonth(selectedDate.getMonth() + amount);
		selectedDate = newDate;
	}

	function setToday() {
		selectedDate = new Date();
	}

	function openBooking(booking: any) {
		selectedBooking = booking;
		modalMode = 'edit';
		isModalOpen = true;
	}

	function formatTime12h(time: string) {
		const parsed = parseTimeStr(time);
		if (!parsed) return time;
		const { h, m } = parsed;
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
	}

	function formatDuration(mins: number) {
		if (mins >= 60) {
			const h = Math.floor(mins / 60);
			const m = mins % 60;
			return m > 0 ? `${h}h ${m}m` : `${h}h`;
		}
		return `${mins}m`;
	}

	function parseTimeStr(time: string) {
		if (!time) return null;
		const isPM = /pm/i.test(time);
		const isAM = /am/i.test(time);
		const cleaned = time.replace(/\s*(am|pm)\s*/i, '').trim();
		const [hStr, mStr] = cleaned.split(':');
		let h = parseInt(hStr, 10);
		const m = parseInt(mStr || '0', 10);

		if (isNaN(h)) return null;

		if (isPM && h !== 12) h += 12;
		if (isAM && h === 12) h = 0;
		return { h, m };
	}

	// Group bookings by hour for the list view
	let bookingsBySlot = $derived.by(() => {
		const slots: Record<number, any[]> = {};
		// Initialize slots 8-22
		for (let h = 8; h <= 22; h++) slots[h] = [];

		const unscheduled: any[] = [];

		dailyBookings.forEach((b) => {
			const parsed = parseTimeStr(b.time);
			if (!parsed) {
				unscheduled.push(b);
				return;
			}
			const { h } = parsed;
			if (slots[h]) {
				slots[h].push(b);
			} else {
				// If outside 8-22 range, put in nearest or separate?
				// For now, put in unscheduled or extended slots could be added.
				unscheduled.push(b);
			}
		});

		return { slots, unscheduled };
	});

	function getTimePosition(time: string) {
		const parsed = parseTimeStr(time);
		if (!parsed) return null;
		const { h, m } = parsed;
		// Business hours 8:00 - 22:00 (14h)
		const startHour = 8;
		const totalMinutes = 14 * 60;
		const minutesFromStart = (h - startHour) * 60 + m;
		return Math.max(0, Math.min(100, (minutesFromStart / totalMinutes) * 100));
	}

	let scheduledBookings = $derived(dailyBookings.filter((b) => getTimePosition(b.time) !== null));

	let unscheduledBookings = $derived(dailyBookings.filter((b) => getTimePosition(b.time) === null));

	// Calculate layout columns to prevent overlap
	let layoutBookings = $derived.by(() => {
		const bookings = [...scheduledBookings].map((b) => ({ ...b }));
		if (bookings.length === 0) return [];

		// 1. Calculate start/end minutes for collision detection
		const events = bookings.map((b) => {
			const { h, m } = parseTimeStr(b.time)!;
			const start = (h - 8) * 60 + m; // minutes from 8AM
			const duration =
				b.servicesList?.reduce((acc: number, s: any) => acc + (s.duration || 30), 0) || 30;
			return {
				...b,
				_start: start,
				_end: start + duration,
				_col: 0,
				_totalCols: 1
			};
		});

		// 2. Simple column assignment greedy algorithm
		// Group colliding events
		// Note: This is a simplified algo; for perfect packing we'd use a graph coloring approach
		// But for a daily schedule, checking overlaps is usually sufficient.

		for (let i = 0; i < events.length; i++) {
			const current = events[i];
			const overlapping = events.filter(
				(other, idx) => idx !== i && CurrentOverlaps(current, other)
			);

			if (overlapping.length > 0) {
				// Find first available column
				const usedCols = new Set(overlapping.map((e) => e._col));
				let col = 0;
				while (usedCols.has(col)) col++;
				current._col = col;
			}
		}

		// 3. Calculate max columns for each group to determine width
		for (let i = 0; i < events.length; i++) {
			const current = events[i];
			const overlapping = events.filter(
				(other, idx) => idx !== i && CurrentOverlaps(current, other)
			);
			// The group is current + overlapping
			// Max col index in this group + 1 = total columns needed
			const maxCol = Math.max(current._col, ...overlapping.map((e) => e._col));
			current._totalCols = maxCol + 1;

			// Share width with neighbors
			overlapping.forEach((other) => {
				other._totalCols = Math.max(other._totalCols, current._totalCols);
			});
		}

		return events;
	});

	function CurrentOverlaps(a: any, b: any) {
		return a._start < b._end && a._end > b._start;
	}

	function getBookingHeight(booking: any) {
		const durationMins =
			booking.servicesList?.reduce((acc: number, s: any) => acc + (s.duration || 30), 0) || 30;
		// 14 hours * 60 minutes
		const totalMinutes = 14 * 60;
		// Min height 30px (approx 3.5% of 800px) or proportional
		const pct = (durationMins / totalMinutes) * 100;
		return Math.max(pct, 2.5); // ensure at least ~20px height
	}

	async function quickAction(id: string, status: string) {
		try {
			await updateBookingStatus(id, status);
			showToast(`Updated to ${status}`, 'success');
		} catch {
			showToast('Update failed', 'error');
		}
	}

	let isBackToToday = $derived(formatDateKey(selectedDate) !== formatDateKey(new Date()));
</script>

<div class="schedule-page s-stagger">
	<!-- Control Bar -->
	<header class="schedule-controls">
		<div class="controls-top">
			<div class="view-toggle">
				<button class:active={viewMode === 'day'} onclick={() => (viewMode = 'day')}>Day</button>
				<button class:active={viewMode === 'week'} onclick={() => (viewMode = 'week')}>Week</button>
				<button class:active={viewMode === 'month'} onclick={() => (viewMode = 'month')}
					>Month</button
				>
			</div>
			{#if isBackToToday}
				<button class="today-btn" onclick={setToday}>Today</button>
			{/if}
		</div>

		<div class="date-nav">
			<button class="nav-arrow" onclick={() => changeDate(-1)}>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg
				>
			</button>
			<div class="date-display" onclick={setToday}>
				{#if viewMode === 'day'}
					<span class="date-main">
						{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
					</span>
					<span class="date-sub">
						{selectedDate.toLocaleDateString('en-US', {
							month: 'long',
							day: 'numeric',
							year: 'numeric'
						})}
					</span>
				{:else if viewMode === 'week'}
					<span class="date-main">
						{weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString(
							'en-US',
							{ month: 'short', day: 'numeric' }
						)}
					</span>
				{:else}
					<span class="date-main">
						{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
					</span>
				{/if}
			</div>
			<button class="nav-arrow" onclick={() => changeDate(1)}>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg
				>
			</button>
		</div>
	</header>

	<!-- DAY VIEW -->
	{#if viewMode === 'day'}
		<div class="day-view">
			{#if dailyBookings.length > 0}
				<!-- Summary Bar -->
				<div class="day-summary">
					<span class="ds-count">{dailyBookings.length} appointments</span>
					<span class="ds-divider">•</span>
					<span class="ds-pending"
						>{dailyBookings.filter((b) => b.status === 'pending').length} pending</span
					>
				</div>

				<!-- Unscheduled / Missing Time -->
				{#if unscheduledBookings.length > 0}
					<div class="unscheduled-section">
						<h5>Unscheduled / Pending Time</h5>
						<div class="unscheduled-list">
							{#each unscheduledBookings as booking}
								<div
									class="unscheduled-card {booking.status}"
									onclick={() => openBooking(booking)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
								>
									<StatusBadge status={booking.status} dot />
									<div class="uc-info">
										<span class="uc-name">{booking.userName || 'Guest'}</span>
										<span class="uc-service">
											{booking.servicesList?.map((s: any) => s.name).join(', ') ||
												booking.serviceName ||
												'Service'}
										</span>
									</div>
									<div class="uc-meta">
										{#if booking.time}
											<span class="uc-time-badge error">{booking.time}</span>
										{:else}
											<span class="uc-time-badge">No time</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Unscheduled / Missing Time -->
				{#if bookingsBySlot.unscheduled.length > 0}
					<div class="unscheduled-section">
						<h5>Unscheduled / Pending Time</h5>
						<div class="unscheduled-list">
							{#each bookingsBySlot.unscheduled as booking}
								<div
									class="unscheduled-card {booking.status}"
									onclick={() => openBooking(booking)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
								>
									<StatusBadge status={booking.status} dot />
									<div class="uc-info">
										<span class="uc-name">{booking.userName || 'Guest'}</span>
										<span class="uc-service">
											{booking.servicesList?.map((s: any) => s.name).join(', ') ||
												booking.serviceName ||
												'Service'}
										</span>
									</div>
									<div class="uc-meta">
										{#if booking.time}
											<span class="uc-time-badge error">{booking.time}</span>
										{:else}
											<span class="uc-time-badge">No time</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Flexible Time List -->
				<div class="time-list-view">
					{#each timeSlots as slot}
						{@const slotBookings = bookingsBySlot.slots[slot.hour] || []}

						<div class="time-slot-row">
							<!-- Time Label -->
							<div class="ts-time">
								<span class="ts-label">{slot.label}</span>
							</div>

							<!-- Content Area -->
							<div class="ts-content">
								<!-- Timeline line -->
								<div class="ts-line"></div>

								{#if slotBookings.length > 0}
									<div class="ts-bookings">
										{#each slotBookings as booking}
											<div
												class="list-card {booking.status}"
												onclick={() => openBooking(booking)}
												role="button"
												tabindex="0"
												onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
											>
												<div class="lc-time">
													{formatTime12h(booking.time)}
												</div>
												<div class="lc-details">
													<div class="lc-row">
														<span class="lc-name">{booking.userName || 'Guest'}</span>
														<StatusBadge status={booking.status} size="sm" dot />
													</div>
													<div class="lc-service">
														{booking.servicesList?.map((s: any) => s.name).join(', ') ||
															booking.serviceName ||
															'Service'}
													</div>
													<div class="lc-meta">
														<span class="lc-price"
															>₹{booking.totalAmount || booking.price || '-'}</span
														>
														{#if booking.servicesList?.some((s: any) => s.duration)}
															<span class="lc-dur">
																{formatDuration(
																	booking.servicesList.reduce(
																		(a: number, s: any) => a + (s.duration || 0),
																		0
																	)
																)}
															</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="ts-empty"></div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState
					icon="✨"
					title="Free Day!"
					description="No appointments for {selectedDate.toLocaleDateString('en-US', {
						weekday: 'long'
					})}"
				/>
			{/if}
		</div>

		<!-- WEEK VIEW -->
	{:else if viewMode === 'week'}
		<div class="week-view">
			<div class="week-grid">
				{#each weekDays as day}
					{@const stats = getDayStats(day)}
					<button
						class="week-day-card"
						class:today={stats.isToday}
						class:selected={selectedDate.toDateString() === day.toDateString()}
						class:has-bookings={stats.count > 0}
						onclick={() => {
							selectedDate = day;
							viewMode = 'day';
						}}
					>
						<div class="wd-header">
							<span class="wd-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
							<span class="wd-num" class:today-num={stats.isToday}>{day.getDate()}</span>
						</div>

						{#if stats.count > 0}
							<div class="wd-density">
								<div
									class="density-bar"
									style="height: {Math.min(100, stats.count * 15)}%"
									class:has-pending={stats.hasPending}
									class:has-progress={stats.hasInProgress}
								></div>
							</div>
							<span class="wd-count">{stats.count}</span>
							{#if stats.completed > 0}
								<span class="wd-completed">✓{stats.completed}</span>
							{/if}
						{:else}
							<div class="wd-empty-marker">—</div>
						{/if}

						{#if stats.hasPending}
							<div class="wd-alert">!</div>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<!-- MONTH VIEW -->
	{:else}
		<div class="month-view">
			<div class="month-header">
				{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
					<span class="mh-day">{day}</span>
				{/each}
			</div>
			<div class="month-grid">
				{#each monthDays as day}
					{#if day}
						{@const stats = getDayStats(day)}
						<button
							class="month-day"
							class:today={stats.isToday}
							class:selected={selectedDate.toDateString() === day.toDateString()}
							class:has-bookings={stats.count > 0}
							onclick={() => {
								selectedDate = day;
								viewMode = 'day';
							}}
						>
							<span class="md-num">{day.getDate()}</span>
							{#if stats.count > 0}
								<div class="md-dots">
									{#each Array(Math.min(stats.count, 3)) as _}
										<div class="md-dot" class:pending={stats.hasPending}></div>
									{/each}
								</div>
							{/if}
						</button>
					{:else}
						<div class="month-day empty"></div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<BookingModal
	bind:isOpen={isModalOpen}
	mode={modalMode}
	existingBooking={selectedBooking}
	onClose={() => (isModalOpen = false)}
/>

<style>
	.schedule-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-lg);
	}

	/* ━━━ CONTROLS ━━━ */
	.schedule-controls {
		background: var(--s-surface);
		border-radius: var(--s-radius-lg);
		padding: var(--s-space-lg);
		border: 1px solid var(--s-border);
		box-shadow: var(--s-shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	.controls-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.view-toggle {
		display: flex;
		background: var(--s-bg-tertiary);
		padding: 3px;
		border-radius: var(--s-radius-md);
	}

	.view-toggle button {
		padding: 6px 18px;
		border: none;
		background: transparent;
		font-weight: 500;
		font-size: var(--s-text-sm);
		border-radius: var(--s-radius-sm);
		color: var(--s-text-secondary);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.view-toggle button.active {
		background: var(--s-surface);
		color: var(--s-text-primary);
		box-shadow: var(--s-shadow-xs);
		font-weight: 700;
	}

	.today-btn {
		padding: 5px 12px;
		background: var(--s-accent-bg);
		color: var(--s-accent);
		border: 1px solid var(--s-border-accent);
		border-radius: var(--s-radius-full);
		font-size: var(--s-text-xs);
		font-weight: 700;
		cursor: pointer;
	}

	.date-nav {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-arrow {
		background: none;
		border: none;
		padding: 8px;
		color: var(--s-text-secondary);
		cursor: pointer;
		border-radius: var(--s-radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.nav-arrow:active {
		background: var(--s-surface-active);
		transform: scale(0.9);
	}

	.date-display {
		text-align: center;
		cursor: pointer;
	}

	.date-main {
		display: block;
		font-family: var(--s-font-display);
		font-size: var(--s-text-md);
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.date-sub {
		display: block;
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		margin-top: 2px;
	}

	/* ━━━ DAY VIEW ━━━ */
	.day-summary {
		display: flex;
		align-items: center;
		gap: var(--s-space-sm);
		padding: var(--s-space-sm) 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		font-weight: 500;
	}

	.ds-divider {
		opacity: 0.4;
	}
	.ds-pending {
		color: var(--s-pending-text);
		font-weight: 600;
	}

	/* ━━━ FLEXIBLE LIST VIEW ━━━ */
	.time-list-view {
		display: flex;
		flex-direction: column;
		/* gap: var(--s-space-md); -> removing gap to keep time flow continuous */
	}

	.time-slot-row {
		display: flex;
		/* Min height to give breathing room for empty slots */
		min-height: 60px;
	}

	.ts-time {
		width: 60px;
		flex-shrink: 0;
		padding-top: var(--s-space-sm);
		text-align: right;
		padding-right: var(--s-space-md);
	}

	.ts-label {
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		font-weight: 600;
		position: sticky;
		top: 10px;
	}

	.ts-content {
		flex: 1;
		position: relative;
		border-left: 1px solid var(--s-border);
		padding-left: var(--s-space-md);
		padding-bottom: var(--s-space-md);
	}

	.ts-content::before {
		/* Horizontal line at the hour mark */
		content: '';
		position: absolute;
		left: 0;
		top: var(--s-space-sm); /* Align with text roughly */
		width: 10px;
		height: 1px;
		background: var(--s-border);
	}

	.ts-bookings {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
		padding-top: 4px;
	}

	/* List Card Style */
	.list-card {
		background: var(--s-surface);
		border-radius: var(--s-radius-md);
		border: 1px solid var(--s-border);
		padding: var(--s-space-md);
		display: flex;
		gap: var(--s-space-md);
		box-shadow: var(--s-shadow-sm);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.list-card:active {
		transform: scale(0.98);
	}

	.list-card.pending {
		border-left: 4px solid var(--s-pending);
	}
	.list-card.confirmed {
		border-left: 4px solid var(--s-confirmed);
	}
	.list-card.in-progress {
		border-left: 4px solid var(--s-in-progress);
	}
	.list-card.completed {
		border-left: 4px solid var(--s-completed);
		opacity: 0.8;
	}
	.list-card.cancelled {
		border-left: 4px solid var(--s-cancelled);
		opacity: 0.6;
	}

	.lc-time {
		font-size: var(--s-text-sm);
		font-weight: 700;
		color: var(--s-text-primary);
		min-width: 60px;
	}

	.lc-details {
		flex: 1;
		min-width: 0;
	}

	.lc-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.lc-name {
		font-weight: 600;
		font-size: var(--s-text-base);
	}

	.lc-service {
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		margin-top: 2px;
	}

	.lc-meta {
		display: flex;
		gap: var(--s-space-md);
		margin-top: 4px;
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		font-weight: 600;
	}

	.lc-price {
		color: var(--s-text-primary);
	}

	/* Booking cards on ruler - REMOVED */

	/* Unscheduled Section */
	.unscheduled-section {
		background: var(--s-bg-secondary);
		border-radius: var(--s-radius-lg);
		padding: var(--s-space-md);
		border: 1px dashed var(--s-border);
		margin-bottom: var(--s-space-lg);
	}

	.unscheduled-section h5 {
		margin: 0 0 var(--s-space-sm);
		font-size: var(--s-text-xs);
		text-transform: uppercase;
		color: var(--s-text-tertiary);
		font-weight: 700;
	}

	.unscheduled-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.unscheduled-card {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-md);
		background: var(--s-surface);
		border-radius: var(--s-radius-md);
		border: 1px solid var(--s-border);
		cursor: pointer;
	}

	.unscheduled-card .uc-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.uc-name {
		font-weight: 600;
		font-size: var(--s-text-sm);
	}

	.uc-service {
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
	}

	.uc-time-badge {
		font-size: var(--s-text-xs);
		background: var(--s-bg-tertiary);
		padding: 2px 6px;
		border-radius: var(--s-radius-sm);
		color: var(--s-text-secondary);
	}

	.uc-time-badge.error {
		background: var(--s-error-bg);
		color: var(--s-error);
	}

	/* ━━━ WEEK VIEW ━━━ */
	.week-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-space-sm);
	}

	.week-day-card {
		position: relative;
		background: var(--s-surface);
		padding: var(--s-space-lg);
		border-radius: var(--s-radius-lg);
		border: 1px solid var(--s-border);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		text-align: left;
		overflow: hidden;
	}

	.week-day-card:active {
		transform: scale(0.97);
	}

	.week-day-card.today {
		border-color: var(--s-accent);
		border-width: 2px;
	}

	.week-day-card.has-bookings {
		box-shadow: var(--s-shadow-sm);
	}

	.wd-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--s-space-md);
	}

	.wd-name {
		font-weight: 600;
		color: var(--s-text-secondary);
		font-size: var(--s-text-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.wd-num {
		font-weight: 800;
		font-size: var(--s-text-xl);
		color: var(--s-text-primary);
	}

	.wd-num.today-num {
		color: var(--s-accent);
	}

	.wd-density {
		height: 32px;
		width: 100%;
		background: var(--s-bg-tertiary);
		border-radius: var(--s-radius-sm);
		overflow: hidden;
		display: flex;
		align-items: flex-end;
		margin-bottom: var(--s-space-sm);
	}

	.density-bar {
		width: 100%;
		background: var(--s-confirmed);
		border-radius: var(--s-radius-sm);
		transition: height 0.5s var(--s-ease-spring);
		min-height: 4px;
	}

	.density-bar.has-pending {
		background: var(--s-pending);
	}
	.density-bar.has-progress {
		background: var(--s-in-progress);
	}

	.wd-count {
		font-size: var(--s-text-sm);
		font-weight: 700;
		color: var(--s-text-primary);
	}

	.wd-completed {
		font-size: var(--s-text-xs);
		color: var(--s-completed-text);
		font-weight: 600;
		margin-left: 4px;
	}

	.wd-empty-marker {
		color: var(--s-text-tertiary);
		font-size: var(--s-text-xl);
		text-align: center;
		padding: var(--s-space-md) 0;
	}

	.wd-alert {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 20px;
		height: 20px;
		background: var(--s-pending);
		color: white;
		border-radius: 50%;
		font-size: 0.7rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		border: 2px solid var(--s-surface);
		box-shadow: var(--s-shadow-sm);
	}

	/* ━━━ MONTH VIEW ━━━ */
	.month-header {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
		margin-bottom: var(--s-space-sm);
	}

	.mh-day {
		text-align: center;
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-tertiary);
		text-transform: uppercase;
		padding: var(--s-space-sm);
	}

	.month-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}

	.month-day {
		aspect-ratio: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		background: var(--s-surface);
		border: 1px solid transparent;
		border-radius: var(--s-radius-sm);
		cursor: pointer;
		padding: 4px;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.month-day.empty {
		background: transparent;
		cursor: default;
	}

	.month-day:not(.empty):active {
		transform: scale(0.92);
	}

	.month-day.today {
		border-color: var(--s-accent);
		background: var(--s-accent-bg);
	}

	.month-day.selected {
		background: var(--s-accent);
	}

	.month-day.selected .md-num {
		color: white;
	}

	.md-num {
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-primary);
	}

	.month-day.has-bookings .md-num {
		font-weight: 800;
	}

	.md-dots {
		display: flex;
		gap: 2px;
	}

	.md-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: var(--s-confirmed);
	}

	.md-dot.pending {
		background: var(--s-pending);
	}
</style>

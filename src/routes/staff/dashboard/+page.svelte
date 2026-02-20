<script lang="ts">
	import { staffUser } from '$lib/stores/staffAuth';
	import { upcomingBookings, todayBookings, staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import {
		now,
		getElapsedSeconds,
		startServiceTimer,
		pauseTimer,
		resumeTimer,
		completeTimer
	} from '$lib/stores/serviceTimer';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import CircularProgress from '$lib/components/staff/CircularProgress.svelte';
	import StatusBadge from '$lib/components/staff/StatusBadge.svelte';
	import EmptyState from '$lib/components/staff/EmptyState.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Data
	let nextAppointment = $derived($upcomingBookings[0]);
	let todayCount = $derived($todayBookings.length);
	let pendingCount = $derived($upcomingBookings.filter((b) => b.status === 'pending').length);
	let inProgressCount = $derived($todayBookings.filter((b) => b.status === 'in-progress').length);

	// Performance stats (calculated from real data)
	let completedToday = $derived($todayBookings.filter((b) => b.status === 'completed').length);
	let todayRevenue = $derived(
		$todayBookings
			.filter((b) => b.status === 'completed')
			.reduce((sum, b) => sum + (b.totalAmount || b.price || 0), 0)
	);

	// Modal state
	let isModalOpen = $state(false);
	let modalMode = $state('create');
	let selectedBooking = $state<any>(null);

	// Queue (walk-ins)
	let showWalkinForm = $state(false);
	let walkinName = $state('');
	let walkinService = $state('');

	function openBooking(booking: any) {
		selectedBooking = booking;
		modalMode = 'edit';
		isModalOpen = true;
	}

	async function handleStatusChange(id: string, newStatus: string, e?: Event) {
		e?.stopPropagation();
		if (newStatus === 'cancelled' || newStatus === 'completed') {
			if (!confirm(`Mark this booking as ${newStatus}?`)) return;
		}
		try {
			await updateBookingStatus(id, newStatus);
			showToast(`Booking marked as ${newStatus}`, 'success');
			if ('vibrate' in navigator) navigator.vibrate(15);
		} catch (error) {
			console.error(error);
			showToast('Failed to update status', 'error');
		}
	}

	function getFirstName(name: string | null) {
		return name?.split(' ')[0] || 'Member';
	}

	function getGreeting() {
		const h = new Date().getHours();
		if (h < 12) return 'Good Morning';
		if (h < 17) return 'Good Afternoon';
		return 'Good Evening';
	}

	function getTimeRemaining(dateStr: string, timeStr: string) {
		if (!dateStr || !timeStr) return '';
		const now = new Date();
		const bookingDateTime = new Date(dateStr);

		// Parse time (handle both "HH:MM" and "HH:MM AM/PM")
		const cleaned = timeStr.replace(/\s*(AM|PM)\s*/i, '').trim();
		const parts = cleaned.split(':');
		let hours = parseInt(parts[0], 10);
		const minutes = parseInt(parts[1] || '0', 10);
		if (isNaN(hours)) return '';

		// Handle AM/PM conversion
		if (/PM/i.test(timeStr) && hours !== 12) hours += 12;
		if (/AM/i.test(timeStr) && hours === 12) hours = 0;

		bookingDateTime.setHours(hours, minutes, 0, 0);
		const diffMs = bookingDateTime.getTime() - now.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins <= 0) return 'Now';
		if (diffMins < 60) return `${diffMins}m`;
		const diffHrs = Math.floor(diffMins / 60);
		const remMins = diffMins % 60;
		return remMins > 0 ? `${diffHrs}h ${remMins}m` : `${diffHrs}h`;
	}

	async function handleStartService(booking: any) {
		// Just call the timer action - it handles status update and auto-pause
		startServiceTimer(booking);
		showToast('Service timer started', 'success');
		if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
	}

	async function handleCompleteService(booking: any) {
		goto(`/staff/bookings/${booking.id}`);
	}

	function formatTime12h(time: string) {
		if (!time) return '';
		// Strip AM/PM if present and parse
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

	// Only show remaining schedule (not completed/cancelled)
	let remainingSchedule = $derived(
		$todayBookings
			.filter((b) => b.status !== 'completed' && b.status !== 'cancelled')
			.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
			.slice(0, 5)
	);
</script>

<div class="dashboard s-stagger">
	<!-- ━━━ HERO WELCOME ━━━ -->
	<section class="hero-card">
		<div class="hero-gradient"></div>
		<div class="hero-content">
			<div class="hero-text">
				<p class="hero-greeting">{getGreeting()}</p>
				<h2 class="hero-name">{getFirstName($staffUser?.displayName)} ✨</h2>
				<p class="hero-date">
					{new Date().toLocaleDateString('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					})}
				</p>
			</div>
			<div class="hero-avatar">
				{#if $staffUser?.photoURL}
					<img src={$staffUser.photoURL} alt="Profile" />
				{:else}
					<div class="avatar-placeholder">{getFirstName($staffUser?.displayName)?.[0] || 'S'}</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- ━━━ QUICK ACTIONS ━━━ -->
	<section class="quick-actions">
		<button
			class="qa-btn qa-walkin"
			onclick={() => {
				modalMode = 'create';
				isModalOpen = true;
			}}
		>
			<span class="qa-icon">🚶</span>
			<span class="qa-label">Walk-in</span>
		</button>
		<button
			class="qa-btn qa-booking"
			onclick={() => {
				modalMode = 'create';
				isModalOpen = true;
			}}
		>
			<span class="qa-icon">➕</span>
			<span class="qa-label">Booking</span>
		</button>
		<button class="qa-btn qa-schedule" onclick={() => goto('/staff/schedule')}>
			<span class="qa-icon">📅</span>
			<span class="qa-label">Schedule</span>
		</button>
		<button class="qa-btn qa-history" onclick={() => goto('/staff/bookings')}>
			<span class="qa-icon">📋</span>
			<span class="qa-label">All</span>
		</button>
	</section>

	<!-- ━━━ STATS ROW ━━━ -->
	<section class="stats-row">
		<button class="stat-card" onclick={() => goto('/staff/bookings?filter=today')}>
			<span class="stat-value">{todayCount}</span>
			<span class="stat-label">Today</span>
			<span class="stat-icon">📅</span>
		</button>
		<button class="stat-card" onclick={() => goto('/staff/bookings?filter=pending')}>
			<span class="stat-value">{pendingCount}</span>
			<span class="stat-label">Pending</span>
			<span class="stat-icon">⏳</span>
		</button>
		<button class="stat-card highlight">
			<span class="stat-value">{completedToday}</span>
			<span class="stat-label">Done</span>
			<span class="stat-icon">✅</span>
		</button>
		<button class="stat-card accent">
			<span class="stat-value">₹{todayRevenue.toLocaleString()}</span>
			<span class="stat-label">Revenue</span>
			<span class="stat-icon">💰</span>
		</button>
	</section>

	<!-- ━━━ UP NEXT ━━━ -->
	{#if $upcomingBookings.length > 0}
		<section class="upnext-section">
			<div class="s-section-header">
				<h3 class="s-section-title">Up Next</h3>
				{#if $upcomingBookings[0]}
					<span class="upnext-countdown">
						{getTimeRemaining($upcomingBookings[0].date, $upcomingBookings[0].time)}
					</span>
				{/if}
			</div>

			<div class="upnext-list">
				{#each $upcomingBookings as booking}
					<div
						class="upnext-card s-card s-card-interactive {booking.status === 'in-progress'
							? 'active-service-mode'
							: ''}"
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
								<div class="timer-actions">
									{#if !booking.isTimerRunning}
										<button
											class="s-btn s-btn-outline s-btn-sm"
											onclick={(e) => {
												e.stopPropagation();
												console.log('[Dashboard] Resume clicked for:', booking.id);
												resumeTimer(booking);
											}}
										>
											▶ Resume
										</button>
									{:else}
										<button
											class="s-btn s-btn-outline s-btn-sm"
											onclick={(e) => {
												e.stopPropagation();
												console.log('[Dashboard] Pause clicked for:', booking.id);
												pauseTimer(booking);
											}}
										>
											⏸ Pause
										</button>
									{/if}
									<button
										class="s-btn s-btn-success s-btn-sm"
										style="flex:1"
										onclick={(e) => {
											e.stopPropagation();
											handleCompleteService(booking);
										}}
									>
										✓ Complete Service
									</button>
								</div>
							</div>
						{:else}
							<div class="upnext-top">
								<div class="upnext-client">
									<div class="client-avatar-sm">
										{booking.userName?.[0] || 'G'}
									</div>
									<div class="upnext-details">
										<h4>{booking.userName || 'Guest'}</h4>
										<p class="upnext-service">
											{#if booking.servicesList?.length}
												{booking.servicesList.map((s: any) => s.name).join(', ')}
											{:else}
												{booking.serviceName || 'Service'}
											{/if}
										</p>
									</div>
								</div>
								<StatusBadge
									status={booking.status}
									size="sm"
									animated={booking.status === 'in-progress'}
								/>
							</div>

							<div class="upnext-meta">
								<div class="meta-item">
									<span class="meta-icon">🕐</span>
									<span>{formatTime12h(booking.time)}</span>
								</div>
								{#if booking.servicesList?.some((s: any) => s.duration)}
									<div class="meta-item">
										<span class="meta-icon">⏱</span>
										<span
											>{formatDuration(
												booking.servicesList.reduce((a: number, s: any) => a + (s.duration || 0), 0)
											)}</span
										>
									</div>
								{/if}
								<div class="meta-item">
									<span class="meta-icon">💰</span>
									<span>₹{booking.totalAmount || booking.price || '-'}</span>
								</div>
							</div>

							<div class="upnext-actions">
								{#if booking.status === 'pending'}
									<button
										class="s-btn s-btn-sm"
										style="background: var(--s-confirmed); color: white; flex: 1"
										onclick={(e) => handleStatusChange(booking.id, 'confirmed', e)}
									>
										✓ Confirm
									</button>
									<button
										class="s-btn s-btn-sm s-btn-danger"
										onclick={(e) => handleStatusChange(booking.id, 'cancelled', e)}
									>
										✕
									</button>
								{:else if booking.status === 'confirmed'}
									<button
										class="s-btn s-btn-sm s-btn-accent"
										style="flex: 1"
										onclick={(e) => {
											e.stopPropagation();
											handleStartService(booking);
										}}
									>
										▶ Start Service
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<section class="upnext-section">
			<EmptyState
				icon="☕"
				title="All Caught Up!"
				description="No upcoming appointments. Time for a break?"
			/>
		</section>
	{/if}

	<!-- ━━━ TODAY'S REMAINING SCHEDULE ━━━ -->
	{#if remainingSchedule.length > 0}
		<section class="schedule-preview">
			<div class="s-section-header">
				<h3 class="s-section-title">Today's Queue</h3>
				<button class="s-section-action" onclick={() => goto('/staff/schedule')}>View All →</button>
			</div>

			<div class="schedule-list">
				{#each remainingSchedule as booking, i}
					<div
						class="schedule-item s-card-interactive"
						onclick={() => openBooking(booking)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && openBooking(booking)}
					>
						<div class="si-time">
							<span class="si-time-text">{formatTime12h(booking.time)}</span>
						</div>
						<div class="si-connector">
							<div class="si-dot {booking.status}"></div>
							{#if i < remainingSchedule.length - 1}
								<div class="si-line"></div>
							{/if}
						</div>
						<div class="si-content">
							<div class="si-top">
								<h4 class="si-name">{booking.userName || 'Guest'}</h4>
								<StatusBadge status={booking.status} size="sm" />
							</div>
							<p class="si-service">
								{#if booking.servicesList?.length}
									{booking.servicesList[0].name}
									{#if booking.servicesList.length > 1}
										<span class="si-more">+{booking.servicesList.length - 1}</span>
									{/if}
								{:else}
									{booking.serviceName || 'Service'}
								{/if}
							</p>
							<div class="si-meta">
								{#if booking.servicesList?.some((s: any) => s.duration)}
									<span
										>⏱ {formatDuration(
											booking.servicesList.reduce((a: number, s: any) => a + (s.duration || 0), 0)
										)}</span
									>
								{/if}
								<span>₹{booking.totalAmount || booking.price || '-'}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<BookingModal
	bind:isOpen={isModalOpen}
	mode={modalMode}
	existingBooking={selectedBooking}
	onClose={() => (isModalOpen = false)}
/>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-xl);
	}

	/* ━━━ HERO ━━━ */
	.hero-card {
		position: relative;
		border-radius: var(--s-radius-xl);
		padding: var(--s-space-xl) var(--s-space-xl);
		overflow: hidden;
		color: white;
	}

	.hero-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 50%, #c9a96e 150%);
		z-index: 0;
	}

	:global(.staff-app.dark) .hero-gradient {
		background: linear-gradient(135deg, #1a1a24 0%, #2a2a3a 50%, #c9a96e 180%);
	}

	.hero-content {
		position: relative;
		z-index: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.hero-greeting {
		margin: 0;
		font-size: var(--s-text-sm);
		opacity: 0.75;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.hero-name {
		margin: 4px 0 4px;
		font-family: var(--s-font-display);
		font-size: var(--s-text-2xl);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.hero-date {
		margin: 0;
		font-size: var(--s-text-sm);
		opacity: 0.7;
		font-weight: 400;
	}

	.hero-avatar img {
		width: 56px;
		height: 56px;
		border-radius: var(--s-radius-lg);
		object-fit: cover;
		border: 3px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.hero-avatar .avatar-placeholder {
		width: 56px;
		height: 56px;
		border-radius: var(--s-radius-lg);
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(8px);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.5rem;
		border: 3px solid rgba(255, 255, 255, 0.2);
	}

	/* ━━━ QUICK ACTIONS ━━━ */
	.quick-actions {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--s-space-sm);
	}

	.qa-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: var(--s-space-md) var(--s-space-sm);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		box-shadow: var(--s-shadow-xs);
	}

	.qa-btn:active {
		transform: scale(0.95);
		box-shadow: var(--s-shadow-sm);
	}

	.qa-icon {
		font-size: 1.3rem;
	}

	.qa-label {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	/* ━━━ ACTIVE SERVICE TIMER ━━━ */
	.active-service-card {
		background: var(--s-surface);
		border: 2px solid var(--s-accent);
		border-radius: var(--s-radius-xl);
		padding: var(--s-space-xl);
		box-shadow: var(--s-shadow-glow);
		animation: s-scaleIn 0.4s var(--s-ease-spring);
	}

	.service-timer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--s-space-md);
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
		gap: var(--s-space-sm);
	}

	/* ━━━ STATS ROW ━━━ */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--s-space-sm);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--s-space-md) var(--s-space-sm);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-md);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		box-shadow: var(--s-shadow-xs);
		position: relative;
		overflow: hidden;
	}

	.stat-card:active {
		transform: scale(0.97);
	}

	.stat-card.accent {
		border-color: var(--s-border-accent);
		background: var(--s-accent-bg);
	}

	.stat-icon {
		position: absolute;
		top: 4px;
		right: 4px;
		font-size: 0.65rem;
		opacity: 0.6;
	}

	.stat-value {
		font-family: var(--s-font-display);
		font-size: var(--s-text-lg);
		font-weight: 800;
		color: var(--s-text-primary);
		line-height: 1.2;
		animation: s-countUp 0.5s var(--s-ease) backwards;
	}

	.stat-label {
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--s-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 2px;
	}

	/* ━━━ UP NEXT ━━━ */

	.upnext-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
	}

	.upnext-countdown {
		font-size: var(--s-text-sm);
		font-weight: 700;
		color: var(--s-accent);
		background: var(--s-accent-bg);
		padding: 3px 10px;
		border-radius: var(--s-radius-full);
	}

	.upnext-card {
		padding: var(--s-space-lg);
	}

	.upnext-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--s-space-md);
	}

	.upnext-client {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
	}

	.client-avatar-sm {
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
	}

	.upnext-details h4 {
		margin: 0;
		font-size: var(--s-text-md);
		font-weight: 700;
	}

	.upnext-service {
		margin: 2px 0 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
	}

	.upnext-meta {
		display: flex;
		gap: var(--s-space-lg);
		padding: var(--s-space-md) 0;
		border-top: 1px solid var(--s-border);
		border-bottom: 1px solid var(--s-border);
		margin-bottom: var(--s-space-md);
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.meta-icon {
		font-size: 0.85rem;
	}

	.upnext-actions {
		display: flex;
		gap: var(--s-space-sm);
	}

	/* Active Service Mode Modifier */
	.upnext-card.active-service-mode {
		background: var(--s-surface);
		border: 2px solid var(--s-accent);
		box-shadow: var(--s-shadow-glow);
		animation: s-scaleIn 0.4s var(--s-ease-spring);
	}

	/* ━━━ SCHEDULE PREVIEW ━━━ */
	.schedule-list {
		display: flex;
		flex-direction: column;
	}

	.schedule-item {
		display: flex;
		gap: var(--s-space-md);
		padding: var(--s-space-md) 0;
	}

	.si-time {
		width: 60px;
		flex-shrink: 0;
		padding-top: 2px;
	}

	.si-time-text {
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.si-connector {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 16px;
		flex-shrink: 0;
	}

	.si-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--s-border-strong);
		flex-shrink: 0;
		margin-top: 5px;
	}

	.si-dot.pending {
		background: var(--s-pending);
	}
	.si-dot.confirmed {
		background: var(--s-confirmed);
	}
	.si-dot.in-progress {
		background: var(--s-in-progress);
	}
	.si-dot.completed {
		background: var(--s-completed);
	}

	.si-line {
		flex: 1;
		width: 1.5px;
		background: var(--s-border);
		margin: 4px 0;
	}

	.si-content {
		flex: 1;
		min-width: 0;
		padding-bottom: var(--s-space-md);
		border-bottom: 1px solid var(--s-border);
	}

	.schedule-item:last-child .si-content {
		border-bottom: none;
	}

	.si-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.si-name {
		margin: 0;
		font-size: var(--s-text-base);
		font-weight: 600;
	}

	.si-service {
		margin: 2px 0 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
	}

	.si-more {
		background: var(--s-bg-tertiary);
		padding: 1px 6px;
		border-radius: var(--s-radius-sm);
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		margin-left: 4px;
	}

	.si-meta {
		display: flex;
		gap: var(--s-space-md);
		margin-top: 4px;
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		font-weight: 600;
	}
</style>

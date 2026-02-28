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
				<div style="display: flex; align-items: center; gap: 8px;">
					<h3 class="s-section-title">Today's Queue</h3>
					{#if $upcomingBookings[0]}
						<span class="upnext-countdown">
							{getTimeRemaining($upcomingBookings[0].date, $upcomingBookings[0].time)}
						</span>
					{/if}
				</div>
				<button
					class="s-section-action"
					onclick={() => goto('/staff/schedule')}
					style="background: none; border: none; font-size: 0.85rem; color: var(--s-text-secondary); cursor: pointer; padding: 0;"
					>View All →</button
				>
			</div>

			<div class="upnext-list">
				{#each $upcomingBookings as booking}
					<div
						class="upnext-card s-card s-card-interactive {booking.status === 'in-progress'
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
									<div class="db-payment timer-payment">
										<span class="payment-badge {getPaymentBadgeClass(booking)}">
											{getPaymentMethodIcon(booking)}
											{getPaymentLabel(booking)}
										</span>
										<span class="meta-item" style="font-weight:700;color:var(--s-text-primary)"
											>₹{booking.totalAmount || booking.price || '-'}</span
										>
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
												console.log('[Dashboard] Resume clicked for:', booking.id);
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
												console.log('[Dashboard] Pause clicked for:', booking.id);
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
										<p class="upnext-phone">
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

							{#if booking.payment}
								<div class="db-payment">
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

							<div class="upnext-actions">
								{#if booking.status === 'pending'}
									<button
										class="action-btn-soft confirm"
										onclick={(e) => {
											e.stopPropagation();
											openBooking(booking);
										}}
									>
										✓ Confirm
									</button>
									<button
										class="action-btn-soft decline"
										onclick={(e) => {
											e.stopPropagation();
											openBooking(booking);
										}}
									>
										✕ Decline
									</button>
								{:else if booking.status === 'confirmed'}
									<button
										class="action-btn-premium"
										onclick={(e) => {
											e.stopPropagation();
											openBooking(booking);
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

	.timer-phone,
	.upnext-phone {
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

	/* ═══════════════════════════════════════════
	   UPNEXT CARD — Premium Elevated Design
	   ═══════════════════════════════════════════ */
	.upnext-card {
		padding: var(--s-space-lg);
		border-radius: var(--s-radius-xl);
		position: relative;
		overflow: hidden;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.04),
			0 6px 18px rgba(0, 0, 0, 0.06);
		transition:
			transform var(--s-duration-normal) var(--s-ease),
			box-shadow var(--s-duration-normal) var(--s-ease);
	}
	:global(.staff-app.dark) .upnext-card {
		background: var(--s-surface-raised);
		border-color: var(--s-border-strong);
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.25),
			0 8px 24px rgba(0, 0, 0, 0.35);
	}
	@media (hover: hover) {
		.upnext-card:hover {
			transform: translateY(-3px);
			box-shadow:
				0 6px 12px rgba(0, 0, 0, 0.08),
				0 12px 36px rgba(0, 0, 0, 0.12);
		}
		:global(.staff-app.dark) .upnext-card:hover {
			box-shadow:
				0 8px 16px rgba(0, 0, 0, 0.35),
				0 16px 40px rgba(0, 0, 0, 0.45);
		}
	}
	.upnext-card:active {
		transform: scale(0.985);
	}

	/* ── Status Left Accent Bar ── */
	.card-pending,
	.card-confirmed,
	.card-completed,
	.card-cancelled {
		padding-left: calc(var(--s-space-lg) + 4px);
	}
	.card-pending::before,
	.card-confirmed::before,
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
		gap: var(--s-space-md);
		margin-top: var(--s-space-sm);
	}

	.action-btn-soft {
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
	}

	.action-btn-soft.confirm {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		color: white;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
	}
	@media (hover: hover) {
		.action-btn-soft.confirm:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		}
	}
	:global(.staff-app.dark) .action-btn-soft.confirm {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.action-btn-soft.decline {
		flex: 0.5;
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		color: white;
		box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
	}
	@media (hover: hover) {
		.action-btn-soft.decline:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
		}
	}
	:global(.staff-app.dark) .action-btn-soft.decline {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.action-btn-premium {
		flex: 1;
		padding: 10px 18px;
		border-radius: var(--s-radius-lg);
		font-weight: 700;
		font-size: 0.85rem;
		border: none;
		cursor: pointer;
		background: linear-gradient(135deg, var(--s-accent) 0%, var(--s-accent-dark, #b08d4f) 100%);
		color: white;
		box-shadow: 0 2px 8px rgba(201, 169, 110, 0.2);
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		letter-spacing: 0.02em;
	}

	@media (hover: hover) {
		.action-btn-premium:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(201, 169, 110, 0.3);
		}
	}
	.action-btn-premium:active {
		transform: translateY(0);
	}
	:global(.staff-app.dark) .action-btn-premium {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	/* Active Service Mode Modifier */
	.upnext-card.active-service-mode {
		background: var(--s-surface);
		border: 2px solid var(--s-accent);
		box-shadow: var(--s-shadow-glow);
		animation: s-scaleIn 0.4s var(--s-ease-spring);
	}

	/* ── Payment Info ── */
	.db-payment {
		display: flex;
		align-items: center;
		gap: var(--s-space-sm);
		margin-top: var(--s-space-sm);
		flex-wrap: wrap;
	}

	.db-payment.timer-payment {
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

<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffNav from '$lib/components/staff/StaffNav.svelte';
	import { format } from 'date-fns'; // useful if available, but I'll stick to vanilla JS for zero-dep if possible, or use simple formatting.

	// Simple date state
	let selectedDate = $state(new Date());

	// Formatting helpers
	const formatDateKey = (d: Date) => d.toISOString().split('T')[0];
	const displayDate = (d: Date) =>
		d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

	// Filter bookings for selected date
	let dailyBookings = $derived(
		$staffBookings
			.filter((b) => {
				if (!b.date) return false;
				// String comparison for YYYY-MM-DD
				if (typeof b.date === 'string' && b.date.includes(formatDateKey(selectedDate))) return true;
				// Handle Firestore timestamp?
				// For now, assuming date string format from booking system
				return false;
			})
			.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
	);

	function changeDate(days: number) {
		const newDate = new Date(selectedDate);
		newDate.setDate(selectedDate.getDate() + days);
		selectedDate = newDate;
	}
</script>

<StaffHeader title="Schedule" />

<div class="schedule-page">
	<div class="date-navigator">
		<button class="nav-btn" onclick={() => changeDate(-1)}>&lt;</button>
		<div class="current-date">
			<span class="label">Running Schedule</span>
			<span class="value">{displayDate(selectedDate)}</span>
		</div>
		<button class="nav-btn" onclick={() => changeDate(1)}>&gt;</button>
	</div>

	<div class="schedule-list">
		{#each dailyBookings as booking}
			<div class="time-slot">
				<div class="time-label">{booking.time}</div>
				<div class="slot-card {booking.status}">
					<div class="slot-header">
						<h4>{booking.userName}</h4>
						<span class="status-badge">{booking.status}</span>
					</div>
					<p class="service-name">{booking.serviceName}</p>
					{#if booking.notes}
						<p class="notes">Note: {booking.notes}</p>
					{/if}
				</div>
			</div>
		{/each}

		{#if dailyBookings.length === 0}
			<div class="empty-state">
				<div class="icon-coffee">☕</div>
				<p>No appointments for this day.</p>
				<p class="sub">Enjoy your free time!</p>
			</div>
		{/if}
	</div>
</div>

<StaffNav />

<style>
	.schedule-page {
		padding-bottom: 80px;
	}

	.date-navigator {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: white;
		margin-bottom: 16px;
		position: sticky;
		top: 60px; /* Below header */
		z-index: 40;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
	}

	.current-date {
		text-align: center;
	}

	.current-date .label {
		display: block;
		font-size: 0.75rem;
		color: #8e8e93;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.current-date .value {
		font-size: 1.1rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.nav-btn {
		background: #f2f2f7;
		border: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		font-weight: 600;
		color: #1c1c1e;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.schedule-list {
		padding: 0 16px;
	}

	.time-slot {
		display: flex;
		margin-bottom: 16px;
	}

	.time-label {
		width: 60px;
		font-size: 0.9rem;
		font-weight: 600;
		color: #1c1c1e;
		padding-top: 12px;
	}

	.slot-card {
		flex: 1;
		background: white;
		border-radius: 12px;
		padding: 16px;
		border-left: 4px solid #e5e5ea; /* Default gray */
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
	}

	.slot-card.pending {
		border-left-color: #f57c00;
	}
	.slot-card.confirmed {
		border-left-color: #388e3c;
	}
	.slot-card.in-progress {
		border-left-color: #1976d2;
	}
	.slot-card.cancelled {
		border-left-color: #d32f2f;
		opacity: 0.7;
	}
	.slot-card.completed {
		border-left-color: #8e8e93;
		opacity: 0.8;
	}

	.slot-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 4px;
	}

	.slot-header h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.status-badge {
		font-size: 0.7rem;
		text-transform: uppercase;
		font-weight: 700;
		color: #8e8e93;
	}

	.service-name {
		margin: 0;
		color: #3a3a3c;
		font-size: 0.9rem;
	}

	.notes {
		margin-top: 8px;
		font-size: 0.8rem;
		color: #8e8e93;
		font-style: italic;
		background: #f9f9f9;
		padding: 8px;
		border-radius: 6px;
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: #8e8e93;
	}

	.icon-coffee {
		font-size: 3rem;
		margin-bottom: 16px;
	}

	.empty-state p {
		margin: 4px 0;
		font-size: 1rem;
	}

	.empty-state .sub {
		font-size: 0.9rem;
		opacity: 0.7;
	}
</style>

<script lang="ts">
	import { staffUser } from '$lib/stores/staffAuth';
	import { upcomingBookings, todayBookings } from '$lib/stores/staffData';
	import { formatRelativeTime } from '$lib/stores/adminData'; // Reuse helper
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffNav from '$lib/components/staff/StaffNav.svelte';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';

	// Mock "Next Up" logic - take the first from upcoming
	let nextAppointment = $derived($upcomingBookings[0]);
	let todayCount = $derived($todayBookings.length);
	let pendingCount = $derived($upcomingBookings.filter((b) => b.status === 'pending').length);

	import { updateBookingStatus } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';

	let isModalOpen = $state(false);
	let modalMode = $state('create');

	async function handleStatusChange(id: string, newStatus: string) {
		if (!confirm(`Mark this booking as ${newStatus}?`)) return;
		try {
			await updateBookingStatus(id, newStatus);
			showToast(`Booking marked as ${newStatus}`, 'success');
		} catch (error) {
			console.error(error);
			showToast('Failed to update status', 'error');
		}
	}
</script>

<StaffHeader title="Dashboard" />

<div class="dashboard-content">
	<div class="welcome-section">
		<p class="date">
			{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
		</p>
		<h2>Hello, {$staffUser?.displayName?.split(' ')[0] || 'Member'} 👋</h2>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<span class="stat-value">{todayCount}</span>
			<span class="stat-label">Today</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{pendingCount}</span>
			<span class="stat-label">Pending</span>
		</div>
		<button
			class="stat-card action"
			onclick={() => {
				modalMode = 'create';
				isModalOpen = true;
			}}
		>
			<div class="icon-plus">+</div>
			<span class="stat-label">New</span>
		</button>
	</div>

	<BookingModal bind:isOpen={isModalOpen} mode={modalMode} />

	{#if nextAppointment}
		<div class="section-title">
			<h3>Up Next</h3>
			<a href="/staff/schedule" class="see-all">See Schedule</a>
		</div>

		<div class="appointment-card next-up">
			<div class="card-header">
				<span class="time">{nextAppointment.time || 'TBD'}</span>
				<span class="status {nextAppointment.status}">{nextAppointment.status}</span>
			</div>
			<div class="card-body">
				<div class="client-info">
					<h4>{nextAppointment.userName || 'Guest User'}</h4>
					<p>
						{#if nextAppointment.servicesList && nextAppointment.servicesList.length > 0}
							{nextAppointment.servicesList.map((s) => s.name).join(', ')}
						{:else}
							{nextAppointment.serviceName || 'Service'}
						{/if}
					</p>
				</div>
				{#if nextAppointment.userPhoto}
					<img src={nextAppointment.userPhoto} alt="Client" class="client-avatar" />
				{/if}
			</div>
			<div class="card-footer">
				{#if nextAppointment.status === 'pending'}
					<button
						class="action-btn confirm"
						onclick={() => handleStatusChange(nextAppointment.id, 'confirmed')}
						>Confirm Booking</button
					>
				{:else if nextAppointment.status === 'confirmed'}
					<button
						class="action-btn start"
						onclick={() => handleStatusChange(nextAppointment.id, 'in-progress')}
						>Start Service</button
					>
				{:else if nextAppointment.status === 'in-progress'}
					<button
						class="action-btn complete"
						onclick={() => handleStatusChange(nextAppointment.id, 'completed')}
						>Complete Service</button
					>
				{/if}
			</div>
		</div>
	{:else}
		<div class="empty-state">
			<p>No upcoming appointments.</p>
		</div>
	{/if}

	<div class="section-title">
		<h3>Today's Overview</h3>
	</div>

	<div class="timeline">
		{#each $todayBookings as booking}
			<div class="timeline-item">
				<div class="time-col">
					<span class="time">{booking.time}</span>
				</div>
				<div class="event-col">
					<div class="event-card">
						<h4>{booking.userName}</h4>
						<p>
							{#if booking.servicesList && booking.servicesList.length > 0}
								{booking.servicesList.map((s) => s.name).join(', ')}
							{:else}
								{booking.serviceName}
							{/if}
						</p>
						<span class="status-dot {booking.status}"></span>
					</div>
				</div>
			</div>
		{/each}
		{#if $todayBookings.length === 0}
			<p class="no-data">No appointments for today yet.</p>
		{/if}
	</div>
</div>

<StaffNav />

<style>
	.dashboard-content {
		padding-bottom: 24px;
	}

	.welcome-section {
		margin-bottom: 24px;
	}

	.date {
		color: #8e8e93;
		font-size: 0.9rem;
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 500;
	}

	.welcome-section h2 {
		margin: 4px 0 0 0;
		font-family: 'Outfit', sans-serif;
		font-size: 2rem;
		color: #1c1c1e;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr 0.8fr;
		gap: 12px;
		margin-bottom: 32px;
	}

	.stat-card {
		background: white;
		border-radius: 16px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
	}

	.stat-card.action {
		background: #000;
		color: white;
		align-items: center;
		cursor: pointer;
	}

	.stat-value {
		font-size: 1.8rem;
		font-weight: 700;
		font-family: 'Outfit', sans-serif;
		line-height: 1;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 0.8rem;
		color: #8e8e93;
		font-weight: 500;
	}

	.stat-card.action .stat-label {
		color: rgba(255, 255, 255, 0.8);
	}

	.icon-plus {
		font-size: 1.5rem;
		font-weight: 300;
		margin-bottom: 4px;
	}

	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.section-title h3 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0;
	}

	.see-all {
		font-size: 0.9rem;
		color: #007aff;
		text-decoration: none;
	}

	/* Appointment Card - Next Up */
	.appointment-card {
		background: white;
		border-radius: 20px;
		padding: 20px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
		margin-bottom: 32px;
		border: 1px solid rgba(0, 0, 0, 0.05);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.time {
		font-weight: 600;
		font-size: 1.1rem;
		color: #1c1c1e;
	}

	.status {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 20px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status.pending {
		background: #fff3e0;
		color: #f57c00;
	}
	.status.confirmed {
		background: #e8f5e9;
		color: #388e3c;
	}
	.status.cancelled {
		background: #ffebee;
		color: #d32f2f;
	}

	.card-body {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.client-info h4 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		font-family: 'Outfit', sans-serif;
	}

	.client-info p {
		margin: 4px 0 0 0;
		color: #8e8e93;
	}

	.client-avatar {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		object-fit: cover;
	}

	.card-footer {
		border-top: 1px solid #f2f2f7;
		padding-top: 16px;
	}

	.action-btn {
		width: 100%;
		background: #000;
		color: white;
		border: none;
		padding: 14px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
	}

	/* Timeline */
	.timeline {
		position: relative;
	}

	.timeline-item {
		display: flex;
		margin-bottom: 16px;
	}

	.time-col {
		width: 60px;
		padding-top: 12px;
		font-size: 0.85rem;
		color: #8e8e93;
		font-weight: 500;
		text-align: right;
		padding-right: 12px;
	}

	.event-col {
		flex: 1;
		border-left: 2px solid #f2f2f7;
		padding-left: 16px;
		padding-bottom: 16px;
	}

	.event-card {
		background: white;
		padding: 12px 16px;
		border-radius: 12px;
		position: relative;
	}

	.event-card h4 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.event-card p {
		margin: 2px 0 0 0;
		font-size: 0.85rem;
		color: #8e8e93;
	}

	.status-dot {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-dot.pending {
		background: #f57c00;
	}
	.status-dot.confirmed {
		background: #388e3c;
	}
	.status-dot.cancelled {
		background: #d32f2f;
	}

	.no-data {
		text-align: center;
		color: #8e8e93;
		font-style: italic;
		margin-top: 20px;
	}

	.empty-state {
		background: white;
		padding: 30px;
		text-align: center;
		border-radius: 16px;
		margin-bottom: 32px;
		color: #8e8e93;
	}
</style>

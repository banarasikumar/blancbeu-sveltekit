<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus } from '$lib/stores/adminData'; // Direct firestore update
	import { showToast } from '$lib/stores/toast';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffNav from '$lib/components/staff/StaffNav.svelte';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import type { Booking } from '$lib/stores/adminData';

	let searchTerm = $state('');
	let isModalOpen = $state(false);
	let modalMode = $state('create');
	let selectedBooking = $state<Booking | null>(null);

	function openCreate() {
		modalMode = 'create';
		selectedBooking = null;
		isModalOpen = true;
	}

	function openEdit(booking: any) {
		modalMode = 'edit';
		selectedBooking = booking;
		isModalOpen = true;
	}

	let filteredBookings = $derived(
		$staffBookings
			.filter((b) => {
				const s = searchTerm.toLowerCase();
				return (
					(b.userName || '').toLowerCase().includes(s) ||
					(b.serviceName || '').toLowerCase().includes(s) ||
					(b.status || '').toLowerCase().includes(s)
				);
			})
			.sort((a, b) => {
				// Sort by date/time (newest first for general list)
				return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
			})
	);

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

	// History Logic
	import { getBookingHistory } from '$lib/stores/staffData';
	let showHistoryModal = $state(false);
	let historyLoading = $state(false);
	let historyBookings = $state<Booking[]>([]);
	let selectedHistoryUser = $state('');

	async function openHistory(userId: string, userName: string) {
		if (!userId) {
			showToast('User ID not available', 'error');
			return;
		}
		selectedHistoryUser = userName;
		historyLoading = true;
		showHistoryModal = true;
		historyBookings = await getBookingHistory(userId);
		historyLoading = false;
	}
</script>

<StaffHeader title="Bookings" />

<div class="bookings-page">
	<div class="search-bar">
		<input type="text" placeholder="Search bookings..." bind:value={searchTerm} />
		<div class="search-icon">🔍</div>
	</div>

	<BookingModal bind:isOpen={isModalOpen} mode={modalMode} existingBooking={selectedBooking} />

	<button class="fab" onclick={openCreate}>+</button>

	<div class="bookings-list">
		{#each filteredBookings as booking (booking.id)}
			<div class="booking-card">
				<div class="card-top">
					<div class="info">
						<h3>{booking.userName}</h3>
						<p class="service">
							{#if booking.servicesList && booking.servicesList.length > 0}
								{booking.servicesList.map((s) => s.name).join(', ')}
							{:else}
								{booking.serviceName}
							{/if}
							• {booking.totalAmount
								? `₹${booking.totalAmount}`
								: booking.price
									? `₹${booking.price}`
									: '-'}
						</p>
						<p class="meta">{booking.date || 'No Date'} at {booking.time || 'Time'}</p>
					</div>
					<span class="status-pill {booking.status}">{booking.status}</span>
				</div>

				<div class="actions">
					<button class="btn edit" onclick={() => openEdit(booking)}>Edit</button>
					{#if booking.status === 'pending'}
						<button class="btn confirm" onclick={() => handleStatusChange(booking.id, 'confirmed')}
							>Confirm</button
						>
					{:else if booking.status === 'confirmed'}
						<button class="btn start" onclick={() => handleStatusChange(booking.id, 'in-progress')}
							>Start</button
						>
					{:else if booking.status === 'in-progress'}
						<button class="btn complete" onclick={() => handleStatusChange(booking.id, 'completed')}
							>Complete</button
						>
					{/if}
					{#if booking.userId}
						<button
							class="btn history"
							onclick={() => openHistory(booking.userId, booking.userName)}>History</button
						>
					{/if}
					<!-- History and Cancel removed/moved -->
				</div>
			</div>
		{/each}

		{#if filteredBookings.length === 0}
			<div class="no-results">No bookings found.</div>
		{/if}
	</div>

	{#if showHistoryModal}
		<div class="modal-backdrop" onclick={() => (showHistoryModal = false)}>
			<div class="modal-content" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h2>History: {selectedHistoryUser}</h2>
					<button class="close-btn" onclick={() => (showHistoryModal = false)}>&times;</button>
				</div>
				<div class="modal-body">
					{#if historyLoading}
						<p>Loading...</p>
					{:else if historyBookings.length === 0}
						<p>No past bookings found.</p>
					{:else}
						<div class="history-list">
							{#each historyBookings as b}
								<div class="history-item">
									<div class="h-top">
										<span class="h-date">{b.date}</span>
										<span class="status-pill {b.status}">{b.status}</span>
									</div>
									<p class="h-service">
										{#if b.servicesList && b.servicesList.length > 0}
											{b.servicesList.map((s) => s.name).join(', ')}
										{:else}
											{b.serviceName || 'Service'}
										{/if}
									</p>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<StaffNav />

<style>
	.bookings-page {
		padding-bottom: 80px;
		padding-top: 16px;
	}

	.search-bar {
		margin: 0 16px 20px 16px;
		position: relative;
	}

	.search-bar input {
		width: 100%;
		padding: 12px 16px 12px 40px;
		border: none;
		background: white;
		border-radius: 12px;
		font-size: 1rem;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
	}

	.search-icon {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0.5;
	}

	.bookings-list {
		padding: 0 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.booking-card {
		background: white;
		border-radius: 16px;
		padding: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.info h3 {
		margin: 0 0 4px 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #1c1c1e;
	}

	.service {
		margin: 0 0 2px 0;
		color: #3a3a3c;
		font-size: 0.95rem;
	}

	.meta {
		margin: 0;
		color: #8e8e93;
		font-size: 0.85rem;
	}

	.status-pill {
		font-size: 0.7rem;
		padding: 4px 8px;
		border-radius: 20px;
		text-transform: uppercase;
		font-weight: 700;
		height: fit-content;
	}

	.status-pill.pending {
		background: #fff3e0;
		color: #f57c00;
	}
	.status-pill.confirmed {
		background: #e8f5e9;
		color: #388e3c;
	}
	.status-pill.in-progress {
		background: #e3f2fd;
		color: #1976d2;
	}
	.status-pill.completed {
		background: #f2f2f7;
		color: #8e8e93;
	}
	.status-pill.cancelled {
		background: #ffebee;
		color: #d32f2f;
	}

	.actions {
		display: flex;
		gap: 8px;
		border-top: 1px solid #f2f2f7;
		padding-top: 12px;
	}

	.btn {
		flex: 1;
		padding: 10px;
		border-radius: 8px;
		border: none;
		font-weight: 600;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.btn.start {
		background: #1c1c1e;
		color: white;
	}
	.btn.confirm {
		background: #34c759;
		color: white;
	}
	.btn.cancel {
		background: #ffebee;
		color: #d32f2f;
	}
	.btn.complete {
		background: #007aff;
		color: white;
	}
	.btn.history {
		background: #f2f2f7;
		color: #1c1c1e;
	}

	.no-results {
		text-align: center;
		color: #8e8e93;
		margin-top: 40px;
	}

	.btn.edit {
		background: #e5e5ea;
		color: #1c1c1e;
	}

	.fab {
		position: fixed;
		bottom: 90px;
		right: 20px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: #000;
		color: white;
		border: none;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		cursor: pointer;
		z-index: 100;
		transition: transform 0.2s;
	}

	.fab:active {
		transform: scale(0.95);
	}
	/* History Modal Styles */
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.history-item {
		padding: 12px;
		background: #f9f9f9;
		border-radius: 12px;
	}
	.h-top {
		display: flex;
		justify-content: space-between;
		margin-bottom: 4px;
	}
	.h-date {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.h-service {
		margin: 0;
		color: #8e8e93;
		font-size: 0.85rem;
	}
	/* Modal Base Styles reuse dashboard modal styles if global, else need duplication or global class */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: flex-end;
		z-index: 200;
		backdrop-filter: blur(4px);
	}
	@media (min-width: 768px) {
		.modal-backdrop {
			align-items: center;
		}
	}
	.modal-content {
		background: white;
		width: 100%;
		max-width: 500px;
		border-radius: 20px 20px 0 0;
		padding: 24px;
		max-height: 80vh;
		overflow-y: auto;
	}
	@media (min-width: 768px) {
		.modal-content {
			border-radius: 20px;
		}
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}
	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	.close-btn {
		background: none;
		border: none;
		font-size: 2rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		color: #8e8e93;
	}
</style>

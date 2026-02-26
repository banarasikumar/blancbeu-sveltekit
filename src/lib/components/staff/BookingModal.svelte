<script lang="ts">
	import { staffServices, createBooking, updateBookingDetails } from '$lib/stores/staffData';
	import { showToast } from '$lib/stores/toast';
	import type { Booking } from '$lib/stores/adminData';
	import { goto } from '$app/navigation';
	import { startServiceTimer } from '$lib/stores/serviceTimer';

	let {
		isOpen = $bindable(false),
		mode = 'create', // 'create' | 'edit'
		existingBooking = null,
		onClose
	} = $props();

	let name = $state('');
	let phone = $state('');
	let date = $state('');
	let time = $state('');
	let notes = $state('');

	// Multi-service management
	type OrderItem = {
		id: string; // 'custom' or serviceId
		name: string;
		price: number;
		duration?: number;
	};

	let selectedServices = $state<OrderItem[]>([]);
	let isSubmitting = $state(false);

	// Temp inputs for adding a service
	let tempServiceId = $state('');

	// Derived total
	let totalAmount = $derived(
		selectedServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
	);

	// Internal mode state to handle Overview vs Edit vs Create
	let internalMode = $state('create'); // 'create', 'edit', 'overview'

	// Initialize form when modal opens or mode changes
	$effect(() => {
		if (isOpen) {
			// Set initial internal mode
			if (mode === 'create') {
				internalMode = 'create';
			} else {
				internalMode = 'view'; // Default to view for existing bookings
			}

			if (mode === 'edit' && existingBooking) {
				const b = existingBooking as Booking;
				name = b.userName || '';
				phone = b.userPhone || '';
				date = b.date || '';
				time = b.time || '';
				notes = b.notes || '';

				// Initialize services
				if (b.servicesList && b.servicesList.length > 0) {
					selectedServices = b.servicesList.map((s) => ({
						id: s.id || 'custom',
						name: s.name,
						price: s.price,
						duration: s.duration
					}));
				} else if (b.serviceName) {
					// Fallback for legacy
					selectedServices = [
						{
							id: 'legacy',
							name: b.serviceName,
							price: b.price || 0,
							duration: b.duration
						}
					];
				} else {
					selectedServices = [];
				}
			} else if (mode === 'create') {
				// Reset for create
				name = '';
				phone = '';
				date = new Date().toISOString().split('T')[0];
				time = '10:00';
				notes = '';
				selectedServices = [];
				tempServiceId = '';
			}
		}
	});

	function toggleEditMode() {
		if (internalMode === 'view') {
			internalMode = 'edit';
		} else {
			internalMode = 'view';
			// Re-reset form values just in case?
			// No, keep edits? Or cancel edits?
			// Usually cancel edits implies revert. Let's assume toggle is "Enter Edit Mode".
			// "Cancel" in edit mode should revert to view.
		}
	}

	function addService() {
		if (!tempServiceId) return;
		const s = $staffServices.find((x) => x.id === tempServiceId);
		if (s) {
			selectedServices = [
				...selectedServices,
				{
					id: s.id,
					name: s.name,
					price: s.price,
					duration: s.duration
				}
			];
			tempServiceId = ''; // Reset selection
		}
	}

	function removeService(index: number) {
		selectedServices = selectedServices.filter((_, i) => i !== index);
	}

	function updateServicePrice(index: number, newPrice: number) {
		selectedServices[index].price = newPrice;
	}

	function addCustomService() {
		selectedServices = [
			...selectedServices,
			{
				id: `custom_${Date.now()}`,
				name: 'Custom Service',
				price: 0
			}
		];
	}

	async function handleSubmit() {
		if (!name || !date || !time) {
			showToast('Please fill in client name, date and time', 'error');
			return;
		}

		if (selectedServices.some((s) => !s.name.trim())) {
			showToast('Service names cannot be empty', 'error');
			return;
		}

		if (selectedServices.length === 0) {
			showToast('Please add at least one service', 'error');
			return;
		}

		isSubmitting = true;

		try {
			const bookingData = {
				userName: name,
				userPhone: phone,
				date,
				time,
				// Main source of truth
				servicesList: selectedServices,
				totalAmount: totalAmount,
				// Legacy fields for backward compat (use first service or summary)
				serviceName: selectedServices.map((s) => s.name).join(', '),
				price: totalAmount,
				notes
			};

			if (mode === 'create') {
				await createBooking(bookingData);
				showToast('Booking created successfully', 'success');
			} else if (mode === 'edit' && existingBooking) {
				await updateBookingDetails(existingBooking.id, bookingData);
				showToast('Booking updated successfully', 'success');
			}

			isOpen = false;
			onClose?.();
		} catch (error) {
			console.error(error);
			showToast('Operation failed', 'error');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleStatusChange(newStatus: string) {
		if (!existingBooking) return;

		if (newStatus === 'cancelled') {
			if (!confirm('Are you sure you want to cancel this booking?')) return;
		}

		try {
			if (newStatus === 'in-progress') {
				await startServiceTimer(existingBooking);
				showToast('Service started successfully', 'success');
				if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
			} else {
				await updateBookingDetails(existingBooking.id, { status: newStatus });
				showToast(`Status updated to ${newStatus}`, 'success');
			}
			isOpen = false; // Close modal after action
		} catch (error) {
			console.error(error);
			showToast('Failed to update status', 'error');
		}
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" onclick={() => (isOpen = false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<!-- HEADER -->
			<div class="modal-header">
				<h2>
					{#if internalMode === 'create'}
						New Booking
					{:else if internalMode === 'edit'}
						Edit Booking
					{:else}
						Booking Details
					{/if}
				</h2>
				<div class="header-actions">
					{#if internalMode === 'view'}
						<button class="icon-btn edit-toggle" onclick={toggleEditMode} aria-label="Edit">
							✏️
						</button>
					{/if}
					<button class="close-btn" onclick={() => (isOpen = false)}>&times;</button>
				</div>
			</div>

			<div class="modal-body">
				{#if internalMode === 'view' && existingBooking}
					<!-- VIEW MODE (Overview) -->
					<div class="overview-container">
						<div class="overview-card">
							<div class="ov-header">
								<div class="client-avatar-placeholder">
									{existingBooking.userName?.[0] || 'G'}
								</div>
								<div class="ov-client-info">
									<h3>{existingBooking.userName || 'Guest'}</h3>
									<p>{existingBooking.userPhone || 'No phone provided'}</p>
								</div>
								<span class={`status-badge-lg ${existingBooking.status}`}
									>{existingBooking.status}</span
								>
							</div>

							<div class="ov-time-row">
								<div class="ov-time-block">
									<span class="ov-label">Date</span>
									<span class="ov-value">{existingBooking.date}</span>
								</div>
								<div class="ov-divider"></div>
								<div class="ov-time-block">
									<span class="ov-label">Time</span>
									<span class="ov-value">{existingBooking.time}</span>
								</div>
							</div>
						</div>

						<div class="ov-section">
							<h4>Services</h4>
							<div class="ov-service-list">
								{#if existingBooking.servicesList}
									{#each existingBooking.servicesList as s}
										<div class="ov-service-item">
											<span>{s.name}</span>
											<span class="price">₹{s.price}</span>
										</div>
									{/each}
								{:else if existingBooking.serviceName}
									<div class="ov-service-item">
										<span>{existingBooking.serviceName}</span>
										<span class="price">₹{existingBooking.price}</span>
									</div>
								{/if}
								<div class="ov-total-row">
									<span>Total</span>
									<span class="total-price"
										>₹{existingBooking.totalAmount || existingBooking.price || 0}</span
									>
								</div>
							</div>
						</div>

						{#if existingBooking.payment}
							<div class="ov-section">
								<h4>Payment</h4>
								<div class="ov-payment-card">
									<div class="ov-payment-row">
										<span
											class="ov-payment-badge {existingBooking.payment.type === 'full'
												? 'payment-prepaid'
												: existingBooking.payment.type === 'token'
													? 'payment-token'
													: 'payment-salon'}"
										>
											{existingBooking.payment.type === 'full'
												? '💳 Prepaid'
												: existingBooking.payment.type === 'token'
													? '🪙 Token'
													: '🏪 Pay at Salon'}
										</span>
										{#if existingBooking.payment.method && existingBooking.payment.method !== 'pay_at_salon'}
											<span class="ov-payment-method"
												>via {existingBooking.payment.method.toUpperCase()}</span
											>
										{/if}
									</div>
									{#if existingBooking.payment.type === 'token' && existingBooking.payment.amount}
										<div class="ov-payment-breakdown">
											<div class="ov-pay-line paid">
												<span>✓ Advance Paid</span>
												<span>₹{existingBooking.payment.amount}</span>
											</div>
											<div class="ov-pay-line due">
												<span>Balance Due</span>
												<span
													>₹{(existingBooking.totalAmount || existingBooking.price || 0) -
														existingBooking.payment.amount}</span
												>
											</div>
										</div>
									{:else if existingBooking.payment.type === 'full' && existingBooking.payment.amount}
										<div class="ov-payment-breakdown">
											<div class="ov-pay-line paid">
												<span>✓ Fully Paid Online</span>
												<span>₹{existingBooking.payment.amount}</span>
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<div class="ov-section">
							<h4>Notes</h4>
							<p class="ov-notes" class:ov-notes-empty={!existingBooking.notes}>
								{#if existingBooking.notes}
									{existingBooking.notes}
								{:else}
									None
								{/if}
							</p>
						</div>
					</div>
				{:else}
					<!-- EDIT/CREATE FORM -->
					<section class="form-section">
						<h3>Client Details</h3>
						<div class="form-group">
							<input
								type="text"
								id="name"
								bind:value={name}
								placeholder="Client Name *"
								class="input-lg"
							/>
						</div>
						<div class="form-group">
							<input
								type="tel"
								id="phone"
								bind:value={phone}
								placeholder="Phone Number (Optional)"
							/>
						</div>
					</section>

					<section class="form-section">
						<h3>Time & Date</h3>
						<div class="row">
							<div class="form-group">
								<input type="date" id="date" bind:value={date} />
							</div>
							<div class="form-group">
								<input type="time" id="time" bind:value={time} />
							</div>
						</div>
					</section>

					<section class="form-section">
						<div class="section-top">
							<h3>Services</h3>
							<span class="total-badge">Total: ₹{totalAmount}</span>
						</div>

						<div class="service-list">
							{#each selectedServices as item, i}
								<div class="service-item">
									<div class="s-info">
										<input
											type="text"
											bind:value={item.name}
											class="name-input"
											placeholder="Service Name"
										/>
										<div class="s-price-edit">
											<span>₹</span>
											<input
												type="number"
												value={item.price}
												oninput={(e) => updateServicePrice(i, Number(e.currentTarget.value))}
												class="price-input"
											/>
										</div>
									</div>
									<button class="remove-btn" onclick={() => removeService(i)}>×</button>
								</div>
							{/each}
						</div>

						<div class="add-service-row">
							<select id="service" bind:value={tempServiceId} class="service-select">
								<option value="" disabled selected>Select from catalog +</option>
								{#each $staffServices as service}
									<option value={service.id}>{service.name} - ₹{service.price}</option>
								{/each}
							</select>
							{#if tempServiceId}
								<button class="confirm-add-btn" onclick={addService}>Add</button>
							{/if}
						</div>
						<button class="text-btn" onclick={addCustomService}>+ Add Manual Entry</button>
					</section>

					<div class="form-group notes-group">
						<textarea id="notes" bind:value={notes} placeholder="Add special requests or notes..."
						></textarea>
					</div>
				{/if}
			</div>

			<!-- FOOTER -->
			<div class="modal-footer">
				{#if internalMode === 'view' && existingBooking}
					<!-- VIEW MODE ACTIONS (Status changes) -->
					<div class="status-actions">
						{#if existingBooking.status === 'pending'}
							<button class="action-btn confirm" onclick={() => handleStatusChange('confirmed')}>
								Confirm Booking
							</button>
							<button class="action-btn cancel" onclick={() => handleStatusChange('cancelled')}>
								Decline
							</button>
						{:else if existingBooking.status === 'confirmed'}
							<button class="action-btn start" onclick={() => handleStatusChange('in-progress')}>
								Start Service
							</button>
							<button class="action-btn cancel" onclick={() => handleStatusChange('cancelled')}>
								Cancel
							</button>
						{:else if existingBooking.status === 'in-progress'}
							<button class="action-btn complete" onclick={() => handleStatusChange('completed')}>
								Complete Service
							</button>
						{:else}
							<!-- Completed or Cancelled -->
							{#if existingBooking.status === 'completed'}
								<button
									class="action-btn"
									style="background: var(--s-brand, #1a1a2e); color: white;"
									onclick={async () => {
										isOpen = false;
										const { generateAndSendInvoice } = await import('$lib/utils/invoice');
										await generateAndSendInvoice({
											booking: existingBooking,
											services: existingBooking.servicesList || [
												{
													name: existingBooking.serviceName || 'Service',
													price: existingBooking.totalAmount || 0
												}
											],
											totalAmount: existingBooking.totalAmount || existingBooking.price || 0,
											discountAmount: existingBooking.discountAmount || 0,
											extraCharge: existingBooking.extraCharge || 0,
											couponCode: existingBooking.couponCode || null
										});
									}}
								>
									Regenerate Invoice & Send
								</button>
							{/if}
							<button class="action-btn outline" onclick={() => (isOpen = false)}>Close</button>
						{/if}
					</div>
				{:else}
					<!-- EDIT/CREATE ACTIONS -->
					<div class="edit-actions">
						{#if internalMode === 'edit'}
							<button class="cancel-btn" onclick={() => (internalMode = 'view')}>Cancel Edit</button
							>
						{:else}
							<button class="cancel-btn" onclick={() => (isOpen = false)}>Cancel</button>
						{/if}

						<button class="save-btn" onclick={handleSubmit} disabled={isSubmitting}>
							{isSubmitting
								? 'Saving...'
								: internalMode === 'create'
									? 'Create Booking'
									: 'Save Changes'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	/* Backdrop */
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
		backdrop-filter: blur(6px);
	}

	@media (min-width: 768px) {
		.modal-backdrop {
			align-items: center;
		}
	}

	/* Modal Content */
	.modal-content {
		background: var(--s-bg, #f8f9fa);
		width: 100%;
		max-width: 500px;
		border-radius: var(--s-radius-2xl, 24px) var(--s-radius-2xl, 24px) 0 0;
		max-height: 92vh;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.modal-content {
			border-radius: var(--s-radius-2xl, 20px);
			animation: fadeIn 0.3s ease-out;
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Header */
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px 16px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
	}

	.modal-header h2 {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon-btn.edit-toggle {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 36px;
		height: 36px;
		border-radius: var(--s-radius-full, 50%);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		cursor: pointer;
		transition: background var(--s-duration-fast, 0.15s) ease;
	}

	.icon-btn.edit-toggle:active {
		background: var(--s-border, #e5e7eb);
		transform: scale(0.92);
	}

	.close-btn {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 36px;
		height: 36px;
		border-radius: var(--s-radius-full, 50%);
		font-size: 1.3rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		transition: all var(--s-duration-fast, 0.15s) ease;
	}

	.close-btn:active {
		background: var(--s-border, #e5e7eb);
		transform: scale(0.92);
	}

	/* Body */
	.modal-body {
		overflow-y: auto;
		flex: 1;
		padding: 20px 24px;
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.modal-body::-webkit-scrollbar {
		display: none;
	}

	/* ===== VIEW / OVERVIEW MODE ===== */
	.overview-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.overview-card {
		background: var(--s-surface, white);
		border-radius: var(--s-radius-xl, 16px);
		padding: 20px;
		border: 1px solid var(--s-border, #e5e7eb);
		box-shadow: var(--s-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08));
	}

	.ov-header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}

	.client-avatar-placeholder {
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, var(--s-accent, #c9a24f), var(--s-brand, #1a1a2e));
		color: white;
		border-radius: var(--s-radius-lg, 12px);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.ov-client-info {
		flex: 1;
		min-width: 0;
	}

	.ov-client-info h3 {
		margin: 0 !important;
		font-size: 1.1rem !important;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e) !important;
		text-transform: none !important;
		letter-spacing: normal !important;
	}

	.ov-client-info p {
		margin: 2px 0 0;
		color: var(--s-text-secondary, #6b7280);
		font-size: 0.85rem;
	}

	/* Status Badge */
	.status-badge-lg {
		display: inline-flex;
		align-items: center;
		margin-left: auto;
		padding: 5px 12px;
		border-radius: var(--s-radius-full, 20px);
		text-transform: uppercase;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}
	.status-badge-lg.pending {
		background: var(--s-pending-bg, #fff7ed);
		color: var(--s-pending-text, #ea580c);
	}
	.status-badge-lg.confirmed {
		background: var(--s-confirmed-bg, #eff6ff);
		color: var(--s-confirmed-text, #2563eb);
	}
	.status-badge-lg.in-progress {
		background: var(--s-in-progress-bg, #faf5ff);
		color: var(--s-in-progress-text, #9333ea);
	}
	.status-badge-lg.completed {
		background: var(--s-completed-bg, #f0fdf4);
		color: var(--s-completed-text, #16a34a);
	}
	.status-badge-lg.cancelled {
		background: var(--s-cancelled-bg, #fef2f2);
		color: var(--s-cancelled-text, #dc2626);
	}

	/* Date/Time Row */
	.ov-time-row {
		display: flex;
		justify-content: space-around;
		align-items: center;
		background: var(--s-bg-tertiary, #f3f4f6);
		padding: 14px;
		border-radius: var(--s-radius-lg, 12px);
	}

	.ov-time-block {
		text-align: center;
	}

	.ov-label {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--s-text-tertiary, #9ca3af);
		font-weight: 700;
		letter-spacing: 0.06em;
		margin-bottom: 4px;
	}

	.ov-value {
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-weight: 700;
		font-size: 1rem;
		color: var(--s-text-primary, #1a1a2e);
	}

	.ov-divider {
		width: 1px;
		height: 32px;
		background: var(--s-border, #e5e7eb);
	}

	/* Services Section */
	.ov-section h4 {
		margin: 0 0 10px 0;
		text-transform: uppercase;
		font-size: 0.7rem;
		color: var(--s-text-tertiary, #9ca3af);
		letter-spacing: 0.06em;
		font-weight: 700;
	}

	.ov-service-list {
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-lg, 12px);
		overflow: hidden;
	}

	.ov-service-item {
		padding: 14px 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		font-size: 0.95rem;
		color: var(--s-text-primary, #1a1a2e);
	}

	.ov-service-item:last-of-type {
		border-bottom: none;
	}

	.ov-service-item span.price {
		font-weight: 600;
		color: var(--s-text-secondary, #6b7280);
	}

	.ov-total-row {
		padding: 14px 16px;
		display: flex;
		justify-content: space-between;
		background: var(--s-bg-tertiary, #f3f4f6);
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--s-text-primary, #1a1a2e);
		border-top: 2px solid var(--s-border, #e5e7eb);
	}

	.ov-notes {
		background: #fef9c3;
		padding: 14px 16px;
		border-radius: var(--s-radius-lg, 12px);
		color: #92400e;
		font-style: italic;
		font-size: 0.9rem;
		line-height: 1.5;
		margin: 0;
	}

	.ov-notes.ov-notes-empty {
		background: var(--s-bg-tertiary, #f3f4f6);
		color: var(--s-text-tertiary, #9ca3af);
		font-weight: 400;
	}
	:global(.staff-app.dark) .ov-notes.ov-notes-empty {
		background: rgba(255, 255, 255, 0.04);
		color: rgba(255, 255, 255, 0.35);
	}

	/* Payment Section in Overview */
	.ov-payment-card {
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-lg, 12px);
		padding: 14px 16px;
	}

	.ov-payment-row {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ov-payment-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		border-radius: var(--s-radius-full, 20px);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.ov-payment-badge.payment-prepaid {
		background: rgba(16, 185, 129, 0.12);
		color: #059669;
	}
	.ov-payment-badge.payment-token {
		background: rgba(217, 164, 6, 0.12);
		color: #b45309;
	}
	.ov-payment-badge.payment-salon {
		background: rgba(59, 130, 246, 0.1);
		color: #2563eb;
	}

	:global(.staff-app.dark) .ov-payment-badge.payment-prepaid {
		background: rgba(16, 185, 129, 0.15);
		color: #34d399;
	}
	:global(.staff-app.dark) .ov-payment-badge.payment-token {
		background: rgba(217, 164, 6, 0.15);
		color: #fbbf24;
	}
	:global(.staff-app.dark) .ov-payment-badge.payment-salon {
		background: rgba(59, 130, 246, 0.15);
		color: #60a5fa;
	}

	.ov-payment-method {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--s-text-tertiary, #9ca3af);
	}

	.ov-payment-breakdown {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--s-border, #e5e7eb);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.ov-pay-line {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.ov-pay-line.paid {
		color: #059669;
	}
	:global(.staff-app.dark) .ov-pay-line.paid {
		color: #34d399;
	}

	.ov-pay-line.due {
		color: var(--s-error, #ef4444);
	}

	/* ===== EDIT / CREATE FORM ===== */
	.form-section {
		margin-bottom: 20px;
		background: var(--s-surface, white);
		padding: 16px;
		border-radius: var(--s-radius-lg, 12px);
		border: 1px solid var(--s-border, #e5e7eb);
	}

	h3 {
		margin: 0 0 12px 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--s-text-tertiary, #9ca3af);
		font-weight: 700;
		letter-spacing: 0.06em;
	}

	.input-lg {
		font-size: 1.15rem;
		font-weight: 600;
	}

	.form-group {
		margin-bottom: 12px;
	}
	.form-group:last-child {
		margin-bottom: 0;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-md, 10px);
		font-size: 0.95rem;
		background: var(--s-bg, #f8f9fa);
		font-family: inherit;
		color: var(--s-text-primary, #1a1a2e);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: var(--s-accent, #c9a24f);
		box-shadow: 0 0 0 3px var(--s-accent-bg, rgba(201, 162, 79, 0.1));
	}

	textarea {
		resize: vertical;
		min-height: 80px;
	}

	.row {
		display: flex;
		gap: 12px;
	}
	.row .form-group {
		flex: 1;
	}

	/* Services Edit */
	.section-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.total-badge {
		font-size: 0.85rem;
		font-weight: 800;
		background: var(--s-brand, #1a1a2e);
		color: white;
		padding: 4px 12px;
		border-radius: var(--s-radius-full, 20px);
	}

	.service-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.service-item {
		background: var(--s-bg, #f8f9fa);
		padding: 12px;
		border-radius: var(--s-radius-md, 10px);
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		border: 1px solid var(--s-border, #e5e7eb);
	}

	.s-info {
		width: 100%;
	}

	.name-input {
		font-weight: 600;
		padding: 4px 0;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		border: none;
		border-bottom: 1px solid transparent;
		width: 100%;
		margin-bottom: 4px;
	}
	.name-input:focus {
		border-bottom: 1px solid var(--s-accent, #c9a24f);
		box-shadow: none;
	}

	.s-price-edit {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 0.9rem;
		color: var(--s-text-secondary, #6b7280);
	}

	.price-input {
		width: 80px;
		padding: 4px 6px;
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-sm, 6px);
		font-size: 0.9rem;
		box-shadow: none;
	}

	.remove-btn {
		background: var(--s-cancelled-bg, #fee2e2);
		color: var(--s-cancelled, #ef4444);
		border: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-left: 12px;
		cursor: pointer;
		font-size: 1.2rem;
		flex-shrink: 0;
		transition: transform 0.1s ease;
	}
	.remove-btn:active {
		transform: scale(0.85);
	}

	.add-service-row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.service-select {
		flex: 1;
	}

	.confirm-add-btn {
		background: var(--s-brand, #1a1a2e);
		color: white;
		border: none;
		border-radius: var(--s-radius-md, 10px);
		padding: 0 16px;
		font-weight: 600;
		cursor: pointer;
	}

	.text-btn {
		background: none;
		border: none;
		color: var(--s-accent, #c9a24f);
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 8px 0;
		text-align: left;
	}

	.notes-group {
		background: transparent;
		padding: 0;
	}

	/* Footer */
	.modal-footer {
		display: flex;
		gap: 10px;
		padding: 16px 24px;
		padding-bottom: max(80px, calc(env(safe-area-inset-bottom, 16px) + 72px));
		border-top: 1px solid var(--s-border, #e5e7eb);
		flex-shrink: 0;
		background: var(--s-bg, #f8f9fa);
	}

	.status-actions {
		display: flex;
		gap: 10px;
		width: 100%;
	}

	.edit-actions {
		display: flex;
		gap: 10px;
		width: 100%;
	}

	.action-btn {
		flex: 1;
		padding: 14px;
		border-radius: var(--s-radius-lg, 12px);
		font-weight: 700;
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		color: white;
		transition: all var(--s-duration-fast, 0.15s) ease;
	}
	.action-btn:active {
		transform: scale(0.97);
	}

	.action-btn.confirm {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}
	@media (hover: hover) {
		.action-btn.confirm:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
		}
	}
	:global(.staff-app.dark) .action-btn.confirm {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	.action-btn.start {
		background: var(--s-in-progress, #9333ea);
	}
	.action-btn.complete {
		background: var(--s-completed, #16a34a);
	}

	.action-btn.cancel {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
	}
	@media (hover: hover) {
		.action-btn.cancel:hover {
			transform: translateY(-2px);
			box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
		}
	}
	:global(.staff-app.dark) .action-btn.cancel {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}
	.action-btn.outline {
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		color: var(--s-text-primary, #1a1a2e);
	}

	.cancel-btn,
	.save-btn {
		flex: 1;
		padding: 14px;
		border-radius: var(--s-radius-lg, 12px);
		font-weight: 700;
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		transition: all var(--s-duration-fast, 0.15s) ease;
	}
	.cancel-btn:active,
	.save-btn:active {
		transform: scale(0.97);
	}

	.cancel-btn {
		background: var(--s-surface, white);
		color: var(--s-text-primary, #1a1a2e);
		border: 1px solid var(--s-border, #e5e7eb);
	}

	.save-btn {
		background: var(--s-brand, #1a1a2e);
		color: white;
	}

	:global(.staff-app.dark) .save-btn {
		background: var(--s-accent, #c9a24f);
		color: #1a1a2e;
	}

	.save-btn:disabled {
		opacity: 0.6;
	}
</style>

<script lang="ts">
	import { staffServices, createBooking, updateBookingDetails } from '$lib/stores/staffData';
	import { showToast } from '$lib/stores/toast';
	import type { Booking } from '$lib/stores/adminData';

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

	// Initialize form when modal opens or mode changes
	$effect(() => {
		if (isOpen) {
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
			} else {
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
</script>

{#if isOpen}
	<div class="modal-backdrop" onclick={() => (isOpen = false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>{mode === 'create' ? 'New Booking' : 'Edit Order'}</h2>
				<button class="close-btn" onclick={() => (isOpen = false)}>&times;</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="name">Client Name *</label>
					<input type="text" id="name" bind:value={name} placeholder="e.g. John Doe" />
				</div>

				<div class="form-group">
					<label for="phone">Phone (Optional)</label>
					<input type="tel" id="phone" bind:value={phone} placeholder="e.g. 9876543210" />
				</div>

				<div class="row">
					<div class="form-group">
						<label for="date">Date *</label>
						<input type="date" id="date" bind:value={date} />
					</div>
					<div class="form-group">
						<label for="time">Time *</label>
						<input type="time" id="time" bind:value={time} />
					</div>
				</div>

				<div class="form-group">
					<label for="services">Services *</label>

					<!-- Service List -->
					<div class="service-list">
						{#each selectedServices as item, i}
							<div class="service-item">
								<div class="s-info">
									<!-- Editable Name -->
									<input
										type="text"
										bind:value={item.name}
										class="name-input"
										placeholder="Service Name"
									/>
									<!-- Price Edit -->
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
								<button class="remove-btn" onclick={() => removeService(i)}>&times;</button>
							</div>
						{/each}
					</div>

					<!-- Add Service -->
					<div class="add-service-row">
						<select id="service" bind:value={tempServiceId}>
							<option value="" disabled selected>Add from catalog...</option>
							{#each $staffServices as service}
								<option value={service.id}>{service.name} - ₹{service.price}</option>
							{/each}
						</select>
						<button class="add-btn icon" onclick={addService} disabled={!tempServiceId}>+</button>
					</div>
					<button class="add-custom-btn" onclick={addCustomService}>+ Add Custom Service</button>
				</div>

				<div class="total-row">
					<span>Total Amount:</span>
					<span class="total-price">₹{totalAmount}</span>
				</div>

				<div class="form-group">
					<label for="notes">Notes</label>
					<textarea id="notes" bind:value={notes} placeholder="Add special requests or notes..."
					></textarea>
				</div>
			</div>

			<div class="modal-footer">
				<button class="cancel-btn" onclick={() => (isOpen = false)}>Cancel</button>
				<button class="save-btn" onclick={handleSubmit} disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Order'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: flex-end; /* Bottom sheet on mobile */
		z-index: 100;
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
		max-height: 90vh;
		overflow-y: auto;
		animation: slideUp 0.3s ease-out;
	}

	@media (min-width: 768px) {
		.modal-content {
			border-radius: 20px;
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

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-family: 'Outfit', sans-serif;
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

	.form-group {
		margin-bottom: 20px;
	}

	label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
		color: #1c1c1e;
		font-size: 0.9rem;
	}

	input,
	select,
	textarea {
		width: 100%;
		padding: 12px;
		border: 1px solid #e5e5ea;
		border-radius: 12px;
		font-size: 1rem;
		background: #f9f9f9;
		font-family: inherit;
	}

	textarea {
		resize: vertical;
		min-height: 80px;
	}

	.row {
		display: flex;
		gap: 16px;
	}

	.row .form-group {
		flex: 1;
	}

	/* Service List Styles */
	.service-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.service-item {
		background: #f2f2f7;
		padding: 10px;
		border-radius: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.s-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}

	.name-input {
		font-weight: 500;
		font-size: 0.95rem;
		border: 1px solid transparent;
		background: transparent;
		padding: 4px 0;
		width: 100%;
	}
	.name-input:focus {
		border-bottom: 1px solid #007aff;
		background: white;
		border-radius: 4px;
		padding: 4px 8px;
		outline: none;
	}

	.s-price-edit {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 0.9rem;
		color: #3a3a3c;
	}

	.price-input {
		width: 80px;
		padding: 4px 8px;
		border: 1px solid #d1d1d6;
		border-radius: 6px;
		font-size: 0.9rem;
		background: white;
	}

	.remove-btn {
		background: #ff3b30;
		color: white;
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
		line-height: 1;
		flex-shrink: 0;
	}

	.add-service-row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
	}

	.add-btn {
		padding: 0 16px;
		background: #000;
		color: white;
		border: none;
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.add-btn.icon {
		font-size: 1.5rem;
		line-height: 1;
		padding: 0;
		width: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.add-custom-btn {
		width: 100%;
		padding: 10px;
		background: #f2f2f7;
		color: #007aff;
		font-weight: 600;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 1.1rem;
		font-weight: 600;
		padding: 12px 0;
		border-top: 1px solid #e5e5ea;
		border-bottom: 1px solid #e5e5ea;
		margin-bottom: 20px;
	}

	.total-price {
		font-family: 'Outfit', sans-serif;
	}

	.modal-footer {
		display: flex;
		gap: 12px;
		margin-top: 12px;
	}

	.cancel-btn,
	.save-btn {
		flex: 1;
		padding: 14px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 1rem;
		border: none;
		cursor: pointer;
	}

	.cancel-btn {
		background: #f2f2f7;
		color: #1c1c1e;
	}

	.save-btn {
		background: #000;
		color: white;
	}

	.save-btn:disabled {
		opacity: 0.7;
	}
</style>

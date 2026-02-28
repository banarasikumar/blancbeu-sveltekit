<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus, updateBookingDetails } from '$lib/stores/adminData';
	import { completeTimer } from '$lib/stores/serviceTimer';
	import { showToast } from '$lib/stores/toast';
	import { generateAndShareInvoice, startWhatsAppChat } from '$lib/utils/invoice';
	import SwipeButton from '$lib/components/staff/SwipeButton.svelte';

	// The booking ID from the URL
	let bookingId = $derived(page.params.id);

	// Original booking data
	let originalBooking = $derived($staffBookings.find((b) => b.id === bookingId));

	// Local state for editing
	let services = $state<any[]>([]);
	let couponCode = $state('');
	let discountAmount = $state<number>(0);
	let extraCharge = $state<number>(0);

	// Init initial state when booking loads
	$effect(() => {
		if (originalBooking && services.length === 0) {
			if (originalBooking.servicesList && originalBooking.servicesList.length > 0) {
				services = JSON.parse(JSON.stringify(originalBooking.servicesList));
			} else {
				// Fallback if it's an old booking with only serviceName/price
				services = [
					{
						id: 'default',
						name: originalBooking.serviceName || 'Standard Service',
						price: originalBooking.price || originalBooking.totalAmount || 0,
						duration: 30
					}
				];
			}
		}
	});

	// Totals calculation
	let subtotal = $derived(services.reduce((sum, s) => sum + (Number(s.price) || 0), 0));
	let totalAmount = $derived(Math.max(0, subtotal + Number(extraCharge) - Number(discountAmount)));

	// Form states
	let newServiceName = $state('');
	let newServicePrice = $state('');
	let isGenerating = $state(false);
	let isChatting = $state(false);
	let isCompleting = $state(false);

	let isEditing = $state(false);
	let isCompleted = $derived(originalBooking?.status === 'completed');
	let canEdit = $derived(!isCompleted || isEditing);

	function addService() {
		if (!newServiceName) return;
		services = [
			...services,
			{
				id: 'custom_' + Date.now(),
				name: newServiceName,
				price: Number(newServicePrice) || 0,
				duration: 30, // Default duration
				isCustom: true
			}
		];
		newServiceName = '';
		newServicePrice = '';
	}

	function removeService(index: number) {
		services = services.filter((_, i) => i !== index);
	}

	// Complete the booking — save data + mark as completed
	async function handleCompleteBooking() {
		if (!originalBooking) return;
		try {
			isCompleting = true;

			const updatedData = {
				servicesList: services,
				totalAmount: totalAmount,
				discountAmount: discountAmount,
				extraCharge: extraCharge,
				couponCode: couponCode || null
			};
			await updateBookingDetails(originalBooking.id, updatedData);
			await completeTimer(originalBooking);

			showToast('Booking completed!', 'success');
		} catch (error) {
			console.error('Error completing booking:', error);
			showToast('Error completing booking.', 'error');
		} finally {
			isCompleting = false;
		}
	}

	async function handleSaveChanges() {
		if (!originalBooking) return;
		try {
			isCompleting = true;

			const updatedData = {
				servicesList: services,
				totalAmount: totalAmount,
				discountAmount: discountAmount,
				extraCharge: extraCharge,
				couponCode: couponCode || null
			};
			await updateBookingDetails(originalBooking.id, updatedData);

			showToast('Changes saved!', 'success');
			isEditing = false;
		} catch (error) {
			console.error('Error saving changes:', error);
			showToast('Error saving changes.', 'error');
		} finally {
			isCompleting = false;
		}
	}

	// Start WhatsApp chat with predefined text (for completed bookings)
	function handleStartChat() {
		if (!originalBooking) return;
		startWhatsAppChat({
			booking: originalBooking,
			services,
			totalAmount,
			discountAmount,
			extraCharge
		});
	}

	// Generate invoice PDF & open share sheet (for completed bookings)
	async function handleSendInvoice() {
		if (!originalBooking) return;
		try {
			isGenerating = true;

			await generateAndShareInvoice({
				booking: originalBooking,
				services,
				totalAmount,
				discountAmount,
				extraCharge,
				couponCode
			});

			showToast('Invoice generated!', 'success');
		} catch (error) {
			console.error('Error generating invoice:', error);
			showToast('Error generating invoice.', 'error');
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if !originalBooking}
	<div class="loading-state">
		<p>Loading booking details...</p>
		<button class="s-btn s-btn-outline" onclick={() => goto('/staff/dashboard')}
			>Back to Dashboard</button
		>
	</div>
{:else}
	<div class="summary-page s-stagger">
		<!-- HEADER -->
		<div class="summary-header">
			<button class="back-btn" onclick={() => goto('/staff/dashboard')}>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
			</button>
			<h1 class="page-title">Booking & Services Summary</h1>
			<div class="header-actions">
				{#if isCompleted && !isEditing}
					<button class="edit-btn" onclick={() => (isEditing = true)} title="Edit Booking">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
						</svg>
					</button>
				{:else if isEditing}
					<button class="cancel-btn" onclick={() => (isEditing = false)} title="Cancel">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				{:else}
					<div class="spacer"></div>
				{/if}
			</div>
		</div>

		<!-- CLIENT & INFO -->
		<section class="info-card s-card">
			<div class="info-row">
				<div class="info-avatar">{originalBooking.userName?.[0]?.toUpperCase() || 'C'}</div>
				<div class="info-details">
					<h2>{originalBooking.userName || 'Guest Client'}</h2>
					{#if originalBooking.userPhone}<p>📞 {originalBooking.userPhone}</p>{/if}
				</div>
				<div class="info-meta">
					<div class="meta-badge">{originalBooking.date || 'Today'}</div>
					<div class="meta-badge">{originalBooking.time || 'Now'}</div>
				</div>
			</div>
		</section>

		<!-- SERVICES EDIT -->
		<section class="services-edit s-card" class:readonly-mode={!canEdit}>
			<div class="section-header">
				<h3>Services Output</h3>
			</div>

			<div class="services-list">
				{#each services as service, index}
					<div class="service-item">
						<div class="service-info">
							<input
								type="text"
								class="s-input inline-edit title"
								bind:value={service.name}
								placeholder="Service Name"
								readonly={!canEdit}
							/>
						</div>
						<div class="service-price">
							<span class="currency">₹</span>
							<input
								type="number"
								class="s-input inline-edit price"
								bind:value={service.price}
								placeholder="0"
								readonly={!canEdit}
							/>
							{#if canEdit}
								<button
									class="remove-btn"
									onclick={() => removeService(index)}
									title="Remove Service">✕</button
								>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			{#if canEdit}
				<div class="add-service-row">
					<input
						type="text"
						class="s-input"
						bind:value={newServiceName}
						placeholder="New Service Name..."
					/>
					<input
						type="number"
						class="s-input"
						bind:value={newServicePrice}
						placeholder="Price"
						style="width: 100px;"
					/>
					<button class="s-btn s-btn-outline" onclick={addService}>+ Add</button>
				</div>
			{/if}
		</section>

		<!-- DISCOUNTS & EXTRAS -->
		<section class="financials s-card" class:readonly-mode={!canEdit}>
			<div class="section-header">
				<h3>Offers & Adjustments</h3>
			</div>

			<div class="fin-grid">
				<div class="fin-item">
					<label>Coupon Code</label>
					<input
						type="text"
						class="s-input"
						bind:value={couponCode}
						placeholder="e.g. SAVE20"
						readonly={!canEdit}
					/>
				</div>

				<div class="fin-item">
					<label>Extra Discount (₹)</label>
					<input
						type="number"
						class="s-input"
						bind:value={discountAmount}
						placeholder="0"
						readonly={!canEdit}
					/>
				</div>

				<div class="fin-item">
					<label>Extra Charges (₹)</label>
					<input
						type="number"
						class="s-input"
						bind:value={extraCharge}
						placeholder="0"
						readonly={!canEdit}
					/>
				</div>
			</div>
		</section>

		<!-- SUMMARY TOTAL -->
		<section class="total-section s-card highlight">
			<div class="ts-row">
				<span>Subtotal</span>
				<span>₹{subtotal}</span>
			</div>
			{#if extraCharge > 0}
				<div class="ts-row ts-add">
					<span>Extra Charges</span>
					<span>+ ₹{extraCharge}</span>
				</div>
			{/if}
			{#if discountAmount > 0}
				<div class="ts-row ts-sub">
					<span>Discount</span>
					<span>- ₹{discountAmount}</span>
				</div>
			{/if}
			<div class="ts-divider"></div>
			<div class="ts-row ts-grand">
				<span>Grand Total</span>
				<span>₹{totalAmount}</span>
			</div>
		</section>

		<!-- ACTION BUTTONS -->
		<div class="bottom-actions">
			{#if !isCompleted}
				<!-- Not yet completed — show Complete Booking button -->
				<div class="swipe-wrapper">
					<SwipeButton
						onSwipe={handleCompleteBooking}
						text="Swipe to complete ➔"
						successText="Completing..."
						disabled={services.length === 0}
						isWorking={isCompleting}
					/>
				</div>
			{:else if isEditing}
				<div class="action-row">
					<button
						class="s-btn s-btn-lg action-btn"
						style="width: 100%; background: var(--s-accent); color: white;"
						onclick={handleSaveChanges}
						disabled={isCompleting}
					>
						{#if isCompleting}
							Saving...
						{:else}
							Save Changes
						{/if}
					</button>
				</div>
			{:else}
				<!-- Already completed — show Start Chat + Send Invoice -->
				<div class="action-row">
					<button class="s-btn s-btn-lg action-btn chat-btn" onclick={handleStartChat}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
							/>
						</svg>
						Start Chat
					</button>
					<button
						class="s-btn s-btn-lg action-btn invoice-btn"
						onclick={handleSendInvoice}
						disabled={isGenerating}
					>
						{#if isGenerating}
							<span class="spinner"></span> Generating...
						{:else}
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
								<line x1="16" y1="13" x2="8" y2="13" />
								<line x1="16" y1="17" x2="8" y2="17" />
							</svg>
							Send Invoice
						{/if}
					</button>
				</div>
			{/if}
		</div>

		<!-- GENERATING OVERLAY -->
		{#if isGenerating}
			<div class="generating-overlay">
				<div class="generating-card">
					<div class="generating-spinner"></div>
					<p class="generating-text">Generating Invoice...</p>
					<p class="generating-hint">Please wait a moment</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		gap: var(--s-space-lg);
		color: var(--s-text-secondary);
	}

	.summary-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
		padding-bottom: calc(var(--s-nav-height, 68px) + 100px); /* Space for bottom action + nav */
	}

	.summary-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--s-space-sm);
	}

	.back-btn {
		background: none;
		border: none;
		color: var(--s-text-primary);
		padding: 8px;
		margin-left: -8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--s-radius-full);
	}

	.back-btn:active {
		background: var(--s-bg-tertiary);
	}

	.page-title {
		font-family: var(--s-font-display);
		font-size: var(--s-text-xl);
		font-weight: 700;
		margin: 0;
	}

	.spacer {
		width: 40px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		min-width: 40px;
		justify-content: flex-end;
	}

	.edit-btn,
	.cancel-btn {
		background: none;
		border: none;
		color: var(--s-text-primary);
		padding: 8px;
		margin-right: -8px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--s-radius-full);
	}

	.edit-btn:active,
	.cancel-btn:active {
		background: var(--s-bg-tertiary);
	}

	.cancel-btn {
		color: var(--s-error);
	}

	/* Readonly states */
	.readonly-mode .s-input {
		background: transparent;
		border-color: transparent;
		color: var(--s-text-primary);
		pointer-events: none;
	}

	.readonly-mode .s-input:focus {
		box-shadow: none;
	}

	.readonly-mode .fin-item .s-input {
		font-weight: 600;
	}

	.section-header h3 {
		font-family: var(--s-font-display);
		font-size: var(--s-text-lg);
		font-weight: 600;
		margin: 0 0 var(--s-space-md) 0;
	}

	/* Info Card */
	.info-card {
		padding: var(--s-space-lg);
	}

	.info-row {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
	}

	.info-avatar {
		width: 48px;
		height: 48px;
		background: linear-gradient(135deg, var(--s-accent), var(--s-accent-dark, #b08d4f));
		color: white;
		border-radius: var(--s-radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		font-weight: 700;
	}

	.info-details {
		flex: 1;
	}

	.info-details h2 {
		margin: 0 0 4px;
		font-size: var(--s-text-lg);
		font-weight: 700;
	}

	.info-details p {
		margin: 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
	}

	.info-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: flex-end;
	}

	.meta-badge {
		background: var(--s-bg-tertiary);
		padding: 4px 10px;
		border-radius: var(--s-radius-full);
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	/* Services Edit */
	.services-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
		margin-bottom: var(--s-space-md);
	}

	.service-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-space-md);
		padding: var(--s-space-sm);
		background: var(--s-bg-tertiary);
		border-radius: var(--s-radius-md);
		border: 1px solid transparent;
		transition: border-color var(--s-duration-fast) var(--s-ease);
	}

	.service-item:focus-within {
		border-color: var(--s-accent);
		background: var(--s-surface);
	}

	.service-info {
		flex: 1;
	}

	.service-price {
		display: flex;
		align-items: center;
		gap: var(--s-space-xs);
	}

	.currency {
		color: var(--s-text-secondary);
		font-weight: 600;
	}

	.inline-edit {
		background: transparent;
		border: none;
		padding: 4px;
		font-size: var(--s-text-base);
		font-weight: 500;
		color: var(--s-text-primary);
		width: 100%;
	}

	.inline-edit.title {
		font-weight: 600;
	}

	.inline-edit.price {
		width: 80px;
		text-align: right;
		font-family: monospace;
	}

	.remove-btn {
		background: none;
		border: none;
		color: var(--s-error);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0.7;
		transition: opacity var(--s-duration-fast);
	}

	.remove-btn:hover {
		opacity: 1;
		background: var(--s-error-bg, rgba(255, 50, 50, 0.1));
	}

	.add-service-row {
		display: flex;
		gap: var(--s-space-sm);
		align-items: center;
		border-top: 1px dashed var(--s-border);
		padding-top: var(--s-space-md);
	}

	/* Financials */
	.fin-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--s-space-md);
	}

	.fin-item label {
		display: block;
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-secondary);
		margin-bottom: 6px;
	}

	/* Total Section */
	.total-section {
		border: 2px solid var(--s-accent);
		padding: var(--s-space-lg);
	}

	.ts-row {
		display: flex;
		justify-content: space-between;
		font-size: var(--s-text-base);
		font-weight: 500;
		margin-bottom: var(--s-space-xs);
		color: var(--s-text-secondary);
	}

	.ts-add {
		color: var(--s-text-primary);
	}

	.ts-sub {
		color: var(--s-success, #2e7d32);
	}

	.ts-divider {
		height: 1px;
		background: var(--s-border);
		margin: var(--s-space-md) 0;
	}

	.ts-grand {
		font-size: var(--s-text-xl);
		font-weight: 800;
		color: var(--s-text-primary);
		margin-bottom: 0;
	}

	.bottom-actions {
		position: fixed;
		bottom: var(--s-nav-height, 68px);
		left: 0;
		right: 0;
		padding: var(--s-space-md);
		background: var(--s-surface);
		border-top: 1px solid var(--s-border);
		box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
		z-index: 100;
	}

	.swipe-wrapper {
		width: 100%;
		max-width: 400px;
		margin: 0 auto;
	}

	.action-row {
		display: flex;
		gap: var(--s-space-sm);
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 12px;
		font-size: var(--s-text-base);
		font-weight: 600;
		border-radius: var(--s-radius-lg);
		border: none;
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
	}

	.chat-btn {
		background: #25d366;
		color: white;
	}

	.chat-btn:active {
		background: #1da851;
		transform: scale(0.97);
	}

	.chat-btn:disabled {
		background: #a0d8b4;
		cursor: not-allowed;
	}

	.invoice-btn {
		background: var(--s-accent, #c8956c);
		color: white;
	}

	.invoice-btn:active {
		filter: brightness(0.9);
		transform: scale(0.97);
	}

	.invoice-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top-color: white;
		animation: s-spin 1s ease-in-out infinite;
	}

	/* Generating Overlay */
	.generating-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
		animation: fadeIn 0.2s ease;
	}

	.generating-card {
		background: var(--s-surface, white);
		border-radius: var(--s-radius-2xl, 20px);
		padding: 32px 40px;
		text-align: center;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
	}

	.generating-spinner {
		width: 44px;
		height: 44px;
		border: 3px solid var(--s-border, #e5e7eb);
		border-top-color: var(--s-accent, #c8956c);
		border-radius: 50%;
		margin: 0 auto 16px;
		animation: s-spin 0.8s linear infinite;
	}

	.generating-text {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e);
	}

	.generating-hint {
		margin: 6px 0 0;
		font-size: 0.85rem;
		color: var(--s-text-tertiary, #9ca3af);
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>

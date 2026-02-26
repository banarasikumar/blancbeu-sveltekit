<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus, updateBookingDetails } from '$lib/stores/adminData';
	import { completeTimer } from '$lib/stores/serviceTimer';
	import { showToast } from '$lib/stores/toast';
	import { generateAndSendInvoice } from '$lib/utils/invoice';

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

	async function finalizeAndGenerateInvoice() {
		if (!originalBooking) return;
		try {
			isGenerating = true;

			// 1. Update booking details in backend
			const updatedData = {
				servicesList: services,
				totalAmount: totalAmount,
				discountAmount: discountAmount,
				extraCharge: extraCharge,
				couponCode: couponCode || null
			};
			await updateBookingDetails(originalBooking.id, updatedData);

			// 2. Mark as completed & stop timer
			// completeTimer handles both the serviceTimer doc and the booking status update implicitly
			await completeTimer(originalBooking);

			// 3. Generate PDF & WhatsApp Sharing
			await generateAndSendInvoice({
				booking: originalBooking,
				services,
				totalAmount,
				discountAmount,
				extraCharge,
				couponCode
			});

			showToast('Service completed and invoice generated!', 'success');

			// Go back to dashboard
			goto('/staff/dashboard');
		} catch (error) {
			console.error('Error generating invoice:', error);
			showToast('Error finalizing the service.', 'error');
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
			<div class="spacer"></div>
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
		<section class="services-edit s-card">
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
							/>
						</div>
						<div class="service-price">
							<span class="currency">₹</span>
							<input
								type="number"
								class="s-input inline-edit price"
								bind:value={service.price}
								placeholder="0"
							/>
							<button class="remove-btn" onclick={() => removeService(index)} title="Remove Service"
								>✕</button
							>
						</div>
					</div>
				{/each}
			</div>

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
		</section>

		<!-- DISCOUNTS & EXTRAS -->
		<section class="financials s-card">
			<div class="section-header">
				<h3>Offers & Adjustments</h3>
			</div>

			<div class="fin-grid">
				<div class="fin-item">
					<label>Coupon Code</label>
					<input type="text" class="s-input" bind:value={couponCode} placeholder="e.g. SAVE20" />
				</div>

				<div class="fin-item">
					<label>Extra Discount (₹)</label>
					<input type="number" class="s-input" bind:value={discountAmount} placeholder="0" />
				</div>

				<div class="fin-item">
					<label>Extra Charges (₹)</label>
					<input type="number" class="s-input" bind:value={extraCharge} placeholder="0" />
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
			<button
				class="s-btn s-btn-lg s-btn-success generate-btn"
				onclick={finalizeAndGenerateInvoice}
				disabled={isGenerating || services.length === 0}
			>
				{#if isGenerating}
					<span class="spinner"></span> Processing...
				{:else if originalBooking?.status === 'completed'}
					✓ Regenerate Invoice & Send
				{:else}
					✓ Complete & Send Invoice
				{/if}
			</button>
		</div>
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

	.generate-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--s-space-sm);
		padding: 16px;
		font-size: var(--s-text-lg);
		box-shadow: var(--s-shadow-glow);
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
</style>

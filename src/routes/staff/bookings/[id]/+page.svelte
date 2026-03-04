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

		// Initialize QR fields from DB if they exist and local states are currently null
		if (originalBooking) {
			if (qrAdjustedAmount === null && originalBooking.qrAdjustedAmount !== undefined)
				qrAdjustedAmount = originalBooking.qrAdjustedAmount;
			if (qrOnlineAmount === null && originalBooking.qrOnlineAmount !== undefined)
				qrOnlineAmount = originalBooking.qrOnlineAmount;
			if (qrCashAmount === null && originalBooking.qrCashAmount !== undefined)
				qrCashAmount = originalBooking.qrCashAmount;
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

	// QR Code state
	let showQrModal = $state(false);
	let qrCodeDataUrl = $state('');
	let isGeneratingQr = $state(false);
	let qrAdjustedAmount = $state<number | null>(null);
	let qrOnlineAmount = $state<number | null>(null);
	let qrCashAmount = $state<number | null>(null);
	let isPaymentConfirmed = $state(false); // Checkbox state
	let payBtnShaking = $state(false); // Shake animation for checkbox row
	let qrDisplayAmount = $derived(qrAdjustedAmount !== null ? qrAdjustedAmount : totalAmount);

	// Edit modal state
	let showEditModal = $state(false);
	let editOnlineAmount = $state<number | null>(null);
	let editCashAmount = $state<number | null>(null);
	let editAdjustedAmount = $state<number | null>(null);
	let editAdjustedBill = $state<number | null>(null);
	// Track which field was last edited (to protect it from auto-fill)
	let lastEditedSplit = $state<'online' | 'cash' | null>(null);
	let lastEditedAdj = $state<'amount' | 'bill' | null>(null);

	// Mark-as-Paid modal state
	let showPayModal = $state(false);
	let payConfirmed = $state(false);
	let payModalShaking = $state(false);

	let initialPayState = $state({
		online: 0 as number | null,
		cash: 0 as number | null,
		adjAmt: 0 as number | null,
		adjBill: 0 as number | null
	});

	let actionInitialized = $state(false);
	$effect(() => {
		const action = page.url.searchParams.get('action');
		if (action && !actionInitialized && originalBooking) {
			actionInitialized = true;
			// Replace state to remove the query param so it doesn't re-trigger on refresh
			const url = new URL(page.url);
			url.searchParams.delete('action');
			goto(url, { replaceState: true, keepFocus: true });

			if (action === 'qr') {
				handleShowQR();
			} else if (action === 'pay') {
				openPayModal();
			}
		}
	});

	let isPaymentEdited = $derived(
		showPayModal &&
			(editOnlineAmount !== initialPayState.online ||
				editCashAmount !== initialPayState.cash ||
				editAdjustedBill !== initialPayState.adjBill ||
				editAdjustedAmount !== initialPayState.adjAmt)
	);

	function openEditModal() {
		editAdjustedBill = qrAdjustedAmount !== null ? qrAdjustedAmount : totalAmount;
		editAdjustedAmount = Math.max(0, totalAmount - editAdjustedBill);

		editOnlineAmount = qrOnlineAmount !== null ? qrOnlineAmount : editAdjustedBill;
		editCashAmount = qrCashAmount !== null ? qrCashAmount : 0;

		lastEditedSplit = null;
		lastEditedAdj = null;
		showEditModal = true;
	}

	function openPayModal() {
		editAdjustedBill = qrAdjustedAmount !== null ? qrAdjustedAmount : totalAmount;
		editAdjustedAmount =
			qrAdjustedAmount !== null ? Math.max(0, totalAmount - qrAdjustedAmount) : 0;
		editOnlineAmount = qrOnlineAmount !== null ? qrOnlineAmount : editAdjustedBill;
		editCashAmount = qrCashAmount !== null ? qrCashAmount : 0;

		initialPayState = {
			online: editOnlineAmount,
			cash: editCashAmount,
			adjAmt: editAdjustedAmount,
			adjBill: editAdjustedBill
		};

		lastEditedSplit = null;
		lastEditedAdj = null;
		payConfirmed = false;
		showPayModal = true;
	}

	function handleUpdatePayment() {
		syncPaymentSplitToDB();
		// Update initial state to match current, so buttons flip back
		initialPayState = {
			online: editOnlineAmount,
			cash: editCashAmount,
			adjAmt: editAdjustedAmount,
			adjBill: editAdjustedBill
		};
		showToast('Payment updated!', 'success');
	}

	function handleCancelPayment() {
		// Revert to initial values
		editOnlineAmount = initialPayState.online;
		editCashAmount = initialPayState.cash;
		editAdjustedBill = initialPayState.adjBill;
		editAdjustedAmount = initialPayState.adjAmt;
		syncPaymentSplitToDB();
	}

	/** Persist current split/adjustment values to the DB (fire-and-forget). */
	function syncPaymentSplitToDB() {
		if (!originalBooking) return;
		const totalBillAfterAdj = editAdjustedBill ?? totalAmount;
		const adjAmount = totalBillAfterAdj !== totalAmount ? totalBillAfterAdj : null;
		// Update local reactive state so the booking summary behind reflects changes
		qrAdjustedAmount = adjAmount;
		qrOnlineAmount = editOnlineAmount;
		qrCashAmount = editCashAmount;
		updateBookingDetails(originalBooking.id, {
			qrAdjustedAmount: adjAmount,
			qrOnlineAmount: editOnlineAmount,
			qrCashAmount: editCashAmount
		}).catch(console.error);
	}

	async function applyPayModal() {
		if (!payConfirmed) {
			payModalShaking = true;
			setTimeout(() => (payModalShaking = false), 500);
			return;
		}
		const totalBillAfterAdj = editAdjustedBill ?? totalAmount;
		qrAdjustedAmount = totalBillAfterAdj !== totalAmount ? totalBillAfterAdj : null;
		qrOnlineAmount = editOnlineAmount;
		qrCashAmount = editCashAmount;
		showPayModal = false;
		const paidAmount = qrAdjustedAmount ?? totalAmount;
		if (originalBooking) {
			try {
				await updateBookingDetails(originalBooking.id, {
					qrAdjustedAmount,
					qrOnlineAmount,
					qrCashAmount,
					payment: {
						type: 'manual',
						method: 'upi_or_cash',
						amount: paidAmount,
						status: 'paid'
					}
				});
				showToast('Marked as paid!', 'success');
			} catch (error) {
				console.error('Error marking as paid:', error);
				showToast('Failed to update payment status.', 'error');
			}
		}
	}

	function handlePayClick() {
		if (!isPaymentConfirmed) {
			payBtnShaking = true;
			setTimeout(() => (payBtnShaking = false), 500);
			return;
		}
		handleMarkAsPaid(qrDisplayAmount);
	}

	function onOnlineInput(e: Event) {
		const val = Number((e.target as HTMLInputElement).value);
		editOnlineAmount = isNaN(val) ? null : val;
		lastEditedSplit = 'online';
		// Only auto-fill cash if cash was not the last edited field
		if (lastEditedSplit !== 'cash' && editOnlineAmount !== null) {
			editCashAmount = Math.max(0, totalAmount - editOnlineAmount);
		}
	}

	function onCashInput(e: Event) {
		const val = Number((e.target as HTMLInputElement).value);
		editCashAmount = isNaN(val) ? null : val;
		lastEditedSplit = 'cash';
		// Only auto-fill online if online was not the last edited field
		if (lastEditedSplit !== 'online' && editCashAmount !== null) {
			editOnlineAmount = Math.max(0, totalAmount - editCashAmount);
		}
	}

	function onAdjustedAmountInput(e: Event) {
		const val = Number((e.target as HTMLInputElement).value);
		editAdjustedAmount = isNaN(val) ? null : val;
		lastEditedAdj = 'amount';
		if (editAdjustedAmount !== null) {
			editAdjustedBill = Math.max(0, totalAmount - editAdjustedAmount);
			updateSplitFromAdj(editAdjustedBill);
		}
	}

	function onAdjustedBillInput(e: Event) {
		const val = Number((e.target as HTMLInputElement).value);
		editAdjustedBill = isNaN(val) ? null : val;
		lastEditedAdj = 'bill';
		if (editAdjustedBill !== null) {
			editAdjustedAmount = Math.max(0, totalAmount - editAdjustedBill);
			updateSplitFromAdj(editAdjustedBill);
		}
	}

	function updateSplitFromAdj(newBill: number) {
		if (lastEditedSplit === 'online' && editOnlineAmount !== null) {
			editCashAmount = Math.max(0, newBill - editOnlineAmount);
		} else if (lastEditedSplit === 'cash' && editCashAmount !== null) {
			editOnlineAmount = Math.max(0, newBill - editCashAmount);
		} else {
			// If nothing locked, initialize: online = newBill, cash = 0
			editOnlineAmount = newBill;
			editCashAmount = 0;
		}
	}

	async function applyEditModal() {
		const totalBillAfterAdj = editAdjustedBill ?? totalAmount;
		const qrGenerationAmount = editOnlineAmount !== null ? editOnlineAmount : totalBillAfterAdj;

		qrAdjustedAmount = totalBillAfterAdj !== totalAmount ? totalBillAfterAdj : null;
		qrOnlineAmount = editOnlineAmount;
		qrCashAmount = editCashAmount;
		showEditModal = false;

		// Sync to DB immediately
		if (originalBooking) {
			updateBookingDetails(originalBooking.id, {
				qrAdjustedAmount,
				qrOnlineAmount,
				qrCashAmount
			}).catch(console.error);
		}

		try {
			isGeneratingQr = true;
			await generateQrForAmount(qrGenerationAmount);
		} catch (error) {
			console.error('Error regenerating QR:', error);
			showToast('Error updating QR code.', 'error');
		} finally {
			isGeneratingQr = false;
		}
	}

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
				couponCode,
				paymentStatus: originalBooking.payment?.status === 'paid' ? 'paid' : 'unpaid'
			});

			showToast('Invoice generated!', 'success');
		} catch (error) {
			console.error('Error generating invoice:', error);
			showToast('Error generating invoice.', 'error');
		} finally {
			isGenerating = false;
		}
	}

	async function generateQrForAmount(amount: number) {
		const QRCode = (await import('qrcode')).default;
		const invoiceNum = `INV-${String(bookingId).slice(0, 8).toUpperCase()}`;
		const upiUri = `upi://pay?pa=Q714475106@ybl&pn=BlancBeu Beauty Salon&mc=0000&mode=02&purpose=00&am=${amount}&cu=INR&tn=${invoiceNum}`;

		qrCodeDataUrl = await QRCode.toDataURL(upiUri, {
			width: 300,
			margin: 1,
			color: { dark: '#1a1a2e', light: '#FFFFFF' }
		});
	}

	async function handleShowQR() {
		try {
			isGeneratingQr = true;
			showQrModal = true;
			qrAdjustedAmount = null;
			qrOnlineAmount = null;
			qrCashAmount = null;
			isPaymentConfirmed = false;

			await generateQrForAmount(totalAmount);
		} catch (error) {
			console.error('Error generating QR:', error);
			showToast('Error generating QR code.', 'error');
			showQrModal = false;
		} finally {
			isGeneratingQr = false;
		}
	}

	async function handleMarkAsPaid(amount?: number) {
		if (!originalBooking) return;
		const paidAmount = amount ?? totalAmount;
		try {
			await updateBookingDetails(originalBooking.id, {
				payment: {
					type: 'manual',
					method: 'upi_or_cash',
					amount: paidAmount,
					status: 'paid'
				}
			});
			showToast('Marked as paid!', 'success');
			showQrModal = false;
		} catch (error) {
			console.error('Error marking as paid:', error);
			showToast('Failed to update payment status.', 'error');
		}
	}

	function handleShowQRFromPayModal() {
		syncPaymentSplitToDB();
		showPayModal = false;
		handleShowQR();
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
			<div class="title-row">
				<h1 class="page-title">Booking & Services Summary</h1>
				{#if isCompleted}
					{#if originalBooking.payment?.status === 'paid'}
						<span class="pay-status-badge paid">✓ Paid</span>
					{:else}
						<span class="pay-status-badge unpaid">Unpaid</span>
					{/if}
				{/if}
			</div>
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

			{#if qrAdjustedAmount !== null && qrAdjustedAmount !== totalAmount}
				<div class="ts-row ts-sub">
					<span>QR Adjustment</span>
					<span
						>{qrAdjustedAmount < totalAmount ? '-' : '+'} ₹{Math.abs(
							totalAmount - qrAdjustedAmount
						)}</span
					>
				</div>
			{/if}

			{#if qrOnlineAmount !== null && qrCashAmount !== null && (qrOnlineAmount > 0 || qrCashAmount > 0)}
				<div class="ts-row ts-split-bg">
					<span>Payment Split</span>
					<span class="split-bg">Online ₹{qrOnlineAmount} &bull; Cash ₹{qrCashAmount}</span>
				</div>
			{/if}

			<div class="ts-divider"></div>

			{#if qrAdjustedAmount !== null && qrAdjustedAmount !== totalAmount}
				<div class="ts-row ts-grand">
					<span>Final Payable</span>
					<span>₹{qrAdjustedAmount}</span>
				</div>
			{:else}
				<div class="ts-row ts-grand">
					<span>Grand Total</span>
					<span>₹{totalAmount}</span>
				</div>
			{/if}
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
				<!-- Already completed — show Payment Actions only (Hiding Chat/Invoice as requested) -->
				<div class="action-column">
					<div class="action-row">
						<button class="s-btn s-btn-lg action-btn qr-btn" onclick={handleShowQR}>
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
								<rect x="3" y="3" width="7" height="7"></rect>
								<rect x="14" y="3" width="7" height="7"></rect>
								<rect x="14" y="14" width="7" height="7"></rect>
								<rect x="3" y="14" width="7" height="7"></rect>
							</svg>
							Show QR
						</button>
						<button class="s-btn s-btn-lg action-btn pay-btn" onclick={openPayModal}>
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
								<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
							</svg>
							Mark as Paid
						</button>
					</div>
					<div class="action-row mt-2">
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

		<!-- FULLSCREEN QR PAYMENT -->
		{#if showQrModal}
			<div class="qr-fullscreen">
				<!-- Top bar -->
				<div class="qr-fs-topbar">
					<button class="qr-fs-back" onclick={() => (showQrModal = false)}>
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
					<h2 class="qr-fs-title">Scan to Pay</h2>
					<div class="qr-fs-spacer"></div>
				</div>

				<!-- Body -->
				<div class="qr-fs-body">
					{#if isGeneratingQr}
						<div class="qr-loading">
							<div class="spinner"></div>
							<p>Generating QR Code...</p>
						</div>
					{:else if qrCodeDataUrl}
						<!-- Amount Section Moved Above QR Image -->
						<div class="qr-fs-amount-section">
							<div class="qr-fs-amount-display">
								<div class="qr-fs-amount-row">
									<span class="qr-fs-currency">₹</span>
									{#if qrOnlineAmount !== null}
										<span class="qr-fs-amount">{qrOnlineAmount}</span>
									{:else}
										<span class="qr-fs-amount">{qrDisplayAmount}</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- QR Image -->
						<div class="qr-fs-image-wrap">
							<img src={qrCodeDataUrl} alt="Payment QR Code" class="qr-fs-image" />
						</div>

						<!-- UPI Info -->
						<div class="qr-fs-upi-container">
							<div class="qr-fs-upi">
								<span class="qr-fs-upi-label">UPI ID:</span>
								<span class="qr-fs-upi-id">Q714475106@ybl</span>
							</div>
							<div class="qr-fs-receiver-name">Rina Kumari</div>
						</div>

						<div class="qr-fs-hint">
							<p>Scan with any UPI app to pay</p>
							<div class="qr-fs-apps">
								<span>GPay</span> • <span>PhonePe</span> • <span>Paytm</span>
							</div>
						</div>

						<div class="qr-fs-details">
							{#if qrOnlineAmount !== null && qrCashAmount !== null && (qrOnlineAmount > 0 || qrCashAmount > 0)}
								<div class="qr-fs-detail-pill split">
									<span>Split:</span>
									{#if qrOnlineAmount > 0}
										<span class="split-pill online">Online ₹{qrOnlineAmount}</span>
									{/if}
									{#if qrCashAmount > 0}
										<span class="split-pill cash">Cash ₹{qrCashAmount}</span>
									{/if}
								</div>
							{/if}
							{#if qrAdjustedAmount !== null && qrAdjustedAmount !== totalAmount}
								<div class="qr-fs-detail-pill adjustment">
									<span>Adjustment:</span>
									<span>
										{#if qrAdjustedAmount < totalAmount}
											- ₹{totalAmount - qrAdjustedAmount}
										{:else}
											+ ₹{qrAdjustedAmount - totalAmount}
										{/if}
									</span>
								</div>
							{/if}
							{#if discountAmount > 0}
								<div class="qr-fs-detail-pill discount">
									<span>Discount:</span>
									<span class="discount-val">- ₹{discountAmount}</span>
								</div>
							{/if}
							<div class="qr-fs-detail-pill total">
								<span>Total Payable:</span>
								<div class="payable-wrapper">
									{#if subtotal !== (qrAdjustedAmount ?? totalAmount)}
										<span class="qr-fs-original-amount-bottom">₹{subtotal}</span>
									{/if}
									<span class="payable-amount">₹{qrAdjustedAmount ?? totalAmount}</span>
								</div>
							</div>
						</div>
					{:else}
						<div class="qr-error">
							<p>Failed to generate QR code.</p>
							<button class="s-btn s-btn-outline" onclick={handleShowQR}>Try Again</button>
						</div>
					{/if}
				</div>

				<!-- Bottom action -->
				{#if qrCodeDataUrl && !isGeneratingQr}
					<label class="qr-fs-checkbox-row" class:shake={payBtnShaking}>
						<input type="checkbox" bind:checked={isPaymentConfirmed} />
						<span class="checkbox-text">I confirm that payment has been received.</span>
					</label>
					<div class="qr-fs-footer">
						<button
							class="qr-fs-btn qr-fs-back-btn"
							onclick={() => (showQrModal = false)}
							aria-label="Back"
						>
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
								<path d="M19 12H5M12 19l-7-7 7-7"></path>
							</svg>
						</button>
						<button
							class="qr-fs-btn qr-fs-options-btn"
							onclick={openEditModal}
							aria-label="Options"
						>
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
								<circle cx="12" cy="5" r="1"></circle>
								<circle cx="12" cy="12" r="1"></circle>
								<circle cx="12" cy="19" r="1"></circle>
							</svg>
						</button>
						<button class="qr-fs-btn qr-fs-pay-btn" onclick={handlePayClick}>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
								<polyline points="22 4 12 14.01 9 11.01"></polyline>
							</svg>
							Mark as Paid
						</button>
					</div>
				{/if}

				<!-- EDIT MODAL (slide-up) -->
				{#if showEditModal}
					<div class="em-overlay" onclick={() => (showEditModal = false)}>
						<div class="em-sheet" onclick={(e) => e.stopPropagation()}>
							<div class="em-handle"></div>
							<div class="em-header">
								<h3 class="em-title">Edit Payment</h3>
								<button class="em-close" onclick={() => (showEditModal = false)} aria-label="Close">
									<svg
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
								</button>
							</div>

							<!-- SECTION 1: Payment Split -->
							<div class="em-section">
								<div class="em-section-header">
									<span class="em-section-title">Payment Split</span>
								</div>
								<div class="em-info-row">
									<span class="em-label">Total Bill</span>
									<span class="em-static-value">₹{totalAmount}</span>
								</div>
								<div class="em-field-row" class:em-locked={lastEditedSplit === 'online'}>
									<label class="em-label" for="em-online">Online</label>
									<div class="em-input-wrap">
										<span class="em-currency">₹</span>
										<input
											id="em-online"
											type="number"
											class="em-input"
											value={editOnlineAmount ?? ''}
											oninput={onOnlineInput}
											placeholder="0"
										/>
									</div>
								</div>
								<div class="em-field-row" class:em-locked={lastEditedSplit === 'cash'}>
									<label class="em-label" for="em-cash">Cash</label>
									<div class="em-input-wrap">
										<span class="em-currency">₹</span>
										<input
											id="em-cash"
											type="number"
											class="em-input"
											value={editCashAmount ?? ''}
											oninput={onCashInput}
											placeholder="0"
										/>
									</div>
								</div>
							</div>

							<div class="em-divider"></div>

							<!-- SECTION 2: Adjustment -->
							<div class="em-section">
								<div class="em-section-header">
									<span class="em-section-title">Adjustment</span>
								</div>
								<div class="em-field-row" class:em-locked={lastEditedAdj === 'amount'}>
									<label class="em-label" for="em-adj-amount">Adjusted Amount</label>
									<div class="em-input-wrap">
										<span class="em-currency">₹</span>
										<input
											id="em-adj-amount"
											type="number"
											class="em-input"
											value={editAdjustedAmount ?? ''}
											oninput={onAdjustedAmountInput}
											placeholder="0"
										/>
									</div>
								</div>
								<div class="em-field-row" class:em-locked={lastEditedAdj === 'bill'}>
									<label class="em-label" for="em-adj-bill">Bill After Adjustment</label>
									<div class="em-input-wrap">
										<span class="em-currency">₹</span>
										<input
											id="em-adj-bill"
											type="number"
											class="em-input"
											value={editAdjustedBill ?? ''}
											oninput={onAdjustedBillInput}
											placeholder={totalAmount}
										/>
									</div>
								</div>
							</div>

							<!-- Modal Footer -->
							<div class="em-footer">
								<button class="em-btn em-cancel" onclick={() => (showEditModal = false)}
									>Cancel</button
								>
								<button class="em-btn em-apply" onclick={applyEditModal}>Apply & Update QR</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- MARK AS PAID MODAL (fullscreen, on summary page) -->
{#if showPayModal}
	<div class="pay-fullscreen">
		<!-- Top bar -->
		<div class="pay-fs-topbar">
			<button class="pay-fs-close" onclick={() => (showPayModal = false)}>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
			<h2 class="pay-fs-title">Payment Details</h2>
			<div class="pay-fs-spacer"></div>
		</div>

		<!-- Body -->
		<div class="pay-fs-body">
			<!-- SECTION 1: Payment Split -->
			<div class="em-section">
				<div class="em-section-header">
					<span class="em-section-title">Payment Split</span>
				</div>
				<div class="em-info-row">
					<span class="em-label">Total Bill</span>
					<span class="em-static-value">₹{totalAmount}</span>
				</div>
				<div class="em-field-row" class:em-locked={lastEditedSplit === 'online'}>
					<label class="em-label" for="pay-online">Online</label>
					<div class="em-input-wrap">
						<span class="em-currency">₹</span>
						<input
							id="pay-online"
							type="number"
							class="em-input"
							value={editOnlineAmount ?? ''}
							oninput={onOnlineInput}
							onblur={syncPaymentSplitToDB}
							placeholder="0"
						/>
					</div>
				</div>
				<div class="em-field-row" class:em-locked={lastEditedSplit === 'cash'}>
					<label class="em-label" for="pay-cash">Cash</label>
					<div class="em-input-wrap">
						<span class="em-currency">₹</span>
						<input
							id="pay-cash"
							type="number"
							class="em-input"
							value={editCashAmount ?? ''}
							oninput={onCashInput}
							onblur={syncPaymentSplitToDB}
							placeholder="0"
						/>
					</div>
				</div>
			</div>

			<div class="em-divider"></div>

			<!-- SECTION 2: Adjustment -->
			<div class="em-section">
				<div class="em-section-header">
					<span class="em-section-title">Adjustment</span>
				</div>
				<div class="em-field-row" class:em-locked={lastEditedAdj === 'amount'}>
					<label class="em-label" for="pay-adj-amount">Adjusted Amount</label>
					<div class="em-input-wrap">
						<span class="em-currency">₹</span>
						<input
							id="pay-adj-amount"
							type="number"
							class="em-input"
							value={editAdjustedAmount ?? ''}
							oninput={onAdjustedAmountInput}
							onblur={syncPaymentSplitToDB}
							placeholder="0"
						/>
					</div>
				</div>
				<div class="em-field-row" class:em-locked={lastEditedAdj === 'bill'}>
					<label class="em-label" for="pay-adj-bill">Bill After Adjustment</label>
					<div class="em-input-wrap">
						<span class="em-currency">₹</span>
						<input
							id="pay-adj-bill"
							type="number"
							class="em-input"
							value={editAdjustedBill ?? ''}
							oninput={onAdjustedBillInput}
							onblur={syncPaymentSplitToDB}
							placeholder={totalAmount}
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Checkbox + Footer -->
		<label class="qr-fs-checkbox-row" class:shake={payModalShaking}>
			<input type="checkbox" bind:checked={payConfirmed} />
			<span class="checkbox-text">I confirm that payment has been received.</span>
		</label>
		<div class="pay-fs-footer">
			{#if isPaymentEdited}
				<button
					class="pay-fs-btn pay-fs-cancel-btn"
					onclick={handleCancelPayment}
					style="background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; flex: 1;"
				>
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
						<path d="M19 12H5M12 19l-7-7 7-7" />
					</svg>
					Cancel
				</button>
				<button
					class="pay-fs-btn pay-fs-update-btn"
					onclick={handleUpdatePayment}
					style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; flex: 2; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.3);"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
					Update
				</button>
			{:else}
				<button class="pay-fs-btn pay-fs-qr-btn" onclick={handleShowQRFromPayModal}>
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
						<rect x="3" y="3" width="7" height="7"></rect>
						<rect x="14" y="3" width="7" height="7"></rect>
						<rect x="14" y="14" width="7" height="7"></rect>
						<rect x="3" y="14" width="7" height="7"></rect>
					</svg>
					Show QR
				</button>
				<button class="pay-fs-btn pay-fs-mark-btn" onclick={applyPayModal}>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
					Mark as Paid
				</button>
			{/if}
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
		padding-bottom: 120px; /* Space for fixed bottom actions */
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
		font-weight: 700;
		color: var(--s-text-secondary);
		margin-bottom: 8px;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.financials .s-input {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		font-weight: 600;
		color: #0f172a;
	}

	.financials .s-input:focus {
		background: #ffffff;
		border-color: var(--s-accent);
		box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.1);
	}

	.readonly-mode .financials .s-input {
		background: transparent !important;
		border-color: transparent !important;
		padding-left: 0;
		padding-right: 0;
		font-weight: 700;
		color: #1e293b;
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
		bottom: 0;
		left: 0;
		right: 0;
		padding: 16px 20px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
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

	.action-column {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md); /* Increased gap for better spacing between rows */
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

	.qr-btn {
		background: #6366f1; /* Indigo color */
		color: white;
	}

	.qr-btn:active {
		background: #4f46e5;
		transform: scale(0.97);
	}

	.pay-btn {
		background: #f43f5e; /* Rose/Red color */
		color: white;
	}

	.pay-btn:active {
		background: #e11d48;
		transform: scale(0.97);
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

	/* ===== FULLSCREEN QR PAYMENT ===== */
	.qr-fullscreen {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--s-surface, #ffffff);
		z-index: 2000;
		display: flex;
		flex-direction: column;
		animation: qrSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes qrSlideUp {
		from {
			opacity: 0;
			transform: translateY(40px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.qr-fs-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
	}

	.qr-fs-back {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: transform 0.15s ease;
	}

	.qr-fs-back:active {
		transform: scale(0.9);
	}

	.qr-fs-title {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e);
	}

	.qr-fs-spacer {
		width: 40px;
	}

	.qr-fs-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px 20px;
		overflow-y: auto;
		text-align: center;
		gap: 20px;
	}

	.qr-fs-image-wrap {
		background: white;
		padding: 20px;
		border-radius: var(--s-radius-xl, 20px);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
		border: 1px solid var(--s-border, #e5e7eb);
	}

	.qr-fs-image {
		display: block;
		border-radius: 10px;
		width: 240px;
		height: 240px;
		object-fit: contain;
	}

	/* Amount Section (Now Top) */
	.qr-fs-amount-section {
		width: 100%;
		max-width: 340px;
		margin-bottom: 8px;
	}

	.qr-fs-amount-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0px;
	}

	.qr-fs-original-amount {
		font-size: 1.1rem;
		color: var(--s-text-tertiary, #9ca3af);
		text-decoration: line-through;
		font-weight: 600;
	}

	.qr-fs-amount-row {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 4px;
	}

	.qr-fs-currency {
		font-size: 1.8rem;
		font-weight: 600;
		color: var(--s-text-secondary, #6b7280);
	}

	.qr-fs-amount {
		font-size: 3.2rem;
		font-weight: 800;
		color: var(--s-text-primary, #1a1a2e);
		letter-spacing: -0.03em;
		line-height: 1;
	}

	/* ===== FULLSCREEN PAY MODAL ===== */
	.pay-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: var(--s-surface, #ffffff);
		display: flex;
		flex-direction: column;
		animation: fadeIn 0.25s ease;
	}

	.pay-fs-topbar {
		padding: 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		background: var(--s-surface, #ffffff);
		flex-shrink: 0;
	}

	.pay-fs-close {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pay-fs-close:hover {
		background: #fee2e2;
		color: #ef4444;
	}

	.pay-fs-close:active {
		transform: scale(0.92);
	}

	.pay-fs-title {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--s-text-primary, #0f172a);
	}

	.pay-fs-spacer {
		width: 40px;
	}

	.pay-fs-body {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 16px;
	}

	.pay-fs-footer {
		padding: 16px 20px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--s-border, #e5e7eb);
		background: var(--s-surface, white);
		display: flex;
		gap: 12px;
		align-items: center;
		flex-shrink: 0;
	}

	.pay-fs-btn {
		padding: 14px 12px;
		border-radius: var(--s-radius-lg, 16px);
		border: none;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.15s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.pay-fs-btn:active {
		transform: scale(0.97);
	}

	.pay-fs-qr-btn {
		flex: 1;
		background: linear-gradient(135deg, #6366f1, #4f46e5);
		color: white;
		box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
		border: 1px solid rgba(79, 70, 229, 0.5);
	}

	.pay-fs-qr-btn:hover {
		box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
	}

	.pay-fs-mark-btn {
		flex: 1;
		background: linear-gradient(135deg, #22c55e, #16a34a);
		color: white;
		box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
		border: 1px solid rgba(22, 163, 74, 0.5);
	}

	.pay-fs-mark-btn:hover {
		box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
	}

	/* ===== EDIT MODAL (slide-up bottom sheet) ===== */
	.em-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(4px);
		z-index: 10;
		display: flex;
		align-items: flex-end;
		animation: fadeIn 0.2s ease;
	}

	.em-sheet {
		width: 100%;
		background: var(--s-surface, #ffffff);
		border-radius: 32px 32px 0 0;
		padding: 8px 0 0;
		animation: emSlideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1);
		max-height: 92vh;
		overflow-y: auto;
	}

	@keyframes emSlideUp {
		from {
			transform: translateY(100%);
			opacity: 0.5;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.em-handle {
		width: 40px;
		height: 5px;
		background: #d1d5db;
		border-radius: 99px;
		margin: 8px auto 16px;
	}

	.em-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px 16px;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
	}

	.em-title {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.25rem;
		font-weight: 800;
		color: #0f172a;
	}

	.em-close {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.em-close:hover {
		background: #fee2e2;
		color: #ef4444;
	}

	.em-close:active {
		transform: scale(0.92);
	}

	.em-section {
		padding: 16px 20px 4px;
	}

	.em-section-header {
		margin-bottom: 12px;
	}

	.em-section-title {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #6366f1;
	}

	.em-info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		background: linear-gradient(135deg, #eff6ff, #dbeafe);
		border-radius: 12px;
		margin-bottom: 16px;
		border: 1px solid #bfdbfe;
	}

	.em-static-value {
		font-size: 1.15rem;
		font-weight: 800;
		color: #1e3a8a;
	}

	.em-field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-radius: 12px;
		margin-bottom: 12px;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
	}

	.em-field-row.em-locked {
		border-color: #8b5cf6;
		background: rgba(139, 92, 246, 0.04);
		box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
	}

	.em-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: #475569;
		pointer-events: none;
	}

	.em-input-wrap {
		display: flex;
		align-items: center;
		width: 130px;
	}

	.em-currency {
		font-size: 1.15rem;
		font-weight: 600;
		color: #64748b;
	}

	.em-input {
		flex: 1;
		border: none;
		background: transparent;
		outline: none;
		text-align: right;
		font-size: 1.15rem;
		font-weight: 800;
		color: #0f172a;
		width: 100%;
		padding: 0;
	}

	.em-divider {
		height: 1px;
		background: var(--s-border, #e5e7eb);
		margin: 8px 20px;
	}

	.em-footer {
		display: flex;
		gap: 10px;
		padding: 16px 20px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--s-border, #e5e7eb);
		margin-top: 8px;
	}

	.em-btn {
		padding: 14px;
		border-radius: 14px;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		border: none;
		transition: all 0.15s ease;
	}

	.em-btn:active {
		transform: scale(0.97);
	}

	.em-cancel {
		flex: 1;
		background: #f1f5f9;
		color: #475569;
		font-weight: 800;
		border: none;
	}

	.em-apply {
		flex: 2;
		background: linear-gradient(135deg, #d4a373, #b07d4b);
		color: white;
		box-shadow: 0 4px 16px rgba(176, 125, 75, 0.35);
	}

	.em-apply:hover {
		box-shadow: 0 6px 20px rgba(176, 125, 75, 0.45);
	}

	/* UPI & Hint */
	.qr-fs-upi {
		background: var(--s-bg-tertiary, #f3f4f6);
		padding: 10px 20px;
		border-radius: var(--s-radius-full, 30px);
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.qr-fs-upi-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--s-text-tertiary, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.qr-fs-upi-id {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e);
		font-family: monospace;
	}

	.qr-fs-upi-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.qr-fs-receiver-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--s-text-primary, #1e293b);
		letter-spacing: 0.02em;
	}

	.qr-fs-hint {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.qr-fs-hint p {
		margin: 0;
		font-size: 0.9rem;
		color: var(--s-text-secondary, #6b7280);
		font-weight: 500;
	}

	.qr-fs-apps {
		font-size: 0.8rem;
		color: var(--s-text-tertiary, #9ca3af);
		font-weight: 600;
	}

	/* Footer */
	.qr-fs-footer {
		padding: 16px 20px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid var(--s-border, #e5e7eb);
		background: var(--s-surface, white);
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.qr-fs-btn {
		padding: 14px 12px;
		border-radius: var(--s-radius-lg, 16px);
		border: none;
		font-size: 0.95rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.15s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.qr-fs-btn:active {
		transform: scale(0.97);
	}

	.qr-fs-btn:hover {
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
	}

	.qr-fs-back-btn,
	.qr-fs-options-btn {
		flex: 0 0 calc(25% - 8px);
		background: var(--s-bg-tertiary, #f3f4f6);
		color: var(--s-text-secondary, #6b7280);
		border: 1px solid var(--s-border, #e5e7eb);
	}

	.qr-fs-pay-btn {
		flex: 1;
		background: linear-gradient(135deg, #22c55e, #16a34a);
		color: white;
		box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
		border: 1px solid rgba(22, 163, 74, 0.5);
	}

	.qr-fs-pay-btn:hover {
		box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
	}

	/* Loading & Error (reused) */
	.qr-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 0;
		gap: 16px;
	}

	.qr-loading p {
		margin: 0;
		color: var(--s-text-secondary, #6b7280);
		font-weight: 500;
	}

	.qr-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 20px 0;
	}

	.qr-error p {
		margin: 0;
		color: var(--s-error, #ef4444);
		font-weight: 600;
	}

	/* QR Details added dynamically */
	.qr-fs-details {
		margin-top: 14px;
		background: transparent;
		border-radius: 12px;
		padding: 12px;
		border: 1px dashed #cbd5e1;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.qr-fs-detail-pill {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.95rem;
		font-weight: 700;
		color: #334155;
	}

	.qr-fs-detail-pill.split {
		justify-content: flex-start;
		gap: 8px;
	}

	.qr-fs-detail-pill.split span:first-child {
		margin-right: 4px;
	}

	.discount-val {
		color: var(--s-success, #10b981);
		font-weight: 500;
	}

	.qr-fs-detail-pill.total {
		border-top: 1px dashed #cbd5e1;
		padding-top: 10px;
		margin-top: 2px;
		color: #1a1a2e;
		font-weight: 800;
		font-size: 1rem;
	}

	.payable-wrapper {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.qr-fs-original-amount-bottom {
		font-size: 0.95rem;
		color: #9ca3af;
		text-decoration: line-through;
		font-weight: 600;
	}

	.payable-amount {
		color: #1a1a2e;
		font-size: 1.1rem;
	}

	.split-pill {
		padding: 4px 12px;
		border-radius: 99px;
		font-size: 0.8rem;
		font-weight: 700;
		border: 1px solid #e2e8f0;
	}

	.split-pill.online {
		color: #6366f1;
		border-color: #c7d2fe;
		background: #eef2ff;
	}

	.split-pill.cash {
		color: #10b981;
		border-color: #a7f3d0;
		background: #ecfdf5;
	}

	/* Checkbox Confirmation */
	.qr-fs-checkbox-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 16px 20px 8px;
		margin-top: auto;
		cursor: pointer;
		user-select: none;
	}

	.qr-fs-checkbox-row input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		width: 22px;
		height: 22px;
		border: 2px solid #cbd5e1;
		border-radius: 6px;
		outline: none;
		cursor: pointer;
		position: relative;
		transition: all 0.2s;
		background: white;
	}

	.qr-fs-checkbox-row input[type='checkbox']:checked {
		background: #22c55e;
		border-color: #22c55e;
	}

	.qr-fs-checkbox-row input[type='checkbox']:checked::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 2px;
		width: 5px;
		height: 10px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}

	.checkbox-text {
		font-size: 0.95rem;
		font-weight: 600;
		color: #334155;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		15% {
			transform: translateX(-6px);
		}
		30% {
			transform: translateX(5px);
		}
		45% {
			transform: translateX(-4px);
		}
		60% {
			transform: translateX(3px);
		}
		75% {
			transform: translateX(-2px);
		}
		90% {
			transform: translateX(1px);
		}
	}

	.qr-fs-checkbox-row.shake {
		animation: shake 0.5s ease;
	}

	.ts-row.ts-split-bg {
		margin-top: 4px;
	}

	.split-bg {
		font-size: 0.85rem;
		color: var(--s-text-secondary, #64748b);
		font-weight: 500;
	}

	.title-row {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.pay-status-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 3px 10px;
		border-radius: 99px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		width: fit-content;
	}

	.pay-status-badge.paid {
		background: #dcfce7;
		color: #15803d;
		border: 1px solid #bbf7d0;
	}

	.pay-status-badge.unpaid {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca;
	}
</style>

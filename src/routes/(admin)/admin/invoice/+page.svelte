<script lang="ts">
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		allBookings,
		allServices,
		formatFirestoreDate,
		type Booking,
		type Service
	} from '$lib/stores/adminData';
	import {
		Search,
		FileText,
		ArrowLeft,
		Download,
		Share2,
		User,
		Calendar,
		Hash,
		Receipt,
		Percent,
		Tag,
		StickyNote,
		Phone,
		Mail
	} from 'lucide-svelte';
	import html2canvas from 'html2canvas';
	import { jsPDF } from 'jspdf';

	// --- Phase State ---
	type Phase = 'select' | 'build';
	let phase = $state<Phase>('select');
	let selectedBooking = $state<Booking | null>(null);

	// --- Booking Selection ---
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'completed' | 'confirmed'>('all');

	const filterChips = [
		{ label: 'All', value: 'all' as const },
		{ label: 'Completed', value: 'completed' as const },
		{ label: 'Confirmed', value: 'confirmed' as const }
	];

	let filteredBookings = $derived.by(() => {
		return $allBookings.filter((b) => {
			const s = (b.status || 'pending').toLowerCase();
			// Only show completed/confirmed bookings as they're eligible for invoicing
			if (!['completed', 'confirmed'].includes(s)) return false;
			if (statusFilter !== 'all' && s !== statusFilter) return false;

			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const searchStr =
					`${b.id} ${b.userName} ${b.userEmail} ${b.userPhone || ''} ${JSON.stringify(b.services || '')} ${JSON.stringify(b.servicesList || '')}`.toLowerCase();
				if (!searchStr.includes(q)) return false;
			}
			return true;
		});
	});

	// --- Invoice Builder ---
	let invoiceNumber = $state('');
	let taxPercent = $state(0);
	let discount = $state(0);
	let invoiceNotes = $state('');
	let invoiceRef = $state<HTMLDivElement | null>(null);
	let isGenerating = $state(false);

	// --- Extract services from a booking and match prices from allServices store ---
	function getServiceItems(b: Booking): { name: string; price: number }[] {
		const serviceNames: string[] = [];
		if (b.servicesList && Array.isArray(b.servicesList)) {
			b.servicesList.forEach((s: any) => {
				if (typeof s === 'string') serviceNames.push(s.trim());
				else if (s.name) serviceNames.push(s.name);
				else if (s.serviceName) serviceNames.push(s.serviceName);
			});
		} else if (b.service) {
			b.service.split(',').forEach((s: string) => serviceNames.push(s.trim()));
		} else if (b.serviceName) {
			serviceNames.push(b.serviceName);
		}

		return serviceNames.map((name) => {
			const match = $allServices.find((svc) => svc.name.toLowerCase() === name.toLowerCase());
			return { name, price: match?.price || 0 };
		});
	}

	let serviceItems = $derived(selectedBooking ? getServiceItems(selectedBooking) : []);

	let subtotal = $derived(serviceItems.reduce((sum, item) => sum + item.price, 0));
	let taxAmount = $derived((subtotal * taxPercent) / 100);
	let totalAmount = $derived(subtotal + taxAmount - discount);

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

	// --- Select a booking ---
	function selectBooking(b: Booking) {
		selectedBooking = b;
		invoiceNumber = `INV-${b.id.slice(0, 6).toUpperCase()}`;
		taxPercent = 18; // Default GST
		discount = 0;
		invoiceNotes = '';
		phase = 'build';
	}

	function goBackToSelect() {
		phase = 'select';
		selectedBooking = null;
	}

	// --- Avatar ---
	const avatarColors = ['#FF9F0A', '#30D158', '#D4AF37', '#BF5AF2', '#FF375F', '#AC8E68'];
	function getAvatarColor(name: string): string {
		const code = (name || 'U').charCodeAt(0);
		return avatarColors[code % avatarColors.length];
	}

	// --- Generate PDF Blob ---
	async function generatePdfBlob(): Promise<Blob> {
		if (!invoiceRef) throw new Error('Invoice preview not found');

		const canvas = await html2canvas(invoiceRef, {
			scale: 3,
			useCORS: true,
			logging: false,
			backgroundColor: '#ffffff'
		});

		const imgData = canvas.toDataURL('image/png');
		const pdf = new jsPDF('p', 'mm', 'a4');
		const pdfWidth = pdf.internal.pageSize.getWidth();
		const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

		pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
		return pdf.output('blob');
	}

	// --- Download PDF ---
	async function downloadPdf() {
		if (isGenerating) return;
		isGenerating = true;
		try {
			const blob = await generatePdfBlob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${invoiceNumber || 'Invoice'}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			showToast('Invoice downloaded!', 'success');
		} catch (err) {
			console.error('PDF download failed:', err);
			showToast('Failed to generate PDF', 'error');
		} finally {
			isGenerating = false;
		}
	}

	// --- Share PDF ---
	async function sharePdf() {
		if (isGenerating) return;
		isGenerating = true;
		try {
			const blob = await generatePdfBlob();
			const file = new File([blob], `${invoiceNumber || 'Invoice'}.pdf`, {
				type: 'application/pdf'
			});

			if (navigator.canShare && navigator.canShare({ files: [file] })) {
				await navigator.share({
					title: `Invoice ${invoiceNumber}`,
					text: `Invoice for ${selectedBooking?.userName || 'Client'}`,
					files: [file]
				});
				showToast('Shared successfully!', 'success');
			} else {
				// Fallback: download
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `${invoiceNumber || 'Invoice'}.pdf`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
				showToast('Share not supported — downloaded instead', 'info');
			}
		} catch (err: any) {
			if (err.name !== 'AbortError') {
				console.error('Share failed:', err);
				showToast('Failed to share', 'error');
			}
		} finally {
			isGenerating = false;
		}
	}
</script>

{#if phase === 'select'}
	<!-- PHASE 1: Booking Selection -->
	<div class="admin-view-header">
		<h2 class="admin-view-title">Invoice Generator</h2>
	</div>

	<p class="inv-subtitle">Select a booking to generate an invoice</p>

	<div class="admin-search-bar">
		<Search size={16} class="admin-search-icon" />
		<input type="text" placeholder="Search client, booking ID..." bind:value={searchQuery} />
	</div>

	<div class="admin-filter-row">
		{#each filterChips as chip}
			<button
				class="admin-filter-chip"
				class:active={statusFilter === chip.value}
				onclick={() => (statusFilter = chip.value)}
			>
				{chip.label}
			</button>
		{/each}
	</div>

	<div class="admin-result-counter">
		<span>{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</span>
	</div>

	{#if filteredBookings.length === 0}
		<div class="admin-empty-state">
			<Receipt size={44} color="var(--admin-text-tertiary)" />
			<p>No eligible bookings found</p>
		</div>
	{:else}
		<div class="inv-booking-list">
			{#each filteredBookings as booking (booking.id)}
				{@const status = (booking.status || 'pending').toLowerCase()}
				{@const dateStr = formatFirestoreDate(booking.date)}
				<button class="inv-booking-select-card" onclick={() => selectBooking(booking)}>
					<div class="inv-card-left">
						{#if booking.userPhoto}
							<img src={booking.userPhoto} alt={booking.userName} class="admin-avatar-img" />
						{:else}
							<div
								class="admin-avatar-fallback"
								style="background: {getAvatarColor(booking.userName || '')};"
							>
								{(booking.userName || 'G').charAt(0).toUpperCase()}
							</div>
						{/if}
						<div class="inv-card-info">
							<span class="inv-card-name">{booking.userName || 'Guest'}</span>
							<span class="inv-card-meta">
								{dateStr} • {booking.time || '--:--'}
							</span>
							<span class="inv-card-id">#{booking.id.slice(0, 8).toUpperCase()}</span>
						</div>
					</div>
					<div class="inv-card-right">
						<span class="admin-status-badge {status}">{status}</span>
						<FileText size={16} color="var(--admin-text-tertiary)" />
					</div>
				</button>
			{/each}
		</div>
	{/if}
{:else}
	<!-- PHASE 2: Invoice Builder -->
	<div class="admin-view-header">
		<button class="inv-back-btn" onclick={goBackToSelect}>
			<ArrowLeft size={20} />
		</button>
		<h2 class="admin-view-title">Invoice</h2>
		<div style="width: 36px;"></div>
	</div>

	<!-- Invoice Form -->
	<div class="inv-form-section">
		<div class="inv-form-row">
			<div class="inv-form-group">
				<label for="inv-number"><Hash size={12} /> Invoice #</label>
				<input type="text" id="inv-number" bind:value={invoiceNumber} />
			</div>
			<div class="inv-form-group">
				<label for="inv-tax"><Percent size={12} /> Tax %</label>
				<input type="number" id="inv-tax" min="0" max="100" step="0.5" bind:value={taxPercent} />
			</div>
		</div>
		<div class="inv-form-row">
			<div class="inv-form-group">
				<label for="inv-discount"><Tag size={12} /> Discount (₹)</label>
				<input type="number" id="inv-discount" min="0" step="1" bind:value={discount} />
			</div>
			<div class="inv-form-group full">
				<label for="inv-notes"><StickyNote size={12} /> Notes</label>
				<input
					type="text"
					id="inv-notes"
					placeholder="Optional notes..."
					bind:value={invoiceNotes}
				/>
			</div>
		</div>
	</div>

	<!-- Invoice Preview -->
	<div class="inv-preview-wrapper">
		<div class="inv-preview" bind:this={invoiceRef}>
			<!-- Header -->
			<div class="inv-header">
				<div class="inv-brand">
					<span class="inv-brand-name">BLANCBEU</span>
					<span class="inv-brand-sub">Premium Salon</span>
				</div>
				<div class="inv-invoice-meta">
					<span class="inv-invoice-label">INVOICE</span>
					<span class="inv-invoice-num">{invoiceNumber}</span>
					<span class="inv-invoice-date"
						>{new Date().toLocaleDateString('en-IN', {
							day: '2-digit',
							month: 'short',
							year: 'numeric'
						})}</span
					>
				</div>
			</div>

			<div class="inv-divider"></div>

			<!-- Client -->
			<div class="inv-client-section">
				<span class="inv-section-label">BILL TO</span>
				<span class="inv-client-name">{selectedBooking?.userName || 'Guest'}</span>
				{#if selectedBooking?.userEmail}
					<span class="inv-client-detail"><Mail size={11} /> {selectedBooking.userEmail}</span>
				{/if}
				{#if selectedBooking?.userPhone}
					<span class="inv-client-detail"><Phone size={11} /> {selectedBooking.userPhone}</span>
				{/if}
				<span class="inv-client-detail"
					><Calendar size={11} />
					{formatFirestoreDate(selectedBooking?.date)} at {selectedBooking?.time || '--:--'}</span
				>
			</div>

			<div class="inv-divider"></div>

			<!-- Line Items -->
			<div class="inv-items-section">
				<div class="inv-items-header">
					<span>Service</span>
					<span>Amount</span>
				</div>
				{#each serviceItems as item, i}
					<div class="inv-item-row" class:alt={i % 2 === 1}>
						<span class="inv-item-name">{item.name}</span>
						<span class="inv-item-price">{fmt(item.price)}</span>
					</div>
				{/each}
			</div>

			<div class="inv-divider"></div>

			<!-- Totals -->
			<div class="inv-totals">
				<div class="inv-total-row">
					<span>Subtotal</span>
					<span>{fmt(subtotal)}</span>
				</div>
				{#if taxPercent > 0}
					<div class="inv-total-row">
						<span>Tax ({taxPercent}%)</span>
						<span>{fmt(taxAmount)}</span>
					</div>
				{/if}
				{#if discount > 0}
					<div class="inv-total-row discount">
						<span>Discount</span>
						<span>-{fmt(discount)}</span>
					</div>
				{/if}
				<div class="inv-total-row grand">
					<span>Total</span>
					<span>{fmt(totalAmount)}</span>
				</div>
			</div>

			{#if invoiceNotes}
				<div class="inv-notes-section">
					<span class="inv-section-label">NOTES</span>
					<p>{invoiceNotes}</p>
				</div>
			{/if}

			<!-- Footer -->
			<div class="inv-footer">
				<span>Thank you for choosing Blancbeu!</span>
			</div>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="inv-actions">
		<button class="inv-action-btn primary" onclick={downloadPdf} disabled={isGenerating}>
			<Download size={18} />
			{isGenerating ? 'Generating...' : 'Download PDF'}
		</button>
		<button class="inv-action-btn secondary" onclick={sharePdf} disabled={isGenerating}>
			<Share2 size={18} />
			Share
		</button>
	</div>
{/if}

<style>
	/* ––– Phase 1: Booking Selection ––– */
	.inv-subtitle {
		font-size: 14px;
		color: var(--admin-text-secondary);
		margin-bottom: 16px;
		font-weight: 500;
	}

	.inv-booking-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.inv-booking-select-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		padding: 14px 16px;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: var(--admin-shadow-sm);
		font-family: var(--admin-font);
		width: 100%;
		text-align: left;
	}

	.inv-booking-select-card:active {
		transform: scale(0.98);
		background: var(--admin-surface-hover);
	}

	.inv-card-left {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		flex: 1;
	}

	.inv-card-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.inv-card-name {
		font-size: 15px;
		font-weight: 700;
		color: var(--admin-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.inv-card-meta {
		font-size: 12px;
		color: var(--admin-text-secondary);
		font-weight: 500;
	}

	.inv-card-id {
		font-size: 11px;
		color: var(--admin-text-tertiary);
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-weight: 600;
	}

	.inv-card-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
	}

	/* ––– Phase 2: Builder ––– */
	.inv-back-btn {
		background: none;
		border: none;
		color: var(--admin-text-primary);
		cursor: pointer;
		padding: 8px;
		border-radius: var(--admin-radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.inv-back-btn:active {
		background: var(--admin-surface-hover);
	}

	/* ––– Form ––– */
	.inv-form-section {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-lg);
		padding: 16px;
		margin-bottom: 20px;
		box-shadow: var(--admin-shadow-sm);
	}

	.inv-form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 12px;
	}

	.inv-form-row:last-child {
		margin-bottom: 0;
	}

	.inv-form-group {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.inv-form-group.full {
		grid-column: span 2;
	}

	.inv-form-group label {
		font-size: 11px;
		font-weight: 700;
		color: var(--admin-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.inv-form-group input {
		padding: 10px 12px;
		border-radius: var(--admin-radius-sm);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		font-size: 14px;
		font-family: var(--admin-font);
		color: var(--admin-text-primary);
		outline: none;
		transition: border-color 0.2s;
		width: 100%;
	}

	.inv-form-group input:focus {
		border-color: var(--admin-accent);
	}

	/* ––– Invoice Preview ––– */
	.inv-preview-wrapper {
		margin-bottom: 20px;
		border-radius: var(--admin-radius-lg);
		overflow: hidden;
		box-shadow: var(--admin-shadow-md);
	}

	.inv-preview {
		background: #ffffff;
		color: #1a1a1a;
		padding: 28px 24px;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			sans-serif;
	}

	.inv-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 4px;
	}

	.inv-brand {
		display: flex;
		flex-direction: column;
	}

	.inv-brand-name {
		font-family: 'Outfit', sans-serif;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: 2px;
		color: #1a1a1a;
	}

	.inv-brand-sub {
		font-size: 11px;
		color: #888;
		font-weight: 500;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.inv-invoice-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.inv-invoice-label {
		font-size: 20px;
		font-weight: 800;
		color: #d4af37;
		letter-spacing: 3px;
	}

	.inv-invoice-num {
		font-size: 13px;
		font-weight: 600;
		color: #555;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.inv-invoice-date {
		font-size: 12px;
		color: #999;
		font-weight: 500;
	}

	.inv-divider {
		height: 1px;
		background: #e8e8e8;
		margin: 16px 0;
	}

	.inv-client-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.inv-section-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: #aaa;
		margin-bottom: 4px;
	}

	.inv-client-name {
		font-size: 16px;
		font-weight: 700;
		color: #1a1a1a;
	}

	.inv-client-detail {
		font-size: 12px;
		color: #666;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* ––– Line Items ––– */
	.inv-items-section {
		display: flex;
		flex-direction: column;
	}

	.inv-items-header {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 1.5px;
		color: #aaa;
		text-transform: uppercase;
		border-bottom: 1px solid #e8e8e8;
	}

	.inv-item-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.inv-item-row.alt {
		background: #fafafa;
		margin: 0 -24px;
		padding: 10px 24px;
	}

	.inv-item-name {
		font-size: 14px;
		font-weight: 600;
		color: #333;
	}

	.inv-item-price {
		font-size: 14px;
		font-weight: 700;
		color: #1a1a1a;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	/* ––– Totals ––– */
	.inv-totals {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}

	.inv-total-row {
		display: flex;
		justify-content: space-between;
		width: 60%;
		font-size: 13px;
		color: #555;
		font-weight: 500;
	}

	.inv-total-row.discount {
		color: #30d158;
	}

	.inv-total-row.grand {
		font-size: 18px;
		font-weight: 800;
		color: #1a1a1a;
		padding-top: 8px;
		margin-top: 6px;
		border-top: 2px solid #1a1a1a;
	}

	.inv-total-row.grand span:last-child {
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	/* ––– Notes ––– */
	.inv-notes-section {
		margin-top: 16px;
		padding: 12px;
		background: #f9f9f9;
		border-radius: 8px;
		border: 1px solid #eee;
	}

	.inv-notes-section p {
		font-size: 13px;
		color: #555;
		line-height: 1.5;
		margin-top: 4px;
	}

	/* ––– Footer ––– */
	.inv-footer {
		text-align: center;
		margin-top: 20px;
		padding-top: 12px;
		border-top: 1px dashed #ddd;
	}

	.inv-footer span {
		font-size: 12px;
		color: #aaa;
		font-weight: 500;
		font-style: italic;
	}

	/* ––– Action Buttons ––– */
	.inv-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 20px;
	}

	.inv-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 16px;
		border-radius: var(--admin-radius-md);
		font-size: 15px;
		font-weight: 600;
		font-family: var(--admin-font);
		cursor: pointer;
		border: none;
		transition: all 0.2s;
	}

	.inv-action-btn:active {
		transform: scale(0.96);
	}

	.inv-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.inv-action-btn.primary {
		background: var(--admin-accent);
		color: #000;
		box-shadow: 0 4px 16px rgba(212, 175, 55, 0.25);
	}

	[data-theme='clean'] .inv-action-btn.primary {
		color: #fff;
	}

	.inv-action-btn.secondary {
		background: var(--admin-surface);
		color: var(--admin-text-primary);
		border: 1px solid var(--admin-border);
		box-shadow: var(--admin-shadow-sm);
	}
</style>

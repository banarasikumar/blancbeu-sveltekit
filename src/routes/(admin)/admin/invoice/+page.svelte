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
		taxPercent = 0;
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
			backgroundColor: '#FDF2F5'
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
			<!-- Background decorative elements (CSS-based) -->
			<div class="inv-bg-decor inv-bg-blob-tl"></div>
			<div class="inv-bg-decor inv-bg-blob-br"></div>
			<div class="inv-bg-decor inv-bg-heart inv-heart-1">♥</div>
			<div class="inv-bg-decor inv-bg-heart inv-heart-2">♥</div>
			<div class="inv-bg-decor inv-bg-heart inv-heart-3">♥</div>
			<div class="inv-bg-decor inv-bg-heart inv-heart-4">♥</div>
			<div class="inv-bg-decor inv-bg-heart inv-heart-5">♥</div>

			<!-- Header -->
			<div class="inv-header">
				<div class="inv-brand">
					<span class="inv-brand-name">BLANCBEU</span>
					<span class="inv-brand-sub">Premium Salon & Spa</span>
				</div>
			</div>

			<!-- INVOICE Title -->
			<div class="inv-title-row">
				<span class="inv-title">INVOICE</span>
			</div>

			<!-- Meta Row -->
			<div class="inv-meta-row">
				<div class="inv-meta-left">
					<span class="inv-meta-line">INVOICE NO.: {invoiceNumber}</span>
					<span class="inv-meta-line"
						>DATE: {new Date().toLocaleDateString('en-IN', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric'
						})}</span
					>
				</div>
				<div class="inv-meta-right">
					<span class="inv-meta-label">INVOICE TO:</span>
					<span class="inv-client-name">{selectedBooking?.userName || 'Guest'}</span>
					{#if selectedBooking?.userEmail}
						<span class="inv-client-detail">{selectedBooking.userEmail}</span>
					{/if}
					{#if selectedBooking?.userPhone}
						<span class="inv-client-detail">{selectedBooking.userPhone}</span>
					{/if}
				</div>
			</div>

			<!-- Line Items Table -->
			<div class="inv-table">
				<div class="inv-table-head">
					<span class="inv-th inv-th-name">ITEM NAME</span>
					<span class="inv-th inv-th-price">PRICE</span>
					<span class="inv-th inv-th-qty">QTY</span>
					<span class="inv-th inv-th-total">TOTAL</span>
				</div>
				{#each serviceItems as item, i}
					<div class="inv-table-row" class:inv-row-alt={i % 2 === 0}>
						<span class="inv-td inv-td-name">{item.name}</span>
						<span class="inv-td inv-td-price">{fmt(item.price)}</span>
						<span class="inv-td inv-td-qty">1</span>
						<span class="inv-td inv-td-total">{fmt(item.price)}</span>
					</div>
				{/each}
			</div>

			<!-- Summary / Totals -->
			<div class="inv-summary-row">
				<div class="inv-notes-area">
					{#if invoiceNotes}
						<span class="inv-notes-label">NOTES</span>
						<p class="inv-notes-text">{invoiceNotes}</p>
					{/if}
					<div class="inv-payment-info">
						<span class="inv-payment-label">PAYMENT INFO:</span>
						<span class="inv-payment-text"
							>Payment accepted at salon. Cash, UPI, or card.</span
						>
					</div>
				</div>
				<div class="inv-totals">
					<div class="inv-total-line">
						<span>SUBTOTAL</span>
						<span>{fmt(subtotal)}</span>
					</div>
					{#if taxPercent > 0}
						<div class="inv-total-line">
							<span>TAX ({taxPercent}%)</span>
							<span>{fmt(taxAmount)}</span>
						</div>
					{:else}
						<div class="inv-total-line">
							<span>TAX</span>
							<span>00%</span>
						</div>
					{/if}
					{#if discount > 0}
						<div class="inv-total-line inv-total-discount">
							<span>DISCOUNT</span>
							<span>-{fmt(discount)}</span>
						</div>
					{/if}
					<div class="inv-total-line inv-total-grand">
						<span>GRAND TOTAL</span>
						<span>{fmt(totalAmount)}</span>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="inv-footer">
				<span>Thank you for choosing Blancbeu! ♥</span>
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
		border-color: #f5a3c7;
	}

	/* ════════════════════════════════════════
	   INVOICE PREVIEW — Pink Floral Theme
	   ════════════════════════════════════════ */
	.inv-preview-wrapper {
		margin-bottom: 20px;
		border-radius: var(--admin-radius-lg);
		overflow: hidden;
		box-shadow: var(--admin-shadow-md);
	}

	.inv-preview {
		background: #fdf2f5;
		color: #333;
		padding: 32px 28px;
		font-family: 'Montserrat', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		position: relative;
		overflow: hidden;
		min-height: 500px;
	}

	/* ––– Decorative background elements ––– */
	.inv-bg-decor {
		position: absolute;
		pointer-events: none;
		z-index: 0;
	}

	.inv-bg-blob-tl {
		top: -30px;
		left: -30px;
		width: 140px;
		height: 140px;
		border-radius: 60% 40% 55% 45%;
		background: radial-gradient(circle at 40% 40%, #f8c8dc, #f5a3c7aa);
		opacity: 0.5;
	}

	.inv-bg-blob-br {
		bottom: -30px;
		right: -20px;
		width: 160px;
		height: 160px;
		border-radius: 45% 55% 40% 60%;
		background: radial-gradient(circle at 60% 60%, #f8c8dc, #f5a3c7aa);
		opacity: 0.5;
	}

	.inv-bg-heart {
		font-size: 10px;
		color: #e8799e;
		opacity: 0.5;
	}

	.inv-heart-1 {
		top: 40px;
		left: 100px;
		font-size: 8px;
		color: #333;
	}
	.inv-heart-2 {
		top: 100px;
		right: 60px;
		font-size: 12px;
		color: #f5a3c7;
	}
	.inv-heart-3 {
		bottom: 120px;
		left: 20px;
		font-size: 14px;
		color: #f5a3c7;
	}
	.inv-heart-4 {
		top: 200px;
		right: 30px;
		font-size: 8px;
		color: #333;
	}
	.inv-heart-5 {
		bottom: 80px;
		right: 100px;
		font-size: 10px;
		color: #f5a3c7;
	}

	/* ––– Header ––– */
	.inv-header {
		display: flex;
		justify-content: flex-end;
		align-items: flex-start;
		margin-bottom: 8px;
		position: relative;
		z-index: 1;
	}

	.inv-brand {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.inv-brand-name {
		font-family: 'Abhaya Libre', 'Georgia', serif;
		font-size: 20px;
		font-weight: 800;
		letter-spacing: 3px;
		color: #333;
	}

	.inv-brand-sub {
		font-size: 9px;
		color: #999;
		font-weight: 500;
		letter-spacing: 1.5px;
		text-transform: uppercase;
	}

	/* ––– INVOICE Title ––– */
	.inv-title-row {
		text-align: center;
		margin: 16px 0 20px;
		position: relative;
		z-index: 1;
	}

	.inv-title {
		font-family: 'Abhaya Libre', 'Georgia', serif;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: 6px;
		color: #333;
	}

	/* ––– Meta Row ––– */
	.inv-meta-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
		position: relative;
		z-index: 1;
	}

	.inv-meta-left,
	.inv-meta-right {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.inv-meta-right {
		align-items: flex-end;
	}

	.inv-meta-line {
		font-size: 10px;
		color: #777;
		font-weight: 500;
		letter-spacing: 0.5px;
		text-transform: uppercase;
	}

	.inv-meta-label {
		font-size: 10px;
		color: #777;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
	}

	.inv-client-name {
		font-size: 13px;
		font-weight: 700;
		color: #333;
		text-transform: uppercase;
	}

	.inv-client-detail {
		font-size: 11px;
		color: #888;
	}

	/* ════════════════════════════════════
	   TABLE — Pink Headers + Alt Rows
	   ════════════════════════════════════ */
	.inv-table {
		position: relative;
		z-index: 1;
		margin-bottom: 4px;
	}

	.inv-table-head {
		display: grid;
		grid-template-columns: 1fr 70px 40px 70px;
		background: #f5a3c7;
		padding: 8px 12px;
		border-radius: 4px 4px 0 0;
	}

	.inv-th {
		font-size: 9px;
		font-weight: 800;
		color: #fff;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.inv-th-price,
	.inv-th-total {
		text-align: right;
	}

	.inv-th-qty {
		text-align: center;
	}

	.inv-table-row {
		display: grid;
		grid-template-columns: 1fr 70px 40px 70px;
		padding: 8px 12px;
		border-bottom: 1px solid #f8dfe8;
	}

	.inv-table-row.inv-row-alt {
		background: rgba(245, 163, 199, 0.1);
	}

	.inv-td {
		font-size: 12px;
		color: #444;
		font-weight: 500;
	}

	.inv-td-name {
		font-weight: 600;
	}

	.inv-td-price,
	.inv-td-total {
		text-align: right;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 11px;
	}

	.inv-td-qty {
		text-align: center;
	}

	/* ════════════════════════════════════
	   SUMMARY ROW
	   ════════════════════════════════════ */
	.inv-summary-row {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		margin-top: 16px;
		position: relative;
		z-index: 1;
	}

	.inv-notes-area {
		flex: 1;
		min-width: 0;
	}

	.inv-notes-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 1px;
		color: #999;
		text-transform: uppercase;
		display: block;
		margin-bottom: 4px;
	}

	.inv-notes-text {
		font-size: 11px;
		color: #666;
		line-height: 1.5;
		margin: 0 0 12px 0;
	}

	.inv-payment-info {
		margin-top: 12px;
	}

	.inv-payment-label {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.5px;
		color: #555;
		display: block;
		margin-bottom: 3px;
	}

	.inv-payment-text {
		font-size: 10px;
		color: #888;
		line-height: 1.5;
	}

	/* ––– Totals ––– */
	.inv-totals {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		min-width: 150px;
	}

	.inv-total-line {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 11px;
		font-weight: 600;
		color: #666;
	}

	.inv-total-line span:first-child {
		margin-right: 16px;
	}

	.inv-total-line span:last-child {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 11px;
	}

	.inv-total-discount {
		color: #30d158;
	}

	.inv-total-grand {
		font-size: 15px;
		font-weight: 800;
		color: #333;
		padding-top: 8px;
		margin-top: 4px;
		border-top: 2px solid #333;
	}

	.inv-total-grand span:last-child {
		font-size: 14px;
	}

	/* ––– Footer ––– */
	.inv-footer {
		text-align: center;
		margin-top: 28px;
		padding-top: 12px;
		border-top: 1px dashed #f5a3c7;
		position: relative;
		z-index: 1;
	}

	.inv-footer span {
		font-size: 11px;
		color: #d48ba5;
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
		background: linear-gradient(135deg, #f5a3c7, #e8799e);
		color: #fff;
		box-shadow: 0 4px 16px rgba(245, 163, 199, 0.35);
	}

	.inv-action-btn.secondary {
		background: var(--admin-surface);
		color: var(--admin-text-primary);
		border: 1px solid var(--admin-border);
		box-shadow: var(--admin-shadow-sm);
	}
</style>

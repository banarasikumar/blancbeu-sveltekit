<script lang="ts">
	import {
		staffServices,
		createBooking,
		updateBookingDetails,
		searchUsersByPhone,
		searchUsersByName,
		upcomingBookings
	} from '$lib/stores/staffData';
	import { showToast } from '$lib/stores/toast';
	import type { Booking, AppUser } from '$lib/stores/adminData';
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

	// Search states
	let userSearchResults: AppUser[] = $state([]);
	let userNameSearchResults: AppUser[] = $state([]);
	let showUserDropdown = $state(false);
	let showUserNameDropdown = $state(false);
	let isSearchingUser = $state(false);
	let isSearchingName = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let nameSearchTimeout: ReturnType<typeof setTimeout>;

	// Multi-service management
	type OrderItem = {
		id: string; // 'custom' or serviceId
		name: string;
		price: number;
		duration?: number;
	};

	let selectedServices = $state<OrderItem[]>([]);
	let isSubmitting = $state(false);

	// Dropdown states
	let isCatalogOpen = $state(false);
	let sortBy = $state('category'); // 'category', 'name', 'price'
	let expandedCategories = $state<Record<string, boolean>>({});

	let sortedServices = $derived.by(() => {
		let s = [...$staffServices];
		if (sortBy === 'name') return s.sort((a, b) => a.name.localeCompare(b.name));
		if (sortBy === 'price') return s.sort((a, b) => (a.price || 0) - (b.price || 0));
		return s;
	});

	let groupedServices = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const service of $staffServices) {
			const cat = service.category || 'Other';
			if (!groups[cat]) groups[cat] = [];
			groups[cat].push(service);
		}
		// Sort categories alphabetically
		return Object.keys(groups)
			.sort()
			.reduce(
				(acc, key) => {
					acc[key] = groups[key];
					return acc;
				},
				{} as Record<string, any[]>
			);
	});

	function toggleCategory(cat: string) {
		expandedCategories[cat] = !expandedCategories[cat];
	}

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
				const nextSlot = getNextAvailableSlot();
				date = nextSlot.date;
				time = nextSlot.time;
				notes = '';
				selectedServices = [];
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

	function selectServiceFromCatalog(service: any) {
		selectedServices = [
			...selectedServices,
			{
				id: service.id,
				name: service.name,
				price: service.price,
				duration: service.duration
			}
		];
		isCatalogOpen = false;
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

	function getNextAvailableSlot(): { date: string; time: string } {
		const now = new Date();

		// Format date using local timezone (avoids UTC date shift from toISOString)
		const toLocalDateStr = (d: Date) => {
			const y = d.getFullYear();
			const m = (d.getMonth() + 1).toString().padStart(2, '0');
			const day = d.getDate().toString().padStart(2, '0');
			return `${y}-${m}-${day}`;
		};

		// Business hours: 10:00 AM (600 min) to 8:00 PM (1200 min)
		const OPEN = 600;
		const CLOSE = 1200;

		const currentMinutes = now.getHours() * 60 + now.getMinutes();

		// If current time is past business hours, jump to next day at opening
		if (currentMinutes >= CLOSE) {
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			return {
				date: toLocalDateStr(tomorrow),
				time: '10:00'
			};
		}

		const todayStr = toLocalDateStr(now);

		// Round up to next 30-minute slot, but not before opening
		let slotMinutes = Math.max(OPEN, Math.ceil(currentMinutes / 30) * 30);

		// Collect booked time slots for today (in minutes from midnight)
		const bookedSlots = new Set<number>();
		for (const b of $upcomingBookings) {
			const bDate = (b.date || '').split('T')[0];
			if (bDate !== todayStr || !b.time) continue;
			const cleaned = b.time.replace(/\s*(AM|PM)\s*/i, '').trim();
			const [h, m] = cleaned.split(':').map(Number);
			const isPM = /PM/i.test(b.time) && h !== 12;
			const isAM12 = /AM/i.test(b.time) && h === 12;
			const hours24 = isPM ? h + 12 : isAM12 ? 0 : h;
			bookedSlots.add((hours24 || 0) * 60 + (m || 0));
		}

		// Find the first available 30-minute slot within business hours
		while (slotMinutes <= CLOSE && bookedSlots.has(slotMinutes)) {
			slotMinutes += 30;
		}

		// If all today's slots are taken, move to next day at opening
		if (slotMinutes > CLOSE) {
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			return {
				date: toLocalDateStr(tomorrow),
				time: '10:00'
			};
		}

		const hh = Math.floor(slotMinutes / 60)
			.toString()
			.padStart(2, '0');
		const mm = (slotMinutes % 60).toString().padStart(2, '0');
		return { date: todayStr, time: `${hh}:${mm}` };
	}

	async function handlePhoneInput(e: Event) {
		let inputStr = (e.target as HTMLInputElement).value;

		// Immediately strip everything to get raw numbers for the input itself
		let rawDigits = inputStr.replace(/\D/g, '');

		// Cap max digits allowed in the input field
		if (rawDigits.length > 10) rawDigits = rawDigits.slice(-10);

		// Synchronize display and state variables to just max 10
		(e.target as HTMLInputElement).value = rawDigits;
		phone = rawDigits;

		clearTimeout(searchTimeout);

		if (!rawDigits || rawDigits.length < 3) {
			userSearchResults = [];
			showUserDropdown = false;
			isSearchingUser = false;
			return;
		}

		isSearchingUser = true;

		searchTimeout = setTimeout(async () => {
			try {
				// Search the backend explicitly using the clean 10-digit number
				const results = await searchUsersByPhone(rawDigits);
				userSearchResults = results;
				showUserDropdown = results.length > 0;

				// Exact match autofill (only trigger on full 10 digit number)
				if (rawDigits.length === 10) {
					const exactMatch = results.find((r) => {
						// Clean the result phone number to just digits before comparing
						const cleanResultPhone = (r.phone || r.phoneNumber || r.mobile || '')
							.replace(/\D/g, '')
							.slice(-10);
						return cleanResultPhone === rawDigits;
					});
					if (exactMatch) {
						selectUser(exactMatch);
					}
				}
			} catch (err) {
				console.error('Error searching users:', err);
			} finally {
				isSearchingUser = false;
			}
		}, 300); // 300ms debounce
	}

	async function handleNameInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		name = val;

		clearTimeout(nameSearchTimeout);

		if (!val || val.trim().length < 3) {
			userNameSearchResults = [];
			showUserNameDropdown = false;
			isSearchingName = false;
			return;
		}

		isSearchingName = true;

		nameSearchTimeout = setTimeout(async () => {
			try {
				const results = await searchUsersByName(val.trim());
				userNameSearchResults = results;
				showUserNameDropdown = results.length > 0;
			} catch (err) {
				console.error('Error searching names:', err);
			} finally {
				isSearchingName = false;
			}
		}, 300);
	}

	function selectUser(user: AppUser) {
		name = user.name || user.displayName || user.fullName || '';

		// Clean the incoming phone number so it only has 10 digits
		let cleanPhone = user.phone || user.phoneNumber || user.mobile || '';
		cleanPhone = cleanPhone.replace(/\D/g, '');
		if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

		phone = cleanPhone;

		showUserDropdown = false;
		showUserNameDropdown = false;
		userSearchResults = [];
		userNameSearchResults = [];
	}

	async function handleSubmit() {
		if (!name || !date || !time) {
			showToast('Please fill in client name, date and time', 'error');
			return;
		}

		if (!phone || phone.length < 10) {
			showToast('Please enter a valid 10-digit phone number', 'error');
			return;
		}

		// Prevent booking in the past
		if (internalMode === 'create') {
			const bookingDateTime = new Date(`${date}T${time}`);
			const now = new Date();

			// Allow a 5-minute grace period for "Now" bookings
			now.setMinutes(now.getMinutes() - 5);

			if (bookingDateTime < now) {
				showToast('Cannot create bookings in the past', 'error');
				return;
			}
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
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</button>
					{/if}
					<button class="close-btn" onclick={() => (isOpen = false)} aria-label="Close">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
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
									<div class="ov-badges-inline">
										<span class={`status-badge-lg ${existingBooking.status}`}>
											{existingBooking.status}
										</span>
										{#if existingBooking.status === 'completed'}
											{#if existingBooking.payment?.status === 'paid'}
												<span class="pay-status-badge paid">✓ Paid</span>
											{:else}
												<span class="pay-status-badge unpaid">Unpaid</span>
											{/if}
										{/if}
									</div>
									<h3>{existingBooking.userName || 'Guest'}</h3>
									<p>{existingBooking.userPhone || 'No phone provided'}</p>
								</div>
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
						<div class="form-group phone-search-group phone-input-wrapper">
							<span class="country-code">+91</span>
							<input
								type="tel"
								id="phone"
								value={phone}
								oninput={handlePhoneInput}
								onfocus={() => {
									if (userSearchResults.length > 0) showUserDropdown = true;
								}}
								onblur={() => {
									// Delay hiding dropdown so clicks can register
									setTimeout(() => (showUserDropdown = false), 200);
								}}
								placeholder="Enter 10-digit phone number *"
								class="input-lg phone-input"
							/>
							{#if isSearchingUser}
								<div class="search-loader">
									<div class="spinner"></div>
								</div>
							{/if}
							{#if showUserDropdown}
								<ul class="autocomplete-dropdown">
									{#each userSearchResults as user}
										<li class="autocomplete-item" onmousedown={() => selectUser(user)}>
											<div class="ac-avatar">{user.name?.[0] || user.displayName?.[0] || 'U'}</div>
											<div class="ac-info">
												<span class="ac-name">{user.name || user.displayName || 'Unknown'}</span>
												<span class="ac-phone">{user.phone || user.phoneNumber || ''}</span>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
						<div class="form-group name-search-group phone-search-group">
							<input
								type="text"
								id="name"
								bind:value={name}
								oninput={handleNameInput}
								onfocus={() => {
									if (userNameSearchResults.length > 0) showUserNameDropdown = true;
								}}
								onblur={() => {
									setTimeout(() => (showUserNameDropdown = false), 200);
								}}
								placeholder="Client Name *"
								class="input-lg"
							/>
							{#if isSearchingName}
								<div class="search-loader">
									<div class="spinner"></div>
								</div>
							{/if}
							{#if showUserNameDropdown}
								<ul class="autocomplete-dropdown">
									{#each userNameSearchResults as user}
										<li class="autocomplete-item" onmousedown={() => selectUser(user)}>
											<div class="ac-avatar">{user.name?.[0] || user.displayName?.[0] || 'U'}</div>
											<div class="ac-info">
												<span class="ac-name">{user.name || user.displayName || 'Unknown'}</span>
												<span class="ac-phone">{user.phone || user.phoneNumber || ''}</span>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</section>

					<section class="form-section">
						<div class="section-top" style="margin-bottom: 12px; align-items: center;">
							<h3>Time & Date</h3>
						</div>
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

						<button
							class="open-catalog-btn"
							onclick={(e) => {
								e.preventDefault();
								isCatalogOpen = true;
							}}
						>
							<span class="catalog-plus">+</span>
							<span>Select Service from Catalog</span>
						</button>
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
							<button
								class="action-btn complete"
								onclick={() => {
									isOpen = false;
									goto(`/staff/bookings/${existingBooking.id}`);
								}}
							>
								Complete Service
							</button>
						{:else if existingBooking.status === 'completed'}
							<div class="action-column">
								{#if existingBooking.payment?.status !== 'paid'}
									<div class="action-row">
										<button
											class="s-btn s-btn-lg action-btn qr-btn"
											onclick={() => {
												isOpen = false;
												goto(`/staff/bookings/${existingBooking.id}?action=qr`);
											}}
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
												<rect x="3" y="3" width="7" height="7"></rect>
												<rect x="14" y="3" width="7" height="7"></rect>
												<rect x="14" y="14" width="7" height="7"></rect>
												<rect x="3" y="14" width="7" height="7"></rect>
											</svg>
											Show QR
										</button>
										<button
											class="s-btn s-btn-lg action-btn pay-btn"
											onclick={() => {
												isOpen = false;
												goto(`/staff/bookings/${existingBooking.id}?action=pay`);
											}}
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
												<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
											</svg>
											Mark as Paid
										</button>
									</div>
								{/if}
								<div class="action-row mt-2">
									<button
										class="s-btn s-btn-lg action-btn chat-btn"
										onclick={async () => {
											const { startWhatsAppChat } = await import('$lib/utils/invoice');
											startWhatsAppChat({
												booking: existingBooking,
												services: existingBooking.servicesList || [
													{
														name: existingBooking.serviceName || 'Service',
														price: existingBooking.totalAmount || 0
													}
												],
												totalAmount: existingBooking.totalAmount || existingBooking.price || 0,
												discountAmount: existingBooking.discountAmount || 0,
												extraCharge: existingBooking.extraCharge || 0
											});
										}}
									>
										<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
											<path
												d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
											/>
										</svg>
										Start Chat
									</button>
									<button
										class="s-btn s-btn-lg action-btn invoice-btn"
										onclick={async () => {
											const { generateAndShareInvoice } = await import('$lib/utils/invoice');
											await generateAndShareInvoice({
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
												couponCode: existingBooking.couponCode || null,
												paymentStatus:
													existingBooking.payment?.status === 'paid' ? 'paid' : 'unpaid'
											});
										}}
									>
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
									</button>
								</div>
							</div>
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

		{#if isCatalogOpen}
			<!-- FULL SCREEN CATALOG MODAL -->
			<div class="catalog-fullscreen-overlay" onclick={(e) => e.stopPropagation()}>
				<div class="catalog-fs-header">
					<div class="catalog-fs-title">
						<button
							class="icon-btn catalog-back-btn"
							aria-label="Back"
							onclick={() => (isCatalogOpen = false)}
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"
								></polyline></svg
							>
						</button>
						<h2>Select Service</h2>
					</div>
				</div>

				<div class="catalog-fs-sort">
					<span class="sort-label">Sort by:</span>
					<div class="sort-buttons">
						<button
							class="sort-btn"
							class:active={sortBy === 'category'}
							onclick={(e) => {
								e.preventDefault();
								sortBy = 'category';
							}}>Category</button
						>
						<button
							class="sort-btn"
							class:active={sortBy === 'name'}
							onclick={(e) => {
								e.preventDefault();
								sortBy = 'name';
							}}>Name</button
						>
						<button
							class="sort-btn"
							class:active={sortBy === 'price'}
							onclick={(e) => {
								e.preventDefault();
								sortBy = 'price';
							}}>Price</button
						>
					</div>
				</div>

				<div class="catalog-fs-body">
					<div class="dropdown-list fs-list">
						{#if sortBy === 'category'}
							{#each Object.entries(groupedServices) as [cat, services]}
								<div class="category-group" class:expanded={expandedCategories[cat]}>
									<button
										class="category-header"
										onclick={(e) => {
											e.preventDefault();
											toggleCategory(cat);
										}}
									>
										<span class="cat-name">{cat} ({services.length})</span>
										<span class="cat-arrow" class:expanded={expandedCategories[cat]}>
											<svg
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg
											>
										</span>
									</button>
									{#if expandedCategories[cat]}
										<div class="category-items">
											{#each services as service}
												<button
													class="service-option"
													onclick={(e) => {
														e.preventDefault();
														selectServiceFromCatalog(service);
													}}
												>
													<div class="svc-name">{service.name}</div>
													<span class="svc-price">₹{service.price}</span>
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{:else}
							<div class="category-group expanded">
								<div class="category-items">
									{#each sortedServices as service}
										<button
											class="service-option flat"
											onclick={(e) => {
												e.preventDefault();
												selectServiceFromCatalog(service);
											}}
										>
											<div class="svc-name">
												{service.name}
												<span class="svc-cat">{service.category || 'Other'}</span>
											</div>
											<span class="svc-price">₹{service.price}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Backdrop */
	/* Hide bottom nav when modal is open */
	:global(body:has(.modal-backdrop)) .staff-nav-container {
		display: none !important;
	}

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
		z-index: 9999;
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
		gap: 16px;
	}

	.icon-btn.edit-toggle {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: var(--s-radius-full, 50%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: all var(--s-duration-fast, 0.15s) ease;
	}

	.icon-btn.edit-toggle:active {
		background: var(--s-border, #e5e7eb);
		transform: scale(0.92);
	}

	.close-btn {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: var(--s-radius-full, 50%);
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
		position: relative;
	}

	.ov-badges-inline {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 4px;
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
		padding: 4px 10px;
		border-radius: var(--s-radius-full, 20px);
		text-transform: uppercase;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		flex-shrink: 0;
		line-height: 1;
		height: 22px;
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

	.form-section {
		margin-bottom: 20px;
		background: var(--s-surface, white);
		padding: 20px 16px;
		border-radius: var(--s-radius-xl, 16px);
		border: 1px solid var(--s-border, #e5e7eb);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
	}

	h3 {
		margin: 0 0 16px 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--s-text-tertiary, #9ca3af);
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.input-lg {
		font-size: 1.15rem;
		font-weight: 600;
	}

	/* Payment status badges (from [id]/+page.svelte for consistency) */
	.pay-status-badge {
		padding: 4px 10px;
		border-radius: var(--s-radius-full, 20px);
		text-transform: uppercase;
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		flex-shrink: 0;
		line-height: 1;
		height: 22px;
		display: inline-flex;
		align-items: center;
	}

	.pay-status-badge.paid {
		background: #e6f4ea;
		color: #1e7e34;
		border: 1px solid rgba(30, 126, 52, 0.2);
	}

	.pay-status-badge.unpaid {
		background: #fdf2f2;
		color: #d32f2f;
		border: 1px solid rgba(211, 47, 47, 0.2);
	}

	@media (max-width: 480px) {
		.ov-header {
			flex-wrap: wrap;
			gap: 12px;
		}
		.status-badge-lg,
		.pay-status-badge {
			font-size: 0.7rem;
			padding: 4px 8px;
		}
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
		background: var(--s-surface, white);
	}

	textarea {
		resize: vertical;
		min-height: 100px;
		line-height: 1.4;
	}

	/* Phone Search Styles */
	.phone-search-group {
		position: relative;
	}

	.phone-input-wrapper {
		display: flex;
		align-items: center;
		flex-wrap: wrap; /* Allows the dropdown structure to break to standard positioning logic */
	}

	.country-code {
		position: absolute;
		left: 16px;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--s-text-primary, #1a1a2e);
		z-index: 1;
		pointer-events: none;
	}

	.phone-input {
		padding-left: 60px !important;
	}

	:global(.staff-app.dark) .country-code {
		color: #fff;
	}

	.search-loader {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid var(--s-border, #e5e7eb);
		border-top-color: var(--s-accent, #c9a24f);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.autocomplete-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		width: 100%; /* Explicit width to match parent */
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-md, 10px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		list-style: none;
		margin: 0;
		padding: 4px;
		max-height: 200px;
		overflow-y: auto;
		z-index: 50; /* Bring it above sibling inputs */
		animation: s-fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(.staff-app.dark) .autocomplete-dropdown {
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	.autocomplete-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border-radius: var(--s-radius-sm, 6px);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.autocomplete-item:hover {
		background: var(--s-bg-tertiary, #f3f4f6);
	}

	.ac-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--s-accent, #c9a24f), var(--s-brand, #1a1a2e));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.ac-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.ac-name {
		font-weight: 600;
		color: var(--s-text-primary, #1a1a2e);
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ac-phone {
		font-size: 0.8rem;
		color: var(--s-text-secondary, #6b7280);
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
		background: var(--s-bg-tertiary, #f3f4f6);
		border-radius: var(--s-radius-lg, 12px);
		margin-bottom: 16px;
		overflow: hidden;
	}

	:global(.staff-app.dark) .service-list {
		background: rgba(0, 0, 0, 0.2);
	}

	.service-item {
		padding: 14px 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		background: transparent;
	}

	.service-item:last-child {
		border-bottom: none;
	}

	:global(.staff-app.dark) .service-item {
		border-color: rgba(255, 255, 255, 0.05);
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
		border-bottom: 1px dashed var(--s-border, #e5e7eb);
		width: 100%;
		margin-bottom: 6px;
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

	/* Custom Dropdown Styles */
	.custom-dropdown-wrapper {
		position: relative;
	}

	.custom-dropdown-container {
		position: relative;
		flex: 1;
	}

	.dropdown-trigger {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 14px;
		background: var(--s-bg, #f8f9fa);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-md, 10px);
		font-size: 0.95rem;
		color: var(--s-text-primary, #1a1a2e);
		font-family: inherit;
		cursor: pointer;
		text-align: left;
		transition: all 0.2s ease;
	}
	.dropdown-trigger:focus,
	.custom-dropdown-container.active .dropdown-trigger {
		border-color: var(--s-accent, #c9a24f);
		box-shadow: 0 0 0 3px var(--s-accent-bg, rgba(201, 162, 79, 0.1));
		outline: none;
	}
	.trigger-text {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dropdown-arrow {
		display: flex;
		color: var(--s-text-tertiary, #9ca3af);
		transition: transform 0.2s ease;
	}
	.dropdown-arrow.open {
		transform: rotate(180deg);
	}

	.dropdown-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 90;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		width: 100%;
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-md, 10px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
		z-index: 100;
		display: flex;
		flex-direction: column;
		max-height: 350px;
		overflow: hidden;
		animation: fadeIn 0.15s ease-out;
	}

	.dropdown-header {
		padding: 10px 12px;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		background: var(--s-bg-tertiary, #f3f4f6);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.sort-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--s-text-tertiary, #9ca3af);
		letter-spacing: 0.05em;
	}
	.sort-buttons {
		display: flex;
		gap: 6px;
		flex: 1;
	}
	.sort-btn {
		flex: 1;
		padding: 6px 8px; /* Slightly smaller tap target to save space */
		font-size: 0.8rem;
		font-weight: 700; /* Bolder text for readabilty */
		border-radius: var(--s-radius-sm, 6px);
		border: 1px solid var(--s-border, #e5e7eb);
		background: var(--s-surface, white);
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.sort-btn.active {
		background: var(--s-brand, #1a1a2e);
		color: white;
		border-color: var(--s-brand, #1a1a2e);
	}

	.dropdown-list {
		flex: 1;
		overflow-y: auto;
		-ms-overflow-style: none;
		scrollbar-width: thin;
	}

	.category-group {
		background: var(--s-surface, white);
		border: 1px solid var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-xl, 16px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
		transition: all 0.2s ease;
	}

	.category-header {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 18px 20px;
		background: transparent;
		border: none;
		cursor: pointer;
		font-weight: 700;
		font-size: 1.1rem;
		color: var(--s-text-primary, #1a1a2e);
		transition: background 0.15s ease;
	}
	.category-header:hover {
		background: var(--s-bg-tertiary, #f3f4f6);
	}

	.category-group.expanded .category-header {
		border-bottom: 1px solid var(--s-border, #e5e7eb);
	}

	.cat-name {
		flex: 1;
		text-align: left;
	}
	.cat-arrow {
		color: var(--s-text-tertiary, #9ca3af);
		transition: transform 0.2s ease;
		display: flex;
	}
	.cat-arrow.expanded {
		transform: rotate(180deg);
	}

	.category-items {
		display: flex;
		flex-direction: column;
		background: transparent;
	}

	.service-option {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border: none;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		background: transparent;
		cursor: pointer;
		transition: background 0.2s ease;
	}
	.service-option:last-child {
		border-bottom: none;
	}
	.service-option:hover {
		background: var(--s-bg-tertiary, #f3f4f6);
	}
	.service-option.flat {
		padding-left: 20px;
	}
	.svc-name {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		font-size: 1rem;
		font-weight: 600;
		color: var(--s-text-primary, #1a1a2e);
		text-align: left;
	}
	.svc-cat {
		font-size: 0.75rem;
		color: var(--s-text-tertiary, #9ca3af);
		margin-left: 0;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.svc-price {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--s-text-secondary, #6b7280);
	}

	:global(.staff-app.dark) .dropdown-menu {
		background: var(--s-surface, #1e1e1e);
		border-color: #333;
	}
	:global(.staff-app.dark) .dropdown-header {
		background: #2a2a2a;
		border-color: #333;
	}
	:global(.staff-app.dark) .sort-btn {
		background: #1e1e1e;
		border-color: #333;
		color: #aaa;
	}
	:global(.staff-app.dark) .category-header {
		background: var(--s-surface, #1e1e1e);
		color: #fff;
		border-color: #333;
	}
	:global(.staff-app.dark) .category-group {
		background: var(--s-surface, #1e1e1e);
		border-color: #333;
	}
	:global(.staff-app.dark) .category-group.expanded .category-header {
		border-color: #333;
	}
	:global(.staff-app.dark) .category-items {
		background: transparent;
	}
	:global(.staff-app.dark) .service-option {
		background: transparent;
		border-color: #333;
	}
	:global(.staff-app.dark) .category-header:hover,
	:global(.staff-app.dark) .service-option:hover {
		background: #2a2a2a;
	}
	:global(.staff-app.dark) .svc-name {
		color: #fff;
	}
	:global(.staff-app.dark) .sort-btn.active {
		background: var(--s-accent, #c9a24f);
		color: #000;
		border-color: var(--s-accent, #c9a24f);
	}
	:global(.staff-app.dark) .dropdown-trigger {
		background: var(--s-bg, #121212);
		border-color: #333;
		color: #fff;
	}

	.open-catalog-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px;
		background: var(--s-surface, white);
		border: 1px dashed var(--s-border, #e5e7eb);
		border-radius: var(--s-radius-md, 10px);
		color: var(--s-text-primary, #1a1a2e);
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		margin-bottom: 12px;
		transition: all 0.2s ease;
	}
	.open-catalog-btn:hover {
		border-color: var(--s-accent, #c9a24f);
		color: var(--s-accent, #c9a24f);
		background: var(--s-accent-bg, rgba(201, 162, 79, 0.05));
	}
	.open-catalog-btn:active {
		transform: scale(0.98);
	}

	:global(.staff-app.dark) .open-catalog-btn {
		background: transparent;
		border-color: #444;
		color: #e5e7eb;
	}
	:global(.staff-app.dark) .open-catalog-btn:hover {
		border-color: var(--s-accent, #c9a24f);
		color: var(--s-accent, #c9a24f);
	}

	.catalog-plus {
		font-size: 1.2rem;
		font-weight: 400;
		line-height: 1;
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
		width: 100%;
		background: transparent;
		border: 1px solid transparent;
		color: var(--s-accent, #c9a24f);
		font-weight: 700;
		font-size: 0.95rem;
		cursor: pointer;
		padding: 12px 0;
		text-align: center;
		border-radius: var(--s-radius-md, 10px);
		transition: background 0.2s ease;
	}
	.text-btn:hover {
		background: var(--s-accent-bg, rgba(201, 162, 79, 0.05));
	}
	.text-btn:active {
		transform: scale(0.98);
	}

	.notes-group {
		background: transparent;
		padding: 0;
	}

	.notes-group textarea {
		background: var(--s-surface, white);
		border-radius: var(--s-radius-xl, 16px);
		border: 1px solid var(--s-border, #e5e7eb);
		padding: 20px 16px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
		font-size: 0.95rem;
		resize: none;
		min-height: 120px;
		transition: all 0.2s ease;
	}

	.notes-group textarea:focus {
		border-color: var(--s-accent, #c9a24f);
		box-shadow:
			0 0 0 3px var(--s-accent-bg, rgba(201, 162, 79, 0.1)),
			0 1px 3px rgba(0, 0, 0, 0.02);
	}

	:global(.staff-app.dark) .notes-group textarea {
		background: var(--s-surface, #1e1e1e);
		border-color: #333;
		color: #fff;
	}
	:global(.staff-app.dark) .notes-group textarea:focus {
		border-color: var(--s-accent, #c9a24f);
	}

	/* Footer */
	.modal-footer {
		display: flex;
		gap: 10px;
		padding: 16px 24px;
		padding-bottom: max(24px, env(safe-area-inset-bottom, 16px));
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

	/* ======== CATALOG FULLSCREEN OVERLAY ======== */
	.catalog-fullscreen-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: var(--s-bg, #f8f9fa);
		z-index: 300;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		border-radius: var(--s-radius-2xl, 24px) var(--s-radius-2xl, 24px) 0 0;
		overflow: hidden;
	}

	@media (min-width: 768px) {
		.catalog-fullscreen-overlay {
			top: 50%;
			left: 50%;
			bottom: auto;
			width: 100%;
			max-width: 500px;
			max-height: 92vh;
			height: 100%;
			transform: translate(-50%, -50%);
			border-radius: var(--s-radius-2xl, 20px);
			animation: catalogFadeInDesktop 0.3s ease-out forwards;
		}
	}

	@keyframes catalogFadeInDesktop {
		from {
			opacity: 0;
			transform: translate(-50%, -45%);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%);
		}
	}

	:global(.staff-app.dark) .catalog-fullscreen-overlay {
		background: var(--s-surface, #1e1e1e);
	}

	.catalog-fs-header {
		display: flex;
		flex-direction: column;
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		flex-shrink: 0;
		background: var(--s-surface, white);
	}

	:global(.staff-app.dark) .catalog-fs-header {
		background: #2a2a2a;
		border-color: #333;
	}

	.catalog-fs-title {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.catalog-fs-title h2 {
		margin: 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--s-text-primary, #1a1a2e);
	}

	:global(.staff-app.dark) .catalog-fs-title h2 {
		color: #fff;
	}

	.catalog-back-btn {
		background: var(--s-bg-tertiary, #f3f4f6);
		border: none;
		width: 40px;
		height: 40px;
		border-radius: var(--s-radius-full, 50%);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--s-text-secondary, #6b7280);
		cursor: pointer;
		transition: all var(--s-duration-fast, 0.15s) ease;
		flex-shrink: 0;
	}

	.catalog-back-btn:active {
		background: var(--s-border, #e5e7eb);
		transform: scale(0.92);
	}

	:global(.staff-app.dark) .catalog-back-btn {
		background: #1e1e1e;
		color: #aaa;
	}

	.catalog-fs-sort {
		padding: 10px 24px;
		background: var(--s-bg-tertiary, #f3f4f6);
		border-bottom: 1px solid var(--s-border, #e5e7eb);
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	:global(.staff-app.dark) .catalog-fs-sort {
		background: #2a2a2a;
		border-color: #333;
	}

	.catalog-fs-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 24px;
		-ms-overflow-style: none;
		scrollbar-width: thin;
	}

	.dropdown-list.fs-list {
		height: auto;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-bottom: 24px;
	}

	/* Action Buttons Grid */
	.action-column {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}

	.action-row {
		display: flex;
		gap: 12px;
		width: 100%;
	}

	.action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 700;
		border-radius: var(--s-radius-lg, 16px);
		padding: 16px;
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.qr-btn {
		background: #6366f1; /* Indigo */
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

	.mt-2 {
		margin-top: 8px;
	}
</style>

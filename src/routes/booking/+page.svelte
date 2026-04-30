<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, slide, fly, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { elasticOut, cubicOut, quintOut } from 'svelte/easing';
	import { cart } from '$lib/stores/booking';
	import { db, auth } from '$lib/firebase';
	import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
	import { requestUserNotificationPermission } from '$lib/stores/userNotifications';
	import { appSettings, initAppSettingsListener, destroyAppSettingsListener } from '$lib/stores/appSettings';
	import { env } from '$env/dynamic/public';

	import { goto } from '$app/navigation';
	import BookingSuccess from '$lib/components/BookingSuccess.svelte';

	// Icons
	import {
		Calendar,
		Clock,
		User,
		Phone,
		FileText,
		Check,
		Trash2,
		ShoppingBag,
		ChevronLeft,
		ChevronRight,
		Sparkles,
		Star,
		MapPin,
		Scissors,
		X,
		AlertCircle,
		ShieldCheck,
		ArrowRight,
		CreditCard,
		Smartphone,
		Bitcoin,
		QrCode,
		Banknote,
		Gem,
		Ticket
	} from 'lucide-svelte';
	import { browser } from '$app/environment';

	// --- LOGIC ---

	// State
	let selectedDate = '';
	let selectedTime = '';
	let userName = '';
	let userEmail = '';
	let userPhone = '';
	let userNotes = '';
	let paymentType: 'free' | 'token' | 'full' | '' = ''; // Payment option
	let selectedPaymentMethod = ''; // 'upi', 'card', 'crypto', 'netbanking', 'erupee'
	let showUPIApps = false; // To toggle UPI apps list

	// UI State
	let isSubmitting = false;
	let success = false;
	let bookingId = ''; // Store the generated ID here
	// Snapshot totals captured just before cart.clear() so the ticket shows correct amounts
	let ticketOriginalTotal = 0;
	let ticketOfferTotal = 0;
	let showDateModal = false;
	let showTimeModal = false;
	let showSummaryModal = false;
	let isLoadingAuth = true;
	let shakeButton = false;
	let showToast = false;
	let toastMessage = '';
	let bouncingMethod = ''; // Track which method is bouncing

	// Coupon State
	let couponCode = '';
	let couponDiscount = 0;
	let couponApplied = false;
	let couponError = '';
	let isApplyingCoupon = false;
	let showCouponsModal = false;

	const availableCoupons = [
		{ code: 'SAVE20', discountText: 'Flat ₹20 OFF', description: 'Save ₹20 on your booking' },
		{ code: 'FLAT50', discountText: 'Flat ₹50 OFF', description: 'Save ₹50 on your booking' },
		{ code: 'FIRST100', discountText: 'Flat ₹100 OFF', description: 'Exclusive discount' }
	];

	// Beu Cash State
	let beuCashBalance = 0;
	let useBeuCash = false;

	// Date/Time Logic
	let timeSlots: string[] = [];
	let quickDates: { label: string; dateStr: string; sub: string }[] = [];

	// Calendar Picker State
	let currentViewDate = new Date(); // Tracks which month we are viewing in modal
	let calendarDays: { day: number; dateStr: string; available: boolean; isPadding: boolean }[] = [];

	// Constants
	const CUTOFF_HOUR = 19;
	const CUTOFF_MINUTE = 30;

	onMount(() => {
		// Initialize calendar view to today
		currentViewDate = new Date();
		renderCalendar(currentViewDate);
		generateQuickDates();

		// Auth Requirement Check
		const unsubscribe = auth.onAuthStateChanged(async (user) => {
			isLoadingAuth = false;
			if (user) {
				userName = user.displayName || 'Guest';
				userEmail = user.email || '';
				userPhone = user.phoneNumber || '';
				
				// Fetch Beu Cash Balance
				try {
					const docRef = doc(db, 'users', user.uid);
					const docSnap = await getDoc(docRef);
					if (docSnap.exists()) {
						beuCashBalance = docSnap.data().beuCash || 0;
					}
				} catch (err) {
					console.error("Error fetching Beu Cash balance:", err);
				}
			} else {
				if (browser) goto('/login');
			}
		});

		initAppSettingsListener();

		return () => {
			unsubscribe();
			destroyAppSettingsListener();
		};
	});

	// --- DATE LOGIC ---

	function openDateModal() {
		showDateModal = true;
		// Reset view to selected date if exists, else today
		if (selectedDate) {
			currentViewDate = new Date(selectedDate);
		} else {
			currentViewDate = new Date();
		}
		renderCalendar(currentViewDate);
	}

	function closeDateModal() {
		showDateModal = false;
	}

	function closeSummaryModal() {
		showSummaryModal = false;
	}

	function handleDateSelect(date: string) {
		selectedDate = date;
		generateTimeSlots(date);
		selectedTime = ''; // Reset time when date changes
		closeDateModal();
	}

	function generateQuickDates() {
		const dates = [];
		const today = new Date();

		// Check cutoff for today
		let startOffset = 0;
		if (
			today.getHours() > CUTOFF_HOUR ||
			(today.getHours() === CUTOFF_HOUR && today.getMinutes() >= CUTOFF_MINUTE)
		) {
			startOffset = 1; // Start from Tomorrow
		}

		for (let i = startOffset; i < startOffset + 5; i++) {
			// Show next 5 available days
			const d = new Date();
			d.setDate(today.getDate() + i);
			const dateStr = formatDate(d);

			let label = '';
			if (i === 0) label = 'Today';
			else if (i === 1) label = 'Tomorrow';
			else label = d.toLocaleDateString('en-US', { weekday: 'short' });

			const sub = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

			dates.push({ label, dateStr, sub });
		}
		quickDates = dates;
	}

	function handleQuickDateSelect(dateStr: string) {
		selectedDate = dateStr;
		generateTimeSlots(dateStr);
		selectedTime = '';
		// Optional: Open time modal automatically for smoother flow
		// openTimeModal();
	}

	// --- CALENDAR PICKER LOGIC ---

	function renderCalendar(date: Date) {
		generateCalendarDays(date.getFullYear(), date.getMonth());
	}

	function changeMonth(delta: number) {
		const newDate = new Date(currentViewDate);
		newDate.setMonth(newDate.getMonth() + delta);

		// Prevent going back past current month
		const now = new Date();
		if (newDate.getMonth() < now.getMonth() && newDate.getFullYear() === now.getFullYear()) {
			return;
		}

		// Prevent going forward past 3 months
		const maxMonthDate = new Date();
		maxMonthDate.setMonth(maxMonthDate.getMonth() + 3);
		if (newDate > maxMonthDate) return;

		currentViewDate = newDate;
		renderCalendar(currentViewDate);
	}

	function generateCalendarDays(year: number, month: number) {
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		const days = [];

		// Padding (Empty slots before 1st of month)
		for (let i = 0; i < firstDay; i++) {
			days.push({ day: 0, dateStr: '', available: false, isPadding: true });
		}

		const todayStr = formatDate(new Date());
		const maxDate = new Date();
		maxDate.setDate(maxDate.getDate() + 90); // 3 Months (Approx 90 days)
		const maxDateStr = formatDate(maxDate);

		for (let i = 1; i <= daysInMonth; i++) {
			const d = new Date(year, month, i);
			const dStr = formatDate(d);

			// Availability Check
			// 1. No past dates
			const isPast = dStr < todayStr;

			// 2. No dates beyond 3 months
			const isBeyondLimit = dStr > maxDateStr;

			// 3. Cutoff check for Today (7:30 PM)
			let isTodayCutoff = false;
			if (dStr === todayStr) {
				const now = new Date();
				// If strictly past 7:30 PM (19:30), Today is over.
				if (now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30)) {
					isTodayCutoff = true;
				}
			}

			days.push({
				day: i,
				dateStr: dStr,
				available: !isPast && !isBeyondLimit && !isTodayCutoff,
				isPadding: false
			});
		}
		calendarDays = days;
	}

	function formatDate(d: Date) {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD for sorting/value
	}

	function formatDisplayDate(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	$: isCurrentMonthView =
		currentViewDate.getMonth() === new Date().getMonth() &&
		currentViewDate.getFullYear() === new Date().getFullYear();

	$: isMaxMonthView = (() => {
		const maxDate = new Date();
		maxDate.setMonth(maxDate.getMonth() + 3);
		return (
			currentViewDate.getMonth() === maxDate.getMonth() &&
			currentViewDate.getFullYear() === maxDate.getFullYear()
		);
	})();

	// --- TIME SLOT LOGIC ---

	function openTimeModal() {
		// Smart Selection: If no date selected, default to Today
		if (!selectedDate) {
			const today = new Date();
			const todayStr = formatDate(today);
			// Check if today is valid (e.g. not past cutoff)
			// But generateTimeSlots handles the logic. We just show slots for today.
			generateTimeSlots(todayStr); // Preview Today's slots
			showTimeModal = true;
			return;
		}
		showTimeModal = true;
		generateTimeSlots(selectedDate);
	}

	function closeTimeModal() {
		showTimeModal = false;
	}

	function handleTimeSelect(time: string) {
		// Smart Selection: If date wasn't selected, set it to Today
		if (!selectedDate) {
			const today = new Date();
			selectedDate = formatDate(today);
		}
		selectedTime = time;
		closeTimeModal();
	}

	function generateTimeSlots(dateStr: string) {
		const slots = [];
		const startH = 10;
		const endH = 19; // 7 PM

		const now = new Date();

		// Parse dateStr (YYYY-MM-DD) carefully to avoid timezone shifts
		const [y, m, d_part] = dateStr.split('-').map(Number);
		const selDate = new Date(y, m - 1, d_part);

		const isToday = formatDate(now) === dateStr;

		for (let h = startH; h <= endH; h++) {
			const minutes = [0, 30];
			minutes.forEach((m) => {
				// 19:30 is the last slot
				if (h === 19 && m > 30) return;

				// Format Display
				const d = new Date();
				d.setHours(h, m);
				const timeLabel = d.toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: true
				});

				// Past Check for Today (Logic Parity: 30-min valid buffer)
				// If it is 2:35 PM, 3:00 PM slot is technically "future" but might be too close?
				// Legacy logic: if slotTime < now, disable.
				// The prompt says: "if it's 2:35 PM, the 3:00 PM slot is invalid" -> implying > 30 min lead time?
				// Let's implement strict check: Slot must be > Now.
				// Re-reading specific request: "strict 30-minute booking cutoff" -> usually means you can't book a slot starting in 5 mins.
				// Let's assume strict "Slot Start Time must be > Now". The User Example says "2:35 PM -> 3:00 PM invalid".
				// 3:00 PM is 25 mins away. So yes, likely a 30-min buffer.

				let isValid = true;
				if (isToday) {
					const slotTime = new Date();
					slotTime.setFullYear(selDate.getFullYear(), selDate.getMonth(), selDate.getDate());
					slotTime.setHours(h, m, 0, 0);

					// "Today" Logic: Just ensure slot is in the future
					// User requested: If 7:15 PM, show 7:30 PM slot.
					// So slotTime > now is sufficient.
					if (slotTime <= now) isValid = false;
				}

				if (isValid) {
					slots.push(timeLabel);
				}
			});
		}
		timeSlots = slots;
	}

	// --- SUBMISSION LOGIC ---

	function handleContinue() {
		if ($cart.length === 0) {
			triggerShake('Please select a service first');
			return;
		}
		if (!selectedDate || !selectedTime) {
			triggerShake('Please select a date and time');
			return;
		}

		// Payment Method Validation Moved to Summary Stage

		showSummaryModal = true;
	}

	function handlePaymentMethodSelect(method: string) {
		if (method === 'card' || method === 'erupee' || method === 'crypto') {
			triggerShake('Coming Soon: ' + method.toUpperCase() + ' payment', false);
			return;
		}

		selectedPaymentMethod = method;
		if (method === 'upi') {
			showUPIApps = true;
		} else {
			showUPIApps = false;
		}
	}

	function triggerShake(msg: string, shakeMainButton = true) {
		if (shakeMainButton) {
			shakeButton = true;
			setTimeout(() => {
				shakeButton = false;
			}, 500); // Duration of shake animation
		}

		toastMessage = msg;
		showToast = true;

		setTimeout(() => {
			showToast = false;
		}, 5000); // 5 seconds toast
	}

	function applyCoupon() {
		if (!couponCode.trim()) {
			couponError = 'Please enter a coupon code';
			return;
		}

		isApplyingCoupon = true;
		couponError = '';

		// Mock coupon validation (simulate API delay)
		setTimeout(() => {
			const code = couponCode.trim().toUpperCase();

			if (code === 'SAVE20') {
				couponDiscount = 20;
				couponApplied = true;
				couponError = '';
				showCouponsModal = false;
			} else if (code === 'FLAT50') {
				couponDiscount = 50;
				couponApplied = true;
				couponError = '';
				showCouponsModal = false;
			} else if (code === 'FIRST100') {
				couponDiscount = 100;
				couponApplied = true;
				couponError = '';
				showCouponsModal = false;
			} else {
				couponDiscount = 0;
				couponApplied = false;
				couponError = 'Invalid coupon code';
			}

			isApplyingCoupon = false;
		}, 500);
	}

	function removeCoupon() {
		couponCode = '';
		couponDiscount = 0;
		couponApplied = false;
		couponError = '';
	}

	// Computed totals
	$: offersDiscount = originalTotal - offerTotal;
	$: subTotalAfterCoupon = Math.max(0, offerTotal - couponDiscount);
	$: maxBeuCashAllowed = subTotalAfterCoupon * 0.30;
	$: actualBeuCashApplied = useBeuCash ? Math.min(beuCashBalance, maxBeuCashAllowed) : 0;
	$: totalSavings = offersDiscount + couponDiscount + actualBeuCashApplied;
	$: finalTotal = Math.max(0, subTotalAfterCoupon - actualBeuCashApplied);

	async function submitBooking() {
		// Validation handled in handleContinue, but double check
		if (!selectedDate || !selectedTime) return;

		isSubmitting = true;

		try {
			let razorpayPaymentId = null;
			let razorpayOrderId = null;
			let finalPaymentStatus = 'unpaid';

			// RAZORPAY ONLINE FLOW
			if ($appSettings.defaultPaymentGateway === 'razorpay' && (paymentType === 'token' || paymentType === 'full')) {
				const checkoutAmount = paymentType === 'token' ? 50 : finalTotal;
				
				// 1. Create order on server
				const orderRes = await fetch('/api/razorpay/create-order', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ amount: checkoutAmount, receipt: `rcpt_${Date.now()}` })
				});
				
				if (!orderRes.ok) {
					throw new Error('Failed to create Razorpay order');
				}
				const orderData = await orderRes.json();
				
				// 2. Open Razorpay Checkout Modal
				await new Promise((resolve, reject) => {
					const options = {
						key: env.PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
						amount: orderData.amount,
						currency: orderData.currency,
						name: 'Blancbeu Salon',
						description: 'Booking Payment',
						order_id: orderData.orderId,
						prefill: {
							name: userName,
							email: userEmail,
							contact: userPhone
						},
						theme: {
							color: '#D4AF37'
						},
						handler: async function (response: any) {
							try {
								// Verify signature
								const verifyRes = await fetch('/api/razorpay/verify-payment', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										razorpay_order_id: response.razorpay_order_id,
										razorpay_payment_id: response.razorpay_payment_id,
										razorpay_signature: response.razorpay_signature
									})
								});
								
								if (!verifyRes.ok) {
									reject(new Error('Payment verification failed'));
									return;
								}

								razorpayPaymentId = response.razorpay_payment_id;
								razorpayOrderId = response.razorpay_order_id;
								finalPaymentStatus = 'paid';
								resolve(true);
							} catch (err) {
								reject(new Error('Payment verification encountered a network error.'));
							}
						},
						modal: {
							ondismiss: function() {
								reject(new Error('Payment cancelled by user'));
							}
						}
					};
					try {
						const rzp = new (window as any).Razorpay(options);
						rzp.open();
					} catch (err) {
						reject(new Error('Payment gateway failed to load. Please check your connection.'));
					}
				});
			} else {
				// Simulate network delay for nice interaction for offline flow
				await new Promise((r) => setTimeout(r, 1500));
			}

			const bookingData = {
				services: $cart.map((i) => ({ name: i.name, price: i.price, id: i.id })),
				servicesList: $cart.map((i) => ({ name: i.name, price: i.price, id: i.id })), // For Admin Compat
				totalAmount: $cart.reduce((sum, i) => sum + i.price, 0),
				date: selectedDate,
				time: selectedTime,
				// Flattened fields for Admin Panel
				userName: userName,
				userEmail: userEmail,
				userPhone: userPhone,
				notes: userNotes,
				customer: {
					name: userName,
					phone: userPhone,
					email: userEmail,
					notes: userNotes
				},
				payment: {
					type: paymentType,
					method: paymentType === 'free' ? 'pay_at_salon' : ($appSettings.defaultPaymentGateway === 'razorpay' ? 'razorpay' : selectedPaymentMethod),
					amount: paymentType === 'token' ? 50 : paymentType === 'full' ? finalTotal : 0,
					status: finalPaymentStatus,
					razorpay_payment_id: razorpayPaymentId,
					razorpay_order_id: razorpayOrderId,
					beuCashApplied: actualBeuCashApplied
				},
				userId: auth.currentUser?.uid || null, // Save User ID for fetching
				createdAt: serverTimestamp(),
				status: (paymentType === 'full' || paymentType === 'token') ? 'confirmed' : 'pending',
				source: 'web_app_v2'
			};

			const docRef = await addDoc(collection(db, 'bookings'), bookingData);

			// Snapshot totals BEFORE clearing cart so the success ticket shows correct amounts
			ticketOriginalTotal = originalTotal;
			ticketOfferTotal = offerTotal;

			success = true;
			bookingId = docRef.id;
			showSummaryModal = false;
			cart.clear();

			// Trigger Push Notification to Staff
			try {
				if (auth.currentUser) {
					const idToken = await auth.currentUser.getIdToken();
					const serviceNames = $cart.map((s) => s.name).join(', ');
					const apiUrl = typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform() 
						? 'https://blancbeu-sveltekit.vercel.app/api/notifications/notifyStaff' 
						: '/api/notifications/notifyStaff';
					
					const notifyRes = await fetch(apiUrl, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${idToken}`
						},
						body: JSON.stringify({
							title: 'New Booking Request!',
							body: `${userName} just booked ${serviceNames} for ${selectedDate} at ${selectedTime}`,
							targetRoles: ['staff', 'admin'],
							notificationType: 'newBookings'
						})
					}).catch((err) => console.error('Failed to send notification request:', err));
					if (notifyRes) {
						const notifyData = await notifyRes.json();
						console.log('[Booking] Push notification response:', notifyData);
					}
				}
			} catch (notificationErr) {
				console.error('Error triggering notification:', notificationErr);
			}

			// Request notification permission so the user receives booking status updates
			if (auth.currentUser) {
				console.log('[Booking] Requesting notification permission for user:', auth.currentUser.uid);
				requestUserNotificationPermission(auth.currentUser.uid)
					.then((result) => {
						console.log('[Booking] Notification permission result:', result);
						if (result.success) {
							console.log('[Booking] Successfully subscribed to notifications');
						} else {
							console.warn('[Booking] Failed to subscribe:', result.error, 'at step:', result.step);
						}
					})
					.catch((err) => {
						console.error('[Booking] Unexpected error requesting notification permission:', err);
					});
			}

			// Trigger Confetti
			if (browser) triggerConfetti();
		} catch (error: any) {
			console.error('Booking failed:', error);
			isSubmitting = false;
			
			// Don't show scary alerts if the user just closed the payment popup
			if (error && error.message !== 'Payment cancelled by user') {
				alert('Failed to book: ' + (error.message || 'Please try again.'));
			}
		}
		isSubmitting = false;
	}

	// --- CONFETTI EFFECT ---
	function triggerConfetti() {
		// Simple confetti implementation
		const canvas = document.createElement('canvas');
		canvas.style.position = 'fixed';
		canvas.style.top = '0';
		canvas.style.left = '0';
		canvas.style.width = '100vw';
		canvas.style.height = '100vh';
		canvas.style.pointerEvents = 'none';
		canvas.style.zIndex = '9999';
		document.body.appendChild(canvas);

		const ctx = canvas.getContext('2d');
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		const particles = [];
		const colors = ['#D4AF37', '#F7E7CE', '#FFFFFF', '#B76E79'];

		for (let i = 0; i < 150; i++) {
			particles.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height - canvas.height,
				size: Math.random() * 8 + 2,
				color: colors[Math.floor(Math.random() * colors.length)],
				speedY: Math.random() * 3 + 2,
				speedX: Math.random() * 2 - 1,
				rotation: Math.random() * 360,
				rotationSpeed: Math.random() * 5 - 2
			});
		}

		let animationFrame;
		function animate() {
			if (!ctx) return;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			let activeParticles = 0;
			particles.forEach((p) => {
				p.y += p.speedY;
				p.x += p.speedX;
				p.rotation += p.rotationSpeed;

				if (p.y < canvas.height) activeParticles++;

				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate((p.rotation * Math.PI) / 180);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
				ctx.restore();
			});

			if (activeParticles > 0) {
				animationFrame = requestAnimationFrame(animate);
			} else {
				document.body.removeChild(canvas);
			}
		}
		animate();
	}

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0
		}).format(n);

	// Price calculations (reactive)
	$: originalTotal = $cart.reduce((a, b) => a + (b.originalPrice || b.price), 0);
	$: offerTotal = $cart.reduce((a, b) => a + b.price, 0);
	$: savings = originalTotal - offerTotal;

	// Validation for Glow Effect
	$: isValidForContinue = $cart.length > 0 && selectedDate && selectedTime && userName;
</script>

<svelte:head>
	<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</svelte:head>

<div class="booking-page min-h-screen">
	<!-- Ambient Background -->
	<div class="ambient-bg">
		<div class="orb orb-1"></div>
		<div class="orb orb-2"></div>
		<div class="grid-lines"></div>
	</div>

	{#if success}
		<BookingSuccess
			{userName}
			{selectedDate}
			{selectedTime}
			cartItems={$cart}
			totalPrice={ticketOfferTotal}
			originalTotal={ticketOriginalTotal}
			{paymentType}
			{bookingId}
		/>
	{:else}
		<div class="content-wrapper">
			<header class="page-header" in:fly={{ y: -30, duration: 800, easing: cubicOut }}>
				<div class="header-badges">
					<span class="badge-pill">Premium Experience</span>
				</div>
				<h1 class="main-title">
					Secure Your <span class="text-gradient-gold">Appointment</span>
				</h1>
				<p class="subtitle">Select your preferred slot and we'll handle the rest.</p>
			</header>

			<div class="layout-stack">
				<!-- TOP: BOOKING SUMMARY (Selected Services) -->
				<div class="summary-wrapper-top" in:fly={{ y: 20, duration: 800 }}>
					<div class="glass-sidebar">
						<div class="sidebar-header">
							<h3>Selected Services</h3>
							<span class="badge-count">{$cart.length}</span>
						</div>

						<div class="sidebar-content">
							{#if $cart.length === 0}
								<div class="empty-cart-state">
									<div class="cart-icon-box">
										<ShoppingBag size={28} />
									</div>
									<p>Your cart is empty.</p>
									<a href="/services" class="btn-glass-ghost">Browse and Add Services</a>
								</div>
							{:else}
								<div class="cart-list-vertical">
									{#each $cart as item (item.id)}
										<div
											class="cart-item-vertical"
											transition:slide|local={{ axis: 'y' }}
											animate:flip={{ duration: 400 }}
										>
											<div class="item-icon">
												<Scissors size={14} />
											</div>
											<div class="item-details">
												<span class="item-name">{item.name}</span>
												<div class="item-prices">
													{#if item.originalPrice && item.originalPrice > item.price}
														<span class="price-original">{fmt(item.originalPrice)}</span>
													{/if}
													<span class="price-offer">{fmt(item.price)}</span>
												</div>
											</div>
											<button class="btn-remove" on:click={() => cart.remove(item.id)}>
												<Trash2 size={16} />
											</button>
										</div>
									{/each}
								</div>

								<div class="summary-footer-inline">
									<div class="total-row">
										<span>Total</span>
										<div class="price-display">
											{#if originalTotal > offerTotal}
												<span class="price-original-sm">{fmt(originalTotal)}</span>
											{/if}
											<span class="text-gold font-bold text-lg">{fmt(offerTotal)}</span>
										</div>
									</div>
								</div>
								<a href="/services" class="btn-glass-ghost mt-3 w-full text-center block">
									<span class="plus-icon">+</span> Add More Services
								</a>
							{/if}
						</div>
					</div>
				</div>

				<!-- SPECIAL REQUESTS (Moved to Top) -->
				<section class="glass-section" in:slide={{ duration: 500, delay: 0, axis: 'y' }}>
					<div class="section-label">
						<FileText size={24} class="text-gold" />
						<h3>Special Requests</h3>
					</div>

					<div class="input-stack">
						<!-- Removed Name/Phone Inputs as we use Auth details -->
						<div class="floating-field">
							<textarea id="notes" bind:value={userNotes} placeholder=" " rows="2"></textarea>
							<label for="notes">Notes for stylist (Optional)</label>
						</div>
					</div>
				</section>

				<!-- MAIN FLOW: SELECTION -->
				<div class="form-flow">
					<!-- 1. DATE -->
					<section class="glass-section" in:slide={{ duration: 500, axis: 'y' }}>
						<div class="section-label">
							<div class="step-num">01</div>
							<h3>Select Date</h3>
						</div>

						<!-- Premium Input Trigger -->
						<button class="premium-input-trigger" on:click={openDateModal}>
							<div class="input-content">
								<span class="input-label-mini">Date</span>
								<span class="input-value {selectedDate ? 'active' : 'placeholder'}">
									{selectedDate ? formatDisplayDate(selectedDate) : 'Tap to select date'}
								</span>
							</div>
							<div class="input-icon">
								<Calendar size={20} />
							</div>
						</button>

						<!-- Smart Quick Date Chips -->
						<div class="quick-date-scroll-wrapper">
							<div class="quick-dates-container">
								{#each quickDates as qd}
									<button
										class="quick-date-chip {selectedDate === qd.dateStr ? 'active' : ''}"
										on:click={() => handleQuickDateSelect(qd.dateStr)}
									>
										<span class="chip-label">{qd.label}</span>
										<span class="chip-sub">{qd.sub}</span>
									</button>
								{/each}
							</div>
						</div>
					</section>

					<!-- 2. TIME -->
					<section class="glass-section" in:slide={{ duration: 500, delay: 100, axis: 'y' }}>
						<div class="section-label">
							<div class="step-num">02</div>
							<h3>Select Time</h3>
						</div>

						<!-- Premium Input Trigger -->
						<button class="premium-input-trigger" on:click={openTimeModal}>
							<div class="input-content">
								<span class="input-label-mini">Time</span>
								<span class="input-value {selectedTime ? 'active' : 'placeholder'}">
									{selectedTime ? selectedTime : 'Tap to select time'}
								</span>
							</div>
							<div class="input-icon">
								<Clock size={20} />
							</div>
						</button>
					</section>

					<!-- 3. PAYMENT OPTIONS REMOVED FROM HERE -->

					<!-- PRICE SUMMARY -->
					<div class="price-summary-box">
						{#if savings > 0}
							<div class="price-row original">
								<span>Original Price</span>
								<span class="strike">{fmt(originalTotal)}</span>
							</div>
						{/if}
						<div class="price-row offer">
							<span>Total Amount</span>
							<span class="text-gold font-bold text-xl">{fmt(offerTotal)}</span>
						</div>
						{#if savings > 0}
							<div class="savings-badge">
								🎉 You save {fmt(savings)}!
							</div>
						{/if}
					</div>

					<!-- CONFIRM ACTION -->
					<div class="action-footer mt-6 mb-12">
						<button
							class="btn-primary-shiny w-full text-lg py-5 {shakeButton
								? 'shake-anim'
								: ''} {isValidForContinue ? 'glow-ready' : 'glow-dim'}"
							disabled={isLoadingAuth}
							on:click={handleContinue}
						>
							Continue Booking
						</button>
						<div class="secure-badge mt-4 justify-center flex-col gap-1">
							<div class="flex items-center gap-2">
								<ShieldCheck size={16} class="text-gold" />
								<span
									class="font-medium tracking-wide text-sm"
									style="color: var(--color-text-primary); opacity: 0.9;">100% SECURE BOOKING</span
								>
							</div>
							<span class="text-xs" style="color: var(--color-text-secondary); opacity: 0.7;"
								>{paymentType === 'free' ? 'Pay at Salon' : 'Online Payment Encrypted'}</span
							>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- TOAST NOTIFICATION -->
	{#if showToast}
		<div class="toast-notification" transition:fly={{ y: 50, duration: 300 }}>
			<AlertCircle size={20} />
			<span>{toastMessage}</span>
		</div>
	{/if}

	<!-- SUMMARY MODAL -->
	{#if showSummaryModal}
		<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={closeSummaryModal}>
			<div
				class="summary-modal glass-panel"
				transition:scale={{ start: 0.9, duration: 300, easing: cubicOut }}
				on:click|stopPropagation
			>
				<button class="modal-close-btn" on:click={closeSummaryModal}><X size={20} /></button>

				<div class="summary-header">
					<h3 class="font-cinzel text-2xl font-bold">
						Booking <span class="text-gradient-gold">Summary</span>
					</h3>
					<p>Please review your details before confirming.</p>
				</div>

				<div class="summary-content-scroll">
					<!-- Booking Details Card (Services, Requests, DateTime) -->
					<div class="booking-details-card">
						<div class="card-header">
							<h4>BOOKING DETAILS</h4>
							<button class="edit-link" on:click={closeSummaryModal}>Edit</button>
						</div>

						<!-- Services -->
						<div class="detail-section">
							<span class="detail-label">Services ({$cart.length})</span>
							<div class="summary-list">
								{#each $cart as item}
									<div class="summary-service-card">
										<div class="service-icon-box">
											<Scissors size={18} />
										</div>
										<div class="service-info">
											<span class="service-name">{item.name}</span>
											<span class="service-price">{fmt(item.price)}</span>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Special Requests -->
						<div class="detail-section">
							<span class="detail-label">Special Requests</span>
							{#if userNotes.trim()}
								<div class="special-req-card">
									<div class="req-icon">
										<FileText size={18} />
									</div>
									<p class="req-text">"{userNotes}"</p>
								</div>
							{:else}
								<div class="special-req-empty">
									<span>None</span>
								</div>
							{/if}
						</div>

						<!-- Date & Time -->
						<div class="detail-section">
							<span class="detail-label">Date & Time</span>
							<div class="date-time-row">
								<div class="dt-card date-card">
									<div class="dt-icon">
										<Calendar size={18} />
									</div>
									<div class="dt-info">
										<span class="dt-label">Date</span>
										<span class="dt-value"
											>{selectedDate ? formatDisplayDate(selectedDate) : '-'}</span
										>
									</div>
								</div>
								<div class="dt-card time-card">
									<div class="dt-icon">
										<Clock size={18} />
									</div>
									<div class="dt-info">
										<span class="dt-label">Time</span>
										<span class="dt-value">{selectedTime}</span>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Offers & Rewards Section -->
					<div class="offers-rewards-section mt-4 mb-2">
						<h4 class="text-sm font-bold text-secondary uppercase tracking-wider mb-3 ml-1">
							Offers & Rewards
						</h4>
						
						<!-- View Coupons Button / Applied Coupon -->
						<div class="coupon-input-wrapper mb-3">
							{#if couponApplied}
								<div class="coupon-applied">
									<div class="coupon-badge">
										<Sparkles size={14} />
										<span>{couponCode.toUpperCase()}</span>
									</div>
									<button class="remove-coupon" on:click={removeCoupon}>
										<X size={14} />
									</button>
								</div>
							{:else}
								<button class="view-coupons-btn" on:click={() => showCouponsModal = true}>
									<div class="view-coupons-left">
										<Ticket size={18} class="text-gold" />
										<span>View all coupons & offers</span>
									</div>
									<ChevronRight size={18} class="text-secondary" />
								</button>
							{/if}
						</div>

						<!-- Beu Cash Toggle -->
						<div class="beu-cash-card {beuCashBalance === 0 ? 'empty-balance' : ''}">
							<div class="beu-cash-info">
								<div class="beu-cash-header">
									<Gem size={16} class="text-gold" />
									<span class="font-bold">Beu Cash Balance: {fmt(beuCashBalance)}</span>
								</div>
								{#if beuCashBalance > 0}
									<p class="beu-cash-subtext">Use up to 30% ({fmt(maxBeuCashAllowed)}) of your subtotal.</p>
								{:else}
									<p class="beu-cash-subtext">Earn Beu Cash on your bookings to use here!</p>
								{/if}
							</div>
							<div class="beu-cash-action">
								<label class="switch-container" style={beuCashBalance === 0 ? 'opacity: 0.5; pointer-events: none;' : ''}>
									<input type="checkbox" bind:checked={useBeuCash} disabled={beuCashBalance === 0} />
									<span class="slider round"></span>
								</label>
							</div>
						</div>
					</div>

					<!-- Price Breakdown Section -->
					<div class="totals-section mt-2">
						<div class="receipt-box">
							<div class="price-breakdown">
								<div class="breakdown-row">
								<span>Original Amount</span>
								<span>{fmt(originalTotal)}</span>
							</div>

							{#if offersDiscount > 0}
								<div class="breakdown-row discount">
									<span>Offers Discount</span>
									<span class="text-green">-{fmt(offersDiscount)}</span>
								</div>
							{/if}

							{#if couponDiscount > 0}
								<div class="breakdown-row discount">
									<span>Coupon Discount</span>
									<span class="text-green">-{fmt(couponDiscount)}</span>
								</div>
							{/if}

							{#if actualBeuCashApplied > 0}
								<div class="breakdown-row discount">
									<span>Beu Cash Used</span>
									<span class="text-green">-{fmt(actualBeuCashApplied)}</span>
								</div>
							{/if}

							{#if totalSavings > 0}
								<div class="savings-row">
									<Sparkles size={14} class="text-gold" />
									<span>You Saved {fmt(totalSavings)}</span>
								</div>
							{/if}

							<div class="total-row">
								<span>Total Amount</span>
								<span class="text-gold">{fmt(finalTotal)}</span>
							</div>
						</div>
						</div>
					</div>

					<!-- Payment Method Section (Outside Card) -->
					<div class="payment-section-standalone mt-2">
						<h4 class="text-sm font-bold text-secondary uppercase tracking-wider mb-3 ml-1">
							Payment Method
						</h4>
						<div class="payment-options-grid">
							<button
								class="payment-option compact {paymentType === 'full' ? 'active' : ''}"
								on:click={() => (paymentType = 'full')}
							>
								<div class="option-icon-wrapper">
									<Check size={20} />
								</div>
								<div class="option-content">
									<span class="option-label">Pay Online</span>
								</div>
								<div class="price-tag-badge">{fmt(offerTotal)}</div>
							</button>

							<button
								class="payment-option compact {paymentType === 'token' ? 'active' : ''}"
								on:click={() => (paymentType = 'token')}
							>
								<div class="option-icon-wrapper">
									<Sparkles size={20} />
								</div>
								<div class="option-content">
									<span class="option-label">Book with ₹50</span>
									{#if paymentType === 'token'}
										<span class="option-sub-info" transition:slide|local={{ duration: 200 }}>Adjusted in final bill • Pay <strong>{fmt(Math.max(0, finalTotal - 50))}</strong> at salon</span>
									{/if}
								</div>
								<div class="price-tag-badge">₹50</div>
							</button>

							<button
								class="payment-option compact {paymentType === 'free' ? 'active' : ''}"
								on:click={() => (paymentType = 'free')}
							>
								<div class="option-icon-wrapper">
									<MapPin size={20} />
								</div>
								<div class="option-content">
									<span class="option-label">Pay at Salon</span>
								</div>
								<div class="radio-indicator"></div>
							</button>
						</div>

						<!-- INLINE SUB METHODS -->
						{#if paymentType === 'token' || paymentType === 'full'}
							{#if $appSettings.defaultPaymentGateway !== 'razorpay'}
								<div class="payment-sub-methods" transition:slide>
									<div class="section-label-sm">
										<h4>Select Payment Method</h4>
									</div>
								<div class="detailed-payment-grid">
									<button
										class="method-card {selectedPaymentMethod === 'upi' ? 'active' : ''}"
										on:click={() => handlePaymentMethodSelect('upi')}
									>
										<Smartphone size={20} />
										<span>UPI</span>
									</button>
									<button
										class="method-card {selectedPaymentMethod === 'qr' ? 'active' : ''}"
										on:click={() => handlePaymentMethodSelect('qr')}
									>
										<QrCode size={20} />
										<span>QR</span>
									</button>
									<button
										class="method-card {bouncingMethod === 'card' ? 'shake-anim' : ''}"
										on:click={() => handlePaymentMethodSelect('card')}
									>
										<CreditCard size={20} />
										<span>Card</span>
									</button>
									<button
										class="method-card {bouncingMethod === 'erupee' ? 'shake-anim' : ''}"
										on:click={() => handlePaymentMethodSelect('erupee')}
									>
										<Banknote size={20} />
										<span>e-Rupee</span>
									</button>
									<button
										class="method-card {bouncingMethod === 'crypto' ? 'shake-anim' : ''}"
										on:click={() => handlePaymentMethodSelect('crypto')}
									>
										<Bitcoin size={20} />
										<span>Crypto</span>
									</button>
									<button
										class="method-card {bouncingMethod === 'paylater' ? 'shake-anim' : ''}"
										on:click={() => handlePaymentMethodSelect('paylater')}
									>
										<Clock size={20} />
										<span>Pay Later</span>
									</button>
								</div>

								{#if showUPIApps && selectedPaymentMethod === 'upi'}
									<div class="upi-apps-row" transition:slide>
										<div class="upi-app-icon">GPay</div>
										<div class="upi-app-icon">PhonePe</div>
										<div class="upi-app-icon">Paytm</div>
										<div class="upi-app-icon">BHIM</div>
									</div>
								{/if}
							</div>
							{:else}
								<p style="color: var(--color-text-secondary); font-weight: 500; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 5px; margin: 8px 0 0; opacity: 0.75;">
								<ShieldCheck size={15} /> Secure Online Checkout
							</p>
							{/if}
						{/if}

						{#if paymentType === 'token'}
							<div class="token-breakup" transition:slide>
								<div class="token-breakup-header">
									<Sparkles size={14} />
									<span>Payment Summary</span>
								</div>
								<div class="breakdown-row">
									<span>Pay Now</span>
									<span class="text-gold">₹50</span>
								</div>
								<div class="breakdown-row rest-at-salon">
									<span>Pay at Salon</span>
									<span>{fmt(Math.max(0, finalTotal - 50))}</span>
								</div>
								<p class="token-adjust-note">₹50 will be adjusted in your final bill. No extra charges.</p>
							</div>
						{/if}
					</div>
				</div>

				<div class="summary-actions">
					<button
						class="btn-primary-shiny w-full text-lg py-4"
						disabled={isSubmitting ||
							paymentType === '' ||
							(paymentType !== 'free' && $appSettings.defaultPaymentGateway !== 'razorpay' && !selectedPaymentMethod)}
						on:click={submitBooking}
					>
						{#if isSubmitting}
							<div class="spinner"></div>
							Confirming...
						{:else if paymentType === 'free'}
							Confirm Appointment
						{:else if paymentType === 'token'}
							Book with ₹50 & Confirm
						{:else}
							Pay {fmt(offerTotal)} & Book
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- COUPONS MODAL -->
	{#if showCouponsModal}
		<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={() => showCouponsModal = false}>
			<div
				class="summary-modal glass-panel coupons-modal"
				transition:fly={{ y: 50, duration: 300, easing: cubicOut }}
				on:click|stopPropagation
			>
				<div class="summary-header">
					<div class="header-left">
						<Ticket size={24} class="text-gold" />
						<div>
							<h3>Apply Coupon</h3>
							<p class="text-xs text-secondary">Unlock special offers</p>
						</div>
					</div>
					<button class="close-btn" on:click={() => showCouponsModal = false}>
						<X size={20} />
					</button>
				</div>

				<div class="summary-body coupons-body">
					<!-- Manual Input -->
					<div class="manual-coupon-input mb-4">
						<div class="coupon-input-row">
							<input
								type="text"
								placeholder="Enter coupon code"
								bind:value={couponCode}
								class="coupon-input"
								disabled={isApplyingCoupon}
							/>
							<button
								class="apply-coupon-btn"
								on:click={applyCoupon}
								disabled={isApplyingCoupon || !couponCode.trim()}
							>
								{#if isApplyingCoupon}
									<div class="spinner-sm"></div>
								{:else}
									Apply
								{/if}
							</button>
						</div>
						{#if couponError}
							<p class="coupon-error">{couponError}</p>
						{/if}
					</div>

					<div class="section-divider mb-4"></div>

					<h4 class="text-sm font-bold text-secondary uppercase tracking-wider mb-3">
						Available Coupons
					</h4>

					<div class="coupons-list">
						{#each availableCoupons as coupon}
							<div class="coupon-card">
								<div class="coupon-card-left">
									<div class="coupon-code-badge">{coupon.code}</div>
									<div class="coupon-desc-bold">{coupon.discountText}</div>
									<div class="coupon-desc-sub">{coupon.description}</div>
								</div>
								<div class="coupon-card-right">
									<button class="apply-text-btn" on:click={() => { couponCode = coupon.code; applyCoupon(); }}>
										APPLY
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- DATE PICKER MODAL -->
	{#if showDateModal}
		<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={closeDateModal}>
			<div
				class="custom-picker-modal glass-panel"
				transition:scale={{ start: 0.9, duration: 300, easing: cubicOut }}
				on:click|stopPropagation
			>
				<button class="modal-close-btn" on:click={closeDateModal}><X size={20} /></button>

				<div class="picker-header">
					{#if !isCurrentMonthView}
						<button class="nav-arrow-btn" on:click={() => changeMonth(-1)}>
							<ChevronLeft size={20} />
						</button>
					{:else}
						<div class="w-9 h-9"></div>
						<!-- Spacer -->
					{/if}
					<h3 class="current-month-label">
						{currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
					</h3>
					{#if !isMaxMonthView}
						<button class="nav-arrow-btn" on:click={() => changeMonth(1)}>
							<ChevronRight size={20} />
						</button>
					{:else}
						<div class="w-9 h-9"></div>
					{/if}
				</div>

				<div class="weekdays-grid">
					<span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span
					><span>Sa</span>
				</div>

				<div class="custom-calendar-grid">
					{#each calendarDays as day}
						{#if day.isPadding}
							<div class="cal-day empty"></div>
						{:else}
							<button
								class="cal-day {day.available ? 'available' : 'disabled'} {selectedDate ===
								day.dateStr
									? 'selected'
									: ''}"
								disabled={!day.available}
								on:click={() => handleDateSelect(day.dateStr)}
							>
								{day.day}
							</button>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- TIME PICKER MODAL -->
	{#if showTimeModal}
		<div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={closeTimeModal}>
			<div
				class="custom-picker-modal glass-panel"
				transition:scale={{ start: 0.9, duration: 300, easing: cubicOut }}
				on:click|stopPropagation
			>
				<button class="modal-close-btn" on:click={closeTimeModal}><X size={20} /></button>

				<div class="picker-header">
					<h3 class="current-month-label">Select Time</h3>
				</div>

				{#if timeSlots.length === 0}
					<div class="empty-state-box">
						<Clock size={32} class="opacity-40 mb-2" />
						<p>No slots available for this date.</p>
					</div>
				{:else}
					<div class="time-slot-grid">
						{#each timeSlots as t}
							<button
								class="time-slot {selectedTime === t ? 'selected' : ''}"
								on:click={() => handleTimeSelect(t)}
							>
								{t}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-family: var(--font-body);
		overflow-x: hidden;
		width: 100%;
	}

	.booking-page {
		position: relative;
		padding-top: 100px;
		padding-bottom: 80px;
		overflow-x: hidden;
		min-height: 100vh;
		width: 100%;
	}

	.content-wrapper {
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
		padding: 0 20px;
		position: relative;
		z-index: 2;
		box-sizing: border-box;
	}

	/* BACKGROUND */
	.ambient-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background: radial-gradient(
			circle at top center,
			var(--color-bg-secondary) 0%,
			var(--color-bg-primary) 70%
		);
	}
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(120px);
		opacity: 0.4;
		animation: float 15s ease-in-out infinite;
	}
	.orb-1 {
		top: -10%;
		left: -10%;
		width: 50vw;
		height: 50vw;
		background: var(--color-accent-gold); /* Dynamic Accent */
	}
	.orb-2 {
		bottom: 10%;
		right: -10%;
		width: 40vw;
		height: 40vw;
		background: var(--color-accent-rose); /* Dynamic Rose/Secondary */
		animation-delay: -7s;
	}
	.grid-lines {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(212, 175, 55, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(212, 175, 55, 0.05) 1px, transparent 1px);
		background-size: 50px 50px;
		mask-image: radial-gradient(circle, black 40%, transparent 90%);
		opacity: 0.3;
	}
	@keyframes float {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(20px, 30px);
		}
	}

	/* TYPOGRAPHY Helpers */
	.text-gradient-gold {
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
	}
	.font-cinzel {
		font-family: var(--font-heading);
	}
	:global(.text-gold) {
		color: var(--color-accent-gold);
	}

	/* GLASS PANEL UTILS - DEEP */
	.glass-panel {
		background: var(--color-bg-glass);
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid var(--color-border);
		box-shadow:
			var(--color-card-shadow),
			inset 0 0 0 1px var(--color-surface);
	}

	.glass-section {
		background: var(--color-bg-glass);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 24px;
		margin-bottom: 24px;
		transition: var(--transition-smooth);
		width: 100%;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
		box-shadow: var(--color-card-shadow);
	}
	/* Subtle noise texture overlay */
	.glass-section::before {
		content: '';
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E");
		pointer-events: none;
		opacity: 0.5;
		z-index: 0;
	}
	.glass-section > * {
		position: relative;
		z-index: 1;
	}

	.glass-section:hover {
		border-color: var(--color-border-hover);
		box-shadow: 0 10px 40px rgba(var(--color-shadow-rgb), 0.15);
		transform: translateY(-2px);
	}

	/* PREMIUM INPUT TRIGGER (Replacing Minimal Input) */
	.premium-input-trigger {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		border-radius: var(--radius-md);
		padding: 16px 20px;
		cursor: pointer;
		transition: var(--transition-fast);
		position: relative;
		overflow: hidden;
		box-sizing: border-box;
	}
	.premium-input-trigger:hover:not(.disabled) {
		background: var(--color-surface-hover);
		border-color: var(--color-accent-gold);
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(var(--color-shadow-rgb), 0.12);
	}
	.premium-input-trigger.disabled {
		opacity: 0.5;
		cursor: not-allowed;
		filter: grayscale(1);
	}

	.input-content {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.input-label-mini {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-text-secondary);
		font-weight: 600;
	}
	.input-value {
		font-size: 1.1rem;
		font-weight: 500;
		color: var(--color-text-primary);
	}
	.input-value.placeholder {
		color: var(--color-text-secondary);
		font-style: italic;
		opacity: 0.7;
	}
	.input-value.active {
		color: var(--color-accent-gold);
		text-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
	}

	.input-icon {
		color: var(--color-text-secondary);
		transition: color 0.3s;
	}
	.premium-input-trigger:hover .input-icon {
		color: var(--color-accent-gold);
	}

	/* HEADER */
	.page-header {
		text-align: center;
		margin-bottom: 50px;
		padding: 0 20px;
		max-width: 800px;
		margin-left: auto;
		margin-right: auto;
	}
	.header-badges {
		display: flex;
		justify-content: center;
		margin-bottom: 16px;
	}
	.badge-pill {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 2px;
		background: rgba(212, 175, 55, 0.1);
		border: 1px solid var(--color-accent-gold);
		color: var(--color-accent-gold);
		padding: 6px 16px;
		border-radius: 100px;
	}
	.main-title {
		font-family: var(--font-heading);
		/* Fallback for older browsers / linters */
		font-size: clamp(1.8rem, 5vw, 3.5rem);
		/* Modern Container Query Unit */
		font-size: clamp(1.8rem, 10cqw, 3.5rem);
		line-height: 1.1;
		margin-bottom: 12px;
		font-weight: 700;
	}
	.subtitle {
		font-size: 1rem;
		color: var(--color-text-secondary);
		font-weight: 300;
	}

	/* LAYOUT */
	.layout-stack {
		display: grid;
		gap: 30px;
		grid-template-columns: minmax(0, 1fr);
		width: 100%;
	}
	@media (min-width: 900px) {
		.layout-stack {
			grid-template-columns: 350px 1fr;
			align-items: start;
		}
		.summary-wrapper-top {
			position: sticky;
			top: 100px; /* Sticky sidebar on desktop */
		}
	}

	/* SIDEBAR CART */
	.glass-sidebar {
		background: var(--color-bg-glass);
		backdrop-filter: blur(20px);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
		box-shadow: var(--color-card-shadow);
	}
	.sidebar-header {
		padding: 20px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.sidebar-header h3 {
		font-weight: 600;
		letter-spacing: 0.5px;
	}
	.badge-count {
		background: var(--color-accent-gold);
		color: #000;
		font-weight: 700;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-size: 0.8rem;
	}
	.sidebar-content {
		padding: 20px;
	}
	.empty-cart-state {
		text-align: center;
		padding: 30px 0;
		color: var(--color-text-secondary);
	}
	.cart-icon-box {
		margin-bottom: 12px;
		opacity: 0.5;
	}
	.btn-glass-ghost {
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		color: var(--color-btn-text);
		font-weight: 600;
		padding: 14px;
		border-radius: var(--radius-md);
		transition: all 0.3s ease;
		text-decoration: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 16px;
	}
	.btn-glass-ghost:hover {
		background: var(--color-btn-hover-bg);
		border-color: var(--color-accent-gold);
		transform: translateY(-2px);
		box-shadow: var(--shadow-gold);
	}
	.plus-icon {
		color: var(--color-accent-gold);
		font-weight: bold;
		font-size: 1.2rem;
		line-height: 0;
		margin-bottom: 2px;
	}

	/* Price Row in Cart */
	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}
	.price-display {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.price-original-sm {
		text-decoration: line-through;
		opacity: 0.5;
		font-size: 0.9rem;
	}

	/* Cart Items */
	.cart-list-vertical {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.cart-item-vertical {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--color-surface);
		padding: 12px;
		border-radius: 12px;
		border: 1px solid var(--color-border);
	}
	.item-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: rgba(var(--color-accent-gold-rgb), 0.12);
		color: var(--color-accent-gold);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.item-details {
		flex: 1;
	}
	.item-name {
		font-size: 0.95rem;
		font-weight: 500;
		display: block;
	}
	.item-prices {
		display: flex;
		gap: 8px;
		font-size: 0.85rem;
	}
	.price-original {
		text-decoration: line-through;
		opacity: 0.5;
	}
	.price-offer {
		color: var(--color-accent-gold);
	}
	.btn-remove {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: rgba(255, 77, 77, 0.06);
		border: 1px solid rgba(255, 77, 77, 0.2);
		color: #e05555;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
		padding: 0;
	}
	.btn-remove:hover {
		color: #ff4d4d;
		background: rgba(255, 77, 77, 0.15);
		border-color: rgba(255, 77, 77, 0.4);
	}
	.summary-footer-inline {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px dashed var(--color-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	/* SECTION LABELS */
	.section-label {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 20px;
	}
	.step-num {
		font-family: var(--font-heading);
		font-size: 2rem;
		color: rgba(var(--color-text-primary-rgb), 0.12);
		font-weight: 900;
		line-height: 1;
	}
	.section-label h3 {
		font-size: 1.25rem;
		font-weight: 600;
	}

	/* INPUTS (Notes) */
	.floating-field {
		position: relative;
	}
	.floating-field textarea {
		width: 100%;
		background: var(--color-input-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		padding: 16px;
		color: var(--color-text-primary);
		font-size: 1rem;
		font-family: var(--font-body);
		outline: none;
		transition: all 0.3s;
		resize: none;
		box-sizing: border-box;
	}
	.floating-field textarea:focus {
		border-color: var(--color-accent-gold);
		box-shadow: 0 0 0 2px rgba(var(--color-accent-gold-rgb), 0.15);
	}
	.floating-field label {
		position: absolute;
		left: 16px;
		top: 16px;
		color: var(--color-text-secondary);
		pointer-events: none;
		transition: all 0.2s;
	}
	.floating-field textarea:focus ~ label,
	.floating-field textarea:not(:placeholder-shown) ~ label {
		top: -10px;
		left: 12px;
		font-size: 0.8rem;
		background: var(--color-bg-glass-heavy);
		padding: 0 6px;
		color: var(--color-accent-gold);
	}

	/* QUICK DATES (Smart Logic) */
	.quick-date-scroll-wrapper {
		margin-top: 16px;
		overflow-x: auto;
		padding-bottom: 8px; /* For scrollbar */
	}
	.quick-dates-container {
		display: flex;
		gap: 10px;
		min-width: min-content;
	}
	.quick-date-chip {
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		border-radius: 12px;
		padding: 10px 16px;
		min-width: 100px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.quick-date-chip:hover {
		background: var(--color-btn-hover-bg);
		transform: translateY(-2px);
	}
	.quick-date-chip.active {
		background: var(--color-surface-active);
		border-color: var(--color-accent-gold);
		box-shadow: var(--shadow-gold);
	}
	.chip-label {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text-primary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}
	.chip-sub {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
	}
	.quick-date-chip.active .chip-label {
		color: var(--color-accent-gold);
	}

	/* PAYMENT OPTIONS REDESIGN */
	.payment-options-grid {
		display: grid;
		gap: 16px;
	}
	.payment-option {
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		padding: 20px;
		border-radius: 20px;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 16px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}
	.payment-option:hover {
		background: var(--color-btn-hover-bg);
		transform: scale(1.01);
	}
	.payment-option.active {
		border-color: var(--color-accent-gold);
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%);
		box-shadow:
			0 10px 40px rgba(212, 175, 55, 0.2),
			0 0 0 1px rgba(212, 175, 55, 0.4) inset; /* Inner glow border */
		transform: translateY(-2px);
	}

	.option-icon-wrapper {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-secondary);
		transition: all 0.3s;
		flex-shrink: 0;
	}
	.payment-option.active .option-icon-wrapper {
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		box-shadow: 0 4px 15px rgba(var(--color-accent-gold-rgb), 0.3);
	}

	.option-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.option-label {
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--color-text-primary);
		font-family: var(--font-heading);
	}
	.option-desc {
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		line-height: 1.4;
	}
	.option-sub-info {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		opacity: 0.65;
		line-height: 1.3;
	}
	.option-sub-info strong {
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	/* Rest at salon row — muted, smaller */
	.breakdown-row.rest-at-salon {
		font-size: 0.8rem;
		opacity: 0.55;
	}

	/* Token Payment Breakup */
	.token-adjust-note {
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		opacity: 0.6;
		margin: 8px 0 0;
		line-height: 1.4;
		font-style: italic;
	}
	.token-breakup {
		margin-top: 12px;
		padding: 12px 14px;
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 100%);
		border: 1px solid rgba(212, 175, 55, 0.2);
		border-radius: 12px;
	}
	.token-breakup-header {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-accent-gold);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px dashed rgba(212, 175, 55, 0.2);
	}

	.price-tag-badge {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		padding: 6px 12px;
		border-radius: 100px;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text-primary);
		white-space: nowrap;
	}
	.payment-option.active .price-tag-badge {
		background: rgba(var(--color-bg-primary-rgb), 0.3);
		color: var(--color-accent-gold);
		border: 1px solid rgba(var(--color-accent-gold-rgb), 0.3);
	}

	.radio-indicator {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid var(--color-border-strong);
		position: relative;
		flex-shrink: 0;
	}
	.payment-option.active .radio-indicator {
		border-color: var(--color-accent-gold);
		background: var(--color-accent-gold);
		box-shadow: 0 0 10px rgba(var(--color-accent-gold-rgb), 0.4);
	}
	.payment-option.active .radio-indicator::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 10px;
		height: 10px;
		background: var(--color-bg-primary);
		border-radius: 50%;
	}

	/* CUSTOM MODAL */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1100;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
	.custom-picker-modal {
		width: 100%;
		max-width: 400px;
		background: var(--color-bg-glass-heavy);
		border-radius: var(--radius-lg);
		padding: 24px;
		position: relative;
		overflow: hidden;
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
		backdrop-filter: blur(40px);
		-webkit-backdrop-filter: blur(40px);
	}
	.modal-close-btn {
		position: absolute;
		right: 16px;
		top: 16px;
		color: var(--color-text-secondary);
		background: rgba(var(--color-bg-secondary-rgb), 0.5);
		border-radius: 50%;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		z-index: 20;
		transition: all 0.2s;
	}
	.modal-close-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}
	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
		margin-top: 40px; /* Push down to avoid close button conflict if tight */
		padding: 0 10px;
	}
	.current-month-label {
		font-family: var(--font-heading);
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.nav-arrow-btn {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		color: var(--color-text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
	}
	.nav-arrow-btn:hover {
		background: var(--color-btn-hover-bg);
		border-color: var(--color-accent-gold);
	}

	/* SUMMARY MODAL CSS */
	.summary-modal {
		width: 100%;
		max-width: 500px;
		background: var(--color-bg-primary);
		border-radius: 24px; /* More rounded */
		display: flex;
		flex-direction: column;
		height: 98vh;
		max-height: 98vh; /* Almost full screen */
		overflow: hidden;
		border: 1px solid var(--color-border);
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.1) inset; /* Inner highlight */
	}

	.summary-header {
		padding: 24px 24px 16px;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-bg-secondary); /* Slight contrast from body */
	}
	.summary-header h3 {
		/* Font styling moved to utility classes in HTML */
		margin-bottom: 4px;
		color: var(--color-text-primary);
	}
	.summary-header p {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}
	.summary-content-scroll {
		padding: 24px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 24px;
		background: var(--color-bg-primary);
	}

	/* New Booking Details Card Style */
	.booking-details-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 20px;
		box-shadow: var(--shadow-sm);
	}
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		padding-bottom: 12px;
		border-bottom: 1px dashed var(--color-border);
	}
	.card-header h4 {
		font-family: var(--font-heading);
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 1px;
		color: var(--color-text-secondary);
		margin: 0;
	}
	.edit-link {
		font-size: 0.85rem;
		color: var(--color-accent-brand);
		text-decoration: underline;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
	}
	.detail-section {
		margin-bottom: 16px;
	}
	.detail-section:last-child {
		margin-bottom: 0;
	}
	.booking-details-card .detail-section:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}
	.booking-details-card .detail-label {
		font-size: 0.85rem;
		font-weight: 800; /* Bolder */
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-accent-gold); /* Gold Label */
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}
	.booking-details-card .detail-label::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(to right, var(--color-border), transparent);
		opacity: 0.5;
	}
	.booking-details-card .detail-value {
		color: var(--color-text-primary);
		opacity: 0.9;
		font-size: 0.95rem;
		margin: 0;
	}
	.detail-label {
		display: block;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-text-tertiary); /* Muted label */
		margin-bottom: 6px;
		font-weight: 600;
	}
	.detail-value {
		font-size: 1rem;
		color: var(--color-text-primary);
		font-weight: 500;
	}
	.summary-section h4 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-text-secondary);
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px dashed var(--color-border);
	}
	/* Services List as Cards */
	.summary-service-card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		padding: 12px;
		border-radius: 12px;
		transition: transform 0.2s;
	}
	.summary-service-card:hover {
		transform: translateX(4px);
		border-color: var(--color-accent-gold);
		background: rgba(212, 175, 55, 0.05);
	}
	.service-icon-box {
		width: 36px;
		height: 36px;
		background: rgba(var(--color-accent-gold-rgb), 0.1);
		color: var(--color-accent-gold);
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.service-info {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.service-name {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--color-text-primary);
	}
	.service-price {
		font-size: 0.9rem;
		color: var(--color-accent-gold);
		font-weight: 700;
	}

	.summary-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.summary-item {
		/* Legacy fallback */
		display: flex;
		justify-content: space-between;
		font-size: 1rem;
	}
	.summary-actions {
		padding: 20px 24px;
		background: var(--color-surface); /* Matches card header/footer logic */
		border-top: 1px solid var(--color-border);
	}

	/* CALENDAR GRID */
	.weekdays-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		text-align: center;
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-bottom: 12px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.custom-calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 8px;
	}
	.cal-day {
		aspect-ratio: 1;
		border-radius: 12px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--color-text-primary);
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.cal-day.available {
		background: var(--color-available-bg);
		border-color: var(--color-available-border);
		color: var(--color-available-text);
		font-weight: 600;
	}
	.cal-day.available:hover {
		background: var(--color-available-border);
		color: #fff;
	}
	.cal-day.selected {
		background: var(--color-accent-gold);
		color: black;
		font-weight: 700;
		box-shadow: 0 0 15px rgba(212, 175, 55, 0.4);
	}
	.cal-day.disabled {
		opacity: 0.2;
		cursor: not-allowed;
	}

	/* TIME SLOT GRID */
	.time-slot-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.time-slot {
		padding: 12px;
		border-radius: 12px;
		background: var(--color-available-bg);
		border: 1px solid var(--color-available-border);
		color: var(--color-available-text);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}
	.time-slot:hover {
		background: var(--color-available-border);
		color: #fff;
	}
	.time-slot.selected {
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		border-color: var(--color-accent-gold);
		box-shadow: 0 0 15px rgba(var(--color-accent-gold-rgb), 0.4);
	}

	/* PRICE SUMMARY */
	.price-summary-box {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 20px;
		margin-top: 24px;
	}
	.price-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
		opacity: 0.8;
	}
	.price-row.offer {
		opacity: 1;
		font-size: 1.1rem;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}
	.strike {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.savings-badge {
		background: rgba(76, 175, 80, 0.2);
		color: #4caf50;
		text-align: center;
		padding: 8px;
		border-radius: 8px;
		margin-top: 12px;
		font-size: 0.9rem;
	}

	.btn-primary-shiny {
		background: var(--gradient-gold);
		color: #1a1a1a;
		font-weight: 800;
		border-radius: var(--radius-md);
		transition:
			var(--transition-bounce),
			box-shadow 0.3s ease;
		position: relative;
		overflow: hidden;
		border: none;
		width: 100%; /* Ensure full width */
		display: block; /* Ensure it takes up space */
		padding: 1rem; /* Ensure padding */
		font-size: 1.125rem; /* Ensure readable font size */
		line-height: 1.75rem;
	}
	.btn-primary-shiny.glow-dim {
		opacity: 0.9;
		box-shadow: none;
		background: linear-gradient(135deg, #cecece 0%, #a0a0a0 100%);
		color: #444;
	}
	.btn-primary-shiny.glow-ready {
		box-shadow:
			var(--shadow-gold),
			0 0 20px rgba(212, 175, 55, 0.6);
		animation: pulse-gold 2s infinite;
	}
	@keyframes pulse-gold {
		0% {
			box-shadow:
				var(--shadow-gold),
				0 0 20px rgba(212, 175, 55, 0.6);
		}
		50% {
			box-shadow:
				var(--shadow-gold),
				0 0 35px rgba(212, 175, 55, 0.9);
		}
		100% {
			box-shadow:
				var(--shadow-gold),
				0 0 20px rgba(212, 175, 55, 0.6);
		}
	}
	.btn-primary-shiny:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 15px 40px rgba(212, 175, 55, 0.4);
	}
	.btn-primary-shiny:disabled {
		opacity: 0.5; /* Semi-transparent */
		cursor: not-allowed;
		filter: none; /* Removed grayscale */
		transform: none !important;
		box-shadow: none;
	}

	/* PAYMENT METHODS */
	.payment-methods-wrapper {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px dashed var(--color-border);
	}
	.section-label-sm h4 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-text-secondary);
		margin-bottom: 12px;
	}
	/* GRID SUB METHODS */
	.detailed-payment-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-top: 12px;
	}
	.method-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 16px 8px;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		color: var(--color-text-secondary);
	}
	.method-card:hover {
		background: var(--color-surface-hover);
		transform: translateY(-3px);
		border-color: var(--color-accent-gold);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.15);
		color: var(--color-text-primary);
	}
	.method-card.active {
		background: linear-gradient(135deg, #ffd700 0%, #fdb931 100%); /* Gold Gradient */
		color: black;
		border-color: #fdb931;
		box-shadow: 0 4px 15px rgba(253, 185, 49, 0.4);
		font-weight: 600;
	}

	/* Method Icons Colors (When not active) */
	.method-card :global(svg) {
		transition: all 0.2s;
		opacity: 0.7;
	}
	.method-card:hover :global(svg) {
		opacity: 1;
		transform: scale(1.1);
	}
	.method-card.active :global(svg) {
		opacity: 1;
		color: black !important; /* Force black icon on gold bg */
	}

	/* Specific Icon Colors for vibrancy */
	.method-card:nth-child(1) :global(svg) {
		color: #4caf50;
	} /* UPI - Green */
	.method-card:nth-child(2) :global(svg) {
		color: #2196f3;
	} /* QR - Blue */
	.method-card:nth-child(3) :global(svg) {
		color: #ff9800;
	} /* Card - Orange */
	.method-card:nth-child(4) :global(svg) {
		color: #009688;
	} /* eRupee - Teal */
	.method-card:nth-child(5) :global(svg) {
		color: #f44336;
	} /* Crypto - Red */
	.method-card:nth-child(6) :global(svg) {
		color: #9c27b0;
	} /* PayLater - Purple */

	.method-card span {
		font-size: 0.8rem;
		text-align: center;
	}

	.upi-apps-row {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 16px;
		padding: 10px;
		background: var(--color-surface);
		border-radius: 12px;
	}
	.upi-app-icon {
		width: 50px;
		height: 50px;
		border-radius: 12px;
		background: #fff;
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.7rem;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
	}

	.upi-apps-row {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 16px;
		padding: 10px;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 12px;
	}
	.upi-app-icon {
		width: 50px;
		height: 50px;
		border-radius: 12px;
		background: #fff;
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.7rem;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
	}

	/* SHAKE ANIMATION */
	.shake-anim {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}
	@keyframes shake {
		10%,
		90% {
			transform: translate3d(-1px, 0, 0);
		}
		20%,
		80% {
			transform: translate3d(2px, 0, 0);
		}
		30%,
		50%,
		70% {
			transform: translate3d(-4px, 0, 0);
		}
		40%,
		60% {
			transform: translate3d(4px, 0, 0);
		}
	}

	.secure-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		opacity: 0.9;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-text-primary);
	}

	/* TOAST */
	.toast-notification {
		position: fixed;
		bottom: 100px;
		left: 50%;
		transform: translateX(-50%) !important; /* Override fly transform for X centering */
		background: rgba(255, 50, 50, 0.9);
		color: white;
		padding: 12px 24px;
		border-radius: 50px;
		display: flex;
		align-items: center;
		gap: 10px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
		z-index: 2000;
		font-weight: 500;
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		white-space: nowrap;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(0, 0, 0, 0.3);
		border-top: 2px solid #000;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		display: inline-block;
		margin-right: 8px;
	}
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.btn-primary-shiny {
			position: relative;
			bottom: auto;
			left: auto;
			right: auto;
			width: 100%;
			z-index: 1;
			box-shadow: var(--shadow-gold);
		}
		.action-footer {
			margin-bottom: 0;
			padding-bottom: 100px; /* Space for the 70px nav bar */
		}
	}

	/* Payment Option Compact (for Summary) */
	.payment-option.compact {
		padding: 12px;
		gap: 12px;
	}
	.payment-option.compact .option-icon-wrapper {
		width: 36px;
		height: 36px;
	}
	.payment-option.compact .option-label {
		font-size: 0.9rem;
	}
	.payment-option.compact .price-tag-badge {
		padding: 4px 8px;
		font-size: 0.8rem;
	}

	/* Summary Cards Phase 2 */
	.summary-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		padding: 16px;
		margin-bottom: 16px;
	}
	.summary-card h4 {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-text-muted);
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}
	.booking-details-card .detail-section {
		margin-bottom: 20px;
		padding-bottom: 0; /* Remove border separation for cleaner card look */
		border-bottom: none;
	}

	/* SPECIAL REQUEST CARD */
	.special-req-card {
		background: rgba(255, 235, 59, 0.12);
		border: 1px dashed rgba(253, 216, 53, 0.5);
		padding: 12px;
		border-radius: 12px;
		display: flex;
		gap: 12px;
		align-items: flex-start;
		position: relative;
	}
	.req-icon {
		color: #fbc02d; /* Darker Yellow/Gold */
		margin-top: 2px;
		flex-shrink: 0;
	}
	.req-text {
		color: var(--color-text-primary);
		font-size: 0.9rem;
		line-height: 1.4;
		font-weight: 500;
		font-style: italic;
		word-break: break-word;
	}
	.special-req-empty {
		color: var(--color-text-muted);
		font-style: italic;
		font-size: 0.9rem;
		padding: 4px 8px;
		background: rgba(0, 0, 0, 0.03);
		border-radius: 6px;
		display: inline-block;
	}

	/* DATE TIME CARDS */
	.date-time-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		max-width: 100%; /* Prevent overflow */
	}
	.dt-card {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		padding: 10px; /* Reduced specific padding */
		border-radius: 12px;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0; /* CRITICAL: Allows grid item to shrink below content size */
		overflow: hidden; /* Contains overflow */
	}
	.dt-icon {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0; /* Prevent icon shrinking */
	}
	.date-card .dt-icon {
		background: white;
		color: #1976d2;
	}
	.time-card .dt-icon {
		background: white;
		color: #7b1fa2;
	}

	/* Specific Backgrounds for Date/Time Cards */
	.date-card {
		background: rgba(33, 150, 243, 0.08); /* Light Blue Tint */
		border-color: rgba(33, 150, 243, 0.2);
	}
	.time-card {
		background: rgba(156, 39, 176, 0.08); /* Light Purple Tint */
		border-color: rgba(156, 39, 176, 0.2);
	}

	.dt-info {
		display: flex;
		flex-direction: column;
		min-width: 0; /* Allows text truncation */
		flex: 1;
	}
	.dt-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(
			--color-text-secondary
		); /* Will be overridden by theme specificity if needed, but let's keep it clean */
		font-weight: 700;
		opacity: 0.8;
	}
	.dt-value {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Payment Card Specifics */
	.payment-card {
		background: rgba(212, 175, 55, 0.05); /* Subtle Gold Tint */
		border: 1px solid rgba(212, 175, 55, 0.2);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	}
	.payment-card h4 {
		color: var(--color-accent-gold);
		border-color: rgba(212, 175, 55, 0.2);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Total Card */
	.total-card {
		background: transparent;
		border: none;
		padding: 0;
		margin-top: 24px;
		border-top: 1px solid var(--color-border);
		padding-top: 16px;
		border-radius: 0;
	}

	.payment-sub-methods {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px dashed var(--color-border);
	}

	/* Payment Section Standalone (Outside Card) */
	.payment-section-standalone {
		margin-bottom: 12px;
	}
	.payment-section-standalone h4 {
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-accent-gold);
		margin-bottom: 16px;
	}

	/* Totals Section (Outside Card) */
	.totals-section {
		margin-top: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--color-border);
	}

	/* Coupon Input Styles */
	.coupon-input-wrapper {
		margin-bottom: 20px;
	}
	.coupon-input-row {
		display: flex;
		gap: 8px;
	}
	.coupon-input {
		flex: 1;
		background: var(--color-input-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: 8px;
		padding: 10px 14px;
		color: var(--color-text-primary);
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.coupon-input::placeholder {
		text-transform: none;
		letter-spacing: normal;
		color: var(--color-text-muted);
	}
	.coupon-input:focus {
		outline: none;
		border-color: var(--color-accent-gold);
	}
	.apply-coupon-btn {
		background: var(--color-accent-gold);
		color: black;
		border: none;
		border-radius: 8px;
		padding: 10px 18px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 70px;
	}
	.apply-coupon-btn:hover:not(:disabled) {
		opacity: 0.9;
		transform: translateY(-1px);
	}
	.apply-coupon-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.coupon-error {
		color: #ff6b6b;
		font-size: 0.8rem;
		margin-top: 8px;
		margin-bottom: 0;
	}
	.coupon-applied {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(76, 175, 80, 0.1);
		border: 1px solid rgba(76, 175, 80, 0.3);
		border-radius: 8px;
		padding: 10px 14px;
	}
	.coupon-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #4caf50;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.remove-coupon {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: all 0.2s ease;
	}
	.remove-coupon:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	/* Price Breakdown Styles */
	.price-breakdown {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.breakdown-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}
	.breakdown-row.discount {
		color: var(--color-text-muted);
	}
	.text-green {
		color: #4caf50;
	}
	.savings-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: rgba(212, 175, 55, 0.1);
		border-radius: 8px;
		margin: 8px 0;
		color: var(--color-accent-gold);
		font-weight: 500;
		font-size: 0.9rem;
	}
	.total-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 1.2rem;
		font-weight: 800;
		padding-top: 16px;
		border-top: 2px dashed var(--color-border);
		margin-top: 12px;
	}
	.total-row span:last-child {
		font-size: 1.5rem;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 4px 10px rgba(212, 175, 55, 0.2);
	}

	/* Spinner for Apply button */
	.spinner-sm {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: black;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* --- VISIBILITY FIX FOR LIGHT THEMES (Clean & Glitch) --- */
	/* 
	   Problem: In light themes, the picker modals can be too pale, and text contrast might be low.
       Fix: Force specific high-contrast overrides when data-theme="clean" or "glitch" (if light variant) is active.
	*/

	:global([data-theme='clean']) .custom-picker-modal,
	:global([data-theme='glitch']) .custom-picker-modal {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.1);
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(0, 0, 0, 0.05); /* Extra visibility ring */
	}

	/* LIGHT THEME BACKDROP override */
	:global([data-theme='clean']) .modal-backdrop,
	:global([data-theme='glitch']) .modal-backdrop {
		background: rgba(0, 0, 0, 0.3); /* Lighter dark overlay */
		backdrop-filter: blur(12px); /* Glass blur */
		-webkit-backdrop-filter: blur(12px);
	}

	:global([data-theme='clean']) .picker-header h3,
	:global([data-theme='glitch']) .picker-header h3 {
		color: #1a1a1a; /* Almost Black */
		font-weight: 800;
	}

	/* Navigation Arrows */
	:global([data-theme='clean']) .nav-arrow-btn,
	:global([data-theme='glitch']) .nav-arrow-btn {
		background: #f0f0f0;
		border: 1px solid #ddd;
		color: #333;
	}
	:global([data-theme='clean']) .nav-arrow-btn:hover,
	:global([data-theme='glitch']) .nav-arrow-btn:hover {
		background: #e0e0e0;
		color: #000;
	}

	/* Weekdays */
	:global([data-theme='clean']) .weekdays-grid span,
	:global([data-theme='glitch']) .weekdays-grid span {
		color: #666; /* Darker gray for readability */
		font-weight: 700;
	}

	/* Calendar Days */
	:global([data-theme='clean']) .cal-day:not(.isPadding),
	:global([data-theme='glitch']) .cal-day:not(.isPadding) {
		color: #333;
		font-weight: 500;
	}
	:global([data-theme='clean']) .cal-day.disabled,
	:global([data-theme='glitch']) .cal-day.disabled {
		color: #ccc;
		background: transparent;
	}

	/* GREEN SLOTS FOR LIGHT THEME (Enhanced) */
	:global([data-theme='clean']) .cal-day.available,
	:global([data-theme='glitch']) .cal-day.available {
		background: rgba(76, 175, 80, 0.15); /* Slightly darker tint */
		border: 1px solid rgba(76, 175, 80, 0.4);
		color: #1b5e20;
		font-weight: 700;
	}
	:global([data-theme='clean']) .cal-day.available:hover,
	:global([data-theme='glitch']) .cal-day.available:hover {
		background: rgba(76, 175, 80, 0.25);
		color: #000;
		border-color: rgba(76, 175, 80, 0.6);
	}

	/* Selected Day/Time - CRITICAL: Force White Text */
	:global([data-theme='clean']) .cal-day.selected,
	:global([data-theme='glitch']) .cal-day.selected,
	:global([data-theme='clean']) .time-slot.selected,
	:global([data-theme='glitch']) .time-slot.selected {
		color: #ffffff !important;
		/* Keep theme's main color for background (Gold/Purple) but ensure text is white */
		font-weight: 800;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		border: none; /* remove green/gray border if any */
	}

	/* Time Slots */
	:global([data-theme='clean']) .time-slot,
	:global([data-theme='glitch']) .time-slot {
		background: rgba(76, 175, 80, 0.12); /* Light Green Tint */
		border: 1px solid rgba(76, 175, 80, 0.3);
		color: #1b5e20;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}
	:global([data-theme='clean']) .time-slot:hover,
	:global([data-theme='glitch']) .time-slot:hover {
		background: rgba(76, 175, 80, 0.25);
		border-color: rgba(76, 175, 80, 0.6);
		color: #000;
	}

	/* Summary Modal Light Theme Overrides */
	:global([data-theme='clean']) .summary-modal,
	:global([data-theme='glitch']) .summary-modal {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.6);
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.1),
			0 0 0 1px rgba(255, 255, 255, 0.5) inset;
	}
	:global([data-theme='clean']) .summary-header,
	:global([data-theme='glitch']) .summary-header {
		background: rgba(255, 255, 255, 0.6);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}
	:global([data-theme='clean']) .summary-service-card,
	:global([data-theme='glitch']) .summary-service-card {
		background: white;
		border-color: rgba(0, 0, 0, 0.06);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
	}
	:global([data-theme='clean']) .summary-service-card:hover,
	:global([data-theme='glitch']) .summary-service-card:hover {
		border-color: var(--color-accent-gold);
		box-shadow: 0 8px 16px rgba(212, 175, 55, 0.15);
		background: white;
	}
	:global([data-theme='clean']) .service-name,
	:global([data-theme='glitch']) .service-name {
		color: #222;
	}
	:global([data-theme='clean']) .summary-header h3,
	:global([data-theme='glitch']) .summary-header h3 {
		color: #111;
		font-weight: 800;
		letter-spacing: -0.5px;
	}
	:global([data-theme='clean']) .service-price,
	:global([data-theme='glitch']) .service-price {
		color: #d4af37; /* Darker Gold for visibility on white */
	}

	/* GLASSMORPHISM - LIGHT THEME OVERRIDES (Enhanced) */
	:global([data-theme='clean']) .summary-modal,
	:global([data-theme='glitch']) .summary-modal {
		background: rgba(255, 255, 255, 0.92); /* Less transparency for better contrast */
		backdrop-filter: blur(40px); /* Stronger blur */
		-webkit-backdrop-filter: blur(40px);
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow:
			0 30px 80px rgba(0, 50, 0, 0.15),
			/* Subtle green shadow hint */ 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
	}
	:global([data-theme='clean']) .booking-details-card,
	:global([data-theme='glitch']) .booking-details-card {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(15px);
		border-color: rgba(0, 0, 0, 0.08); /* More definition */
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
	}
	:global([data-theme='clean']) .special-req-card,
	:global([data-theme='glitch']) .special-req-card {
		background: rgba(255, 241, 118, 0.5); /* Stronger yellow */
		border-color: rgba(253, 216, 53, 0.6);
	}
	/* Enhance specific cards in light mode for vibrance */
	:global([data-theme='clean']) .date-card,
	:global([data-theme='glitch']) .date-card {
		background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
		border-color: #90caf9;
	}
	:global([data-theme='clean']) .time-card,
	:global([data-theme='glitch']) .time-card {
		background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
		border-color: #ce93d8;
	}
	:global([data-theme='clean']) .req-text,
	:global([data-theme='glitch']) .req-text {
		color: #444;
	}
	:global([data-theme='clean']) .dt-value,
	:global([data-theme='glitch']) .dt-value {
		color: #000;
		font-weight: 700;
	}

	/* LIGHT THEME PAYMENT OPTIONS */
	:global([data-theme='clean']) .payment-option,
	:global([data-theme='glitch']) .payment-option {
		background: #fdfdfd;
		border-color: #e0e0e0;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
	}
	:global([data-theme='clean']) .payment-option:hover,
	:global([data-theme='glitch']) .payment-option:hover {
		background: #fff;
		border-color: var(--color-accent-gold);
		box-shadow: 0 8px 20px rgba(212, 175, 55, 0.15);
	}
	:global([data-theme='clean']) .payment-option.active,
	:global([data-theme='glitch']) .payment-option.active {
		background: linear-gradient(135deg, #fffbf0 0%, #fff 100%);
		border-color: #d4af37;
		box-shadow:
			0 12px 30px rgba(212, 175, 55, 0.25),
			0 0 0 1px rgba(212, 175, 55, 0.1) inset;
	}
	:global([data-theme='clean']) .option-label,
	:global([data-theme='glitch']) .option-label {
		color: #111;
		font-weight: 700;
	}
	:global([data-theme='clean']) .option-icon-wrapper,
	:global([data-theme='glitch']) .option-icon-wrapper {
		background: #f5f5f5;
		color: #555;
		border-color: #eee;
	}
	:global([data-theme='clean']) .payment-option.active .option-icon-wrapper,
	:global([data-theme='glitch']) .payment-option.active .option-icon-wrapper {
		background: var(--color-accent-gold);
		color: white;
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
	}
	/* BEU CASH CARD UI */
	.beu-cash-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: rgba(212, 175, 55, 0.08);
		border: 1px solid rgba(212, 175, 55, 0.3);
		border-radius: 12px;
		margin-bottom: 12px;
	}
	.beu-cash-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.beu-cash-header {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-primary);
	}
	.beu-cash-subtext {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}
	
	/* TOGGLE SWITCH */
	.switch-container {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}
	.switch-container input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.slider {
		position: absolute;
		cursor: pointer;
		top: 0; left: 0; right: 0; bottom: 0;
		background-color: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		transition: .4s;
	}
	.slider:before {
		position: absolute;
		content: "";
		height: 18px;
		width: 18px;
		left: 2px;
		bottom: 2px;
		background-color: white;
		transition: .4s;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
	}
	input:checked + .slider {
		background-color: var(--color-accent-gold);
		border-color: var(--color-accent-gold);
	}
	input:checked + .slider:before {
		transform: translateX(20px);
	}
	.slider.round {
		border-radius: 24px;
	}
	.slider.round:before {
		border-radius: 50%;
	}

	:global([data-theme='clean']) .beu-cash-card,
	:global([data-theme='glitch']) .beu-cash-card {
		background: rgba(212, 175, 55, 0.1);
		border-color: rgba(212, 175, 55, 0.4);
	}
	:global([data-theme='clean']) .slider,
	:global([data-theme='glitch']) .slider {
		background-color: rgba(0, 0, 0, 0.1);
		border-color: rgba(0, 0, 0, 0.15);
	}

	/* RECEIPT BOX UI */
	.receipt-box {
		background: rgba(0, 0, 0, 0.02);
		border: 1px solid rgba(0, 0, 0, 0.05);
		border-radius: 12px;
		padding: 16px 12px;
		box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
	}
	:global([data-theme='clean']) .receipt-box,
	:global([data-theme='glitch']) .receipt-box {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	/* COUPONS UI */
	.view-coupons-btn {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 16px;
		background: #ffffff;
		border: 1px solid rgba(0, 0, 0, 0.08);
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.03);
		transition: all 0.2s ease;
		cursor: pointer;
	}
	.view-coupons-btn:hover {
		border-color: var(--color-accent-gold);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.1);
	}
	.view-coupons-left {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 700;
		color: var(--color-text-primary);
		font-size: 0.95rem;
	}

	.coupons-modal {
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}
	.coupons-body {
		padding: 20px;
		overflow-y: auto;
	}
	.coupon-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		background: rgba(212, 175, 55, 0.05);
		border: 1px dashed rgba(212, 175, 55, 0.4);
		border-radius: 12px;
		margin-bottom: 12px;
		position: relative;
	}
	.coupon-card::before, .coupon-card::after {
		content: '';
		position: absolute;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		top: 50%;
		transform: translateY(-50%);
		border: 1px solid rgba(212, 175, 55, 0.2);
	}
	.coupon-card::before {
		left: -8px;
		border-left-color: transparent;
		border-bottom-color: transparent;
		transform: translateY(-50%) rotate(45deg);
	}
	.coupon-card::after {
		right: -8px;
		border-right-color: transparent;
		border-top-color: transparent;
		transform: translateY(-50%) rotate(45deg);
	}
	.coupon-code-badge {
		display: inline-block;
		background: rgba(212, 175, 55, 0.15);
		color: #b8860b;
		padding: 4px 10px;
		border-radius: 6px;
		font-weight: 800;
		font-size: 0.85rem;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
	}
	.coupon-desc-bold {
		font-weight: 700;
		color: var(--color-text-primary);
		font-size: 1rem;
		margin-bottom: 2px;
	}
	.coupon-desc-sub {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}
	.apply-text-btn {
		color: var(--color-accent-gold);
		font-weight: 800;
		font-size: 0.9rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 8px;
	}
	.apply-text-btn:hover {
		color: #b8860b;
	}

	:global([data-theme='clean']) .view-coupons-btn,
	:global([data-theme='glitch']) .view-coupons-btn {
		background: rgba(255, 255, 255, 0.9);
	}
	:global([data-theme='clean']) .coupon-card::before,
	:global([data-theme='clean']) .coupon-card::after,
	:global([data-theme='glitch']) .coupon-card::before,
	:global([data-theme='glitch']) .coupon-card::after {
		background: #fdfdfd;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { slide, scale, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { auth, db } from '$lib/firebase';
	import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';
	import { ChevronLeft, Calendar, Clock, MapPin, Phone, AlertCircle } from 'lucide-svelte';

	let bookings: any[] = [];
	let filteredBookings: any[] = [];
	let loading = true;
	let currentFilter = 'all'; // all, upcoming, previous, confirmed, pending, cancelled
	let counts = { all: 0, upcoming: 0, previous: 0, confirmed: 0, pending: 0, cancelled: 0 };

	onMount(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			if (user) {
				loadBookings(user.uid);
			} else {
				loading = false;
				goto('/login');
			}
		});

		return () => unsubscribe();
	});

	async function loadBookings(uid: string) {
		loading = true;

		try {
			const q = query(collection(db, 'bookings'), where('userId', '==', uid));
			const snapshot = await getDocs(q);

			let tempBookings: any[] = [];
			snapshot.forEach((doc) => {
				tempBookings.push({ id: doc.id, ...doc.data() });
			});

			tempBookings.sort((a, b) => {
				const timeA = getTimestamp(a);
				const timeB = getTimestamp(b);
				return timeB - timeA;
			});

			bookings = tempBookings;
			calculateCounts();
			applyFilter('all');
		} catch (error: any) {
			console.error('Error loading bookings:', error);
		} finally {
			loading = false;
		}
	}

	function getTimestamp(booking: any) {
		if (!booking.date) return 0;
		try {
			const [y, m, d] = booking.date.split('-').map(Number);
			let year = y,
				month = m,
				day = d;
			if (String(y).length === 2 || String(d).length === 4) {
				const parts = booking.date.split('-');
				if (parts[0].length === 4) {
					year = Number(parts[0]);
					month = Number(parts[1]);
					day = Number(parts[2]);
				} else {
					year = Number(parts[2]);
					month = Number(parts[1]);
					day = Number(parts[0]);
				}
			}

			let h = 0,
				min = 0;
			if (booking.time) {
				const timeParts = booking.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
				if (timeParts) {
					h = parseInt(timeParts[1], 10);
					if (timeParts[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
					if (timeParts[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
					min = parseInt(timeParts[2], 10);
				}
			}
			return new Date(year, month - 1, day, h, min).getTime();
		} catch (e) {
			return 0;
		}
	}

	function calculateCounts() {
		const now = new Date().getTime();
		let c = { all: 0, upcoming: 0, previous: 0, confirmed: 0, pending: 0, cancelled: 0 };

		c.all = bookings.length;

		bookings.forEach((b) => {
			const ts = getTimestamp(b);
			const isFuture = ts >= now;
			const isCancelled = b.status === 'cancelled' || b.status === 'declined';
			const isCompleted = b.status === 'completed';

			if (b.status === 'confirmed') c.confirmed++;
			if (b.status === 'pending') c.pending++;
			if (isCancelled) c.cancelled++;

			if (isFuture && !isCancelled && !isCompleted) {
				c.upcoming++;
			} else {
				c.previous++;
			}
		});
		counts = c;
	}

	function applyFilter(filter: string) {
		currentFilter = filter;
		const now = new Date().getTime();

		if (filter === 'all') {
			filteredBookings = bookings;
		} else if (filter === 'upcoming') {
			filteredBookings = bookings.filter((b) => {
				const ts = getTimestamp(b);
				const isCancelled = b.status === 'cancelled' || b.status === 'declined';
				const isCompleted = b.status === 'completed';
				return ts >= now && !isCancelled && !isCompleted;
			});
		} else if (filter === 'previous') {
			filteredBookings = bookings.filter((b) => {
				const ts = getTimestamp(b);
				const isCancelled = b.status === 'cancelled' || b.status === 'declined';
				const isCompleted = b.status === 'completed';
				return ts < now || isCancelled || isCompleted;
			});
		} else {
			filteredBookings = bookings.filter((b) => {
				if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'declined';
				return b.status === filter;
			});
		}
	}

	function formatDisplayDate(dateStr: string) {
		if (!dateStr) return '';
		try {
			let d = new Date(dateStr);
			if (isNaN(d.getTime())) {
				const parts = dateStr.split('-');
				if (parts[0].length === 2 && parts[2].length === 4) {
					d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
				}
			}
			return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
		} catch (e) {
			return dateStr;
		}
	}

	function getRelativeTime(timestamp: any) {
		if (!timestamp) return '';
		try {
			const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const m = Math.floor(diffMs / 60000);
			const h = Math.floor(m / 60);
			const d = Math.floor(h / 24);

			if (m < 60) return `${m}m ago`;
			if (h < 24) return `${h}h ago`;
			return `${d}d ago`;
		} catch (e) {
			return '';
		}
	}

	$: upcomingList = bookings.filter((b) => {
		const ts = getTimestamp(b);
		const now = new Date().getTime();
		const isCancelled = b.status === 'cancelled' || b.status === 'declined';
		const isCompleted = b.status === 'completed';
		return ts >= now && !isCancelled && !isCompleted;
	});

	$: previousList = bookings.filter((b) => {
		const ts = getTimestamp(b);
		const now = new Date().getTime();
		const isCancelled = b.status === 'cancelled' || b.status === 'declined';
		const isCompleted = b.status === 'completed';
		return ts < now || isCancelled || isCompleted;
	});

	const serviceColors = [
		{ bg: '#2c3e50', text: '#ffffff' },
		{ bg: '#8e44ad', text: '#ffffff' },
		{ bg: '#27ae60', text: '#ffffff' },
		{ bg: '#d35400', text: '#ffffff' },
		{ bg: '#c0392b', text: '#ffffff' },
		{ bg: '#2980b9', text: '#ffffff' },
		{ bg: '#16a085', text: '#ffffff' },
		{ bg: '#2c2c2c', text: '#d4af37' }
	];

	function getServiceStyle(index: number) {
		return serviceColors[index % serviceColors.length];
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'confirmed':
				return '#27ae60';
			case 'completed':
				return '#2c3e50';
			case 'cancelled':
			case 'declined':
				return '#e74c3c';
			default:
				return '#f39c12';
		}
	}

	function getRemainingTimeObj(dateStr: string, timeStr: string) {
		if (!dateStr) return null;
		try {
			let d, m, y;
			if (dateStr.includes('-')) {
				const parts = dateStr.split('-');
				if (parts[0].length === 4) {
					[y, m, d] = parts.map(Number);
				} else {
					[d, m, y] = parts.map(Number);
				}
			} else {
				return null;
			}

			let h = 0,
				min = 0;
			if (timeStr) {
				const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
				if (timeParts) {
					h = parseInt(timeParts[1], 10);
					min = parseInt(timeParts[2], 10);
					if (timeParts[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
					if (timeParts[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
				}
			}
			const target = new Date(y, m - 1, d, h, min).getTime();
			const diff = target - Date.now();
			if (diff <= 0) return null;

			return {
				days: Math.floor(diff / (1000 * 60 * 60 * 24)),
				hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
				minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
			};
		} catch (e) {
			return null;
		}
	}

	function formatRemainingBadge(rem: any) {
		if (!rem) return '';
		if (rem.days === 0) {
			if (rem.hours === 0) return `${rem.minutes}m left`;
			return `${rem.hours}h ${rem.minutes}m left`;
		}
		if (rem.days === 1) return `1 day left`;
		if (rem.days <= 7) return `${rem.days} days left`;
		return `${Math.floor(rem.days / 7)} weeks left`;
	}

	function getUrgencyClass(rem: any) {
		if (!rem) return '';
		if (rem.days === 0 && rem.hours < 2) return 'remaining-time-urgent';
		if (rem.days === 0) return 'remaining-time-soon';
		return 'remaining-time-normal';
	}
</script>

<div class="page-container">
	<!-- HEADER -->
	<header class="page-header" in:slide={{ duration: 400, axis: 'y' }}>
		<button class="back-btn" on:click={() => goto('/you')}>
			<ChevronLeft size={28} strokeWidth={1.5} />
		</button>
		<h1>My Bookings</h1>
		<div class="spacer"></div>
	</header>

	<!-- FILTER BAR -->
	<div class="filter-scroll-wrapper">
		<div class="filter-bar">
			<button
				class="filter-chip {currentFilter === 'all' ? 'active' : ''}"
				on:click={() => applyFilter('all')}
			>
				All <span class="count">{counts.all}</span>
			</button>
			<button
				class="filter-chip {currentFilter === 'upcoming' ? 'active' : ''}"
				on:click={() => applyFilter('upcoming')}
			>
				Upcoming <span class="count">{counts.upcoming}</span>
			</button>
			<button
				class="filter-chip {currentFilter === 'confirmed' ? 'active' : ''}"
				on:click={() => applyFilter('confirmed')}
			>
				Confirmed <span class="count">{counts.confirmed}</span>
			</button>
			<button
				class="filter-chip {currentFilter === 'previous' ? 'active' : ''}"
				on:click={() => applyFilter('previous')}
			>
				History <span class="count">{counts.previous}</span>
			</button>
		</div>
	</div>

	<!-- CONTENT -->
	<div class="content-area">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Syncing your appointments...</p>
			</div>
		{:else if currentFilter === 'all'}
			<!-- SPLIT VIEW -->
			{#if upcomingList.length > 0}
				<div class="section-title">
					<div class="title-decoration"></div>
					<span>Upcoming Appointments</span>
				</div>
				<div class="bookings-grid">
					{#each upcomingList as booking}
						{@const rem = getRemainingTimeObj(booking.date, booking.time)}
						{@const stColor = getStatusColor(booking.status)}

						<div
							class="booking-card premium-card"
							transition:scale={{ duration: 300, start: 0.95 }}
						>
							<div class="card-glow" style="background: {stColor};"></div>
							<div class="booking-card-top-header">
								<span class="booking-ref-number">REF: {booking.id.slice(0, 8).toUpperCase()}</span>
								<div
									class="booking-status-badge"
									style="background: {stColor}; box-shadow: 0 0 15px {stColor}80;"
								>
									{booking.status}
								</div>
							</div>

							<div class="booking-main-content">
								<div class="appointment-header-row">
									<span class="appointment-label-mini">
										<Calendar size={14} /> APPOINTMENT
									</span>
								</div>

								<div class="booking-time-row">
									<div class="unified-timing">
										<span class="date">{formatDisplayDate(booking.date)}</span>
										<span class="timing-dot">•</span>
										<span class="time">{booking.time}</span>
									</div>
									{#if booking.status === 'confirmed' && rem}
										<div class="remaining-time-badge {getUrgencyClass(rem)}">
											{formatRemainingBadge(rem)}
										</div>
									{/if}
								</div>

								<div class="booking-services-section">
									<p class="section-title-small">SERVICES</p>
									<div class="booking-service-tags">
										{#each booking.services || [] as service, i}
											{@const style = getServiceStyle(i + (service.name?.length || 0))}
											<span
												class="service-tag-chip"
												style="background:{style.bg}; color:{style.text};"
											>
												{typeof service === 'string' ? service : service.name}
											</span>
										{/each}
									</div>
									<div class="premium-service-row">
										<p class="booking-premium-label">✨ Premium Service</p>
									</div>
								</div>
							</div>

							<div class="booking-footer-grid">
								<div class="footer-info-box">
									<div class="box-header"><Clock size={12} /> BOOKED ON</div>
									<div class="box-value">
										{booking.createdAt
											? new Date(
													booking.createdAt.toMillis
														? booking.createdAt.toMillis()
														: booking.createdAt
												).toLocaleDateString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric'
												})
											: 'Unknown'}
										<span class="relative-time">{getRelativeTime(booking.createdAt)}</span>
									</div>
								</div>

								<div class="footer-info-box">
									<div class="box-header"><AlertCircle size={12} /> SPECIAL REQUEST</div>
									<div class="box-value note-value">{booking.notes || 'None'}</div>
								</div>
							</div>

							<div class="booking-location-bar">
								<div class="location-content">
									<div class="loc-icon-wrapper">
										<MapPin size={16} />
									</div>
									<div class="loc-text">
										<span class="salon-name">Blancbeu Salon</span>
										<span class="salon-addr">4th Floor, Victory Mall, Upper Bazar</span>
									</div>
								</div>
								{#if booking.status === 'confirmed'}
									<a href="tel:+919229915277" class="footer-call-btn">
										<Phone size={20} />
									</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-upcoming-card">
					<p>You have no upcoming appointments.</p>
					<button class="book-new-btn" on:click={() => goto('/booking')}>
						Book New Appointment ✨
					</button>
				</div>
			{/if}

			{#if previousList.length > 0}
				<div class="section-title mt-12">
					<div class="title-decoration history"></div>
					<span>Previous Appointments</span>
				</div>
				<div class="bookings-grid history-grid">
					{#each previousList as booking}
						{@const stColor = getStatusColor(booking.status)}

						<div
							class="booking-card history-card"
							transition:scale={{ duration: 300, start: 0.95 }}
						>
							<div class="booking-card-top-header">
								<span class="booking-ref-number">REF: {booking.id.slice(0, 8).toUpperCase()}</span>
								<div class="booking-status-badge" style="background: {stColor}; opacity: 0.9;">
									{booking.status}
								</div>
							</div>

							<div class="booking-main-content">
								<div class="booking-time-row compact">
									<div class="unified-timing">
										<span class="date">{formatDisplayDate(booking.date)}</span>
										<span class="timing-dot">•</span>
										<span class="time">{booking.time}</span>
									</div>
								</div>

								<div class="booking-services-section">
									<div class="booking-service-tags">
										{#each booking.services || [] as service, i}
											{@const style = getServiceStyle(i + (service.name?.length || 0))}
											<span
												class="service-tag-chip small"
												style="background:{style.bg}; color:{style.text};"
											>
												{typeof service === 'string' ? service : service.name}
											</span>
										{/each}
									</div>
								</div>
							</div>

							<div class="booking-location-bar small">
								<div class="location-content">
									<span class="salon-name text-muted">Blancbeu Salon</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- FLAT LIST (Filtered) -->
			<div class="bookings-grid">
				{#each filteredBookings as booking}
					{@const rem = getRemainingTimeObj(booking.date, booking.time)}
					{@const stColor = getStatusColor(booking.status)}
					<!-- FIXED: Using premium card layout for ALL filtered views -->
					<div class="booking-card premium-card" transition:scale>
						<div class="card-glow" style="background: {stColor};"></div>
						<div class="booking-card-top-header">
							<span class="booking-ref-number">REF: {booking.id.slice(0, 8).toUpperCase()}</span>
							<div
								class="booking-status-badge"
								style="background: {stColor}; box-shadow: 0 0 15px {stColor}80;"
							>
								{booking.status}
							</div>
						</div>

						<div class="booking-main-content">
							<div class="appointment-header-row">
								<span class="appointment-label-mini">
									<Calendar size={14} /> APPOINTMENT
								</span>
							</div>

							<div class="booking-time-row">
								<div class="unified-timing">
									<span class="date">{formatDisplayDate(booking.date)}</span>
									<span class="timing-dot">•</span>
									<span class="time">{booking.time}</span>
								</div>
								{#if booking.status === 'confirmed' && rem}
									<div class="remaining-time-badge {getUrgencyClass(rem)}">
										{formatRemainingBadge(rem)}
									</div>
								{/if}
							</div>

							<div class="booking-services-section">
								<p class="section-title-small">SERVICES</p>
								<div class="booking-service-tags">
									{#each booking.services || [] as service, i}
										{@const style = getServiceStyle(i + (service.name?.length || 0))}
										<span
											class="service-tag-chip"
											style="background:{style.bg}; color:{style.text};"
										>
											{typeof service === 'string' ? service : service.name}
										</span>
									{/each}
								</div>
								<div class="premium-service-row">
									<p class="booking-premium-label">✨ Premium Service</p>
								</div>
							</div>
						</div>

						<div class="booking-footer-grid">
							<div class="footer-info-box">
								<div class="box-header"><Clock size={12} /> BOOKED ON</div>
								<div class="box-value">
									{booking.createdAt
										? new Date(
												booking.createdAt.toMillis
													? booking.createdAt.toMillis()
													: booking.createdAt
											).toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})
										: 'Unknown'}
									<span class="relative-time">{getRelativeTime(booking.createdAt)}</span>
								</div>
							</div>

							<div class="footer-info-box">
								<div class="box-header"><AlertCircle size={12} /> SPECIAL REQUEST</div>
								<div class="box-value note-value">{booking.notes || 'None'}</div>
							</div>
						</div>

						<div class="booking-location-bar">
							<div class="location-content">
								<div class="loc-icon-wrapper">
									<MapPin size={16} />
								</div>
								<div class="loc-text">
									<span class="salon-name">Blancbeu Salon</span>
									<span class="salon-addr">4th Floor, Victory Mall, Upper Bazar</span>
								</div>
							</div>
							{#if booking.status === 'confirmed'}
								<a href="tel:+919229915277" class="footer-call-btn">
									<Phone size={20} />
								</a>
							{/if}
						</div>
					</div>
				{:else}
					<div class="empty-state">
						<div class="empty-icon">📅</div>
						<p>No {currentFilter} bookings found.</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	/* Fonts are imported globally in app.css */

	/* PAGE CONTAINER */
	.page-container {
		min-height: 100vh;
		background-color: var(--color-bg-primary);
		/* Subtle gradient overlay using theme colors */
		background-image:
			radial-gradient(
				circle at 10% 20%,
				rgba(var(--color-accent-gold-rgb), 0.05) 0%,
				transparent 40%
			),
			radial-gradient(
				circle at 90% 80%,
				rgba(var(--color-bg-secondary-rgb), 0.5) 0%,
				transparent 40%
			);
		padding-bottom: 100px;
		transition: background-color 0.4s ease;
	}

	/* HEADER */
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px;
		background: rgba(var(--color-bg-primary-rgb), 0.8);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		position: sticky;
		top: 0;
		z-index: 100;
		border-bottom: 1px solid rgba(255, 255, 255, 0.03);
		transition: background-color 0.4s ease;
	}

	h1 {
		font-family: var(--font-heading);
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
		letter-spacing: 0.5px;
	}

	.back-btn {
		background: rgba(var(--color-text-primary-rgb), 0.05);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.05);
		border-radius: 12px;
		color: var(--color-text-primary);
		cursor: pointer;
		padding: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}
	.back-btn:active {
		transform: scale(0.95);
		background: rgba(var(--color-text-primary-rgb), 0.1);
	}
	.spacer {
		width: 44px;
	}

	/* FILTER BAR */
	.filter-scroll-wrapper {
		overflow-x: auto;
		padding: 20px 24px;
		scrollbar-width: none; /* Firefox */
	}
	.filter-scroll-wrapper::-webkit-scrollbar {
		display: none;
	}

	.filter-bar {
		display: flex;
		gap: 12px;
		min-width: max-content;
	}

	.filter-chip {
		background: rgba(var(--color-text-primary-rgb), 0.03);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.08);
		color: var(--color-text-secondary);
		padding: 10px 18px;
		border-radius: 100px;
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
		cursor: pointer;
		position: relative;
		overflow: hidden;
	}

	.filter-chip::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			45deg,
			transparent,
			rgba(var(--color-text-primary-rgb), 0.05),
			transparent
		);
		transform: translateX(-100%);
		transition: 0.5s;
	}
	.filter-chip:hover::before {
		transform: translateX(100%);
	}

	.filter-chip.active {
		background: var(--color-accent-gold);
		border-color: var(--color-accent-gold);
		color: var(--color-bg-primary); /* Contrast text for active chip */
		box-shadow: var(--shadow-gold);
		font-weight: 600;
	}

	.count {
		background: rgba(var(--color-text-primary-rgb), 0.1);
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
	}
	.filter-chip.active .count {
		background: rgba(var(--color-bg-primary-rgb), 0.2);
		color: var(--color-bg-primary);
	}

	/* CONTENT */
	.content-area {
		padding: 0 24px;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 24px;
		color: var(--color-text-secondary);
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1.5px;
	}
	.title-decoration {
		width: 4px;
		height: 16px;
		background: var(--color-accent-gold);
		border-radius: 4px;
		box-shadow: 0 0 10px rgba(var(--color-accent-gold-rgb), 0.4);
	}
	.title-decoration.history {
		background: var(--color-text-secondary);
		box-shadow: none;
	}
	.mt-12 {
		margin-top: 48px;
	}

	/* BOOKING CARD */
	.booking-card {
		background: rgba(var(--color-bg-secondary-rgb), 0.5);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.05);
		border-radius: 24px;
		margin-bottom: 24px;
		position: relative;
		overflow: hidden;
		transition:
			transform 0.3s ease,
			box-shadow 0.3s ease;
	}

	.booking-card.premium-card {
		background: var(--gradient-card);
		box-shadow: var(--shadow-card);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.08);
	}

	/* Glow Effect on Card */
	.card-glow {
		position: absolute;
		top: -50px;
		right: -50px;
		width: 150px;
		height: 150px;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.15;
		pointer-events: none;
	}

	/* Card Header */
	.booking-card-top-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 24px;
		background: linear-gradient(to bottom, rgba(var(--color-text-primary-rgb), 0.02), transparent);
		border-bottom: 1px solid rgba(var(--color-text-primary-rgb), 0.04);
	}

	.booking-ref-number {
		font-family: 'Space Mono', monospace;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		letter-spacing: 1px;
		background: rgba(var(--color-bg-primary-rgb), 0.3);
		padding: 4px 8px;
		border-radius: 6px;
	}

	.booking-status-badge {
		padding: 6px 14px;
		border-radius: 100px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #fff; /* Status badges usually keep white text on colored bg */
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	/* Main Content */
	.booking-main-content {
		padding: 24px;
	}

	.appointment-header-row {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
	}
	.appointment-label-mini {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.7rem;
		color: var(--color-text-secondary);
		font-weight: 600;
		letter-spacing: 2px;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.booking-time-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		margin-bottom: 24px;
	}

	.compact {
		margin-bottom: 12px;
	}

	.unified-timing {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.unified-timing .date {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-text-primary);
	}
	.unified-timing .time {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text-primary);
		margin-right: 8px;
		background: linear-gradient(90deg, var(--color-text-primary), var(--color-text-secondary));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.unified-timing .timing-dot {
		display: none;
	}

	/* Remaining Time Badge */
	.remaining-time-badge {
		background: rgba(
			30,
			30,
			30,
			0.8
		); /* Keep dark for contrast or use theme? Let's use generic glass */
		background: rgba(var(--color-bg-secondary-rgb), 0.8);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.1);
		padding: 8px 16px;
		border-radius: 12px;
		font-family: 'Space Mono', monospace;
		font-size: 0.8rem;
		color: var(--color-text-primary);
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
		text-align: right;
		position: relative;
		overflow: hidden;
	}

	.remaining-time-urgent {
		color: #ff9f43;
		border-color: rgba(255, 159, 67, 0.3);
		box-shadow: 0 0 15px rgba(255, 159, 67, 0.15);
		animation: pulse-glow 2s infinite;
	}

	@keyframes pulse-glow {
		0% {
			box-shadow: 0 0 15px rgba(255, 159, 67, 0.1);
		}
		50% {
			box-shadow: 0 0 25px rgba(255, 159, 67, 0.3);
			border-color: rgba(255, 159, 67, 0.6);
		}
		100% {
			box-shadow: 0 0 15px rgba(255, 159, 67, 0.1);
		}
	}

	/* Services */
	.booking-services-section {
		margin-bottom: 24px;
	}
	.section-title-small {
		font-size: 0.7rem;
		color: var(--color-accent-gold);
		font-weight: 700;
		letter-spacing: 1.5px;
		margin-bottom: 12px;
		text-transform: uppercase;
	}

	.booking-service-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 12px;
	}

	.service-tag-chip {
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}

	.service-tag-chip.small {
		font-size: 0.7rem;
		padding: 4px 8px;
	}

	.booking-premium-label {
		color: var(--color-accent-gold);
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0;
		text-shadow: 0 0 10px rgba(var(--color-accent-gold-rgb), 0.3);
	}

	/* Footer Grid */
	.booking-footer-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		padding: 0 24px 24px 24px;
	}

	.footer-info-box {
		background: rgba(var(--color-bg-primary-rgb), 0.3);
		border-radius: 16px;
		padding: 16px;
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.03);
	}

	.box-header {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.65rem;
		color: var(--color-text-secondary);
		font-weight: 700;
		letter-spacing: 1px;
		margin-bottom: 6px;
		opacity: 0.8;
	}

	.box-value {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--color-text-primary);
	}
	.relative-time {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-left: 6px;
	}
	.note-value {
		font-style: italic;
		color: var(--color-text-secondary);
		opacity: 0.9;
	}

	/* Location Bar */
	.booking-location-bar {
		background: linear-gradient(
			90deg,
			rgba(var(--color-bg-secondary-rgb), 0.8),
			rgba(var(--color-bg-primary-rgb), 0.95)
		);
		padding: 20px 24px;
		border-top: 1px solid rgba(var(--color-text-primary-rgb), 0.05);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.booking-location-bar.small {
		padding: 12px 24px;
	}
	.booking-location-bar.small .location-content {
		gap: 8px;
	}

	.location-content {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.loc-icon-wrapper {
		width: 36px;
		height: 36px;
		background: rgba(var(--color-text-primary-rgb), 0.05);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ff3b30; /* Keep red for map pin? Or use accent? Let's use accent-rose or gold */
		color: var(--color-accent-rose);
	}

	.loc-text {
		display: flex;
		flex-direction: column;
	}
	.salon-name {
		font-weight: 700;
		font-size: 0.9rem;
		color: var(--color-text-primary);
	}
	.salon-name.text-muted {
		color: var(--color-text-secondary);
	}
	.salon-addr {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		opacity: 0.8;
	}

	.footer-call-btn {
		width: 48px;
		height: 48px;
		background: var(--color-accent-gold);
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-bg-primary);
		box-shadow: 0 4px 15px rgba(var(--color-accent-gold-rgb), 0.4);
		transition: transform 0.2s;
	}
	.footer-call-btn:active {
		transform: scale(0.9);
	}

	/* Empty State */
	.empty-upcoming-card {
		background: rgba(var(--color-text-primary-rgb), 0.02);
		border: 1px dashed rgba(var(--color-accent-gold-rgb), 0.3);
		border-radius: 24px;
		padding: 40px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.empty-state p {
		color: var(--color-text-secondary);
	}

	.book-new-btn {
		background: var(--gradient-gold);
		color: var(--color-bg-primary);
		border: none;
		padding: 14px 28px;
		border-radius: 100px;
		font-weight: 700;
		font-size: 1rem;
		font-family: var(--font-body);
		cursor: pointer;
		box-shadow: 0 10px 20px -5px rgba(var(--color-accent-gold-rgb), 0.4);
		transition: all 0.3s;
	}
	.book-new-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 15px 25px -5px rgba(var(--color-accent-gold-rgb), 0.5);
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		gap: 20px;
		color: var(--color-text-secondary);
	}
	.spinner {
		border: 3px solid rgba(var(--color-accent-gold-rgb), 0.1);
		border-left-color: var(--color-accent-gold);
		border-radius: 50%;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}

	/* Simplified History */
	.history-grid .booking-card {
		margin-bottom: 16px;
	}
	.history-grid .booking-time-row {
		margin-bottom: 12px;
	}
	.history-grid .booking-services-section {
		margin-bottom: 0px;
	}
</style>

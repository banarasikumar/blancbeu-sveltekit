<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';

	import { auth, db } from '$lib/firebase';
	import { collection, query, where, getDocs } from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';
	import type { User } from 'firebase/auth';
	import { LogOut, Camera, Calendar, Clock, ChevronRight } from 'lucide-svelte';
	import { logout } from '$lib/services/authService';

	// UI Components
	import TierProgress from '$lib/components/you/TierProgress.svelte';
	import StatsGrid from '$lib/components/you/StatsGrid.svelte';
	import QuickActions from '$lib/components/you/QuickActions.svelte';

	let user: User | null = null;
	let latestBooking: any = null;
	let loading = true;
	let unsubscribe: () => void;
	let isLoggingOut = false;

	// Mock Data for Premium Feel (Could be loaded from Firestore later)
	const MOCK_POINTS = 4550;
	const MOCK_SAVINGS = 4850;
	const MOCK_BOOKINGS = 24;

	onMount(() => {
		console.log('Mounting Profile Page...');
		unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			console.log('Auth State Changed:', currentUser ? 'User logged in' : 'No user');
			user = currentUser;
			loading = false; // Stop loading immediately when auth resolves

			if (user) {
				console.log('Fetching latest booking for:', user.uid);
				fetchLatestBooking(user.uid);
			} else {
				// Only redirect if NOT intentionally logging out
				if (!isLoggingOut) {
					console.log('Redirecting to login...');
					goto('/login');
				}
			}
		});
	});

	async function fetchLatestBooking(uid: string) {
		try {
			// Query latest booking
			const q = query(
				collection(db, 'bookings'),
				where('userId', '==', uid)
				// orderBy('createdAt', 'desc'), // Requires index. Fallback to client sort if needed.
				// limit(1)
			);

			const snapshot = await getDocs(q);
			if (!snapshot.empty) {
				// Client-side sort to avoid index requirement for now
				const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
				docs.sort((a: any, b: any) => {
					// Sort by created timestamp descending
					const timeA = a.createdAt?.seconds || 0;
					const timeB = b.createdAt?.seconds || 0;
					return timeB - timeA;
				});

				// Filter for upcoming only (optional, or just show absolutely latest)
				// Let's show the absolute latest active booking
				const active = docs.find(
					(b: any) =>
						b.status !== 'cancelled' && b.status !== 'declined' && b.status !== 'completed'
				);

				if (active) {
					latestBooking = active;
				} else {
					// If no active, maybe show last completed?
					// For now, let's just show nothing or a "Book Now" promo if desired.
					// Review Requirement: "Most recent booking"
					latestBooking = docs[0]; // Show the absolute latest regardless of status
				}
			}
		} catch (error) {
			console.error('Error fetching latest booking:', error);
		}
	}

	function formatDateShort(dateStr: string) {
		if (!dateStr) return '';
		try {
			// Handle YYYY-MM-DD
			const d = new Date(dateStr);
			if (isNaN(d.getTime())) return dateStr;
			return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
		} catch (e) {
			return dateStr;
		}
	}

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	const handleLogout = async () => {
		if (confirm('Are you sure you want to sign out?')) {
			isLoggingOut = true; // Prevent auto-redirect to /login
			await logout();
		}
	};

	// --- FORMATTERS ---
	function formatNextBookingTime(timestamp: any) {
		if (!timestamp) return '';
		try {
			const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp); // Handle Firestore timestamp or Date object
			const now = new Date();
			const diffMs = date.getTime() - now.getTime();
			const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
			const diffDays = Math.floor(diffHrs / 24);

			if (diffMs < 0) return 'In Progress / Completed';
			if (diffHrs < 1) return `Starts in ${Math.floor(diffMs / 60000)} mins`;
			if (diffHrs < 24) return `Starts in ${diffHrs} hours`;
			return `In ${diffDays} days`;
		} catch (e) {
			return '';
		}
	}

	function formatServiceDate(dateStr: string) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function getServiceName(service: any) {
		if (!service) return 'Service';
		return typeof service === 'string' ? service : service.name;
	}
	function editProfile() {
		alert('Edit Profile feature coming soon!');
	}
</script>

<div class="page-container">
	{#if loading}
		<!-- SHOW LOADING SPINNER WHILE CHECKING AUTH -->
		<div class="loading-state">
			<div class="spinner"></div>
		</div>
	{:else if user}
		<!-- MEMBER VIEW (ONLY) -->
		<div class="member-view" in:fade>
			<!-- PROFILE HEADER (MINIMAL REDESIGN) -->
			<div class="profile-header-minimal">
				<div class="avatar-container">
					<div class="avatar-ring-small">
						{#if user.photoURL}
							<img src={user.photoURL} alt="Profile" class="avatar-img" />
						{:else}
							<div class="avatar-placeholder">
								{user.displayName ? user.displayName[0].toUpperCase() : 'U'}
							</div>
						{/if}
						<button class="edit-btn-mini" on:click={() => alert('Change photo coming soon!')}>
							<Camera size={12} color="#000" />
						</button>
					</div>
				</div>

				<div class="profile-text-compact">
					<h1 class="profile-name-small">
						{user.displayName || 'Valued Member'}
						<button class="edit-icon" on:click={editProfile}>✎</button>
					</h1>
					<p class="profile-email-small">{user.email}</p>
					<div class="tier-pill">Gold Member</div>
				</div>
			</div>

			<!-- MAIN CONTENT -->
			<div class="dashboard-content" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<!-- LATEST BOOKING WIDGET -->
				<!-- LATEST BOOKING WIDGET (TICKET STYLE) -->
				{#if latestBooking}
					<div class="ticket-widget" on:click={() => goto('/you/bookings')}>
						<div class="ticket-content">
							<!-- Top Row: Date & Status -->
							<div class="ticket-header">
								<div class="date-badge">
									<span class="month"
										>{new Date(latestBooking.date)
											.toLocaleString('default', { month: 'short' })
											.toUpperCase()}</span
									>
									<span class="day">{latestBooking.date?.split('-')[2]}</span>
								</div>
								<div class="status-group">
									<div class="time-remaining">
										<Clock size={12} />
										<span>{formatNextBookingTime(latestBooking.createdAt)}</span>
										<!-- Note: 'createdAt' is just a proxy. ideally use proper start time object if available, 
										     but legacy app used date+time string parsing. For now, let's use the static time string below -->
									</div>
									<span class="status-tag {latestBooking.status}">{latestBooking.status}</span>
								</div>
							</div>

							<!-- Middle Row: Service Details -->
							<div class="ticket-body">
								<h3 class="service-title">
									{getServiceName(latestBooking.services?.[0])}
									{#if (latestBooking.services?.length || 0) > 1}
										<span class="plus-more">+{latestBooking.services.length - 1} more</span>
									{/if}
								</h3>
								<div class="ticket-meta">
									<span class="meta-item"
										><Calendar size={12} /> {formatServiceDate(latestBooking.date)}</span
									>
									<span class="meta-item"><Clock size={12} /> {latestBooking.time}</span>
								</div>
							</div>

							<!-- Bottom: Action -->
							<div class="ticket-footer">
								<span class="view-text">View Booking</span>
								<ChevronRight size={16} />
							</div>
						</div>

						<!-- Decorative Elements -->
						<div class="ticket-notch-left"></div>
						<div class="ticket-notch-right"></div>
						<div class="ticket-dash-line"></div>
					</div>
				{/if}

				<!-- TIER PROGRESS -->
				<TierProgress
					currentPoints={MOCK_POINTS}
					nextTierThreshold={5000}
					currentTierName="Gold"
					nextTierName="Platinum"
				/>

				<!-- KEY STATS -->
				<StatsGrid
					loyaltyPoints={MOCK_POINTS}
					totalSaved={MOCK_SAVINGS}
					bookingsCount={MOCK_BOOKINGS}
				/>

				<!-- QUICK ACTIONS -->
				<QuickActions />

				<!-- LOGOUT -->
				<button class="logout-btn" on:click={handleLogout}>
					<LogOut size={18} />
					<span>Sign Out</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		padding: 0 20px 100px;
		min-height: 100vh;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		overflow-x: hidden;
	}

	/* GLOBAL GLASS PANEL FOR REUSE */
	.glass-panel {
		background: var(--color-bg-glass);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgba(255, 255, 255, 0.15); /* Stronger border */
		border-top: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: var(--radius-lg);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.2),
			inset 0 0 0 1px rgba(255, 255, 255, 0.05); /* Inner light */
	}

	/* LOADING */
	.loading-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 60vh;
	}
	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-accent-gold);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* MINIMAL PROFILE HEADER */
	.profile-header-minimal {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 20px 0 10px; /* Reduced vertical padding */
		text-align: center;
		margin-bottom: 20px;
	}

	.avatar-ring-small {
		width: 80px; /* Smaller avatar */
		height: 80px;
		padding: 3px;
		border-radius: 50%;
		background: var(--gradient-gold);
		position: relative;
		box-shadow: 0 0 15px rgba(var(--color-accent-gold-rgb), 0.3);
		margin-bottom: 12px;
		overflow: hidden; /* Fix overlap */
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.profile-text-compact {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.profile-name-small {
		font-family: var(--font-heading);
		font-size: 1.4rem;
		color: var(--color-text-primary);
		margin: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.profile-email-small {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		margin: 0 0 8px 0;
	}
	.tier-pill {
		font-size: 0.7rem;
		padding: 4px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-accent-gold);
		color: var(--color-accent-gold);
		background: rgba(var(--color-accent-gold-rgb), 0.1);
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 1px;
	}
	.edit-btn-mini {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 24px;
		height: 24px;
		background: var(--color-accent-gold);
		border-radius: 50%;
		border: 2px solid var(--color-bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.edit-icon {
		background: none;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	/* TICKET WIDGET STYLE */
	.ticket-widget {
		background: var(--gradient-card);
		border-radius: 16px;
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.1);
		margin-bottom: 24px;
		position: relative;
		overflow: hidden;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
		cursor: pointer;
		transition: transform 0.2s;
	}
	.ticket-widget:active {
		transform: scale(0.98);
	}

	.ticket-content {
		padding: 16px;
	}

	.ticket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}
	.date-badge {
		background: rgba(var(--color-text-primary-rgb), 0.05);
		border: 1px solid rgba(var(--color-text-primary-rgb), 0.1);
		border-radius: 8px;
		padding: 6px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 50px;
	}
	.date-badge .month {
		font-size: 0.6rem;
		color: var(--color-accent-gold);
		font-weight: 700;
		line-height: 1;
		margin-bottom: 2px;
	}
	.date-badge .day {
		font-size: 1.2rem;
		color: var(--color-text-primary);
		font-weight: 700;
		line-height: 1;
	}

	.status-group {
		text-align: right;
	}
	.time-remaining {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: flex-end;
		font-size: 0.75rem;
		color: var(--color-accent-gold);
		margin-bottom: 4px;
	}
	.status-tag {
		font-size: 0.7rem;
		padding: 2px 8px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 700;
	}
	.status-tag.confirmed {
		background: rgba(46, 204, 113, 0.2);
		color: #2ecc71;
	}
	.status-tag.pending {
		background: rgba(241, 196, 15, 0.2);
		color: #f1c40f;
	}

	.ticket-body {
		margin-bottom: 12px;
	}
	.service-title {
		font-family: var(--font-heading);
		font-size: 1.2rem;
		color: var(--color-text-primary);
		margin: 0 0 4px 0;
	}
	.plus-more {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		font-weight: normal;
		font-family: sans-serif;
	}
	.ticket-meta {
		display: flex;
		gap: 12px;
		font-size: 0.85rem;
		color: var(--color-text-secondary);
	}
	.meta-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.ticket-footer {
		border-top: 1px dashed rgba(var(--color-text-primary-rgb), 0.15);
		padding-top: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}

	/* TICKET DECORATION */
	.ticket-notch-left,
	.ticket-notch-right {
		position: absolute;
		bottom: 38px;
		width: 16px;
		height: 16px;
		background: var(--color-bg-primary); /* Matches page bg */
		border-radius: 50%;
	}
	.ticket-notch-left {
		left: -8px;
	}
	.ticket-notch-right {
		right: -8px;
	}

	/* LOGOUT BUTTON */
	.logout-btn {
		width: 100%;
		margin-top: 40px;
		padding: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: rgba(255, 59, 48, 0.1);
		color: #ff3b30;
		border: 1px solid rgba(255, 59, 48, 0.3);
		border-radius: var(--radius-md);
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}
	.logout-btn:active {
		transform: scale(0.98);
		background: rgba(255, 59, 48, 0.25);
	}
</style>

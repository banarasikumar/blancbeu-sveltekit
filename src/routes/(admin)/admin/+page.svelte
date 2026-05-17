<script lang="ts">
	import { adminUser } from '$lib/stores/adminAuth';
	import {
		allBookings,
		allUsers,
		allServices,
		getBookingTimestamp,
		formatFirestoreDate,
		type Booking
	} from '$lib/stores/adminData';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		CalendarCheck,
		Users,
		TrendingUp,
		TrendingDown,
		Minus,
		Plus,
		Shield,
		Megaphone,
		BarChart3,
		FileText,
		Scissors,
		IndianRupee,
		UserPlus,
		Activity,
		PieChart,
		Zap,
		CalendarDays,
		Clock,
		ChevronRight,
		Sparkles,
		Wrench,
		Download,
		Upload
	} from 'lucide-svelte';
	import { flip } from 'svelte/animate';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// ─── Helpers ────────────────────────────────────────────────────
	const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_NAMES = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];

	function getGreeting(): string {
		const h = new Date().getHours();
		if (h < 12) return 'Good Morning';
		if (h < 17) return 'Good Afternoon';
		return 'Good Evening';
	}

	function getFormattedDate(): string {
		const d = new Date();
		return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
	}

	function getStartOfDay(date: Date): Date {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function getBookingDate(b: Booking): Date | null {
		if (!b.date) return null;
		if (b.date.seconds) return new Date(b.date.seconds * 1000);
		if (typeof b.date === 'string' && b.date.includes('-')) {
			const parts = b.date.split('-');
			if (parts.length === 3 && parts[2].length === 4) {
				return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
			}
		}
		const d = new Date(b.date);
		return isNaN(d.getTime()) ? null : d;
	}

	function getBookingAmount(b: Booking): number {
		return b.totalAmount || b.amount || b.price || 0;
	}

	function timeAgo(b: Booking): string {
		const ts = getBookingTimestamp(b);
		if (!ts || isNaN(ts)) return '';
		const diff = Math.floor((Date.now() - ts) / 1000);
		if (diff < 60) return 'Just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function getServiceLabel(b: Booking): string {
		if (b.servicesList && b.servicesList.length > 0) {
			const names = b.servicesList.map((s: any) => s.name || s.serviceName || '').filter(Boolean);
			if (names.length > 0) return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
		}
		return b.serviceName || b.services || b.service || 'Service';
	}

	function formatAmount(n: number): string {
		if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
		if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
		return `₹${n.toLocaleString('en-IN')}`;
	}

	// ─── Derived Stats ─────────────────────────────────────────────
	const now = new Date();
	const todayStart = getStartOfDay(now);
	let userName = $derived(($adminUser?.displayName || 'Admin').split(' ')[0]);

	// Today's bookings
	const todayBookings = $derived(
		$allBookings.filter((b) => {
			const d = getBookingDate(b);
			return d && d >= todayStart;
		})
	);

	// Today's upcoming (pending/confirmed only, sorted by time)
	const todayUpcoming = $derived(
		todayBookings
			.filter((b) => {
				const s = (b.status || 'pending').toLowerCase();
				return s === 'pending' || s === 'confirmed';
			})
			.slice(0, 3)
	);

	// Today's revenue (completed bookings)
	const todayRevenue = $derived(
		todayBookings
			.filter((b) => (b.status || '').toLowerCase() === 'completed')
			.reduce((sum, b) => sum + getBookingAmount(b), 0)
	);

	// Last 7 days bookings count
	const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
	const last7DaysBookings = $derived(
		$allBookings.filter((b) => {
			const d = getBookingDate(b);
			return d && d >= getStartOfDay(sevenDaysAgo);
		})
	);

	// Previous 7 days (for trend comparison)
	const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
	const prev7DaysBookings = $derived(
		$allBookings.filter((b) => {
			const d = getBookingDate(b);
			return d && d >= getStartOfDay(fourteenDaysAgo) && d < getStartOfDay(sevenDaysAgo);
		})
	);

	// Booking trend direction
	const bookingTrend = $derived.by(() => {
		const curr = last7DaysBookings.length;
		const prev = prev7DaysBookings.length;
		if (prev === 0 && curr === 0) return 'neutral';
		if (prev === 0) return 'up';
		return curr >= prev ? 'up' : 'down';
	});

	const bookingTrendPct = $derived.by(() => {
		const curr = last7DaysBookings.length;
		const prev = prev7DaysBookings.length;
		if (prev === 0) return curr > 0 ? 100 : 0;
		return Math.round(((curr - prev) / prev) * 100);
	});

	// Completion rate (last 7 days)
	const completionRate = $derived.by(() => {
		const total = last7DaysBookings.length;
		if (total === 0) return 0;
		const completed = last7DaysBookings.filter(
			(b) => (b.status || '').toLowerCase() === 'completed'
		).length;
		return Math.round((completed / total) * 100);
	});

	// New users in last 7 days
	const newUsersLast7Days = $derived(
		$allUsers.filter((u) => {
			if (!u.createdAt) return false;
			const ts = u.createdAt.seconds ? u.createdAt.seconds * 1000 : new Date(u.createdAt).getTime();
			return ts >= sevenDaysAgo.getTime();
		}).length
	);

	// Daily trend data (last 7 days)
	const dailyTrend = $derived.by(() => {
		const days: { day: string; date: number; count: number; isToday: boolean }[] = [];
		for (let i = 6; i >= 0; i--) {
			const date = new Date(now.getTime() - i * 86400000);
			const dayStart = getStartOfDay(date);
			const dayEnd = new Date(dayStart.getTime() + 86400000);
			const count = $allBookings.filter((b) => {
				const d = getBookingDate(b);
				return d && d >= dayStart && d < dayEnd;
			}).length;
			days.push({
				day: DAY_NAMES[date.getDay()],
				date: date.getDate(),
				count,
				isToday: i === 0
			});
		}
		return days;
	});

	const maxDailyCount = $derived(Math.max(...dailyTrend.map((d) => d.count), 1));
	const avgDaily = $derived(
		dailyTrend.length > 0
			? Math.round(dailyTrend.reduce((s, d) => s + d.count, 0) / dailyTrend.length)
			: 0
	);

	// Status breakdown
	const statusBreakdown = $derived.by(() => {
		const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
		for (const b of $allBookings) {
			const s = (b.status || 'pending').toLowerCase();
			if (s in counts) counts[s as keyof typeof counts]++;
		}
		return counts;
	});

	// Recent bookings (last 5)
	const recentBookings = $derived($allBookings.slice(0, 5));

	// Total 7-day revenue
	const weekRevenue = $derived(
		last7DaysBookings
			.filter((b) => (b.status || '').toLowerCase() === 'completed')
			.reduce((sum, b) => sum + getBookingAmount(b), 0)
	);

	// ─── Quick Actions ──────────────────────────────────────────────
	let actions = $state([
		{
			label: 'Invoice',
			icon: FileText,
			bg: 'var(--admin-purple)',
			handler: () => goto('/admin/invoice')
		},
		{
			label: 'Service',
			icon: Plus,
			bg: 'var(--admin-accent)',
			handler: () => goto('/admin/services')
		},
		{ label: 'Roles', icon: Shield, bg: 'var(--admin-green)', handler: () => goto('/admin/staff') },
		{
			label: 'Tools',
			icon: Wrench,
			bg: 'var(--admin-indigo)',
			handler: () => {
				showToolsMenu = !showToolsMenu;
			}
		},
		{
			label: 'Reports',
			icon: BarChart3,
			bg: 'var(--admin-pink)',
			handler: () => goto('/admin/reports')
		}
	]);

	/* --- Tools dropdown menu --- */
	let showToolsMenu = $state(false);

	function handleToolsMenuClick(path: string) {
		showToolsMenu = false;
		goto(path);
	}

	// Close tools menu when clicking outside
	function handleWindowClick(e: MouseEvent) {
		if (showToolsMenu) {
			const target = e.target as HTMLElement;
			if (!target.closest('.dash-tools-menu') && !target.closest('.dash-action-btn[data-tools]')) {
				showToolsMenu = false;
			}
		}
	}

	/* --- Drag & Drop Reordering --- */
	let isEditing = $state(false);
	let draggingIndex = $state<number | null>(null);

	onMount(() => {
		if (browser) {
			const saved = localStorage.getItem('adminActionOrder');
			if (saved) {
				try {
					const order = JSON.parse(saved);
					actions.sort((a, b) => {
						const idxA = order.indexOf(a.label);
						const idxB = order.indexOf(b.label);
						if (idxA === -1) return 1;
						if (idxB === -1) return -1;
						return idxA - idxB;
					});
				} catch {
					/* ignore */
				}
			}
		}
	});

	function handlePointerDown(e: PointerEvent, index: number) {
		if (!isEditing) return;
		e.preventDefault();
		draggingIndex = index;
		window.addEventListener('pointermove', handleGlobalPointerMove);
		window.addEventListener('pointerup', handleGlobalPointerUp);
	}

	function handleGlobalPointerMove(e: PointerEvent) {
		if (draggingIndex === null) return;
		const elements = document.elementsFromPoint(e.clientX, e.clientY);
		const target = elements.find((el) => el.closest('.dash-action-btn'));
		if (target) {
			const btn = target.closest('.dash-action-btn') as HTMLElement;
			if (btn && btn.dataset.index) {
				const newIndex = parseInt(btn.dataset.index);
				if (newIndex !== draggingIndex) {
					const item = actions[draggingIndex];
					actions.splice(draggingIndex, 1);
					actions.splice(newIndex, 0, item);
					draggingIndex = newIndex;
				}
			}
		}
	}

	function handleGlobalPointerUp() {
		draggingIndex = null;
		window.removeEventListener('pointermove', handleGlobalPointerMove);
		window.removeEventListener('pointerup', handleGlobalPointerUp);
		if (browser) {
			const order = actions.map((a) => a.label);
			localStorage.setItem('adminActionOrder', JSON.stringify(order));
		}
	}

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('pointermove', handleGlobalPointerMove);
			window.removeEventListener('pointerup', handleGlobalPointerUp);
		}
	});

	function toggleEdit() {
		isEditing = !isEditing;
	}

	// SVG Donut helpers
	function getDonutSegments(breakdown: typeof statusBreakdown) {
		const total =
			breakdown.pending + breakdown.confirmed + breakdown.completed + breakdown.cancelled;
		if (total === 0) return [];
		const segments: { key: string; pct: number; offset: number; color: string }[] = [];
		const colorMap: Record<string, string> = {
			pending: 'var(--admin-orange)',
			confirmed: 'var(--admin-green)',
			completed: 'var(--admin-accent)',
			cancelled: 'var(--admin-red)'
		};
		let offset = 0;
		for (const [key, count] of Object.entries(breakdown)) {
			const pct = (count / total) * 100;
			if (pct > 0) segments.push({ key, pct, offset, color: colorMap[key] || '#888' });
			offset += pct;
		}
		return segments;
	}

	const donutSegments = $derived(getDonutSegments(statusBreakdown));
	const totalBookings = $derived($allBookings.length);
</script>

<!-- ═══════════ 0. Greeting Bar ═══════════ -->
<div class="dash-greeting dash-animate dash-delay-1">
	<div class="dash-greeting-left">
		<span class="dash-greeting-text">{getGreeting()}, {userName}</span>
		<span class="dash-greeting-date">{getFormattedDate()}</span>
	</div>
	{#if statusBreakdown.pending > 0}
		<button class="dash-pending-pill" onclick={() => goto('/admin/bookings')}>
			<span class="dash-pending-pulse"></span>
			{statusBreakdown.pending} pending
		</button>
	{/if}
</div>

<!-- ═══════════ 1. KPI Strip ═══════════ -->
<div class="dash-kpi-strip dash-animate dash-delay-2">
	<button class="dash-kpi-card kpi-revenue" onclick={() => goto('/admin/bookings')}>
		<div class="dash-kpi-top">
			<div
				class="dash-kpi-icon"
				style="background: var(--admin-green-light); color: var(--admin-green);"
			>
				<IndianRupee size={18} />
			</div>
			{#if todayRevenue > 0}
				<span class="dash-kpi-trend up"><TrendingUp size={11} /></span>
			{:else}
				<span class="dash-kpi-trend neutral"><Minus size={11} /></span>
			{/if}
		</div>
		<div class="dash-kpi-value">{formatAmount(todayRevenue)}</div>
		<div class="dash-kpi-label">Today's Revenue</div>
	</button>

	<button class="dash-kpi-card kpi-bookings" onclick={() => goto('/admin/bookings')}>
		<div class="dash-kpi-top">
			<div
				class="dash-kpi-icon"
				style="background: var(--admin-accent-light); color: var(--admin-accent);"
			>
				<CalendarCheck size={18} />
			</div>
			<span class="dash-kpi-trend {bookingTrend}">
				{#if bookingTrend === 'up'}
					<TrendingUp size={11} />{bookingTrendPct > 0 ? `${bookingTrendPct}%` : ''}
				{:else if bookingTrend === 'down'}
					<TrendingDown size={11} />{bookingTrendPct}%
				{:else}
					<Minus size={11} />
				{/if}
			</span>
		</div>
		<div class="dash-kpi-value">{todayBookings.length}</div>
		<div class="dash-kpi-label">Today's Bookings</div>
	</button>

	<button class="dash-kpi-card kpi-rate" onclick={() => goto('/admin/reports')}>
		<div class="dash-kpi-top">
			<div
				class="dash-kpi-icon"
				style="background: var(--admin-purple-light); color: var(--admin-purple);"
			>
				<Activity size={18} />
			</div>
			<span
				class="dash-kpi-trend {completionRate >= 50
					? 'up'
					: completionRate > 0
						? 'down'
						: 'neutral'}"
			>
				{#if completionRate >= 50}<TrendingUp size={11} />
				{:else if completionRate > 0}<TrendingDown size={11} />
				{:else}<Minus size={11} />
				{/if}
			</span>
		</div>
		<div class="dash-kpi-value">{completionRate}<span class="dash-kpi-unit">%</span></div>
		<div class="dash-kpi-label">Completion (7d)</div>
	</button>

	<button class="dash-kpi-card kpi-users" onclick={() => goto('/admin/users')}>
		<div class="dash-kpi-top">
			<div
				class="dash-kpi-icon"
				style="background: rgba(94,92,230,0.15); color: var(--admin-indigo);"
			>
				<UserPlus size={18} />
			</div>
			{#if newUsersLast7Days > 0}
				<span class="dash-kpi-trend up"><TrendingUp size={11} />+{newUsersLast7Days}</span>
			{:else}
				<span class="dash-kpi-trend neutral"><Minus size={11} /></span>
			{/if}
		</div>
		<div class="dash-kpi-value">{newUsersLast7Days}</div>
		<div class="dash-kpi-label">New Users (7d)</div>
	</button>
</div>

<!-- ═══════════ 2. Today's Upcoming ═══════════ -->
{#if todayUpcoming.length > 0}
	<div class="dash-upcoming-card dash-animate dash-delay-3">
		<div class="dash-section-header">
			<div class="dash-section-title">
				<div
					class="dash-title-icon"
					style="background: var(--admin-orange-light); color: var(--admin-orange);"
				>
					<Clock size={15} />
				</div>
				Upcoming Today
			</div>
			<button class="dash-section-link" onclick={() => goto('/admin/bookings')}>
				{todayBookings.length} total <ChevronRight size={14} />
			</button>
		</div>
		<div class="dash-upcoming-list">
			{#each todayUpcoming as booking}
				<button class="dash-upcoming-item" onclick={() => goto('/admin/bookings')}>
					<div class="dash-upcoming-time-col">
						<span class="dash-upcoming-time">{booking.time || '—'}</span>
					</div>
					<div class="dash-upcoming-divider">
						<span class="dash-upcoming-dot {(booking.status || 'pending').toLowerCase()}"></span>
						<span class="dash-upcoming-line"></span>
					</div>
					<div class="dash-upcoming-detail">
						<span class="dash-upcoming-name">{booking.userName || 'Guest'}</span>
						<span class="dash-upcoming-service">{getServiceLabel(booking)}</span>
					</div>
					{#if getBookingAmount(booking) > 0}
						<span class="dash-upcoming-amount"
							>₹{getBookingAmount(booking).toLocaleString('en-IN')}</span
						>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}

<!-- ═══════════ 3. 7-Day Trend ═══════════ -->
<div class="dash-chart-card dash-animate dash-delay-3">
	<div class="dash-section-header">
		<div>
			<div class="dash-section-title">
				<div
					class="dash-title-icon"
					style="background: var(--admin-accent-light); color: var(--admin-accent);"
				>
					<BarChart3 size={15} />
				</div>
				Booking Trend
			</div>
			<div class="dash-section-subtitle">Last 7 days · avg {avgDaily}/day</div>
		</div>
		<button class="dash-section-link" onclick={() => goto('/admin/bookings')}>View All</button>
	</div>

	<div class="dash-bar-chart">
		{#each dailyTrend as day}
			<div class="dash-bar-col" class:today={day.isToday}>
				<span class="dash-bar-count">{day.count || ''}</span>
				<div
					class="dash-bar"
					class:bar-max={day.count === maxDailyCount && day.count > 0}
					class:bar-zero={day.count === 0}
					style="height: {day.count === 0
						? '4px'
						: `${Math.max((day.count / maxDailyCount) * 100, 8)}%`};"
				></div>
				<span class="dash-bar-day">{day.isToday ? 'Today' : day.day}</span>
			</div>
		{/each}
	</div>

	<div class="dash-chart-summary">
		<div class="dash-chart-stat">
			<span class="dash-chart-stat-value">{last7DaysBookings.length}</span>
			<span class="dash-chart-stat-label">Bookings</span>
		</div>
		<div class="dash-chart-stat">
			<span class="dash-chart-stat-value">{formatAmount(weekRevenue)}</span>
			<span class="dash-chart-stat-label">Revenue</span>
		</div>
		<div class="dash-chart-stat">
			<span class="dash-chart-stat-value">{$allServices.length}</span>
			<span class="dash-chart-stat-label">Services</span>
		</div>
		<div class="dash-chart-stat">
			<span class="dash-chart-stat-value">{$allUsers.length}</span>
			<span class="dash-chart-stat-label">Users</span>
		</div>
	</div>
</div>

<!-- ═══════════ 4. Status Breakdown ═══════════ -->
<div class="dash-status-card dash-animate dash-delay-4">
	<div class="dash-section-header" style="margin-bottom: 16px;">
		<div class="dash-section-title">
			<div
				class="dash-title-icon"
				style="background: var(--admin-purple-light); color: var(--admin-purple);"
			>
				<PieChart size={15} />
			</div>
			Booking Status
		</div>
		<span class="dash-section-subtitle">All time</span>
	</div>

	<div class="dash-status-grid">
		<div class="dash-donut-wrap">
			<svg viewBox="0 0 36 36" width="110" height="110">
				<circle
					cx="18"
					cy="18"
					r="15.915"
					fill="none"
					stroke="var(--admin-border)"
					stroke-width="3.2"
				/>
				{#each donutSegments as seg}
					<circle
						cx="18"
						cy="18"
						r="15.915"
						fill="none"
						stroke={seg.color}
						stroke-width="3.2"
						stroke-dasharray="{Math.max(seg.pct - 0.8, 0)} {100 - Math.max(seg.pct - 0.8, 0)}"
						stroke-dashoffset={-(seg.offset + 0.4)}
						stroke-linecap="round"
						transform="rotate(-90 18 18)"
						style="transition: stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease;"
					/>
				{/each}
			</svg>
			<div class="dash-donut-center">
				<div class="dash-donut-total">{totalBookings}</div>
				<div class="dash-donut-label">Total</div>
			</div>
		</div>

		<div class="dash-legend">
			{#each [{ key: 'pending', label: 'Pending', count: statusBreakdown.pending }, { key: 'confirmed', label: 'Confirmed', count: statusBreakdown.confirmed }, { key: 'completed', label: 'Completed', count: statusBreakdown.completed }, { key: 'cancelled', label: 'Cancelled', count: statusBreakdown.cancelled }] as item}
				<div class="dash-legend-item">
					<span class="dash-legend-dot {item.key}"></span>
					<span class="dash-legend-text">{item.label}</span>
					<span class="dash-legend-count">{item.count}</span>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- ═══════════ 5. Recent Activity ═══════════ -->
<div class="dash-animate dash-delay-5">
	<div class="dash-section-header">
		<div class="dash-section-title">
			<div
				class="dash-title-icon"
				style="background: var(--admin-green-light); color: var(--admin-green);"
			>
				<Zap size={15} />
			</div>
			Recent Activity
		</div>
		<button class="dash-section-link" onclick={() => goto('/admin/bookings')}>
			See All <ChevronRight size={14} />
		</button>
	</div>

	<div class="dash-activity-card">
		{#if recentBookings.length === 0}
			<div class="dash-empty-state">
				<CalendarDays size={32} />
				<p>No bookings yet</p>
			</div>
		{:else}
			{#each recentBookings as booking}
				<button class="dash-activity-item" onclick={() => goto('/admin/bookings')}>
					<span
						class="dash-activity-dot {(booking.status || 'pending').toLowerCase()}"
						class:live-pulse={(booking.status || 'pending').toLowerCase() === 'pending'}
					></span>
					<div class="dash-activity-info">
						<div class="dash-activity-name">{booking.userName || 'Guest'}</div>
						<div class="dash-activity-service">{getServiceLabel(booking)}</div>
					</div>
					<div class="dash-activity-meta">
						{#if getBookingAmount(booking) > 0}
							<div class="dash-activity-amount">
								₹{getBookingAmount(booking).toLocaleString('en-IN')}
							</div>
						{:else}
							<div class="dash-activity-time">{timeAgo(booking)}</div>
						{/if}
						<div class="dash-activity-status {(booking.status || 'pending').toLowerCase()}">
							{booking.status || 'Pending'}
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

<!-- ═══════════ 6. Quick Actions ═══════════ -->
<div class="dash-animate dash-delay-6">
	<div class="dash-section-header">
		<div class="dash-section-title">
			<div
				class="dash-title-icon"
				style="background: rgba(255,55,95,0.12); color: var(--admin-pink);"
			>
				<Sparkles size={15} />
			</div>
			Quick Actions
		</div>
		<button class="dash-section-link" onclick={toggleEdit}>
			{isEditing ? 'Done' : 'Edit'}
		</button>
	</div>

	<div class="dash-actions-grid">
		{#each actions as action, i (action.label)}
			<div style="position: relative;" animate:flip={{ duration: 300 }}>
				<button
					class="dash-action-btn"
					class:editing={isEditing}
					class:dragging={draggingIndex === i}
					data-index={i}
					data-tools={action.label === 'Tools' ? '' : undefined}
					onclick={!isEditing ? action.handler : undefined}
					onpointerdown={(e) => handlePointerDown(e, i)}
					style="touch-action: none;"
				>
					<div
						class="dash-action-icon-wrap"
						style="background: {action.bg}; opacity: {isEditing ? 0.8 : 1};"
					>
						<action.icon size={20} color="#fff" />
					</div>
					<span class="dash-action-label">{action.label}</span>
				</button>

				{#if action.label === 'Tools' && showToolsMenu}
					<div class="dash-tools-menu">
						<button class="dash-tools-menu-item" onclick={() => handleToolsMenuClick('/admin/tools')}>
							<div class="dash-tools-menu-icon" style="background: var(--admin-green-light); color: var(--admin-green);">
								<Download size={16} />
							</div>
							<div class="dash-tools-menu-text">
								<span class="dash-tools-menu-label">Users Exporter</span>
								<span class="dash-tools-menu-desc">Export user data</span>
							</div>
						</button>
						<button class="dash-tools-menu-item" onclick={() => handleToolsMenuClick('/admin/import-walkins')}>
							<div class="dash-tools-menu-icon" style="background: var(--admin-accent-light); color: var(--admin-accent);">
								<Upload size={16} />
							</div>
							<div class="dash-tools-menu-text">
								<span class="dash-tools-menu-label">Walk-in Importer</span>
								<span class="dash-tools-menu-desc">Import VCF contacts</span>
							</div>
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<svelte:window onclick={handleWindowClick} />

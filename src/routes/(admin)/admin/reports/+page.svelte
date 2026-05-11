<script lang="ts">
	import { allBookings, allUsers, allServices, type Booking } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import {
		TrendingUp,
		TrendingDown,
		Users,
		CalendarCheck,
		DollarSign,
		BarChart3,
		Download,
		FileSpreadsheet,
		UserPlus,
		Scissors,
		Activity
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	let range = $state<7 | 14 | 30>(30);
	let mounted = $state(false);
	onMount(() => {
		setTimeout(() => (mounted = true), 100);
	});

	const now = Date.now();
	const DAY = 86400000;

	function getTs(b: Booking): number {
		if (b.date?.seconds) return b.date.seconds * 1000;
		if (typeof b.date === 'string' && b.date.includes('-')) {
			const p = b.date.split('-');
			if (p.length === 3 && p[2].length === 4) return new Date(+p[2], +p[1] - 1, +p[0]).getTime();
		}
		if (b.date) return new Date(b.date).getTime();
		return b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Date.now();
	}

	function getUserTs(u: any): number {
		if (u.createdAt?.seconds) return u.createdAt.seconds * 1000;
		if (u.createdAt) return new Date(u.createdAt).getTime();
		return 0;
	}

	function getAmount(b: Booking): number {
		if (b.totalAmount) return +b.totalAmount;
		if (b.servicesList?.length) {
			return b.servicesList.reduce((s: number, x: any) => s + (x.price || 0), 0);
		}
		return 0;
	}

	let rangeBookings = $derived($allBookings.filter((b) => getTs(b) >= now - range * DAY));
	let prevBookings = $derived(
		$allBookings.filter((b) => {
			const t = getTs(b);
			return t >= now - range * 2 * DAY && t < now - range * DAY;
		})
	);
	let rangeUsers = $derived($allUsers.filter((u) => getUserTs(u) >= now - range * DAY));

	let completedInRange = $derived(
		rangeBookings.filter((b) => b.status?.toLowerCase() === 'completed')
	);
	let revenue = $derived(completedInRange.reduce((s, b) => s + getAmount(b), 0));
	let prevRevenue = $derived(
		prevBookings
			.filter((b) => b.status?.toLowerCase() === 'completed')
			.reduce((s, b) => s + getAmount(b), 0)
	);
	let avgValue = $derived(completedInRange.length ? revenue / completedInRange.length : 0);

	let revTrend = $derived(
		prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0
	);
	let bookTrend = $derived(
		prevBookings.length > 0
			? ((rangeBookings.length - prevBookings.length) / prevBookings.length) * 100
			: rangeBookings.length > 0
				? 100
				: 0
	);

	const fmt = (n: number) =>
		new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0
		}).format(n);

	// Daily breakdown for bar chart
	let dailyData = $derived.by(() => {
		const days: { label: string; bookings: number; revenue: number }[] = [];
		for (let i = range - 1; i >= 0; i--) {
			const start = now - (i + 1) * DAY;
			const end = now - i * DAY;
			const dayBookings = rangeBookings.filter((b) => {
				const t = getTs(b);
				return t >= start && t < end;
			});
			const dayRev = dayBookings
				.filter((b) => b.status?.toLowerCase() === 'completed')
				.reduce((s, b) => s + getAmount(b), 0);
			const d = new Date(end);
			days.push({
				label: `${d.getDate()}/${d.getMonth() + 1}`,
				bookings: dayBookings.length,
				revenue: dayRev
			});
		}
		return days;
	});

	let maxBookings = $derived(Math.max(...dailyData.map((d) => d.bookings), 1));
	let maxRevenue = $derived(Math.max(...dailyData.map((d) => d.revenue), 1));

	// Status breakdown for donut
	let statusCounts = $derived.by(() => {
		const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
		rangeBookings.forEach((b) => {
			const s = (b.status || 'pending').toLowerCase() as keyof typeof counts;
			if (s in counts) counts[s]++;
		});
		return counts;
	});

	let donutGradient = $derived.by(() => {
		const total = rangeBookings.length || 1;
		const { pending, confirmed, completed, cancelled } = statusCounts;
		const p1 = (completed / total) * 100;
		const p2 = p1 + (confirmed / total) * 100;
		const p3 = p2 + (pending / total) * 100;
		return `conic-gradient(var(--admin-accent) 0% ${p1}%, var(--admin-green) ${p1}% ${p2}%, var(--admin-orange) ${p2}% ${p3}%, var(--admin-red) ${p3}% 100%)`;
	});

	// Top services
	let topServices = $derived.by(() => {
		const map = new Map<string, number>();
		rangeBookings.forEach((b) => {
			const names: string[] = [];
			if (b.servicesList?.length)
				b.servicesList.forEach((s: any) => names.push(s.name || s.serviceName || String(s)));
			else if (b.serviceName) names.push(b.serviceName);
			else if (b.service) b.service.split(',').forEach((s: string) => names.push(s.trim()));
			names.forEach((n) => map.set(n, (map.get(n) || 0) + 1));
		});
		return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
	});

	let maxServiceCount = $derived(topServices.length ? topServices[0][1] : 1);

	// CSV Export
	function downloadCSV(filename: string, headers: string[], rows: string[][]) {
		const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
			'\n'
		);
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
		showToast(`${filename} downloaded!`, 'success');
	}

	function exportBookings() {
		const headers = ['ID', 'Client', 'Phone', 'Date', 'Time', 'Service', 'Status', 'Amount'];
		const rows = rangeBookings.map((b) => [
			b.id,
			b.userName || '',
			b.userPhone || '',
			b.date?.seconds ? new Date(b.date.seconds * 1000).toLocaleDateString() : String(b.date || ''),
			b.time || '',
			b.serviceName || b.service || '',
			b.status || '',
			String(getAmount(b))
		]);
		downloadCSV(`bookings_${range}d.csv`, headers, rows);
	}

	function exportRevenue() {
		const headers = ['Date', 'Bookings', 'Revenue'];
		const rows = dailyData.map((d) => [d.label, String(d.bookings), String(d.revenue)]);
		downloadCSV(`revenue_${range}d.csv`, headers, rows);
	}

	function exportUsers() {
		const headers = ['Name', 'Email', 'Phone', 'Joined'];
		const rows = rangeUsers.map((u) => [
			u.displayName || u.name || '',
			u.email || '',
			u.phone || u.phoneNumber || '',
			getUserTs(u) ? new Date(getUserTs(u)).toLocaleDateString() : ''
		]);
		downloadCSV(`users_${range}d.csv`, headers, rows);
	}

	function exportServices() {
		const headers = ['Service', 'Bookings'];
		const rows = topServices.map(([name, count]) => [name, String(count)]);
		downloadCSV(`services_${range}d.csv`, headers, rows);
	}
</script>

<!-- Time Range Filter -->
<div class="rpt-filter-bar">
	{#each [7, 14, 30] as d}
		<button
			class="admin-filter-chip"
			class:active={range === d}
			onclick={() => (range = d as 7 | 14 | 30)}
		>
			{d} Days
		</button>
	{/each}
</div>

<!-- KPI Cards -->
<div class="rpt-kpi-grid" class:mounted>
	<div class="rpt-kpi" style="--delay:0">
		<div
			class="rpt-kpi-icon"
			style="background: var(--admin-accent-light); color: var(--admin-accent);"
		>
			<DollarSign size={20} />
		</div>
		<div class="rpt-kpi-body">
			<span class="rpt-kpi-value">{fmt(revenue)}</span>
			<span class="rpt-kpi-label">Revenue</span>
		</div>
		<div class="rpt-kpi-trend" class:up={revTrend >= 0} class:down={revTrend < 0}>
			{#if revTrend >= 0}<TrendingUp size={14} />{:else}<TrendingDown size={14} />{/if}
			{Math.abs(revTrend).toFixed(0)}%
		</div>
	</div>

	<div class="rpt-kpi" style="--delay:1">
		<div
			class="rpt-kpi-icon"
			style="background: var(--admin-green-light); color: var(--admin-green);"
		>
			<CalendarCheck size={20} />
		</div>
		<div class="rpt-kpi-body">
			<span class="rpt-kpi-value">{rangeBookings.length}</span>
			<span class="rpt-kpi-label">Bookings</span>
		</div>
		<div class="rpt-kpi-trend" class:up={bookTrend >= 0} class:down={bookTrend < 0}>
			{#if bookTrend >= 0}<TrendingUp size={14} />{:else}<TrendingDown size={14} />{/if}
			{Math.abs(bookTrend).toFixed(0)}%
		</div>
	</div>

	<div class="rpt-kpi" style="--delay:2">
		<div
			class="rpt-kpi-icon"
			style="background: var(--admin-purple-light); color: var(--admin-purple);"
		>
			<UserPlus size={20} />
		</div>
		<div class="rpt-kpi-body">
			<span class="rpt-kpi-value">{rangeUsers.length}</span>
			<span class="rpt-kpi-label">New Users</span>
		</div>
	</div>

	<div class="rpt-kpi" style="--delay:3">
		<div
			class="rpt-kpi-icon"
			style="background: var(--admin-orange-light); color: var(--admin-orange);"
		>
			<Activity size={20} />
		</div>
		<div class="rpt-kpi-body">
			<span class="rpt-kpi-value">{fmt(avgValue)}</span>
			<span class="rpt-kpi-label">Avg. Value</span>
		</div>
	</div>
</div>

<!-- Booking Trend Chart -->
<div class="rpt-card">
	<div class="rpt-card-header">
		<h3><CalendarCheck size={16} /> Booking Trend</h3>
		<span class="rpt-card-sub">{range}D</span>
	</div>
	<div class="rpt-bar-chart">
		{#each dailyData as day, i}
			<div class="rpt-bar-col" title="{day.label}: {day.bookings} bookings">
				<div
					class="rpt-bar"
					style="height: {(day.bookings / maxBookings) * 100}%; animation-delay: {i * 15}ms;"
				></div>
				{#if range <= 14}<span class="rpt-bar-label">{day.label}</span>{/if}
			</div>
		{/each}
	</div>
</div>

<!-- Revenue + Status Row -->
<div class="rpt-row">
	<div class="rpt-card rpt-card-flex">
		<div class="rpt-card-header">
			<h3><DollarSign size={16} /> Revenue</h3>
		</div>
		<div class="rpt-bar-chart rpt-bar-sm">
			{#each dailyData as day, i}
				<div class="rpt-bar-col" title="{day.label}: {fmt(day.revenue)}">
					<div
						class="rpt-bar revenue"
						style="height: {(day.revenue / maxRevenue) * 100}%; animation-delay: {i * 15}ms;"
					></div>
				</div>
			{/each}
		</div>
	</div>

	<div class="rpt-card rpt-card-flex">
		<div class="rpt-card-header">
			<h3><BarChart3 size={16} /> Status</h3>
		</div>
		<div class="rpt-donut-wrap">
			<div class="rpt-donut" style="background: {donutGradient};">
				<div class="rpt-donut-hole">
					<span>{rangeBookings.length}</span>
				</div>
			</div>
			<div class="rpt-legend">
				<span><i style="background:var(--admin-accent);"></i> Done {statusCounts.completed}</span>
				<span><i style="background:var(--admin-green);"></i> Conf {statusCounts.confirmed}</span>
				<span><i style="background:var(--admin-orange);"></i> Pend {statusCounts.pending}</span>
				<span><i style="background:var(--admin-red);"></i> Canc {statusCounts.cancelled}</span>
			</div>
		</div>
	</div>
</div>

<!-- Top Services -->
<div class="rpt-card">
	<div class="rpt-card-header">
		<h3><Scissors size={16} /> Top Services</h3>
	</div>
	{#if topServices.length === 0}
		<p class="rpt-empty">No service data yet</p>
	{:else}
		<div class="rpt-hbars">
			{#each topServices as [name, count], i}
				<div class="rpt-hbar-row">
					<span class="rpt-hbar-name">{name}</span>
					<div class="rpt-hbar-track">
						<div
							class="rpt-hbar-fill"
							style="width: {(count / maxServiceCount) * 100}%; animation-delay: {i * 80}ms;"
						></div>
					</div>
					<span class="rpt-hbar-count">{count}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Export Reports -->
<h3 class="admin-section-title" style="margin-top: 28px;">Generate Reports</h3>
<div class="rpt-export-grid">
	<button class="rpt-export-card" onclick={exportBookings}>
		<div
			class="rpt-export-icon"
			style="background: var(--admin-accent-light); color: var(--admin-accent);"
		>
			<FileSpreadsheet size={22} />
		</div>
		<div class="rpt-export-info">
			<span class="rpt-export-title">Booking Summary</span>
			<span class="rpt-export-desc">All bookings · {range} days · CSV</span>
		</div>
		<Download size={18} color="var(--admin-text-tertiary)" />
	</button>

	<button class="rpt-export-card" onclick={exportRevenue}>
		<div
			class="rpt-export-icon"
			style="background: var(--admin-green-light); color: var(--admin-green);"
		>
			<DollarSign size={22} />
		</div>
		<div class="rpt-export-info">
			<span class="rpt-export-title">Revenue Report</span>
			<span class="rpt-export-desc">Daily breakdown · {range} days · CSV</span>
		</div>
		<Download size={18} color="var(--admin-text-tertiary)" />
	</button>

	<button class="rpt-export-card" onclick={exportUsers}>
		<div
			class="rpt-export-icon"
			style="background: var(--admin-purple-light); color: var(--admin-purple);"
		>
			<Users size={22} />
		</div>
		<div class="rpt-export-info">
			<span class="rpt-export-title">User Growth</span>
			<span class="rpt-export-desc">New signups · {range} days · CSV</span>
		</div>
		<Download size={18} color="var(--admin-text-tertiary)" />
	</button>

	<button class="rpt-export-card" onclick={exportServices}>
		<div
			class="rpt-export-icon"
			style="background: var(--admin-orange-light); color: var(--admin-orange);"
		>
			<Scissors size={22} />
		</div>
		<div class="rpt-export-info">
			<span class="rpt-export-title">Service Performance</span>
			<span class="rpt-export-desc">Top services · {range} days · CSV</span>
		</div>
		<Download size={18} color="var(--admin-text-tertiary)" />
	</button>
</div>

<style>
	/* Filter Bar */
	.rpt-filter-bar {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
	}

	/* KPI Grid */
	.rpt-kpi-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 24px;
	}
	.rpt-kpi {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-lg);
		padding: 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px;
		box-shadow: var(--admin-shadow-sm);
		position: relative;
		opacity: 0;
		transform: translateY(12px);
		transition:
			opacity 0.4s ease,
			transform 0.4s ease;
		transition-delay: calc(var(--delay, 0) * 80ms);
	}
	.rpt-kpi-grid.mounted .rpt-kpi {
		opacity: 1;
		transform: translateY(0);
	}
	.rpt-kpi-icon {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.rpt-kpi-body {
		flex: 1;
		min-width: 60px;
	}
	.rpt-kpi-value {
		font-family: var(--admin-font-display);
		font-size: 20px;
		font-weight: 800;
		color: var(--admin-text-primary);
		display: block;
		line-height: 1.2;
	}
	.rpt-kpi-label {
		font-size: 11px;
		color: var(--admin-text-secondary);
		font-weight: 600;
	}
	.rpt-kpi-trend {
		position: absolute;
		top: 12px;
		right: 14px;
		font-size: 11px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 8px;
		border-radius: 8px;
	}
	.rpt-kpi-trend.up {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}
	.rpt-kpi-trend.down {
		background: var(--admin-red-light);
		color: var(--admin-red);
	}

	/* Cards */
	.rpt-card {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-lg);
		padding: 18px;
		margin-bottom: 16px;
		box-shadow: var(--admin-shadow-sm);
	}
	.rpt-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 14px;
	}
	.rpt-card-header h3 {
		font-family: var(--admin-font-display);
		font-size: 15px;
		font-weight: 700;
		color: var(--admin-text-primary);
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.rpt-card-sub {
		font-size: 11px;
		font-weight: 700;
		color: var(--admin-text-tertiary);
		background: var(--admin-bg);
		padding: 3px 10px;
		border-radius: 8px;
	}

	/* Bar Chart */
	.rpt-bar-chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 120px;
		padding-top: 8px;
	}
	.rpt-bar-sm {
		height: 80px;
	}
	.rpt-bar-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		height: 100%;
		justify-content: flex-end;
	}
	.rpt-bar {
		width: 100%;
		min-height: 2px;
		border-radius: 4px 4px 0 0;
		background: linear-gradient(180deg, var(--admin-accent), var(--admin-accent-light));
		animation: barGrow 0.6s ease both;
	}
	.rpt-bar.revenue {
		background: linear-gradient(180deg, var(--admin-green), var(--admin-green-light));
	}
	.rpt-bar-label {
		font-size: 8px;
		color: var(--admin-text-tertiary);
		margin-top: 4px;
		writing-mode: vertical-lr;
		transform: rotate(180deg);
		max-height: 30px;
		overflow: hidden;
		font-weight: 600;
	}

	@keyframes barGrow {
		from {
			transform: scaleY(0);
		}
		to {
			transform: scaleY(1);
		}
	}

	/* Row Layout */
	.rpt-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.rpt-card-flex {
		margin-bottom: 16px;
	}

	/* Donut */
	.rpt-donut-wrap {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.rpt-donut {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		position: relative;
		flex-shrink: 0;
	}
	.rpt-donut-hole {
		position: absolute;
		inset: 12px;
		border-radius: 50%;
		background: var(--admin-surface);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--admin-font-display);
		font-size: 18px;
		font-weight: 800;
		color: var(--admin-text-primary);
	}
	.rpt-legend {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rpt-legend span {
		font-size: 11px;
		font-weight: 600;
		color: var(--admin-text-secondary);
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.rpt-legend i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}

	/* Horizontal Bars */
	.rpt-hbars {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rpt-hbar-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.rpt-hbar-name {
		font-size: 12px;
		font-weight: 600;
		color: var(--admin-text-primary);
		width: 90px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex-shrink: 0;
	}
	.rpt-hbar-track {
		flex: 1;
		height: 10px;
		background: var(--admin-bg);
		border-radius: 5px;
		overflow: hidden;
	}
	.rpt-hbar-fill {
		height: 100%;
		border-radius: 5px;
		background: linear-gradient(90deg, var(--admin-accent), var(--admin-purple));
		animation: hbarGrow 0.6s ease both;
		transform-origin: left;
	}
	@keyframes hbarGrow {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
	.rpt-hbar-count {
		font-size: 12px;
		font-weight: 800;
		color: var(--admin-text-primary);
		width: 28px;
		text-align: right;
	}
	.rpt-empty {
		font-size: 13px;
		color: var(--admin-text-tertiary);
		text-align: center;
		padding: 20px;
	}

	/* Export Grid */
	.rpt-export-grid {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rpt-export-card {
		display: flex;
		align-items: center;
		gap: 14px;
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
	.rpt-export-card:active {
		transform: scale(0.98);
		background: var(--admin-surface-hover);
	}
	.rpt-export-icon {
		width: 44px;
		height: 44px;
		border-radius: 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.rpt-export-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rpt-export-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--admin-text-primary);
	}
	.rpt-export-desc {
		font-size: 11px;
		color: var(--admin-text-secondary);
		font-weight: 500;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.rpt-row {
			grid-template-columns: 1fr;
		}
		.rpt-donut-wrap {
			flex-direction: column;
			align-items: flex-start;
		}
	}
	@media (min-width: 768px) {
		.rpt-kpi-grid {
			grid-template-columns: repeat(4, 1fr);
		}
		.rpt-export-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}
	}
</style>

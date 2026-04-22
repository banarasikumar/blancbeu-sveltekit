<script lang="ts">
	import { staffBookings } from '$lib/stores/staffData';
	import { updateBookingStatus } from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import BookingModal from '$lib/components/staff/BookingModal.svelte';
	import { onMount } from 'svelte';

	let viewMode = $state<'day' | 'week' | 'month'>('day');
	let selectedDate = $state(new Date());
	let isModalOpen = $state(false);
	let modalMode = $state('edit');
	let selectedBooking = $state<any>(null);
	let currentTime = $state(new Date());

	onMount(() => {
		const t = setInterval(() => { currentTime = new Date(); }, 60000);
		return () => clearInterval(t);
	});

	const fmt = (d: Date) => d.toISOString().split('T')[0];
	const isToday = (d: Date) => fmt(d) === fmt(new Date());

	function parseTime(t: string) {
		if (!t) return null;
		const isPM = /pm/i.test(t), isAM = /am/i.test(t);
		const [hStr, mStr] = t.replace(/\s*(am|pm)\s*/i,'').trim().split(':');
		let h = parseInt(hStr,10); const m = parseInt(mStr||'0',10);
		if (isNaN(h)) return null;
		if (isPM && h!==12) h+=12; if (isAM && h===12) h=0;
		return {h,m};
	}

	function fmt12(t: string) {
		const p = parseTime(t); if (!p) return t;
		return `${p.h%12||12}:${p.m.toString().padStart(2,'0')} ${p.h>=12?'PM':'AM'}`;
	}

	function fmtDur(mins: number) {
		if (mins>=60) { const h=Math.floor(mins/60),m=mins%60; return m>0?`${h}h ${m}m`:`${h}h`; }
		return `${mins}m`;
	}

	let dailyBookings = $derived(
		$staffBookings.filter(b => b.date && b.date === fmt(selectedDate))
			.sort((a,b) => (a.time||'').localeCompare(b.time||''))
	);

	const HOURS = Array.from({length:15},(_,i)=>i+8);
	const STATUS_COLOR: Record<string,string> = {
		pending: '#f59e0b', confirmed: '#6366f1', 'in-progress': '#8b5cf6', completed: '#10b981', cancelled: '#ef4444'
	};
	const STATUS_BG: Record<string,string> = {
		pending:'rgba(245,158,11,0.1)', confirmed:'rgba(99,102,241,0.1)', 'in-progress':'rgba(139,92,246,0.12)', completed:'rgba(16,185,129,0.1)', cancelled:'rgba(239,68,68,0.08)'
	};

	function getDayStats(d: Date) {
		const bks = $staffBookings.filter(b=>b.date===fmt(d));
		return {
			count: bks.length,
			pending: bks.filter(b=>b.status==='pending').length,
			completed: bks.filter(b=>b.status==='completed').length,
			inProgress: bks.some(b=>b.status==='in-progress'),
			revenue: bks.filter(b=>b.status==='completed').reduce((s,b)=>s+(b.totalAmount||b.price||0),0)
		};
	}

	function getWeek(d: Date) {
		const s = new Date(d); s.setDate(d.getDate()-d.getDay());
		return Array.from({length:7},(_,i)=>{ const x=new Date(s); x.setDate(s.getDate()+i); return x; });
	}

	function getMonthDays(d: Date) {
		const y=d.getFullYear(),mo=d.getMonth();
		const firstDay=new Date(y,mo,1).getDay(), days=new Date(y,mo+1,0).getDate();
		const arr: (Date|null)[] = Array(firstDay).fill(null);
		for(let i=1;i<=days;i++) arr.push(new Date(y,mo,i));
		return arr;
	}

	let weekDays = $derived(getWeek(selectedDate));
	let monthDays = $derived(getMonthDays(selectedDate));

	function navigate(dir: number) {
		const d = new Date(selectedDate);
		if (viewMode==='day') d.setDate(d.getDate()+dir);
		else if (viewMode==='week') d.setDate(d.getDate()+dir*7);
		else d.setMonth(d.getMonth()+dir);
		selectedDate = d;
	}

	function openBooking(b: any) { selectedBooking=b; modalMode='edit'; isModalOpen=true; }

	// Current time line position (8am-10pm = 840min range)
	let timeLinePos = $derived((() => {
		const h=currentTime.getHours(), m=currentTime.getMinutes();
		if (h<8||h>=22) return -1;
		return ((h-8)*60+m)/840*100;
	})());

	function slotBookings(hour: number) {
		return dailyBookings.filter(b => { const p=parseTime(b.time); return p&&p.h===hour; });
	}

	let todayStats = $derived(getDayStats(selectedDate));
	let isBackToToday = $derived(fmt(selectedDate)!==fmt(new Date()));
</script>

<div class="sched s-stagger">

	<!-- ── HEADER ── -->
	<header class="sched-header">
		<div class="header-top">
			<div class="view-pills">
				{#each (['day','week','month'] as const) as v}
					<button class="pill" class:active={viewMode===v} onclick={()=>viewMode=v}>
						{v.charAt(0).toUpperCase()+v.slice(1)}
					</button>
				{/each}
			</div>
			{#if isBackToToday}
				<button class="today-chip" onclick={()=>selectedDate=new Date()}>↩ Today</button>
			{/if}
		</div>

		<div class="date-bar">
			<button class="arrow-btn" onclick={()=>navigate(-1)}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<div class="date-center" role="button" tabindex="0" onclick={()=>selectedDate=new Date()} onkeydown={e=>e.key==='Enter'&&(selectedDate=new Date())}>
				{#if viewMode==='day'}
					<span class="date-big">{selectedDate.toLocaleDateString('en-US',{weekday:'long'})}</span>
					<span class="date-sm">{selectedDate.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
				{:else if viewMode==='week'}
					<span class="date-big">{weekDays[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {weekDays[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
				{:else}
					<span class="date-big">{selectedDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
				{/if}
			</div>
			<button class="arrow-btn" onclick={()=>navigate(1)}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
			</button>
		</div>

		{#if viewMode==='day'}
			<div class="day-chips">
				<div class="chip chip-blue">📅 {todayStats.count} total</div>
				{#if todayStats.pending>0}<div class="chip chip-amber">⏳ {todayStats.pending} pending</div>{/if}
				{#if todayStats.inProgress}<div class="chip chip-purple">🔴 In service</div>{/if}
				{#if todayStats.completed>0}<div class="chip chip-green">✓ {todayStats.completed} done · ₹{todayStats.revenue.toLocaleString()}</div>{/if}
			</div>
		{/if}
	</header>

	<!-- ── DAY VIEW ── -->
	{#if viewMode==='day'}
		<div class="day-view">
			{#if dailyBookings.length===0}
				<div class="empty-day">
					<div class="empty-icon">✨</div>
					<h3>Free Day</h3>
					<p>No appointments on {selectedDate.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
				</div>
			{:else}
				<div class="timeline">
					{#each HOURS as hour}
						{@const bks = slotBookings(hour)}
						<div class="tl-row" class:has-bookings={bks.length>0}>
							<div class="tl-hour">
								<span>{hour===12?'12 PM':hour>12?`${hour-12} PM`:`${hour} AM`}</span>
							</div>
							<div class="tl-track">
								<div class="tl-line"></div>
								<!-- Current time dot -->
								{#if isToday(selectedDate) && timeLinePos>=0}
									{@const dotPos = ((hour-8)*60)/840*100}
									{@const nextPos = ((hour-8+1)*60)/840*100}
									{#if timeLinePos>=dotPos && timeLinePos<nextPos}
										<div class="now-line" style="top:{((timeLinePos-dotPos)/(nextPos-dotPos))*100}%"></div>
									{/if}
								{/if}
								{#if bks.length>0}
									<div class="slot-cards">
										{#each bks as bk}
											{@const dur = bk.servicesList?.reduce((a:number,s:any)=>a+(s.duration||30),0)||30}
											<button
												class="appt-card"
												style="--ac:{STATUS_COLOR[bk.status]||'#6366f1'};--ab:{STATUS_BG[bk.status]||'rgba(99,102,241,0.1)'}"
												onclick={()=>openBooking(bk)}
											>
												<div class="ac-left">
													<div class="ac-dot"></div>
												</div>
												<div class="ac-body">
													<div class="ac-row1">
														<span class="ac-name">{bk.userName||'Guest'}</span>
														<span class="ac-time">{fmt12(bk.time)}</span>
													</div>
													<div class="ac-row2">
														<span class="ac-svc">{bk.servicesList?.map((s:any)=>s.name).join(', ')||bk.serviceName||'Service'}</span>
													</div>
													<div class="ac-row3">
														{#if bk.userPhone}<span class="ac-meta">📞 {bk.userPhone}</span>{/if}
														<span class="ac-meta">⏱ {fmtDur(dur)}</span>
														<span class="ac-meta ac-price">₹{bk.totalAmount||bk.price||'–'}</span>
													</div>
												</div>
												<div class="ac-status" style="background:var(--ac)">
													{bk.status==='in-progress'?'●':bk.status==='completed'?'✓':bk.status==='pending'?'!':bk.status==='cancelled'?'✕':''}
												</div>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	<!-- ── WEEK VIEW ── -->
	{:else if viewMode==='week'}
		<div class="week-view">
			{#each weekDays as day}
				{@const s=getDayStats(day)}
				{@const sel=selectedDate.toDateString()===day.toDateString()}
				<button
					class="wk-card"
					class:today={isToday(day)}
					class:selected={sel}
					class:busy={s.count>0}
					onclick={()=>{selectedDate=day;viewMode='day'}}
				>
					<div class="wk-top">
						<span class="wk-name">{day.toLocaleDateString('en-US',{weekday:'short'})}</span>
						<span class="wk-num" class:today-num={isToday(day)}>{day.getDate()}</span>
					</div>
					{#if s.count>0}
						<div class="wk-bar-wrap">
							<div class="wk-bar" style="height:{Math.min(100,s.count*20)}%;background:{s.pending>0?'#f59e0b':s.inProgress?'#8b5cf6':'#10b981'}"></div>
						</div>
						<div class="wk-info">
							<span class="wk-cnt">{s.count}</span>
							{#if s.pending>0}<span class="wk-badge">!</span>{/if}
						</div>
					{:else}
						<div class="wk-free">–</div>
					{/if}
				</button>
			{/each}
		</div>

	<!-- ── MONTH VIEW ── -->
	{:else}
		<div class="month-view">
			<div class="mo-header">
				{#each ['S','M','T','W','T','F','S'] as d}
					<span>{d}</span>
				{/each}
			</div>
			<div class="mo-grid">
				{#each monthDays as day}
					{#if day}
						{@const s=getDayStats(day)}
						{@const sel=selectedDate.toDateString()===day.toDateString()}
						<button
							class="mo-day"
							class:today={isToday(day)}
							class:selected={sel}
							class:has-bk={s.count>0}
							onclick={()=>{selectedDate=day;viewMode='day'}}
						>
							<span class="mo-num">{day.getDate()}</span>
							{#if s.count>0}
								<div class="mo-dots">
									{#each {length:Math.min(s.count,3)} as _}
										<div class="mo-dot" style="background:{s.pending>0?'#f59e0b':'#6366f1'}"></div>
									{/each}
								</div>
							{/if}
						</button>
					{:else}
						<div class="mo-day empty"></div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<BookingModal bind:isOpen={isModalOpen} mode={modalMode} existingBooking={selectedBooking} onClose={()=>isModalOpen=false} />

<style>
.sched { display:flex; flex-direction:column; gap:var(--s-space-lg); padding-bottom:var(--s-space-3xl); }

/* ── HEADER ── */
.sched-header {
	background: var(--s-surface);
	border: 1px solid var(--s-border);
	border-radius: var(--s-radius-xl);
	padding: 12px var(--s-space-md);
	display: flex; flex-direction: column; gap: 10px;
	box-shadow: none;
}
.header-top { display:flex; justify-content:space-between; align-items:center; }
.view-pills { display:flex; background:var(--s-bg-tertiary); padding:3px; border-radius:var(--s-radius-md); gap:2px; }
.pill {
	padding: 6px 16px; border:none; background:transparent;
	color:var(--s-text-secondary); font-weight:600; font-size:.82rem;
	border-radius:var(--s-radius-sm); cursor:pointer;
	transition: all .2s ease;
}
.pill.active { background:var(--s-surface); color:var(--s-accent); box-shadow:var(--s-shadow-sm); font-weight:700; }
.today-chip {
	padding: 6px 14px; border-radius:var(--s-radius-full);
	background:var(--s-accent-bg); color:var(--s-accent);
	border:1px solid var(--s-border-accent); font-size:.8rem; font-weight:700;
	cursor:pointer; transition:all .2s;
}
.today-chip:active { transform:scale(.96); }
.date-bar { display:flex; align-items:center; justify-content:space-between; }
.arrow-btn {
	width:40px;height:40px;border-radius:50%;border:1px solid var(--s-border);
	background:var(--s-bg-secondary); color:var(--s-text-secondary);
	display:flex;align-items:center;justify-content:center;cursor:pointer;
	transition:all .2s;
}
.arrow-btn:active { transform:scale(.9); background:var(--s-surface-active); }
.date-center { text-align:center; cursor:pointer; flex:1; }
.date-big { display:block;font-family:var(--s-font-display);font-size:1.15rem;font-weight:800;color:var(--s-text-primary); }
.date-sm { display:block;font-size:.78rem;color:var(--s-text-secondary);margin-top:2px; }
.day-chips { display:flex;flex-wrap:wrap;gap:6px; }
.chip {
	display:inline-flex;align-items:center;gap:5px;padding:5px 12px;
	border-radius:var(--s-radius-full);font-size:.75rem;font-weight:600;
}
.chip-blue { background:rgba(99,102,241,.1);color:#6366f1; }
.chip-amber { background:rgba(245,158,11,.1);color:#d97706; }
.chip-purple { background:rgba(139,92,246,.1);color:#8b5cf6; }
.chip-green { background:rgba(16,185,129,.1);color:#059669; }

/* ── EMPTY ── */
.empty-day { text-align:center;padding:60px 20px;animation:s-fadeIn .4s ease; }
.empty-icon { font-size:3.5rem;margin-bottom:16px; }
.empty-day h3 { font-family:var(--s-font-display);font-size:1.4rem;font-weight:800;color:var(--s-text-primary);margin:0 0 8px; }
.empty-day p { color:var(--s-text-secondary);font-size:.9rem; }

/* ── TIMELINE ── */
.timeline { display:flex;flex-direction:column; }
.tl-row {
	display:flex; min-height:56px;
	transition: background .15s;
}
.tl-row.has-bookings { min-height:auto; }
.tl-hour {
	width:56px;flex-shrink:0;padding-top:10px;
	text-align:right;padding-right:12px;
}
.tl-hour span {
	font-size:.7rem;font-weight:600;color:var(--s-text-tertiary);
	position:sticky;top:10px;
}
.tl-track {
	flex:1; position:relative;
	border-left:2px solid var(--s-border);
	padding-left:14px; padding-bottom:8px; padding-top:8px;
}
.tl-line {
	position:absolute;left:-1px;top:18px;
	width:8px;height:2px;background:var(--s-border);
}
.now-line {
	position:absolute;left:-7px;width:calc(100% + 7px);
	height:2px;background:#ef4444;z-index:5;
	pointer-events:none;
}
.now-line::before {
	content:'';position:absolute;left:-4px;top:50%;transform:translateY(-50%);
	width:10px;height:10px;border-radius:50%;background:#ef4444;
}
.slot-cards { display:flex;flex-direction:column;gap:8px;padding-top:4px; }

/* ── APPOINTMENT CARD ── */
.appt-card {
	display:flex;align-items:stretch;gap:0;
	background:var(--ab,rgba(99,102,241,.1));
	border:1px solid color-mix(in srgb, var(--ac,#6366f1) 30%, transparent);
	border-radius:14px;overflow:hidden;cursor:pointer;
	text-align:left;width:100%;
	transition:all .25s cubic-bezier(.4,0,.2,1);
	box-shadow:0 2px 8px rgba(0,0,0,.06);
}
.appt-card:hover { transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.1); }
.appt-card:active { transform:scale(.98); }
.ac-left {
	width:4px;flex-shrink:0;
	background:var(--ac,#6366f1);
}
.ac-dot { display:none; }
.ac-body { flex:1;padding:12px 12px 10px; }
.ac-row1 { display:flex;justify-content:space-between;align-items:center;margin-bottom:4px; }
.ac-name { font-weight:700;font-size:.95rem;color:var(--s-text-primary); }
.ac-time { font-size:.78rem;font-weight:700;color:var(--ac,#6366f1); }
.ac-row2 { margin-bottom:6px; }
.ac-svc { font-size:.82rem;color:var(--s-text-secondary); }
.ac-row3 { display:flex;flex-wrap:wrap;gap:8px; }
.ac-meta { font-size:.72rem;color:var(--s-text-tertiary);font-weight:600; }
.ac-price { color:var(--s-text-primary) !important;font-weight:700 !important; }
.ac-status {
	width:32px;flex-shrink:0;display:flex;
	align-items:center;justify-content:center;
	font-size:.8rem;font-weight:800;color:white;
}

/* ── WEEK VIEW ── */
.week-view { display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s-space-sm); }
@media(min-width:400px) { .week-view { grid-template-columns:repeat(7,1fr); } }
.wk-card {
	background:var(--s-surface);border:1px solid var(--s-border);
	border-radius:var(--s-radius-xl);padding:10px 6px;
	cursor:pointer;transition:all .2s;text-align:center;
	display:flex;flex-direction:column;align-items:center;gap:6px;
	position:relative;overflow:hidden;
}
.wk-card:active { transform:scale(.95); }
.wk-card.today { border-color:var(--s-accent);border-width:2px; }
.wk-card.selected { background:var(--s-accent);border-color:var(--s-accent); }
.wk-card.selected .wk-name,.wk-card.selected .wk-num,.wk-card.selected .wk-cnt { color:white; }
.wk-top { display:flex;flex-direction:column;align-items:center;gap:2px; }
.wk-name { font-size:.65rem;font-weight:600;color:var(--s-text-secondary);text-transform:uppercase; }
.wk-num { font-size:1.1rem;font-weight:800;color:var(--s-text-primary); }
.wk-num.today-num { color:var(--s-accent); }
.wk-bar-wrap { width:100%;height:28px;background:var(--s-bg-tertiary);border-radius:6px;overflow:hidden;display:flex;align-items:flex-end; }
.wk-bar { width:100%;border-radius:6px;min-height:4px;transition:height .4s var(--s-ease-spring); }
.wk-info { display:flex;align-items:center;gap:4px; }
.wk-cnt { font-size:.75rem;font-weight:700;color:var(--s-text-primary); }
.wk-badge { width:14px;height:14px;border-radius:50%;background:#f59e0b;color:white;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center; }
.wk-free { font-size:1rem;color:var(--s-text-tertiary); }

/* ── MONTH VIEW ── */
.mo-header { display:grid;grid-template-columns:repeat(7,1fr);text-align:center;margin-bottom:6px; }
.mo-header span { font-size:.7rem;font-weight:600;color:var(--s-text-tertiary);padding:6px 0; }
.mo-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:3px; }
.mo-day {
	aspect-ratio:1;display:flex;flex-direction:column;align-items:center;
	justify-content:center;gap:3px;border-radius:12px;
	cursor:pointer;border:1px solid transparent;
	background:var(--s-surface);transition:all .15s;padding:4px;
}
.mo-day.empty { background:transparent;cursor:default; }
.mo-day:not(.empty):active { transform:scale(.88); }
.mo-day.today { border-color:var(--s-accent);background:var(--s-accent-bg); }
.mo-day.selected { background:var(--s-accent);border-color:var(--s-accent); }
.mo-day.selected .mo-num { color:white; }
.mo-num { font-size:.82rem;font-weight:600;color:var(--s-text-primary); }
.mo-day.has-bk .mo-num { font-weight:800; }
.mo-dots { display:flex;gap:2px; }
.mo-dot { width:5px;height:5px;border-radius:50%; }
</style>

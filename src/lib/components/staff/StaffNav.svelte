<script lang="ts">
	import { page } from '$app/state';
	import { upcomingBookings } from '$lib/stores/staffData';

	let activeRoute = $derived(page.url.pathname);
	let pendingCount = $derived($upcomingBookings.filter((b) => b.status === 'pending').length);

	const routes = [
		{ path: '/staff/dashboard', label: 'Home', icon: 'home' },
		{ path: '/staff/schedule', label: 'Schedule', icon: 'calendar' },
		{ path: '/staff/bookings', label: 'Bookings', icon: 'list', showBadge: true },
		{ path: '/staff/profile', label: 'Profile', icon: 'user' }
	];

	function haptic(intensity: 'light' | 'medium' = 'light') {
		if ('vibrate' in navigator) {
			navigator.vibrate(intensity === 'light' ? 10 : 25);
		}
	}

	function getActiveIndex() {
		const idx = routes.findIndex((r) => activeRoute.startsWith(r.path));
		return idx >= 0 ? idx : 0;
	}

	let activeIndex = $derived(getActiveIndex());
</script>

<nav class="staff-nav s-glass-strong">
	<div class="nav-content">
		<!-- Active indicator pill -->
		<div
			class="active-pill"
			style="transform: translateX({activeIndex * 100}%); width: {100 / routes.length}%"
		></div>

		{#each routes as route, i}
			<a
				href={route.path}
				class="nav-item"
				class:active={activeRoute.startsWith(route.path)}
				onclick={() => haptic('light')}
			>
				<div class="icon-wrap">
					{#if route.icon === 'home'}
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
							<polyline points="9 22 9 12 15 12 15 22"></polyline>
						</svg>
					{:else if route.icon === 'calendar'}
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
							<line x1="16" y1="2" x2="16" y2="6"></line>
							<line x1="8" y1="2" x2="8" y2="6"></line>
							<line x1="3" y1="10" x2="21" y2="10"></line>
						</svg>
					{:else if route.icon === 'list'}
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
							<polyline points="14 2 14 8 20 8"></polyline>
							<line x1="16" y1="13" x2="8" y2="13"></line>
							<line x1="16" y1="17" x2="8" y2="17"></line>
							<polyline points="10 9 9 9 8 9"></polyline>
						</svg>
					{:else if route.icon === 'user'}
						<svg
							viewBox="0 0 24 24"
							width="22"
							height="22"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
							<circle cx="12" cy="7" r="4"></circle>
						</svg>
					{/if}

					{#if route.showBadge && pendingCount > 0}
						<span class="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
					{/if}
				</div>
				<span class="nav-label">{route.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.staff-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		border-top: 1px solid var(--s-border);
		padding-bottom: env(safe-area-inset-bottom, 0px);
		z-index: var(--s-z-sticky, 200);
		transition: background var(--s-duration-normal, 250ms) var(--s-ease);
	}

	.nav-content {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: var(--s-nav-height, 68px);
		max-width: 600px;
		margin: 0 auto;
		position: relative;
	}

	/* Active Indicator Pill */
	.active-pill {
		position: absolute;
		top: 4px;
		left: 0;
		height: 3px;
		background: var(--s-accent);
		border-radius: 0 0 var(--s-radius-full, 9999px) var(--s-radius-full, 9999px);
		transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
		pointer-events: none;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--s-text-tertiary);
		font-size: 0.65rem;
		font-weight: 500;
		gap: 3px;
		width: 64px;
		padding: 6px 0;
		border-radius: var(--s-radius-md, 12px);
		transition: color var(--s-duration-fast, 150ms) var(--s-ease);
		-webkit-tap-highlight-color: transparent;
		position: relative;
	}

	.nav-item.active {
		color: var(--s-text-primary);
	}

	.nav-item:active {
		transform: scale(0.92);
	}

	.icon-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.25s var(--s-ease-spring, cubic-bezier(0.16, 1, 0.3, 1));
	}

	.nav-item.active .icon-wrap {
		transform: translateY(-2px);
	}

	.nav-item svg {
		width: 22px;
		height: 22px;
		transition: stroke-width var(--s-duration-fast, 150ms) var(--s-ease);
	}

	.nav-item.active svg {
		stroke-width: 2.5;
	}

	.nav-label {
		letter-spacing: 0.01em;
	}

	.nav-item.active .nav-label {
		font-weight: 700;
	}

	/* Badge */
	.nav-badge {
		position: absolute;
		top: -6px;
		right: -10px;
		min-width: 16px;
		height: 16px;
		background: var(--s-error, #ef4444);
		color: white;
		font-size: 0.55rem;
		font-weight: 800;
		border-radius: var(--s-radius-full, 9999px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
		border: 2px solid var(--s-bg-glass-strong, white);
		animation: s-scaleIn 0.3s var(--s-ease-bounce, ease);
	}
</style>

<script lang="ts">
	import { staffUser } from '$lib/stores/staffAuth';
	import { isOnline } from '$lib/stores/networkStatus';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { unreadCount } from '$lib/stores/staffNotificationsList';

	let {
		title = 'Blancbeu Stylist',
		showNotifications = true,
		notificationCount = 0
	}: {
		title?: string;
		showNotifications?: boolean;
		notificationCount?: number;
	} = $props();

	let isOnlineVal = $derived($isOnline);

	// Live clock
	let clockTime = $state('');
	let clockPeriod = $state('');
	let clockInterval: ReturnType<typeof setInterval> | null = null;

	function updateClock() {
		const now = new Date();
		let h = now.getHours();
		const m = now.getMinutes();
		clockPeriod = h >= 12 ? 'PM' : 'AM';
		h = h % 12 || 12;
		clockTime = `${h}:${m.toString().padStart(2, '0')}`;
	}

	onMount(() => {
		updateClock();
		clockInterval = setInterval(updateClock, 1000);
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
	});
</script>

<header class="staff-header s-glass-strong">
	<div class="header-content">
		<div class="header-left">
			<h1 class="page-title">{title}</h1>
			{#if !isOnlineVal}
				<span class="offline-badge">Offline</span>
			{/if}
		</div>

		{#if clockTime}
			<div class="live-clock">
				<span class="clock-time">{clockTime}</span>
				<span class="clock-period">{clockPeriod}</span>
			</div>
		{/if}

		<div class="header-right">
			{#if showNotifications}
				<button
					class="header-icon-btn s-touch-target"
					onclick={() => goto('/staff/notifications')}
					aria-label="Notifications"
				>
					<svg
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
					</svg>
					{#if $unreadCount > 0}
						<span class="notification-badge">{$unreadCount > 9 ? '9+' : $unreadCount}</span>
					{/if}
				</button>
			{/if}

			<button
				class="profile-avatar-btn"
				onclick={() => goto('/staff/profile')}
				aria-label="Profile"
			>
				{#if $staffUser?.photoURL}
					<img src={$staffUser.photoURL} alt="Profile" class="avatar-img" />
				{:else}
					<div class="avatar-fallback">
						{$staffUser?.displayName?.[0]?.toUpperCase() ||
							$staffUser?.email?.[0]?.toUpperCase() ||
							'S'}
					</div>
				{/if}
				<span class="online-dot" class:offline={!isOnlineVal}></span>
			</button>
		</div>
	</div>
</header>

<style>
	.staff-header {
		position: sticky;
		top: 0;
		z-index: var(--s-z-sticky, 200);
		border-bottom: 1px solid var(--s-border);
		padding: 10px 16px;
		background: var(--s-bg-glass-strong);
		backdrop-filter: var(--s-blur-strong);
		-webkit-backdrop-filter: var(--s-blur-strong);
		box-shadow: 0 1px 16px rgba(100, 60, 200, 0.07);
		transition: background var(--s-duration-normal, 250ms) var(--s-ease);
	}

	:global(.staff-app.dark) .staff-header {
		box-shadow: 0 1px 24px rgba(0, 0, 0, 0.4);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 600px;
		margin: 0 auto;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.page-title {
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.2rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.03em;
		background: var(--s-grad-hero);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	:global(.staff-app.dark) .page-title {
		background: var(--s-grad-aurora);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.offline-badge {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 8px;
		border-radius: var(--s-radius-full, 9999px);
		background: var(--s-warning-bg);
		color: var(--s-warning);
		letter-spacing: 0.05em;
		border: 1px solid rgba(245, 158, 11, 0.25);
		animation: s-pulse 2s ease-in-out infinite;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	/* Notification Button */
	.header-icon-btn {
		position: relative;
		background: var(--s-accent-2-bg);
		border: 1px solid var(--s-accent-2-bg);
		color: var(--s-accent-2);
		padding: 0;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 2px 10px rgba(124, 58, 237, 0.15);
		transition: all var(--s-duration-fast, 150ms) var(--s-ease);
	}

	:global(.staff-app.dark) .header-icon-btn {
		background: var(--s-accent-2-bg);
		border-color: rgba(167, 139, 250, 0.2);
		color: var(--s-accent-2-light);
		box-shadow: 0 2px 12px rgba(167, 139, 250, 0.2);
	}

	.header-icon-btn:hover {
		background: rgba(124, 58, 237, 0.14);
		box-shadow: 0 4px 16px rgba(124, 58, 237, 0.25);
		transform: translateY(-1px);
	}

	.header-icon-btn:active {
		transform: scale(0.94);
	}

	.notification-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 20px;
		height: 20px;
		background: var(--s-grad-rose);
		color: white;
		font-size: 0.65rem;
		font-weight: 800;
		border-radius: var(--s-radius-full, 9999px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 5px;
		border: 2px solid var(--s-bg-glass-strong);
		box-shadow: 0 2px 8px rgba(244, 63, 94, 0.45);
		animation: s-scaleIn 0.3s var(--s-ease-bounce);
	}

	/* Profile Avatar */
	.profile-avatar-btn {
		position: relative;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform var(--s-duration-fast, 150ms) var(--s-ease);
	}

	/* Gradient ring around avatar */
	.profile-avatar-btn::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: 50%;
		background: var(--s-grad-aurora);
		z-index: 0;
		opacity: 0.5;
		transition: opacity 0.2s var(--s-ease);
	}

	.profile-avatar-btn:hover::before {
		opacity: 1;
	}

	.profile-avatar-btn:active {
		transform: scale(0.92);
	}

	.avatar-img {
		position: relative;
		z-index: 1;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--s-bg-glass-strong);
		box-shadow: var(--s-shadow-sm);
	}

	.avatar-fallback {
		position: relative;
		z-index: 1;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--s-grad-violet);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 1rem;
		border: 2px solid var(--s-bg-glass-strong);
		box-shadow: 0 2px 12px rgba(124, 58, 237, 0.35);
	}

	.online-dot {
		position: absolute;
		bottom: 1px;
		right: 1px;
		width: 11px;
		height: 11px;
		background: var(--s-success);
		border: 2px solid var(--s-bg-glass-strong);
		border-radius: 50%;
		z-index: 2;
		box-shadow: 0 0 6px rgba(16, 185, 129, 0.5);
		transition: background var(--s-duration-fast, 150ms) var(--s-ease);
	}

	.online-dot.offline {
		background: var(--s-text-tertiary);
		box-shadow: none;
	}

	/* Live Clock — colorful pill */
	.live-clock {
		display: flex;
		align-items: baseline;
		gap: 3px;
		padding: 5px 12px;
		background: var(--s-accent-bg);
		border: 1px solid var(--s-border-accent);
		border-radius: var(--s-radius-full, 9999px);
		box-shadow: 0 2px 10px rgba(232, 167, 48, 0.15);
	}

	:global(.staff-app.dark) .live-clock {
		background: var(--s-accent-bg);
		box-shadow: 0 2px 12px rgba(245, 192, 64, 0.15);
	}

	.clock-time {
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 1.1rem;
		font-weight: 800;
		color: var(--s-text-accent);
		letter-spacing: 0.03em;
		line-height: 1;
	}

	.clock-period {
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: 0.6rem;
		font-weight: 700;
		color: var(--s-accent-3);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		line-height: 1;
	}

	:global(.staff-app.dark) .clock-period {
		color: var(--s-accent-3-light);
	}
</style>

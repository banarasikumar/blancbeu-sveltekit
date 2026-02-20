<script lang="ts">
	import { staffUser } from '$lib/stores/staffAuth';
	import { goto } from '$app/navigation';

	let {
		title = 'Blancbeu Stylist',
		showNotifications = true,
		notificationCount = 0
	}: {
		title?: string;
		showNotifications?: boolean;
		notificationCount?: number;
	} = $props();

	let isOnline = $state(true);

	// Check online status
	if (typeof window !== 'undefined') {
		isOnline = navigator.onLine;
		window.addEventListener('online', () => (isOnline = true));
		window.addEventListener('offline', () => (isOnline = false));
	}
</script>

<header class="staff-header s-glass-strong">
	<div class="header-content">
		<div class="header-left">
			<h1 class="page-title">{title}</h1>
			{#if !isOnline}
				<span class="offline-badge">Offline</span>
			{/if}
		</div>

		<div class="header-right">
			{#if showNotifications}
				<button
					class="header-icon-btn s-touch-target"
					onclick={() => goto('/staff/bookings?filter=pending')}
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
					{#if notificationCount > 0}
						<span class="notification-badge"
							>{notificationCount > 9 ? '9+' : notificationCount}</span
						>
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
				<span class="online-dot" class:offline={!isOnline}></span>
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
		transition: background var(--s-duration-normal, 250ms) var(--s-ease);
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
		font-weight: 700;
		color: var(--s-text-primary);
		margin: 0;
		letter-spacing: -0.02em;
	}

	.offline-badge {
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: var(--s-radius-full, 9999px);
		background: var(--s-warning-bg);
		color: var(--s-warning);
		letter-spacing: 0.05em;
		animation: s-pulse 2s ease-in-out infinite;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	/* Notification Button */
	.header-icon-btn {
		position: relative;
		background: none;
		border: none;
		color: var(--s-text-primary);
		padding: 8px;
		border-radius: var(--s-radius-md, 12px);
		transition: background var(--s-duration-fast, 150ms) var(--s-ease);
	}

	.header-icon-btn:active {
		background: var(--s-surface-active);
		transform: scale(0.95);
	}

	.notification-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		min-width: 18px;
		height: 18px;
		background: var(--s-error);
		color: white;
		font-size: 0.6rem;
		font-weight: 800;
		border-radius: var(--s-radius-full, 9999px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
		border: 2px solid var(--s-bg-glass-strong, white);
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
		transition: transform var(--s-duration-fast, 150ms) var(--s-ease);
	}

	.profile-avatar-btn:active {
		transform: scale(0.92);
	}

	.avatar-img {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--s-border-accent);
		box-shadow: var(--s-shadow-sm);
	}

	.avatar-fallback {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--s-accent), var(--s-accent-dark, #b08d4f));
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
		border: 2px solid var(--s-border-accent);
		box-shadow: var(--s-shadow-sm);
	}

	.online-dot {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 10px;
		height: 10px;
		background: var(--s-success);
		border: 2px solid var(--s-bg-glass-strong, white);
		border-radius: 50%;
		transition: background var(--s-duration-fast, 150ms) var(--s-ease);
	}

	.online-dot.offline {
		background: var(--s-text-tertiary);
	}
</style>

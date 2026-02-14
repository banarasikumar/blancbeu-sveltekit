<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { notifications, unreadCount } from '$lib/stores/notifications';

	let activeFilter = $state('all');

	// Computed values
	let filteredNotifications = $derived(
		activeFilter === 'all' ? $notifications : $notifications.filter((n) => n.type === activeFilter)
	);

	let groupedNotifications = $derived({
		Today: filteredNotifications.filter((n) => n.dateCategory === 'Today'),
		Yesterday: filteredNotifications.filter((n) => n.dateCategory === 'Yesterday'),
		Earlier: filteredNotifications.filter((n) => n.dateCategory === 'Earlier')
	});

	let counts = $derived({
		all: $notifications.length,
		appointments: $notifications.filter((n) => n.type === 'appointments').length,
		offers: $notifications.filter((n) => n.type === 'offers').length,
		reviews: $notifications.filter((n) => n.type === 'reviews').length
	});

	function setFilter(filter: string) {
		activeFilter = filter;
	}

	function markAllRead() {
		notifications.markAllRead();
	}

	function clearAll() {
		// In a real app, this would delete from backend
		if (confirm('Are you sure you want to clear all notifications?')) {
			notifications.clearAll();
		}
	}

	function dismissNotification(id: number) {
		notifications.dismiss(id);
	}

	onMount(() => {
		// Request permission if not granted, purely for browser API consistency with legacy
		if ('Notification' in window && Notification.permission !== 'granted') {
			Notification.requestPermission();
		}
	});
</script>

<div class="page-container">
	<!-- Fixed Header Background -->
	<div class="header-bg"></div>

	<div class="content-wrapper">
		<!-- Header -->
		<header class="page-header" in:fly={{ y: -20, duration: 800, delay: 200 }}>
			<div class="header-content">
				<h1 class="page-title">Notifications</h1>
				{#if $unreadCount > 0}
					<span class="unread-badge" transition:fade>{$unreadCount}</span>
				{/if}
			</div>
			<button class="icon-btn settings-btn" aria-label="Settings">
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					stroke="currentColor"
					stroke-width="2"
					fill="none"
				>
					<circle cx="12" cy="12" r="3"></circle>
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
					></path>
				</svg>
			</button>
		</header>

		<!-- Sticky Controls -->
		<div class="sticky-controls" in:fly={{ y: 20, duration: 800, delay: 300 }}>
			<div class="filter-tabs-wrapper">
				<div class="filter-tabs">
					<button
						class="filter-tab"
						class:active={activeFilter === 'all'}
						onclick={() => setFilter('all')}
					>
						All <span class="tab-count">{counts.all}</span>
					</button>
					<button
						class="filter-tab"
						class:active={activeFilter === 'appointments'}
						onclick={() => setFilter('appointments')}
					>
						Appointments <span class="tab-count">{counts.appointments}</span>
					</button>
					<button
						class="filter-tab"
						class:active={activeFilter === 'offers'}
						onclick={() => setFilter('offers')}
					>
						Offers <span class="tab-count">{counts.offers}</span>
					</button>
					<button
						class="filter-tab"
						class:active={activeFilter === 'reviews'}
						onclick={() => setFilter('reviews')}
					>
						Reviews <span class="tab-count">{counts.reviews}</span>
					</button>
				</div>
			</div>

			<div class="quick-actions">
				<button class="action-chip" onclick={markAllRead}>Mark all as read</button>
				<button class="action-chip" onclick={clearAll}>Clear all</button>
			</div>
		</div>

		<!-- Notifications List -->
		<div class="notifications-list">
			{#if filteredNotifications.length === 0}
				<div class="empty-state" in:fade>
					<div class="empty-icon">
						<svg
							viewBox="0 0 24 24"
							width="48"
							height="48"
							stroke="currentColor"
							stroke-width="1"
							fill="none"
						>
							<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
							<path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
							<path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
							<path d="M18 8a6 6 0 0 0-9.33-5"></path>
							<line x1="1" y1="1" x2="23" y2="23"></line>
						</svg>
					</div>
					<h2>All Caught Up!</h2>
					<p>You have no new notifications.</p>
				</div>
			{:else}
				{#each Object.entries(groupedNotifications) as [category, items] (category)}
					{#if items.length > 0}
						<div class="notification-section" in:slide|local>
							<div class="section-header">
								<span class="section-label">{category}</span>
							</div>

							<div class="cards-stack">
								{#each items as item (item.id)}
									<div
										class="notification-card {item.type}"
										class:unread={item.unread}
										class:high-priority={item.priority === 'high'}
										animate:fly={{ y: 20, duration: 400 }}
									>
										{#if item.unread}
											<div class="unread-dot"></div>
										{/if}

										<div class="card-icon-wrapper">
											{#if item.icon === 'calendar'}
												<svg
													class="card-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
													<line x1="16" y1="2" x2="16" y2="6"></line>
													<line x1="8" y1="2" x2="8" y2="6"></line>
													<line x1="3" y1="10" x2="21" y2="10"></line>
												</svg>
											{:else if item.icon === 'offer'}
												<svg
													class="card-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<path
														d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
													></path>
													<line x1="7" y1="7" x2="7.01" y2="7"></line>
												</svg>
											{:else if item.icon === 'star' || item.icon === 'quote'}
												<svg
													class="card-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<path
														d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
													></path>
												</svg>
											{:else}
												<!-- Default/Trophy/Clock/Sparkles -->
												<svg
													class="card-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
												>
													<circle cx="12" cy="12" r="10"></circle>
													<path d="M12 6v6l4 2"></path>
												</svg>
											{/if}
										</div>

										<div class="card-content">
											<div class="card-header">
												<h3>{item.title}</h3>
												{#if item.priority === 'high'}
													<span class="priority-badge">Urgent</span>
												{/if}
											</div>
											<p class="card-message">{item.message}</p>

											{#if item.offerAmount}
												<div class="offer-details">
													<span class="offer-amount">{item.offerAmount}</span>
													<span class="offer-expiry">{item.expiry}</span>
												</div>
											{/if}

											{#if item.points}
												<div class="points-badge">{item.points}</div>
											{/if}

											<div class="card-meta">
												<span class="card-time">{item.time}</span>
												{#if item.badge && !item.offerAmount}
													<span class="meta-tag">{item.badge}</span>
												{/if}
											</div>
										</div>

										<button
											class="dismiss-btn"
											onclick={() => dismissNotification(item.id)}
											aria-label="Dismiss"
										>
											<svg
												viewBox="0 0 24 24"
												width="16"
												height="16"
												stroke="currentColor"
												stroke-width="2"
												fill="none"
											>
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
										</button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	/* -- Premium Glassmorphic Styles -- */

	.page-container {
		min-height: 100vh;
		padding-top: 10px;
		position: relative;
		overflow-x: hidden;
		background-color: var(--color-bg-primary); /* Ensure explicit background */
		transition: background-color 0.3s ease;
	}

	.content-wrapper {
		position: relative;
		z-index: 2;
		max-width: 600px;
		margin: 0 auto;
		padding-bottom: 80px; /* More space for bottom nav */
	}

	/* Header */
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 20px;
		margin-bottom: 10px;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.page-title {
		font-family: 'Cinzel', serif;
		font-size: 28px;
		font-weight: 700;
		/* Use text-primary for better visibility across themes, gold for accent/brand */
		color: var(--color-text-primary);
		letter-spacing: 1px;
		margin: 0;
	}

	.unread-badge {
		background: var(--color-accent-gold);
		color: black;
		font-size: 11px;
		font-weight: 800;
		padding: 2px 8px;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.icon-btn {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-primary);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.icon-btn:hover {
		background: var(--color-surface-hover);
		transform: scale(1.05);
	}

	/* Sticky Controls */
	.sticky-controls {
		position: sticky;
		top: 56px; /* Header height offset */
		z-index: 10;
		background: rgba(var(--color-bg-primary-rgb), 0.95);
		backdrop-filter: blur(15px);
		-webkit-backdrop-filter: blur(15px);
		padding: 10px 0 15px;
		border-bottom: 1px solid var(--color-border);
		transition: background-color 0.3s ease;
	}

	.filter-tabs-wrapper {
		overflow-x: auto;
		padding: 5px 20px;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.filter-tabs-wrapper::-webkit-scrollbar {
		display: none;
	}

	.filter-tabs {
		display: flex;
		gap: 12px;
		min-width: max-content;
	}

	.filter-tab {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.3s ease;
	}

	.filter-tab:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.filter-tab.active {
		background: var(--color-accent-gold);
		color: black; /* Gold bg needs dark text */
		border-color: var(--color-accent-gold);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transform: translateY(-1px);
	}

	.filter-tab.active .tab-count {
		background: rgba(0, 0, 0, 0.2);
		color: black;
	}

	.tab-count {
		background: var(--color-surface-active); /* Slightly darker/lighter depending on theme */
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 10px;
		opacity: 0.8;
	}

	.quick-actions {
		display: flex;
		justify-content: flex-end;
		gap: 15px;
		padding: 0 20px;
		margin-top: 10px;
	}

	.action-chip {
		background: none;
		border: none;
		color: var(--color-accent-gold);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		opacity: 0.9;
		transition: opacity 0.2s;
	}

	.action-chip:hover {
		opacity: 1;
		text-decoration: underline;
	}

	/* Notifications List */
	.notifications-list {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 30px;
	}

	.section-header {
		margin-bottom: 15px;
		display: flex;
		align-items: center;
	}

	.section-label {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: var(--color-text-muted);
		font-weight: 600;
		padding-left: 10px;
		border-left: 2px solid var(--color-border-strong);
	}

	.cards-stack {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	/* Card Styles */
	.notification-card {
		background: var(--color-surface); /* Use theme surface */
		border: 1px solid var(--color-border);
		border-radius: 16px;
		padding: 16px;
		display: flex;
		gap: 15px;
		position: relative;
		transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
		backdrop-filter: blur(10px);
		box-shadow: var(--color-card-shadow);
	}

	.notification-card:hover {
		transform: translateY(-2px);
		background: var(--color-surface-hover);
		border-color: var(--color-border-hover);
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
	}

	/* Unread State - Theme Aware */
	.notification-card.unread {
		/* Add a subtle highlight dependent on theme */
		background: linear-gradient(
			90deg,
			rgba(var(--color-accent-gold-rgb), 0.05) 0%,
			var(--color-surface) 100%
		);
		border-left: 3px solid var(--color-accent-gold);
	}

	.notification-card.high-priority {
		border-color: rgba(255, 82, 82, 0.4);
		box-shadow: 0 0 15px rgba(255, 82, 82, 0.05);
	}

	.unread-dot {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 8px;
		height: 8px;
		background: var(--color-accent-gold);
		border-radius: 50%;
		box-shadow: 0 0 5px var(--color-accent-gold);
	}

	.card-icon-wrapper {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		/* Use surface-hover for slight contrast against card bg */
		background: var(--color-surface-hover);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}

	.appointments .card-icon-wrapper {
		color: #4fc3f7;
		background: rgba(79, 195, 247, 0.08);
	}
	.offers .card-icon-wrapper {
		color: #ffd700;
		background: rgba(255, 215, 0, 0.08);
	}
	.reviews .card-icon-wrapper {
		color: #ff8a80;
		background: rgba(255, 138, 128, 0.08);
	}

	.card-content {
		flex: 1;
		min-width: 0; /* Text truncation fix */
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 6px;
	}

	.card-header h3 {
		font-size: 15px;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
		line-height: 1.3;
	}

	.priority-badge {
		background: rgba(255, 82, 82, 0.1);
		color: #ff5252;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 4px;
		margin-left: 8px;
		flex-shrink: 0;
		border: 1px solid rgba(255, 82, 82, 0.2);
	}

	.card-message {
		font-size: 13px;
		color: var(--color-text-secondary);
		margin: 0 0 10px 0;
		line-height: 1.5;
	}

	.offer-details {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}

	.offer-amount {
		color: var(--color-accent-gold);
		font-weight: 700;
		font-size: 16px;
	}

	.offer-expiry {
		font-size: 11px;
		color: var(--color-text-muted);
		background: var(--color-surface-active);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.points-badge {
		display: inline-block;
		background: linear-gradient(45deg, var(--color-accent-gold), #f7e7ce);
		color: black;
		font-weight: 700;
		font-size: 12px;
		padding: 4px 10px;
		border-radius: 20px;
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.card-time {
		font-size: 11px;
		color: var(--color-text-muted);
	}

	.meta-tag {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text-primary);
		background: var(--color-surface-active);
		padding: 2px 8px;
		border-radius: 4px;
	}

	.dismiss-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		color: var(--color-text-muted);
		padding: 4px;
		cursor: pointer;
		opacity: 0;
		transition: all 0.2s;
	}

	/* Show dismiss on touch devices roughly or just always on desktop hover. 
	   For mobile UX, maybe better to always show or show on swipe, but for now hover/focus */
	.notification-card:hover .dismiss-btn {
		opacity: 1;
	}
	.dismiss-btn:focus {
		opacity: 1;
	}

	.dismiss-btn:hover {
		color: var(--color-text-primary);
		background: var(--color-surface-active);
		border-radius: 50%;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--color-text-muted);
	}

	.empty-icon {
		color: var(--color-border-strong);
		opacity: 0.5;
		margin-bottom: 20px;
	}

	.empty-state h2 {
		color: var(--color-text-primary);
		font-family: 'Cinzel', serif;
		margin-bottom: 8px;
	}

	/* Responsive */
	@media (min-width: 768px) {
		.page-header {
			padding: 20px 0;
		}

		.sticky-controls {
			top: 80px;
		}
	}
</style>

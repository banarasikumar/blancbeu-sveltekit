<script lang="ts">
	import { notifications, unreadCount, type Notification, type NotificationType } from '$lib/stores/staffNotificationsList';
	import { staffBookings } from '$lib/stores/staffData';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import { page } from '$app/state';

	// Filter state
	let activeFilter = $state<'all' | NotificationType>('all');

	const filters = [
		{ key: 'all', label: 'All', icon: '🔔' },
		{ key: 'booking', label: 'Bookings', icon: '📅' },
		{ key: 'completed', label: 'Completed', icon: '✅' },
		{ key: 'cancelled', label: 'Cancelled', icon: '❌' },
		{ key: 'payment', label: 'Payments', icon: '💰' }
	];

	let filteredNotifications = $derived(() => {
		let list = $notifications;
		if (activeFilter !== 'all') {
			list = list.filter(n => n.type === activeFilter);
		}
		return list;
	});

	function formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getNotificationIcon(type: NotificationType): string {
		switch (type) {
			case 'booking': return '📅';
			case 'completed': return '✅';
			case 'cancelled': return '❌';
			case 'payment': return '💰';
			case 'system': return '🔔';
			default: return '🔔';
		}
	}

	function getNotificationColor(type: NotificationType): string {
		switch (type) {
			case 'booking': return 'var(--s-accent)';
			case 'completed': return 'var(--s-success)';
			case 'cancelled': return 'var(--s-error)';
			case 'payment': return 'var(--s-warning)';
			case 'system': return 'var(--s-text-secondary)';
			default: return 'var(--s-accent)';
		}
	}

	function handleNotificationClick(notification: Notification) {
		// Mark as read
		notifications.markAsRead(notification.id);

		// Navigate to bookings page with booking ID to open modal
		if (notification.bookingId) {
			goto(`/staff/bookings?bookingId=${notification.bookingId}`);
		} else {
			showToast('No related booking found', 'error');
		}
	}

	function markAllRead() {
		notifications.markAllAsRead();
		showToast('All notifications marked as read', 'success');
	}

	function clearAll() {
		if (confirm('Clear all notifications?')) {
			notifications.clear();
			showToast('All notifications cleared', 'success');
		}
	}

	function deleteNotification(id: string, e: Event) {
		e.stopPropagation();
		notifications.delete(id);
	}
</script>

<div class="notifications-page">
	<!-- Filter & Actions Bar -->
	<div class="notifications-header">
		<div class="filter-action-row">
			<div class="filter-pills s-scrollbar-hide">
				{#each filters as filter}
					<button
						class="filter-pill"
						class:active={activeFilter === filter.key}
						onclick={() => activeFilter = filter.key as any}
					>
						<span class="filter-icon">{filter.icon}</span>
						{filter.label}
						{#if filter.key !== 'all' && $notifications.filter(n => n.type === filter.key && !n.read).length > 0}
							<span class="filter-badge">
								{$notifications.filter(n => n.type === filter.key && !n.read).length}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="header-actions">
				{#if $unreadCount > 0}
					<button class="action-btn" onclick={markAllRead} title="Mark all as read">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
					</button>
				{/if}
				{#if $notifications.length > 0}
					<button class="action-btn delete" onclick={clearAll} title="Clear all">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Notifications List -->
	<div class="notifications-list">
		{#if filteredNotifications().length === 0}
			<div class="empty-state">
				<div class="empty-icon">🔔</div>
				<h3>No notifications</h3>
				<p>You're all caught up! Updates will appear here.</p>
			</div>
		{:else}
			{#each filteredNotifications() as notification (notification.id)}
				<div
					class="notification-card"
					class:unread={!notification.read}
					style="--notification-color: {getNotificationColor(notification.type)}"
					onclick={() => handleNotificationClick(notification)}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
				>
					<div class="notification-indicator" style="background: {getNotificationColor(notification.type)}"></div>
					
					<div class="nc-avatar" style="background: {getNotificationColor(notification.type)}20; color: {getNotificationColor(notification.type)}">
						{#if notification.userName}
							{notification.userName.charAt(0).toUpperCase()}
						{:else}
							{getNotificationIcon(notification.type)}
						{/if}
					</div>

					<div class="notification-content">
						<div class="nc-top-row">
							<h4 class="nc-title">{notification.title}</h4>
							<span class="nc-time">{formatTimeAgo(notification.createdAt)}</span>
						</div>
						
						<!-- Clean, truncated summary instead of a huge paragraph -->
						<p class="nc-summary">{notification.message}</p>
						
						<!-- Structured Badges for Quick Reading -->
						<div class="nc-badges">
							{#if notification.userName}
								<span class="nc-badge user-badge">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									{notification.userName}
								</span>
							{/if}
							{#if notification.userPhone}
								<span class="nc-badge phone-badge">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
									{notification.userPhone}
								</span>
							{/if}
							{#if notification.data?.amount}
								<span class="nc-badge amount-badge">
									₹{notification.data.amount}
								</span>
							{/if}
							{#if notification.data?.status}
								<span class="nc-badge status-badge" data-status={notification.data.status}>
									{notification.data.status}
								</span>
							{/if}
						</div>
					</div>

					<button class="delete-btn" onclick={(e) => deleteNotification(notification.id, e)} title="Delete notification">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.notifications-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-md);
		min-height: 100%;
	}

	.notifications-header {
		position: sticky;
		top: 0;
		background: var(--s-bg-secondary);
		padding: var(--s-space-sm) 0 var(--s-space-md);
		z-index: 10;
		border-bottom: 1px solid var(--s-border);
		margin: -16px -16px 0 -16px;
		padding-left: 16px;
		padding-right: 16px;
	}

	.filter-action-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-space-md);
	}

	/* Filter Pills */
	.filter-pills {
		display: flex;
		gap: var(--s-space-sm);
		overflow-x: auto;
		flex: 1;
		padding-bottom: 4px;
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	
	.filter-pills::-webkit-scrollbar {
		display: none;
	}

	.filter-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-full);
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
		cursor: pointer;
		transition: all var(--s-duration-fast);
		white-space: nowrap;
		flex-shrink: 0;
		box-shadow: 0 1px 2px rgba(0,0,0,0.02);
	}

	.filter-pill:hover {
		border-color: var(--s-accent);
		color: var(--s-accent);
	}

	.filter-pill.active {
		background: var(--s-accent);
		border-color: var(--s-accent);
		color: white;
		box-shadow: 0 4px 12px rgba(232, 167, 48, 0.3);
	}

	.filter-icon {
		font-size: 0.9rem;
	}

	.filter-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: white;
		color: var(--s-accent);
		border-radius: var(--s-radius-full);
		font-size: 0.65rem;
		font-weight: 800;
	}

	.filter-pill.active .filter-badge {
		background: rgba(255, 255, 255, 0.25);
		color: white;
	}

	/* Header Actions */
	.header-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--s-border);
		background: var(--s-surface);
		color: var(--s-text-secondary);
		cursor: pointer;
		transition: all var(--s-duration-fast);
		box-shadow: 0 1px 3px rgba(0,0,0,0.05);
	}

	.action-btn:hover {
		background: var(--s-accent-bg);
		color: var(--s-accent);
		border-color: var(--s-accent);
		transform: translateY(-1px);
	}

	.action-btn.delete:hover {
		background: var(--s-error-bg);
		color: var(--s-error);
		border-color: var(--s-error);
	}

	.action-btn:active {
		transform: scale(0.92);
	}

	/* Notifications List */
	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-bottom: 24px;
	}

	.notification-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px;
		background: var(--s-surface);
		border-radius: var(--s-radius-lg);
		border: 1px solid var(--s-border);
		cursor: pointer;
		transition: all var(--s-duration-fast);
		position: relative;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0,0,0,0.02);
	}

	.notification-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0,0,0,0.06);
		border-color: var(--s-border-strong);
	}

	.notification-card:active {
		transform: scale(0.98);
	}

	.notification-card.unread {
		background: var(--s-surface);
		border-color: var(--notification-color);
		box-shadow: 0 4px 12px rgba(232, 167, 48, 0.08);
	}

	.notification-card.unread::after {
		content: '';
		position: absolute;
		top: 14px;
		right: 14px;
		width: 8px;
		height: 8px;
		background: var(--s-error);
		border-radius: 50%;
		box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
	}

	.notification-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
	}

	.nc-avatar {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--s-font-display);
		font-weight: 800;
		font-size: 1.1rem;
		margin-left: 6px;
	}

	.notification-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-right: 12px;
	}

	.nc-top-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
	}

	.nc-title {
		margin: 0;
		font-family: var(--s-font-display);
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--s-text-primary);
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.nc-time {
		font-size: 0.7rem;
		color: var(--s-text-tertiary);
		font-weight: 600;
		flex-shrink: 0;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.nc-summary {
		margin: 0 0 6px 0;
		font-size: 0.82rem;
		color: var(--s-text-secondary);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.nc-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 2px;
	}

	.nc-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: var(--s-radius-sm);
		background: var(--s-bg-tertiary);
		color: var(--s-text-secondary);
	}

	.nc-badge.user-badge {
		background: rgba(124, 58, 237, 0.08);
		color: #7c3aed;
	}
	.staff-app.dark .nc-badge.user-badge { color: #a78bfa; }

	.nc-badge.amount-badge {
		background: var(--s-success-bg);
		color: var(--s-success);
	}

	.nc-badge.status-badge {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.65rem;
		font-weight: 700;
	}

	.nc-badge.status-badge[data-status="pending"] { background: var(--s-warning-bg); color: var(--s-warning); }
	.nc-badge.status-badge[data-status="confirmed"] { background: var(--s-info-bg); color: var(--s-info); }
	.nc-badge.status-badge[data-status="completed"] { background: var(--s-success-bg); color: var(--s-success); }
	.nc-badge.status-badge[data-status="cancelled"] { background: var(--s-error-bg); color: var(--s-error); }
	.nc-badge.status-badge[data-status="in-progress"] { background: var(--s-accent-2-bg); color: var(--s-accent-2); }

	.delete-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 28px;
		height: 28px;
		border-radius: var(--s-radius-sm);
		border: none;
		background: var(--s-surface);
		color: var(--s-text-tertiary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transform: scale(0.9);
		transition: all var(--s-duration-fast);
		box-shadow: 0 2px 6px rgba(0,0,0,0.05);
	}

	/* Show delete button on mobile naturally or on hover for desktop */
	@media (max-width: 768px) {
		.delete-btn {
			opacity: 1;
			transform: scale(1);
			background: var(--s-bg-secondary);
			top: auto;
			bottom: 12px;
		}
	}

	.notification-card:hover .delete-btn {
		opacity: 1;
		transform: scale(1);
	}

	.delete-btn:hover {
		background: var(--s-error-bg);
		color: var(--s-error);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--s-space-4xl) var(--s-space-lg);
		text-align: center;
	}

	.empty-icon {
		font-size: 3.5rem;
		margin-bottom: var(--s-space-md);
		opacity: 0.3;
		filter: grayscale(1);
	}

	.empty-state h3 {
		font-family: var(--s-font-display);
		font-size: var(--s-text-lg);
		font-weight: 700;
		color: var(--s-text-primary);
		margin: 0 0 var(--s-space-xs);
	}

	.empty-state p {
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		margin: 0;
		max-width: 240px;
	}
</style>

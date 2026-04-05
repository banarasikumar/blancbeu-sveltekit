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
	<!-- Header -->
	<div class="notifications-header">
		<div class="header-top">
			<div>
				<h1 class="page-title">Notifications</h1>
				<p class="subtitle">
					{#if $unreadCount > 0}
						<span class="unread-badge">{$unreadCount} unread</span>
					{:else}
						<span class="all-read">All caught up!</span>
					{/if}
				</p>
			</div>
			<div class="header-actions">
				{#if $unreadCount > 0}
					<button class="action-btn" onclick={markAllRead} title="Mark all as read">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					</button>
				{/if}
				{#if $notifications.length > 0}
					<button class="action-btn delete" onclick={clearAll} title="Clear all">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="3 6 5 6 21 6"></polyline>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
						</svg>
					</button>
				{/if}
			</div>
		</div>

		<!-- Filter Pills -->
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
	</div>

	<!-- Notifications List -->
	<div class="notifications-list">
		{#if filteredNotifications().length === 0}
			<div class="empty-state">
				<div class="empty-icon">🔔</div>
				<h3>No notifications</h3>
				<p>You're all caught up! New bookings and updates will appear here.</p>
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
					
					<div class="notification-icon" style="background: {getNotificationColor(notification.type)}20; color: {getNotificationColor(notification.type)}">
						{getNotificationIcon(notification.type)}
					</div>

					<div class="notification-content">
						<div class="notification-header">
							<h4 class="notification-title">{notification.title}</h4>
							<span class="notification-time">{formatTimeAgo(notification.createdAt)}</span>
						</div>
						<p class="notification-message">{notification.message}</p>
						
						<!-- Additional Details -->
						<div class="notification-details">
							{#if notification.userName}
								<span class="detail-item">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
										<circle cx="12" cy="7" r="4"/>
									</svg>
									{notification.userName}
								</span>
							{/if}
							{#if notification.userPhone}
								<span class="detail-item">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
									</svg>
									{notification.userPhone}
								</span>
							{/if}
							{#if notification.data?.amount}
								<span class="detail-item amount">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="12" y1="1" x2="12" y2="23"/>
										<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
									</svg>
									₹{notification.data.amount}
								</span>
							{/if}
							{#if notification.data?.status}
								<span class="detail-item status-badge" data-status={notification.data.status}>
									{notification.data.status}
								</span>
							{/if}
						</div>
					</div>

					<button
						class="delete-btn"
						onclick={(e) => deleteNotification(notification.id, e)}
						title="Delete notification"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
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
		gap: var(--s-space-lg);
		min-height: 100%;
	}

	.notifications-header {
		position: sticky;
		top: 0;
		background: var(--s-bg-secondary);
		padding: var(--s-space-md) 0;
		z-index: 10;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--s-space-md);
	}

	.page-title {
		font-family: var(--s-font-display);
		font-size: var(--s-text-2xl);
		font-weight: 800;
		margin: 0;
		background: var(--s-grad-hero);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		margin: 4px 0 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
	}

	.unread-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--s-grad-rose);
		color: white;
		border-radius: var(--s-radius-full);
		font-weight: 600;
		font-size: var(--s-text-xs);
	}

	.all-read {
		color: var(--s-success);
		font-weight: 600;
	}

	.header-actions {
		display: flex;
		gap: var(--s-space-sm);
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--s-radius-lg);
		border: none;
		background: var(--s-surface);
		color: var(--s-text-secondary);
		cursor: pointer;
		transition: all var(--s-duration-fast);
		box-shadow: var(--s-shadow-sm);
	}

	.action-btn:hover {
		background: var(--s-accent-bg);
		color: var(--s-accent);
		transform: translateY(-1px);
	}

	.action-btn.delete:hover {
		background: var(--s-error-bg);
		color: var(--s-error);
	}

	.action-btn:active {
		transform: scale(0.95);
	}

	/* Filter Pills */
	.filter-pills {
		display: flex;
		gap: var(--s-space-sm);
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.filter-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
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
	}

	.filter-pill:hover {
		border-color: var(--s-accent);
		color: var(--s-accent);
	}

	.filter-pill.active {
		background: var(--s-accent);
		border-color: var(--s-accent);
		color: white;
		box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
	}

	.filter-icon {
		font-size: 1rem;
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
		background: rgba(255, 255, 255, 0.3);
		color: white;
	}

	/* Notifications List */
	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.notification-card {
		display: flex;
		align-items: flex-start;
		gap: var(--s-space-md);
		padding: var(--s-space-md) var(--s-space-lg);
		background: var(--s-surface);
		border-radius: var(--s-radius-xl);
		border: 1px solid var(--s-border);
		cursor: pointer;
		transition: all var(--s-duration-fast);
		position: relative;
		overflow: hidden;
	}

	.notification-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--s-shadow-md);
		border-color: var(--s-accent);
	}

	.notification-card:active {
		transform: scale(0.98);
	}

	.notification-card.unread {
		background: linear-gradient(135deg, var(--s-surface) 0%, var(--s-accent-bg) 100%);
		border-color: var(--s-accent);
	}

	.notification-card.unread::before {
		content: '';
		position: absolute;
		top: 12px;
		right: 12px;
		width: 8px;
		height: 8px;
		background: var(--s-grad-rose);
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(244, 63, 94, 0.5);
	}

	.notification-indicator {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		border-radius: var(--s-radius-xl) 0 0 var(--s-radius-xl);
	}

	.notification-icon {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		border-radius: var(--s-radius-lg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		margin-left: var(--s-space-sm);
	}

	.notification-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.notification-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--s-space-sm);
	}

	.notification-title {
		margin: 0;
		font-family: var(--s-font-display);
		font-size: var(--s-text-base);
		font-weight: 700;
		color: var(--s-text-primary);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notification-time {
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		font-weight: 500;
		flex-shrink: 0;
	}

	.notification-message {
		margin: 0;
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		line-height: 1.5;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.notification-details {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px dashed var(--s-border);
	}

	.detail-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		background: var(--s-bg-secondary);
		padding: 4px 8px;
		border-radius: var(--s-radius-md);
	}

	.detail-item.amount {
		background: var(--s-success-bg);
		color: var(--s-success);
		font-weight: 600;
	}

	.status-badge {
		text-transform: uppercase;
		font-weight: 700;
		font-size: 0.6rem;
		letter-spacing: 0.05em;
	}

	.status-badge[data-status="pending"] {
		background: var(--s-warning-bg);
		color: var(--s-warning);
	}

	.status-badge[data-status="confirmed"] {
		background: var(--s-accent-bg);
		color: var(--s-accent);
	}

	.status-badge[data-status="completed"] {
		background: var(--s-success-bg);
		color: var(--s-success);
	}

	.status-badge[data-status="cancelled"] {
		background: var(--s-error-bg);
		color: var(--s-error);
	}

	.notification-meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		margin-top: 2px;
	}

	.delete-btn {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: var(--s-radius-md);
		border: none;
		background: transparent;
		color: var(--s-text-tertiary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: all var(--s-duration-fast);
	}

	.notification-card:hover .delete-btn {
		opacity: 1;
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
		padding: var(--s-space-3xl) var(--s-space-lg);
		text-align: center;
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: var(--s-space-lg);
		opacity: 0.5;
	}

	.empty-state h3 {
		font-family: var(--s-font-display);
		font-size: var(--s-text-xl);
		font-weight: 700;
		color: var(--s-text-primary);
		margin: 0 0 var(--s-space-sm);
	}

	.empty-state p {
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		margin: 0;
		max-width: 280px;
	}
</style>

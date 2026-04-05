<script lang="ts">
	import { goto } from '$app/navigation';
	import { adminNotifications, adminUnreadCount, type AdminNotification, type AdminNotificationType } from '$lib/stores/adminNotificationsList';
	import { Bell, Trash2, Check, CheckCheck, ArrowLeft, Calendar, User, Package } from 'lucide-svelte';

	let filter: 'all' | 'unread' = $state('all');
	let selectedType: AdminNotificationType | 'all' = $state('all');

	const filteredNotifications = $derived(() => {
		let notifications = $adminNotifications;
		if (filter === 'unread') {
			notifications = notifications.filter((n) => !n.read);
		}
		if (selectedType !== 'all') {
			notifications = notifications.filter((n) => n.type === selectedType);
		}
		return notifications;
	});

	function formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return 'Just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function getNotificationColor(type: AdminNotificationType): string {
		switch (type) {
			case 'new_booking':
				return '#6366f1';
			case 'walk_in_order':
				return '#f59e0b';
			case 'status_change':
				return '#3b82f6';
			case 'completed':
				return '#22c55e';
			case 'cancelled':
				return '#ef4444';
			case 'new_user':
				return '#8b5cf6';
			case 'payment_received':
				return '#10b981';
			default:
				return '#6b7280';
		}
	}

	function getNotificationIcon(type: AdminNotificationType) {
		switch (type) {
			case 'new_booking':
				return '📅';
			case 'walk_in_order':
				return '🚶';
			case 'status_change':
				return '🔄';
			case 'completed':
				return '✅';
			case 'cancelled':
				return '❌';
			case 'new_user':
				return '👤';
			case 'payment_received':
				return '💰';
			default:
				return '📢';
		}
	}

	function handleNotificationClick(notification: AdminNotification) {
		// Mark as read
		adminNotifications.markAsRead(notification.id);

		// Navigate based on type
		if (notification.bookingId) {
			goto(`/admin/bookings?bookingId=${notification.bookingId}`);
		} else if (notification.userId && notification.type === 'new_user') {
			goto(`/admin/users?id=${notification.userId}`);
		}
	}

	function deleteNotification(id: string, event: Event) {
		event.stopPropagation();
		adminNotifications.delete(id);
	}

	function markAllAsRead() {
		adminNotifications.markAllAsRead();
	}

	function clearAll() {
		if (confirm('Clear all notifications?')) {
			adminNotifications.clear();
		}
	}

	const typeLabels: Record<AdminNotificationType | 'all', string> = {
		all: 'All Types',
		new_booking: 'New Bookings',
		walk_in_order: 'Walk-in Orders',
		status_change: 'Status Changes',
		completed: 'Completed',
		cancelled: 'Cancelled',
		new_user: 'New Users',
		payment_received: 'Payments',
		system: 'System'
	};
</script>

<div class="notifications-page">
	<!-- Header -->
	<div class="notifications-header">
		<button class="back-btn" onclick={() => goto('/admin')}>
			<ArrowLeft size={20} />
		</button>
		<h1>Notifications</h1>
		{#if $adminUnreadCount > 0}
			<span class="unread-badge">{$adminUnreadCount} unread</span>
		{/if}
	</div>

	<!-- Filters -->
	<div class="filters">
		<div class="filter-group">
			<button class="filter-btn" class:active={filter === 'all'} onclick={() => filter = 'all'}>
				All
			</button>
			<button class="filter-btn" class:active={filter === 'unread'} onclick={() => filter = 'unread'}>
				Unread
			</button>
		</div>

		<select class="type-select" bind:value={selectedType}>
			{#each Object.entries(typeLabels) as [value, label]}
				<option value={value}>{label}</option>
			{/each}
		</select>
	</div>

	<!-- Action Buttons -->
	{#if $adminNotifications.length > 0}
		<div class="actions">
			<button class="action-btn" onclick={markAllAsRead}>
				<CheckCheck size={16} />
				Mark all read
			</button>
			<button class="action-btn danger" onclick={clearAll}>
				<Trash2 size={16} />
				Clear all
			</button>
		</div>
	{/if}

	<!-- Notification List -->
	<div class="notification-list">
		{#if filteredNotifications().length === 0}
			<div class="empty-state">
				<div class="empty-icon">
					<Bell size={48} />
				</div>
				<p>No notifications</p>
				{#if filter === 'unread'}
					<button class="view-all-btn" onclick={() => filter = 'all'}>View all</button>
				{/if}
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
						
						{#if notification.userName || notification.data}
							<div class="notification-details">
								{#if notification.userName}
									<span class="detail-item">
										<User size={12} />
										{notification.userName}
									</span>
								{/if}
								{#if notification.data?.amount}
									<span class="detail-item amount">
										💰 ₹{notification.data.amount}
									</span>
								{/if}
								{#if notification.data?.status}
									<span class="detail-item status" data-status={notification.data.status}>
										{notification.data.status}
									</span>
								{/if}
							</div>
						{/if}
					</div>

					<button
						class="delete-btn"
						onclick={(e) => deleteNotification(notification.id, e)}
						title="Delete notification"
					>
						<Trash2 size={16} />
					</button>

					{#if !notification.read}
						<button
							class="mark-read-btn"
							onclick={(e) => {
								e.stopPropagation();
								adminNotifications.markAsRead(notification.id);
							}}
							title="Mark as read"
						>
							<Check size={16} />
						</button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.notifications-page {
		padding: 16px;
		max-width: 800px;
		margin: 0 auto;
	}

	.notifications-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}

	.notifications-header h1 {
		font-size: 24px;
		font-weight: 700;
		margin: 0;
		flex: 1;
	}

	.back-btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: none;
		background: var(--admin-bg-secondary, #f3f4f6);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.back-btn:hover {
		background: var(--admin-border, #e5e5e5);
	}

	.unread-badge {
		background: var(--admin-accent, #6366f1);
		color: white;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
	}

	.filters {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.filter-group {
		display: flex;
		gap: 8px;
		background: var(--admin-bg-secondary, #f3f4f6);
		padding: 4px;
		border-radius: 10px;
	}

	.filter-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.filter-btn.active {
		background: white;
		color: var(--admin-accent, #6366f1);
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}

	.type-select {
		padding: 8px 12px;
		border-radius: 10px;
		border: 1px solid var(--admin-border, #e5e5e5);
		background: white;
		font-size: 14px;
		cursor: pointer;
	}

	.actions {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
		justify-content: flex-end;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid var(--admin-border, #e5e5e5);
		background: white;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.action-btn:hover {
		background: var(--admin-bg-secondary, #f3f4f6);
	}

	.action-btn.danger {
		color: var(--admin-error, #ef4444);
		border-color: var(--admin-error-light, #fee2e2);
	}

	.action-btn.danger:hover {
		background: var(--admin-error-light, #fee2e2);
	}

	.notification-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty-state {
		text-align: center;
		padding: 60px 20px;
		color: var(--admin-text-secondary, #6b7280);
	}

	.empty-icon {
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state p {
		font-size: 16px;
		margin: 0 0 16px 0;
	}

	.view-all-btn {
		padding: 10px 20px;
		border-radius: 8px;
		border: none;
		background: var(--admin-accent, #6366f1);
		color: white;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
	}

	.notification-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		background: white;
		border-radius: 12px;
		border: 1px solid var(--admin-border, #e5e5e5);
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
	}

	.notification-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.08);
	}

	.notification-card.unread {
		background: var(--admin-accent-light, #eef2ff);
		border-color: var(--admin-accent, #6366f1);
	}

	.notification-indicator {
		width: 4px;
		border-radius: 2px;
		align-self: stretch;
		flex-shrink: 0;
	}

	.notification-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		flex-shrink: 0;
	}

	.notification-content {
		flex: 1;
		min-width: 0;
	}

	.notification-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.notification-title {
		font-size: 15px;
		font-weight: 600;
		color: var(--admin-text, #1f2937);
		margin: 0;
	}

	.notification-time {
		font-size: 12px;
		color: var(--admin-text-secondary, #6b7280);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.notification-message {
		font-size: 14px;
		color: var(--admin-text-secondary, #6b7280);
		margin: 0;
		line-height: 1.5;
	}

	.notification-details {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px dashed var(--admin-border, #e5e5e5);
	}

	.detail-item {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--admin-text-secondary, #6b7280);
		background: var(--admin-bg-secondary, #f3f4f6);
		padding: 4px 8px;
		border-radius: 6px;
	}

	.detail-item.amount {
		background: #dcfce7;
		color: #166534;
		font-weight: 600;
	}

	.detail-item.status {
		text-transform: uppercase;
		font-weight: 600;
		font-size: 10px;
		letter-spacing: 0.05em;
	}

	.detail-item.status[data-status="pending"] {
		background: #fef3c7;
		color: #92400e;
	}

	.detail-item.status[data-status="confirmed"] {
		background: #dbeafe;
		color: #1e40af;
	}

	.detail-item.status[data-status="completed"] {
		background: #dcfce7;
		color: #166534;
	}

	.detail-item.status[data-status="cancelled"] {
		background: #fee2e2;
		color: #991b1b;
	}

	.delete-btn,
	.mark-read-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--admin-text-secondary, #6b7280);
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.delete-btn:hover {
		background: var(--admin-error-light, #fee2e2);
		color: var(--admin-error, #ef4444);
	}

	.mark-read-btn:hover {
		background: var(--admin-accent-light, #eef2ff);
		color: var(--admin-accent, #6366f1);
	}
</style>

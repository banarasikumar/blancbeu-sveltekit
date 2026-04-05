import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const ADMIN_NOTIFICATIONS_KEY = 'blancbeu_admin_notifications';

export type AdminNotificationType = 
	| 'new_booking' 
	| 'status_change' 
	| 'new_user' 
	| 'walk_in_order' 
	| 'payment_received' 
	| 'cancelled' 
	| 'completed' 
	| 'system';

export interface AdminNotification {
	id: string;
	type: AdminNotificationType;
	title: string;
	message: string;
	bookingId?: string;
	userId?: string;
	userName?: string;
	userPhone?: string;
	createdAt: number;
	read: boolean;
	data?: Record<string, any>;
}

function createAdminNotificationsStore() {
	const initialNotifications: AdminNotification[] = browser
		? JSON.parse(localStorage.getItem(ADMIN_NOTIFICATIONS_KEY) || '[]')
		: [];

	const { subscribe, update, set } = writable<AdminNotification[]>(initialNotifications);

	return {
		subscribe,

		add(notification: Omit<AdminNotification, 'id' | 'createdAt' | 'read'>) {
			const newNotification: AdminNotification = {
				...notification,
				id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				createdAt: Date.now(),
				read: false
			};

			update((notifications) => {
				const updated = [newNotification, ...notifications].slice(0, 100);
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});

			return newNotification;
		},

		markAsRead(id: string) {
			update((notifications) => {
				const updated = notifications.map((n) =>
					n.id === id ? { ...n, read: true } : n
				);
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		markAllAsRead() {
			update((notifications) => {
				const updated = notifications.map((n) => ({ ...n, read: true }));
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		delete(id: string) {
			update((notifications) => {
				const updated = notifications.filter((n) => n.id !== id);
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		clear() {
			if (browser) {
				localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, '[]');
			}
			set([]);
		},

		// New Booking Notification
		addNewBookingNotification(booking: {
			id: string;
			userName?: string;
			userPhone?: string;
			userId?: string;
			date?: string;
			time?: string;
			serviceName?: string;
			totalAmount?: number;
			status: string;
			source?: 'user' | 'staff_walkin';
		}) {
			const customerName = booking.userName || 'Guest';
			const serviceName = booking.serviceName || 'Service';
			const formattedDate = booking.date ? new Date(booking.date).toLocaleDateString('en-IN', { 
				weekday: 'short', 
				day: 'numeric', 
				month: 'short' 
			}) : 'Today';
			
			const isWalkIn = booking.source === 'staff_walkin';
			
			return this.add({
				type: isWalkIn ? 'walk_in_order' : 'new_booking',
				title: isWalkIn 
					? `🚶 Walk-in Order from ${customerName}`
					: `📅 New Booking from ${customerName}`,
				message: isWalkIn
					? `${serviceName} walk-in for ${formattedDate} at ${booking.time || 'TBD'}${booking.totalAmount ? `. Amount: ₹${booking.totalAmount}` : ''}. Status: ${booking.status}`
					: `${serviceName} scheduled for ${formattedDate} at ${booking.time || 'TBD'}${booking.totalAmount ? `. Total: ₹${booking.totalAmount}` : ''}. Status: ${booking.status}`,
				bookingId: booking.id,
				userId: booking.userId,
				userName: booking.userName,
				userPhone: booking.userPhone,
				data: { 
					amount: booking.totalAmount, 
					status: booking.status,
					source: booking.source || 'user'
				}
			});
		},

		// Status Change Notification
		addStatusChangeNotification(booking: {
			id: string;
			userName?: string;
			userId?: string;
			status: string;
			previousStatus?: string;
			date?: string;
			time?: string;
			serviceName?: string;
			totalAmount?: number;
		}) {
			const statusText = booking.status === 'completed' ? '✅ Completed' : 
				booking.status === 'cancelled' ? '❌ Cancelled' : 
				booking.status === 'confirmed' ? '✓ Confirmed' : 
				booking.status === 'pending' ? '⏳ Pending' : 'Updated';
			
			const customerName = booking.userName || 'Guest';
			const serviceInfo = booking.serviceName ? ` for ${booking.serviceName}` : '';
			const timeInfo = booking.time ? ` at ${booking.time}` : '';
			
			let message = `${customerName}'s${serviceInfo} booking${timeInfo} is now ${booking.status}`;
			if (booking.previousStatus) {
				message += ` (was ${booking.previousStatus})`;
			}
			if (booking.totalAmount && booking.status === 'completed') {
				message += `. Payment: ₹${booking.totalAmount}`;
			}
			
			return this.add({
				type: 'status_change',
				title: statusText,
				message,
				bookingId: booking.id,
				userId: booking.userId,
				userName: booking.userName,
				data: { 
					status: booking.status, 
					previousStatus: booking.previousStatus,
					amount: booking.totalAmount
				}
			});
		},

		// New User Notification
		addNewUserNotification(user: {
			id: string;
			name?: string;
			phone?: string;
			email?: string;
			signupMethod?: 'google' | 'phone' | 'email';
		}) {
			const userName = user.name || 'New User';
			const signupMethod = user.signupMethod || 'phone';
			const methodIcon = signupMethod === 'google' ? '🔵' : signupMethod === 'phone' ? '📱' : '📧';
			
			return this.add({
				type: 'new_user',
				title: `${methodIcon} New User: ${userName}`,
				message: `A new user just signed up${user.phone ? ` with phone ${user.phone}` : ''}${user.email ? ` (${user.email})` : ''}.`,
				userId: user.id,
				userName: user.name,
				userPhone: user.phone,
				data: { 
					signupMethod: user.signupMethod,
					email: user.email
				}
			});
		},

		// Payment Received Notification
		addPaymentNotification(payment: {
			bookingId: string;
			userName?: string;
			amount: number;
			method?: string;
			status: string;
		}) {
			return this.add({
				type: 'payment_received',
				title: `💰 Payment Received`,
				message: `₹${payment.amount} received${payment.userName ? ` from ${payment.userName}` : ''}${payment.method ? ` via ${payment.method}` : ''}.`,
				bookingId: payment.bookingId,
				userName: payment.userName,
				data: { 
					amount: payment.amount,
					method: payment.method,
					status: payment.status
				}
			});
		}
	};
}

export const adminNotifications = createAdminNotificationsStore();

export const adminUnreadCount = derived(
	adminNotifications,
	$notifications => $notifications.filter(n => !n.read).length
);

export const recentAdminNotifications = derived(
	adminNotifications,
	$notifications => $notifications.slice(0, 20)
);

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const NOTIFICATIONS_KEY = 'blancbeu_staff_notifications';
const READ_NOTIFICATIONS_KEY = 'blancbeu_staff_read_notifications';

export type NotificationType = 'booking' | 'cancelled' | 'completed' | 'payment' | 'system';

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	bookingId?: string;
	userName?: string;
	userPhone?: string;
	createdAt: number;
	read: boolean;
	data?: Record<string, any>;
}

function createNotificationsStore() {
	const initialNotifications: Notification[] = browser
		? JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]')
		: [];

	const { subscribe, update, set } = writable<Notification[]>(initialNotifications);

	return {
		subscribe,

		add(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
			const newNotification: Notification = {
				...notification,
				id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
				createdAt: Date.now(),
				read: false
			};

			update((notifications) => {
				const updated = [newNotification, ...notifications].slice(0, 100); // Keep last 100
				if (browser) {
					localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
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
					localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		markAllAsRead() {
			update((notifications) => {
				const updated = notifications.map((n) => ({ ...n, read: true }));
				if (browser) {
					localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		delete(id: string) {
			update((notifications) => {
				const updated = notifications.filter((n) => n.id !== id);
				if (browser) {
					localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
				}
				return updated;
			});
		},

		clear() {
			if (browser) {
				localStorage.setItem(NOTIFICATIONS_KEY, '[]');
			}
			set([]);
		},

		addBookingNotification(booking: {
			id: string;
			userName?: string;
			userPhone?: string;
			date?: string;
			time?: string;
			serviceName?: string;
			totalAmount?: number;
			status: string;
		}) {
			const customerName = booking.userName || 'Guest';
			const serviceName = booking.serviceName || 'Service';
			const formattedDate = booking.date ? new Date(booking.date).toLocaleDateString('en-IN', { 
				weekday: 'short', 
				day: 'numeric', 
				month: 'short' 
			}) : 'Today';
			
			return this.add({
				type: 'booking',
				title: `📅 New Booking from ${customerName}`,
				message: `${serviceName} scheduled for ${formattedDate} at ${booking.time || 'TBD'}${booking.totalAmount ? `. Total amount: ₹${booking.totalAmount}` : ''}. Status: ${booking.status}. Please review and confirm this booking.`,
				bookingId: booking.id,
				userName: booking.userName,
				userPhone: booking.userPhone,
				data: { amount: booking.totalAmount, status: booking.status }
			});
		},

		addStatusChangeNotification(booking: {
			id: string;
			userName?: string;
			status: string;
			previousStatus?: string;
			date?: string;
			time?: string;
			serviceName?: string;
		}) {
			const statusText = booking.status === 'completed' ? '✅ Completed' : 
				booking.status === 'cancelled' ? '❌ Cancelled' : 
				booking.status === 'confirmed' ? '✓ Confirmed' : 'Updated';
			
			const customerName = booking.userName || 'Guest';
			const serviceInfo = booking.serviceName ? ` for ${booking.serviceName}` : '';
			const timeInfo = booking.time ? ` at ${booking.time}` : '';
			
			let message = `${customerName}'s${serviceInfo} booking${timeInfo} has been ${booking.status}`;
			if (booking.previousStatus) {
				message += ` (changed from ${booking.previousStatus})`;
			}
			
			return this.add({
				type: booking.status === 'completed' ? 'completed' : 
					booking.status === 'cancelled' ? 'cancelled' : 'booking',
				title: statusText,
				message,
				bookingId: booking.id,
				userName: booking.userName,
				data: { status: booking.status, previousStatus: booking.previousStatus }
			});
		}
	};
}

export const notifications = createNotificationsStore();

export const unreadCount = derived(
	notifications,
	$notifications => $notifications.filter(n => !n.read).length
);

export const recentNotifications = derived(
	notifications,
	$notifications => $notifications.slice(0, 20)
);

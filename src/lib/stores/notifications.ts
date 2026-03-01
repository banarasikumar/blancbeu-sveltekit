import { writable, derived } from 'svelte/store';

// Mock Data mimicking legacy content
const initialNotifications = [
	{
		id: 1,
		type: 'appointments',
		priority: 'high',
		unread: true,
		title: 'Your Booking Confirmed',
		message: 'Hair Spa on Nov 28, 2025 at 3:00 PM | Service ID: #BS2025',
		time: '2 hours ago',
		dateCategory: 'Today',
		badge: 'Confirmed',
		icon: 'calendar'
	},
	{
		id: 2,
		type: 'offers',
		priority: 'high',
		unread: true,
		title: 'Special Offer: 40% Off!',
		message: 'Get amazing discounts on all beauty treatments this week only',
		time: '6 hours ago',
		dateCategory: 'Today',
		badge: 'Hot Deal',
		offerAmount: '40% OFF',
		expiry: 'Expires in 2 days',
		icon: 'offer'
	},
	{
		id: 3,
		type: 'reviews',
		priority: 'normal',
		unread: false,
		title: 'Share Your Experience',
		message: "We'd love to hear about your recent visit! Rate your experience",
		time: '1 day ago',
		dateCategory: 'Yesterday',
		icon: 'star'
	},
	{
		id: 4,
		type: 'appointments',
		priority: 'normal',
		unread: false,
		title: 'Appointment Reminder',
		message: 'Your Hair Coloring appointment is tomorrow at 2:00 PM',
		time: '1 day ago',
		dateCategory: 'Yesterday',
		icon: 'clock'
	},
	{
		id: 5,
		type: 'offers',
		priority: 'normal',
		unread: false,
		title: "You've Earned 150 Points!",
		message: 'Congratulations! Redeem them for exclusive rewards and discounts',
		time: '2 days ago',
		dateCategory: 'Earlier',
		points: '150 Points',
		icon: 'trophy'
	},
	{
		id: 6,
		type: 'offers',
		priority: 'normal',
		unread: false,
		title: 'New Service: Bridal Makeup',
		message: 'Experience our premium bridal makeup service with expert artists',
		time: '3 days ago',
		dateCategory: 'Earlier',
		icon: 'sparkles'
	},
	{
		id: 7,
		type: 'reviews',
		priority: 'normal',
		unread: false,
		title: 'New Review from Sarah M.',
		message: '"Amazing experience! The staff was very professional and friendly."',
		time: '5 days ago',
		dateCategory: 'Earlier',
		rating: 5,
		icon: 'quote'
	}
];

function createNotificationsStore() {
	const { subscribe, set, update } = writable(initialNotifications);

	return {
		subscribe,
		markAllRead: () => update((n) => n.map((item) => ({ ...item, unread: false }))),
		clearAll: () => set([]),
		dismiss: (id: number) => update((n) => n.filter((item) => item.id !== id)),
		add: (notification: any) => update((n) => [notification, ...n])
	};
}

export const notifications = createNotificationsStore();

export const unreadCount = derived(
	notifications,
	($notifications) => $notifications.filter((n) => n.unread).length
);

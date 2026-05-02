import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import {
	collection,
	query,
	orderBy,
	onSnapshot,
	updateDoc,
	doc,
	deleteDoc,
	limit,
	where
} from 'firebase/firestore';
import { user } from '$lib/stores/auth';

export interface NotificationItem {
	id: string;
	type: 'appointments' | 'offers' | 'reviews' | 'system';
	priority: 'high' | 'normal';
	unread: boolean;
	title: string;
	message: string;
	createdAt: number;
	time: string;
	dateCategory: string;
	icon?: string;
	badge?: string;
	imageUrl?: string;
	clickUrl?: string;
	isGlobal?: boolean;
}

function formatRelativeTime(timestamp: number): { time: string; dateCategory: string } {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	let time = '';
	if (diffMins < 60) {
		time = diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`;
	} else if (diffHours < 24) {
		time = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
	} else {
		time = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
	}

	let dateCategory = 'Earlier';
	if (diffDays === 0) dateCategory = 'Today';
	else if (diffDays === 1) dateCategory = 'Yesterday';
	else if (diffDays <= 7) dateCategory = 'This Week';

	return { time, dateCategory };
}

function createNotificationsStore() {
	const { subscribe, set, update } = writable<NotificationItem[]>([]);
	let unsubUser: (() => void) | null = null;
	let unsubAnnouncements: (() => void) | null = null;
	let currentUserUid: string | null = null;

	// Local cache for global announcements read state
	let readAnnouncements: string[] = [];
	let welcomeDismissed = false;
	let welcomeRead = false;
	const welcomeTimestamp = Date.now();

	if (browser) {
		try {
			readAnnouncements = JSON.parse(localStorage.getItem('read_announcements') || '[]');
			welcomeDismissed = localStorage.getItem('welcome_dismissed') === 'true';
			welcomeRead = localStorage.getItem('welcome_read') === 'true';
		} catch (e) {
			readAnnouncements = [];
			welcomeDismissed = false;
			welcomeRead = false;
		}
	}

	// This function handles merging private and global notifications
	let privateNotifs: NotificationItem[] = [];
	let globalNotifs: NotificationItem[] = [];

	const syncStore = () => {
		const combined = [...privateNotifs, ...globalNotifs];

		if (!welcomeDismissed) {
			const { time, dateCategory } = formatRelativeTime(welcomeTimestamp);
			combined.push({
				id: 'welcome-msg',
				type: 'system',
				priority: 'high',
				unread: !welcomeRead,
				title: '✨ First time here?',
				message: 'Welcome to Blancbeu! Get Rs. 500 Beu Cash to use for your bookings. T&C apply.',
				createdAt: welcomeTimestamp,
				time,
				dateCategory,
				icon: 'sparkles',
				clickUrl: '/you',
				isGlobal: true
			});
		}

		combined.sort((a, b) => b.createdAt - a.createdAt);
		set(combined);
	};

	// Start listening to the logged-in user
	if (browser) {
		user.subscribe(($user) => {
			if ($user?.uid) {
				if (currentUserUid !== $user.uid) {
					currentUserUid = $user.uid;
					initListeners($user.uid);
				}
			} else {
				// User logged out
				currentUserUid = null;
				if (unsubUser) unsubUser();
				if (unsubAnnouncements) unsubAnnouncements();
				privateNotifs = [];
				globalNotifs = [];
				set([]);
			}
		});
	}

	function initListeners(uid: string) {
		if (unsubUser) unsubUser();
		if (unsubAnnouncements) unsubAnnouncements();

		// 1. Listen to Private Notifications
		const userNotifsRef = collection(db, 'users', uid, 'notifications');
		const qPrivate = query(userNotifsRef, orderBy('createdAt', 'desc'), limit(50));

		unsubUser = onSnapshot(qPrivate, (snapshot) => {
			privateNotifs = snapshot.docs.map((doc) => {
				const data = doc.data();
				const timestamp = data.createdAt?.toMillis() || Date.now();
				const { time, dateCategory } = formatRelativeTime(timestamp);

				return {
					id: doc.id,
					type: data.type || 'system',
					priority: data.priority || 'normal',
					unread: data.unread ?? true,
					title: data.title || '',
					message: data.message || '',
					createdAt: timestamp,
					time,
					dateCategory,
					icon: data.icon,
					badge: data.badge,
					imageUrl: data.imageUrl,
					clickUrl: data.clickUrl,
					isGlobal: false
				} as NotificationItem;
			});
			syncStore();
		});

		// 2. Listen to Global Announcements
		const announcementsRef = collection(db, 'announcements');
		const qGlobal = query(announcementsRef, orderBy('createdAt', 'desc'), limit(20));

		unsubAnnouncements = onSnapshot(qGlobal, (snapshot) => {
			globalNotifs = snapshot.docs.map((doc) => {
				const data = doc.data();
				const timestamp = data.createdAt?.toMillis() || Date.now();
				const { time, dateCategory } = formatRelativeTime(timestamp);
				
				// Check if this global announcement was marked as read locally
				const isRead = readAnnouncements.includes(doc.id);

				return {
					id: doc.id,
					type: data.type || 'offers',
					priority: data.priority || 'high',
					unread: !isRead,
					title: data.title || '',
					message: data.message || '',
					createdAt: timestamp,
					time,
					dateCategory,
					icon: data.icon || 'sparkles',
					badge: data.badge,
					imageUrl: data.imageUrl,
					clickUrl: data.clickUrl,
					isGlobal: true
				} as NotificationItem;
			});
			syncStore();
		});
	}

	return {
		subscribe,
		
		markAllRead: async () => {
			// Update local state immediately for fast UI
			update((notifs) => notifs.map((n) => ({ ...n, unread: false })));

			// Handle Private Notifications in Firestore
			if (currentUserUid) {
				const unreadPrivate = privateNotifs.filter(n => n.unread);
				for (const n of unreadPrivate) {
					try {
						await updateDoc(doc(db, 'users', currentUserUid, 'notifications', n.id), { unread: false });
					} catch (e) {
						console.error('Failed to mark read', e);
					}
				}
			}

			// Handle Global Announcements locally
			const unreadGlobal = globalNotifs.filter(n => n.unread);
			if (unreadGlobal.length > 0) {
				unreadGlobal.forEach(n => {
					if (!readAnnouncements.includes(n.id)) readAnnouncements.push(n.id);
				});
				if (browser) {
					localStorage.setItem('read_announcements', JSON.stringify(readAnnouncements));
				}
			}

			if (!welcomeRead) {
				welcomeRead = true;
				if (browser) localStorage.setItem('welcome_read', 'true');
			}
		},

		clearAll: async () => {
			if (!currentUserUid) return;

			// We only delete private notifications. Global announcements are just marked read.
			const privateIds = privateNotifs.map(n => n.id);
			
			// Update UI
			update(notifs => notifs.filter(n => n.isGlobal));
			
			// Delete from Firestore
			for (const id of privateIds) {
				try {
					await deleteDoc(doc(db, 'users', currentUserUid, 'notifications', id));
				} catch (e) {
					console.error('Failed to delete notification', e);
				}
			}

			// Mark remaining globals as read
			const unreadGlobal = globalNotifs.filter(n => n.unread);
			if (unreadGlobal.length > 0) {
				unreadGlobal.forEach(n => {
					if (!readAnnouncements.includes(n.id)) readAnnouncements.push(n.id);
				});
				if (browser) {
					localStorage.setItem('read_announcements', JSON.stringify(readAnnouncements));
				}
			}

			if (!welcomeRead) {
				welcomeRead = true;
				if (browser) localStorage.setItem('welcome_read', 'true');
			}
		},

		dismiss: async (id: string) => {
			const item = get({subscribe}).find(n => n.id === id);
			if (!item) return;

			// Update UI immediately
			update((notifs) => notifs.filter((n) => n.id !== id));

			if (id === 'welcome-msg') {
				welcomeDismissed = true;
				if (browser) localStorage.setItem('welcome_dismissed', 'true');
			} else if (item.isGlobal) {
				// We can't delete global announcements, just mark as read/hidden locally
				// For now, we'll just mark it read, and the UI filter hides it since we updated the store.
				// Next refresh it will appear again as read, which is standard.
				if (!readAnnouncements.includes(id)) {
					readAnnouncements.push(id);
					if (browser) localStorage.setItem('read_announcements', JSON.stringify(readAnnouncements));
				}
			} else if (currentUserUid) {
				try {
					await deleteDoc(doc(db, 'users', currentUserUid, 'notifications', id));
				} catch (e) {
					console.error('Failed to delete notification', e);
				}
			}
		}
	};
}

export const notifications = createNotificationsStore();

export const unreadCount = derived(
	notifications,
	($notifications) => $notifications.filter((n) => n.unread).length
);

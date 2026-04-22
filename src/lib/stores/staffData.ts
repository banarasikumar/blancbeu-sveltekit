import { writable, derived } from 'svelte/store';
import {
	collection,
	query,
	orderBy,
	onSnapshot,
	addDoc,
	updateDoc,
	doc,
	Timestamp,
	where,
	getDocs,
	limit
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Booking, Service, AppUser } from './adminData'; // Reuse types
import { get } from 'svelte/store';
import { soundEnabled } from './staffNotifications';
import { notifications } from './staffNotificationsList';
import { playNotificationChime, playSelectedNotificationSound } from '$lib/utils/notificationSound';
import { showToast } from './toast';

// --- Stores ---
export const staffBookings = writable<Booking[]>([]);
export const staffServices = writable<Service[]>([]);

// Track previous bookings to detect new ones
let previousBookingIds = new Set<string>();
let isInitialLoad = true;

// Derived stats
// Derived stats
export const upcomingBookings = derived(staffBookings, ($b) => {
	const now = new Date();
	const todayStr = now.toISOString().split('T')[0];

	return $b
		.filter((b) => {
			// Only show active statuses
			if (b.status !== 'pending' && b.status !== 'confirmed' && b.status !== 'in-progress')
				return false;
			if (!b.date) return false;

			const bookingDate = typeof b.date === 'string' ? b.date.split('T')[0] : '';

			// Today's bookings: ALWAYS include if still active (pending/confirmed/in-progress)
			// A confirmed booking is still work to do, regardless of scheduled time
			if (bookingDate === todayStr) return true;

			// Future bookings: always include
			if (bookingDate > todayStr) return true;

			// Past dates: exclude
			return false;
		})
		.sort((a, b) => {
			// Sort by date, then by time
			const dateA = (a.date || '').split('T')[0];
			const dateB = (b.date || '').split('T')[0];
			if (dateA !== dateB) return dateA.localeCompare(dateB);

			// Parse time for sorting (handle both "HH:MM" and "HH:MM AM/PM")
			const parseTime = (t: string) => {
				if (!t) return 0;
				const cleaned = t.replace(/\s*(AM|PM)\s*/i, '').trim();
				const [h, m] = cleaned.split(':').map(Number);
				const isPM = /PM/i.test(t) && h !== 12;
				const isAM12 = /AM/i.test(t) && h === 12;
				const hours = isPM ? h + 12 : isAM12 ? 0 : h;
				return (hours || 0) * 60 + (m || 0);
			};
			return parseTime(a.time || '') - parseTime(b.time || '');
		});
});

export const todayBookings = derived(staffBookings, ($b) => {
	const today = new Date().toISOString().split('T')[0];
	return $b.filter((b) => {
		if (!b.date) return false;
		if (typeof b.date === 'string' && b.date.includes(today)) return true;
		return false;
	});
});

// --- Listeners ---
let bookingsUnsub: (() => void) | null = null;
let servicesUnsub: (() => void) | null = null;

export function initStaffDataListener() {
	if (bookingsUnsub) return;
	console.log('[StaffData] Starting listeners');

	const qBookings = query(collection(db, 'bookings'), orderBy('date', 'asc')); // Sort by appointment date

	bookingsUnsub = onSnapshot(
		qBookings,
		(snapshot) => {
			const bookings = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as Booking[];

			// Detect new bookings (not in previous set)
			const currentIds = new Set(bookings.map(b => b.id));
			const newBookings = bookings.filter(b => !previousBookingIds.has(b.id));

			// Play sound and show toast for new bookings (not on initial load)
			if (!isInitialLoad && newBookings.length > 0) {
				const newPendingBookings = newBookings.filter(b => b.status === 'pending');
				if (newPendingBookings.length > 0) {
					// Play the user's selected notification sound (with automatic fallback)
					playSelectedNotificationSound(0.7);

					// Show toast for each new booking
					newPendingBookings.forEach(booking => {
						const customerName = booking.customerName || booking.userName || 'New customer';
						showToast(`New booking from ${customerName}!`, 'success');
						
						// Add to notifications list
						notifications.addBookingNotification({
							id: booking.id,
							userName: booking.userName,
							userPhone: booking.userPhone,
							date: booking.date,
							time: booking.time,
							serviceName: booking.serviceName,
							totalAmount: booking.totalAmount,
							status: booking.status
						});
					});
				}
			}

			// Update tracking state
			previousBookingIds = currentIds;
			isInitialLoad = false;

			staffBookings.set(bookings);
		},
		(error) => {
			console.error('[StaffData] Booking listener error:', error);
		}
	);

	const qServices = query(collection(db, 'services'));
	servicesUnsub = onSnapshot(
		qServices,
		(snapshot) => {
			const services = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as Service[];
			staffServices.set(services);
		},
		(error) => {
			console.error('[StaffData] Service listener error:', error);
		}
	);
}

export function destroyStaffDataListeners() {
	if (bookingsUnsub) {
		bookingsUnsub();
		bookingsUnsub = null;
	}
	if (servicesUnsub) {
		servicesUnsub();
		servicesUnsub = null;
	}
}

// --- Actions ---

export async function createBooking(bookingData: Partial<Booking>) {
	try {
		// Ensure required fields
		const newBooking = {
			...bookingData,
			status: 'confirmed', // Staff created bookings are usually confirmed immediately
			createdAt: new Date().toISOString(), // Use string for consistency with existing data
			updatedAt: new Date().toISOString()
		};
		await addDoc(collection(db, 'bookings'), newBooking);
	} catch (e) {
		console.error('Error creating booking:', e);
		throw e;
	}
}

export async function updateBookingDetails(id: string, updates: Partial<Booking>) {
	try {
		const docRef = doc(db, 'bookings', id);
		await updateDoc(docRef, {
			...updates,
			updatedAt: new Date().toISOString()
		});
	} catch (e) {
		console.error('Error updating booking:', e);
		throw e;
	}
}

export async function getBookingHistory(userId: string): Promise<Booking[]> {
	try {
		const q = query(
			collection(db, 'bookings'),
			where('userId', '==', userId),
			orderBy('date', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Booking);
	} catch (e) {
		console.error('Error fetching history:', e);
		return [];
	}
}

export async function searchUsersByPhone(phoneQuery: string): Promise<AppUser[]> {
	try {
		if (!phoneQuery || phoneQuery.trim().length < 3) return []; // Require at least 3 chars

		// Note: Firestore doesn't do substring search well, but prefix search works.
		// Since we stripped the user input to just digits, we should try a few common prefixes in the DB
		const formats = [phoneQuery, `+91${phoneQuery}`, `+91 ${phoneQuery}`, `+91-${phoneQuery}`];

		const allResults: AppUser[] = [];
		const seenIds = new Set<string>();

		for (const format of formats) {
			const q = query(
				collection(db, 'users'),
				where('phone', '>=', format),
				where('phone', '<=', format + '\uf8ff'),
				limit(5)
			);
			const snapshot = await getDocs(q);

			snapshot.docs.forEach((d) => {
				if (!seenIds.has(d.id)) {
					seenIds.add(d.id);
					allResults.push({ id: d.id, ...d.data() } as AppUser);
				}
			});
			if (allResults.length >= 5) break;
		}

		return allResults.slice(0, 5);
	} catch (e) {
		console.error('Error searching users by phone:', e);
		return [];
	}
}

export async function searchUsersByName(nameQuery: string): Promise<AppUser[]> {
	try {
		if (!nameQuery || nameQuery.trim().length < 3) return [];

		const queryLower = nameQuery.toLowerCase();

		// Attempt to search across common name fields by doing an exact
		// or starting-with query. Firestore doesn't support case-insensitive
		// fields natively without a dedicated lowercase index field,
		// but we'll try standard capitalized approaches as a best-effort.

		// For simplicity given Firestore limits, assuming names are stored with standard casing
		const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
		const queryCap = capitalize(nameQuery);

		const allResults: AppUser[] = [];
		const seenIds = new Set<string>();

		// We will prioritize checking the 'name' field since that's what BookingModal uses most
		const queries = [
			query(
				collection(db, 'users'),
				where('name', '>=', queryCap),
				where('name', '<=', queryCap + '\uf8ff'),
				limit(5)
			),
			query(
				collection(db, 'users'),
				where('displayName', '>=', queryCap),
				where('displayName', '<=', queryCap + '\uf8ff'),
				limit(5)
			),
			query(
				collection(db, 'users'),
				where('name', '>=', queryLower),
				where('name', '<=', queryLower + '\uf8ff'),
				limit(5)
			)
		];

		for (const q of queries) {
			const snapshot = await getDocs(q);
			snapshot.docs.forEach((d) => {
				if (!seenIds.has(d.id)) {
					seenIds.add(d.id);
					allResults.push({ id: d.id, ...d.data() } as AppUser);
				}
			});
			if (allResults.length >= 5) break;
		}

		return allResults.slice(0, 5);
	} catch (e) {
		console.error('Error searching users by name:', e);
		return [];
	}
}

export async function getRecentClients(limitCount: number = 20): Promise<AppUser[]> {
	try {
		// Fetch a batch of users. 
		// We fetch a bit more and filter in memory to avoid needing complex Firestore indexes for 'role'.
		const q = query(collection(db, 'users'), limit(limitCount * 2));
		const snapshot = await getDocs(q);
		const clients = snapshot.docs
			.map((d) => ({ id: d.id, ...d.data() } as AppUser))
			.filter(u => u.role !== 'admin' && u.role !== 'staff')
			.slice(0, limitCount);
			
		return clients;
	} catch (e) {
		console.error('Error fetching recent clients:', e);
		return [];
	}
}

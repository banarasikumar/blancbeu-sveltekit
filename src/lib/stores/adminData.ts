import { writable, derived } from 'svelte/store';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '$lib/firebase';

// --- Types ---
export interface Booking {
	id: string;
	status: string;
	userName?: string;
	userEmail?: string;
	userPhone?: string;
	userPhoto?: string;
	date?: any;
	time?: string;
	services?: string;
	service?: string;
	serviceName?: string;
	servicesList?: any[];
	notes?: string;
	createdAt?: any;
	updatedAt?: string;
	// Timer fields
	timerStart?: number; // timestamp in ms when timer was last started/resumed
	timerElapsed?: number; // total accumulated seconds before current start
	isTimerRunning?: boolean;
	[key: string]: any;
}

export interface AppUser {
	id: string;
	displayName?: string;
	name?: string;
	fullName?: string;
	email?: string;
	phone?: string;
	phoneNumber?: string;
	mobile?: string;
	photoURL?: string;
	photo?: string;
	avatar?: string;
	image?: string;
	role?: string;
	[key: string]: any;
}

export interface Service {
	id: string;
	name: string;
	category: string;
	price: number;
	originalPrice?: number;
	duration: number; // in minutes
	description?: string;
	image?: string;
	isActive?: boolean;
	createdAt?: any;
	updatedAt?: string;
	[key: string]: any;
}

// --- Stores ---
export const allBookings = writable<Booking[]>([]);
export const allUsers = writable<AppUser[]>([]);
export const allServices = writable<Service[]>([]);

// Derived stats
export const bookingCount = derived(allBookings, ($b) => $b.length);
export const pendingCount = derived(
	allBookings,
	($b) => $b.filter((b) => (b.status || 'pending').toLowerCase() === 'pending').length
);
export const userCount = derived(allUsers, ($u) => $u.length);
export const serviceCount = derived(allServices, ($s) => $s.length);

// --- Listeners ---
let bookingsUnsub: (() => void) | null = null;
let usersUnsub: (() => void) | null = null;
let servicesUnsub: (() => void) | null = null;

export function initBookingListener() {
	if (bookingsUnsub) return;
	console.log('[AdminData] Starting booking listener');

	const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
	bookingsUnsub = onSnapshot(
		q,
		(snapshot) => {
			const bookings = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as Booking[];
			allBookings.set(bookings);
		},
		(error) => {
			console.error('[AdminData] Booking listener error:', error);
		}
	);
}

export function initUserListener() {
	if (usersUnsub) return;
	console.log('[AdminData] Starting user listener');

	const q = query(collection(db, 'users'));
	usersUnsub = onSnapshot(
		q,
		(snapshot) => {
			const users = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as AppUser[];
			allUsers.set(users);
		},
		(error) => {
			console.error('[AdminData] User listener error:', error);
		}
	);
}

export function initServiceListener() {
	if (servicesUnsub) return;
	console.log('[AdminData] Starting service listener');

	const q = query(collection(db, 'services'));
	servicesUnsub = onSnapshot(
		q,
		(snapshot) => {
			const services = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as Service[];
			allServices.set(services);
		},
		(error) => {
			console.error('[AdminData] Service listener error:', error);
		}
	);
}

export function destroyListeners() {
	if (bookingsUnsub) {
		bookingsUnsub();
		bookingsUnsub = null;
	}
	if (usersUnsub) {
		usersUnsub();
		usersUnsub = null;
	}
	if (servicesUnsub) {
		servicesUnsub();
		servicesUnsub = null;
	}
}

// --- Status Update ---
export async function updateBookingStatus(bookingId: string, newStatus: string): Promise<void> {
	await updateDoc(doc(db, 'bookings', bookingId), {
		status: newStatus,
		updatedAt: new Date().toISOString()
	});
}

export async function updateBookingDetails(
	bookingId: string,
	details: Partial<Booking>
): Promise<void> {
	await updateDoc(doc(db, 'bookings', bookingId), {
		...details,
		updatedAt: new Date().toISOString()
	});
}

// --- Helpers ---
export function formatFirestoreDate(dateField: any): string {
	if (!dateField) return 'N/A';

	if (dateField.seconds) {
		return new Date(dateField.seconds * 1000).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	const d = new Date(dateField);
	if (!isNaN(d.getTime())) {
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	return String(dateField);
}

export function getBookingTimestamp(b: Booking): number {
	if (b.date) {
		if (b.date.seconds) return b.date.seconds * 1000;
		if (typeof b.date === 'string' && b.date.includes('-')) {
			const parts = b.date.split('-');
			if (parts.length === 3 && parts[2].length === 4) {
				return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
			}
		}
		return new Date(b.date).getTime();
	}
	return b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
}

export function formatRelativeTime(dateField: any): string {
	if (!dateField) return '';
	let dateObj: Date;
	if (dateField.seconds) dateObj = new Date(dateField.seconds * 1000);
	else dateObj = new Date(dateField);
	if (isNaN(dateObj.getTime())) return '';

	const now = new Date();
	const diff = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
	const exact = dateObj.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});

	let relative = '';
	if (diff < 60) relative = 'Just now';
	else if (diff < 3600) relative = `${Math.floor(diff / 60)}m ago`;
	else if (diff < 86400) relative = `${Math.floor(diff / 3600)}h ago`;
	else relative = `${Math.floor(diff / 86400)}d ago`;

	return `${exact} (${relative})`;
}

export function calculateCountdown(
	dateField: any,
	timeStr: string | undefined
): { label: string; isOverdue: boolean } | null {
	if (!dateField || !timeStr) return null;

	let targetDate: Date;
	if (dateField.seconds) {
		targetDate = new Date(dateField.seconds * 1000);
	} else if (typeof dateField === 'string' && dateField.includes('-')) {
		const parts = dateField.split('-');
		if (parts.length === 3 && parts[2].length === 4)
			targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
		else targetDate = new Date(dateField);
	} else {
		targetDate = new Date(dateField);
	}

	if (isNaN(targetDate.getTime())) return null;

	const [time, modifier] = timeStr.split(' ');
	let [hours, minutes] = time.split(':').map(Number);
	if (hours === 12) hours = 0;
	if (modifier === 'PM') hours += 12;
	targetDate.setHours(hours, minutes, 0, 0);

	const diffMs = targetDate.getTime() - Date.now();
	if (diffMs < 0) return { label: 'Overdue', isOverdue: true };

	const diffHours = diffMs / (1000 * 60 * 60);
	const diffDays = diffHours / 24;

	let label = '';
	if (diffDays >= 1) label = `in ${Math.floor(diffDays)} days`;
	else if (diffHours >= 1) label = `in ${Math.floor(diffHours)} hours`;
	else label = `in ${Math.floor(diffMs / (1000 * 60))} mins`;

	return { label, isOverdue: false };
}

export function getUserDisplayName(user: AppUser): string {
	return user.displayName || user.name || user.fullName || 'Guest User';
}

export function getUserPhoto(user: AppUser): string | null {
	return user.photoURL || user.photo || user.avatar || user.image || null;
}

export function getUserPhone(user: AppUser): string | null {
	return user.phone || user.phoneNumber || user.mobile || null;
}

export function getBookingDateTime(b: Booking): Date | null {
	if (!b.date) return null;

	let targetDate: Date;
	// 1. Parse Date
	if (b.date.seconds) {
		targetDate = new Date(b.date.seconds * 1000);
	} else if (typeof b.date === 'string' && b.date.includes('-')) {
		const parts = b.date.split('-');
		if (parts.length === 3 && parts[2].length === 4) {
			// DD-MM-YYYY
			targetDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
		} else {
			targetDate = new Date(b.date);
		}
	} else {
		targetDate = new Date(b.date);
	}

	if (isNaN(targetDate.getTime())) return null;

	// 2. Parse Time (if exists)
	if (b.time) {
		const [timePart, modifier] = b.time.split(' ');
		if (timePart) {
			let [hours, minutes] = timePart.split(':').map(Number);
			if (!isNaN(hours) && !isNaN(minutes)) {
				if (hours === 12) hours = 0;
				if (modifier === 'PM') hours += 12;
				targetDate.setHours(hours, minutes, 0, 0);
			}
		}
	} else {
		// If no time is specified, maybe default to end of day?
		// Or start of day? For auto-cancel, we should be conservative.
		// Let's assume start of day (00:00) if no time, so 24h later means
		// 00:00 next day.
		targetDate.setHours(0, 0, 0, 0);
	}

	return targetDate;
}

import { writable, derived } from 'svelte/store';
import {
	collection,
	doc,
	setDoc,
	deleteDoc,
	onSnapshot,
	query,
	orderBy,
	writeBatch,
	getDocs,
	where,
	Timestamp
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Booking } from './adminData';

export interface RecycledBooking extends Booking {
	deletedAt: string; // ISO string
	deletedBy: string; // admin uid
	originalId: string;
}

// --- Store ---
export const recycledBookings = writable<RecycledBooking[]>([]);
export const recycledCount = derived(recycledBookings, ($r) => $r.length);

let unsub: (() => void) | null = null;

// --- Listener ---
export function initRecycleBinListener() {
	if (unsub) return;
	console.log('[RecycleBin] Starting listener');

	const q = query(collection(db, 'recycledBookings'), orderBy('deletedAt', 'desc'));
	unsub = onSnapshot(
		q,
		(snapshot) => {
			const items = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as RecycledBooking[];
			recycledBookings.set(items);
		},
		(error) => {
			console.error('[RecycleBin] Listener error:', error);
		}
	);
}

export function destroyRecycleBinListener() {
	if (unsub) {
		unsub();
		unsub = null;
	}
}

// Helper: strip undefined values (Firestore rejects them)
function stripUndefined(obj: Record<string, any>): Record<string, any> {
	const clean: Record<string, any> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) {
			clean[key] = value;
		}
	}
	return clean;
}

// --- Soft Delete (move bookings to recycle bin) ---
export async function softDeleteBookings(
	bookings: Booking[],
	adminUid: string
): Promise<{ deleted: number; errors: number }> {
	let deleted = 0;
	let errors = 0;
	const batch = writeBatch(db);
	const now = new Date().toISOString();

	for (const booking of bookings) {
		try {
			const raw: Record<string, any> = {
				...booking,
				originalId: booking.id,
				deletedAt: now,
				deletedBy: adminUid
			};
			delete raw.id;
			const recycledData = stripUndefined(raw);

			const recycleRef = doc(db, 'recycledBookings', booking.id);
			batch.set(recycleRef, recycledData);

			const bookingRef = doc(db, 'bookings', booking.id);
			batch.delete(bookingRef);

			deleted++;
		} catch (e) {
			console.error('[RecycleBin] Error preparing booking:', booking.id, e);
			errors++;
		}
	}

	try {
		await batch.commit();
		console.log(`[RecycleBin] Batch committed: ${deleted} deleted`);
	} catch (e) {
		console.error('[RecycleBin] Batch commit failed:', e);
		return { deleted: 0, errors: bookings.length };
	}

	return { deleted, errors };
}

// --- Restore bookings from recycle bin ---
export async function restoreBookings(
	items: RecycledBooking[]
): Promise<{ restored: number; errors: number }> {
	let restored = 0;
	let errors = 0;
	const batch = writeBatch(db);

	for (const item of items) {
		try {
			const originalData: Record<string, any> = { ...item };
			const originalId = item.originalId || item.id;

			// Remove recycle-bin metadata
			delete originalData.deletedAt;
			delete originalData.deletedBy;
			delete originalData.originalId;
			delete originalData.id;

			const bookingRef = doc(db, 'bookings', originalId);
			batch.set(bookingRef, originalData);

			const recycleRef = doc(db, 'recycledBookings', item.id);
			batch.delete(recycleRef);

			restored++;
		} catch {
			errors++;
		}
	}

	try {
		await batch.commit();
	} catch (e) {
		console.error('[RecycleBin] Restore batch failed:', e);
		return { restored: 0, errors: items.length };
	}

	return { restored, errors };
}

// --- Permanently delete from recycle bin ---
export async function permanentlyDelete(
	items: RecycledBooking[]
): Promise<{ deleted: number; errors: number }> {
	let deleted = 0;
	let errors = 0;
	const batch = writeBatch(db);

	for (const item of items) {
		try {
			const recycleRef = doc(db, 'recycledBookings', item.id);
			batch.delete(recycleRef);
			deleted++;
		} catch {
			errors++;
		}
	}

	try {
		await batch.commit();
	} catch (e) {
		console.error('[RecycleBin] Permanent delete batch failed:', e);
		return { deleted: 0, errors: items.length };
	}

	return { deleted, errors };
}

// --- Auto-cleanup: remove items older than 30 days ---
export async function cleanupExpiredItems(): Promise<number> {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const cutoff = thirtyDaysAgo.toISOString();

	try {
		const q = query(
			collection(db, 'recycledBookings'),
			where('deletedAt', '<', cutoff)
		);
		const snapshot = await getDocs(q);

		if (snapshot.empty) return 0;

		const batch = writeBatch(db);
		snapshot.docs.forEach((d) => {
			batch.delete(d.ref);
		});
		await batch.commit();

		console.log(`[RecycleBin] Auto-cleaned ${snapshot.size} expired items`);
		return snapshot.size;
	} catch (e) {
		console.error('[RecycleBin] Auto-cleanup failed:', e);
		return 0;
	}
}

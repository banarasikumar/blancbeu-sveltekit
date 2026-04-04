import { db } from '$lib/firebase';
import {
	collection,
	query,
	where,
	getDocs,
	addDoc,
	updateDoc,
	doc,
	writeBatch,
	serverTimestamp,
	limit
} from 'firebase/firestore';

export interface WalkInAccountData {
	name: string;
	phone?: string;
	email?: string;
	gender?: string;
	notes?: string;
	createdBy?: string;
}

// Normalize phone to last 10 digits
function normalizePhone(phone: string): string {
	return phone.replace(/\D/g, '').slice(-10);
}

// Create a new walk-in shadow account in Firestore
export async function createWalkInAccount(data: WalkInAccountData): Promise<string> {
	const phone = data.phone ? normalizePhone(data.phone) : undefined;
	const docRef = await addDoc(collection(db, 'users'), {
		...data,
		...(phone ? { phone: `+91${phone}` } : {}),
		accountType: 'walkin',
		accountStatus: 'shadow',
		profileCompleted: false,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp()
	});
	return docRef.id;
}

// Find an existing shadow walk-in account by phone number
export async function findWalkInByPhone(
	phone: string
): Promise<{ id: string; [key: string]: any } | null> {
	const digits = normalizePhone(phone);
	const formats = [digits, `+91${digits}`];

	for (const fmt of formats) {
		const q = query(
			collection(db, 'users'),
			where('accountType', '==', 'walkin'),
			where('accountStatus', '==', 'shadow'),
			where('phone', '==', fmt),
			limit(1)
		);
		const snap = await getDocs(q);
		if (!snap.empty) {
			const d = snap.docs[0];
			return { id: d.id, ...d.data() };
		}
	}
	return null;
}

// Find or create a walk-in account (by phone); returns the walk-in document ID
export async function findOrCreateWalkIn(data: WalkInAccountData): Promise<string> {
	if (data.phone) {
		const existing = await findWalkInByPhone(data.phone);
		if (existing) return existing.id;
	}
	return createWalkInAccount(data);
}

// Find all shadow walk-in accounts matching a phone or email
export async function findWalkInsForUser(phone?: string, email?: string): Promise<string[]> {
	const ids: string[] = [];
	const seenIds = new Set<string>();

	if (phone) {
		const digits = normalizePhone(phone);
		const formats = [digits, `+91${digits}`];

		for (const fmt of formats) {
			const q = query(
				collection(db, 'users'),
				where('accountType', '==', 'walkin'),
				where('accountStatus', '==', 'shadow'),
				where('phone', '==', fmt),
				limit(5)
			);
			const snap = await getDocs(q);
			snap.docs.forEach((d) => {
				if (!seenIds.has(d.id)) {
					seenIds.add(d.id);
					ids.push(d.id);
				}
			});
		}
	}

	if (email) {
		const q = query(
			collection(db, 'users'),
			where('accountType', '==', 'walkin'),
			where('accountStatus', '==', 'shadow'),
			where('email', '==', email),
			limit(5)
		);
		const snap = await getDocs(q);
		snap.docs.forEach((d) => {
			if (!seenIds.has(d.id)) {
				seenIds.add(d.id);
				ids.push(d.id);
			}
		});
	}

	return ids;
}

// Merge a single walk-in account into a newly registered user account
// - Marks the walk-in doc as 'merged'
// - Re-assigns all bookings linked to the walk-in ID to the new UID
export async function mergeWalkInAccount(walkInId: string, newUid: string): Promise<void> {
	const batch = writeBatch(db);

	batch.update(doc(db, 'users', walkInId), {
		accountStatus: 'merged',
		mergedIntoUid: newUid,
		mergedAt: serverTimestamp()
	});

	const bookingsSnap = await getDocs(
		query(collection(db, 'bookings'), where('userId', '==', walkInId))
	);
	bookingsSnap.docs.forEach((d) => {
		batch.update(d.ref, { userId: newUid });
	});

	await batch.commit();
}

// Merge ALL matching walk-in accounts into the new user; returns count merged
export async function mergeAllWalkIns(
	newUid: string,
	phone?: string,
	email?: string
): Promise<number> {
	const walkInIds = await findWalkInsForUser(phone, email);

	for (const walkInId of walkInIds) {
		await mergeWalkInAccount(walkInId, newUid);
	}

	if (walkInIds.length > 0) {
		await updateDoc(doc(db, 'users', newUid), {
			walkInMergedFrom: walkInIds,
			walkInMergedAt: serverTimestamp()
		});
	}

	return walkInIds.length;
}

import { writable, derived } from 'svelte/store';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '$lib/firebase';
import type { User } from 'firebase/auth';

export type StaffAuthState = 'loading' | 'unauthenticated' | 'checking' | 'authorized' | 'denied';

// Staff emails that automatically get staff role (for testing/initial setup)
const ALLOWED_STAFF_EMAILS = [
	'banarasikumarsahu@gmail.com',
	'banz3949@gmail.com',
	'blancbeu07@gmail.com',
	'rinak2645@gmail.com'
];

// Staff phone numbers that automatically get staff role
const ALLOWED_STAFF_PHONES = ['+919798222154', '+917004574629', '+918210966131'];

export const staffUser = writable<User | null>(null);
export const staffAuthState = writable<StaffAuthState>('loading');
export const isStaff = derived(staffAuthState, ($state) => $state === 'authorized');

let unsubscribeAuth: (() => void) | null = null;

/**
 * Verify if a user has staff role in Firestore
 */
async function verifyStaffRole(uid: string, email: string | null): Promise<boolean> {
	try {
		const docRef = doc(db, 'users', uid);
		const docSnap = await getDoc(docRef);

		// Extract phone from uid if user logged in via WhatsApp
		// Magic link users have uids like: "wa:+919229915277"
		let phone = null;
		if (uid.startsWith('wa:')) {
			phone = uid.replace('wa:', '');
		}

		if (docSnap.exists()) {
			const data = docSnap.data();
			// Check for 'staff' or 'admin' role (admins should also access staff app)
			if (data.role === 'staff' || data.role === 'admin') return true;

			// Auto-promote allowed emails
			if (email && ALLOWED_STAFF_EMAILS.includes(email)) {
				await setDoc(docRef, { role: 'staff' }, { merge: true });
				return true;
			}

			// Auto-promote allowed phones
			if (phone && ALLOWED_STAFF_PHONES.includes(phone)) {
				await setDoc(docRef, { role: 'staff' }, { merge: true });
				return true;
			}
		} else {
			// User doc doesn't exist — check allowed emails
			if (email && ALLOWED_STAFF_EMAILS.includes(email)) {
				await setDoc(
					docRef,
					{
						email,
						role: 'staff',
						createdAt: new Date().toISOString()
					},
					{ merge: true }
				);
				return true;
			}

			// User doc doesn't exist — check allowed phones
			if (phone && ALLOWED_STAFF_PHONES.includes(phone)) {
				await setDoc(
					docRef,
					{
						phone,
						role: 'staff',
						createdAt: new Date().toISOString()
					},
					{ merge: true }
				);
				return true;
			}
		}
		return false;
	} catch (e) {
		console.error('[StaffAuth] Error verifying staff role:', e);
		return false;
	}
}

/**
 * Initialize staff auth listener
 */
export function initStaffAuth() {
	if (unsubscribeAuth) return; // Already initialized

	unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
		console.log('[StaffAuth] Auth state changed:', user ? user.uid : 'null');
		if (user) {
			staffUser.set(user);
			staffAuthState.set('checking');

			const hasAccess = await verifyStaffRole(user.uid, user.email);
			if (hasAccess) {
				staffAuthState.set('authorized');
			} else {
				staffAuthState.set('denied');
				// Sign out non-staff users? Or just deny access?
				// Let's sign out to prevent confusion
				await signOut(auth);
				staffUser.set(null);
			}
		} else {
			staffUser.set(null);
			staffAuthState.set('unauthenticated');
		}
	});
}

/**
 * Sign in with Google
 */
export async function staffSignIn(): Promise<void> {
	const provider = new GoogleAuthProvider();
	try {
		await signInWithPopup(auth, provider);
	} catch (error: any) {
		console.error('[StaffAuth] Login failed:', error);
		throw error;
	}
}

/**
 * Sign out
 */
export async function staffLogout(): Promise<void> {
	try {
		console.log('[StaffAuth] Signing out...');
		await signOut(auth);
		console.log('[StaffAuth] Sign out complete');
		staffUser.set(null);
		staffAuthState.set('unauthenticated');
	} catch (error: any) {
		console.error('[StaffAuth] Logout failed:', error);
		throw error;
	}
}

/**
 * Cleanup
 */
export function destroyStaffAuth() {
	if (unsubscribeAuth) {
		unsubscribeAuth();
		unsubscribeAuth = null;
	}
}

import { writable, derived } from 'svelte/store';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
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
let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Verify if a user has staff role in Firestore
 */
async function verifyStaffRole(uid: string, email: string | null): Promise<boolean> {
	// Extract phone from uid if user logged in via WhatsApp
	// Magic link users have uids like: "wa:+919229915277"
	const phone = uid.startsWith('wa:') ? uid.replace('wa:', '') : null;

	// Fast path: grant access immediately if email/phone is in the allowed list.
	// Firestore promotion runs in the background so a DB error never blocks login.
	if (email && ALLOWED_STAFF_EMAILS.includes(email)) {
		const docRef = doc(db, 'users', uid);
		setDoc(docRef, { email, role: 'staff' }, { merge: true }).catch((e) =>
			console.warn('[StaffAuth] Background promote failed:', e)
		);
		return true;
	}

	if (phone && ALLOWED_STAFF_PHONES.includes(phone)) {
		const docRef = doc(db, 'users', uid);
		setDoc(docRef, { phone, role: 'staff' }, { merge: true }).catch((e) =>
			console.warn('[StaffAuth] Background promote failed:', e)
		);
		return true;
	}

	// Slow path: check Firestore for an existing staff/admin role
	try {
		const docRef = doc(db, 'users', uid);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			const data = docSnap.data();
			// Check for 'staff' or 'admin' role (admins should also access staff app)
			if (data.role === 'staff' || data.role === 'admin') return true;
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
export async function initStaffAuth() {
	if (unsubscribeAuth) return; // Already initialized

	console.log('[StaffAuth] Initializing auth listener...');

	// Handle any pending redirect sign-in result (fallback from popup-blocked)
	getRedirectResult(auth).catch((err) => {
		console.error('[StaffAuth] Redirect result error:', err);
	});

	// Wait for Firebase to restore auth state from IndexedDB (up to 15 s).
	// This avoids the old 3-second timeout that falsely logged users out on
	// slow cold starts (especially PWAs reopened after being swiped away).
	try {
		await Promise.race([
			(auth as any).authStateReady(),
			new Promise((_, reject) => setTimeout(() => reject(new Error('Auth state ready timeout')), 15000))
		]);
		const restoredUser = auth.currentUser;
		console.log('[StaffAuth] Auth state ready, user:', restoredUser?.uid || 'null');

		if (restoredUser) {
			staffUser.set(restoredUser);
			staffAuthState.set('checking');
			const hasAccess = await verifyStaffRole(restoredUser.uid, restoredUser.email);
			if (hasAccess) {
				staffAuthState.set('authorized');
			} else {
				staffAuthState.set('denied');
				await signOut(auth);
				staffUser.set(null);
			}
		} else {
			staffUser.set(null);
			staffAuthState.set('unauthenticated');
		}
	} catch (err) {
		console.error('[StaffAuth] Auth initialization timeout:', err);
		staffAuthState.set('unauthenticated');
	}

	// Set up listener for future auth state changes (login / logout)
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
		if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
			console.warn('[StaffAuth] Popup blocked or closed, falling back to redirect...');
			await signInWithRedirect(auth, provider);
			return;
		}
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
	if (loadingTimeout) {
		clearTimeout(loadingTimeout);
		loadingTimeout = null;
	}
	if (unsubscribeAuth) {
		unsubscribeAuth();
		unsubscribeAuth = null;
	}
}

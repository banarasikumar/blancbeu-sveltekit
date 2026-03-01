import { writable, derived } from 'svelte/store';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '$lib/firebase';
import type { User } from 'firebase/auth';

export type AdminAuthState = 'loading' | 'unauthenticated' | 'checking' | 'authorized' | 'denied';

// Super admin emails that automatically get admin role
const SUPER_ADMINS = [
	'banarasikumarsahu@gmail.com',
	'banz3949@gmail.com',
	'blancbeu07@gmail.com',
	'rinak2645@gmail.com'
];

// Super admin phone numbers that automatically get admin role
const SUPER_ADMIN_PHONES = ['+919798222154', '+917004574629'];

export const adminUser = writable<User | null>(null);
export const adminAuthState = writable<AdminAuthState>('loading');
export const isAdmin = derived(adminAuthState, ($state) => $state === 'authorized');

let unsubscribeAuth: (() => void) | null = null;

/**
 * Verify if a user has admin role in Firestore
 */
async function verifyAdminRole(uid: string, email: string | null): Promise<boolean> {
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
			if (data.role === 'admin') return true;

			// Super admin auto-promotion by email
			if (email && SUPER_ADMINS.includes(email)) {
				await setDoc(docRef, { role: 'admin' }, { merge: true });
				return true;
			}

			// Super admin auto-promotion by phone
			if (phone && SUPER_ADMIN_PHONES.includes(phone)) {
				await setDoc(docRef, { role: 'admin' }, { merge: true });
				return true;
			}
		} else {
			// User doc doesn't exist — check super admin by email
			if (email && SUPER_ADMINS.includes(email)) {
				await setDoc(
					docRef,
					{
						email,
						role: 'admin',
						createdAt: new Date().toISOString()
					},
					{ merge: true }
				);
				return true;
			}

			// User doc doesn't exist — check super admin by phone
			if (phone && SUPER_ADMIN_PHONES.includes(phone)) {
				await setDoc(
					docRef,
					{
						phone,
						role: 'admin',
						createdAt: new Date().toISOString()
					},
					{ merge: true }
				);
				return true;
			}
		}
		return false;
	} catch (e) {
		console.error('[AdminAuth] Error verifying admin role:', e);
		return false;
	}
}

/**
 * Initialize admin auth listener
 */
export function initAdminAuth() {
	if (unsubscribeAuth) return; // Already initialized

	unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
		if (user) {
			adminUser.set(user);
			adminAuthState.set('checking');

			const hasAccess = await verifyAdminRole(user.uid, user.email);
			if (hasAccess) {
				adminAuthState.set('authorized');
			} else {
				adminAuthState.set('denied');
				// Sign out non-admin users
				await signOut(auth);
				adminUser.set(null);
			}
		} else {
			adminUser.set(null);
			adminAuthState.set('unauthenticated');
		}
	});
}

/**
 * Sign in with Google
 */
export async function adminSignIn(): Promise<void> {
	const provider = new GoogleAuthProvider();
	try {
		await signInWithPopup(auth, provider);
		// Auth state change will handle the rest
	} catch (error: any) {
		console.error('[AdminAuth] Login failed:', error);
		throw error;
	}
}

/**
 * Sign out
 */
export async function adminLogout(): Promise<void> {
	try {
		await signOut(auth);
		adminUser.set(null);
		adminAuthState.set('unauthenticated');
	} catch (error: any) {
		console.error('[AdminAuth] Logout failed:', error);
		throw error;
	}
}

/**
 * Cleanup
 */
export function destroyAdminAuth() {
	if (unsubscribeAuth) {
		unsubscribeAuth();
		unsubscribeAuth = null;
	}
}

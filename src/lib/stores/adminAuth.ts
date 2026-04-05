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

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => 
			setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
		)
	]);
}

/**
 * Verify if a user has admin role in Firestore
 */
async function verifyAdminRole(uid: string, email: string | null): Promise<boolean> {
	console.log('[AdminAuth] Starting admin role verification for:', email || uid);
	
	// Extract phone from uid if user logged in via WhatsApp
	const phone = uid.startsWith('wa:') ? uid.replace('wa:', '') : null;

	// Fast path: grant access immediately if email/phone is in the super admin list.
	// Firestore promotion runs in the background so a DB error never blocks login.
	if (email && SUPER_ADMINS.includes(email)) {
		const docRef = doc(db, 'users', uid);
		setDoc(docRef, { email, role: 'admin' }, { merge: true }).catch((e) =>
			console.error('[AdminAuth] Background admin promotion failed:', e)
		);
		console.log('[AdminAuth] Super admin email match - access granted');
		return true;
	}

	if (phone && SUPER_ADMIN_PHONES.includes(phone)) {
		const docRef = doc(db, 'users', uid);
		setDoc(docRef, { phone, role: 'admin' }, { merge: true }).catch((e) =>
			console.error('[AdminAuth] Background admin promotion failed:', e)
		);
		console.log('[AdminAuth] Super admin phone match - access granted');
		return true;
	}

	// Check existing role in Firestore (for non-super-admins)
	try {
		const docRef = doc(db, 'users', uid);
		const docSnap = await withTimeout(getDoc(docRef), 10000, 'Firestore getDoc');

		if (docSnap.exists()) {
			const data = docSnap.data();
			if (data.role === 'admin') {
				console.log('[AdminAuth] User has admin role in DB - access granted');
				return true;
			}
		}
		console.log('[AdminAuth] No admin role found - access denied');
		return false;
	} catch (e: any) {
		console.error('[AdminAuth] Error checking admin role:', e.message);
		return false;
	}
}

/**
 * Initialize admin auth listener
 */
export async function initAdminAuth() {
	if (unsubscribeAuth) return; // Already initialized

	console.log('[AdminAuth] Initializing auth listener...');
	const initStartTime = performance.now();

	// Use authStateReady() for faster initialization (Firebase 9.22+)
	// This resolves immediately when auth state is known
	try {
		await withTimeout((auth as any).authStateReady(), 15000, 'Auth state ready');
		const user = auth.currentUser;
		const timeToReady = (performance.now() - initStartTime).toFixed(2);
		console.log(`[AdminAuth] Auth state ready after ${timeToReady}ms, user:`, user?.email || user?.uid || 'null');
		
		if (user) {
			adminUser.set(user);
			adminAuthState.set('checking');

			const hasAccess = await verifyAdminRole(user.uid, user.email);
			if (hasAccess) {
				adminAuthState.set('authorized');
			} else {
				adminAuthState.set('denied');
				await signOut(auth);
				adminUser.set(null);
			}
		} else {
			adminUser.set(null);
			adminAuthState.set('unauthenticated');
		}
	} catch (timeoutError) {
		console.error('[AdminAuth] Auth initialization timeout:', timeoutError);
		adminAuthState.set('unauthenticated');
	}

	// Set up listener for future auth state changes
	unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
		console.log('[AdminAuth] Auth state changed, user:', user?.email || user?.uid || 'null');
		
		if (user) {
			adminUser.set(user);
			adminAuthState.set('checking');

			const hasAccess = await verifyAdminRole(user.uid, user.email);
			if (hasAccess) {
				adminAuthState.set('authorized');
			} else {
				adminAuthState.set('denied');
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

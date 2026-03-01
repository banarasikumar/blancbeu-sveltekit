import { auth, db } from '$lib/firebase';
import {
	signInWithPopup,
	signInWithRedirect,
	getRedirectResult,
	GoogleAuthProvider,
	signOut,
	signInWithCustomToken
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { showToast } from '$lib/stores/toast';
import { goto } from '$app/navigation';
import { browser } from '$app/environment';

const WHATSAPP_NUMBER = '919229915277';
const WHATSAPP_MESSAGE = '*Hi BlancBeu, please help me log in.*';
const BOT_SECRET_KEY = 'X9vP2kL5jM8zQ4wN7cR3bT1f';

// The bot will look for the text. We can optionally append an identifier
// for the app type, e.g. "App: staff" so the bot can send it back to `/api/consume`.
// Right now, the bot just sends the token back. The user ends up at /login?token=...
// And checkMagicLink() intercepts it.

// --- Google Login with Popup/Redirect Fallback ---
export async function handleGoogleLogin(): Promise<boolean> {
	const provider = new GoogleAuthProvider();

	try {
		const result = await signInWithPopup(auth, provider);
		await handleLoginSuccess(result.user);
		return true;
	} catch (error: any) {
		console.error('Google Login Error:', error);

		// Handle Popup Blocking -> Fallback to Redirect
		if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
			console.warn('Popup blocked or closed. Falling back to redirect...');
			showToast('Redirecting to Google Sign In... 🔄', 'success');

			try {
				await signInWithRedirect(auth, provider);
				return true;
			} catch (redirectError: any) {
				console.error('Redirect Login Failed:', redirectError);
				showToast(`Login failed: ${redirectError.message}`, 'error');
				return false;
			}
		}

		// Handle specific errors
		let errorMessage = `Login failed: ${error.message}`;

		if (error.code === 'auth/unauthorized-domain') {
			errorMessage = 'Login Failed: Domain not authorized in Firebase Console.';
		} else if (error.code === 'auth/configuration-not-found') {
			errorMessage = 'Login Failed: Firebase config missing.';
		} else if (error.message?.includes('origin')) {
			errorMessage = `Origin mismatch. Check Firebase Console.`;
		}

		showToast(errorMessage, 'error');
		return false;
	}
}

// --- Check for Redirect Result (call on page load) ---
export async function checkRedirectLogin(): Promise<void> {
	if (!browser) return;

	try {
		const result = await getRedirectResult(auth);
		if (result) {
			console.log('Redirect Login Successful:', result.user);
			await handleLoginSuccess(result.user);
		}
	} catch (error: any) {
		console.error('Redirect Login Error:', error);
		if (error.code !== 'auth/popup-closed-by-user') {
			showToast(`Login failed: ${error.message}`, 'error');
		}
	}
}

// --- WhatsApp Login (Deep Link) ---
export async function handleWhatsAppLogin(
	appType: 'user' | 'staff' | 'admin' = 'user'
): Promise<void> {
	// 1. Format the App Type (e.g. 'staff' -> 'Staff')
	const formattedAppType = appType.charAt(0).toUpperCase() + appType.slice(1);

	// 2. Generate Timestamp and Token
	const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
	// Link the formatted App Type, Timestamp, and Secret Key directly into the hash
	const dataString = `${formattedAppType}+${timestamp}+${BOT_SECRET_KEY}`;

	// Generate SHA-256 hash using Web Crypto API
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(dataString);
	const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));

	// Convert to hex and truncate to the first 8 characters for a better WhatsApp experience
	const fullToken = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	const shortToken = fullToken.substring(0, 8);

	// 3. Build the message
	let message = WHATSAPP_MESSAGE;
	if (appType !== 'user') {
		message += `\n\nApp: ${formattedAppType}`;
	}
	message += `\nToken: ${timestamp}-${shortToken}`;
	message += '\n\n_Send this message without editing_';

	const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

	// Open WhatsApp
	window.open(url, '_blank');

	// Show notification
	showToast('Check WhatsApp for your login link! 📱', 'success');

	// Redirect home after delay
	setTimeout(() => {
		goto('/');
	}, 2000);
}

// --- Handle Successful Login ---
async function handleLoginSuccess(user: any): Promise<void> {
	console.log('User logged in:', user.uid);

	// Step 1: Check if user profile exists in Firestore
	let isNewUser = false;
	let profileComplete = false;
	let userName = user.displayName || '';

	try {
		const userRef = doc(db, 'users', user.uid);
		const userDoc = await getDoc(userRef);

		isNewUser = !userDoc.exists();

		if (!isNewUser) {
			const userData = userDoc.data();
			// Profile is complete if:
			// 1. profileCompleted flag is true, OR
			// 2. User has existing name AND dob (for legacy users without the flag)
			const hasProfileData = userData?.name && userData?.dob;
			profileComplete = userData?.profileCompleted === true || !!hasProfileData;
			userName = userData?.name || user.displayName || 'Member';
		}
	} catch (readError) {
		console.error('Error reading user profile:', readError);
		// If we can't read the profile, assume existing user and go to /you
		// This prevents the "Almost There" page from showing incorrectly
		showToast(`Welcome back, ${user.displayName || 'Member'}! ✨`, 'success');
		handleLoginRedirect();
		return;
	}

	// Step 2: Save/update basic login info (non-blocking — don't let failures stop navigation)
	try {
		await saveUserProfile(user.uid, {
			name: user.displayName || '',
			email: user.email || '',
			photoURL: user.photoURL || '',
			provider: 'google',
			lastLogin: serverTimestamp()
		});
	} catch (saveError) {
		// Log but don't block — the user is already authenticated
		console.warn('Could not update profile data in Firestore:', saveError);
	}

	// Step 3: Route based on profile status
	if (isNewUser || !profileComplete) {
		// New user or incomplete profile → ask for extra info
		showToast('Welcome! Please complete your profile ✨', 'success');
		// Google login originates primarily from user app, but check local storage app if any?
		// Setting this to basic for now as phone/whatsapp handles staff.
		goto('/complete-profile');
	} else {
		// Existing user with complete profile → go straight to account (or originally requested page)
		showToast(`Welcome back, ${userName}! ✨`, 'success');
		handleLoginRedirect();
	}
}

// --- Save User Profile to Firestore ---
export async function saveUserProfile(uid: string, data: Record<string, any>): Promise<void> {
	try {
		const userRef = doc(db, 'users', uid);
		const userDoc = await getDoc(userRef);

		if (userDoc.exists()) {
			// Update existing user
			await setDoc(
				userRef,
				{
					...data,
					updatedAt: serverTimestamp()
				},
				{ merge: true }
			);
		} else {
			// Create new user
			await setDoc(userRef, {
				...data,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp()
			});
		}

		console.log('User profile saved:', uid);
	} catch (error) {
		console.error('Error saving user profile:', error);
		throw error;
	}
}

// --- Magic Link Handler ---
export async function checkMagicLink(
	appType: 'user' | 'staff' | 'admin' = 'user'
): Promise<boolean> {
	if (!browser) return false;

	const params = new URLSearchParams(window.location.search);
	const token = params.get('token');
	const isNewUser = params.get('isNewUser') === 'true';

	if (!token) return false;

	console.log('Found magic link token, attempting login...');

	try {
		const result = await signInWithCustomToken(auth, token);
		const user = result.user;
		console.log('Magic link login success:', user.uid);

		// Clear token from URL without refresh
		const newUrl = window.location.pathname;
		window.history.replaceState({}, document.title, newUrl);

		// Extract phone from UID (format: wa:+XXXXXXXXXXXX)
		const phone = user.uid.replace('wa:', '');

		// Check if profile is complete
		const userDoc = await getDoc(doc(db, 'users', user.uid));
		const userData = userDoc.data();

		// Profile is complete if profileCompleted flag OR user has name AND dob
		const hasProfileData = userData?.name && userData?.dob;
		const profileComplete = userData?.profileCompleted === true || hasProfileData;

		if (isNewUser || !profileComplete) {
			// New user or incomplete profile - redirect to profile completion
			showToast('Welcome! Please complete your profile ✨', 'success');
			if (appType === 'staff') {
				goto('/staff/complete-profile');
			} else if (appType === 'admin') {
				goto('/admin/complete-profile');
			} else {
				goto('/complete-profile');
			}
		} else {
			// Existing user with complete profile
			// Route to the correct dashboard based on the appType
			showToast(`Welcome back, ${userData?.name || 'Member'}! 👋`, 'success');

			if (appType === 'staff') {
				goto('/staff/dashboard'); // or handleLoginRedirect() if you want it to resume state
			} else if (appType === 'admin') {
				goto('/admin');
			} else {
				handleLoginRedirect();
			}
		}

		return true;
	} catch (error: any) {
		console.error('Magic link login error:', error);
		showToast('Login failed. The link may have expired.', 'error');
		return false;
	}
}

// --- Login State Persistence ---
export function saveLoginState(actionOrPath: string | null = null): void {
	if (!browser) return;

	let action = actionOrPath;
	let path = window.location.pathname;

	// If the argument looks like a path (starts with /), treat it as the target path
	if (actionOrPath && actionOrPath.startsWith('/')) {
		path = actionOrPath; // The current page IS the target (or we are redirecting TO it)
		action = null; // No specific action, just navigation
	}

	const state = {
		path: path,
		action: action, // e.g., 'openBookingModal' or null
		timestamp: Date.now()
	};
	localStorage.setItem('login_redirect_state', JSON.stringify(state));
	console.log('Saved login state:', state);
}

export function restoreLoginState(): void {
	// This function is called AFTER successful login/profile check
	// It should redirect if there is a saved state.
}

// Helper to actually PERFORM the redirect (called from accessible places)
export function handleLoginRedirect(): void {
	if (!browser) return;

	const stateJson = localStorage.getItem('login_redirect_state');
	if (!stateJson) {
		goto('/you');
		return;
	}

	try {
		const state = JSON.parse(stateJson);
		const fiveMinutes = 5 * 60 * 1000;

		// Expire old state
		if (Date.now() - state.timestamp > fiveMinutes) {
			localStorage.removeItem('login_redirect_state');
			goto('/you');
			return;
		}

		console.log('Restoring login state:', state);

		// 1. Navigate to the saved path (or default /you if path is login itself which shouldn't happen logic-wise but safety check)
		const targetPath = state.path && state.path !== '/login' ? state.path : '/you';

		// 2. Clear state BEFORE navigation to avoid loops, unless we need to drag action along?
		// Actually, if we navigate, the page component on target might need to read 'action'.
		// But for this specific task (redirect to booking), we just need to go there.
		// We will keep the item in localStorage for a moment if we need to trigger an action on the destination.
		// But 'restoreLoginState' was originally designed to run ON the destination?
		// Let's look at how it was used: "restoreLoginState() called in handleLoginSuccess"
		// It seems it was expected to RUN actions.

		// Let's clean up:
		// handleLoginRedirect() -> decides WHERE to go.
		// If it goes to /booking, and we had an action 'openBookingModal', /booking should handle it?
		// For now, simpler: Just go to the path.

		localStorage.removeItem('login_redirect_state'); // Clear it
		goto(targetPath);
	} catch (e) {
		console.error('Error restoring login state:', e);
		goto('/you');
	}
}

// --- Logout ---
export async function logout(): Promise<void> {
	try {
		await signOut(auth);
		showToast("See you soon! You've been logged out. 👋", 'logout');

		// Delay navigation so user sees toast
		setTimeout(() => {
			goto('/');
		}, 2000);
	} catch (error: any) {
		console.error('Logout error:', error);
		showToast('Error logging out', 'error');
	}
}

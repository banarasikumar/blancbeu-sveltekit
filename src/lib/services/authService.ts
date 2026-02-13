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
const WHATSAPP_MESSAGE = '*Hi BlancBeu, please help me log in.*\n\n_Send this message without editing_';

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
export function handleWhatsAppLogin(): void {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

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
        restoreLoginState();
        goto('/you');
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
        goto('/complete-profile');
    } else {
        // Existing user with complete profile → go straight to account
        showToast(`Welcome back, ${userName}! ✨`, 'success');
        restoreLoginState();
        goto('/you');
    }
}



// --- Save User Profile to Firestore ---
export async function saveUserProfile(uid: string, data: Record<string, any>): Promise<void> {
    try {
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            // Update existing user
            await setDoc(userRef, {
                ...data,
                updatedAt: serverTimestamp()
            }, { merge: true });
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
export async function checkMagicLink(): Promise<boolean> {
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
            goto('/complete-profile');
        } else {
            // Existing user with complete profile
            showToast(`Welcome back, ${userData?.name || 'Member'}! 👋`, 'success');
            restoreLoginState();
            goto('/you');
        }

        return true;
    } catch (error: any) {
        console.error('Magic link login error:', error);
        showToast('Login failed. The link may have expired.', 'error');
        return false;
    }
}



// --- Login State Persistence ---
export function saveLoginState(action: string | null = null): void {
    if (!browser) return;

    const state = {
        path: window.location.pathname,
        action: action,
        timestamp: Date.now()
    };
    localStorage.setItem('login_redirect_state', JSON.stringify(state));
    console.log('Saved login state:', state);
}

export function restoreLoginState(): void {
    if (!browser) return;

    const stateJson = localStorage.getItem('login_redirect_state');
    if (!stateJson) return;

    try {
        const state = JSON.parse(stateJson);
        const fiveMinutes = 5 * 60 * 1000;

        // Expire old state
        if (Date.now() - state.timestamp > fiveMinutes) {
            localStorage.removeItem('login_redirect_state');
            return;
        }

        console.log('Restoring login state:', state);

        // Handle Actions
        if (state.action === 'openBookingModal') {
            setTimeout(() => {
                // Navigate to booking page
                goto('/booking');
            }, 500);
        }

        // Cleanup
        localStorage.removeItem('login_redirect_state');
    } catch (e) {
        console.error('Error restoring login state:', e);
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

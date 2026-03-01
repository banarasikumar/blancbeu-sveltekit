import admin from 'firebase-admin';
import { env } from '$env/dynamic/private';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
	try {
		const serviceAccountRaw =
			env.FIREBASE_SERVICE_ACCOUNT_KEY ||
			process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
			env.FIREBASE_SERVICE_ACCOUNT ||
			process.env.FIREBASE_SERVICE_ACCOUNT;

		if (!serviceAccountRaw) {
			console.warn(
				'⚠️ FIREBASE_SERVICE_ACCOUNT is missing. Backend auth operations (custom token creation) will fail. Using default initialization.'
			);
			admin.initializeApp();
		} else {
			// SvelteKit env parser might keep the literal single quotes around the string: "'{...}'"
			const cleanedAccount = serviceAccountRaw.replace(/^'/, '').replace(/'$/, '');
			const serviceAccount = JSON.parse(cleanedAccount);
			admin.initializeApp({
				credential: admin.credential.cert(serviceAccount)
			});
			console.log('Firebase Admin initialized successfully with custom credentials.');
		}
	} catch (error) {
		console.error(
			'Failed to initialize Firebase Admin explicitly. Check your FIREBASE_SERVICE_ACCOUNT JSON format.',
			error
		);
		// Fallback to default, but the custom auth will fail later
		admin.initializeApp();
	}
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

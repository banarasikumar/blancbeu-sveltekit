import { json, type RequestHandler } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export const GET: RequestHandler = async ({ url }) => {
	return handleConsume(url, url.searchParams.get('token'));
};

export const POST: RequestHandler = async ({ request, url }) => {
	let token;
	try {
		const body = await request.json();
		token = body.token;
	} catch {
		// handle
	}
	return handleConsume(url, token);
};

async function handleConsume(url: URL, token: string | null | undefined) {
	if (!token) {
		return new Response('Missing token', { status: 400 });
	}

	try {
		// 1. Find token
		const snapshot = await adminDb
			.collection('magic_links')
			.where('token', '==', token)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return new Response('Invalid token', { status: 403 });
		}

		const doc = snapshot.docs[0];
		const docData = doc.data();

		// 2. Validate usage and expiration
		if (docData.used) {
			return new Response('Token already used', { status: 403 });
		}

		const now = admin.firestore.Timestamp.now();
		if (now.toMillis() > docData.expiresAt.toMillis()) {
			return new Response('Token expired', { status: 403 });
		}

		// 3. Mark used
		await doc.ref.update({ used: true, consumedAt: admin.firestore.FieldValue.serverTimestamp() });

		// 4. Check if user is newly created (check for profile completion)
		let isNewUser = false;
		try {
			const userDoc = await adminDb.collection('users').doc(docData.uid).get();
			if (!userDoc.exists || !userDoc.data()?.profileCompleted) {
				isNewUser = true;
			}
		} catch (e) {
			// Assume new user if check fails
			isNewUser = true;
			console.log('Could not check user profile, assuming new user');
		}

		// 5. Create Custom Auth Token for Frontend
		const customToken = await adminAuth.createCustomToken(docData.uid);

		// 6. Redirect to App with Token and new user flag
		let redirectUrl = '';
		const host = url.host;
		const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

		if (docData.appType === 'staff') {
			redirectUrl = isLocalHost ? '/staff/login' : 'https://staff.blancbeu.in/login';
		} else if (docData.appType === 'admin') {
			redirectUrl = isLocalHost ? '/admin/login' : 'https://admin.blancbeu.in/login';
		} else {
			redirectUrl = isLocalHost ? '/login' : 'https://www.blancbeu.in/login';
		}

		redirectUrl = `${redirectUrl}?token=${customToken}`;
		if (isNewUser) {
			redirectUrl += '&isNewUser=true';
		}

		return new Response(null, {
			status: 302,
			headers: {
				Location: redirectUrl
			}
		});
	} catch (error) {
		console.error('Consume Error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}

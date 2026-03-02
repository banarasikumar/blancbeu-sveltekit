import { json, type RequestHandler } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export const GET: RequestHandler = async ({ url, request }) => {
	const userAgent = request.headers.get('user-agent') || '';
	const isAndroid = /android/i.test(userAgent);
	const forceBrowser = url.searchParams.get('browser') === 'true';

	// Auto WebAPK Bouncer: If the user clicked the magic link on Android, their OS likely
	// hijacked it into the User PWA. We instantly reject the connection and force Android
	// to re-open the link in native Chrome to isolate the session.
	if (isAndroid && !forceBrowser) {
		const redirectUrl = new URL(url.href);
		redirectUrl.searchParams.set('browser', 'true');
		const intentUrl = `intent://${redirectUrl.host}${redirectUrl.pathname}${redirectUrl.search}#Intent;scheme=https;package=com.android.chrome;end;`;

		return new Response(null, {
			status: 302,
			headers: { Location: intentUrl }
		});
	}

	return handleConsume(url.searchParams.get('token'));
};

export const POST: RequestHandler = async ({ request }) => {
	let token;
	try {
		const body = await request.json();
		token = body.token;
	} catch {
		// handle
	}
	return handleConsume(token);
};

async function handleConsume(token: string | null | undefined) {
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
		let targetPath = '/login';
		if (docData.appType === 'staff') {
			targetPath = '/staff/login';
		} else if (docData.appType === 'admin') {
			targetPath = '/admin/login';
		}

		let redirectUrl = `${targetPath}?token=${customToken}`;
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

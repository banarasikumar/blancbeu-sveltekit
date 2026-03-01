import { json, type RequestHandler } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import crypto from 'crypto';
import admin from 'firebase-admin';

// Secret token to secure the endpoint from unauthorized access (optional but recommended)
const BOT_SECRET = process.env.BOT_SECRET || 'blancbeu-bot-secret';

function isAuthorized(request: Request) {
	// Basic auth check logic could go here
	return true;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!isAuthorized(request)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		let body;
		try {
			let rawBody = await request.text();

			// If the bot sends malformed JSON like: {"whatsapp_number": "+91...", "timestamp": ...} but sometimes with single quotes or unquoted keys
			// 1. Remove surrounding whitespace and accidental wrapping quotes if any
			rawBody = rawBody.trim();
			if (rawBody.startsWith('"') && rawBody.endsWith('"')) {
				rawBody = rawBody.slice(1, -1);
			}
			if (rawBody.startsWith("'") && rawBody.endsWith("'")) {
				rawBody = rawBody.slice(1, -1);
			}

			// 2. Try standard parse first
			try {
				body = JSON.parse(rawBody);
			} catch (jsonErr) {
				// 3. Fallback: If JSON.parse fails due to unquoted keys (e.g. {whatsapp_number: "+91..."}), try to fix it
				// Replace unquoted keys with double-quoted keys.
				// This regex looks for word characters before a colon, not already in quotes.
				const fixedBody = rawBody.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
				body = JSON.parse(fixedBody);
			}

			// Sometimes bots double-stringify, so we check if it's still a string
			if (typeof body === 'string') {
				body = JSON.parse(body);
			}
		} catch (e) {
			console.error('Failed to parse board payload:', e);
			return json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		const { whatsapp_number, app_type } = body;

		if (!whatsapp_number) {
			return json({ error: 'Missing WhatsApp number.' }, { status: 400 });
		}

		// 1. Map WhatsApp number to UID
		const cleanNumber = whatsapp_number.replace(/\D/g, ''); // Remove non-digits
		const uid = `wa:+${cleanNumber}`;

		// 2. Create Firebase user if not exists
		try {
			await adminAuth.getUser(uid);
		} catch (error: any) {
			if (error.code === 'auth/user-not-found') {
				await adminAuth.createUser({
					uid: uid,
					displayName: `User ${cleanNumber}`
				});
			} else {
				throw error;
			}
		}

		// 3. Generate secure magic token
		const token = crypto.randomBytes(32).toString('hex');

		// 4. Set expiration (2 mins)
		// Note: Using Firestore Timestamp requires Firebase Admin SDK.
		// the admin.firestore class comes from the admin module.
		const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 2 * 60 * 1000);

		// 5. Store token in Firestore
		await adminDb.collection('magic_links').add({
			token: token,
			uid: uid,
			appType: app_type || 'user', // Default to 'user' if not provided
			expiresAt: expiresAt,
			used: false,
			createdAt: admin.firestore.FieldValue.serverTimestamp()
		});

		// 6. Return magic login link
		// Point to the /api/consume endpoint on the same domain
		// Since the bot processes this, we need the absolute domain.
		// We can use a base URL (env var) or hardcode the production URL for safety during bot redirects.
		const baseUrl = process.env.PUBLIC_BASE_URL || 'https://www.blancbeu.in';
		const magicLink = `${baseUrl}/api/consume?token=${token}`;

		return json({ link: magicLink }, { status: 200 });
	} catch (error: any) {
		console.error('Verify Error:', error);
		return json(
			{ error: 'Internal Server Error', details: error.message, stack: error.stack },
			{ status: 500 }
		);
	}
};

import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST({ request }) {
	try {
		const { path, message } = await request.json();

		// Find admin tokens to notify them of the 500 error
		const usersSnapshot = await adminDb.collection('users').where('role', '==', 'admin').get();
		const tokens: string[] = [];

		usersSnapshot.forEach((doc) => {
			const data = doc.data();
			if (Array.isArray(data.adminFcmTokens)) {
				tokens.push(...data.adminFcmTokens);
			}
		});

		const uniqueTokens = [...new Set(tokens)];

		if (uniqueTokens.length === 0) {
			return json({ success: true, message: 'No admins to notify' });
		}

		const fcmMessage = {
			notification: {
				title: 'Critical System Error (500)',
				body: `A 500 error occurred at ${path || 'unknown path'}. Message: ${message || 'Unknown error'}`
			},
			data: {
				icon: '/admin-icon-192.png'
			},
			android: {
				priority: 'high' as const
			},
			tokens: uniqueTokens
		};

		await admin.messaging().sendEachForMulticast(fcmMessage);

		return json({ success: true });
	} catch (error) {
		console.error('Error reporting 500 error:', error);
		// Return 200 anyway so we don't cause client-side issues, since this is a silent reporting route
		return json({ error: 'Failed to report' });
	}
}

import { json } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(idToken);

        // Only staff or admin may send user notifications
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        const callerRole = callerDoc.data()?.role;
        if (callerRole !== 'staff' && callerRole !== 'admin') {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const { userId, title, body } = await request.json();

        if (!userId || !title) {
            return json({ error: 'Missing userId or title' }, { status: 400 });
        }

        const userDoc = await adminDb.collection('users').doc(userId).get();
        const data = userDoc.data();

        if (!data?.fcmTokens || !Array.isArray(data.fcmTokens) || data.fcmTokens.length === 0) {
            return json({ success: true, message: 'No FCM tokens for this user' });
        }

        const tokens = data.fcmTokens as string[];

        const message = {
            notification: { title, body: body || '' },
            data: { icon: '/pwa-192x192.png' },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'bookings',
                    priority: 'high' as const,
                    defaultVibrateTimings: true,
                    defaultSound: true
                }
            },
            webpush: {
                headers: { Urgency: 'high' },
                notification: {
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    vibrate: [200, 100, 200],
                    requireInteraction: true,
                    tag: 'user-notification',
                    renotify: true
                }
            },
            tokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Clean up expired / invalid tokens from Firestore
        if (response.failureCount > 0) {
            const failedTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) failedTokens.push(tokens[idx]);
            });
            console.warn('[notifyUser] Failed tokens:', failedTokens);

            const cleaned = tokens.filter((t) => !failedTokens.includes(t));
            await userDoc.ref.update({ fcmTokens: cleaned });
        }

        return json({
            success: true,
            sentCount: response.successCount,
            failureCount: response.failureCount
        });
    } catch (error) {
        console.error('[notifyUser] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

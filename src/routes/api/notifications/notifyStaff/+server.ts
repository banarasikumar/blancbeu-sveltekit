import { json } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

export async function POST({ request }) {
    try {
        // Authenticate the request since it comes from client side when a booking is created
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(idToken);

        const { title, body, iconUrl, targetRoles = ['staff', 'admin'], notificationType } = await request.json();

        if (!title || !body) {
            return json({ error: 'Missing title or body' }, { status: 400 });
        }

        // Get all users who have the required role and have FCM tokens
        const tokens: string[] = [];

        for (const role of targetRoles) {
            const usersSnapshot = await adminDb
                .collection('users')
                .where('role', '==', role)
                .get();

            usersSnapshot.forEach((doc) => {
                const data = doc.data();

                // If a notification type was specified, check if the user has explicitly disabled it
                if (notificationType && data.notificationPreferences) {
                    if (data.notificationPreferences[notificationType] === false) {
                        return; // Skip this user
                    }
                }

                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    tokens.push(...data.fcmTokens);
                }
            });
        }

        // Deduplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            return json({ success: true, message: 'No devices to notify' });
        }

        // Send messages
        const message = {
            notification: {
                title,
                body,
                image: iconUrl || undefined // Optional image in notification
            },
            tokens: uniqueTokens
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        const failedTokens: string[] = [];
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(uniqueTokens[idx]);
                }
            });
            console.warn('[Push] Some notifications failed for tokens:', failedTokens);
            // Optionally, you could remove failed/expired tokens from the database here
        }

        return json({
            success: true,
            sentCount: response.successCount,
            failureCount: response.failureCount
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

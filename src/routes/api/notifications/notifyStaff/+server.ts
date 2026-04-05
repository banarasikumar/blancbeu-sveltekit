import { json } from '@sveltejs/kit';
import { adminAuth, adminDb } from '$lib/server/firebaseAdmin';
import admin from 'firebase-admin';

// Notification type mapping for admin granular preferences
const ADMIN_PREF_MAPPING: Record<string, string> = {
    'newBookings': 'newBookings',
    'new_booking': 'newBookings',
    'walk_in_order': 'walkInOrders',
    'walkInOrders': 'walkInOrders',
    'status_change': 'statusChanges',
    'statusChanges': 'statusChanges',
    'cancelled': 'cancelledBookings',
    'cancelledBookings': 'cancelledBookings',
    'completed': 'completedBookings',
    'completedBookings': 'completedBookings',
    'new_user': 'newUsers',
    'newUsers': 'newUsers',
    'payment_received': 'paymentReceived',
    'paymentReceived': 'paymentReceived'
};

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

        // Role → icon mapping so each app gets its branded icon on background notifications
        const ROLE_ICONS: Record<string, string> = {
            staff: '/staff-icon-192.png',
            admin: '/admin-icon-192.png'
        };

        // Collect tokens per role (separate multicasts so each role gets the right icon)
        const roleTokenMap: Record<string, string[]> = {};

        for (const role of targetRoles) {
            const usersSnapshot = await adminDb
                .collection('users')
                .where('role', '==', role)
                .get();

            const roleTokens: string[] = [];
            usersSnapshot.forEach((doc) => {
                const data = doc.data();

                // If a notification type was specified, check if the user has explicitly disabled it
                if (notificationType && data.notificationPreferences) {
                    if (data.notificationPreferences[notificationType] === false) {
                        return; // Skip this user
                    }
                }

                // For admin role, also check granular admin notification preferences
                if (role === 'admin' && data.adminNotificationPreferences) {
                    const adminPrefKey = ADMIN_PREF_MAPPING[notificationType];
                    if (adminPrefKey && data.adminNotificationPreferences[adminPrefKey] === false) {
                        return; // Skip this admin user
                    }
                }

                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    roleTokens.push(...data.fcmTokens);
                }
            });

            if (roleTokens.length > 0) {
                roleTokenMap[role] = [...new Set(roleTokens)];
            }
        }

        const totalDevices = Object.values(roleTokenMap).reduce((s, t) => s + t.length, 0);
        if (totalDevices === 0) {
            return json({ success: true, message: 'No devices to notify' });
        }

        // Send one multicast per role (preserves correct icon per app)
        let totalSent = 0;
        let totalFailed = 0;
        const allFailedTokens: string[] = [];

        for (const [role, tokens] of Object.entries(roleTokenMap)) {
            const message = {
                notification: {
                    title,
                    body,
                    image: iconUrl || undefined
                },
                data: {
                    icon: ROLE_ICONS[role] || '/pwa-192x192.png'
                },
                tokens
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            totalSent += response.successCount;
            totalFailed += response.failureCount;

            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) allFailedTokens.push(tokens[idx]);
                });
            }
        }

        if (allFailedTokens.length > 0) {
            console.warn('[Push] Failed tokens:', allFailedTokens);

            // Remove expired / invalid tokens from Firestore
            const allUsersSnap = await adminDb
                .collection('users')
                .where('fcmTokens', 'array-contains-any', allFailedTokens.slice(0, 10))
                .get();

            const cleanupPromises = allUsersSnap.docs.map((docSnap) => {
                const existing: string[] = docSnap.data().fcmTokens || [];
                const cleaned = existing.filter((t) => !allFailedTokens.includes(t));
                if (cleaned.length !== existing.length) {
                    return docSnap.ref.update({ fcmTokens: cleaned });
                }
            });
            await Promise.allSettled(cleanupPromises);
        }

        return json({
            success: true,
            sentCount: totalSent,
            failureCount: totalFailed
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

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

        // Collect tokens per role and sound preference
        const batches: Record<string, { tokens: string[], role: string, sound: string }> = {};

        for (const role of targetRoles) {
            const usersSnapshot = await adminDb
                .collection('users')
                .where('role', '==', role)
                .get();

            usersSnapshot.forEach((doc) => {
                const data = doc.data();

                // Check per-app push enabled flag — if user has explicitly disabled
                // push for this app role, skip them entirely (Bug #2 fix)
                if (role === 'admin' && data.adminPushEnabled === false) {
                    return; // Admin has disabled push notifications for admin app
                }
                if (role === 'staff' && data.staffPushEnabled === false) {
                    return; // Staff has disabled push notifications for staff app
                }

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

                if (data.fcmTokens && Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
                    const sound = data.preferredSound || 'default';
                    const finalSound = sound === 'custom' ? 'default' : sound;
                    
                    const batchKey = `${role}_${finalSound}`;
                    if (!batches[batchKey]) {
                        batches[batchKey] = { tokens: [], role, sound: finalSound };
                    }
                    batches[batchKey].tokens.push(...data.fcmTokens);
                }
            });
        }

        const totalDevices = Object.values(batches).reduce((s, b) => s + b.tokens.length, 0);
        console.log('[Push] Devices to notify:', totalDevices);
        if (totalDevices === 0) {
            console.warn('[Push] No devices found — are FCM tokens saved in Firestore?');
            return json({ success: true, message: 'No devices to notify' });
        }

        // Send one multicast per batch
        let totalSent = 0;
        let totalFailed = 0;
        const allFailedTokens: string[] = [];

        for (const batch of Object.values(batches)) {
            const roleIcon = ROLE_ICONS[batch.role] || '/pwa-192x192.png';
            const channelId = batch.sound === 'default' ? 'bookings' : `sound_${batch.sound}`;
            const uniqueTokens = [...new Set(batch.tokens)];
            
            const message = {
                notification: {
                    title,
                    body
                },
                data: {
                    icon: roleIcon
                },
                android: {
                    priority: 'high' as const,
                    notification: {
                        channelId: channelId,
                        priority: 'high' as const,
                        defaultVibrateTimings: true,
                        defaultSound: batch.sound === 'default',
                        sound: batch.sound === 'default' ? undefined : batch.sound
                    }
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        icon: roleIcon,
                        badge: roleIcon,
                        vibrate: [200, 100, 200],
                        requireInteraction: true,
                        tag: 'booking-notification',
                        renotify: true
                    }
                },
                tokens: uniqueTokens
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[Push] Role=${batch.role}, Sound=${batch.sound}: sent=${response.successCount}, failed=${response.failureCount}`);
            totalSent += response.successCount;
            totalFailed += response.failureCount;

            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        console.warn(`[Push] Token failed [${batch.role}]:`, resp.error?.code, resp.error?.message);
                        allFailedTokens.push(uniqueTokens[idx]);
                    }
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

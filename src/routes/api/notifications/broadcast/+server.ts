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

        // Only admin may broadcast
        const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
        const callerRole = callerDoc.data()?.role;
        if (callerRole !== 'admin') {
            return json({ error: 'Forbidden — admin only' }, { status: 403 });
        }

        const { title, body, targetAudience = 'all', userIds, imageUrl, clickUrl } = await request.json();

        if (!title || !body) {
            return json({ error: 'Missing title or body' }, { status: 400 });
        }

        // Collect tokens based on audience
        let tokensToSend: string[] = [];
        let targetUserCount = 0;

        if (targetAudience === 'specific' && Array.isArray(userIds) && userIds.length > 0) {
            // Send to specific users
            for (const uid of userIds) {
                const userDoc = await adminDb.collection('users').doc(uid).get();
                const data = userDoc.data();
                if (data?.fcmTokens && Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) {
                    tokensToSend.push(...data.fcmTokens);
                    targetUserCount++;
                }
            }
        } else {
            // Send to users with FCM tokens, filtered by audience
            const usersSnapshot = await adminDb.collection('users').get();
            usersSnapshot.forEach((doc) => {
                const data = doc.data();
                if (!data.fcmTokens || !Array.isArray(data.fcmTokens) || data.fcmTokens.length === 0) return;

                if (targetAudience === 'users_only' && (data.role === 'staff' || data.role === 'admin')) return;
                if (targetAudience === 'staff_only' && data.role !== 'staff' && data.role !== 'admin') return;

                tokensToSend.push(...data.fcmTokens);
                targetUserCount++;
            });
        }

        // Deduplicate tokens
        tokensToSend = [...new Set(tokensToSend)];

        if (tokensToSend.length === 0) {
            // Save to history even if no tokens
            await adminDb.collection('notificationHistory').add({
                title,
                body,
                ...(imageUrl && { imageUrl }),
                ...(clickUrl && { clickUrl }),
                targetAudience,
                sentBy: decoded.uid,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                targetUserCount: 0,
                sentCount: 0,
                failureCount: 0,
                status: 'no_subscribers'
            });
            return json({ success: true, message: 'No subscribers to notify', sentCount: 0, targetUserCount: 0 });
        }

        // Send in batches of 500 (FCM multicast limit)
        let totalSent = 0;
        let totalFailed = 0;
        const allFailedTokens: string[] = [];

        for (let i = 0; i < tokensToSend.length; i += 500) {
            const batch = tokensToSend.slice(i, i + 500);
            const message = {
                notification: {
                    title,
                    body,
                    ...(imageUrl && { image: imageUrl })
                },
                data: {
                    icon: '/pwa-192x192.png',
                    type: 'broadcast',
                    ...(imageUrl && { imageUrl }),
                    ...(clickUrl && { clickUrl })
                },
                android: {
                    priority: 'high' as const,
                    notification: {
                        channelId: 'general',
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
                        requireInteraction: false,
                        tag: 'broadcast-notification',
                        renotify: true,
                        ...(imageUrl && { image: imageUrl })
                    },
                    ...(clickUrl && { fcmOptions: { link: clickUrl } })
                },
                tokens: batch
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            totalSent += response.successCount;
            totalFailed += response.failureCount;

            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) allFailedTokens.push(batch[idx]);
                });
            }
        }

        // Clean up failed tokens
        if (allFailedTokens.length > 0) {
            const cleanupBatches = [];
            for (let i = 0; i < allFailedTokens.length; i += 10) {
                const slice = allFailedTokens.slice(i, i + 10);
                const snap = await adminDb
                    .collection('users')
                    .where('fcmTokens', 'array-contains-any', slice)
                    .get();
                snap.docs.forEach((docSnap) => {
                    const existing: string[] = docSnap.data().fcmTokens || [];
                    const cleaned = existing.filter((t) => !allFailedTokens.includes(t));
                    if (cleaned.length !== existing.length) {
                        cleanupBatches.push(docSnap.ref.update({ fcmTokens: cleaned }));
                    }
                });
            }
            await Promise.allSettled(cleanupBatches);
        }

        // Save to notification history
        await adminDb.collection('notificationHistory').add({
            title,
            body,
            ...(imageUrl && { imageUrl }),
            ...(clickUrl && { clickUrl }),
            targetAudience,
            sentBy: decoded.uid,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            targetUserCount,
            sentCount: totalSent,
            failureCount: totalFailed,
            status: totalSent > 0 ? 'sent' : 'failed'
        });

        return json({
            success: true,
            targetUserCount,
            sentCount: totalSent,
            failureCount: totalFailed
        });
    } catch (error) {
        console.error('[broadcast] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

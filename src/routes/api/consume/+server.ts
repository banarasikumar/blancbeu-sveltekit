import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminAuth, getAdminDb, Timestamp } from '$lib/server/firebaseAdmin';

export const GET: RequestHandler = async ({ url }) => {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const token = url.searchParams.get('token');

    if (!token) {
        return new Response('Missing token', { status: 400 });
    }

    try {
        // 1. Find token in Firestore
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

        // 2. Validate: not used
        if (docData.used) {
            return new Response('Token already used', { status: 403 });
        }

        // 3. Validate: not expired
        const now = Timestamp.now();
        if (now.toMillis() > docData.expiresAt.toMillis()) {
            return new Response('Token expired', { status: 403 });
        }

        // 4. Mark as used
        await doc.ref.update({ used: true });

        // 5. Check if user profile is complete
        let isNewUser = false;
        try {
            const userDoc = await adminDb.collection('users').doc(docData.uid).get();
            if (!userDoc.exists || !userDoc.data()?.profileCompleted) {
                isNewUser = true;
            }
        } catch (e) {
            isNewUser = true;
            console.log('Could not check user profile, assuming new user');
        }

        // 6. Create Firebase custom auth token
        const customToken = await adminAuth.createCustomToken(docData.uid);

        // 7. Redirect to app root with the custom token
        const redirectUrl = `/?token=${customToken}${isNewUser ? '&isNewUser=true' : ''}`;
        throw redirect(302, redirectUrl);
    } catch (error: any) {
        // Re-throw redirects (SvelteKit uses thrown redirects)
        if (error?.status === 302) {
            throw error;
        }

        console.error('Consume Error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
};

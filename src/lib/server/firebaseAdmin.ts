import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { env } from '$env/dynamic/private';

function ensureInitialized(): App {
    if (getApps().length === 0) {
        const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccountJson) {
            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
                return initializeApp({
                    credential: cert(serviceAccount)
                });
            } catch (e) {
                console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
            }
        } else {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT is missing. Server-side auth will fail.');
        }
        return initializeApp();
    }
    return getApps()[0];
}

export function getAdminAuth(): Auth {
    ensureInitialized();
    return getAuth();
}

export function getAdminDb(): Firestore {
    ensureInitialized();
    return getFirestore();
}

export { Timestamp };


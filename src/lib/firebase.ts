import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
	type Firestore
} from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { browser } from '$app/environment';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp | undefined;
let db: Firestore;
let auth: Auth;
let storage: FirebaseStorage;
let messaging: Messaging | null = null;

if (browser) {
	app = getApps().length ? getApp() : initializeApp(firebaseConfig);
	db = initializeFirestore(app, {
		localCache: persistentLocalCache({
			tabManager: persistentMultipleTabManager()
		})
	});
	auth = getAuth(app);
	storage = getStorage(app);
	isSupported().then((supported) => {
		if (supported && app) {
			messaging = getMessaging(app);
		}
	});
}

export { app, db, auth, storage, messaging };

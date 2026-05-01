import { writable, get } from 'svelte/store';
import { db } from '$lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface AppSettings {
	defaultPaymentGateway: 'default' | 'razorpay';
}

const DEFAULT_SETTINGS: AppSettings = {
	defaultPaymentGateway: 'default'
};

export const appSettings = writable<AppSettings>(DEFAULT_SETTINGS);

let settingsUnsub: (() => void) | null = null;

export function initAppSettingsListener() {
	if (settingsUnsub) return;

	console.log('[AppSettings] Starting listener');
	const settingsRef = doc(db, 'settings', 'global');

	settingsUnsub = onSnapshot(
		settingsRef,
		(docSnapshot) => {
			if (docSnapshot.exists()) {
				appSettings.set({ ...DEFAULT_SETTINGS, ...docSnapshot.data() } as AppSettings);
			} else {
				// If it doesn't exist, set default
				setDoc(settingsRef, DEFAULT_SETTINGS).catch(console.error);
				appSettings.set(DEFAULT_SETTINGS);
			}
		},
		(error) => {
			console.error('[AppSettings] Listener error:', error);
		}
	);
}

export function destroyAppSettingsListener() {
	if (settingsUnsub) {
		settingsUnsub();
		settingsUnsub = null;
	}
}

export async function updateAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
	const settingsRef = doc(db, 'settings', 'global');
	try {
		await setDoc(settingsRef, { [key]: value }, { merge: true });
		// Store will auto-update via snapshot listener
		return true;
	} catch (error) {
		console.error(`[AppSettings] Failed to update ${key}:`, error);
		return false;
	}
}

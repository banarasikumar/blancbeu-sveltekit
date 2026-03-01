import { writable } from 'svelte/store';

export interface PendingProfileData {
	uid: string;
	phone?: string;
	email?: string;
	provider: 'google' | 'whatsapp';
}

// Store for pending user data awaiting profile completion
export const pendingProfileData = writable<PendingProfileData | null>(null);

// Whether profile completion is mandatory (new users)
export const isProfileMandatory = writable<boolean>(false);

// Set pending profile data
export function setPendingProfile(data: PendingProfileData, mandatory: boolean = false) {
	pendingProfileData.set(data);
	isProfileMandatory.set(mandatory);
}

// Clear pending profile data
export function clearPendingProfile() {
	pendingProfileData.set(null);
	isProfileMandatory.set(false);
}

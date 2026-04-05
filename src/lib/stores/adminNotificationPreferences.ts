import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Admin-specific notification preferences key
const ADMIN_NOTIFICATION_PREFS_KEY = 'blancbeu_admin_notification_prefs';

// Sound preferences keys
const ADMIN_SOUND_PREF_KEY = 'admin_notification_sound_enabled';
const ADMIN_SOUND_TYPE_KEY = 'admin_selected_sound_type';
const ADMIN_CUSTOM_SOUND_KEY = 'admin_custom_sound_path';

export type SoundType = 'chime' | 'bell' | 'ios' | 'android' | 'retro' | 'custom';

export const AVAILABLE_SOUNDS = [
	{ id: 'chime' as SoundType, name: 'Luxury Chime', path: '/sounds/chime.mp3' },
	{ id: 'bell' as SoundType, name: 'Classic Bell', path: '/sounds/bell.mp3' },
	{ id: 'ios' as SoundType, name: 'iPhone', path: '/sounds/ios.mp3' },
	{ id: 'android' as SoundType, name: 'Android', path: '/sounds/android.mp3' },
	{ id: 'retro' as SoundType, name: 'Retro 8-bit', path: '/sounds/retro.mp3' }
];

// Granular notification preferences interface
export interface AdminNotificationPreferences {
	// Order-related notifications
	newBookings: boolean;
	statusChanges: boolean;
	cancelledBookings: boolean;
	completedBookings: boolean;
	walkInOrders: boolean;
	paymentReceived: boolean;
	
	// User-related notifications
	newUsers: boolean;
	
	// Sound settings
	soundEnabled: boolean;
	selectedSoundType: SoundType;
	customSoundPath: string;
}

const DEFAULT_PREFS: AdminNotificationPreferences = {
	newBookings: true,
	statusChanges: true,
	cancelledBookings: true,
	completedBookings: true,
	walkInOrders: true,
	paymentReceived: true,
	newUsers: true,
	soundEnabled: true,
	selectedSoundType: 'chime',
	customSoundPath: ''
};

function createNotificationPrefsStore() {
	const getInitialPrefs = (): AdminNotificationPreferences => {
		if (!browser) return DEFAULT_PREFS;
		const saved = localStorage.getItem(ADMIN_NOTIFICATION_PREFS_KEY);
		if (saved) {
			try {
				return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
			} catch {
				return DEFAULT_PREFS;
			}
		}
		return DEFAULT_PREFS;
	};

	const { subscribe, update, set } = writable<AdminNotificationPreferences>(getInitialPrefs());

	return {
		subscribe,
		
		// Toggle a specific notification type
		toggle(type: keyof AdminNotificationPreferences) {
			update((prefs) => {
				const newPrefs = { ...prefs, [type]: !prefs[type] };
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATION_PREFS_KEY, JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		
		// Set a specific preference value
		setPreference(type: keyof AdminNotificationPreferences, value: any) {
			update((prefs) => {
				const newPrefs = { ...prefs, [type]: value };
				if (browser) {
					localStorage.setItem(ADMIN_NOTIFICATION_PREFS_KEY, JSON.stringify(newPrefs));
				}
				return newPrefs;
			});
		},
		
		// Check if a specific notification type is enabled
		isEnabled(type: keyof AdminNotificationPreferences): boolean {
			return get(this)[type] as boolean;
		},
		
		// Reset to defaults
		reset() {
			set(DEFAULT_PREFS);
			if (browser) {
				localStorage.setItem(ADMIN_NOTIFICATION_PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
			}
		},
		
		// Get all prefs
		getAll(): AdminNotificationPreferences {
			return get(this);
		}
	};
}

export const adminNotificationPrefs = createNotificationPrefsStore();

// Individual stores for easier binding in UI
function createIndividualStore(key: keyof AdminNotificationPreferences) {
	const { subscribe } = adminNotificationPrefs;
	return {
		subscribe: (cb: (value: any) => void) => 
			subscribe((prefs) => cb(prefs[key])),
		toggle() {
			adminNotificationPrefs.toggle(key);
		},
		set(value: any) {
			adminNotificationPrefs.setPreference(key, value);
		}
	};
}

export const adminNewBookingsEnabled = createIndividualStore('newBookings');
export const adminStatusChangesEnabled = createIndividualStore('statusChanges');
export const adminCancelledBookingsEnabled = createIndividualStore('cancelledBookings');
export const adminCompletedBookingsEnabled = createIndividualStore('completedBookings');
export const adminWalkInOrdersEnabled = createIndividualStore('walkInOrders');
export const adminPaymentReceivedEnabled = createIndividualStore('paymentReceived');
export const adminNewUsersEnabled = createIndividualStore('newUsers');

// Sound stores
export const adminSoundEnabled = createIndividualStore('soundEnabled');
export const adminSelectedSoundType = createIndividualStore('selectedSoundType');
export const adminCustomSoundPath = createIndividualStore('customSoundPath');

// Get selected sound path
export function getAdminSelectedSoundPath(): string {
	const prefs = get(adminNotificationPrefs);
	if (prefs.selectedSoundType === 'custom') {
		return prefs.customSoundPath || AVAILABLE_SOUNDS[0].path;
	}
	const sound = AVAILABLE_SOUNDS.find(s => s.id === prefs.selectedSoundType);
	return sound?.path || AVAILABLE_SOUNDS[0].path;
}

// Re-export notification permission functions from staffNotifications
export {
	requestNotificationPermission,
	disableNotifications,
	notificationStatus,
	checkNotificationStatus
} from './staffNotifications';

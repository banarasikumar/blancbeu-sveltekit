import { writable, get, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Admin-specific notification preferences
const ADMIN_SOUND_PREF_KEY = 'admin_notification_sound_enabled';
const ADMIN_SOUND_TYPE_KEY = 'admin_selected_sound_type';
const ADMIN_CUSTOM_SOUND_KEY = 'admin_custom_sound_path';

// Sound type options
export type SoundType = 'chime' | 'bell' | 'ios' | 'android' | 'retro' | 'custom';

export const AVAILABLE_SOUNDS = [
	{ id: 'chime' as SoundType, name: 'Luxury Chime', path: '/sounds/chime.mp3' },
	{ id: 'bell' as SoundType, name: 'Classic Bell', path: '/sounds/bell.mp3' },
	{ id: 'ios' as SoundType, name: 'iPhone', path: '/sounds/ios.mp3' },
	{ id: 'android' as SoundType, name: 'Android', path: '/sounds/android.mp3' },
	{ id: 'retro' as SoundType, name: 'Retro 8-bit', path: '/sounds/retro.mp3' }
];

// Sound enabled store
function createSoundStore() {
	const initial = browser ? localStorage.getItem(ADMIN_SOUND_PREF_KEY) !== 'false' : true;
	const { subscribe, set, update } = writable<boolean>(initial);
	return {
		subscribe,
		toggle() {
			update((v) => {
				const next = !v;
				if (browser) localStorage.setItem(ADMIN_SOUND_PREF_KEY, String(next));
				return next;
			});
		},
		set(val: boolean) {
			set(val);
			if (browser) localStorage.setItem(ADMIN_SOUND_PREF_KEY, String(val));
		}
	};
}

// Selected sound type store
function createSoundTypeStore() {
	const initial: SoundType = browser ? (localStorage.getItem(ADMIN_SOUND_TYPE_KEY) as SoundType) || 'chime' : 'chime';
	const { subscribe, set } = writable<SoundType>(initial);
	return {
		subscribe,
		set(val: SoundType) {
			set(val);
			if (browser) localStorage.setItem(ADMIN_SOUND_TYPE_KEY, val);
		}
	};
}

// Custom sound path store
function createCustomSoundStore() {
	const initial = browser ? localStorage.getItem(ADMIN_CUSTOM_SOUND_KEY) || '' : '';
	const { subscribe, set } = writable<string>(initial);
	return {
		subscribe,
		set(val: string) {
			set(val);
			if (browser) {
				if (val) {
					localStorage.setItem(ADMIN_CUSTOM_SOUND_KEY, val);
				} else {
					localStorage.removeItem(ADMIN_CUSTOM_SOUND_KEY);
				}
			}
		}
	};
}

export const soundEnabled = createSoundStore();
export const selectedSoundType = createSoundTypeStore();
export const customSoundPath = createCustomSoundStore();

// Get the actual sound path based on selection
export function getSelectedSoundPath(): string {
	const type = get(selectedSoundType);
	if (type === 'custom') {
		return get(customSoundPath) || AVAILABLE_SOUNDS[0].path;
	}
	const sound = AVAILABLE_SOUNDS.find(s => s.id === type);
	return sound?.path || AVAILABLE_SOUNDS[0].path;
}

// Re-export from staffNotifications for admin use
export {
	requestNotificationPermission,
	disableNotifications,
	notificationStatus,
	checkNotificationStatus
} from './staffNotifications';

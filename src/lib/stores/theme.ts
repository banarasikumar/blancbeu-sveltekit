import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type Theme = 'gold' | 'glitch' | 'clean';

export const THEME_COLORS: Record<Theme, string> = {
	gold: '#000000',
	glitch: '#E6E6FA',
	clean: '#F9F9F9'
};

const THEME_KEY = 'theme';
const THEME_TOGGLED_AT_KEY = 'theme_toggled_at';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

/** Returns time-based theme: clean (light) for day, gold (dark) for night */
function getTimeBasedTheme(): Theme {
	const hour = new Date().getHours();
	// Daytime: 6 AM to 6 PM -> light theme
	return (hour >= 6 && hour < 18) ? 'clean' : 'gold';
}

const getInitialTheme = (): Theme => {
	if (!browser) return 'gold';

	const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
	const toggledAtStr = localStorage.getItem(THEME_TOGGLED_AT_KEY);

	// No previous manual toggle — use time-based auto theme
	if (!toggledAtStr || !savedTheme) {
		return getTimeBasedTheme();
	}

	const toggledAt = parseInt(toggledAtStr, 10);
	const elapsed = Date.now() - toggledAt;

	// If last manual toggle was more than 12 hours ago, revert to auto
	if (elapsed > TWELVE_HOURS_MS) {
		localStorage.removeItem(THEME_TOGGLED_AT_KEY);
		return getTimeBasedTheme();
	}

	// Last toggle was within 12 hours — keep user's choice
	return savedTheme;
};

export const theme = writable<Theme>(getInitialTheme());

if (browser) {
	theme.subscribe((value) => {
		localStorage.setItem(THEME_KEY, value);

		// Remove old themes
		document.documentElement.removeAttribute('data-theme');

		// Apply new theme (except default gold which is :root)
		if (value !== 'gold') {
			document.documentElement.setAttribute('data-theme', value);
		}

		// Dynamically update Capacitor Status Bar natively
		if (browser && Capacitor.isNativePlatform()) {
			StatusBar.setBackgroundColor({ color: THEME_COLORS[value] }).catch(console.warn);
			
			// Style.Dark = white/light status bar icons (used in Dark mode like 'gold')
			// Style.Light = dark status bar icons (used in Light modes like 'glitch'/'clean')
			const style = value === 'gold' ? Style.Dark : Style.Light;
			StatusBar.setStyle({ style }).catch(console.warn);
		}
	});
}

export const toggleTheme = () => {
	theme.update((current) => {
		if (current === 'gold') return 'glitch';
		if (current === 'glitch') return 'clean';
		return 'gold';
	});

	// Save the toggle timestamp so the manual choice persists for 12 hours
	if (browser) {
		localStorage.setItem(THEME_TOGGLED_AT_KEY, Date.now().toString());
	}
};

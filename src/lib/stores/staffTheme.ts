import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'blancbeu-staff-theme';

function getInitialTheme(): ThemeMode {
	if (!browser) return 'light';
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
	return 'light';
}

function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
	if (mode !== 'system') return mode;
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const themeMode = writable<ThemeMode>(getInitialTheme());
export const resolvedTheme = writable<'light' | 'dark'>(getResolvedTheme(getInitialTheme()));

let mediaQuery: MediaQueryList | null = null;

export function initTheme() {
	if (!browser) return;

	// Apply initial theme
	const initial = getInitialTheme();
	applyTheme(initial);

	// Listen for system theme changes
	mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', handleSystemChange);

	// Subscribe to store changes
	themeMode.subscribe((mode) => {
		if (browser) {
			localStorage.setItem(STORAGE_KEY, mode);
			applyTheme(mode);
		}
	});
}

function handleSystemChange() {
	const currentMode = get(themeMode);
	if (currentMode === 'system') {
		applyTheme('system');
	}
}

function applyTheme(mode: ThemeMode) {
	if (!browser) return;
	const resolved = getResolvedTheme(mode);
	resolvedTheme.set(resolved);

	const el = document.querySelector('.staff-app');
	if (el) {
		el.classList.remove('light', 'dark');
		el.classList.add(resolved);
	}

	// Dynamically update Capacitor Status Bar natively
	import('@capacitor/core').then(({ Capacitor }) => {
		if (Capacitor.isNativePlatform()) {
			import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
				const bgColor = resolved === 'dark' ? '#121212' : '#f8fafc';
				StatusBar.setBackgroundColor({ color: bgColor }).catch(console.warn);
				
				// 'dark' mode -> dark background -> light text/icons (Style.Dark)
				// 'light' mode -> light background -> dark text/icons (Style.Light)
				const style = resolved === 'dark' ? Style.Dark : Style.Light;
				StatusBar.setStyle({ style }).catch(console.warn);
			}).catch(console.warn);
		}
	}).catch(() => {});
}

export function setTheme(mode: ThemeMode) {
	themeMode.set(mode);
}

export function toggleTheme() {
	themeMode.update((current) => {
		const resolved = getResolvedTheme(current);
		return resolved === 'light' ? 'dark' : 'light';
	});
}

export function destroyTheme() {
	if (mediaQuery) {
		mediaQuery.removeEventListener('change', handleSystemChange);
		mediaQuery = null;
	}
}

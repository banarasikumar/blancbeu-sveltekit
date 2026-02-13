import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'gold' | 'glitch' | 'clean';

export const THEME_COLORS: Record<Theme, string> = {
    gold: '#000000',
    glitch: '#E6E6FA',
    clean: '#F9F9F9'
};

const getInitialTheme = (): Theme => {
    if (browser) {
        const stored = localStorage.getItem('theme') as Theme;
        if (stored) return stored;
        return 'gold'; // Default
    }
    return 'gold';
};

export const theme = writable<Theme>(getInitialTheme());

if (browser) {
    theme.subscribe((value) => {
        localStorage.setItem('theme', value);

        // Remove old themes
        document.documentElement.removeAttribute('data-theme');

        // Apply new theme (except default gold which is :root)
        if (value !== 'gold') {
            document.documentElement.setAttribute('data-theme', value);
        }
    });

    // Handle system preference or manual toggles if needed in future
}

export const toggleTheme = () => {
    theme.update(current => {
        if (current === 'gold') return 'glitch';
        if (current === 'glitch') return 'clean';
        return 'gold';
    });
};

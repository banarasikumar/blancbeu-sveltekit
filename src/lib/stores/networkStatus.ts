import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createNetworkStatus() {
    const { subscribe, set } = writable(true);

    if (browser) {
        set(navigator.onLine);
        window.addEventListener('online', () => set(true));
        window.addEventListener('offline', () => set(false));
    }

    return { subscribe };
}

export const isOnline = createNetworkStatus();

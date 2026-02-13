import { writable } from 'svelte/store';

export interface ToastData {
    message: string;
    type: 'success' | 'error' | 'logout';
    id: number;
}

export const toasts = writable<ToastData[]>([]);

let toastId = 0;

export function showToast(message: string, type: 'success' | 'error' | 'logout' = 'success') {
    const id = ++toastId;

    toasts.update(all => [...all, { message, type, id }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        toasts.update(all => all.filter(t => t.id !== id));
    }, 5000);
}

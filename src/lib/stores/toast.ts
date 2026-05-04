import { writable } from 'svelte/store';

export interface ToastData {
	message: string;
	type: 'success' | 'error' | 'logout';
	id: number;
}

export const toasts = writable<ToastData[]>([]);

let toastId = 0;

export function removeToast(id: number) {
	toasts.update((all) => all.filter((t) => t.id !== id));
}

export function showToast(message: string, type: 'success' | 'error' | 'logout' = 'success') {
	const id = ++toastId;

	toasts.update((all) => {
		// Prevent exact duplicate messages from stacking
		if (all.some((t) => t.message === message)) return all;
		return [...all, { message, type, id }];
	});

	// Auto-dismiss after 5 seconds
	setTimeout(() => {
		toasts.update((all) => all.filter((t) => t.id !== id));
	}, 5000);
}

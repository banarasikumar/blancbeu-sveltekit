import { writable } from 'svelte/store';

export interface HeaderAction {
	label: string;
	icon?: any;
	handler: () => void;
	direct?: boolean;
}

export const headerActions = writable<HeaderAction[]>([]);
export const isBottomNavVisible = writable<boolean>(true);

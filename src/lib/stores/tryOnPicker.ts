import { writable, derived } from 'svelte/store';

// Store to manage try-on picker mode when navigating to the services page
interface TryOnPickerState {
	active: boolean;
	selectedIds: string[];
	selectedServices: { name: string; id: string; price: number }[];
	maxSlots: number;
}

const createTryOnPicker = () => {
	const { subscribe, set, update } = writable<TryOnPickerState>({
		active: false,
		selectedIds: [],
		selectedServices: [],
		maxSlots: 3
	});

	return {
		subscribe,
		activate: (currentSelections: { name: string; id: string; price: number }[]) => {
			set({
				active: true,
				selectedIds: currentSelections.map((s) => s.id),
				selectedServices: [...currentSelections],
				maxSlots: 3
			});
		},
		addService: (svc: { name: string; id: string; price: number }) => {
			update((state) => {
				if (state.selectedServices.length >= state.maxSlots) return state;
				if (state.selectedIds.includes(svc.id)) return state;
				return {
					...state,
					selectedIds: [...state.selectedIds, svc.id],
					selectedServices: [...state.selectedServices, svc]
				};
			});
		},
		removeService: (id: string) => {
			update((state) => ({
				...state,
				selectedIds: state.selectedIds.filter((sid) => sid !== id),
				selectedServices: state.selectedServices.filter((s) => s.id !== id)
			}));
		},
		deactivate: () => {
			set({
				active: false,
				selectedIds: [],
				selectedServices: [],
				maxSlots: 3
			});
		}
	};
};

export const tryOnPicker = createTryOnPicker();

export const tryOnPickerCount = derived(tryOnPicker, ($p) => $p.selectedServices.length);
export const tryOnPickerFull = derived(tryOnPicker, ($p) => $p.selectedServices.length >= $p.maxSlots);

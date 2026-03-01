import { writable, type Writable } from 'svelte/store';
import { db } from '$lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';

export interface Service {
	id: string;
	name: string;
	category: string;
	price: number;
	originalPrice?: number;
	duration: number; // in minutes
	description?: string;
	image?: string;
	isActive?: boolean;
	createdAt?: any;
	updatedAt?: string;
	[key: string]: any;
}

export const appServices: Writable<Service[]> = writable([]);

let servicesUnsub: (() => void) | null = null;

export function initAppServiceListener() {
	if (servicesUnsub) return;
	console.log('[AppData] Starting app service listener');

	// Order by created for now, or maybe category? Let's just get all.
	// Actually, ordering by category might be nice, but we can do that in the component.
	const q = query(collection(db, 'services'), orderBy('name', 'asc'));

	servicesUnsub = onSnapshot(
		q,
		(snapshot) => {
			const services = snapshot.docs.map((d) => ({
				id: d.id,
				...d.data()
			})) as Service[];
			appServices.set(services);
		},
		(error) => {
			console.error('[AppData] Service listener error:', error);
		}
	);
}

export function destroyAppListeners() {
	if (servicesUnsub) {
		servicesUnsub();
		servicesUnsub = null;
	}
}

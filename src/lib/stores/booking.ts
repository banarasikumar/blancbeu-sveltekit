import { writable, derived } from 'svelte/store';
import type { Service } from '$lib/stores/appData';
import { browser } from '$app/environment';

// Persistent Cart Store
const createCart = () => {
    const startData = browser ? JSON.parse(localStorage.getItem('cart') || '[]') : [];
    const { subscribe, set, update } = writable<Service[]>(startData);

    return {
        subscribe,
        add: (service: Service) => update(items => {
            if (items.find(i => i.id === service.id)) return items;
            const newItems = [...items, service];
            if (browser) localStorage.setItem('cart', JSON.stringify(newItems));
            return newItems;
        }),
        remove: (serviceId: string) => update(items => {
            const newItems = items.filter(i => i.id !== serviceId);
            if (browser) localStorage.setItem('cart', JSON.stringify(newItems));
            return newItems;
        }),
        clear: () => {
            set([]);
            if (browser) localStorage.setItem('cart', '[]');
        }
    };
};

export const cart = createCart();

// Derived store for total price
export const cartTotal = derived(cart, $cart =>
    $cart.reduce((total, item) => total + item.price, 0)
);

export const cartCount = derived(cart, $cart => $cart.length);

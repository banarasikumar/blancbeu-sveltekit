import { writable, derived } from 'svelte/store';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp, where, getDocs } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Booking, Service } from './adminData'; // Reuse types

// --- Stores ---
export const staffBookings = writable<Booking[]>([]);
export const staffServices = writable<Service[]>([]);

// Derived stats
export const upcomingBookings = derived(staffBookings, ($b) => {
    // Filter for today and future (pending/confirmed/in-progress)
    return $b.filter(b =>
        (b.status === 'pending' || b.status === 'confirmed' || b.status === 'in-progress')
    );
});

export const todayBookings = derived(staffBookings, ($b) => {
    const today = new Date().toISOString().split('T')[0];
    return $b.filter(b => {
        if (!b.date) return false;
        if (typeof b.date === 'string' && b.date.includes(today)) return true;
        return false;
    });
});


// --- Listeners ---
let bookingsUnsub: (() => void) | null = null;
let servicesUnsub: (() => void) | null = null;

export function initStaffDataListener() {
    if (bookingsUnsub) return;
    console.log('[StaffData] Starting listeners');

    const qBookings = query(collection(db, 'bookings'), orderBy('date', 'asc')); // Sort by appointment date

    bookingsUnsub = onSnapshot(
        qBookings,
        (snapshot) => {
            const bookings = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data()
            })) as Booking[];
            staffBookings.set(bookings);
        },
        (error) => {
            console.error('[StaffData] Booking listener error:', error);
        }
    );

    const qServices = query(collection(db, 'services'));
    servicesUnsub = onSnapshot(
        qServices,
        (snapshot) => {
            const services = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data()
            })) as Service[];
            staffServices.set(services);
        },
        (error) => {
            console.error('[StaffData] Service listener error:', error);
        }
    );
}

export function destroyStaffDataListeners() {
    if (bookingsUnsub) {
        bookingsUnsub();
        bookingsUnsub = null;
    }
    if (servicesUnsub) {
        servicesUnsub();
        servicesUnsub = null;
    }
}

// --- Actions ---

export async function createBooking(bookingData: Partial<Booking>) {
    try {
        // Ensure required fields
        const newBooking = {
            ...bookingData,
            status: 'confirmed', // Staff created bookings are usually confirmed immediately
            createdAt: new Date().toISOString(), // Use string for consistency with existing data
            updatedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'bookings'), newBooking);
    } catch (e) {
        console.error("Error creating booking:", e);
        throw e;
    }
}

export async function updateBookingDetails(id: string, updates: Partial<Booking>) {
    try {
        const docRef = doc(db, 'bookings', id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error updating booking:", e);
        throw e;
    }
}

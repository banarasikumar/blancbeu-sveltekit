import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { updateDoc, doc, getDocs, query, collection, where, deleteField } from 'firebase/firestore';
import { db } from '$lib/firebase';
import type { Booking } from './adminData';

// --- Stores ---

// Ticking clock for UI updates (ticks every second)
export const now = writable(Date.now());

let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicking() {
	if (intervalId) return;
	intervalId = setInterval(() => {
		now.set(Date.now());
	}, 1000);
}

function stopTicking() {
	if (intervalId) {
		clearInterval(intervalId);
		intervalId = null;
	}
}

// Ensure ticking starts when imported (or we could start/stop based on subscribers, but simple is better)
if (browser) {
	startTicking();
}

// --- Actions ---

/**
 * Start a service timer.
 * If another service is currently running, it will be paused.
 */
export async function startServiceTimer(booking: Booking) {
	// 1. Pause any other running timers
	await pauseAllOtherTimers(booking.id);

	// 2. Start this timer
	const updates: Partial<Booking> = {
		status: 'in-progress',
		isTimerRunning: true,
		timerStart: Date.now(),
		// Initialize elapsed if not present
		timerElapsed: booking.timerElapsed || 0,
		updatedAt: new Date().toISOString()
	};

	try {
		await updateDoc(doc(db, 'bookings', booking.id), updates);
	} catch (error) {
		console.error('Error starting timer:', error);
	}
}

/**
 * Pause a service timer.
 */
export async function pauseTimer(booking: Booking) {
	console.log(`[ServiceTimer] Request to pause timer for: ${booking.id}`);

	// Fetch fresh data to ensure we have the latest timerStart
	let freshBooking = booking;
	try {
		const docRef = doc(db, 'bookings', booking.id);
		const docSnap = await import('firebase/firestore').then((m) => m.getDoc(docRef));

		if (docSnap.exists()) {
			freshBooking = { id: docSnap.id, ...docSnap.data() } as Booking;
			console.log(
				`[ServiceTimer] Fetched fresh data. isTimerRunning: ${freshBooking.isTimerRunning}, timerStart: ${freshBooking.timerStart}`
			);
			// Handle timerStart if it's a Firestore Timestamp (edge case)
			if (
				freshBooking.timerStart &&
				typeof freshBooking.timerStart === 'object' &&
				'seconds' in (freshBooking.timerStart as any)
			) {
				freshBooking.timerStart = (freshBooking.timerStart as any).seconds * 1000;
				console.log(`[ServiceTimer] Converted Timestamp to number: ${freshBooking.timerStart}`);
			}
		} else {
			console.warn('[ServiceTimer] Document does not exist!');
		}
	} catch (e) {
		console.warn('Could not fetch fresh booking, using passed object', e);
	}

	if (!freshBooking.isTimerRunning) {
		console.log('[ServiceTimer] Timer already paused (according to DB), skipping update.');
		return;
	}

	// Safely calculate duration
	let startTimestamp = freshBooking.timerStart;
	// If somehow undefined or not a number, default to Date.now() to avoid NaN, or handle gracefully
	if (typeof startTimestamp !== 'number') {
		console.warn(
			`[ServiceTimer] Invalid timerStart type: ${typeof startTimestamp}, Value: ${startTimestamp}`
		);
		startTimestamp = Date.now(); // Fallback to avoid corruption, though this means 0 elapsed for this session usually
	}

	const currentSessionDuration = (Date.now() - startTimestamp) / 1000;
	const newElapsed = (freshBooking.timerElapsed || 0) + Math.max(0, currentSessionDuration);

	const updates: Partial<Booking> = {
		isTimerRunning: false,
		timerElapsed: Math.floor(newElapsed),
		timerStart: undefined as any, // Clear start time - cast to any to satisfy Partial<Booking> if needed or just undefined
		updatedAt: new Date().toISOString()
	};

	// Explicitly delete timerStart field in Firestore
	(updates as any).timerStart = deleteField();

	try {
		await updateDoc(doc(db, 'bookings', booking.id), updates);
		console.log(`[ServiceTimer] Paused timer for ${booking.id}. New elapsed: ${newElapsed}`);
	} catch (error) {
		console.error('Error pausing timer:', error);
	}
}

/**
 * Resume a service timer.
 * If another service is running, it will be paused.
 */
export async function resumeTimer(booking: Booking) {
	// 1. Pause any other running timers
	await pauseAllOtherTimers(booking.id);

	// 2. Resume this timer
	const updates: Partial<Booking> = {
		isTimerRunning: true,
		timerStart: Date.now(),
		updatedAt: new Date().toISOString()
	};

	try {
		await updateDoc(doc(db, 'bookings', booking.id), updates);
	} catch (error) {
		console.error('Error resuming timer:', error);
	}
}

/**
 * Complete a service.
 */
export async function completeTimer(booking: Booking) {
	// Calculate final duration
	let finalElapsed = booking.timerElapsed || 0;
	if (booking.isTimerRunning && booking.timerStart) {
		finalElapsed += (Date.now() - booking.timerStart) / 1000;
	}

	const updates: Partial<Booking> = {
		status: 'completed',
		isTimerRunning: false,
		timerStart: deleteField() as any,
		activeDuration: Math.round(finalElapsed / 60), // Save in minutes for report
		completedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	try {
		await updateDoc(doc(db, 'bookings', booking.id), updates);
	} catch (error) {
		console.error('Error completing service:', error);
	}
}

// --- Helpers ---

/**
 * Helper to pause all *other* running timers.
 * This ensures mutual exclusivity.
 */
async function pauseAllOtherTimers(exceptBookingId: string) {
	// Query for all bookings where isTimerRunning == true
	// We can't easily do "id != exceptBookingId" in Firestore, so fetch all running and filter.
	const q = query(collection(db, 'bookings'), where('isTimerRunning', '==', true));

	try {
		const snapshot = await getDocs(q);
		const updatePromises = snapshot.docs
			.filter((d) => d.id !== exceptBookingId)
			.map((d) => {
				const data = d.data() as Booking;
				// Calculate elapsed for this session
				const currentSession = data.timerStart ? (Date.now() - data.timerStart) / 1000 : 0;
				const newElapsed = (data.timerElapsed || 0) + currentSession;

				return updateDoc(d.ref, {
					isTimerRunning: false,
					timerElapsed: Math.floor(newElapsed),
					timerStart: deleteField(), // Clear it
					updatedAt: new Date().toISOString()
				});
			});

		await Promise.all(updatePromises);
	} catch (error) {
		console.error('Error auto-pausing other timers:', error);
	}
}

// --- UI Helper ---

/**
 * Calculate the current display elapsed time (in seconds) for a booking.
 * Intended to be used within a reactive statement in Svelte, passing $now.
 */
export function getElapsedSeconds(booking: Booking, nowTimestamp: number): number {
	let seconds = booking.timerElapsed || 0;
	if (booking.isTimerRunning && booking.timerStart) {
		seconds += (nowTimestamp - booking.timerStart) / 1000;
	}
	return Math.floor(seconds);
}

import { json } from '@sveltejs/kit';
import { db } from '$lib/firebase'; // Ensure this points to your initialized firebase instance (server-side safe if possible, client SDK is fine if used carefully)
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

// Define a secret key. In production, use process.env.CRON_SECRET
// For Vercel, you would add this to Environment Variables
const CRON_SECRET = 'e293136c-2650-4fb6-82be-15c34c261161';

export async function POST({ request }) {
	// 1. Security Check
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		console.log('[API] Starting auto-cancellation cleanup...');
		const now = Date.now();
		const oneHour = 60 * 60 * 1000;

		// 2. Query Pending Bookings
		// Note: We can't easily filter by "overdue" in Firestore query without storing a computed timestamp
		// So we fetch all pending and filter in memory. If list is huge, this might need index changes.
		const q = query(collection(db, 'bookings'), where('status', '==', 'pending'));
		const querySnapshot = await getDocs(q);

		const overdueBookings = [];

		querySnapshot.forEach((doc) => {
			const data = doc.data();

			// Helper to get timestamp (copied logic from adminData.ts to allow server independence)
			let ts = 0;
			if (data.date) {
				if (data.date.seconds) ts = data.date.seconds * 1000;
				else if (typeof data.date === 'string' && data.date.includes('-')) {
					const parts = data.date.split('-');
					if (parts.length === 3 && parts[2].length === 4) {
						ts = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
					}
				} else {
					ts = new Date(data.date).getTime();
				}
			} else if (data.createdAt) {
				ts = data.createdAt.seconds
					? data.createdAt.seconds * 1000
					: new Date(data.createdAt).getTime();
			}

			// Check if overdue
			// Appointment Time + 1 Hour < Now
			if (ts + oneHour < now) {
				overdueBookings.push(doc.id);
			}
		});

		console.log(`[API] Found ${overdueBookings.length} overdue bookings.`);

		// 3. Batch Update (or individual updates)
		let cancelledCount = 0;
		const updatePromises = overdueBookings.map(async (id) => {
			try {
				await updateDoc(doc(db, 'bookings', id), {
					status: 'cancelled',
					updatedAt: new Date().toISOString(),
					cancelledBy: 'system-cron'
				});
				cancelledCount++;
			} catch (err) {
				console.error(`[API] Failed to cancel booking ${id}:`, err);
			}
		});

		await Promise.all(updatePromises);

		return json({
			success: true,
			message: `Cancelled ${cancelledCount} overdue bookings`,
			processed: overdueBookings.length
		});
	} catch (error) {
		console.error('[API] Error in cleanup-bookings:', error);
		return json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
	}
}

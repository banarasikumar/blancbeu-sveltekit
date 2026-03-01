import { db } from '$lib/firebase';
import {
	collection,
	addDoc,
	getDocs,
	query,
	where,
	serverTimestamp,
	updateDoc,
	doc
} from 'firebase/firestore';
import { services } from '$lib/data/services';

export async function migrateServices() {
	console.log('Starting service migration...');
	let addedCount = 0;
	let skippedCount = 0;
	let errors = 0;

	const servicesCollection = collection(db, 'services');

	for (const service of services) {
		try {
			// Check if service with this name already exists
			const q = query(servicesCollection, where('name', '==', service.name));
			const querySnapshot = await getDocs(q);

			// Prepare data
			// Note: service.image from data/services.ts is already processed by getImg to return "/assets/..."
			// We'll use that as the image URL for now.
			// If we wanted to upload to Storage, we'd need the actual file, which we don't have here (just path).
			// So we'll save the path string.

			const serviceData = {
				name: service.name,
				category: service.category,
				price: service.price,
				originalPrice: service.originalPrice || null, // Capture original price
				duration: parseInt(service.duration) || 30, // Attempt to parse "30 min", fallback 30
				description: service.description || '', // Capture description
				image: service.image,
				rating: service.rating,
				reviews: service.reviews,
				legacyId: service.id,
				isActive: service.isActive !== undefined ? service.isActive : true,
				updatedAt: new Date().toISOString()
			};

			// Parse duration correctly
			if (typeof service.duration === 'string') {
				if (service.duration.includes('hr')) {
					const parts = service.duration.split(' ');
					const val = parseFloat(parts[0]);
					serviceData.duration = val * 60;
				} else {
					const val = parseInt(service.duration);
					if (!isNaN(val)) serviceData.duration = val;
				}
			}

			if (!querySnapshot.empty) {
				// Update existing
				const docId = querySnapshot.docs[0].id;
				// We use setDoc or updateDoc. Since we want to overwrite most fields but keep ID:
				// Actually updateDoc is safer to preserve other potential fields, but we want to ensure description is set.
				// Let's use updateDoc on the found doc.
				await updateDoc(doc(servicesCollection, docId), serviceData);
				console.log(`Updated: ${service.name}`);
				addedCount++; // Count as processed
			} else {
				// Create new
				await addDoc(servicesCollection, {
					...serviceData,
					createdAt: serverTimestamp()
				});
				console.log(`Migrated (New): ${service.name}`);
				addedCount++;
			}
		} catch (error) {
			console.error(`Error migrating ${service.name}:`, error);
			errors++;
		}
	}

	return { added: addedCount, skipped: skippedCount, errors };
}

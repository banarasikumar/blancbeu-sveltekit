// One-time script: Import cleaned_contacts.json as walk-in users into Firestore
// Usage: node import_walkins.js
//
// Uses Firebase Admin SDK (bypasses security rules)

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize with project ID (uses Application Default Credentials or just project config)
admin.initializeApp({ projectId: 'blancbeu-60b2a' });
const db = admin.firestore();

// Read contacts
const contacts = JSON.parse(readFileSync('./cleaned_contacts.json', 'utf8'));
console.log(`Loaded ${contacts.length} contacts from cleaned_contacts.json`);

function normalizePhone(phone) {
	return phone.replace(/\D/g, '').slice(-10);
}

async function phoneExists(digits10) {
	const formats = [digits10, `+91${digits10}`];
	for (const fmt of formats) {
		const snap = await db.collection('users').where('phone', '==', fmt).limit(1).get();
		if (!snap.empty) return true;
	}
	return false;
}

async function run() {
	let added = 0;
	let skippedDuplicate = 0;
	let skippedNoPhone = 0;
	let errors = 0;

	// Firestore writeBatch supports max 500 operations
	const BATCH_SIZE = 400;
	let batch = db.batch();
	let batchCount = 0;

	for (let i = 0; i < contacts.length; i++) {
		const contact = contacts[i];
		const rawPhone = contact.phone?.trim();

		if (!rawPhone) {
			skippedNoPhone++;
			continue;
		}

		const digits = normalizePhone(rawPhone);
		if (digits.length < 10) {
			console.log(`  Skipping invalid phone: ${rawPhone}`);
			skippedNoPhone++;
			continue;
		}

		// Check for duplicate
		try {
			const exists = await phoneExists(digits);
			if (exists) {
				console.log(`  Dup: ${digits} (${contact.name || 'no name'})`);
				skippedDuplicate++;
				continue;
			}
		} catch (e) {
			console.error(`  Error checking phone ${digits}:`, e.message);
			errors++;
			continue;
		}

		const name = (contact.name || '').trim();
		const displayName = name || 'Walk-in Customer';
		const phone = `+91${digits}`;

		const newDocRef = db.collection('users').doc();

		batch.set(newDocRef, {
			name: displayName,
			displayName: displayName,
			phone: phone,
			accountType: 'walkin',
			accountStatus: 'shadow',
			profileCompleted: false,
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			updatedAt: admin.firestore.FieldValue.serverTimestamp(),
			createdBy: 'bulk_import'
		});

		added++;
		batchCount++;

		if (batchCount >= BATCH_SIZE) {
			console.log(`  Committing batch of ${batchCount}...`);
			await batch.commit();
			batch = db.batch();
			batchCount = 0;
		}

		if ((i + 1) % 20 === 0) {
			console.log(`  Processed ${i + 1}/${contacts.length}...`);
		}
	}

	// Commit remaining
	if (batchCount > 0) {
		console.log(`  Committing final batch of ${batchCount}...`);
		await batch.commit();
	}

	console.log('\n=== Import Complete ===');
	console.log(`  Added:             ${added}`);
	console.log(`  Skipped (dup):     ${skippedDuplicate}`);
	console.log(`  Skipped (no phone):${skippedNoPhone}`);
	console.log(`  Errors:            ${errors}`);
	console.log(`  Total processed:   ${contacts.length}`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

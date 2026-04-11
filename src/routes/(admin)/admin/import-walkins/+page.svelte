<script lang="ts">
	import { db } from '$lib/firebase';
	import { collection, query, where, getDocs, writeBatch, serverTimestamp, doc, limit } from 'firebase/firestore';
	import { showToast } from '$lib/stores/toast';
	import { ArrowLeft, Upload, CheckCircle, XCircle } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import contactsData from '$lib/data/cleaned_contacts.json';

	let isRunning = $state(false);
	let log = $state<string[]>([]);
	let result = $state<{ added: number; skipped: number; errors: number } | null>(null);

	function normalizePhone(phone: string): string {
		return phone.replace(/\D/g, '').slice(-10);
	}

	async function phoneExists(digits10: string): Promise<boolean> {
		const formats = [digits10, `+91${digits10}`];
		for (const fmt of formats) {
			const q = query(collection(db, 'users'), where('phone', '==', fmt), limit(1));
			const snap = await getDocs(q);
			if (!snap.empty) return true;
		}
		return false;
	}

	async function runImport() {
		if (isRunning) return;
		if (!confirm(`Import ${contactsData.length} contacts as walk-in users?`)) return;

		isRunning = true;
		log = [];
		result = null;

		let added = 0;
		let skipped = 0;
		let errors = 0;

		const BATCH_SIZE = 400;
		let batch = writeBatch(db);
		let batchCount = 0;

		for (let i = 0; i < contactsData.length; i++) {
			const contact = contactsData[i];
			const rawPhone = contact.phone?.trim();

			if (!rawPhone) {
				skipped++;
				continue;
			}

			const digits = normalizePhone(rawPhone);
			if (digits.length < 10) {
				log = [...log, `Skip invalid: ${rawPhone}`];
				skipped++;
				continue;
			}

			try {
				const exists = await phoneExists(digits);
				if (exists) {
					log = [...log, `Dup: +91${digits} (${contact.name || 'no name'})`];
					skipped++;
					continue;
				}
			} catch (e: any) {
				log = [...log, `Error: ${digits} - ${e.message}`];
				errors++;
				continue;
			}

			const name = (contact.name || '').trim();
			const displayName = name || 'Walk-in Customer';
			const phone = `+91${digits}`;

			const newDocRef = doc(collection(db, 'users'));

			batch.set(newDocRef, {
				name: displayName,
				displayName: displayName,
				phone: phone,
				accountType: 'walkin',
				accountStatus: 'shadow',
				profileCompleted: false,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
				createdBy: 'bulk_import'
			});

			added++;
			batchCount++;
			log = [...log, `+ ${displayName} (${phone})`];

			if (batchCount >= BATCH_SIZE) {
				log = [...log, `Committing batch of ${batchCount}...`];
				await batch.commit();
				batch = writeBatch(db);
				batchCount = 0;
			}
		}

		if (batchCount > 0) {
			log = [...log, `Committing final batch of ${batchCount}...`];
			await batch.commit();
		}

		result = { added, skipped, errors };
		showToast(`Imported ${added} walk-in users (${skipped} skipped, ${errors} errors)`, added > 0 ? 'success' : 'error');
		isRunning = false;
	}
</script>

<div class="admin-view-header">
	<div style="display: flex; align-items: center; gap: 10px;">
		<button class="admin-recycle-btn" onclick={() => goto('/admin/users')} title="Back">
			<ArrowLeft size={18} />
		</button>
		<h2 class="admin-view-title" style="margin: 0;">Import Walk-ins</h2>
	</div>
</div>

<div style="padding: 16px 0;">
	<p style="color: var(--admin-text-secondary); font-size: 13px; margin-bottom: 16px;">
		Import <strong>{contactsData.length}</strong> contacts from <code>cleaned_contacts.json</code> as walk-in users.
		Duplicates (by phone) will be skipped.
	</p>

	<button
		class="admin-manage-delete-btn"
		style="background: linear-gradient(135deg, #30D158 0%, #28a745 100%); box-shadow: 0 2px 8px rgba(48,209,88,0.25); width: 100%; justify-content: center; padding: 12px; font-size: 14px;"
		disabled={isRunning}
		onclick={runImport}
	>
		<Upload size={18} />
		{isRunning ? 'Importing...' : 'Start Import'}
	</button>

	{#if result}
		<div style="margin-top: 16px; padding: 14px; border-radius: 12px; background: var(--admin-surface); border: 1px solid var(--admin-border);">
			<div style="display: flex; gap: 16px; flex-wrap: wrap;">
				<div style="display: flex; align-items: center; gap: 6px; color: #30D158; font-weight: 700;">
					<CheckCircle size={16} /> {result.added} added
				</div>
				<div style="display: flex; align-items: center; gap: 6px; color: var(--admin-orange); font-weight: 700;">
					{result.skipped} skipped
				</div>
				{#if result.errors > 0}
					<div style="display: flex; align-items: center; gap: 6px; color: var(--admin-red); font-weight: 700;">
						<XCircle size={16} /> {result.errors} errors
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if log.length > 0}
		<div style="margin-top: 12px; max-height: 400px; overflow-y: auto; padding: 12px; border-radius: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); font-family: 'SF Mono', monospace; font-size: 11px; line-height: 1.6; color: var(--admin-text-secondary);">
			{#each log as entry}
				<div>{entry}</div>
			{/each}
		</div>
	{/if}
</div>

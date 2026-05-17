<script lang="ts">
	import { db } from '$lib/firebase';
	import {
		collection,
		query,
		where,
		getDocs,
		writeBatch,
		serverTimestamp,
		doc,
		limit,
		updateDoc
	} from 'firebase/firestore';
	import { showToast } from '$lib/stores/toast';
	import { ArrowLeft, Upload, CheckCircle, XCircle, FileText, RefreshCw } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	let isRunning = $state(false);
	let log = $state<string[]>([]);
	let result = $state<{ added: number; skipped: number; updated: number; errors: number } | null>(
		null
	);
	let parsedContacts = $state<
		Array<{ name: string; phone?: string; email?: string }>
	>([]);
	let fileSelected = $state(false);
	let fileName = $state('');

	// ── VCF Parsing ──────────────────────────────────────────────

	function decodeQuotedPrintable(str: string): string {
		// Join continuation lines (lines ending with =)
		const joined = str.replace(/=\r?\n/g, '');
		// Decode hex sequences
		const decoded = joined.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
			String.fromCharCode(parseInt(hex, 16))
		);
		// Try to decode as UTF-8 from raw bytes
		try {
			const bytes = new Uint8Array(
				decoded.split('').map((c) => c.charCodeAt(0))
			);
			return new TextDecoder('utf-8').decode(bytes);
		} catch {
			return decoded;
		}
	}

	function parseVCF(text: string): Array<{ name: string; phone?: string; email?: string }> {
		const contacts: Array<{ name: string; phone?: string; email?: string }> = [];
		// Split into individual vCard blocks
		const vcards = text.split(/BEGIN:VCARD/i).slice(1);

		for (const block of vcards) {
			let name = '';
			let phone: string | undefined;
			let email: string | undefined;

			// Unfold continuation lines (RFC 2425: line starting with space/tab is continuation)
			const unfolded = block.replace(/\r?\n[ \t]/g, '');
			const lines = unfolded.split(/\r?\n/);

			for (const line of lines) {
				const upper = line.toUpperCase();

				// ── Full Name (FN) ──
				if (upper.startsWith('FN')) {
					if (upper.includes('ENCODING=QUOTED-PRINTABLE')) {
						const valPart = line.split(':').slice(1).join(':');
						name = decodeQuotedPrintable(valPart);
					} else {
						name = line.split(':').slice(1).join(':').trim();
					}
				}

				// ── Phone (TEL) ──
				if (upper.startsWith('TEL') && !phone) {
					const valPart = line.split(':').slice(1).join(':').trim();
					if (valPart) phone = valPart;
				}

				// ── Email ──
				if (upper.startsWith('EMAIL')) {
					const valPart = line.split(':').slice(1).join(':').trim();
					if (valPart) email = valPart.toLowerCase();
				}
			}

			// Clean up name
			name = name.replace(/[\r\n]/g, '').trim();
			// Strip emojis-only names that are meaningless
			const textOnly = name.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '').trim();
			if (!textOnly) name = '';

			contacts.push({ name, phone, email });
		}
		return contacts;
	}

	function normalizePhone(phone: string): string {
		return phone.replace(/\D/g, '').slice(-10);
	}

	// ── File handling ────────────────────────────────────────────

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		fileName = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			parsedContacts = parseVCF(text);
			fileSelected = true;
			log = [`Parsed ${parsedContacts.length} contacts from ${file.name}`];
		};
		reader.readAsText(file);
	}

	// ── Firestore lookups ────────────────────────────────────────

	async function findUserByPhone(
		digits10: string
	): Promise<{ id: string; [key: string]: any } | null> {
		const formats = [digits10, `+91${digits10}`];
		for (const fmt of formats) {
			const q = query(collection(db, 'users'), where('phone', '==', fmt), limit(1));
			const snap = await getDocs(q);
			if (!snap.empty) {
				const d = snap.docs[0];
				return { id: d.id, ...d.data() };
			}
		}
		return null;
	}

	async function findUserByEmail(
		email: string
	): Promise<{ id: string; [key: string]: any } | null> {
		const q = query(
			collection(db, 'users'),
			where('email', '==', email.toLowerCase().trim()),
			limit(1)
		);
		const snap = await getDocs(q);
		if (!snap.empty) {
			const d = snap.docs[0];
			return { id: d.id, ...d.data() };
		}
		return null;
	}

	// ── Main import logic ────────────────────────────────────────

	async function runImport() {
		if (isRunning || parsedContacts.length === 0) return;
		if (!confirm(`Import ${parsedContacts.length} contacts as walk-in users?`)) return;

		isRunning = true;
		log = [];
		result = null;

		let added = 0;
		let skipped = 0;
		let updated = 0;
		let errors = 0;

		const BATCH_SIZE = 400;
		let batch = writeBatch(db);
		let batchCount = 0;
		// Docs that need individual updateDoc (can't update existing docs in a set-only batch easily)
		const pendingUpdates: Array<{ docId: string; data: Record<string, any> }> = [];

		for (let i = 0; i < parsedContacts.length; i++) {
			const contact = parsedContacts[i];
			const rawPhone = contact.phone?.trim();
			const rawEmail = contact.email?.trim();
			const contactName = contact.name || '';

			// Skip contacts with neither phone nor email
			if (!rawPhone && !rawEmail) {
				log = [...log, `⊘ Skip (no phone/email): "${contactName || 'unnamed'}"`];
				skipped++;
				continue;
			}

			// Normalize phone
			let digits = '';
			let validPhone = false;
			if (rawPhone) {
				digits = normalizePhone(rawPhone);
				validPhone = digits.length >= 10;
				if (!validPhone) {
					log = [...log, `⊘ Skip invalid phone: ${rawPhone} ("${contactName}")`];
					// Still try email if available
					if (!rawEmail) {
						skipped++;
						continue;
					}
				}
			}

			try {
				// ─── Step 1: Check by phone number first ───
				if (validPhone) {
					const existingByPhone = await findUserByPhone(digits);
					if (existingByPhone) {
						// Phone exists → ignore name, but fill missing email
						if (rawEmail && !existingByPhone.email) {
							pendingUpdates.push({
								docId: existingByPhone.id,
								data: { email: rawEmail.toLowerCase(), updatedAt: serverTimestamp() }
							});
							log = [
								...log,
								`✎ Updated email for +91${digits}: added ${rawEmail}`
							];
							updated++;
						} else {
							log = [
								...log,
								`⊘ Exists (phone): +91${digits} ("${existingByPhone.name || existingByPhone.displayName || contactName}")`
							];
							skipped++;
						}
						continue;
					}
				}

				// ─── Step 2: Phone not found → check by email ───
				if (rawEmail) {
					const existingByEmail = await findUserByEmail(rawEmail);
					if (existingByEmail) {
						// Email exists → fill missing phone
						if (validPhone && !existingByEmail.phone) {
							pendingUpdates.push({
								docId: existingByEmail.id,
								data: { phone: `+91${digits}`, updatedAt: serverTimestamp() }
							});
							log = [
								...log,
								`✎ Updated phone for ${rawEmail}: added +91${digits}`
							];
							updated++;
						} else {
							log = [
								...log,
								`⊘ Exists (email): ${rawEmail} ("${existingByEmail.name || existingByEmail.displayName || contactName}")`
							];
							skipped++;
						}
						continue;
					}
				}

				// ─── Step 3: No match → create new walk-in ───
				const displayName = contactName || 'Walk-in Customer';
				const newDocRef = doc(collection(db, 'users'));
				const newData: Record<string, any> = {
					name: displayName,
					displayName: displayName,
					accountType: 'walkin',
					accountStatus: 'shadow',
					profileCompleted: false,
					createdAt: serverTimestamp(),
					updatedAt: serverTimestamp(),
					createdBy: 'vcf_import'
				};
				if (validPhone) newData.phone = `+91${digits}`;
				if (rawEmail) newData.email = rawEmail.toLowerCase();

				batch.set(newDocRef, newData);
				added++;
				batchCount++;

				const identifiers = [
					validPhone ? `+91${digits}` : null,
					rawEmail || null
				]
					.filter(Boolean)
					.join(', ');
				log = [...log, `+ ${displayName} (${identifiers})`];

				if (batchCount >= BATCH_SIZE) {
					log = [...log, `💾 Committing batch of ${batchCount}...`];
					await batch.commit();
					batch = writeBatch(db);
					batchCount = 0;
				}
			} catch (e: any) {
				log = [...log, `✖ Error: ${contactName || rawPhone || rawEmail} - ${e.message}`];
				errors++;
			}
		}

		// Commit remaining batch
		if (batchCount > 0) {
			log = [...log, `💾 Committing final batch of ${batchCount}...`];
			await batch.commit();
		}

		// Run pending updates (fill missing fields on existing docs)
		if (pendingUpdates.length > 0) {
			log = [...log, `✎ Applying ${pendingUpdates.length} field updates...`];
			for (const upd of pendingUpdates) {
				try {
					await updateDoc(doc(db, 'users', upd.docId), upd.data);
				} catch (e: any) {
					log = [...log, `✖ Update error for ${upd.docId}: ${e.message}`];
					errors++;
					updated--;
				}
			}
		}

		result = { added, skipped, updated, errors };
		showToast(
			`Done: ${added} added, ${updated} updated, ${skipped} skipped, ${errors} errors`,
			added > 0 || updated > 0 ? 'success' : 'error'
		);
		isRunning = false;
	}
</script>

<div class="admin-view-header">
	<div style="display: flex; align-items: center; gap: 10px;">
		<button class="admin-recycle-btn" onclick={() => goto('/admin/users')} title="Back">
			<ArrowLeft size={18} />
		</button>
		<h2 class="admin-view-title" style="margin: 0;">Import Walk-ins (VCF)</h2>
	</div>
</div>

<div style="padding: 16px 0;">
	<p style="color: var(--admin-text-secondary); font-size: 13px; margin-bottom: 16px;">
		Upload a <strong>.vcf</strong> contacts file. Contacts are imported as walk-in users with smart
		merge:
	</p>

	<div
		style="background: var(--admin-surface); border: 1px solid var(--admin-border); border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 12px; color: var(--admin-text-secondary); line-height: 1.7;"
	>
		<strong style="color: var(--admin-text);">📋 Import Rules:</strong><br />
		1. <strong>Phone match found</strong> → skip name, but fill missing email<br />
		2. <strong>No phone match, email match found</strong> → fill missing phone<br />
		3. <strong>No match at all</strong> → create new walk-in user<br />
		4. <strong>No phone & no email</strong> → skip entirely
	</div>

	<!-- File picker -->
	<label
		style="display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 12px; border: 2px dashed var(--admin-border); cursor: pointer; transition: border-color 0.2s;"
	>
		<FileText size={20} style="color: var(--admin-text-secondary);" />
		<div>
			{#if fileSelected}
				<span style="font-weight: 600; color: var(--admin-text);">{fileName}</span>
				<span style="color: var(--admin-text-secondary); font-size: 12px;">
					— {parsedContacts.length} contacts parsed
				</span>
			{:else}
				<span style="color: var(--admin-text-secondary);">Choose .vcf file...</span>
			{/if}
		</div>
		<input
			type="file"
			accept=".vcf"
			onchange={handleFileSelect}
			style="display: none;"
		/>
	</label>

	<!-- Import button -->
	{#if fileSelected}
		<button
			class="admin-manage-delete-btn"
			style="background: linear-gradient(135deg, #30D158 0%, #28a745 100%); box-shadow: 0 2px 8px rgba(48,209,88,0.25); width: 100%; justify-content: center; padding: 12px; font-size: 14px; margin-top: 12px;"
			disabled={isRunning}
			onclick={runImport}
		>
			{#if isRunning}
				<RefreshCw size={18} class="spin" />
				Importing...
			{:else}
				<Upload size={18} />
				Import {parsedContacts.length} Contacts
			{/if}
		</button>
	{/if}

	<!-- Results summary -->
	{#if result}
		<div
			style="margin-top: 16px; padding: 14px; border-radius: 12px; background: var(--admin-surface); border: 1px solid var(--admin-border);"
		>
			<div style="display: flex; gap: 16px; flex-wrap: wrap;">
				<div
					style="display: flex; align-items: center; gap: 6px; color: #30D158; font-weight: 700;"
				>
					<CheckCircle size={16} />
					{result.added} added
				</div>
				<div
					style="display: flex; align-items: center; gap: 6px; color: #007AFF; font-weight: 700;"
				>
					✎ {result.updated} updated
				</div>
				<div
					style="display: flex; align-items: center; gap: 6px; color: var(--admin-orange); font-weight: 700;"
				>
					{result.skipped} skipped
				</div>
				{#if result.errors > 0}
					<div
						style="display: flex; align-items: center; gap: 6px; color: var(--admin-red); font-weight: 700;"
					>
						<XCircle size={16} />
						{result.errors} errors
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Log output -->
	{#if log.length > 0}
		<div
			style="margin-top: 12px; max-height: 400px; overflow-y: auto; padding: 12px; border-radius: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); font-family: 'SF Mono', monospace; font-size: 11px; line-height: 1.6; color: var(--admin-text-secondary);"
		>
			{#each log as entry}
				<div>{entry}</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>

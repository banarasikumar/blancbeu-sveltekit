<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, fly, slide } from 'svelte/transition';
	import { auth, db } from '$lib/firebase';
	import {
		collection,
		query,
		onSnapshot,
		addDoc,
		deleteDoc,
		doc,
		updateDoc,
		serverTimestamp
	} from 'firebase/firestore';
	import { onMount, onDestroy } from 'svelte';
	import {
		ChevronLeft,
		Plus,
		MapPin,
		Home,
		Briefcase,
		MoreVertical,
		Trash2,
		Edit2,
		CheckCircle,
		X
	} from 'lucide-svelte';
	import { showToast } from '$lib/stores/toast';

	let user = $state<any>(null);
	let loading = $state(true);
	let addresses = $state<any[]>([]);
	let showAddModal = $state(false);
	let isEditing = $state(false);
	let editId = $state<string | null>(null);
	let saving = $state(false);

	// Form Data
	let formData = $state({
		label: 'Home', // Home, Work, Other
		addressLine1: '',
		addressLine2: '',
		city: '',
		zipCode: '',
		isDefault: false
	});

	let unsubscribeAuth: () => void;
	let unsubscribeAddresses: () => void;

	onMount(() => {
		unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
			if (currentUser) {
				user = currentUser;
				subscribeToAddresses(user.uid);
			} else {
				goto('/login');
			}
			loading = false;
		});
	});

	onDestroy(() => {
		if (unsubscribeAuth) unsubscribeAuth();
		if (unsubscribeAddresses) unsubscribeAddresses();
	});

	function subscribeToAddresses(uid: string) {
		const q = query(collection(db, `users/${uid}/addresses`));
		unsubscribeAddresses = onSnapshot(q, (snapshot) => {
			addresses = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
		});
	}

	function openAddModal() {
		isEditing = false;
		editId = null;
		formData = {
			label: 'Home',
			addressLine1: '',
			addressLine2: '',
			city: '',
			zipCode: '',
			isDefault: addresses.length === 0 // Default true if first address
		};
		showAddModal = true;
	}

	function openEditModal(addr: any) {
		isEditing = true;
		editId = addr.id;
		formData = {
			label: addr.label || 'Home',
			addressLine1: addr.addressLine1 || '',
			addressLine2: addr.addressLine2 || '',
			city: addr.city || '',
			zipCode: addr.zipCode || '',
			isDefault: addr.isDefault || false
		};
		showAddModal = true;
	}

	async function saveAddress() {
		if (!user) return;

		// Validation
		if (!formData.addressLine1 || !formData.city || !formData.zipCode) {
			showToast('Please fill in all required fields.', 'error');
			return;
		}

		saving = true;
		try {
			const addressData = {
				...formData,
				updatedAt: serverTimestamp()
			};

			if (isEditing && editId) {
				await updateDoc(doc(db, `users/${user.uid}/addresses`, editId), addressData);
				showToast('Address updated successfully!', 'success');
			} else {
				const docRef = await addDoc(collection(db, `users/${user.uid}/addresses`), {
					...addressData,
					createdAt: serverTimestamp()
				});

				// Handle Default Logic: If this is set to default, unset others (client-side opt mostly, theoretically cloud function better)
				// For simple app, we can just update others if this is default.
			}

			// If setting as default, unset others
			if (formData.isDefault) {
				// This is a bit heavy for client side if many addresses, but fine for < 10
				addresses.forEach(async (addr) => {
					if (addr.id !== (isEditing ? editId : null) && addr.isDefault) {
						await updateDoc(doc(db, `users/${user.uid}/addresses`, addr.id), { isDefault: false });
					}
				});
			}

			showAddModal = false;
		} catch (e) {
			console.error('Error saving address:', e);
			showToast('Failed to save address.', 'error');
		} finally {
			saving = false;
		}
	}

	async function deleteAddress(id: string) {
		if (confirm('Are you sure you want to delete this address?')) {
			try {
				await deleteDoc(doc(db, `users/${user.uid}/addresses`, id));
				showToast('Address deleted.', 'success');
			} catch (e) {
				console.error('Error deleting address:', e);
				showToast('Failed to delete address.', 'error');
			}
		}
	}

	function handleBack() {
		goto('/you');
	}
</script>

<div class="page-container" in:fade={{ duration: 300 }}>
	<!-- HEADER -->
	<header class="page-header">
		<button class="icon-btn" on:click={handleBack}>
			<ChevronLeft size={24} />
		</button>
		<h1 class="page-title">Addresses</h1>
		<div class="spacer"></div>
	</header>

	<main class="content-scroll">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
			</div>
		{:else if addresses.length === 0}
			<!-- EMPTY STATE -->
			<div class="empty-state" in:fly={{ y: 20 }}>
				<div class="empty-icon">
					<MapPin size={48} />
				</div>
				<h3>No Addresses Found</h3>
				<p>Add an address to speed up your bookings.</p>
				<button class="cta-btn" on:click={openAddModal}>
					<Plus size={20} /> Add New Address
				</button>
			</div>
		{:else}
			<!-- ADDRESS LIST -->
			<div class="address-list" in:fly={{ y: 20, delay: 100 }}>
				{#each addresses as addr (addr.id)}
					<div class="address-card" class:default={addr.isDefault}>
						<div class="card-icon">
							{#if addr.label === 'Work'}
								<Briefcase size={20} />
							{:else}
								<Home size={20} />
							{/if}
						</div>
						<div class="card-content">
							<div class="card-header">
								<span class="addr-label">{addr.label}</span>
								{#if addr.isDefault}
									<span class="default-badge">Default</span>
								{/if}
							</div>
							<p class="addr-text">{addr.addressLine1}</p>
							{#if addr.addressLine2}<p class="addr-text">{addr.addressLine2}</p>{/if}
							<p class="addr-sub">{addr.city}, {addr.zipCode}</p>
						</div>
						<div class="card-actions">
							<button class="action-btn edit" on:click={() => openEditModal(addr)}>
								<Edit2 size={16} />
							</button>
							<button class="action-btn delete" on:click={() => deleteAddress(addr.id)}>
								<Trash2 size={16} />
							</button>
						</div>
					</div>
				{/each}

				<button class="add-fab" on:click={openAddModal}>
					<Plus size={24} />
				</button>
			</div>
		{/if}
	</main>

	<!-- ADD/EDIT MODAL -->
	{#if showAddModal}
		<div
			class="modal-overlay"
			transition:fade={{ duration: 200 }}
			on:click={() => (showAddModal = false)}
		>
			<div class="modal-content" transition:fly={{ y: 50, duration: 300 }} on:click|stopPropagation>
				<div class="modal-header">
					<h2>{isEditing ? 'Edit Address' : 'New Address'}</h2>
					<button class="close-btn" on:click={() => (showAddModal = false)}>
						<X size={20} />
					</button>
				</div>

				<div class="modal-body">
					<!-- Label Selection -->
					<div class="label-group">
						{#each ['Home', 'Work', 'Other'] as lbl}
							<button
								class="choice-chip"
								class:active={formData.label === lbl}
								on:click={() => (formData.label = lbl)}
							>
								{lbl}
							</button>
						{/each}
					</div>

					<input
						type="text"
						class="modal-input"
						placeholder="Address Line 1"
						bind:value={formData.addressLine1}
					/>
					<input
						type="text"
						class="modal-input"
						placeholder="Address Line 2 (Optional)"
						bind:value={formData.addressLine2}
					/>
					<div class="row">
						<input type="text" class="modal-input" placeholder="City" bind:value={formData.city} />
						<input
							type="text"
							class="modal-input"
							placeholder="Zip Code"
							bind:value={formData.zipCode}
						/>
					</div>

					<label class="checkbox-row">
						<input type="checkbox" bind:checked={formData.isDefault} />
						<span class="checkbox-text">Set as default address</span>
					</label>

					<button class="save-btn-modal" on:click={saveAddress} disabled={saving}>
						{saving ? 'Saving...' : 'Save Address'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* REUSING STYLES FROM PERSONAL DETAILS BUT ADAPTED */
	.page-container {
		min-height: 100vh;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		display: flex;
		flex-direction: column;
	}

	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		background: rgba(var(--color-bg-primary-rgb), 0.85);
		backdrop-filter: blur(12px);
		position: sticky;
		top: 0;
		z-index: 50;
		border-bottom: 1px solid var(--color-border);
	}

	.page-title {
		font-family: var(--font-heading);
		font-size: 1.1rem;
		margin: 0;
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
	}

	.icon-btn {
		background: var(--color-surface);
		color: var(--color-text-primary);
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
	}

	.spacer {
		width: 40px;
	}

	.content-scroll {
		flex: 1;
		padding: 20px;
		overflow-y: auto;
	}

	/* EMPTY STATE */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-top: 60px;
		text-align: center;
		opacity: 0.7;
	}
	.empty-icon {
		width: 80px;
		height: 80px;
		background: var(--color-surface);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;
		color: var(--color-accent-gold);
	}
	.empty-state h3 {
		margin: 0 0 8px 0;
	}
	.cta-btn {
		margin-top: 20px;
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		border: none;
		padding: 12px 24px;
		border-radius: var(--radius-full);
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* ADDRESS CARDS */
	.address-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		/* Ensure content can scroll completely into view */
		padding-bottom: 20px;
	}

	/* Ensure the scroll container has enough space at the bottom to scroll the last item into view ABOVE the nav bar */
	.content-scroll::after {
		content: '';
		display: block;
		height: 80px; /* Approximate height of Nav Bar + FAB spacing */
	}

	.address-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 16px;
		display: flex;
		gap: 16px;
		position: relative;
		transition: all 0.2s;
	}

	.address-card.default {
		border-color: var(--color-accent-gold);
		background: rgba(var(--color-accent-gold-rgb), 0.05);
	}

	.card-content {
		flex: 1;
	}

	.card-icon {
		color: var(--color-accent-gold);
		margin-top: 2px;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}
	.addr-label {
		font-weight: 600;
		font-size: 1rem;
	}
	.default-badge {
		font-size: 0.65rem;
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 700;
	}
	.addr-text {
		font-size: 0.9rem;
		margin: 0;
		line-height: 1.4;
		color: var(--color-text-secondary);
	}
	.addr-sub {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.card-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.action-btn {
		background: transparent;
		color: var(--color-text-muted);
		padding: 8px;
		border-radius: 50%;
	}
	.action-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}
	.action-btn.delete:hover {
		color: #ff3b30;
	}

	/* FAB */
	.add-fab {
		position: fixed;
		bottom: 90px; /* Above Nav Bar specific adjust */
		right: 20px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 40;
	}

	/* MODAL */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
		z-index: 9999; /* Increased Z-Index to be above everything */
		display: flex;
		align-items: flex-end; /* Bottom sheet on mobile */
	}
	@media (min-width: 768px) {
		.modal-overlay {
			align-items: center;
			justify-content: center;
		}
	}

	.modal-content {
		background: var(--color-bg-secondary);
		width: 100%;
		max-width: 500px; /* Desktop max */
		border-radius: 20px 20px 0 0;
		padding: 24px;
		border-top: 1px solid var(--color-border);
	}
	@media (min-width: 768px) {
		.modal-content {
			border-radius: 20px;
		}
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}
	.modal-header h2 {
		font-size: 1.25rem;
		margin: 0;
	}
	.close-btn {
		background: transparent;
		color: var(--color-text-secondary);
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.label-group {
		display: flex;
		gap: 10px;
		margin-bottom: 8px;
	}
	.choice-chip {
		padding: 8px 16px;
		border-radius: 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}
	.choice-chip.active {
		background: rgba(var(--color-accent-gold-rgb), 0.2);
		border-color: var(--color-accent-gold);
		color: var(--color-accent-gold);
	}

	.modal-input {
		background: var(--color-input-bg);
		border: 1px solid var(--color-border);
		padding: 14px;
		border-radius: 12px;
		color: var(--color-text-primary);
	}
	.row {
		display: flex;
		gap: 12px;
	}
	.row .modal-input {
		flex: 1;
	}

	.save-btn-modal {
		background: var(--color-accent-gold);
		color: var(--color-bg-primary);
		padding: 16px;
		border-radius: 12px;
		font-weight: 700;
		margin-top: 10px;
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
	}
	.checkbox-text {
		font-size: 0.9rem;
	}
</style>

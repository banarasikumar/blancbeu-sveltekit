<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/firebase';
	import {
		collection,
		addDoc,
		deleteDoc,
		updateDoc,
		doc,
		query,
		orderBy,
		onSnapshot,
		serverTimestamp,
		getDocs
	} from 'firebase/firestore';
	import { ArrowLeft, Plus, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { showToast } from '$lib/stores/toast';

	interface Category {
		id: string;
		name: string;
		createdAt?: any;
	}

	let categories = $state<Category[]>([]);
	let loading = $state(true);
	let syncing = $state(false);
	let newCategoryName = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');

	onMount(() => {
		const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
		const unsubscribe = onSnapshot(q, (snapshot) => {
			categories = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
			loading = false;
		});

		return () => unsubscribe();
	});

	function goBack() {
		goto('/admin/services');
	}

	async function syncCategories() {
		syncing = true;
		try {
			// 1. Get all services
			const servicesSnap = await getDocs(collection(db, 'services'));
			const serviceCategories = new Set<string>();
			servicesSnap.forEach((doc) => {
				const data = doc.data();
				if (data.category) {
					serviceCategories.add(data.category.trim());
				}
			});

			// 2. Get existing categories (already in state)
			const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));

			// 3. Add missing
			let addedCount = 0;
			for (const catName of serviceCategories) {
				if (!existingNames.has(catName.toLowerCase())) {
					await addDoc(collection(db, 'categories'), {
						name: catName,
						createdAt: serverTimestamp()
					});
					addedCount++;
				}
			}

			if (addedCount > 0) {
				showToast(`Synced ${addedCount} new categories`, 'success');
			} else {
				showToast('All categories are already synced', 'success');
			}
		} catch (error) {
			console.error('Error syncing categories:', error);
			showToast('Failed to sync categories', 'error');
		} finally {
			syncing = false;
		}
	}

	async function addCategory() {
		if (!newCategoryName.trim()) return;

		try {
			await addDoc(collection(db, 'categories'), {
				name: newCategoryName.trim(),
				createdAt: serverTimestamp()
			});
			showToast('Category added', 'success');
			newCategoryName = '';
		} catch (error) {
			console.error('Error adding category:', error);
			showToast('Failed to add category', 'error');
		}
	}

	async function deleteCategory(id: string, name: string) {
		if (
			!confirm(
				`Delete category "${name}"? This won't delete services, but they may lose their category association.`
			)
		)
			return;

		try {
			await deleteDoc(doc(db, 'categories', id));
			showToast('Category deleted', 'success');
		} catch (error) {
			console.error('Error deleting category:', error);
			showToast('Failed to delete category', 'error');
		}
	}

	function startEdit(cat: Category) {
		editingId = cat.id;
		editName = cat.name;
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
	}

	async function saveEdit(id: string) {
		if (!editName.trim()) return;

		try {
			await updateDoc(doc(db, 'categories', id), {
				name: editName.trim(),
				updatedAt: new Date().toISOString()
			});
			showToast('Category updated', 'success');
			editingId = null;
		} catch (error) {
			console.error('Error updating category:', error);
			showToast('Failed to update category', 'error');
		}
	}
</script>

<div class="admin-page">
	<!-- Header -->
	<div class="admin-header">
		<div style="display: flex; align-items: center; gap: 16px;">
			<button class="back-btn" onclick={goBack} aria-label="Back">
				<ArrowLeft size={24} color="var(--admin-text)" />
			</button>
			<h2>Manage Categories</h2>
		</div>
		<button class="icon-btn" onclick={syncCategories} disabled={syncing} title="Sync from Services">
			<RefreshCw size={20} class={syncing ? 'spin' : ''} />
		</button>
	</div>

	<div class="content-container">
		<!-- Add New -->
		<div class="input-group">
			<input
				type="text"
				bind:value={newCategoryName}
				placeholder="New Category Name (e.g. Hair, Spa)"
				onkeydown={(e) => e.key === 'Enter' && addCategory()}
			/>
			<button class="add-btn" onclick={addCategory} disabled={!newCategoryName.trim()}>
				<Plus size={20} />
			</button>
		</div>

		<!-- List -->
		{#if loading}
			<div class="loading">Loading...</div>
		{:else if categories.length === 0}
			<div class="empty-state">No categories found. Add one above!</div>
		{:else}
			<div class="category-list">
				{#each categories as cat (cat.id)}
					<div class="category-item">
						{#if editingId === cat.id}
							<input type="text" bind:value={editName} class="edit-input" autoFocus />
							<div class="actions">
								<button class="icon-btn save" onclick={() => saveEdit(cat.id)}>
									<Check size={18} />
								</button>
								<button class="icon-btn cancel" onclick={cancelEdit}>
									<X size={18} />
								</button>
							</div>
						{:else}
							<span class="category-name">{cat.name}</span>
							<div class="actions">
								<button class="icon-btn" onclick={() => startEdit(cat)}>
									<Edit2 size={18} color="var(--admin-text-secondary)" />
								</button>
								<button class="icon-btn delete" onclick={() => deleteCategory(cat.id, cat.name)}>
									<Trash2 size={18} color="var(--admin-red)" />
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.admin-page {
		min-height: 100vh;
		background: var(--admin-bg);
		color: var(--admin-text);
		padding: 16px;
		display: flex;
		flex-direction: column;
	}

	.admin-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
	}

	.spin {
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

	.admin-header h2 {
		font-size: 20px;
		font-weight: 700;
		margin: 0;
	}

	.back-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.content-container {
		max-width: 600px;
		width: 100%;
		margin: 0 auto;
	}

	.input-group {
		display: flex;
		gap: 8px;
		margin-bottom: 24px;
	}

	input {
		flex: 1;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: 12px;
		padding: 12px;
		color: var(--admin-text);
		font-size: 15px;
		outline: none;
	}

	input:focus {
		border-color: var(--admin-accent);
	}

	.add-btn {
		width: 48px;
		border-radius: 12px;
		background: var(--admin-accent);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: black;
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.category-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.category-item {
		background: var(--admin-surface);
		padding: 16px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.category-name {
		font-weight: 500;
		font-size: 16px;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
	}

	.icon-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.icon-btn.save {
		color: var(--admin-accent);
	}

	.icon-btn.cancel {
		color: var(--admin-text-secondary);
	}

	.icon-btn.delete {
		color: var(--admin-red);
	}

	.loading,
	.empty-state {
		text-align: center;
		color: var(--admin-text-secondary);
		margin-top: 40px;
	}

	.edit-input {
		padding: 8px;
		margin-right: 8px;
	}
</style>

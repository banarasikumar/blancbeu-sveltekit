<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { db, storage } from '$lib/firebase';
	import {
		doc,
		getDoc,
		addDoc,
		updateDoc,
		collection,
		serverTimestamp,
		query,
		orderBy,
		getDocs
	} from 'firebase/firestore';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
	import { showToast } from '$lib/stores/toast';
	import { onMount } from 'svelte';
	import { ArrowLeft, Upload, Loader2, Save } from 'lucide-svelte';

	let isEditing = $state(false);
	let loading = $state(false);
	let uploading = $state(false);
	let serviceId = $state<string | null>(null);

	// Form Data
	let name = $state('');
	let category = $state('Hair');
	let price = $state('');
	let originalPrice = $state('');
	let duration = $state('30');
	let description = $state('');
	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);
	let currentImageUrl = $state<string | null>(null);
	let manualImageFilename = $state('');

	let categories = $state<string[]>(['Hair', 'Nails', 'Skin', 'Massage', 'Makeup', 'Other']);

	onMount(async () => {
		// Load Categories
		try {
			const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
			const snap = await getDocs(q);
			if (!snap.empty) {
				categories = snap.docs.map((d) => d.data().name);
			}
		} catch (error) {
			console.error('Error loading categories:', error);
		}

		const id = page.url.searchParams.get('id');
		if (id) {
			isEditing = true;
			serviceId = id;
			await loadService(id);
		}
	});

	async function loadService(id: string) {
		loading = true;
		try {
			const snap = await getDoc(doc(db, 'services', id));
			if (snap.exists()) {
				const data = snap.data();
				name = data.name;
				category = data.category;
				price = data.price.toString();
				originalPrice = data.originalPrice ? data.originalPrice.toString() : '';
				duration = data.duration.toString();
				description = data.description || '';
				currentImageUrl = data.image || null;
			} else {
				showToast('Service not found', 'error');
				goto('/admin/services');
			}
		} catch (error) {
			console.error('Error loading service:', error);
			showToast('Failed to load service', 'error');
		} finally {
			loading = false;
		}
	}

	function handleImageSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			imageFile = input.files[0];
			manualImageFilename = ''; // Clear manual entry if file selected
			imagePreview = URL.createObjectURL(imageFile);
		}
	}

	async function uploadImage(): Promise<string | null> {
		if (!imageFile) return currentImageUrl;

		const storageRef = ref(storage, `services/${Date.now()}_${imageFile.name}`);
		await uploadBytes(storageRef, imageFile);
		return await getDownloadURL(storageRef);
	}

	async function saveService() {
		if (!name || !price || !duration) {
			showToast('Please fill in all required fields', 'error');
			return;
		}

		uploading = true;
		try {
			let imageUrl = currentImageUrl;

			// Priority 1: Manual Filename
			if (manualImageFilename) {
				imageUrl = `/assets/service_images/${manualImageFilename}`;
			}
			// Priority 2: Uploaded File (if no manual filename entered)
			else if (imageFile) {
				imageUrl = await uploadImage();
			}

			const serviceData = {
				name,
				category,
				price: parseFloat(price),
				originalPrice: originalPrice ? parseFloat(originalPrice) : null,
				duration: parseInt(duration),
				description,
				image: imageUrl,
				updatedAt: new Date().toISOString()
			};

			if (isEditing && serviceId) {
				await updateDoc(doc(db, 'services', serviceId), serviceData);
				showToast('Service updated successfully', 'success');
			} else {
				await addDoc(collection(db, 'services'), {
					...serviceData,
					isActive: true,
					createdAt: serverTimestamp() // Use server timestamp for new docs
				});
				showToast('Service created successfully', 'success');
			}
			goto('/admin/services');
		} catch (error) {
			console.error('Error saving service:', error);
			showToast('Failed to save service', 'error');
		} finally {
			uploading = false;
		}
	}
</script>

<div class="admin-view-header">
	<div style="display: flex; align-items: center; gap: 12px;">
		<button class="admin-back-btn" onclick={() => goto('/admin/services')}>
			<ArrowLeft size={20} />
		</button>
		<h2 class="admin-view-title">{isEditing ? 'Edit Service' : 'New Service'}</h2>
	</div>
</div>

<div class="admin-form-container">
	{#if loading}
		<div class="admin-loading-state">
			<Loader2 class="admin-spinner" size={32} />
		</div>
	{:else}
		<!-- Image Upload -->
		<div class="admin-form-section">
			<span class="admin-label">Service Image</span>

			<!-- Manual Filename Input -->
			<div style="margin-bottom: 12px;">
				<label class="admin-label" style="font-size: 12px; margin-bottom: 4px;">
					Manual Filename (from /assets/service_images/)
					<div style="display: flex; gap: 8px;">
						<input
							type="text"
							bind:value={manualImageFilename}
							class="admin-input"
							style="margin-top: 0; flex: 1;"
							placeholder="e.g. facial_new.webp"
							oninput={() => {
								if (manualImageFilename) {
									imagePreview = `/assets/service_images/${manualImageFilename}`;
									imageFile = null; // Clear file selection if typing manually
								}
							}}
						/>
						<label
							class="admin-btn-secondary"
							style="height: auto; padding: 8px 12px; font-size: 12px; font-weight: 500; white-space: nowrap; display: flex; align-items: center; cursor: pointer;"
						>
							Select File
							<input
								type="file"
								accept="image/*"
								style="display: none;"
								onchange={(e) => {
									const input = e.target as HTMLInputElement;
									if (input.files && input.files[0]) {
										manualImageFilename = input.files[0].name;
										imagePreview = `/assets/service_images/${manualImageFilename}`;
										imageFile = null; // Clear 'upload' file selection
									}
								}}
							/>
						</label>
					</div>
				</label>
				{#if manualImageFilename}
					<p style="font-size: 11px; color: var(--admin-text-tertiary); margin-top: 4px;">
						Path: /assets/service_images/{manualImageFilename}
					</p>
				{:else}
					<p
						style="font-size: 11px; color: var(--admin-text-tertiary); margin-top: 4px; margin-bottom: 8px;"
					>
						OR upload a file below (requires Firebase Storage)
					</p>
				{/if}
			</div>

			<label class="admin-image-upload">
				{#if imagePreview || currentImageUrl}
					<img src={imagePreview || currentImageUrl} alt="Preview" class="admin-image-preview" />
					<div class="admin-image-overlay">
						<Upload size={20} />
						<span>Change</span>
					</div>
				{:else}
					<div class="admin-image-placeholder">
						<Upload size={24} color="var(--admin-text-tertiary)" />
						<span>Upload Image</span>
					</div>
				{/if}
				<input type="file" accept="image/*" onchange={handleImageSelect} style="display: none;" />
			</label>
		</div>

		<!-- Details -->
		<div class="admin-form-section">
			<label class="admin-label">
				Service Name
				<input
					type="text"
					bind:value={name}
					class="admin-input"
					placeholder="e.g. Luxury Haircut"
				/>
			</label>

			<div class="admin-grid-2">
				<label class="admin-label">
					Category
					<select bind:value={category} class="admin-select">
						{#each categories as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</label>

				<label class="admin-label">
					Price (₹)
					<input
						type="number"
						bind:value={price}
						class="admin-input"
						placeholder="0.00"
						step="0.01"
					/>
				</label>
			</div>

			<label class="admin-label">
				Original Price (₹) <span style="font-weight: 400; color: var(--admin-text-tertiary);"
					>(Optional, for offer display)</span
				>
				<input
					type="number"
					bind:value={originalPrice}
					class="admin-input"
					placeholder="0.00"
					step="0.01"
				/>
			</label>

			<label class="admin-label">
				Duration (minutes)
				<div class="admin-duration-selector">
					{#each ['15', '30', '45', '60', '90', '120'] as dur}
						<button
							class="admin-duration-chip"
							class:selected={duration === dur}
							onclick={() => (duration = dur)}
						>
							{dur}m
						</button>
					{/each}
					<input
						type="number"
						bind:value={duration}
						class="admin-input-small"
						placeholder="Custom"
					/>
				</div>
			</label>

			<label class="admin-label">
				Description (Optional)
				<textarea
					bind:value={description}
					class="admin-textarea"
					placeholder="Describe the service details..."
					rows="3"
				></textarea>
			</label>
		</div>
	{/if}
</div>

<!-- Bottom Action Bar -->
<div class="admin-bottom-bar">
	<button class="admin-btn-secondary" onclick={() => goto('/admin/services')}>Cancel</button>
	<button class="admin-btn-primary" onclick={saveService} disabled={uploading || loading}>
		{#if uploading}
			<Loader2 class="admin-spinner-small" />
			Saving...
		{:else}
			<Save size={18} />
			{isEditing ? 'Save Changes' : 'Create Service'}
		{/if}
	</button>
</div>

<style>
	.admin-back-btn {
		background: none;
		border: none;
		color: var(--admin-text);
		cursor: pointer;
		display: flex;
		align-items: center;
		padding: 0;
	}

	.admin-form-container {
		padding-bottom: 100px;
	}

	.admin-form-section {
		background: var(--admin-surface);
		border-radius: 16px;
		padding: 16px;
		margin-bottom: 16px;
	}

	.admin-label {
		display: block;
		font-size: 13px;
		font-weight: 500;
		color: var(--admin-text-secondary);
		margin-bottom: 12px;
	}

	.admin-input,
	.admin-select,
	.admin-textarea {
		width: 100%;
		background: var(--admin-bg);
		border: 1px solid transparent;
		color: var(--admin-text);
		padding: 12px;
		border-radius: 12px;
		font-family: inherit;
		font-size: 15px;
		margin-top: 6px;
		transition: all 0.2s;
	}

	.admin-input:focus,
	.admin-select:focus,
	.admin-textarea:focus {
		border-color: var(--admin-accent);
		outline: none;
		background: var(--admin-bg-active);
	}

	.admin-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	/* Image Upload */
	.admin-image-upload {
		width: 100%;
		height: 180px;
		background: var(--admin-bg);
		border-radius: 12px;
		display: block;
		overflow: hidden;
		position: relative;
		cursor: pointer;
		border: 2px dashed var(--admin-border);
	}

	.admin-image-preview {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.admin-image-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		color: var(--admin-text-tertiary);
		font-size: 13px;
	}

	.admin-image-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: white;
		font-size: 13px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.admin-image-upload:hover .admin-image-overlay {
		opacity: 1;
	}

	/* Duration Chips */
	.admin-duration-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}

	.admin-duration-chip {
		background: var(--admin-bg);
		border: 1px solid transparent;
		color: var(--admin-text-secondary);
		padding: 8px 12px;
		border-radius: 20px;
		font-size: 13px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.admin-duration-chip.selected {
		background: var(--admin-accent-light);
		color: var(--admin-accent);
		border-color: var(--admin-accent);
		font-weight: 600;
	}

	.admin-input-small {
		width: 80px;
		background: var(--admin-bg);
		border: 1px solid transparent;
		color: var(--admin-text);
		padding: 8px 12px;
		border-radius: 12px;
		font-family: inherit;
		font-size: 13px;
	}

	/* Bottom Bar */
	.admin-bottom-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--admin-surface);
		padding: 16px 20px;
		padding-bottom: max(16px, env(safe-area-inset-bottom));
		display: flex;
		gap: 12px;
		border-top: 1px solid var(--admin-border);
		z-index: 200; /* Higher than AdminNav (100) */
	}

	@media (min-width: 768px) {
		.admin-bottom-bar {
			left: 250px; /* Sidebar width */
		}
	}

	.admin-btn-primary {
		flex: 2;
		height: 48px;
		border-radius: 14px;
		background: var(--admin-accent);
		color: #000;
		font-weight: 600;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		cursor: pointer;
	}

	.admin-btn-primary:active {
		transform: scale(0.98);
	}

	.admin-btn-secondary {
		flex: 1;
		height: 48px;
		border-radius: 14px;
		background: var(--admin-bg);
		color: var(--admin-text);
		font-weight: 600;
		border: none;
		cursor: pointer;
	}

	.admin-spinner {
		animation: spin 1s linear infinite;
	}

	.admin-spinner-small {
		width: 18px;
		height: 18px;
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

	.admin-loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 300px;
		color: var(--admin-accent);
	}
</style>

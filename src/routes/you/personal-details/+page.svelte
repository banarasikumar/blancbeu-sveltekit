<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { auth, db } from '$lib/firebase';
	import { doc, getDoc, updateDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { ChevronLeft, Camera, User, Mail, Phone, Calendar, Save } from 'lucide-svelte';
	import { showToast } from '$lib/stores/toast';

	let user = $state<any>(null);
	let loading = $state(true);
	let saving = $state(false);
	let isEditing = $state(false);

	// Form Data
	let formData = $state({
		displayName: '',
		email: '',
		phoneNumber: '',
		birthDate: ''
	});

	// Backup for cancel
	let initialData = $state({
		displayName: '',
		email: '',
		phoneNumber: '',
		birthDate: ''
	});

	onMount(async () => {
		// Wait for auth to be ready
		const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
			if (currentUser) {
				user = currentUser;
				formData.displayName = user.displayName || '';
				formData.email = user.email || '';

				// Fetch additional data from Firestore if available
				try {
					const docRef = doc(db, 'users', user.uid);
					const docSnap = await getDoc(docRef);
					if (docSnap.exists()) {
						const data = docSnap.data();
						formData.phoneNumber = data.phoneNumber || '';
						formData.birthDate = data.birthDate || '';
						// Update display name from DB if it's more recent/different?
						// For now, trust Auth for display name unless DB has it
						if (data.displayName) formData.displayName = data.displayName;
					}
				} catch (e) {
					console.error('Error fetching user details:', e);
				}
				// Save initial state
				initialData = { ...formData };
			} else {
				goto('/login');
			}
			loading = false;
		});

		return () => unsubscribe();
	});

	function toggleEdit() {
		if (isEditing) {
			// Cancelling: revert data
			formData = { ...initialData };
			isEditing = false;
		} else {
			// Starting edit
			isEditing = true;
		}
	}

	async function saveDetails() {
		if (!user) return;
		saving = true;

		try {
			// Update Auth Profile (Display Name)
			// Note: Email update requires re-verification usually, so skipping for now or handling carefully.
			// For this demo, we primarily update Firestore.

			const userRef = doc(db, 'users', user.uid);
			await updateDoc(userRef, {
				displayName: formData.displayName,
				phoneNumber: formData.phoneNumber,
				birthDate: formData.birthDate,
				updatedAt: new Date()
			});

			// Show success toast
			showToast('Details saved successfully!', 'success');
			initialData = { ...formData }; // Update backup
			isEditing = false; // Exit edit mode
		} catch (error) {
			console.error('Error saving details:', error);
			showToast('Failed to save details.', 'error');
		} finally {
			saving = false;
		}
	}

	function handleBack() {
		if (isEditing) {
			if (confirm('Discard changes?')) {
				goto('/you');
			}
		} else {
			goto('/you');
		}
	}
</script>

<div class="page-container" in:fade={{ duration: 300 }}>
	<!-- HEADER -->
	<header class="page-header">
		<button class="icon-btn" on:click={handleBack}>
			<ChevronLeft size={24} />
		</button>
		<h1 class="page-title">Personal Details</h1>
		<button class="text-btn" on:click={toggleEdit}>
			{isEditing ? 'Cancel' : 'Edit'}
		</button>
	</header>

	<main class="content-scroll">
		{#if loading}
			<div class="loading-state">
				<div class="spinner"></div>
			</div>
		{:else}
			<div class="content-wrapper" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<!-- AVATAR SECTION -->
				<div class="avatar-section">
					<div class="avatar-ring">
						{#if user?.photoURL}
							<img src={user.photoURL} alt="Profile" class="avatar-img" />
						{:else}
							<div class="avatar-placeholder">
								{formData.displayName ? formData.displayName[0].toUpperCase() : 'U'}
							</div>
						{/if}
						<button
							class="camera-btn"
							disabled={!isEditing}
							class:hidden={!isEditing}
							on:click={() => alert('Photo upload coming soon!')}
						>
							<Camera size={16} />
						</button>
					</div>
					<h2 class="user-name">{formData.displayName || 'Valued Member'}</h2>
					<span class="user-tier">Gold Member</span>
				</div>

				<!-- FORM SECTION -->
				<form class="details-form" on:submit|preventDefault={saveDetails}>
					<!-- Full Name -->
					<div class="form-group">
						<label for="name" class="input-label">
							<User size={16} class="label-icon" /> Full Name
						</label>
						<input
							type="text"
							id="name"
							bind:value={formData.displayName}
							class="text-input"
							class:disabled={!isEditing}
							placeholder="Enter your name"
							disabled={!isEditing}
						/>
					</div>

					<!-- Email (Read Only) -->
					<div class="form-group">
						<label for="email" class="input-label">
							<Mail size={16} class="label-icon" /> Email Address
						</label>
						<input
							type="email"
							id="email"
							value={formData.email}
							class="text-input disabled"
							disabled
						/>
					</div>

					<!-- Phone Number -->
					<div class="form-group">
						<label for="phone" class="input-label">
							<Phone size={16} class="label-icon" /> Phone Number
						</label>
						<input
							type="tel"
							id="phone"
							bind:value={formData.phoneNumber}
							class="text-input"
							class:disabled={!isEditing}
							placeholder="+1 (555) 000-0000"
							disabled={!isEditing}
						/>
					</div>

					<!-- Date of Birth -->
					<div class="form-group">
						<label for="dob" class="input-label">
							<Calendar size={16} class="label-icon" /> Date of Birth
						</label>
						<input
							type="date"
							id="dob"
							bind:value={formData.birthDate}
							class="text-input"
							class:disabled={!isEditing}
							disabled={!isEditing}
						/>
					</div>

					<!-- ACTION BUTTON -->
					{#if isEditing}
						<div class="button-group" in:fly={{ y: 10, duration: 200 }}>
							<button type="submit" class="save-btn" disabled={saving}>
								{#if saving}
									<div class="mini-spinner"></div>
									Saving...
								{:else}
									<Save size={18} /> Save Changes
								{/if}
							</button>
						</div>
					{/if}
				</form>
			</div>
		{/if}
	</main>
</div>

<style>
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
		background: rgba(var(--color-bg-primary-rgb), 0.8);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
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
		white-space: nowrap;
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
		transition: all 0.2s;
		z-index: 2; /* Above title */
	}

	.icon-btn:active {
		background: var(--color-surface-active);
		transform: scale(0.95);
	}

	.text-btn {
		background: transparent;
		color: var(--color-accent-gold);
		font-weight: 600;
		font-size: 0.95rem;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		transition: all 0.2s;
		z-index: 2; /* Above title */
	}

	.text-btn:active {
		opacity: 0.7;
		transform: scale(0.95);
	}

	.content-scroll {
		flex: 1;
		padding: 0 20px 40px;
		overflow-y: auto;
	}

	.loading-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 50vh;
	}

	.spinner,
	.mini-spinner {
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--color-accent-gold);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	.spinner {
		width: 40px;
		height: 40px;
	}
	.mini-spinner {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* AVATAR SECTION */
	.avatar-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 20px 0 30px;
	}

	.avatar-ring {
		width: 100px;
		height: 100px;
		padding: 3px;
		border-radius: 50%;
		background: var(--gradient-gold);
		position: relative;
		box-shadow: 0 0 20px rgba(var(--color-accent-gold-rgb), 0.2);
		margin-bottom: 16px;
	}

	.avatar-img,
	.avatar-placeholder {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		border: 3px solid var(--color-bg-primary);
	}

	.avatar-placeholder {
		background: var(--color-bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2.5rem;
		font-family: var(--font-heading);
		color: var(--color-accent-gold);
	}

	.camera-btn {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 32px;
		height: 32px;
		background: var(--color-accent-gold);
		color: var(--color-bg-primary); /* Contrast icon */
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 3px solid var(--color-bg-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.user-name {
		font-family: var(--font-heading);
		font-size: 1.5rem;
		margin: 0 0 4px 0;
	}

	.user-tier {
		font-size: 0.8rem;
		color: var(--color-accent-gold);
		text-transform: uppercase;
		letter-spacing: 1px;
		font-weight: 600;
		padding: 4px 12px;
		background: rgba(var(--color-accent-gold-rgb), 0.1);
		border-radius: 12px;
		border: 1px solid rgba(var(--color-accent-gold-rgb), 0.2);
	}

	/* FORM STYLES */
	.details-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.input-label {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.label-icon {
		color: var(--color-accent-gold);
		opacity: 0.8;
	}

	.text-input {
		background: var(--color-input-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 14px 16px;
		font-family: var(--font-body);
		font-size: 1rem;
		color: var(--color-text-primary);
		transition: all 0.2s;
	}

	.text-input:focus {
		outline: none;
		border-color: var(--color-accent-gold);
		background: var(--color-surface-hover);
		box-shadow: 0 0 0 2px rgba(var(--color-accent-gold-rgb), 0.1);
	}

	.text-input.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.helper-text {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		margin-top: -4px;
	}

	/* SAVE BUTTON */
	.save-btn {
		margin-top: 10px;
		background: var(--color-accent-gold);
		color: var(--color-bg-primary); /* Contrast text */
		font-weight: 700;
		padding: 16px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-size: 1rem;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		box-shadow: var(--shadow-gold);
	}

	.save-btn:active {
		transform: scale(0.98);
	}

	.save-btn:disabled {
		opacity: 0.7;
		cursor: wait;
	}
</style>

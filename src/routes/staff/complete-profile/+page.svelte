<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { auth, db } from '$lib/firebase';
	import { onAuthStateChanged, updateProfile } from 'firebase/auth';
	import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
	import { showToast } from '$lib/stores/toast';
	import { User, Calendar, Sparkles } from 'lucide-svelte';

	let loading = true;
	let submitting = false;
	let unsubscribe: () => void;
	let currentUser: any = null;

	// Form state
	let name = '';
	let gender = '';
	let dobInput = ''; // DD/MM/YYYY display format
	let dobValue = ''; // YYYY-MM-DD for storage
	let systemDateInput: HTMLInputElement;

	// Gender options
	const genderOptions = [
		{ value: 'male', label: 'Male', icon: '👨' },
		{ value: 'female', label: 'Female', icon: '👩' },
		{ value: 'other', label: 'Other', icon: '🧑' }
	];

	// Calculate max date (13 years ago)
	const today = new Date();
	const minAge = 13;
	const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
	const maxDateString = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;

	onMount(() => {
		unsubscribe = onAuthStateChanged(auth, async (user) => {
			loading = false;
			currentUser = user;

			if (!user) {
				goto('/staff/login');
				return;
			}

			if (user.displayName) {
				name = user.displayName;
			}

			// Check if profile is already complete
			try {
				const userDoc = await getDoc(doc(db, 'users', user.uid));
				if (userDoc.exists() && userDoc.data()?.profileCompleted === true) {
					goto('/staff/dashboard');
					return;
				}
			} catch (e) {
				console.error('Error checking profile:', e);
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	function handleDobInput(e: Event) {
		const input = e.target as HTMLInputElement;
		let v = input.value.replace(/\D/g, '');
		if (v.length > 8) v = v.substring(0, 8);

		if (v.length > 4) {
			dobInput = `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
		} else if (v.length > 2) {
			dobInput = `${v.substring(0, 2)}/${v.substring(2)}`;
		} else {
			dobInput = v;
		}

		if (v.length === 8) {
			const dd = v.substring(0, 2);
			const mm = v.substring(2, 4);
			const yyyy = v.substring(4, 8);
			dobValue = `${yyyy}-${mm}-${dd}`;
			if (systemDateInput) systemDateInput.value = dobValue;
		} else {
			dobValue = '';
		}
	}

	function handleSystemDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value;
		if (val) {
			const [y, m, d] = val.split('-');
			dobInput = `${d}/${m}/${y}`;
			dobValue = val;
		}
	}

	function openDatePicker() {
		if (systemDateInput) {
			try {
				systemDateInput.showPicker();
			} catch (err) {
				systemDateInput.click();
			}
		}
	}

	function validateForm(): string | null {
		if (!name.trim()) return 'Please enter your name';
		if (name.trim().length < 2) return 'Name must be at least 2 characters';
		if (!gender) return 'Please select your gender';
		if (!dobValue) return 'Please enter your date of birth';

		const dobDate = new Date(dobValue);
		if (isNaN(dobDate.getTime())) return 'Please enter a valid date';

		const parts = dobInput.split('/');
		if (parts.length === 3) {
			const day = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10);
			const year = parseInt(parts[2], 10);

			if (month < 1 || month > 12) return 'Invalid month. Please enter a valid date.';
			if (day < 1 || day > 31) return 'Invalid day. Please enter a valid date.';
			const checkDate = new Date(year, month - 1, day);
			if (checkDate.getDate() !== day || checkDate.getMonth() !== month - 1) {
				return 'Invalid date. Please check day and month.';
			}
		}

		if (dobDate > today) return 'Date of birth cannot be in the future';

		let age = today.getFullYear() - dobDate.getFullYear();
		const m = today.getMonth() - dobDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
		if (age < 13) return 'You must be at least 13 years old';

		return null;
	}

	async function handleSubmit() {
		const error = validateForm();
		if (error) {
			showToast(error, 'error');
			return;
		}

		if (!currentUser) {
			showToast('Session expired. Please login again.', 'error');
			goto('/staff/login');
			return;
		}

		submitting = true;

		try {
			await updateProfile(currentUser, { displayName: name.trim() });
			const userRef = doc(db, 'users', currentUser.uid);
			const existingDoc = await getDoc(userRef);

			const profileData = {
				name: name.trim(),
				gender: gender,
				dob: dobValue,
				email: currentUser.email || '',
				photoURL: currentUser.photoURL || '',
				profileCompleted: true,
				lastLogin: serverTimestamp(),
				updatedAt: serverTimestamp()
			};

			if (existingDoc.exists()) {
				await setDoc(userRef, profileData, { merge: true });
			} else {
				await setDoc(userRef, { ...profileData, createdAt: serverTimestamp() });
			}

			showToast(`Welcome to Staff Portal, ${name.trim()}! 🎉`, 'success');
			goto('/staff/dashboard');
		} catch (err) {
			console.error('Profile save error:', err);
			showToast('Failed to save profile. Please try again.', 'error');
		} finally {
			submitting = false;
		}
	}

	function handleSkip() {
		showToast('You can complete your profile later in Account settings.', 'success');
		goto('/staff/dashboard');
	}
</script>

<div class="s-page-container">
	{#if loading}
		<div class="loading-state" in:fade>
			<div class="s-spinner"></div>
		</div>
	{:else}
		<div class="content" in:fly={{ y: 30, duration: 500 }}>
			<!-- Header -->
			<div class="header">
				<div class="sparkle-icon" in:scale={{ delay: 200, duration: 400 }}>
					<Sparkles size={48} strokeWidth={1.5} />
				</div>
				<h1 class="title">Almost There</h1>
				<p class="subtitle">Complete your profile to access the staff portal</p>
			</div>

			<!-- Form Card -->
			<div class="s-glass-strong form-card" in:fly={{ y: 40, delay: 100, duration: 500 }}>
				<form on:submit|preventDefault={handleSubmit}>
					<!-- Name Input -->
					<div class="input-group">
						<div class="input-icon">
							<User size={20} />
						</div>
						<input
							type="text"
							placeholder="Your Name"
							bind:value={name}
							class="s-input custom-input"
							maxlength="50"
						/>
					</div>

					<!-- Gender Selection -->
					<div class="gender-section">
						<label class="section-label">I identify as</label>
						<div class="gender-grid">
							{#each genderOptions as option}
								<button
									type="button"
									class="gender-option"
									class:selected={gender === option.value}
									on:click={() => (gender = option.value)}
								>
									<span class="gender-icon">{option.icon}</span>
									<span class="gender-label">{option.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- DOB Input -->
					<div class="input-group dob-group">
						<div class="input-icon">
							<Calendar size={20} />
						</div>
						<input
							type="text"
							placeholder="Date of Birth (DD/MM/YYYY)"
							value={dobInput}
							on:input={handleDobInput}
							class="s-input custom-input dob-input"
							maxlength="10"
							inputmode="numeric"
						/>
						<input
							type="date"
							bind:this={systemDateInput}
							max={maxDateString}
							on:change={handleSystemDateChange}
							class="hidden-date-input"
						/>
						<button type="button" class="date-picker-btn" on:click={openDatePicker}>
							<Calendar size={18} />
						</button>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						class="s-btn s-btn-primary s-btn-block"
						disabled={submitting}
						style="margin-top: 24px;"
					>
						{#if submitting}
							<div class="btn-spinner"></div>
							Saving...
						{:else}
							<Sparkles size={20} />
							Complete Profile
						{/if}
					</button>

					<!-- Skip Option -->
					<button
						type="button"
						class="s-btn s-btn-ghost s-btn-block skip-btn"
						on:click={handleSkip}
					>
						Skip for now
					</button>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.s-page-container {
		min-height: 100vh;
		padding: 20px;
		background: var(--s-bg-primary);
		color: var(--s-text-primary);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading-state {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 60vh;
	}

	.s-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--s-border-strong);
		border-top-color: var(--s-accent);
		border-radius: 50%;
		animation: s-spin 1s linear infinite;
	}

	.content {
		max-width: 400px;
		width: 100%;
		margin: 0 auto;
	}

	.header {
		text-align: center;
		margin-bottom: 32px;
	}

	.sparkle-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		background: var(--s-accent-bg);
		border-radius: 50%;
		margin-bottom: 20px;
		color: var(--s-accent);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	.title {
		font-family: var(--s-font-display);
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--s-text-primary);
		margin-bottom: 8px;
	}

	.subtitle {
		color: var(--s-text-secondary);
		font-size: 1rem;
	}

	.form-card {
		border-radius: var(--s-radius-lg);
		padding: 28px;
		border: 1px solid var(--s-border);
		box-shadow: var(--s-shadow-lg);
	}

	.input-group {
		position: relative;
		margin-bottom: 20px;
	}

	.input-icon {
		position: absolute;
		left: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--s-text-secondary);
		pointer-events: none;
	}

	.custom-input {
		padding-left: 52px;
	}

	.dob-group {
		position: relative;
	}

	.dob-input {
		padding-right: 52px;
	}

	.hidden-date-input {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}

	.date-picker-btn {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--s-accent-bg);
		border: 1px solid var(--s-border-accent);
		border-radius: var(--s-radius-sm);
		color: var(--s-accent-dark);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.date-picker-btn:hover {
		background: var(--s-accent-bg-hover);
		transform: translateY(-50%) scale(1.05);
	}

	.gender-section {
		margin-bottom: 24px;
	}

	.section-label {
		display: block;
		color: var(--s-text-secondary);
		font-size: 0.9rem;
		margin-bottom: 12px;
	}

	.gender-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.gender-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px;
		background: var(--s-bg-secondary);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.gender-option:hover {
		background: var(--s-surface-hover);
	}

	.gender-option.selected {
		background: var(--s-accent-bg);
		border-color: var(--s-accent);
		color: var(--s-accent-dark);
	}

	.gender-icon {
		font-size: 1.5rem;
	}

	.gender-label {
		font-size: 0.8rem;
		font-weight: 500;
	}

	.btn-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: s-spin 0.8s linear infinite;
	}

	.skip-btn {
		margin-top: 12px;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
</style>

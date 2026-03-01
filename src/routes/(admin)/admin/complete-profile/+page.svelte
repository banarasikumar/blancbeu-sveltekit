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

	let name = '';
	let gender = '';
	let dobInput = '';
	let dobValue = '';
	let systemDateInput: HTMLInputElement;

	const genderOptions = [
		{ value: 'male', label: 'Male', icon: '👨' },
		{ value: 'female', label: 'Female', icon: '👩' },
		{ value: 'other', label: 'Other', icon: '🧑' }
	];

	const today = new Date();
	const minAge = 13;
	const maxDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
	const maxDateString = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, '0')}-${String(maxDate.getDate()).padStart(2, '0')}`;

	onMount(() => {
		unsubscribe = onAuthStateChanged(auth, async (user) => {
			loading = false;
			currentUser = user;

			if (!user) {
				goto('/admin/login');
				return;
			}

			if (user.displayName) {
				name = user.displayName;
			}

			try {
				const userDoc = await getDoc(doc(db, 'users', user.uid));
				if (userDoc.exists() && userDoc.data()?.profileCompleted === true) {
					goto('/admin');
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
			goto('/admin/login');
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

			showToast(`Welcome to Admin Panel, ${name.trim()}! 🎉`, 'success');
			goto('/admin');
		} catch (err) {
			console.error('Profile save error:', err);
			showToast('Failed to save profile. Please try again.', 'error');
		} finally {
			submitting = false;
		}
	}

	function handleSkip() {
		showToast('You can complete your profile later in Account settings.', 'success');
		goto('/admin');
	}
</script>

<div class="admin-page-container">
	{#if loading}
		<div class="loading-state" in:fade>
			<div class="admin-spinner"></div>
		</div>
	{:else}
		<div class="content" in:fly={{ y: 30, duration: 500 }}>
			<!-- Header -->
			<div class="header">
				<div class="sparkle-icon" in:scale={{ delay: 200, duration: 400 }}>
					<Sparkles size={48} strokeWidth={1.5} />
				</div>
				<h1 class="title">Almost There</h1>
				<p class="subtitle">Complete your profile to access the administration portal</p>
			</div>

			<!-- Form Card -->
			<div class="admin-form-card" in:fly={{ y: 40, delay: 100, duration: 500 }}>
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
							class="admin-input custom-input"
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
							class="admin-input custom-input dob-input"
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
						class="admin-submit-btn"
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
					<button type="button" class="admin-skip-btn" on:click={handleSkip}> Skip for now </button>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	.admin-page-container {
		min-height: 100vh;
		padding: 20px;
		background: var(--admin-bg);
		color: var(--admin-text-primary);
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

	.admin-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid var(--admin-border);
		border-top-color: var(--admin-accent);
		border-radius: 50%;
		animation: adminSpin 1s linear infinite;
	}

	@keyframes adminSpin {
		to {
			transform: rotate(360deg);
		}
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
		background: var(--admin-accent-light);
		border-radius: 50%;
		margin-bottom: 20px;
		color: var(--admin-accent);
		animation: adminPulse 2s ease-in-out infinite;
	}

	@keyframes adminPulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	.title {
		font-family: var(--admin-font-display);
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 8px;
	}

	.subtitle {
		color: var(--admin-text-secondary);
		font-size: 1rem;
	}

	.admin-form-card {
		background: var(--admin-surface);
		border-radius: var(--admin-radius-lg);
		padding: 28px;
		border: 1px solid var(--admin-border);
		box-shadow: var(--admin-shadow-lg);
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
		color: var(--admin-text-tertiary);
		pointer-events: none;
	}

	.admin-input {
		width: 100%;
		padding: 16px 16px 16px 52px;
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		color: var(--admin-text-primary);
		font-size: 1rem;
		font-family: var(--admin-font);
		transition: all 0.3s ease;
		outline: none;
	}

	.admin-input:focus {
		border-color: var(--admin-accent);
		background: var(--admin-surface-hover);
		box-shadow: 0 0 0 2px var(--admin-accent-light);
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
		background: var(--admin-accent-light);
		border: 1px solid transparent;
		border-radius: var(--admin-radius-sm);
		color: var(--admin-accent);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.date-picker-btn:hover {
		background: var(--admin-surface-hover);
		border-color: var(--admin-accent);
		transform: translateY(-50%) scale(1.05);
	}

	.gender-section {
		margin-bottom: 24px;
	}

	.section-label {
		display: block;
		color: var(--admin-text-secondary);
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
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--admin-text-secondary);
	}

	.gender-option:hover {
		background: var(--admin-surface-hover);
	}

	.gender-option.selected {
		background: var(--admin-accent-light);
		border-color: var(--admin-accent);
		color: var(--admin-accent);
	}

	.gender-icon {
		font-size: 1.5rem;
	}

	.gender-label {
		font-size: 0.8rem;
		font-weight: 500;
	}

	.admin-submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		padding: 16px;
		background: var(--admin-accent);
		color: #000;
		font-size: 1.1rem;
		font-weight: 600;
		border: none;
		border-radius: var(--admin-radius-md);
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.admin-submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 20px var(--admin-accent-light);
	}

	.admin-submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.btn-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: #000;
		border-radius: 50%;
		animation: adminSpin 0.8s linear infinite;
	}

	.admin-skip-btn {
		display: block;
		width: 100%;
		margin-top: 16px;
		padding: 12px;
		background: none;
		color: var(--admin-text-tertiary);
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.2s ease;
	}

	.admin-skip-btn:hover {
		color: var(--admin-text-primary);
	}
</style>

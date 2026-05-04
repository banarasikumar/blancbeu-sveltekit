<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { auth, db } from '$lib/firebase';
	import { onAuthStateChanged, updateProfile } from 'firebase/auth';
	import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
	import { showToast } from '$lib/stores/toast';
	import { pendingProfileData, isProfileMandatory, clearPendingProfile } from '$lib/stores/profile';
	import { mergeAllWalkIns } from '$lib/services/walkInService';
	import { User, Calendar, Sparkles, Phone } from 'lucide-svelte';
	import Loader from '$lib/components/ui/Loader.svelte';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';

	let loading = true;
	let submitting = false;
	let showWelcomeModal = false;
	let unsubscribe: () => void;
	let currentUser: any = null;

	// Form state
	let name = '';
	let userPhone = '';
	let gender = '';
	let dobInput = ''; // DD/MM/YYYY display format
	let dobValue = ''; // YYYY-MM-DD for storage
	let systemDateInput: HTMLInputElement;

	// Derived from store
	let pendingData: any = null;
	let mandatory = false;

	// Gender options (3 only, no Private)
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

	// Subscribe to stores
	const unsubPending = pendingProfileData.subscribe((v) => (pendingData = v));
	const unsubMandatory = isProfileMandatory.subscribe((v) => (mandatory = v));

	onMount(() => {
		unsubscribe = onAuthStateChanged(auth, async (user) => {
			loading = false;
			currentUser = user;

			if (!user) {
				// Not logged in, redirect to login
				goto('/login');
				return;
			}

			// Phone number
			userPhone = user.phoneNumber || pendingData?.phone || '';

			// Extract phone number from WhatsApp UID (format: wa:+91XXXXXXXXXX)
			if (!userPhone && user.uid && user.uid.startsWith('wa:+')) {
				userPhone = user.uid.replace('wa:', '');
			}

			// Pre-fill name from auth if available
			if (user.displayName) {
				// Clear out auto-generated "User 1234567890" names from WhatsApp
				if (/^User \d+$/.test(user.displayName)) {
					name = '';
				} else {
					name = user.displayName;
				}
			}

			// Check if profile is already complete
			try {
				const userDoc = await getDoc(doc(db, 'users', user.uid));
				if (userDoc.exists() && userDoc.data()?.profileCompleted === true) {
					// Profile already complete, redirect
					goto('/you');
					return;
				}
			} catch (e) {
				console.error('Error checking profile:', e);
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
		unsubPending();
		unsubMandatory();
	});

	function handleDobInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const inputType = (e as InputEvent).inputType;

		let val = input.value.replace(/\D/g, ''); // Remove non-digits
		if (val.length > 8) val = val.substring(0, 8);

		if (inputType !== 'deleteContentBackward') {
			// Smart padding for day (if first digit > 3, prepend 0)
			if (val.length === 1 && parseInt(val[0]) > 3) {
				val = '0' + val;
			}
			// Smart padding for month (if first digit of month > 1, prepend 0)
			if (val.length === 3 && parseInt(val[2]) > 1) {
				val = val.substring(0, 2) + '0' + val[2];
			}
		}

		let formatted = val;

		if (val.length >= 2) {
			formatted = val.substring(0, 2) + '/';
			if (val.length >= 4) {
				formatted += val.substring(2, 4) + '/';
				if (val.length > 4) {
					formatted += val.substring(4, 8);
				}
			} else if (val.length > 2) {
				formatted += val.substring(2, 4);
			}
		}

		if (inputType === 'deleteContentBackward') {
			if (val.length === 2) {
				formatted = val.substring(0, 2);
			} else if (val.length === 4) {
				formatted = val.substring(0, 2) + '/' + val.substring(2, 4);
			}
		}

		dobInput = formatted;

		// Parse to YYYY-MM-DD when complete
		if (val.length === 8) {
			const dd = val.substring(0, 2);
			const mm = val.substring(2, 4);
			const yyyy = val.substring(4, 8);
			dobValue = `${yyyy}-${mm}-${dd}`;

			// Sync to hidden input
			if (systemDateInput) {
				systemDateInput.value = dobValue;
			}
		} else {
			dobValue = '';
		}
	}

	// Handle system date picker change
	function handleSystemDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = input.value; // YYYY-MM-DD
		if (val) {
			const [y, m, d] = val.split('-');
			dobInput = `${d}/${m}/${y}`; // DD/MM/YYYY
			dobValue = val;
		}
	}

	// Open system date picker
	function openDatePicker() {
		if (systemDateInput) {
			try {
				systemDateInput.showPicker();
			} catch (err) {
				console.warn('showPicker not supported, falling back to click');
				systemDateInput.click();
			}
		}
	}

	function formatPhoneDisplay(phone: string) {
		if (!phone) return '';
		let p = phone.replace(/\s+/g, '');
		if (p.startsWith('+91') && p.length === 13) {
			// Using U+2006 (Six-Per-Em Space) which is smaller than a regular space
			return `+91\u2006${p.slice(3, 8)}\u2006${p.slice(8, 13)}`;
		}
		return p;
	}

	// Validation
	function validateForm(): string | null {
		if (!name.trim()) {
			return 'Please enter your name';
		}
		if (name.trim().length < 2) {
			return 'Name must be at least 2 characters';
		}
		if (!gender) {
			return 'Please select your gender';
		}
		if (!dobValue) {
			return 'Please enter your date of birth (DD/MM/YYYY)';
		}

		const dobDate = new Date(dobValue);
		if (isNaN(dobDate.getTime())) {
			return 'Please enter a valid date';
		}

		// Validate day/month ranges
		const parts = dobInput.split('/');
		if (parts.length === 3) {
			const day = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10);
			const year = parseInt(parts[2], 10);

			if (month < 1 || month > 12) {
				return 'Invalid month. Please enter a valid date.';
			}
			if (day < 1 || day > 31) {
				return 'Invalid day. Please enter a valid date.';
			}
			// Check if date is actually valid (e.g., Feb 30 won't create valid date)
			const checkDate = new Date(year, month - 1, day);
			if (checkDate.getDate() !== day || checkDate.getMonth() !== month - 1) {
				return 'Invalid date. Please check day and month.';
			}
		}

		if (dobDate > today) {
			return 'Date of birth cannot be in the future';
		}

		// Age check (minimum 13)
		let age = today.getFullYear() - dobDate.getFullYear();
		const m = today.getMonth() - dobDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
			age--;
		}
		if (age < 13) {
			return 'You must be at least 13 years old';
		}

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
			goto('/login');
			return;
		}

		submitting = true;

		try {
			// Update Firebase Auth display name
			await updateProfile(currentUser, {
				displayName: name.trim()
			});

			// Save to Firestore
			const userRef = doc(db, 'users', currentUser.uid);
			const existingDoc = await getDoc(userRef);

			let currentProvider = pendingData?.provider || 'google';
			if (currentUser.uid.startsWith('wa:')) {
				currentProvider = 'whatsapp';
			}

			const profileData = {
				name: name.trim(),
				gender: gender,
				dob: dobValue,
				email: currentUser.email || '',
				photoURL: currentUser.photoURL || '',
				provider: currentProvider,
				phone: userPhone,
				profileCompleted: true,
				lastLogin: serverTimestamp(),
				updatedAt: serverTimestamp()
			};

			if (existingDoc.exists()) {
				await setDoc(userRef, profileData, { merge: true });
			} else {
				await setDoc(userRef, {
					...profileData,
					createdAt: serverTimestamp()
				});

				// Send targeted push notification to Admin
				try {
					const idToken = await currentUser.getIdToken();
					const apiUrl =
						typeof window !== 'undefined' && window?.Capacitor?.isNativePlatform()
							? 'https://blancbeu-sveltekit.vercel.app/api/notifications/notifyStaff'
							: '/api/notifications/notifyStaff';

					await fetch(apiUrl, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${idToken}`
						},
						body: JSON.stringify({
							title: 'New User Signup! 🎉',
							body: `${name.trim()} has just completed their profile on Blancbeu.`,
							targetRoles: ['admin'],
							notificationType: 'newSignups'
						})
					}).catch((err) => console.error('Failed to send notification request:', err));
				} catch (notificationErr) {
					console.error('Error triggering notification:', notificationErr);
				}
			}

			// Merge any matching walk-in (shadow) accounts into this newly registered user
			try {
				const phone = pendingData?.phone || currentUser.phoneNumber || '';
				const email = currentUser.email || '';
				const merged = await mergeAllWalkIns(currentUser.uid, phone, email);
				if (merged > 0) {
					console.log(
						`[CompleteProfile] Merged ${merged} walk-in account(s) into ${currentUser.uid}`
					);
				}
			} catch (mergeErr) {
				console.warn('[CompleteProfile] Walk-in merge failed (non-blocking):', mergeErr);
			}

			showToast(`Welcome, ${name.trim()}! 🎉`, 'success');
			clearPendingProfile();
			showWelcomeModal = true;
		} catch (err) {
			console.error('Profile save error:', err);
			showToast('Failed to save profile. Please try again.', 'error');
		} finally {
			submitting = false;
		}
	}

	function handleSkip() {
		if (mandatory) {
			showToast('Profile completion is required', 'error');
			return;
		}
		showToast('You can complete your profile later in Account settings.', 'success');
		clearPendingProfile();
		goto('/you');
	}
</script>

<div class="page-container">
	{#if loading}
		<Loader size={120} height="60vh" />
	{:else}
		<div class="content" in:fly={{ y: 30, duration: 500 }}>
			<!-- Header -->
			<div class="header">
				<div class="gift-icon-container" in:scale={{ delay: 200, duration: 400 }}>
					<span class="gift-emoji">🎁</span>
				</div>
				<h1 class="title" style="font-size: 2.2rem;">Complete profile.</h1>
				<p class="subtitle-highlight">Get ₹500 Beu Cash.</p>
			</div>

			<!-- Form Card -->
			<div class="glass-card" in:fly={{ y: 40, delay: 100, duration: 500 }}>
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
							class="glass-input"
							maxlength="50"
						/>
						<div class="input-glow"></div>
					</div>

					<!-- Phone Number (Read-only) -->
					{#if userPhone}
						<div class="input-group">
							<div class="input-icon">
								<Phone size={20} />
							</div>
							<input
								type="text"
								value={formatPhoneDisplay(userPhone)}
								class="glass-input disabled-input"
								readonly
								disabled
							/>
						</div>
					{/if}

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

					<!-- DOB Input with Date Picker -->
					<div class="dob-section">
						<label class="section-label">Date of Birth</label>
						<div class="input-group dob-group">
							<div class="input-icon">
								<Calendar size={20} />
							</div>
							<input
								type="text"
								placeholder="DD/MM/YYYY"
								value={dobInput}
								on:input={handleDobInput}
								class="glass-input dob-input"
								maxlength="10"
								inputmode="numeric"
							/>
							<!-- Hidden system date input -->
							<input
								type="date"
								bind:this={systemDateInput}
								max={maxDateString}
								on:change={handleSystemDateChange}
								class="hidden-date-input"
							/>
							<!-- Date picker icon button -->
							<button type="button" class="date-picker-btn" on:click={openDatePicker}>
								<Calendar size={18} />
							</button>
							<div class="input-glow"></div>
						</div>
						<p class="age-hint">You must be at least 13 years old</p>
					</div>

					<!-- Submit Button -->
					<button type="submit" class="submit-btn" disabled={submitting}>
						{#if submitting}
							<div class="btn-spinner"></div>
							Saving...
						{:else}
							<Sparkles size={20} />
							Save & Claim ₹500
						{/if}
					</button>

					<!-- Skip Option -->
					{#if !mandatory}
						<button type="button" class="skip-btn" on:click={handleSkip}> Skip for now </button>
					{/if}
				</form>
			</div>

			<!-- Benefits Preview -->
			<div class="benefits-preview" in:fly={{ y: 40, delay: 200, duration: 500 }}>
				<div class="benefit">🎁 Get birthday rewards</div>
				<div class="benefit">💎 Unlock personalized offers</div>
				<div class="benefit">⭐ Priority booking access</div>
			</div>
		</div>
	{/if}

	{#if showWelcomeModal}
		<WelcomeModal
			user={currentUser}
			onClose={() => {
				showWelcomeModal = false;
				goto('/you');
			}}
		/>
	{/if}
</div>

<style>
	.page-container {
		min-height: 100vh;
		padding: 20px;
		padding-bottom: 100px;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		overflow-x: hidden;
	}

	/* Loading — handled by <Loader> component */

	/* Content */
	.content {
		max-width: 400px;
		margin: 0 auto;
		padding-top: 20px;
	}

	/* Header */
	.header {
		text-align: center;
		margin-bottom: 32px;
	}

	.gift-icon-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 80px;
		height: 80px;
		background: rgba(212, 175, 55, 0.15);
		border: 1px solid rgba(212, 175, 55, 0.3);
		border-radius: 50%;
		margin-bottom: 20px;
		animation: float 3s ease-in-out infinite;
		box-shadow: 0 0 30px rgba(212, 175, 55, 0.2);
	}

	.gift-emoji {
		font-size: 2.5rem;
		line-height: 1;
	}

	.subtitle-highlight {
		color: #d4af37; /* Gold color */
		font-size: 1.2rem;
		font-weight: 600;
		margin-top: 8px;
		letter-spacing: 0.5px;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	.title {
		font-family: var(--font-heading);
		font-size: 2.5rem;
		margin-bottom: 8px;
		background: var(--gradient-gold);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		color: var(--color-text-secondary);
		font-size: 1rem;
	}

	/* Glass Card */
	.glass-card {
		background: var(--color-bg-glass);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-radius: var(--radius-lg);
		padding: 28px;
		border: 1px solid var(--color-border-strong);
		box-shadow: var(--shadow-card);
		position: relative;
		overflow: hidden;
	}

	.glass-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--gradient-gold);
		opacity: 0.6;
	}

	/* Input Group */
	.input-group {
		position: relative;
		margin-bottom: 20px;
	}

	.input-icon {
		position: absolute;
		left: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-secondary);
		z-index: 2;
		pointer-events: none;
	}

	.glass-input {
		width: 100%;
		padding: 16px 16px 16px 52px;
		background: var(--color-input-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		color: var(--color-text-primary);
		font-size: 1rem;
		font-family: inherit;
		transition: all 0.3s ease;
		outline: none;
		box-shadow: inset 0 2px 4px rgba(var(--color-shadow-rgb, 0, 0, 0), 0.05);
	}

	.glass-input::placeholder {
		color: var(--color-text-secondary);
		opacity: 0.6;
	}

	.glass-input:focus {
		border-color: var(--color-accent-gold);
		background: var(--color-surface-active);
		box-shadow:
			inset 0 2px 4px rgba(var(--color-shadow-rgb, 0, 0, 0), 0.05),
			0 0 0 3px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2);
	}

	.glass-input:focus + .input-glow,
	.glass-input:focus ~ .input-glow {
		opacity: 1;
	}

	.disabled-input {
		opacity: 0.7;
		cursor: not-allowed;
		background: var(--color-surface);
		border-color: var(--color-border);
	}

	.input-glow {
		position: absolute;
		bottom: -1px;
		left: 10%;
		right: 10%;
		height: 2px;
		background: var(--gradient-gold);
		border-radius: 2px;
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	/* DOB Group with Date Picker */
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
		border: none;
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
		background: var(--color-btn-bg);
		border: 1px solid var(--color-btn-border);
		border-radius: var(--radius-sm);
		color: var(--color-accent-gold);
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 3;
	}

	.date-picker-btn:hover {
		background: var(--color-btn-hover-bg);
		border-color: var(--color-accent-gold);
		transform: translateY(-50%) scale(1.05);
	}

	.date-picker-btn:active {
		transform: translateY(-50%) scale(0.95);
	}

	/* Gender Section */
	.gender-section {
		margin-bottom: 24px;
	}

	.section-label {
		display: block;
		color: var(--color-text-secondary);
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
		background: var(--color-input-bg);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 2px 8px rgba(var(--color-shadow-rgb, 0, 0, 0), 0.04);
	}

	.gender-option:hover {
		background: var(--color-surface-hover);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(var(--color-shadow-rgb, 0, 0, 0), 0.08);
	}

	.gender-option.selected {
		background: var(--color-btn-bg);
		border-color: var(--color-accent-gold);
		box-shadow:
			0 0 20px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.2),
			inset 0 0 20px rgba(var(--color-accent-gold-rgb, 212, 175, 55), 0.05);
		transform: scale(1.02);
	}

	.gender-icon {
		font-size: 1.5rem;
	}

	.gender-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.gender-option.selected .gender-label {
		color: var(--color-accent-gold);
	}

	/* Age Hint */
	.age-hint {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		margin-bottom: 24px;
		opacity: 0.6;
	}

	/* Submit Button */
	.submit-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 16px;
		background: var(--gradient-gold);
		color: var(--color-bg-primary);
		font-size: 1.1rem;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-full);
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow:
			0 4px 20px rgba(212, 175, 55, 0.3),
			0 0 0 0 rgba(212, 175, 55, 0.4);
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 8px 30px rgba(212, 175, 55, 0.4),
			0 0 0 4px rgba(212, 175, 55, 0.1);
	}

	.submit-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.btn-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: var(--color-bg-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* Skip Button */
	.skip-btn {
		display: block;
		width: 100%;
		margin-top: 16px;
		padding: 12px;
		background: none;
		color: var(--color-text-secondary);
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.2s ease;
	}

	.skip-btn:hover {
		color: var(--color-text-primary);
	}

	/* Benefits Preview */
	.benefits-preview {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 32px;
		padding: 20px;
		background: rgba(255, 255, 255, 0.02);
		border-radius: var(--radius-md);
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.benefit {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	/* Mobile Adjustments */
	@media (max-width: 380px) {
		.title {
			font-size: 2rem;
		}
	}
</style>

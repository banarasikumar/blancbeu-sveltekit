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
	import { User, Calendar, Sparkles, Phone, Gift, Crown, Star } from 'lucide-svelte';
	import Loader from '$lib/components/ui/Loader.svelte';
	import WelcomeModal from '$lib/components/WelcomeModal.svelte';
	import { DotLottieSvelte } from '@lottiefiles/dotlottie-svelte';

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
	<!-- Animated background orbs -->
	<div class="bg-orb orb-1"></div>
	<div class="bg-orb orb-2"></div>
	<div class="bg-orb orb-3"></div>

	{#if loading}
		<Loader size={120} height="60vh" />
	{:else}
		<div class="content" in:fly={{ y: 30, duration: 500 }}>
			<!-- Hero Section with Lottie -->
			<div class="hero-section" in:scale={{ delay: 100, duration: 500 }}>
				<div class="lottie-wrapper">
					<DotLottieSvelte src="/Gift.lottie" autoplay loop />
				</div>
				<h1 class="hero-title">Almost There!</h1>
				<p class="hero-subtitle">Complete your profile & unlock your reward</p>
			</div>

			<!-- Reward Banner -->
			<div class="reward-banner" in:fly={{ y: 20, delay: 200, duration: 500 }}>
				<div class="reward-glow"></div>
				<div class="reward-content">
					<div class="reward-icon-wrap">
						<Crown size={18} />
					</div>
					<div class="reward-text">
						<span class="reward-amount">₹500 Beu Cash</span>
						<span class="reward-desc">Yours instantly — use it on your first glow-up!</span>
					</div>
				</div>
				<div class="reward-shimmer"></div>
			</div>

			<!-- Form Card -->
			<div class="form-card" in:fly={{ y: 40, delay: 150, duration: 500 }}>
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

			<!-- Benefits Strip -->
			<div class="benefits-strip" in:fly={{ y: 30, delay: 300, duration: 500 }}>
				<div class="benefit-chip">
					<Gift size={14} />
					<span>Birthday rewards</span>
				</div>
				<div class="benefit-chip">
					<Star size={14} />
					<span>VIP offers</span>
				</div>
				<div class="benefit-chip">
					<Crown size={14} />
					<span>Priority booking</span>
				</div>
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
	/* ===== PAGE BACKGROUND ===== */
	.page-container {
		min-height: 100vh;
		padding: 20px;
		padding-bottom: 100px;
		background: linear-gradient(135deg, #0f0c29 0%, #1a0a2e 30%, #24243e 60%, #0f0c29 100%);
		color: var(--color-text-primary, #fff);
		overflow-x: hidden;
		position: relative;
	}

	/* Animated background orbs */
	.bg-orb {
		position: fixed;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.4;
		pointer-events: none;
		z-index: 0;
	}
	.orb-1 {
		width: 300px; height: 300px;
		background: radial-gradient(circle, #f857a6, #ff5858);
		top: -80px; left: -60px;
		animation: orbFloat1 8s ease-in-out infinite;
	}
	.orb-2 {
		width: 250px; height: 250px;
		background: radial-gradient(circle, #a855f7, #6366f1);
		bottom: 20%; right: -40px;
		animation: orbFloat2 10s ease-in-out infinite;
	}
	.orb-3 {
		width: 200px; height: 200px;
		background: radial-gradient(circle, #fbbf24, #f59e0b);
		top: 40%; left: 30%;
		animation: orbFloat3 12s ease-in-out infinite;
	}

	@keyframes orbFloat1 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		50% { transform: translate(30px, 40px) scale(1.1); }
	}
	@keyframes orbFloat2 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		50% { transform: translate(-20px, -30px) scale(1.15); }
	}
	@keyframes orbFloat3 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		50% { transform: translate(20px, -20px) scale(0.9); }
	}

	/* ===== CONTENT ===== */
	.content {
		max-width: 400px;
		margin: 0 auto;
		padding-top: 10px;
		position: relative;
		z-index: 1;
	}

	/* ===== HERO SECTION ===== */
	.hero-section {
		text-align: center;
		margin-bottom: 20px;
	}

	.lottie-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100px;
		height: 100px;
		margin: 0 auto 12px;
		filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.4));
		animation: floatGift 3s ease-in-out infinite;
	}

	@keyframes floatGift {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10px); }
	}

	.hero-title {
		font-family: var(--font-heading, 'Playfair Display', serif);
		font-size: 2.4rem;
		font-weight: 800;
		margin-bottom: 6px;
		background: linear-gradient(135deg, #f9d423 0%, #ff4e50 50%, #f857a6 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.5px;
	}

	.hero-subtitle {
		color: var(--color-text-secondary, rgba(255,255,255,0.7));
		font-size: 1rem;
		font-weight: 400;
	}

	/* ===== REWARD BANNER ===== */
	.reward-banner {
		position: relative;
		padding: 16px 20px;
		border-radius: 16px;
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(236, 72, 153, 0.2));
		border: 1px solid rgba(168, 85, 247, 0.35);
		margin-bottom: 24px;
		overflow: hidden;
	}

	.reward-glow {
		position: absolute;
		top: -50%; left: -50%;
		width: 200%; height: 200%;
		background: radial-gradient(circle at 30% 50%, rgba(251, 191, 36, 0.12), transparent 60%);
		pointer-events: none;
	}

	.reward-content {
		display: flex;
		align-items: center;
		gap: 14px;
		position: relative;
		z-index: 2;
	}

	.reward-icon-wrap {
		width: 40px; height: 40px;
		border-radius: 12px;
		background: linear-gradient(135deg, #fbbf24, #f59e0b);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #1a0a2e;
		flex-shrink: 0;
		box-shadow: 0 4px 15px rgba(251, 191, 36, 0.35);
	}

	.reward-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.reward-amount {
		font-size: 1.15rem;
		font-weight: 800;
		background: linear-gradient(90deg, #fbbf24, #fde68a, #fbbf24);
		background-size: 200% auto;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		animation: textShine 3s linear infinite;
	}

	@keyframes textShine {
		to { background-position: 200% center; }
	}

	.reward-desc {
		font-size: 0.82rem;
		color: var(--color-text-secondary, rgba(255,255,255,0.65));
		line-height: 1.3;
	}

	.reward-shimmer {
		position: absolute;
		top: 0; left: -100%;
		width: 60%; height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
		animation: shimmer 3s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes shimmer {
		0% { left: -100%; }
		100% { left: 200%; }
	}

	/* ===== FORM CARD ===== */
	.form-card {
		background: var(--color-bg-glass, rgba(255,255,255,0.06));
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border-radius: 20px;
		padding: 28px;
		border: 1px solid var(--color-border, rgba(255,255,255,0.1));
		box-shadow: var(--shadow-card, 0 8px 32px rgba(0,0,0,0.25));
		position: relative;
		overflow: hidden;
	}

	.form-card::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 2px;
		background: linear-gradient(90deg, #f857a6, #a855f7, #6366f1, #fbbf24);
		opacity: 0.8;
	}

	/* ===== INPUT GROUP ===== */
	.input-group {
		position: relative;
		margin-bottom: 20px;
	}

	.input-icon {
		position: absolute;
		left: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-muted, rgba(255,255,255,0.45));
		z-index: 2;
		pointer-events: none;
	}

	.glass-input {
		width: 100%;
		padding: 16px 16px 16px 52px;
		background: var(--color-input-bg, rgba(255,255,255,0.07));
		border: 1px solid var(--color-border-strong, rgba(255,255,255,0.12));
		border-radius: 14px;
		color: var(--color-text-primary, #fff);
		font-size: 1rem;
		font-family: inherit;
		transition: all 0.3s ease;
		outline: none;
	}

	.glass-input::placeholder {
		color: var(--color-text-muted, rgba(255,255,255,0.35));
	}

	.glass-input:focus {
		border-color: #a855f7;
		background: rgba(168, 85, 247, 0.08);
		box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15), 0 0 20px rgba(168, 85, 247, 0.1);
	}

	.glass-input:focus + .input-glow,
	.glass-input:focus ~ .input-glow {
		opacity: 1;
	}

	.disabled-input {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-glow {
		position: absolute;
		bottom: -1px;
		left: 10%;
		right: 10%;
		height: 2px;
		background: linear-gradient(90deg, #f857a6, #a855f7);
		border-radius: 2px;
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	/* ===== DOB ===== */
	.dob-group { position: relative; }
	.dob-input { padding-right: 52px; }

	.hidden-date-input {
		position: absolute;
		right: 16px; top: 50%;
		transform: translateY(-50%);
		opacity: 0;
		width: 0; height: 0;
		border: none;
		pointer-events: none;
	}

	.date-picker-btn {
		position: absolute;
		right: 12px; top: 50%;
		transform: translateY(-50%);
		width: 36px; height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(168, 85, 247, 0.15);
		border: 1px solid rgba(168, 85, 247, 0.3);
		border-radius: 10px;
		color: #c084fc;
		cursor: pointer;
		transition: all 0.2s ease;
		z-index: 3;
	}

	.date-picker-btn:hover {
		background: rgba(168, 85, 247, 0.25);
		border-color: #a855f7;
		transform: translateY(-50%) scale(1.05);
	}

	.date-picker-btn:active {
		transform: translateY(-50%) scale(0.95);
	}

	/* ===== GENDER SECTION ===== */
	.gender-section { margin-bottom: 24px; }

	.section-label {
		display: block;
		color: var(--color-text-secondary, rgba(255,255,255,0.55));
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
		background: var(--color-surface, rgba(255,255,255,0.05));
		border: 1px solid var(--color-border, rgba(255,255,255,0.1));
		border-radius: 14px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		color: var(--color-text-primary, #fff);
	}

	.gender-option:hover {
		background: rgba(168, 85, 247, 0.1);
		transform: translateY(-2px);
		border-color: rgba(168, 85, 247, 0.3);
	}

	.gender-option.selected {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.15));
		border-color: #a855f7;
		box-shadow: 0 0 20px rgba(168, 85, 247, 0.2), inset 0 0 20px rgba(168, 85, 247, 0.05);
		transform: scale(1.03);
	}

	.gender-icon { font-size: 1.5rem; }

	.gender-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary, rgba(255,255,255,0.55));
		font-weight: 500;
	}

	.gender-option.selected .gender-label {
		color: #c084fc;
		font-weight: 600;
	}

	/* ===== AGE HINT ===== */
	.age-hint {
		color: var(--color-text-muted, rgba(255,255,255,0.35));
		font-size: 0.8rem;
		margin-bottom: 24px;
	}

	/* ===== SUBMIT BUTTON ===== */
	.submit-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 16px;
		background: linear-gradient(135deg, #f857a6, #a855f7);
		color: #fff;
		font-size: 1.1rem;
		font-weight: 700;
		border: none;
		border-radius: 100px;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
		letter-spacing: 0.3px;
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 30px rgba(168, 85, 247, 0.5), 0 0 0 4px rgba(168, 85, 247, 0.15);
	}

	.submit-btn:active:not(:disabled) {
		transform: scale(0.98);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-spinner {
		width: 20px; height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ===== SKIP BUTTON ===== */
	.skip-btn {
		display: block;
		width: 100%;
		margin-top: 16px;
		padding: 12px;
		background: none;
		color: var(--color-text-muted, rgba(255,255,255,0.4));
		font-size: 0.95rem;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 4px;
		transition: color 0.2s ease;
	}

	.skip-btn:hover {
		color: var(--color-text-primary, rgba(255,255,255,0.7));
	}

	/* ===== BENEFITS STRIP ===== */
	.benefits-strip {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 28px;
	}

	.benefit-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		background: var(--color-surface, rgba(255,255,255,0.06));
		border: 1px solid var(--color-border, rgba(255,255,255,0.08));
		border-radius: 100px;
		color: var(--color-text-secondary, rgba(255,255,255,0.55));
		font-size: 0.78rem;
		font-weight: 500;
		transition: all 0.3s ease;
	}

	.benefit-chip:hover {
		background: rgba(168, 85, 247, 0.12);
		border-color: rgba(168, 85, 247, 0.25);
		color: #c084fc;
		transform: translateY(-2px);
	}

	/* ===== DOB SECTION ===== */
	.dob-section { /* spacing handled by children */ }

	/* ===== MOBILE ===== */
	@media (max-width: 380px) {
		.hero-title { font-size: 2rem; }
		.reward-banner { padding: 14px 16px; }
	}

	/* ===== LIGHT THEME OVERRIDES (clean & glitch) ===== */
	:global([data-theme='clean']) .page-container,
	:global([data-theme='glitch']) .page-container {
		background: linear-gradient(135deg, #f3f0ff 0%, #fdf2f8 30%, #eff6ff 60%, #faf5ff 100%);
	}

	:global([data-theme='clean']) .bg-orb,
	:global([data-theme='glitch']) .bg-orb {
		opacity: 0.25;
	}

	:global([data-theme='clean']) .reward-banner,
	:global([data-theme='glitch']) .reward-banner {
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.08));
		border-color: rgba(168, 85, 247, 0.2);
	}

	:global([data-theme='clean']) .reward-amount,
	:global([data-theme='glitch']) .reward-amount {
		background: linear-gradient(90deg, #b45309, #d97706, #b45309);
		background-size: 200% auto;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	:global([data-theme='clean']) .hero-title,
	:global([data-theme='glitch']) .hero-title {
		background: linear-gradient(135deg, #b45309 0%, #dc2626 50%, #be185d 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	:global([data-theme='clean']) .submit-btn,
	:global([data-theme='glitch']) .submit-btn {
		box-shadow: 0 4px 20px rgba(168, 85, 247, 0.25);
	}
</style>


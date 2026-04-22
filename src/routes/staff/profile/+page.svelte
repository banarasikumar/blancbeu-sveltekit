<script lang="ts">
	import { staffUser, staffLogout } from '$lib/stores/staffAuth';
	import { staffBookings } from '$lib/stores/staffData';
	import { themeMode, setTheme } from '$lib/stores/staffTheme';
	import { showToast } from '$lib/stores/toast';
	import { goto } from '$app/navigation';
	import {
		requestNotificationPermission,
		disableNotifications,
		notificationStatus,
		checkNotificationStatus,
		soundEnabled,
		selectedSoundType,
		AVAILABLE_SOUNDS,
		savePreferredSound,
		type SoundType
	} from '$lib/stores/staffNotifications';
	import { playSelectedNotificationSound, playNotificationSound } from '$lib/utils/notificationSound';
	import { onMount } from 'svelte';
	import { updateProfile } from 'firebase/auth';
	import { auth, db, storage } from '$lib/firebase';
	import { doc, getDoc, setDoc } from 'firebase/firestore';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

	// Real stats from bookings
	let completedAll = $derived($staffBookings.filter((b) => b.status === 'completed').length);
	let totalRevenue = $derived(
		$staffBookings
			.filter((b) => b.status === 'completed')
			.reduce((sum, b) => sum + (b.totalAmount || b.price || 0), 0)
	);

	// Average service time from completed bookings with actualDuration
	let avgTime = $derived(() => {
		const withDuration = $staffBookings.filter(
			(b) => b.status === 'completed' && (b as any).actualDuration
		);
		if (withDuration.length === 0) return 0;
		const total = withDuration.reduce((s, b) => s + ((b as any).actualDuration || 0), 0);
		return Math.round(total / withDuration.length);
	});

	// Current month stats
	let thisMonthBookings = $derived(() => {
		const now = new Date();
		const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		return $staffBookings.filter((b) => b.date?.startsWith(monthKey) && b.status === 'completed')
			.length;
	});

	let isAvailable = $state(true);

	onMount(async () => {
		// Load push enabled state from Firestore for staff app
		if ($staffUser) {
			await checkNotificationStatus($staffUser.uid, 'staff');
		} else {
			checkNotificationStatus();
		}
	});

	let showDeniedModal = $state(false);

	async function toggleNotifications() {
		if ($notificationStatus === 'denied') {
			showDeniedModal = true;
			return;
		}

		if ($notificationStatus === 'granted') {
			// Disable
			if (!$staffUser) return;
			const success = await disableNotifications($staffUser.uid, 'staff');
			if (success) {
				showToast('Push Notifications Disabled', 'success');
			} else {
				showToast('Failed to disable notifications', 'error');
			}
			return;
		}

		// Enable
		if (!$staffUser) return;
		const success = await requestNotificationPermission($staffUser.uid, 'staff');
		if (success) {
			showToast('Push Notifications Enabled!', 'success');
		} else if (Notification.permission === 'denied') {
			showDeniedModal = true;
		} else {
			showToast('Failed to enable, please try again.', 'error');
		}
	}

	// Theme cycling
	let currentTheme = $state<'light' | 'dark' | 'system'>('light');
	let showThemeText = $state(false);
	let themeTextTimeout: ReturnType<typeof setTimeout> | null = null;
	themeMode.subscribe((t) => (currentTheme = t));

	function cycleTheme() {
		const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
		const idx = themes.indexOf(currentTheme);
		const next = themes[(idx + 1) % themes.length];
		setTheme(next);

		showThemeText = true;
		if (themeTextTimeout) clearTimeout(themeTextTimeout);
		themeTextTimeout = setTimeout(() => {
			showThemeText = false;
		}, 2000);
	}

	const themeIcons: Record<string, string> = {
		light: '☀️',
		dark: '🌙',
		system: '🔄'
	};

	async function handleLogout() {
		if (confirm('Sign out of your account?')) {
			await staffLogout();
			goto('/staff/login');
		}
	}

	let initials = $derived(
		$staffUser?.displayName
			?.split(' ')
			.map((n: string) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2) || 'ST'
	);

	const menuItems = [
		{ icon: '📅', label: 'Schedule', sub: 'View your calendar', path: '/staff/schedule' },
		{ icon: '📋', label: 'Bookings', sub: 'All your bookings', path: '/staff/bookings' },
		{ icon: '📊', label: 'Dashboard', sub: 'Overview & stats', path: '/staff/dashboard' }
	];

	// Sound selection state
	let showSoundSelector = $state(false);

	function handleSoundSelect(type: SoundType) {
		if ($staffUser) savePreferredSound($staffUser.uid, type);
		else selectedSoundType.set(type);
		
		showToast(`Sound: ${AVAILABLE_SOUNDS.find(s => s.id === type)?.name || 'Custom'}`, 'success');
		// Play a preview
		setTimeout(() => playSelectedNotificationSound(0.5), 100);
	}

	let currentSoundName = $derived(() => {
		return AVAILABLE_SOUNDS.find(s => s.id === $selectedSoundType)?.name || 'iPhone';
	});

	// Edit Profile State
	let showEditModal = $state(false);
	let editName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');
	let isSavingProfile = $state(false);
	let avatarError = $state(false);
	
	// Avatar Upload State
	let isUploadingAvatar = $state(false);
	let fileInput: HTMLInputElement;

	async function handleAvatarUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file || !auth.currentUser) return;
		
		isUploadingAvatar = true;
		try {
			const storageRef = ref(storage, `users/${auth.currentUser.uid}/avatar_${Date.now()}`);
			await uploadBytes(storageRef, file);
			const downloadURL = await getDownloadURL(storageRef);
			
			// Update Auth and Firestore
			await updateProfile(auth.currentUser, { photoURL: downloadURL });
			const userRef = doc(db, 'users', auth.currentUser.uid);
			await setDoc(userRef, { photoURL: downloadURL }, { merge: true });
			
			staffUser.update(u => u ? { ...u, photoURL: downloadURL } as any : null);
			showToast('Profile picture updated!', 'success');
			avatarError = false; // Reset error state for new image
		} catch (err) {
			console.error('Failed to upload image:', err);
			showToast('Failed to upload image', 'error');
		} finally {
			isUploadingAvatar = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function loadProfileData() {
		if (!$staffUser) return;
		editName = $staffUser.displayName || '';
		editEmail = $staffUser.email || '';
		editPhone = $staffUser.phoneNumber || '';
		
		try {
			const docRef = doc(db, 'users', $staffUser.uid);
			const snap = await getDoc(docRef);
			if (snap.exists()) {
				const data = snap.data();
				if (data.email) editEmail = data.email;
				if (data.phone) editPhone = data.phone;
			}
		} catch (e) {
			console.error('Failed to load profile data from Firestore:', e);
		}
	}

	async function openEditModal() {
		await loadProfileData();
		showEditModal = true;
	}

	async function saveProfile() {
		if (!auth.currentUser) return;
		isSavingProfile = true;
		try {
			// Update Auth Profile (Display Name)
			if (editName !== auth.currentUser.displayName) {
				await updateProfile(auth.currentUser, { displayName: editName });
			}
			
			// Update Firestore details
			const userRef = doc(db, 'users', auth.currentUser.uid);
			await setDoc(userRef, { 
				displayName: editName,
				email: editEmail,
				phone: editPhone,
				updatedAt: new Date().toISOString()
			}, { merge: true });

			// Trigger store update for reactive UI
			staffUser.update(u => u ? { ...u, displayName: editName, email: editEmail, phoneNumber: editPhone } as any : null);
			
			showToast('Profile updated successfully', 'success');
			showEditModal = false;
		} catch (error) {
			console.error('Failed to update profile:', error);
			showToast('Failed to update profile', 'error');
		} finally {
			isSavingProfile = false;
		}
	}
</script>

<div class="profile-page s-stagger">
	<!-- Premium Hero Section -->
	<section class="premium-hero s-card">
		<button class="theme-toggle-btn" class:expanded={showThemeText} onclick={cycleTheme} title="Toggle Theme" aria-label="Toggle Theme">
			<span class="theme-text">{currentTheme === 'light' ? 'Light Mode' : currentTheme === 'dark' ? 'Dark Mode' : 'System Theme'}</span>
			<span class="theme-icon">{themeIcons[currentTheme]}</span>
		</button>

		<div class="hero-bg-glow"></div>
		
		<div class="profile-avatar-wrapper">
			<div class="profile-avatar">
				{#if $staffUser?.photoURL && !avatarError}
					<img src={$staffUser.photoURL} alt="Profile" referrerpolicy="no-referrer" onerror={() => avatarError = true} />
				{:else}
					<span class="avatar-initials">{initials}</span>
				{/if}
			</div>
			<div class="status-indicator" class:available={isAvailable}></div>
		</div>
		
		<div class="hero-info">
			<h2 class="profile-name">{$staffUser?.displayName || 'Staff Member'}</h2>
			<p class="profile-role">Senior Stylist</p>
			
			<div class="hero-actions">
				<!-- Availability Toggle -->
				<button
					class="premium-availability-btn"
					class:available={isAvailable}
					onclick={() => {
						isAvailable = !isAvailable;
						showToast(isAvailable ? 'You are now available' : 'Set to unavailable', 'success');
						if ('vibrate' in navigator) navigator.vibrate(10);
					}}
				>
					<span class="at-dot"></span>
					{isAvailable ? 'Available Now' : 'Currently Unavailable'}
				</button>
			</div>
		</div>

		<!-- Floating Edit Button at Bottom Right -->
		<button class="floating-edit-btn" onclick={openEditModal} title="Edit Profile">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
		</button>
	</section>

	<!-- Performance Stats -->
	<section class="stats-section">
		<h3 class="s-section-title">This Month's Performance</h3>
		<div class="premium-stats-grid">
			<div class="premium-stat-card s-card">
				<div class="ps-icon-wrapper blue"><span class="ps-icon">🎯</span></div>
				<div class="ps-data">
					<span class="ps-value">{completedAll}</span>
					<span class="ps-label">Services Done</span>
				</div>
			</div>
			<div class="premium-stat-card s-card">
				<div class="ps-icon-wrapper green"><span class="ps-icon">💸</span></div>
				<div class="ps-data">
					<span class="ps-value">₹{totalRevenue.toLocaleString()}</span>
					<span class="ps-label">Total Revenue</span>
				</div>
			</div>
			<div class="premium-stat-card s-card">
				<div class="ps-icon-wrapper purple"><span class="ps-icon">⏱</span></div>
				<div class="ps-data">
					<span class="ps-value">{avgTime() || '—'}m</span>
					<span class="ps-label">Avg Time</span>
				</div>
			</div>
			<div class="premium-stat-card s-card">
				<div class="ps-icon-wrapper orange"><span class="ps-icon">📆</span></div>
				<div class="ps-data">
					<span class="ps-value">{thisMonthBookings()}</span>
					<span class="ps-label">This Month</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Quick Navigation -->
	<section class="nav-section">
		<h3 class="s-section-title">Quick Actions</h3>
		<div class="nav-grid">
			{#each menuItems as item}
				<a href={item.path} class="premium-nav-card s-card s-card-interactive">
					<div class="nic-icon-bg">
						<span class="nic-icon">{item.icon}</span>
					</div>
					<div class="nic-text">
						<span class="nic-label">{item.label}</span>
						<span class="nic-sub">{item.sub}</span>
					</div>
					<svg class="nic-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
				</a>
			{/each}
		</div>
	</section>

	<!-- Settings -->
	<section class="settings-section">
		<h3 class="s-section-title">Preferences</h3>
		
		<div class="settings-container s-card">
			<div class="setting-item" onclick={() => { soundEnabled.toggle(); showToast($soundEnabled ? 'Sound enabled' : 'Sound disabled', 'success'); }} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && soundEnabled.toggle()}>
				<div class="si-icon-box"><span class="si-icon">{$soundEnabled ? '🔊' : '🔇'}</span></div>
				<div class="si-text">
					<span class="si-label">Sound Effects</span>
					<span class="si-value">In-app alert sounds</span>
				</div>
				<div class="toggle-switch" class:on={$soundEnabled}><div class="toggle-thumb"></div></div>
			</div>

			<div class="setting-divider"></div>

			<div class="setting-item" onclick={toggleNotifications} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleNotifications()}>
				<div class="si-icon-box"><span class="si-icon">🔔</span></div>
				<div class="si-text">
					<span class="si-label">Push Notifications</span>
					<span class="si-value">
						{#if $notificationStatus === 'granted'} Active
						{:else if $notificationStatus === 'denied'} Blocked
						{:else if $notificationStatus === 'unsupported'} Not supported
						{:else} Disabled {/if}
					</span>
				</div>
				{#if $notificationStatus !== 'unsupported'}
					<div class="toggle-switch" class:on={$notificationStatus === 'granted'}><div class="toggle-thumb"></div></div>
				{/if}
			</div>

			<!-- Notification Sound Selection -->
			{#if $soundEnabled}
				<div class="setting-divider"></div>
				<div class="setting-item" onclick={() => showSoundSelector = true} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (showSoundSelector = true)}>
					<div class="si-icon-box"><span class="si-icon">🎵</span></div>
					<div class="si-text">
						<span class="si-label">Alert Sound</span>
						<span class="si-value">{currentSoundName()}</span>
					</div>
					<span class="si-action-link">Change</span>
				</div>
			{/if}
		</div>
	</section>

	<!-- Account Info -->
	<section class="account-section s-card">
		<div class="account-info">
			<div class="ai-left">
				<span class="ai-icon">✉️</span>
				<span class="ai-label">Email Address</span>
			</div>
			<span class="ai-value">{$staffUser?.email || 'Not set'}</span>
		</div>
		<div class="setting-divider" style="margin: 12px 0;"></div>
		<div class="account-info">
			<div class="ai-left">
				<span class="ai-icon">📱</span>
				<span class="ai-label">Phone Number</span>
			</div>
			<span class="ai-value">{$staffUser?.phoneNumber || 'Not set'}</span>
		</div>
	</section>

	<!-- Sign Out -->
	<button class="s-btn s-btn-danger s-btn-block s-btn-lg logout-btn" onclick={handleLogout}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
		Sign Out
	</button>

	<div class="app-version">
		<p>Blancbeu Staff v2.0 • Premium Edition</p>
	</div>

	<!-- Permission Denied Modal -->
	{#if showDeniedModal}
		<div class="modal-backdrop" onclick={() => (showDeniedModal = false)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (showDeniedModal = false)}>
			<div class="modal-content s-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" aria-modal="true">
				<div class="modal-header">
					<h3>Notifications Blocked</h3>
				</div>
				<div class="modal-body">
					<p>
						Your browser is currently blocking notifications for this app. To receive alerts for new
						bookings, please open your device settings:
					</p>
					<div class="settings-instructions">
						<strong>Settings &gt; Apps &gt; Blancbeu Staff &gt; Permissions</strong>
					</div>
					<p class="text-sm mt-2 text-center">and Allow Notifications.</p>
				</div>
				<div class="modal-footer">
					<button class="s-btn s-btn-primary s-btn-block" onclick={() => (showDeniedModal = false)}>
						Got it
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Sound Selector Modal -->
	{#if showSoundSelector}
		<div class="modal-backdrop" onclick={() => showSoundSelector = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (showSoundSelector = false)}>
			<div class="modal-content s-card sound-modal" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" aria-modal="true">
				<div class="modal-header">
					<h3>Choose Alert Sound</h3>
				</div>
				<div class="modal-body">
					<div class="sound-options">
						{#each AVAILABLE_SOUNDS as sound}
							<button
								class="sound-option"
								class:selected={$selectedSoundType === sound.id}
								onclick={() => handleSoundSelect(sound.id)}
								type="button"
							>
								<span class="sound-icon">🔔</span>
								<span class="sound-name">{sound.name}</span>
								{#if $selectedSoundType === sound.id}
									<span class="check-icon">✓</span>
								{/if}
							</button>
						{/each}
					</div>

					<p class="sound-help">
						💡 Tap any sound to preview. Falls back to default chime if sound fails.
					</p>
				</div>
				<div class="modal-footer">
					<button class="s-btn s-btn-secondary s-btn-block" onclick={() => showSoundSelector = false} type="button">
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit Profile Modal -->
	{#if showEditModal}
		<div class="modal-backdrop" onclick={() => showEditModal = false} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && (showEditModal = false)}>
			<div class="modal-content s-card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" aria-modal="true">
				<div class="modal-header">
					<h3>Edit Profile</h3>
				</div>
				<div class="modal-body">
					<!-- Avatar Upload Section -->
					<div class="avatar-edit-section">
						<div class="avatar-preview">
							{#if $staffUser?.photoURL && !avatarError}
								<img src={$staffUser.photoURL} alt="Profile" referrerpolicy="no-referrer" onerror={() => avatarError = true} />
							{:else}
								<span class="avatar-initials">{initials}</span>
							{/if}
							{#if isUploadingAvatar}
								<div class="upload-overlay">
									<svg class="spinner" viewBox="0 0 50 50"><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg>
								</div>
							{/if}
						</div>
						<button class="s-btn s-btn-outline s-btn-sm upload-btn" onclick={() => fileInput.click()} disabled={isUploadingAvatar}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
							{isUploadingAvatar ? 'Uploading...' : 'Change Picture'}
						</button>
						<input type="file" accept="image/*" bind:this={fileInput} onchange={handleAvatarUpload} style="display: none;" />
					</div>

					<div class="form-group" style="margin-bottom: 16px;">
						<label for="profileName" style="display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; color: var(--s-text-primary);">Display Name</label>
						<input 
							id="profileName"
							type="text" 
							class="s-input" 
							bind:value={editName} 
							placeholder="Enter your name" 
						/>
					</div>
					<div class="form-group" style="margin-bottom: 16px;">
						<label for="profileEmail" style="display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; color: var(--s-text-primary);">Email Address</label>
						<input 
							id="profileEmail"
							type="email" 
							class="s-input" 
							bind:value={editEmail} 
							placeholder="Enter email address" 
						/>
					</div>
					<div class="form-group" style="margin-bottom: 16px;">
						<label for="profilePhone" style="display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 8px; color: var(--s-text-primary);">Phone Number</label>
						<input 
							id="profilePhone"
							type="tel" 
							class="s-input" 
							bind:value={editPhone} 
							placeholder="Enter phone number" 
						/>
					</div>
				</div>
				<div class="modal-footer" style="display: flex; gap: 12px;">
					<button class="s-btn s-btn-outline s-btn-block" onclick={() => showEditModal = false} disabled={isSavingProfile}>
						Cancel
					</button>
					<button class="s-btn s-btn-primary s-btn-block" onclick={saveProfile} disabled={isSavingProfile || !editName.trim()}>
						{isSavingProfile ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.profile-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-lg);
		padding-bottom: var(--s-space-3xl);
	}

	/* Premium Hero */
	.premium-hero {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--s-space-2xl) var(--s-space-xl);
		overflow: hidden;
		background: var(--s-surface);
		border-radius: var(--s-radius-2xl);
		border: 1px solid var(--s-border);
		box-shadow: var(--s-shadow-md);
	}

	.theme-toggle-btn {
		position: absolute;
		top: 16px;
		right: 16px;
		height: 44px;
		padding: 0 10px;
		border-radius: var(--s-radius-full);
		border: 1px solid var(--s-border);
		background: var(--s-bg-secondary);
		display: flex;
		align-items: center;
		cursor: pointer;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 10;
		color: var(--s-text-primary);
		overflow: hidden;
	}

	.theme-toggle-btn.expanded {
		padding: 0 12px 0 16px;
	}

	.theme-text {
		font-size: 0.8rem;
		font-weight: 600;
		white-space: nowrap;
		max-width: 0;
		opacity: 0;
		margin-right: 0;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.theme-toggle-btn.expanded .theme-text {
		max-width: 120px;
		opacity: 1;
		margin-right: 8px;
	}

	.theme-toggle-btn:hover {
		transform: translateY(-2px);
		box-shadow: var(--s-shadow-sm);
		border-color: var(--s-accent);
		color: var(--s-accent);
	}

	.theme-icon {
		font-size: 1.2rem;
		width: 22px;
		display: flex;
		justify-content: center;
	}

	/* Floating Edit Button */
	.floating-edit-btn {
		position: absolute;
		bottom: 16px;
		right: 16px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: var(--s-grad-hero);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		z-index: 10;
		box-shadow: var(--s-shadow-lg);
	}

	.floating-edit-btn:hover {
		transform: translateY(-3px) scale(1.05);
		box-shadow: 0 8px 16px rgba(139, 92, 246, 0.4);
	}

	.floating-edit-btn:active {
		transform: scale(0.95);
	}

	.hero-bg-glow {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle at center, var(--s-accent-bg) 0%, transparent 60%);
		opacity: 0.8;
		pointer-events: none;
	}

	.profile-avatar-wrapper {
		position: relative;
		margin-bottom: var(--s-space-md);
		z-index: 2;
	}

	.profile-avatar {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--s-grad-hero);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px rgba(0,0,0,0.12);
		border: 4px solid var(--s-surface);
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initials {
		font-family: var(--s-font-display);
		font-size: 2.5rem;
		font-weight: 800;
		color: white;
	}

	.status-indicator {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--s-error);
		border: 3px solid var(--s-surface);
		transition: all 0.3s ease;
		box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
	}

	.status-indicator.available {
		background: var(--s-success);
		box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
	}

	.hero-info {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.profile-name {
		margin: 0 0 2px;
		font-family: var(--s-font-display);
		font-size: 1.6rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--s-text-primary);
	}

	.profile-role {
		margin: 0 0 var(--s-space-lg);
		font-size: 0.85rem;
		color: var(--s-text-secondary);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		margin-top: 4px;
	}

	/* Availability */
	.premium-availability-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 24px;
		border-radius: var(--s-radius-full);
		border: 1px solid var(--s-error);
		background: var(--s-error-bg);
		color: var(--s-error);
		font-weight: 700;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all var(--s-duration-normal) var(--s-ease);
		box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
	}

	.premium-availability-btn.available {
		border-color: var(--s-success);
		background: var(--s-success-bg);
		color: var(--s-success);
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
	}

	.premium-availability-btn:active {
		transform: scale(0.96);
	}

	.at-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	/* Premium Stats Grid */
	.premium-stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-space-md);
		width: 100%;
	}

	.premium-stat-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-space-md);
		padding: var(--s-space-lg);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		position: relative;
		overflow: hidden;
		transition: all var(--s-duration-normal);
		width: 100%;
	}

	.premium-stat-card:hover {
		transform: translateY(-4px);
		box-shadow: var(--s-shadow-md);
		border-color: var(--s-border-strong);
	}

	.ps-icon-wrapper {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
	}

	.ps-icon-wrapper.blue { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
	.ps-icon-wrapper.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
	.ps-icon-wrapper.purple { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
	.ps-icon-wrapper.orange { background: rgba(249, 115, 22, 0.1); color: #f97316; }

	.ps-data {
		display: flex;
		flex-direction: column;
	}

	.ps-value {
		font-family: var(--s-font-display);
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--s-text-primary);
		line-height: 1.2;
	}

	.ps-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--s-text-secondary);
		margin-top: 2px;
	}

	/* Nav Section */
	.nav-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--s-space-sm);
		width: 100%;
	}

	.premium-nav-card {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-md) var(--s-space-lg);
		text-decoration: none;
		border-radius: var(--s-radius-xl);
		border: 1px solid var(--s-border);
		background: var(--s-surface);
		transition: all var(--s-duration-fast);
		width: 100%;
	}

	.premium-nav-card:hover {
		border-color: var(--s-accent);
		transform: translateX(4px);
		box-shadow: var(--s-shadow-md);
	}

	.nic-icon-bg {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		background: var(--s-bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		transition: background var(--s-duration-fast);
	}

	.premium-nav-card:hover .nic-icon-bg {
		background: var(--s-accent-bg);
	}

	.nic-text {
		flex: 1;
	}

	.nic-label {
		display: block;
		font-weight: 700;
		font-size: var(--s-text-md);
		color: var(--s-text-primary);
	}

	.nic-sub {
		display: block;
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		margin-top: 2px;
	}

	.nic-arrow {
		color: var(--s-text-tertiary);
		transition: transform var(--s-duration-fast);
	}

	.premium-nav-card:hover .nic-arrow {
		color: var(--s-accent);
		transform: translateX(4px);
	}

	/* Settings */
	.settings-container {
		display: flex;
		flex-direction: column;
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-xl);
		overflow: hidden;
	}

	.setting-item {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: 16px 20px;
		cursor: pointer;
		transition: background var(--s-duration-fast) var(--s-ease);
	}

	.setting-item:hover {
		background: var(--s-bg-secondary);
	}

	.setting-item:active {
		background: var(--s-surface-active);
	}

	.setting-divider {
		height: 1px;
		background: var(--s-border);
		margin: 0 20px;
	}

	.si-icon-box {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--s-bg-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
	}

	.si-text {
		flex: 1;
	}

	.si-label {
		display: block;
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--s-text-primary);
	}

	.si-value {
		display: block;
		font-size: 0.8rem;
		color: var(--s-text-secondary);
		font-weight: 500;
		margin-top: 2px;
	}

	.si-action-link {
		font-size: 0.8rem;
		color: var(--s-accent);
		font-weight: 700;
	}

	/* Toggle Switch */
	.toggle-switch {
		width: 48px;
		height: 26px;
		border-radius: var(--s-radius-full);
		background: var(--s-border-strong);
		position: relative;
		cursor: pointer;
		transition: background 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
	}

	.toggle-switch.on {
		background: var(--s-success);
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
		transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
	}

	.toggle-switch.on .toggle-thumb {
		transform: translateX(22px);
	}

	/* Account */
	.account-section {
		border-radius: var(--s-radius-xl);
		padding: var(--s-space-md) var(--s-space-lg);
	}

	.account-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.ai-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ai-icon {
		font-size: 1.2rem;
	}

	.ai-label {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.ai-value {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--s-text-primary);
	}

	/* Logout */
	.logout-btn {
		margin-top: var(--s-space-sm);
		border-radius: var(--s-radius-xl);
		font-size: 1rem;
		letter-spacing: 0.02em;
	}

	.app-version {
		text-align: center;
		margin-top: -10px;
	}

	.app-version p {
		font-size: 0.75rem;
		color: var(--s-text-tertiary);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	/* Modals */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(8px);
		z-index: var(--s-z-modal);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--s-space-lg);
	}

	.modal-content {
		width: 100%;
		max-width: 400px;
		background: var(--s-surface);
		border-radius: var(--s-radius-2xl);
		padding: var(--s-space-xl);
		animation: s-scaleIn var(--s-duration-normal) var(--s-ease-spring);
		box-shadow: var(--s-shadow-xl);
		border: 1px solid var(--s-border);
	}

	.modal-header h3 {
		margin: 0 0 var(--s-space-md);
		font-family: var(--s-font-display);
		font-size: var(--s-text-xl);
		text-align: center;
		color: var(--s-text-primary);
		font-weight: 800;
	}

	.modal-body p {
		margin: 0 0 var(--s-space-md);
		text-align: center;
		color: var(--s-text-secondary);
		line-height: 1.6;
		font-size: 0.95rem;
	}

	.settings-instructions {
		background: var(--s-bg-secondary);
		padding: var(--s-space-md);
		border-radius: var(--s-radius-md);
		text-align: center;
		font-family: monospace;
		color: var(--s-text-primary);
		margin-bottom: var(--s-space-md);
		border: 1px solid var(--s-border);
	}

	/* Avatar Edit Styles */
	.avatar-edit-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-space-md);
		margin-bottom: var(--s-space-xl);
		padding-bottom: var(--s-space-md);
		border-bottom: 1px solid var(--s-border);
	}

	.avatar-preview {
		position: relative;
		width: 88px;
		height: 88px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--s-grad-hero);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--s-shadow-md);
		border: 3px solid var(--s-surface);
	}

	.avatar-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.upload-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2;
	}

	.spinner {
		animation: rotate 2s linear infinite;
		z-index: 2;
		width: 24px;
		height: 24px;
	}

	.spinner .path {
		stroke: white;
		stroke-linecap: round;
		animation: dash 1.5s ease-in-out infinite;
	}

	@keyframes rotate {
		100% { transform: rotate(360deg); }
	}

	@keyframes dash {
		0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
		50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
		100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
	}

	.upload-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.text-center { text-align: center; }
	.mt-2 { margin-top: 8px; }
	.modal-footer { margin-top: var(--s-space-lg); }

	/* Sound Selector Styles */
	.sound-options {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.sound-option {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-md) var(--s-space-lg);
		background: var(--s-bg-secondary);
		border: 2px solid transparent;
		border-radius: var(--s-radius-xl);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		text-align: left;
		width: 100%;
	}

	.sound-option:hover {
		background: var(--s-surface-hover);
		border-color: var(--s-border-strong);
	}

	.sound-option.selected {
		background: var(--s-accent-bg);
		border-color: var(--s-accent);
	}

	.sound-icon { font-size: 1.5rem; }
	
	.sound-name {
		flex: 1;
		font-weight: 700;
		color: var(--s-text-primary);
		font-size: 1.05rem;
	}

	.check-icon {
		color: var(--s-accent);
		font-weight: bold;
		font-size: 1.2rem;
	}

	.sound-help {
		margin-top: var(--s-space-lg);
		font-size: 0.8rem;
		color: var(--s-text-secondary);
		text-align: center;
	}
</style>

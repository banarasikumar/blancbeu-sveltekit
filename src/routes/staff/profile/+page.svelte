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

	onMount(() => {
		checkNotificationStatus();
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
			const success = await disableNotifications($staffUser.uid);
			if (success) {
				// Manually update local state to reflect it's effectively "off" for this app
				// even if browser permission is still granted
				$notificationStatus = 'default' as any;
				showToast('Push Notifications Disabled', 'success');
			} else {
				showToast('Failed to disable notifications', 'error');
			}
			return;
		}

		// Enable
		if (!$staffUser) return;
		const success = await requestNotificationPermission($staffUser.uid);
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
	themeMode.subscribe((t) => (currentTheme = t));

	function cycleTheme() {
		const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
		const idx = themes.indexOf(currentTheme);
		const next = themes[(idx + 1) % themes.length];
		setTheme(next);
		showToast(`Theme: ${next}`, 'success');
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
</script>

<div class="profile-page s-stagger">
	<!-- Avatar Section -->
	<section class="profile-hero">
		<div class="profile-avatar">
			{#if $staffUser?.photoURL}
				<img src={$staffUser.photoURL} alt="Profile" />
			{:else}
				<span class="avatar-initials">{initials}</span>
			{/if}
		</div>
		<h2 class="profile-name">{$staffUser?.displayName || 'Staff Member'}</h2>
		<p class="profile-role">Stylist</p>

		<!-- Availability Toggle -->
		<button
			class="availability-toggle"
			class:available={isAvailable}
			onclick={() => {
				isAvailable = !isAvailable;
				showToast(isAvailable ? 'You are now available' : 'Set to unavailable', 'success');
				if ('vibrate' in navigator) navigator.vibrate(10);
			}}
		>
			<span class="at-dot"></span>
			{isAvailable ? 'Available' : 'Unavailable'}
		</button>
	</section>

	<!-- Performance Stats -->
	<section class="stats-section">
		<h3 class="s-section-title">Performance</h3>
		<div class="stats-grid">
			<div class="perf-stat">
				<span class="ps-icon">🎯</span>
				<div class="ps-data">
					<span class="ps-value">{completedAll}</span>
					<span class="ps-label">Services Done</span>
				</div>
			</div>
			<div class="perf-stat">
				<span class="ps-icon">💰</span>
				<div class="ps-data">
					<span class="ps-value">₹{totalRevenue.toLocaleString()}</span>
					<span class="ps-label">Revenue</span>
				</div>
			</div>
			<div class="perf-stat">
				<span class="ps-icon">⏱</span>
				<div class="ps-data">
					<span class="ps-value">{avgTime() || '—'}m</span>
					<span class="ps-label">Avg Time</span>
				</div>
			</div>
			<div class="perf-stat">
				<span class="ps-icon">📆</span>
				<div class="ps-data">
					<span class="ps-value">{thisMonthBookings()}</span>
					<span class="ps-label">This Month</span>
				</div>
			</div>
		</div>
	</section>

	<!-- Quick Navigation -->
	<section class="nav-section">
		{#each menuItems as item}
			<a href={item.path} class="nav-item-card s-card s-card-interactive">
				<span class="nic-icon">{item.icon}</span>
				<div class="nic-text">
					<span class="nic-label">{item.label}</span>
					<span class="nic-sub">{item.sub}</span>
				</div>
				<svg
					class="nic-arrow"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</a>
		{/each}
	</section>

	<!-- Settings -->
	<section class="settings-section">
		<h3 class="s-section-title">Settings</h3>

		<div
			class="setting-item"
			onclick={cycleTheme}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && cycleTheme()}
		>
			<span class="si-icon">{themeIcons[currentTheme]}</span>
			<div class="si-text">
				<span class="si-label">Theme</span>
				<span class="si-value">{currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}</span>
			</div>
			<span class="si-action">Tap to change</span>
		</div>

		<div
			class="setting-item"
			onclick={() => {
				soundEnabled.toggle();
				showToast($soundEnabled ? 'Sound enabled' : 'Sound disabled', 'success');
			}}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && soundEnabled.toggle()}
		>
			<span class="si-icon">{$soundEnabled ? '🔊' : '🔇'}</span>
			<div class="si-text">
				<span class="si-label">Sound Effects</span>
				<span class="si-value">{$soundEnabled ? 'On' : 'Off'}</span>
			</div>
			<div class="toggle-switch" class:on={$soundEnabled}>
				<div class="toggle-thumb"></div>
			</div>
		</div>

		<div
			class="setting-item"
			onclick={toggleNotifications}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && toggleNotifications()}
		>
			<span class="si-icon">🔔</span>
			<div class="si-text">
				<span class="si-label">Push Notifications</span>
				<span class="si-value">
					{#if $notificationStatus === 'granted'}
						On
					{:else if $notificationStatus === 'denied'}
						Blocked
					{:else if $notificationStatus === 'unsupported'}
						Not supported
					{:else}
						Off
					{/if}
				</span>
			</div>

			{#if $notificationStatus !== 'unsupported'}
				<div class="toggle-switch" class:on={$notificationStatus === 'granted'}>
					<div class="toggle-thumb"></div>
				</div>
			{/if}
		</div>

		<!-- Notification Sound Selection -->
		{#if $soundEnabled}
			<div
				class="setting-item sound-selector-item"
				onclick={() => showSoundSelector = true}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && (showSoundSelector = true)}
			>
				<span class="si-icon">🎵</span>
				<div class="si-text">
					<span class="si-label">Notification Sound</span>
					<span class="si-value">{currentSoundName()}</span>
				</div>
				<span class="si-action">Tap to change</span>
			</div>
		{/if}
	</section>

	<!-- Account Info -->
	<section class="account-section">
		<div class="account-info">
			<span class="ai-label">Email</span>
			<span class="ai-value">{$staffUser?.email || 'Not set'}</span>
		</div>
	</section>

	<!-- Sign Out -->
	<button class="logout-btn s-btn s-btn-danger s-btn-block s-btn-lg" onclick={handleLogout}>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
			<polyline points="16 17 21 12 16 7"></polyline>
			<line x1="21" y1="12" x2="9" y2="12"></line>
		</svg>
		Sign Out
	</button>

	<div class="app-version">
		<p>Blancbeu Staff v2.0</p>
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
					<h3>Choose Notification Sound</h3>
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
</div>

<style>
	.profile-page {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-xl);
		padding-bottom: var(--s-space-2xl);
	}

	/* Hero */
	.profile-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--s-space-xl) 0;
	}

	.profile-avatar {
		width: 88px;
		height: 88px;
		border-radius: var(--s-radius-2xl);
		overflow: hidden;
		background: var(--s-grad-hero);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--s-shadow-lg);
		margin-bottom: var(--s-space-lg);
		border: 4px solid var(--s-border-accent);
	}

	.profile-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-initials {
		font-family: var(--s-font-display);
		font-size: 2rem;
		font-weight: 800;
		color: white;
	}

	.profile-name {
		margin: 0 0 4px;
		font-family: var(--s-font-display);
		font-size: var(--s-text-2xl);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.profile-role {
		margin: 0 0 var(--s-space-lg);
		font-size: var(--s-text-sm);
		color: var(--s-text-secondary);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* Availability */
	.availability-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 20px;
		border-radius: var(--s-radius-full);
		border: 2px solid var(--s-cancelled);
		background: var(--s-cancelled-bg);
		color: var(--s-cancelled-text);
		font-weight: 700;
		font-size: var(--s-text-sm);
		cursor: pointer;
		transition: all var(--s-duration-normal) var(--s-ease);
	}

	.availability-toggle.available {
		border-color: var(--s-success);
		background: var(--s-success-bg);
		color: var(--s-completed-text);
	}

	.at-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--s-cancelled);
		transition: background var(--s-duration-normal) var(--s-ease);
	}

	.availability-toggle.available .at-dot {
		background: var(--s-success);
	}

	/* Performance Stats */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--s-space-sm);
	}

	.perf-stat {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-lg);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		box-shadow: var(--s-shadow-xs);
	}

	.ps-icon {
		font-size: 1.5rem;
	}

	.ps-data {
		display: flex;
		flex-direction: column;
	}

	.ps-value {
		font-family: var(--s-font-display);
		font-size: var(--s-text-lg);
		font-weight: 800;
		color: var(--s-text-primary);
		line-height: 1.2;
	}

	.ps-label {
		font-size: var(--s-text-xs);
		font-weight: 600;
		color: var(--s-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	/* Nav Section */
	.nav-section {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.nav-item-card {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-lg);
		text-decoration: none;
	}

	.nic-icon {
		font-size: 1.3rem;
	}

	.nic-text {
		flex: 1;
	}

	.nic-label {
		display: block;
		font-weight: 600;
		font-size: var(--s-text-base);
	}

	.nic-sub {
		display: block;
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
	}

	.nic-arrow {
		color: var(--s-text-tertiary);
	}

	/* Settings */
	.settings-section {
		display: flex;
		flex-direction: column;
		gap: var(--s-space-sm);
	}

	.setting-item {
		display: flex;
		align-items: center;
		gap: var(--s-space-md);
		padding: var(--s-space-lg);
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		cursor: pointer;
		transition: background var(--s-duration-fast) var(--s-ease);
	}

	.setting-item:active {
		background: var(--s-surface-active);
	}

	.si-icon {
		font-size: 1.2rem;
	}

	.si-text {
		flex: 1;
	}

	.si-label {
		display: block;
		font-weight: 600;
		font-size: var(--s-text-base);
	}

	.si-value {
		display: block;
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		font-weight: 500;
	}

	.si-action {
		font-size: var(--s-text-xs);
		color: var(--s-text-accent);
		font-weight: 600;
	}

	.si-icon-success {
		color: var(--s-success);
		font-weight: bold;
	}

	/* Toggle Switch */
	.toggle-switch {
		width: 44px;
		height: 24px;
		border-radius: var(--s-radius-full);
		background: var(--s-bg-tertiary);
		position: relative;
		cursor: pointer;
		transition: background var(--s-duration-normal) var(--s-ease);
	}

	.toggle-switch.on {
		background: var(--s-accent);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		box-shadow: var(--s-shadow-sm);
		transition: transform var(--s-duration-normal) var(--s-ease-spring);
	}

	.toggle-switch.on .toggle-thumb {
		transform: translateX(20px);
	}

	/* Account */
	.account-section {
		background: var(--s-surface);
		border: 1px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		padding: var(--s-space-lg);
	}

	.account-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.ai-label {
		font-size: var(--s-text-sm);
		font-weight: 600;
		color: var(--s-text-secondary);
	}

	.ai-value {
		font-size: var(--s-text-sm);
		font-weight: 500;
		color: var(--s-text-primary);
	}

	/* Logout */
	.logout-btn {
		margin-top: var(--s-space-sm);
	}

	.app-version {
		text-align: center;
	}

	.app-version p {
		font-size: var(--s-text-xs);
		color: var(--s-text-tertiary);
		font-weight: 500;
	}

	/* Simple Modal styles for the Denied Warning */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
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
		border-radius: var(--s-radius-xl);
		padding: var(--s-space-xl);
		animation: s-zoomIn var(--s-duration-normal) var(--s-ease-spring);
	}

	.modal-header h3 {
		margin: 0 0 var(--s-space-md);
		font-family: var(--s-font-display);
		font-size: var(--s-text-xl);
		text-align: center;
		color: var(--s-error);
	}

	.modal-body p {
		margin: 0 0 var(--s-space-md);
		text-align: center;
		color: var(--s-text-secondary);
		line-height: 1.5;
	}

	.settings-instructions {
		background: var(--s-bg-secondary);
		padding: var(--s-space-md);
		border-radius: var(--s-radius-md);
		text-align: center;
		font-family: monospace;
		color: var(--s-text-primary);
		margin-bottom: var(--s-space-md);
	}

	.text-center {
		text-align: center;
	}

	.mt-2 {
		margin-top: 8px;
	}

	.modal-footer {
		margin-top: var(--s-space-lg);
	}

	/* Sound Selector Styles */
	.sound-selector-item {
		background: linear-gradient(135deg, var(--s-surface) 0%, var(--s-bg-secondary) 100%);
	}

	.sound-modal .modal-header h3 {
		color: var(--s-text-primary);
	}

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
		border: 2px solid var(--s-border);
		border-radius: var(--s-radius-lg);
		cursor: pointer;
		transition: all var(--s-duration-fast) var(--s-ease);
		text-align: left;
		width: 100%;
	}

	.sound-option:hover {
		background: var(--s-surface-hover);
		border-color: var(--s-accent);
	}

	.sound-option.selected {
		background: var(--s-accent-bg);
		border-color: var(--s-accent);
	}

	.sound-icon {
		font-size: 1.5rem;
	}

	.sound-name {
		flex: 1;
		font-weight: 600;
		color: var(--s-text-primary);
	}

	.check-icon {
		color: var(--s-success);
		font-weight: bold;
		font-size: 1.2rem;
	}

	.sound-help {
		margin-top: var(--s-space-lg);
		font-size: var(--s-text-xs);
		color: var(--s-text-secondary);
		text-align: center;
	}
</style>

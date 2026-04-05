<script lang="ts">
	import { adminUser } from '$lib/stores/adminAuth';
	import {
		allBookings,
		allUsers,
		bookingCount,
		pendingCount,
		userCount,
		serviceCount
	} from '$lib/stores/adminData';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import {
		CalendarCheck,
		Users,
		Clock,
		Star,
		Plus,
		UserPlus,
		Megaphone,
		BarChart3,
		FileText,
		Scissors,
		Bell
	} from 'lucide-svelte';
	import { flip } from 'svelte/animate';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import {
		requestNotificationPermission,
		disableNotifications,
		notificationStatus,
		checkNotificationStatus
	} from '$lib/stores/adminNotificationPreferences';
	import { 
		adminUnreadCount
	} from '$lib/stores/adminNotificationsList';
	import { 
		soundEnabled as adminSoundEnabled,
		selectedSoundType as adminSelectedSoundType,
		customSoundPath as adminCustomSoundPath,
		AVAILABLE_SOUNDS as ADMIN_AVAILABLE_SOUNDS,
		type SoundType
	} from '$lib/stores/adminNotificationPreferences';
	import { playNotificationSound } from '$lib/utils/notificationSound';

	let userName = $derived(($adminUser?.displayName || 'Admin').split(' ')[0]);

	// Sound settings
	let showSoundSelector = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);

	function currentSoundName(): string {
		const type = $adminSelectedSoundType;
		if (type === 'custom') return 'Custom Sound';
		const sound = ADMIN_AVAILABLE_SOUNDS.find((s) => s.id === type);
		return sound?.name || 'Default';
	}

	async function handleSoundSelect(soundId: SoundType) {
		adminSelectedSoundType.set(soundId);
		// Preview the sound
		try {
			if (soundId === 'custom') {
				const customPath = $adminCustomSoundPath;
				if (customPath) {
					await playNotificationSound(customPath, 0.5);
				}
			} else {
				const sound = ADMIN_AVAILABLE_SOUNDS.find((s) => s.id === soundId);
				if (sound) {
					await playNotificationSound(sound.path, 0.5);
				}
			}
		} catch {
			// Fallback chime plays automatically
		}
	}

	function openFilePicker() {
		fileInput?.click();
	}

	async function handleCustomSoundUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('audio/')) {
			showToast('Please select an audio file', 'error');
			return;
		}

		// Validate file size (max 2MB)
		if (file.size > 2 * 1024 * 1024) {
			showToast('File too large (max 2MB)', 'error');
			return;
		}

		// Convert to base64 and store
		const reader = new FileReader();
		reader.onload = () => {
			const base64 = reader.result as string;
			adminCustomSoundPath.set(base64);
			adminSelectedSoundType.set('custom');
			showToast('Custom sound uploaded!', 'success');
			// Preview the custom sound
			playNotificationSound(base64, 0.5).catch(() => {
				// Silent fail
			});
		};
		reader.readAsDataURL(file);
	}

	let showDeniedModal = $state(false);

	const stats = $derived([
		{
			label: 'Total Bookings',
			value: $bookingCount,
			icon: CalendarCheck,
			bg: 'var(--admin-accent-light)',
			color: 'var(--admin-accent)',
			action: () => goto('/admin/bookings')
		},
		{
			label: 'Active Users',
			value: $userCount,
			icon: Users,
			bg: 'var(--admin-green-light)',
			color: 'var(--admin-green)',
			action: () => goto('/admin/users')
		},
		{
			label: 'Pending Appts',
			value: $pendingCount,
			icon: Clock,
			bg: 'var(--admin-orange-light)',
			color: 'var(--admin-orange)',
			action: () => goto('/admin/bookings')
		},
		{
			label: 'Total Services',
			value: $serviceCount,
			icon: Scissors,
			bg: 'var(--admin-purple-light)',
			color: 'var(--admin-purple)',
			action: () => goto('/admin/services')
		}
	]);

	let actions = $state([
		{
			label: 'Invoice',
			icon: FileText,
			bg: 'var(--admin-purple)',
			handler: () => goto('/admin/invoice')
		},
		{
			label: 'Service',
			icon: Plus,
			bg: 'var(--admin-accent)',
			handler: () => goto('/admin/services')
		},
		{
			label: 'Staff',
			icon: UserPlus,
			bg: 'var(--admin-green)',
			handler: () => showToast('Add Staff — coming soon!', 'success')
		},
		{
			label: 'Notify',
			icon: Megaphone,
			bg: 'var(--admin-indigo)',
			handler: () => showToast('Notifications — coming soon!', 'success')
		},
		{
			label: 'Reports',
			icon: BarChart3,
			bg: 'var(--admin-pink)',
			handler: () => showToast('Reports — coming soon!', 'success')
		}
	]);

	/* --- Drag & Drop Reordering --- */
	let isEditing = $state(false);
	let draggingIndex = $state<number | null>(null);

	onMount(() => {
		checkNotificationStatus();

		// Auto-prompt Admin after 2 seconds
		setTimeout(() => {
			if ($notificationStatus === 'default' && $adminUser) {
				requestNotificationPermission($adminUser.uid).then((success) => {
					if (success) {
						showToast('Push Notifications Enabled!', 'success');
					}
				});
			}
		}, 2000);

		if (browser) {
			const saved = localStorage.getItem('adminActionOrder');
			if (saved) {
				try {
					const order = JSON.parse(saved);
					actions.sort((a, b) => {
						const idxA = order.indexOf(a.label);
						const idxB = order.indexOf(b.label);
						if (idxA === -1) return 1;
						if (idxB === -1) return -1;
						return idxA - idxB;
					});
				} catch {
					/* ignore bad data */
				}
			}
		}
	});

	function handlePointerDown(e: PointerEvent, index: number) {
		if (!isEditing) return;
		e.preventDefault();
		draggingIndex = index;
		window.addEventListener('pointermove', handleGlobalPointerMove);
		window.addEventListener('pointerup', handleGlobalPointerUp);
	}

	function handleGlobalPointerMove(e: PointerEvent) {
		if (draggingIndex === null) return;
		const elements = document.elementsFromPoint(e.clientX, e.clientY);
		const target = elements.find((el) => el.closest('.admin-action-btn'));
		if (target) {
			const btn = target.closest('.admin-action-btn') as HTMLElement;
			if (btn && btn.dataset.index) {
				const newIndex = parseInt(btn.dataset.index);
				if (newIndex !== draggingIndex) {
					const item = actions[draggingIndex];
					actions.splice(draggingIndex, 1);
					actions.splice(newIndex, 0, item);
					draggingIndex = newIndex;
				}
			}
		}
	}

	function handleGlobalPointerUp() {
		draggingIndex = null;
		window.removeEventListener('pointermove', handleGlobalPointerMove);
		window.removeEventListener('pointerup', handleGlobalPointerUp);
		if (browser) {
			const order = actions.map((a) => a.label);
			localStorage.setItem('adminActionOrder', JSON.stringify(order));
		}
	}

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('pointermove', handleGlobalPointerMove);
			window.removeEventListener('pointerup', handleGlobalPointerUp);
		}
	});

	function toggleEdit() {
		isEditing = !isEditing;
	}

	async function toggleNotifications() {
		if ($notificationStatus === 'denied') {
			showDeniedModal = true;
			return;
		}

		if ($notificationStatus === 'granted') {
			if (!$adminUser) return;
			const success = await disableNotifications($adminUser.uid);
			if (success) {
				$notificationStatus = 'default' as any;
				showToast('Push Notifications Disabled', 'success');
			}
			return;
		}

		if (!$adminUser) return;
		const success = await requestNotificationPermission($adminUser.uid);
		if (success) {
			showToast('Push Notifications Enabled!', 'success');
		} else if (Notification.permission === 'denied') {
			showDeniedModal = true;
		}
	}

	function toggleAdminSound() {
		adminSoundEnabled.toggle();
		showToast($adminSoundEnabled ? 'Sound enabled' : 'Sound disabled', 'success');
	}
</script>

<!-- Hero Section -->
<div class="admin-hero">
	<span class="admin-hero-badge">BLANCBEU SALON</span>
	<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
		<div>
			<h1>Hello, {userName}</h1>
			<p>Overview for today.</p>
		</div>
		<button
			class="notification-btn"
			onclick={() => goto('/admin/notifications')}
			title="View notifications"
		>
			<Bell size={24} />
			{#if $adminUnreadCount > 0}
				<span class="notification-badge">{$adminUnreadCount}</span>
			{/if}
		</button>
	</div>
</div>

<!-- Stats Grid -->
<div style="margin-bottom: 32px;">
	<h3 class="admin-section-title">Overview</h3>
	<div class="admin-stats-grid">
		{#each stats as stat}
			<button class="admin-stat-card" onclick={stat.action}>
				<div class="admin-stat-icon" style="background: {stat.bg}; color: {stat.color};">
					<stat.icon size={20} />
				</div>
				<div class="admin-stat-value">{stat.value}</div>
				<div class="admin-stat-label">{stat.label}</div>
			</button>
		{/each}
	</div>
</div>

<!-- Settings Section -->
<div style="margin-bottom: 32px;">
	<h3 class="admin-section-title">Settings</h3>
	<div class="admin-settings-grid">
		<!-- Sound Toggle -->
		<button class="admin-setting-card" onclick={toggleAdminSound}>
			<div class="admin-setting-icon" style="background: var(--admin-accent-light); color: var(--admin-accent);">
				{$adminSoundEnabled ? '🔊' : '🔇'}
			</div>
			<div class="admin-setting-text">
				<span class="admin-setting-label">Sound Effects</span>
				<span class="admin-setting-value">{$adminSoundEnabled ? 'On' : 'Off'}</span>
			</div>
		</button>

		<!-- Sound Selector -->
		{#if $adminSoundEnabled}
			<button class="admin-setting-card" onclick={() => showSoundSelector = true}>
				<div class="admin-setting-icon" style="background: var(--admin-purple-light); color: var(--admin-purple);">
					🎵
				</div>
				<div class="admin-setting-text">
					<span class="admin-setting-label">Notification Sound</span>
					<span class="admin-setting-value">{currentSoundName()}</span>
				</div>
				<span class="admin-setting-action">Tap to change</span>
			</button>
		{/if}

		<!-- Push Notifications -->
		<button class="admin-setting-card" onclick={toggleNotifications}>
			<div class="admin-setting-icon" style="background: var(--admin-green-light); color: var(--admin-green);">
				🔔
			</div>
			<div class="admin-setting-text">
				<span class="admin-setting-label">Push Notifications</span>
				<span class="admin-setting-value">
					{#if $notificationStatus === 'granted'}
						On
					{:else if $notificationStatus === 'denied'}
						Blocked
					{:else}
						Off
					{/if}
				</span>
			</div>
		</button>
	</div>
</div>

<!-- Quick Actions -->
<div>
	<div
		style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;"
	>
		<h3 class="admin-section-title" style="margin-bottom: 0;">Quick Actions</h3>
		<button
			onclick={toggleEdit}
			style="background: none; border: none; font-size: 14px; font-weight: 600; color: var(--admin-accent); cursor: pointer;"
		>
			{isEditing ? 'Done' : 'Edit'}
		</button>
	</div>

	<div class="admin-actions-grid">
		{#each actions as action, i (action.label)}
			<button
				class="admin-action-btn"
				class:editing={isEditing}
				class:dragging={draggingIndex === i}
				data-index={i}
				onclick={!isEditing ? action.handler : undefined}
				onpointerdown={(e) => handlePointerDown(e, i)}
				style="touch-action: none;"
				animate:flip={{ duration: 300 }}
			>
				<div
					class="admin-action-icon"
					style="background: {action.bg}; opacity: {isEditing ? 0.8 : 1};"
				>
					<action.icon size={20} color="#000" />
				</div>
				<span>{action.label}</span>
			</button>
		{/each}
	</div>
</div>

<!-- Hidden file input for custom sound -->
<input
	bind:this={fileInput}
	type="file"
	accept="audio/*"
	onchange={handleCustomSoundUpload}
	style="display: none;"
/>

<!-- Permission Denied Modal -->
{#if showDeniedModal}
	<div class="modal-backdrop" onclick={() => (showDeniedModal = false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-icon">🔕</div>
			<h3>Notifications Blocked</h3>
			<p>Please enable notifications in your browser settings to receive booking alerts.</p>
			<button class="modal-btn primary" onclick={() => (showDeniedModal = false)}>Got it</button>
		</div>
	</div>
{/if}

<!-- Sound Selector Modal -->
{#if showSoundSelector}
	<div class="modal-backdrop" onclick={() => (showSoundSelector = false)}>
		<div class="modal-content sound-selector" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>Choose Notification Sound</h3>
				<button class="close-btn" onclick={() => (showSoundSelector = false)}>✕</button>
			</div>

			<div class="sound-list">
				{#each ADMIN_AVAILABLE_SOUNDS as sound}
					<button
						class="sound-option"
						class:selected={$adminSelectedSoundType === sound.id}
						onclick={() => handleSoundSelect(sound.id)}
					>
						<span class="sound-name">{sound.name}</span>
						{#if $adminSelectedSoundType === sound.id}
							<span class="check">✓</span>
						{/if}
					</button>
				{/each}

				<!-- Custom Sound Option -->
				<button
					class="sound-option"
					class:selected={$adminSelectedSoundType === 'custom'}
					onclick={openFilePicker}
				>
					<span class="sound-name">
						{$adminCustomSoundPath ? 'Custom Sound (Change)' : 'Upload Custom Sound...'}
					</span>
					{#if $adminSelectedSoundType === 'custom'}
						<span class="check">✓</span>
					{/if}
				</button>
			</div>

			<div class="modal-footer">
				<button class="modal-btn secondary" onclick={() => (showSoundSelector = false)}>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.admin-stat-card {
		text-align: left;
		cursor: pointer;
		border: none;
		font-family: inherit;
	}

	.admin-action-btn.editing {
		cursor: grab;
		animation: jiggle 0.8s ease-in-out infinite;
		transform-origin: center center;
	}

	.admin-action-btn.editing:nth-child(2n) {
		animation-delay: -0.2s;
	}

	.admin-action-btn.editing:nth-child(3n) {
		animation-delay: -0.5s;
	}

	.admin-action-btn.dragging {
		cursor: grabbing;
		opacity: 0.6;
		transform: scale(1.05);
		z-index: 10;
		animation: none;
	}

	@keyframes jiggle {
		0% {
			transform: rotate(0deg);
		}
		25% {
			transform: rotate(3deg);
		}
		50% {
			transform: rotate(0deg);
		}
		75% {
			transform: rotate(-3deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}

	/* Admin Settings Styles */
	.admin-settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.admin-setting-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: white;
		border-radius: 12px;
		border: 1px solid var(--admin-border, #e5e5e5);
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.admin-setting-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.08);
	}

	.admin-setting-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		flex-shrink: 0;
	}

	.admin-setting-text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.admin-setting-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--admin-text, #1a1a1a);
	}

	.admin-setting-value {
		font-size: 12px;
		color: var(--admin-text-secondary, #666);
		margin-top: 2px;
	}

	.admin-setting-action {
		font-size: 12px;
		color: var(--admin-accent, #6366f1);
		font-weight: 500;
	}

	/* Modal Styles */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: white;
		border-radius: 16px;
		padding: 24px;
		max-width: 400px;
		width: 100%;
		text-align: center;
		animation: modalIn 0.2s ease;
	}

	.modal-content.sound-selector {
		text-align: left;
		max-width: 320px;
	}

	@keyframes modalIn {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.modal-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.modal-content h3 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 8px 0;
		color: var(--admin-text, #1a1a1a);
	}

	.modal-content p {
		font-size: 14px;
		color: var(--admin-text-secondary, #666);
		margin: 0 0 20px 0;
		line-height: 1.5;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.modal-header h3 {
		margin: 0;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 20px;
		color: #999;
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}

	.sound-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.sound-option {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: #f5f5f5;
		border: 2px solid transparent;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
		color: var(--admin-text, #1a1a1a);
	}

	.sound-option:hover {
		background: #eee;
	}

	.sound-option.selected {
		border-color: var(--admin-accent, #6366f1);
		background: var(--admin-accent-light, #e0e7ff);
	}

	.sound-name {
		font-weight: 500;
	}

	.check {
		color: var(--admin-accent, #6366f1);
		font-weight: 700;
	}

	.modal-footer {
		display: flex;
		justify-content: center;
		gap: 12px;
	}

	.modal-btn {
		padding: 12px 24px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.modal-btn.primary {
		background: var(--admin-accent, #6366f1);
		color: white;
	}

	.modal-btn.primary:hover {
		background: #5558e0;
	}

	.modal-btn.secondary {
		background: #f5f5f5;
		color: var(--admin-text, #1a1a1a);
	}

	.modal-btn.secondary:hover {
		background: #eee;
	}

	.notification-btn {
		position: relative;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: none;
		background: var(--admin-bg-secondary, #f3f4f6);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.notification-btn:hover {
		background: var(--admin-border, #e5e5e5);
	}

	.notification-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		background: var(--admin-accent, #6366f1);
		color: white;
		font-size: 12px;
		font-weight: 700;
		min-width: 20px;
		height: 20px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 6px;
	}
</style>

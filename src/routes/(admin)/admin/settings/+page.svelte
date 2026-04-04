<script lang="ts">
	import { adminUser, adminLogout } from '$lib/stores/adminAuth';
	import { goto } from '$app/navigation';
	import { showToast } from '$lib/stores/toast';
	import { UserCircle, Bell, LogOut, ChevronRight, Database } from 'lucide-svelte';
	import { migrateServices } from '$lib/migrateServices';

	let userName = $derived($adminUser?.displayName || 'Admin User');
	let userEmail = $derived($adminUser?.email || '');
	let userInitial = $derived((userName || 'A').charAt(0).toUpperCase());

	let isMigrating = $state(false);

	async function handleLogout() {
		if (!confirm('Are you sure you want to logout?')) return;
		try {
			await adminLogout();
			showToast('Logged out successfully', 'logout');
			goto('/admin/login');
		} catch (e: any) {
			showToast('Logout failed', 'error');
		}
	}

	async function handleMigration() {
		if (!confirm('This will migrate legacy services to the database. Continue?')) return;
		isMigrating = true;
		try {
			const result = await migrateServices();
			showToast(
				`Result: ${result.added} Added, ${result.skipped} Skipped, ${result.errors} Errors`,
				result.errors > 0 ? 'error' : 'success'
			);
		} catch (e) {
			console.error(e);
			showToast('Migration failed', 'error');
		} finally {
			isMigrating = false;
		}
	}

	function comingSoon(feature: string) {
		showToast(`${feature} — coming soon!`, 'success');
	}

	// Notifications
	import {
		requestNotificationPermission,
		disableNotifications,
		notificationStatus,
		checkNotificationStatus,
		soundEnabled
	} from '$lib/stores/staffNotifications';
	import { onMount } from 'svelte';
	import { doc, updateDoc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';

	onMount(async () => {
		checkNotificationStatus();

		// Load notification preferences from Firestore
		// ($adminUser is a Firebase Auth User — notificationPreferences lives in Firestore, not on the Auth object)
		if ($adminUser) {
			try {
				const snap = await getDoc(doc(db, 'users', $adminUser.uid));
				if (snap.exists()) {
					const prefs = snap.data()?.notificationPreferences;
					if (prefs) {
						prefNewBookings = prefs.newBookings !== false;
						prefNewSignups = prefs.newSignups !== false;
					}
				}
			} catch (e) {
				console.warn('[AdminSettings] Failed to load notification preferences:', e);
			}
		}
	});

	let showDeniedModal = $state(false);
	let prefNewBookings = $state(true);
	let prefNewSignups = $state(true);

	async function updatePreference(type: 'newBookings' | 'newSignups', value: boolean) {
		if (!$adminUser) return;
		try {
			await updateDoc(doc(db, 'users', $adminUser.uid), {
				[`notificationPreferences.${type}`]: value
			});
			showToast('Preferences updated', 'success');
		} catch (e) {
			console.error('Failed to update preference:', e);
			showToast('Failed to save preference', 'error');
			// Revert toggle visually on error
			if (type === 'newBookings') prefNewBookings = !value;
			if (type === 'newSignups') prefNewSignups = !value;
		}
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
			} else {
				showToast('Failed to disable notifications', 'error');
			}
			return;
		}

		// Enable
		if (!$adminUser) return;
		const success = await requestNotificationPermission($adminUser.uid);
		if (success) {
			showToast('Push Notifications Enabled!', 'success');
		} else if (Notification.permission === 'denied') {
			showDeniedModal = true;
		} else {
			showToast('Failed to enable, please try again.', 'error');
		}
	}
</script>

<!-- Profile Card -->
<div class="admin-settings-profile">
	<div class="admin-settings-avatar">
		{userInitial}
	</div>
	<div>
		<h3 style="font-size: 18px; font-weight: 700; margin-bottom: 3px;">{userName}</h3>
		<p style="font-size: 14px; color: var(--admin-text-secondary);">{userEmail}</p>
	</div>
</div>

<!-- Settings List -->
<div class="admin-settings-list">
	<div
		class="admin-settings-item"
		role="button"
		tabindex="0"
		onclick={() => comingSoon('Edit Profile')}
	>
		<div class="admin-settings-item-left">
			<UserCircle size={20} color="var(--admin-accent)" />
			<span style="font-size: 16px; font-weight: 500;">Edit Profile</span>
		</div>
		<ChevronRight size={16} color="var(--admin-text-tertiary)" />
	</div>

	<div class="admin-settings-item" role="button" tabindex="0" onclick={handleMigration}>
		<div class="admin-settings-item-left">
			<Database size={20} color="var(--admin-indigo)" />
			<span style="font-size: 16px; font-weight: 500;">
				{isMigrating ? 'Migrating...' : 'Migrate Services'}
			</span>
		</div>
		{#if !isMigrating}
			<ChevronRight size={16} color="var(--admin-text-tertiary)" />
		{/if}
	</div>

	<div
		class="admin-settings-item"
		role="button"
		tabindex="0"
		onclick={toggleNotifications}
		onkeydown={(e) => e.key === 'Enter' && toggleNotifications()}
	>
		<div class="admin-settings-item-left">
			<Bell size={20} color="var(--admin-red)" />
			<div style="display: flex; flex-direction: column;">
				<span style="font-size: 16px; font-weight: 500;">Push Notifications</span>
				<span style="font-size: 12px; color: var(--admin-text-secondary);">
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
		</div>
		{#if $notificationStatus !== 'unsupported'}
			<div class="toggle-switch" class:on={$notificationStatus === 'granted'}>
				<div class="toggle-thumb"></div>
			</div>
		{/if}
	</div>

	{#if $notificationStatus === 'granted'}
		<div class="admin-settings-subcard">
			<h4
				style="font-size: 13px; color: var(--admin-text-secondary); margin: 0 0 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;"
			>
				Preferences
			</h4>

			<div class="admin-settings-subitem">
				<div style="display: flex; flex-direction: column;">
					<span style="font-size: 15px; font-weight: 500;">📅 New Bookings</span>
				</div>
				<div
					class="sub-toggle-switch"
					class:on={prefNewBookings}
					role="button"
					tabindex="0"
					onclick={() => {
						prefNewBookings = !prefNewBookings;
						updatePreference('newBookings', prefNewBookings);
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							prefNewBookings = !prefNewBookings;
							updatePreference('newBookings', prefNewBookings);
						}
					}}
				>
					<div class="sub-toggle-thumb"></div>
				</div>
			</div>

			<div
				class="admin-settings-subitem"
				style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;"
			>
				<div style="display: flex; flex-direction: column;">
					<span style="font-size: 15px; font-weight: 500;">👤 New Signups</span>
				</div>
				<div
					class="sub-toggle-switch"
					class:on={prefNewSignups}
					role="button"
					tabindex="0"
					onclick={() => {
						prefNewSignups = !prefNewSignups;
						updatePreference('newSignups', prefNewSignups);
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							prefNewSignups = !prefNewSignups;
							updatePreference('newSignups', prefNewSignups);
						}
					}}
				>
					<div class="sub-toggle-thumb"></div>
				</div>
			</div>
		</div>
	{/if}

	<div
		class="admin-settings-item"
		role="button"
		tabindex="0"
		onclick={() => {
			soundEnabled.toggle();
			showToast($soundEnabled ? 'Sound enabled' : 'Sound disabled', 'success');
		}}
		onkeydown={(e) => e.key === 'Enter' && soundEnabled.toggle()}
	>
		<div class="admin-settings-item-left">
			<span style="font-size: 20px;">{$soundEnabled ? '🔊' : '🔇'}</span>
			<div style="display: flex; flex-direction: column;">
				<span style="font-size: 16px; font-weight: 500;">Sound Effects</span>
				<span style="font-size: 12px; color: var(--admin-text-secondary);">
					{$soundEnabled ? 'On' : 'Off'}
				</span>
			</div>
		</div>
		<div class="toggle-switch" class:on={$soundEnabled}>
			<div class="toggle-thumb"></div>
		</div>
	</div>

	<div class="admin-settings-item" role="button" tabindex="0" onclick={handleLogout}>
		<div class="admin-settings-item-left">
			<LogOut size={20} color="var(--admin-red)" />
			<span style="font-size: 16px; font-weight: 500; color: var(--admin-red);">Logout</span>
		</div>
	</div>
</div>

<div class="admin-version">
	<p>Admin Panel v2.0.0</p>
	<p style="margin-top: 4px;">Powered by SvelteKit</p>
</div>

<!-- Permission Denied Modal -->
{#if showDeniedModal}
	<div class="modal-backdrop" onclick={() => (showDeniedModal = false)} role="presentation">
		<div class="modal-content s-card" onclick={(e) => e.stopPropagation()} role="presentation">
			<div class="modal-header">
				<h3 style="margin: 0 0 16px; font-size: 20px; text-align: center; color: var(--admin-red);">
					Notifications Blocked
				</h3>
			</div>
			<div class="modal-body">
				<p
					style="margin: 0 0 16px; text-align: center; color: var(--admin-text-secondary); line-height: 1.5;"
				>
					Your browser is currently blocking notifications for this app. To receive alerts against
					new bookings, open your device settings:
				</p>
				<div
					style="background: var(--admin-bg-secondary); padding: 16px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 13px;"
				>
					<strong>Settings &gt; Apps &gt; Blancbeu Admin &gt; Permissions</strong>
				</div>
				<p style="margin-top: 8px; text-align: center; font-size: 13px;">
					and Allow Notifications.
				</p>
			</div>
			<div class="modal-footer" style="margin-top: 24px;">
				<button class="s-btn s-btn-primary s-btn-block" onclick={() => (showDeniedModal = false)}>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Modal Styles */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.modal-content {
		width: 100%;
		max-width: 400px;
		background: white;
		border-radius: 24px;
		padding: 32px;
	}

	/* Toggle Snippet */
	.toggle-switch {
		width: 44px;
		height: 24px;
		border-radius: 24px;
		background: #e2e8f0;
		position: relative;
		cursor: pointer;
		transition: background 0.3s ease;
	}

	.toggle-switch.on {
		background: var(--admin-accent);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.toggle-switch.on .toggle-thumb {
		transform: translateX(20px);
	}

	/* Sub Setting toggles */
	.admin-settings-subcard {
		background: var(--admin-bg-secondary);
		border-radius: 16px;
		padding: 16px;
		margin-top: -8px;
		margin-bottom: 12px;
		animation: slideDown 0.3s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.admin-settings-subitem {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
	}

	.admin-settings-subitem:last-child {
		border-bottom: none;
	}

	.sub-toggle-switch {
		width: 36px;
		height: 20px;
		border-radius: 20px;
		background: #cbd5e1;
		position: relative;
		cursor: pointer;
		transition: background 0.3s ease;
	}

	.sub-toggle-switch.on {
		background: var(--admin-green); /* Or var(--admin-accent) */
	}

	.sub-toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.sub-toggle-switch.on .sub-toggle-thumb {
		transform: translateX(16px);
	}
</style>

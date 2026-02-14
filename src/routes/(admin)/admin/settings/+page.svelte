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
		onclick={() => comingSoon('Notifications')}
	>
		<div class="admin-settings-item-left">
			<Bell size={20} color="var(--admin-red)" />
			<span style="font-size: 16px; font-weight: 500;">Notifications</span>
		</div>
		<ChevronRight size={16} color="var(--admin-text-tertiary)" />
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

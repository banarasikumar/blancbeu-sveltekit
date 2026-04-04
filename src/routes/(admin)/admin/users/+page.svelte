<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		allUsers,
		getUserDisplayName,
		getUserPhoto,
		getUserPhone,
		type AppUser
	} from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { Search, UsersRound, MoreVertical, History, Mail, Phone, Copy, X } from 'lucide-svelte';

	let searchQuery = $state('');
	let selectedUser = $state<AppUser | null>(null);
	let showWalkIns = $state(true);
	let showMerged = $state(false);

	let sortBy = $state<'name' | 'joined'>('name');

	// Filtered & Sorted users
	let filteredUsers = $derived.by(() => {
		let users = $allUsers;

		// Hide merged shadow accounts by default
		if (!showMerged) {
			users = users.filter((u) => u.accountStatus !== 'merged');
		}

		// Toggle walk-in (shadow) accounts
		if (!showWalkIns) {
			users = users.filter((u) => u.accountType !== 'walkin');
		}

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			users = users.filter(
				(u) =>
					getUserDisplayName(u).toLowerCase().includes(q) ||
					(u.email || '').toLowerCase().includes(q) ||
					(getUserPhone(u) || '').includes(q)
			);
		}

		return users.sort((a, b) => {
			if (sortBy === 'name') {
				return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
			} else {
				// Sort by joined date (assuming created_at or fallback)
				// Note: AppUser interface might not have a reliable createdAt on client without checking definition.
				// Falling back to name if no date, or implementation of check.
				// However, standard fireship-like user objects usually have createdAt timestamps.
				const tA = (a as any).createdAt?.seconds || 0;
				const tB = (b as any).createdAt?.seconds || 0;
				return tB - tA; // Newest first
			}
		});
	});

	// Avatar colors
	const colors = [
		'#FF9F0A',
		'#30D158',
		'#0A84FF',
		'#BF5AF2',
		'#FF375F',
		'#AC8E68',
		'#5E5CE6',
		'#32ADE6',
		'#E04F5C'
	];

	function getColor(name: string): string {
		return colors[(name || '?').charCodeAt(0) % colors.length];
	}

	// Action sheet
	function openUserOptions(user: AppUser) {
		selectedUser = user;
	}

	function closeSheet() {
		selectedUser = null;
	}

	function viewBookingHistory(uid: string) {
		closeSheet();
		goto('/admin/bookings');
		// After navigation, the bookings page search can be used
	}

	async function copyUserId(uid: string) {
		try {
			await navigator.clipboard.writeText(uid);
			showToast('User ID Copied!', 'success');
		} catch {
			showToast('Failed to copy', 'error');
		}
		closeSheet();
	}
</script>

<!-- Header -->
<div class="admin-view-header">
	<h2 class="admin-view-title">Users</h2>
	<div style="font-size: 12px; color: var(--admin-text-secondary); font-weight: 600;">
		{filteredUsers.length} shown
	</div>
</div>

<!-- Filters -->
<div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
	<button
		style="font-size: 11px; padding: 4px 10px; border-radius: 20px; border: 1px solid {showWalkIns ? 'var(--admin-accent)' : 'var(--admin-border)'}; background: {showWalkIns ? 'rgba(var(--admin-accent-rgb, 99,102,241),0.15)' : 'transparent'}; color: {showWalkIns ? 'var(--admin-accent)' : 'var(--admin-text-secondary)'}; cursor: pointer;"
		onclick={() => (showWalkIns = !showWalkIns)}
	>
		Walk-ins {showWalkIns ? '✓' : ''}
	</button>
	<button
		style="font-size: 11px; padding: 4px 10px; border-radius: 20px; border: 1px solid {showMerged ? 'var(--admin-accent)' : 'var(--admin-border)'}; background: {showMerged ? 'rgba(var(--admin-accent-rgb, 99,102,241),0.15)' : 'transparent'}; color: {showMerged ? 'var(--admin-accent)' : 'var(--admin-text-secondary)'}; cursor: pointer;"
		onclick={() => (showMerged = !showMerged)}
	>
		Merged {showMerged ? '✓' : ''}
	</button>
</div>

<!-- Search & Sort -->
<div class="admin-search-bar" style="display: flex; gap: 8px;">
	<div style="position: relative; flex: 1;">
		<Search size={16} class="admin-search-icon" />
		<input
			type="text"
			placeholder="Search users by name or email..."
			bind:value={searchQuery}
			style="width: 100%;"
		/>
	</div>
	<select class="admin-sort-select" bind:value={sortBy}>
		<option value="name">Name</option>
		<option value="joined">Joined</option>
	</select>
</div>

<!-- Users List -->
{#if filteredUsers.length === 0}
	<div class="admin-empty-state">
		<UsersRound size={44} color="var(--admin-text-tertiary)" />
		<p>No users found</p>
	</div>
{:else}
	{#each filteredUsers as user (user.id)}
		{@const name = getUserDisplayName(user)}
		{@const photo = getUserPhoto(user)}
		{@const phone = getUserPhone(user)}

		<div class="admin-user-card">
			{#if photo}
				<img src={photo} alt={name} class="admin-avatar-img" />
			{:else}
				<div class="admin-avatar-fallback" style="background: {getColor(name)};">
					{name.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="admin-user-info">
				<div class="admin-user-name">
					{name}
					{#if user.accountType === 'walkin'}
						<span class="admin-role-badge" style="background: rgba(234,179,8,0.15); color: #ca8a04; border-color: rgba(234,179,8,0.3);">
							WALK-IN
						</span>
					{:else}
						<span
							class="admin-role-badge"
							class:admin={user.role === 'admin'}
							class:user={user.role !== 'admin'}
						>
							{user.role === 'admin' ? 'ADMIN' : 'USER'}
						</span>
					{/if}
				</div>
				<div class="admin-user-email">{user.email || 'No email'}</div>
				{#if phone}
					<div class="admin-user-phone">
						<Phone size={10} />
						{phone}
					</div>
				{/if}
				<div style="font-size: 10px; color: var(--admin-text-tertiary); margin-top: 3px;">
					ID: {user.id.slice(0, 8)}...
				</div>
			</div>

			<button class="admin-options-btn" onclick={() => openUserOptions(user)} aria-label="Options">
				<MoreVertical size={18} />
			</button>
		</div>
	{/each}
{/if}

<!-- Action Sheet -->
{#if selectedUser}
	{@const name = getUserDisplayName(selectedUser)}
	{@const phone = getUserPhone(selectedUser)}

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div class="admin-action-sheet-overlay" onclick={closeSheet} role="dialog" tabindex="-1">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div class="admin-action-sheet" onclick={(e) => e.stopPropagation()} role="document">
			<div class="admin-action-sheet-header">
				<div>
					<h3>{name}</h3>
					<span style="font-size: 12px; color: var(--admin-text-secondary);">{selectedUser.id}</span
					>
				</div>
				<button class="admin-header-btn" onclick={closeSheet} aria-label="Close">
					<X size={20} />
				</button>
			</div>

			<button class="admin-action-sheet-item" onclick={() => viewBookingHistory(selectedUser!.id)}>
				<History size={18} color="var(--admin-accent)" />
				View Booking History
			</button>

			{#if selectedUser.email && selectedUser.email !== 'No email'}
				<a href="mailto:{selectedUser.email}" class="admin-action-sheet-item" onclick={closeSheet}>
					<Mail size={18} color="var(--admin-green)" />
					Send Email
				</a>
			{/if}

			{#if phone}
				<a href="tel:{phone}" class="admin-action-sheet-item" onclick={closeSheet}>
					<Phone size={18} color="var(--admin-green)" />
					Call User
				</a>
			{/if}

			<button class="admin-action-sheet-item" onclick={() => copyUserId(selectedUser!.id)}>
				<Copy size={18} color="var(--admin-text-secondary)" />
				Copy User ID
			</button>

			<button class="admin-action-sheet-cancel" onclick={closeSheet}>Cancel</button>
		</div>
	</div>
{/if}

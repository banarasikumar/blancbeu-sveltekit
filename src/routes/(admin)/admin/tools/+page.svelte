<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		allUsers,
		getUserDisplayName,
		getUserPhoto,
		getUserPhone,
		type AppUser,
		allBookings
	} from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import {
		Search,
		UsersRound,
		MoreVertical,
		History,
		Mail,
		Phone,
		Copy,
		X,
		ArrowUp,
		Download,
		FileJson,
		CheckCircle2
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { headerActions, isBottomNavVisible } from '$lib/stores/adminUI';

	let searchQuery = $state('');
	let selectedUser = $state<AppUser | null>(null);
	let sortBy = $state<'name' | 'joined'>('joined');

	// --- JSON Generator State ---
	let showAll = $state(true);
	let showWalkins = $state(false);
	let showMerged = $state(false);
	let showPhoneOnly = $state(false);
	
	let isMarkingMode = $state(false);
	let markedUsers = $state<Record<string, boolean>>({});

	let markedCount = $derived(Object.values(markedUsers).filter(Boolean).length);

	// Auto-enable All if both types are selected
	$effect(() => {
		if (showWalkins && showMerged && !showPhoneOnly) {
			showAll = true;
			showWalkins = false;
			showMerged = false;
		}
	});

	// --- Scroll to Top ---
	let showScrollTop = $state(false);

	function handleScroll() {
		const scrollTop = document.documentElement.scrollTop || document.body.scrollTop || 0;
		showScrollTop = scrollTop > 200;
	}

	function scrollToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll, { passive: true });
		
		// Hide bottom nav for tools page
		isBottomNavVisible.set(false);

		// Register Header Action: Close button to go back to users
		headerActions.set([{
			label: 'Exit Tools',
			icon: X,
			direct: true,
			handler: () => {
				goto('/admin/users');
			}
		}]);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			isBottomNavVisible.set(true);
			headerActions.set([]);
		};
	});

	function downloadJson() {
		let usersToExport: AppUser[] = [];
		
		if (isMarkingMode) {
			// Export only manually marked users
			usersToExport = $allUsers.filter(u => markedUsers[u.id]);
			if (usersToExport.length === 0) {
				showToast('No users marked for export', 'error');
				return;
			}
		} else {
			// Export current filtered list
			usersToExport = filteredUsers;
		}

		const exportData = usersToExport.map(u => {
			const nameParts = (u.displayName || u.fullName || u.name || '').split(' ');
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || '';
			const userBookings = $allBookings.filter(b => b.uid === u.id || b.userId === u.id).length;
			const phone = getUserPhone(u) || '';

			return {
				username: u.id,
				firstName,
				lastName,
				email: u.email || '',
				phone,
				itemsPerUserId: userBookings
			};
		});

		const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `users_export_${new Date().toISOString().slice(0, 10)}.json`;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
		
		showToast(`Exported ${exportData.length} users`, 'success');
	}


	// Filtered & Sorted users
	let filteredUsers = $derived.by(() => {
		let users = $allUsers;
		
		// 1. Phone Filter
		if (showPhoneOnly) {
			users = users.filter(u => !!getUserPhone(u));
		}

		// 2. Type Filters
		if (!showAll) {
			users = users.filter(u => {
				const isShadow = u.accountStatus === 'shadow';
				if (showWalkins && isShadow) return true;
				if (showMerged && !isShadow) return true;
				return false;
			});
		}

		// 3. Search filter
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
			if (sortBy === 'name') return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
			const tA = (a as any).createdAt?.seconds || 0;
			const tB = (b as any).createdAt?.seconds || 0;
			return tB - tA;
		});
	});

	// Avatar colors
	const colors = ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#AC8E68', '#5E5CE6', '#32ADE6', '#E04F5C'];
	function getColor(name: string): string { return colors[(name || '?').charCodeAt(0) % colors.length]; }

	// Action sheet
	function openUserOptions(user: AppUser) {
		if (isMarkingMode) {
			toggleMarkUser(user.id);
			return;
		}
		selectedUser = user;
	}

	function toggleMarkUser(uid: string) {
		markedUsers[uid] = !markedUsers[uid];
	}
	function closeSheet() { selectedUser = null; }
	function viewBookingHistory(uid: string) { closeSheet(); goto('/admin/bookings'); }
	async function copyUserId(uid: string) {
		try { await navigator.clipboard.writeText(uid); showToast('User ID Copied!', 'success'); } 
		catch { showToast('Failed to copy', 'error'); }
		closeSheet();
	}
</script>

	<div class="tools-page">
	<!-- Users List View with Generator Filters -->
	<div style="margin-top: 12px;">
		<div style="margin-bottom: 20px;">
			<span class="gen-label">Select User Type to Export:</span>
			<div class="gen-type-chips">
				<button 
					class="gen-chip" 
					class:active={showAll}
					onclick={() => {
						showAll = true;
						showWalkins = false;
						showMerged = false;
					}}
				>
					All
				</button>

				<button 
					class="gen-chip" 
					class:active={showWalkins}
					onclick={() => {
						showWalkins = !showWalkins;
						showAll = false;
						if (!showWalkins && !showMerged) showAll = true;
					}}
				>
					Walk-ins
				</button>

				<button 
					class="gen-chip" 
					class:active={showMerged}
					onclick={() => {
						showMerged = !showMerged;
						showAll = false;
						if (!showWalkins && !showMerged) showAll = true;
					}}
				>
					Merged
				</button>

				<button 
					class="gen-chip" 
					class:active={showPhoneOnly}
					onclick={() => showPhoneOnly = !showPhoneOnly}
				>
					Phone
				</button>
				
				<div style="width: 1px; height: 24px; background: var(--admin-border); margin: 0 4px; flex-shrink: 0;"></div>

				<button 
					class="gen-chip marked-mode-btn" 
					class:active={isMarkingMode}
					onclick={() => isMarkingMode = !isMarkingMode}
				>
					{#if isMarkingMode}
						<CheckCircle2 size={12} style="margin-right: 4px;" />
					{/if}
					Marked ({markedCount})
				</button>
			</div>
			<div style="font-size: 11px; color: var(--admin-text-secondary); margin-top: 8px; font-weight: 500;">
				{#if isMarkingMode}
					Marking Mode Active: Click cards to select users for export.
				{:else}
					Found {filteredUsers.length} users matching filters.
				{/if}
			</div>
		</div>

		<div class="admin-search-bar" style="display: flex; gap: 8px;">
			<div style="position: relative; flex: 1;">
				<Search size={16} class="admin-search-icon" />
				<input type="text" placeholder="Search users..." bind:value={searchQuery} style="width: 100%;" />
			</div>
			<select class="admin-sort-select" bind:value={sortBy}>
				<option value="name">Name</option>
				<option value="joined">Joined</option>
			</select>
		</div>

		<div class="users-list">
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
					{@const isMarked = markedUsers[user.id]}

					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div 
						class="admin-user-card" 
						class:is-marked={isMarked && isMarkingMode}
						onclick={() => isMarkingMode && toggleMarkUser(user.id)}
					>
						{#if isMarkingMode}
							<div class="mark-checkbox" class:checked={isMarked}>
								{#if isMarked}
									<CheckCircle2 size={14} />
								{/if}
							</div>
						{/if}

						{#if photo}
							<img src={photo} alt={name} class="admin-avatar-img" />
						{:else}
							<div class="admin-avatar-fallback" style="background: {getColor(name)};">{name.charAt(0).toUpperCase()}</div>
						{/if}
						<div class="admin-user-info">
							<div class="admin-user-name">
								{name}
								{#if user.accountType === 'walkin'}
									<span class="admin-role-badge walkin">WALK-IN</span>
								{:else}
									<span class="admin-role-badge" class:admin={user.role === 'admin'}>{user.role === 'admin' ? 'ADMIN' : 'USER'}</span>
								{/if}
							</div>
							<div class="admin-user-email">{user.email || 'No email'}</div>
							{#if phone}<div class="admin-user-phone"><Phone size={10} /> {phone}</div>{/if}
						</div>
						<button 
							class="admin-options-btn" 
							onclick={(e) => {
								e.stopPropagation();
								openUserOptions(user);
							}} 
							aria-label="Options"
						>
							<MoreVertical size={18} />
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Sticky Generate Button -->
	<div class="gen-footer-sticky" transition:fade>
		<button class="gen-download-btn-sticky" onclick={downloadJson}>
			<Download size={20} />
			{#if isMarkingMode}
				Export {markedCount} Marked Users
			{:else}
				Export {filteredUsers.length} Users
			{/if}
		</button>
	</div>
</div>

{#if selectedUser}
	{@const name = getUserDisplayName(selectedUser)}
	{@const phone = getUserPhone(selectedUser)}
	<div class="admin-action-sheet-overlay" onclick={closeSheet} role="dialog" tabindex="-1">
		<div class="admin-action-sheet" onclick={(e) => e.stopPropagation()} role="document">
			<div class="admin-action-sheet-header">
				<div>
					<h3>{name}</h3>
					<span style="font-size: 12px; color: var(--admin-text-secondary);">{selectedUser.id}</span>
				</div>
				<button class="admin-header-btn" onclick={closeSheet} aria-label="Close"><X size={20} /></button>
			</div>
			<button class="admin-action-sheet-item" onclick={() => viewBookingHistory(selectedUser!.id)}><History size={18} color="var(--admin-accent)" /> View History</button>
			{#if phone}<a href="tel:{phone}" class="admin-action-sheet-item" onclick={closeSheet}><Phone size={18} color="var(--admin-green)" /> Call User</a>{/if}
			<button class="admin-action-sheet-item" onclick={() => copyUserId(selectedUser!.id)}><Copy size={18} color="var(--admin-text-secondary)" /> Copy ID</button>
			<button class="admin-action-sheet-cancel" onclick={closeSheet}>Cancel</button>
		</div>
	</div>
{/if}

{#if showScrollTop}
	<button class="scroll-to-top-btn" onclick={scrollToTop} aria-label="Scroll to top"><ArrowUp size={20} strokeWidth={2.5} /></button>
{/if}

<style>
	.tools-page {
		padding-bottom: 120px;
	}

	.gen-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--admin-text-tertiary);
		margin-bottom: 8px;
		display: block;
	}

	.gen-type-chips {
		display: flex;
		gap: 8px;
		flex-wrap: nowrap;
		align-items: center;
		overflow-x: auto;
		padding-bottom: 8px;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.gen-type-chips::-webkit-scrollbar {
		display: none;
	}

	.gen-chip {
		padding: 8px 14px;
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-md);
		color: var(--admin-text-secondary);
		font-family: var(--admin-font);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.gen-chip.active {
		background: var(--admin-accent);
		color: #000;
		border-color: var(--admin-accent);
		box-shadow: 0 4px 12px rgba(var(--admin-accent-rgb, 212, 175, 55), 0.2);
	}

	.filter-toggle {
		font-size: 11px;
		padding: 5px 12px;
		border-radius: 20px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		color: var(--admin-text-secondary);
		cursor: pointer;
		font-weight: 600;
		transition: all 0.2s;
	}

	.filter-toggle.active {
		border-color: var(--admin-accent);
		background: rgba(var(--admin-accent-rgb, 212, 175, 55), 0.1);
		color: var(--admin-accent);
	}

	.gen-download-btn-sticky {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 18px;
		background: var(--admin-accent);
		color: #000;
		border: none;
		border-radius: var(--admin-radius-lg);
		font-size: 16px;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 8px 24px rgba(var(--admin-accent-rgb, 212, 175, 55), 0.3);
	}

	.gen-download-btn-sticky:active { transform: scale(0.96); }

	.gen-footer-sticky {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 20px;
		background: linear-gradient(to top, var(--admin-bg), transparent);
		z-index: 1000;
		display: flex;
		justify-content: center;
		padding-bottom: calc(20px + var(--admin-safe-bottom));
	}

	.admin-role-badge.walkin {
		background: rgba(234,179,8,0.15);
		color: #ca8a04;
		border-color: rgba(234,179,8,0.3);
	}

	.marked-mode-btn {
		border-radius: 8px !important;
		padding: 8px 16px !important;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		color: var(--admin-text-secondary);
		font-weight: 700;
	}

	.marked-mode-btn.active {
		background: #ff3b30;
		color: #fff;
		border-color: #ff3b30;
		box-shadow: 0 4px 12px rgba(255, 59, 48, 0.3);
	}

	.admin-user-card.is-marked {
		border-color: #ff3b30;
		background: rgba(255, 59, 48, 0.05);
	}

	.mark-checkbox {
		width: 22px;
		height: 22px;
		border: 2px solid var(--admin-border);
		border-radius: 6px;
		margin-right: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: all 0.2s;
	}

	.mark-checkbox.checked {
		background: #ff3b30;
		border-color: #ff3b30;
		color: #fff;
	}
</style>

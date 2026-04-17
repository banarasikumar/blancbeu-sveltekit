<script lang="ts">
	import { auth, db } from '$lib/firebase';
	import {
		allUsers,
		getUserDisplayName,
		getUserPhoto,
		getUserPhone,
		type AppUser
	} from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import {
		AlertTriangle,
		ArrowUp,
		Clock,
		Copy,
		Crown,
		Info,
		Mail,
		Pencil,
		Phone,
		Save,
		Search,
		Shield,
		ShieldCheck,
		ShieldX,
		Trash2,
		User,
		UserPlus
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { addDoc, collection, deleteField, doc, setDoc } from 'firebase/firestore';

	type ManagedRole = 'admin' | 'staff';
	type ViewTab = 'directory' | 'add';
	type RoleFilter = 'all' | 'admin' | 'staff';
	type AddMethod = 'existing' | 'new';
	type NextRole = ManagedRole | 'user';

	type ConfirmAction = {
		user: AppUser;
		nextRole: NextRole;
		title: string;
		message: string;
		submitLabel: string;
		danger?: boolean;
	};

	let searchQuery = $state('');
	let activeTab = $state<ViewTab>('directory');
	let roleFilter = $state<RoleFilter>('all');
	let addMethod = $state<AddMethod>('existing');
	let showConfirmModal = $state(false);
	let showRoleInfoModal = $state(false);
	let confirmAction = $state<ConfirmAction | null>(null);
	let isProcessing = $state(false);

	let selectedExistingUser = $state<AppUser | null>(null);
	let existingUserSearch = $state('');
	let existingRole = $state<ManagedRole>('staff');

	let newMemberName = $state('');
	let newMemberEmail = $state('');
	let newMemberPhone = $state('');
	let newMemberSpecialty = $state('');
	let newMemberRole = $state<ManagedRole>('staff');

	let editingMember = $state<AppUser | null>(null);
	let editSpecialty = $state('');
	let editCommission = $state('');
	let showScrollTop = $state(false);

	const managedUsers = $derived(
		$allUsers.filter(
			(user) =>
				(user.role === 'admin' || user.role === 'staff') && user.accountStatus !== 'merged'
		)
	);
	const adminCount = $derived(managedUsers.filter((user) => user.role === 'admin').length);
	const eligibleUsers = $derived(
		$allUsers.filter(
			(user) =>
				user.role !== 'admin' &&
				user.role !== 'staff' &&
				user.accountType !== 'walkin' &&
				user.accountStatus !== 'merged'
		)
	);
	const filteredManagedUsers = $derived.by(() => {
		const query = normalize(searchQuery);
		return managedUsers.filter((user) => {
			if (roleFilter === 'admin' && user.role !== 'admin') return false;
			if (roleFilter === 'staff' && user.role !== 'staff') return false;
			return !query || matchesUser(user, query);
		});
	});
	const filteredAdmins = $derived(filteredManagedUsers.filter((user) => user.role === 'admin'));
	const filteredStaff = $derived(filteredManagedUsers.filter((user) => user.role === 'staff'));
	const filteredEligibleUsers = $derived.by(() => {
		const query = normalize(existingUserSearch);
		if (query.length < 2) return [];
		return eligibleUsers.filter((user) => matchesUser(user, query)).slice(0, 10);
	});

	const avatarColors = [
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

	onMount(() => {
		const onScroll = () => {
			const top = document.documentElement.scrollTop || document.body.scrollTop || 0;
			showScrollTop = top > 220;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function normalize(value: string | null | undefined) {
		return (value ?? '').trim().toLowerCase();
	}

	function matchesUser(user: AppUser, query: string) {
		return (
			normalize(getUserDisplayName(user)).includes(query) ||
			normalize(user.email).includes(query) ||
			normalize(getUserPhone(user)).includes(query) ||
			normalize(user.specialty).includes(query)
		);
	}

	function getAvatarColor(name: string) {
		return avatarColors[(name || '?').charCodeAt(0) % avatarColors.length];
	}

	function isCurrentUser(user: AppUser) {
		return auth.currentUser?.uid === user.id;
	}

	function isProtectedAdmin(user: AppUser) {
		return user.role === 'admin' && adminCount === 1;
	}

	function formatRole(role: NextRole) {
		if (role === 'admin') return 'Admin';
		if (role === 'staff') return 'Staff';
		return 'User';
	}

	function roleSummary(role: ManagedRole) {
		return role === 'admin' ? 'Admin app + Staff app' : 'Staff app only';
	}

	function joinedDate(user: AppUser) {
		if (!user.createdAt) return 'Unknown';
		const date = user.createdAt.seconds
			? new Date(user.createdAt.seconds * 1000)
			: new Date(user.createdAt);
		if (isNaN(date.getTime())) return 'Unknown';
		return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function commissionLabel(user: AppUser) {
		if (user.commissionRate === undefined || user.commissionRate === null || user.commissionRate === '') {
			return null;
		}
		return `${user.commissionRate}% commission`;
	}

	function changeGuard(user: AppUser, nextRole: NextRole) {
		if (user.role === nextRole) return `${getUserDisplayName(user)} already has ${formatRole(nextRole)} access.`;
		if (isCurrentUser(user) && nextRole !== 'admin') return 'You cannot change your own role from this page.';
		if (user.role === 'admin' && nextRole !== 'admin' && adminCount <= 1) {
			return 'At least one admin must remain assigned at all times.';
		}
		return null;
	}

	function memberNote(user: AppUser) {
		if (isCurrentUser(user)) return 'Your role can only be changed by another admin.';
		if (isProtectedAdmin(user)) return `${getUserDisplayName(user)} is the last admin and is protected.`;
		return null;
	}

	function startEditing(user: AppUser) {
		if (editingMember?.id === user.id) {
			editingMember = null;
			editSpecialty = '';
			editCommission = '';
			return;
		}
		editingMember = user;
		editSpecialty = user.specialty || '';
		editCommission =
			user.commissionRate === undefined || user.commissionRate === null
				? ''
				: String(user.commissionRate);
	}

	function openConfirm(user: AppUser, nextRole: NextRole) {
		const guard = changeGuard(user, nextRole);
		if (guard) {
			showToast(guard, 'error');
			return;
		}
		const name = getUserDisplayName(user);
		if (nextRole === 'user') {
			confirmAction = {
				user,
				nextRole,
				title: 'Remove managed access?',
				message: `"${name}" will lose all admin and staff access and return to a normal user account.`,
				submitLabel: 'Remove access',
				danger: true
			};
		} else if (user.role === 'admin' && nextRole === 'staff') {
			confirmAction = {
				user,
				nextRole,
				title: 'Move admin to staff?',
				message: `"${name}" will keep staff access but lose admin controls.`,
				submitLabel: 'Move to staff'
			};
		} else if (nextRole === 'admin') {
			confirmAction = {
				user,
				nextRole,
				title: user.role === 'staff' ? 'Promote to admin?' : 'Grant admin access?',
				message: `"${name}" will be able to open both the admin and staff apps.`,
				submitLabel: user.role === 'staff' ? 'Promote to admin' : 'Grant admin access'
			};
		} else {
			confirmAction = {
				user,
				nextRole,
				title: 'Grant staff access?',
				message: `"${name}" will be able to use the staff app without admin controls.`,
				submitLabel: 'Grant staff access'
			};
		}
		showConfirmModal = true;
	}

	function closeConfirm() {
		showConfirmModal = false;
		confirmAction = null;
	}

	async function applyRoleChange(user: AppUser, nextRole: NextRole) {
		const guard = changeGuard(user, nextRole);
		if (guard) {
			showToast(guard, 'error');
			closeConfirm();
			return;
		}
		isProcessing = true;
		try {
			await setDoc(
				doc(db, 'users', user.id),
				{ role: nextRole === 'user' ? 'user' : nextRole, updatedAt: new Date().toISOString() },
				{ merge: true }
			);
			const name = getUserDisplayName(user);
			if (nextRole === 'user') showToast(`${name} removed from managed roles`, 'success');
			else if (nextRole === 'admin') showToast(`${name} now has Admin access`, 'success');
			else showToast(`${name} now has Staff access`, 'success');
			if (selectedExistingUser?.id === user.id) selectedExistingUser = null;
			existingUserSearch = '';
			activeTab = 'directory';
			if (editingMember?.id === user.id && nextRole === 'user') editingMember = null;
		} catch (error: any) {
			console.error('[RoleMgmt] Failed to update role:', error);
			showToast('Failed to update role', 'error');
		} finally {
			isProcessing = false;
			closeConfirm();
		}
	}

	async function saveMemberDetails(user: AppUser) {
		isProcessing = true;
		try {
			const specialty = editSpecialty.trim();
			const rate = editCommission.trim();
			const parsed = Number.parseFloat(rate);
			await setDoc(
				doc(db, 'users', user.id),
				{
					specialty: specialty ? specialty : deleteField(),
					commissionRate: rate && Number.isFinite(parsed) ? parsed : deleteField(),
					updatedAt: new Date().toISOString()
				},
				{ merge: true }
			);
			showToast('Member details updated', 'success');
			editingMember = null;
			editSpecialty = '';
			editCommission = '';
		} catch (error: any) {
			console.error('[RoleMgmt] Failed to save details:', error);
			showToast('Failed to save member details', 'error');
		} finally {
			isProcessing = false;
		}
	}

	async function createMember() {
		if (!newMemberName.trim()) {
			showToast('Name is required', 'error');
			return;
		}
		if (!newMemberEmail.trim() && !newMemberPhone.trim()) {
			showToast('Email or phone is required', 'error');
			return;
		}
		isProcessing = true;
		try {
			const member: Record<string, unknown> = {
				displayName: newMemberName.trim(),
				name: newMemberName.trim(),
				role: newMemberRole,
				createdAt: new Date().toISOString(),
				createdBy: auth.currentUser?.uid || 'admin',
				accountType: 'user'
			};
			if (newMemberEmail.trim()) member.email = newMemberEmail.trim();
			if (newMemberPhone.trim()) member.phone = newMemberPhone.trim();
			if (newMemberSpecialty.trim()) member.specialty = newMemberSpecialty.trim();
			await addDoc(collection(db, 'users'), member);
			showToast(`${newMemberName.trim()} created as ${formatRole(newMemberRole)}`, 'success');
			newMemberName = '';
			newMemberEmail = '';
			newMemberPhone = '';
			newMemberSpecialty = '';
			newMemberRole = 'staff';
			activeTab = 'directory';
		} catch (error: any) {
			console.error('[RoleMgmt] Failed to create member:', error);
			showToast('Failed to create member', 'error');
		} finally {
			isProcessing = false;
		}
	}

	async function copyUserId(uid: string) {
		try {
			await navigator.clipboard.writeText(uid);
			showToast('User ID copied', 'success');
		} catch {
			showToast('Failed to copy ID', 'error');
		}
	}
</script>

<div class="role-header-row">
	<div class="admin-segmented role-tabs">
		<button class="admin-segment-btn" class:active={activeTab === 'directory'} onclick={() => (activeTab = 'directory')}>
			<Shield size={15} />
			Team Roles
		</button>
	</div>
	<button class="role-info-btn" onclick={() => (showRoleInfoModal = true)}>
		<Info size={16} />
		Role Info
	</button>
</div>

{#if activeTab === 'directory'}
	<div class="role-toolbar">
		<div class="admin-search-bar" style="margin-bottom: 0;">
			<div style="position: relative;">
				<Search size={16} class="admin-search-icon" />
				<input
					type="text"
					placeholder="Search admins and staff by name, contact or specialty"
					bind:value={searchQuery}
				/>
			</div>
		</div>
		<div class="role-filter-row">
			<button class="admin-filter-chip" class:active={roleFilter === 'all'} onclick={() => (roleFilter = 'all')}>All</button>
			<button class="admin-filter-chip" class:active={roleFilter === 'admin'} onclick={() => (roleFilter = 'admin')}>Admins</button>
			<button class="admin-filter-chip" class:active={roleFilter === 'staff'} onclick={() => (roleFilter = 'staff')}>Staff</button>
			<button class="role-add-member-btn" onclick={() => (activeTab = 'add')}>
				<UserPlus size={14} />
				Add Member
			</button>
		</div>
	</div>

	{#if filteredManagedUsers.length === 0}
		<div class="admin-empty-state">
			<Shield size={42} color="var(--admin-text-tertiary)" />
			<p>{searchQuery ? 'No team members match this search.' : 'No managed roles yet.'}</p>
		</div>
	{:else}
		{#if roleFilter !== 'staff' && filteredAdmins.length > 0}
			<section class="role-section">
				<div class="role-section-head">
					<div>
						<h3>Admins</h3>
					</div>
					<span>{filteredAdmins.length}</span>
				</div>
				<div class="role-list">
					{#each filteredAdmins as user (user.id)}
						{@const name = getUserDisplayName(user)}
						{@const photo = getUserPhoto(user)}
						{@const phone = getUserPhone(user)}
						{@const note = memberNote(user)}
						<div class="role-card admin-card" class:protected-card={isProtectedAdmin(user)}>
							<div class="role-card-head">
								{#if photo}
									<img src={photo} alt={name} class="role-avatar" />
								{:else}
									<div class="role-avatar fallback" style="background: {getAvatarColor(name)};">{name.charAt(0).toUpperCase()}</div>
								{/if}
								<div class="role-card-main">
									<div class="role-card-title">
										<h4>{name}</h4>
										{#if isCurrentUser(user)}<span class="role-pill warn">YOU</span>{/if}
										{#if isProtectedAdmin(user)}<span class="role-pill warn">Protected</span>{/if}
									</div>
									<div class="role-pill-row">
										<span class="role-pill admin"><Crown size={12} /> Admin</span>
										{#if user.specialty}<span class="role-pill neutral">{user.specialty}</span>{/if}
										{#if commissionLabel(user)}<span class="role-pill neutral">{commissionLabel(user)}</span>{/if}
									</div>
									<div class="role-meta">
										<span><Clock size={12} /> Joined {joinedDate(user)}</span>
										<span><Shield size={12} /> {roleSummary('admin')}</span>
										{#if user.email}<span><Mail size={12} /> {user.email}</span>{/if}
										{#if phone}<span><Phone size={12} /> {phone}</span>{/if}
									</div>
								</div>
							</div>
							<div class="role-actions">
								<button class="role-btn role-btn-secondary role-btn-wide" onclick={() => startEditing(user)}>
									<Pencil size={14} />
									{editingMember?.id === user.id ? 'Close Details' : 'Details & Edit'}
								</button>
								<button class="role-btn role-btn-secondary" onclick={() => openConfirm(user, 'staff')} disabled={Boolean(changeGuard(user, 'staff'))}>
									<ShieldX size={14} />
									Make Staff
								</button>
								<button class="role-btn role-btn-danger" onclick={() => openConfirm(user, 'user')} disabled={Boolean(changeGuard(user, 'user'))}>
									<Trash2 size={14} />
									Remove Role
								</button>
							</div>
							{#if note}<p class="role-note">{note}</p>{/if}
							{#if editingMember?.id === user.id}
								<div class="role-editor">
									<div class="role-editor-grid">
										<label>
											<span>Specialty</span>
											<input type="text" bind:value={editSpecialty} placeholder="Hair stylist, operations lead, makeup artist" />
										</label>
										<label>
											<span>Commission Rate (%)</span>
											<input type="number" bind:value={editCommission} placeholder="30" min="0" max="100" />
										</label>
									</div>
									<div class="role-editor-tools">
										{#if user.email}<a class="role-link" href="mailto:{user.email}"><Mail size={13} /> Email</a>{/if}
										{#if phone}<a class="role-link" href="tel:{phone}"><Phone size={13} /> Call</a>{/if}
										<button class="role-link" onclick={() => copyUserId(user.id)}><Copy size={13} /> Copy ID</button>
									</div>
									<button class="role-btn role-btn-primary role-save" onclick={() => saveMemberDetails(user)} disabled={isProcessing}>
										{#if isProcessing}Saving...{:else}<Save size={14} /> Save Details{/if}
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}

		{#if roleFilter !== 'admin' && filteredStaff.length > 0}
			<section class="role-section">
				<div class="role-section-head">
					<div>
						<h3>Staff</h3>
					</div>
					<span>{filteredStaff.length}</span>
				</div>
				<div class="role-list">
					{#each filteredStaff as user (user.id)}
						{@const name = getUserDisplayName(user)}
						{@const photo = getUserPhoto(user)}
						{@const phone = getUserPhone(user)}
						{@const note = memberNote(user)}
						<div class="role-card staff-card">
							<div class="role-card-head">
								{#if photo}
									<img src={photo} alt={name} class="role-avatar" />
								{:else}
									<div class="role-avatar fallback" style="background: {getAvatarColor(name)};">{name.charAt(0).toUpperCase()}</div>
								{/if}
								<div class="role-card-main">
									<div class="role-card-title">
										<h4>{name}</h4>
										{#if isCurrentUser(user)}<span class="role-pill warn">YOU</span>{/if}
									</div>
									<div class="role-pill-row">
										<span class="role-pill staff"><ShieldCheck size={12} /> Staff</span>
										{#if user.specialty}<span class="role-pill neutral">{user.specialty}</span>{/if}
										{#if commissionLabel(user)}<span class="role-pill neutral">{commissionLabel(user)}</span>{/if}
									</div>
									<div class="role-meta">
										<span><Clock size={12} /> Joined {joinedDate(user)}</span>
										<span><ShieldCheck size={12} /> {roleSummary('staff')}</span>
										{#if user.email}<span><Mail size={12} /> {user.email}</span>{/if}
										{#if phone}<span><Phone size={12} /> {phone}</span>{/if}
									</div>
								</div>
							</div>
							<div class="role-actions">
								<button class="role-btn role-btn-secondary role-btn-wide" onclick={() => startEditing(user)}>
									<Pencil size={14} />
									{editingMember?.id === user.id ? 'Close Details' : 'Details & Edit'}
								</button>
								<button class="role-btn role-btn-primary" onclick={() => openConfirm(user, 'admin')} disabled={Boolean(changeGuard(user, 'admin'))}>
									<Crown size={14} />
									Make Admin
								</button>
								<button class="role-btn role-btn-danger" onclick={() => openConfirm(user, 'user')} disabled={Boolean(changeGuard(user, 'user'))}>
									<Trash2 size={14} />
									Remove Role
								</button>
							</div>
							{#if note}<p class="role-note">{note}</p>{/if}
							{#if editingMember?.id === user.id}
								<div class="role-editor">
									<div class="role-editor-grid">
										<label>
											<span>Specialty</span>
											<input type="text" bind:value={editSpecialty} placeholder="Hair stylist, nail artist, makeup artist" />
										</label>
										<label>
											<span>Commission Rate (%)</span>
											<input type="number" bind:value={editCommission} placeholder="30" min="0" max="100" />
										</label>
									</div>
									<div class="role-editor-tools">
										{#if user.email}<a class="role-link" href="mailto:{user.email}"><Mail size={13} /> Email</a>{/if}
										{#if phone}<a class="role-link" href="tel:{phone}"><Phone size={13} /> Call</a>{/if}
										<button class="role-link" onclick={() => copyUserId(user.id)}><Copy size={13} /> Copy ID</button>
									</div>
									<button class="role-btn role-btn-primary role-save" onclick={() => saveMemberDetails(user)} disabled={isProcessing}>
										{#if isProcessing}Saving...{:else}<Save size={14} /> Save Details{/if}
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
{:else}
	<div class="role-add-layout">
		<section class="role-section">
			<div class="role-section-head slim">
				<div>
					<h3>{addMethod === 'existing' ? 'Assign Existing User' : 'Create New Member'}</h3>
					<p>{addMethod === 'existing' ? 'Pick an existing user and grant access.' : 'Create a placeholder admin or staff profile.'}</p>
				</div>
			</div>
			<div class="admin-segmented role-methods">
				<button class="admin-segment-btn" class:active={addMethod === 'existing'} onclick={() => (addMethod = 'existing')}>Existing</button>
				<button class="admin-segment-btn" class:active={addMethod === 'new'} onclick={() => (addMethod = 'new')}>New</button>
			</div>

			{#if addMethod === 'existing'}
				
				<div class="staff-form-group">
					<label for="eligible-user-search">Search eligible users</label>
					<div style="position: relative;">
						<Search size={16} class="admin-search-icon" />
						<input id="eligible-user-search" type="text" bind:value={existingUserSearch} placeholder="Type name, email or phone" style="width: 100%; padding-left: 36px;" />
					</div>
				</div>
				{#if selectedExistingUser}
					<div class="role-selected-user">
						<div>
							<strong>{getUserDisplayName(selectedExistingUser)}</strong>
							<small>{selectedExistingUser.email || getUserPhone(selectedExistingUser) || 'No contact info'}</small>
						</div>
						<button class="role-link" onclick={() => (selectedExistingUser = null)}>Clear</button>
					</div>
					<button class="role-btn role-btn-primary role-save" onclick={() => openConfirm(selectedExistingUser!, existingRole)} disabled={isProcessing}>
						{#if isProcessing}Processing...{:else}{existingRole === 'admin' ? 'Grant Admin Access' : 'Grant Staff Access'}{/if}
					</button>
				{:else if filteredEligibleUsers.length > 0}
					<div class="role-results">
						{#each filteredEligibleUsers as user (user.id)}
							<button class="role-result" onclick={() => (selectedExistingUser = user)}>
								<div>
									<strong>{getUserDisplayName(user)}</strong>
									<small>{user.email || getUserPhone(user) || 'No contact info'}</small>
								</div>
								<User size={14} color="var(--admin-text-tertiary)" />
							</button>
						{/each}
					</div>
				{:else if existingUserSearch.trim().length >= 2}
					<div class="role-empty-inline">No eligible users match "{existingUserSearch}".</div>
				{:else}
					<div class="role-empty-inline">Type at least 2 characters to search eligible users.</div>
				{/if}
			{:else}
				
				<div class="staff-form-group"><label for="new-member-name">Full Name</label><input id="new-member-name" type="text" bind:value={newMemberName} placeholder="Enter full name" /></div>
				<div class="staff-form-group"><label for="new-member-email">Email</label><input id="new-member-email" type="email" bind:value={newMemberEmail} placeholder="member@example.com" /></div>
				<div class="staff-form-group"><label for="new-member-phone">Phone</label><input id="new-member-phone" type="tel" bind:value={newMemberPhone} placeholder="+91 XXXXX XXXXX" /></div>
				<div class="staff-form-group"><label for="new-member-specialty">Specialty</label><input id="new-member-specialty" type="text" bind:value={newMemberSpecialty} placeholder="Optional role note or specialty" /></div>
				<p class="role-helper">Email or phone is required. This creates a placeholder profile that can be linked later.</p>
				<button class="role-btn role-btn-primary role-save" onclick={createMember} disabled={isProcessing}>
					{#if isProcessing}Creating...{:else}{newMemberRole === 'admin' ? 'Create Admin Profile' : 'Create Staff Profile'}{/if}
				</button>
			{/if}
		</section>

	</div>
{/if}

{#if showRoleInfoModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="role-info-overlay" onclick={() => (showRoleInfoModal = false)} role="dialog" tabindex="-1">
		<div class="role-info-modal" onclick={(event) => event.stopPropagation()} role="document">
			<div class="role-info-head">
				<div class="role-info-title">
					<div class="role-info-icon"><Info size={18} /></div>
					<div>
						<h3>Role Info</h3>
						<p>Quick access guide.</p>
					</div>
				</div>
				<button class="role-info-close" onclick={() => (showRoleInfoModal = false)} aria-label="Close role info">
					✕
				</button>
			</div>

			<div class="role-info-grid">
				<div class="role-info-card">
					<h4><Crown size={15} /> Admin Role</h4>
					<ul>
						<li>Full access.</li>
						<li>Admin + Staff apps.</li>
						<li>Use for core leads.</li>
					</ul>
				</div>
				<div class="role-info-card">
					<h4><ShieldCheck size={15} /> Staff Role</h4>
					<ul>
						<li>Staff app only.</li>
						<li>Handles daily operations.</li>
						<li>No admin controls.</li>
					</ul>
				</div>
			</div>

			<div class="role-info-block">
				<h4><Shield size={15} /> How to Assign</h4>
				<ol>
					<li>Pick or create a member.</li>
					<li>Set `Staff` for normal work.</li>
					<li>Set `Admin` for full control.</li>
				</ol>
			</div>

			<div class="role-info-footer">
				<button class="role-btn role-btn-secondary" onclick={() => (showRoleInfoModal = false)}>Got it</button>
			</div>
		</div>
	</div>
{/if}

{#if showConfirmModal && confirmAction}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="role-confirm-overlay" onclick={closeConfirm} role="dialog" tabindex="-1">
		<div class="role-confirm-modal" onclick={(event) => event.stopPropagation()} role="document">
			<div class="role-confirm-icon" class:danger={confirmAction.danger}>
				{#if confirmAction.danger}<AlertTriangle size={30} />{:else}<ShieldCheck size={30} />{/if}
			</div>
			<h3>{confirmAction.title}</h3>
			<p>{confirmAction.message}</p>
			<div class="role-confirm-actions">
				<button class="role-btn role-btn-secondary" onclick={closeConfirm}>Cancel</button>
				<button class="role-btn role-btn-primary" class:role-btn-danger={confirmAction.danger} onclick={() => applyRoleChange(confirmAction!.user, confirmAction!.nextRole)} disabled={isProcessing}>
					{isProcessing ? 'Processing...' : confirmAction.submitLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showScrollTop}
	<button class="scroll-to-top-btn" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">
		<ArrowUp size={20} strokeWidth={2.5} />
	</button>
{/if}

<style>
	.role-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.role-hero {
		display: grid;
		gap: 18px;
		margin-bottom: 18px;
		contain: paint;
		isolation: isolate;
	}

	.role-hero::after {
		display: none;
	}

	.role-hero-copy p {
		max-width: 48ch;
	}

	.role-hero-aside {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.role-hero-count,
	.role-inline-note {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px;
		border-radius: var(--admin-radius-md);
		border: 1px solid var(--admin-border);
		background: rgba(28, 28, 30, 0.6);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.role-hero-count strong {
		display: block;
		font-size: 24px;
		line-height: 1;
	}

	.role-hero-count span,
	.role-hero-note,
	.role-safety-banner p,
	.role-inline-note span,
	.role-helper {
		font-size: 12px;
		line-height: 1.5;
		color: var(--admin-text-secondary);
	}

	.role-hero-count > :global(svg),
	.role-inline-note > :global(svg) {
		flex-shrink: 0;
		color: var(--admin-accent);
		margin-top: 1px;
	}

	.role-inline-note.warning {
		background: var(--admin-orange-light);
		border-color: rgba(255, 159, 10, 0.24);
	}

	.role-info-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 42px;
		padding: 0 16px;
		border-radius: var(--admin-radius-md);
		border: 1px solid rgba(94, 92, 230, 0.3);
		background: rgba(94, 92, 230, 0.15);
		color: var(--admin-indigo);
		font-size: 13px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 12px rgba(94, 92, 230, 0.1);
	}

	.role-info-btn:hover {
		background: rgba(94, 92, 230, 0.25);
		transform: translateY(-1px);
		box-shadow: 0 6px 16px rgba(94, 92, 230, 0.2);
	}

	.role-overview {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin-bottom: 18px;
	}

	.role-stat-card {
		padding: 16px;
		border-radius: var(--admin-radius-lg);
		border: 1px solid var(--admin-border);
		background: rgba(28, 28, 30, 0.5);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		box-shadow: var(--admin-shadow-sm);
	}

	.role-stat-card strong {
		display: block;
		font-size: 24px;
		line-height: 1;
		margin-bottom: 8px;
	}

	.role-stat-card span {
		display: block;
		font-size: 13px;
		font-weight: 700;
		color: var(--admin-text-primary);
	}

	.role-stat-card small {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		line-height: 1.45;
		color: var(--admin-text-secondary);
	}

	.role-stat-icon {
		width: 38px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		margin-bottom: 12px;
	}

	.role-stat-icon.accent {
		background: var(--admin-accent-light);
		color: var(--admin-accent);
	}

	.role-stat-icon.green {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.role-stat-icon.purple {
		background: var(--admin-purple-light);
		color: var(--admin-purple);
	}

	.role-stat-icon.blue {
		background: rgba(94, 92, 230, 0.15);
		color: var(--admin-indigo);
	}

	.role-tabs {
		margin-bottom: 0;
	}

	.role-topbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 12px;
	}

	.role-tabs .admin-segment-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.role-toolbar,
	.role-add-layout {
		display: grid;
		gap: 16px;
	}

	.role-filter-row {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.role-filter-row::-webkit-scrollbar {
		display: none;
	}

	.role-section {
		padding: 20px;
		border-radius: var(--admin-radius-xl);
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(20, 20, 22, 0.6);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.role-section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 20px;
	}

	.role-section-head h3 {
		font-size: 20px;
		font-weight: 800;
		color: var(--admin-text-primary);
		letter-spacing: -0.5px;
	}

	.role-section-head p {
		margin-top: 6px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--admin-text-secondary);
	}

	.role-section-head > span {
		min-width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 12px;
		border-radius: var(--admin-radius-full);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 14px;
		font-weight: 800;
		color: var(--admin-accent);
	}

	.role-list,
	.role-results {
		display: grid;
		gap: 16px;
	}

	.role-card {
		padding: 18px;
		border-radius: var(--admin-radius-lg);
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(32, 32, 34, 0.5);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
		position: relative;
		overflow: hidden;
	}

	.role-card:hover {
		transform: translateY(-4px);
		background: rgba(40, 40, 44, 0.7);
		box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
	}

	.role-card::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.role-card:hover::before {
		opacity: 1;
	}

	.role-card.admin-card {
		border-color: rgba(212, 175, 55, 0.3);
		box-shadow: inset 0 0 40px rgba(212, 175, 55, 0.03);
	}

	.role-card.admin-card:hover {
		border-color: rgba(212, 175, 55, 0.6);
		box-shadow: 0 16px 32px rgba(212, 175, 55, 0.15), inset 0 0 60px rgba(212, 175, 55, 0.05);
	}

	.role-card.staff-card {
		border-color: rgba(48, 209, 88, 0.25);
		box-shadow: inset 0 0 40px rgba(48, 209, 88, 0.02);
	}

	.role-card.staff-card:hover {
		border-color: rgba(48, 209, 88, 0.5);
		box-shadow: 0 16px 32px rgba(48, 209, 88, 0.1), inset 0 0 60px rgba(48, 209, 88, 0.05);
	}

	.role-card.protected-card {
		box-shadow: 0 0 0 1px rgba(255, 159, 10, 0.3), inset 0 0 40px rgba(255, 159, 10, 0.05);
	}

	.role-card-head,
	.role-card-title,
	.role-pill-row,
	.role-meta,
	.role-actions,
	.role-editor-tools,
	.role-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.role-card-head {
		align-items: flex-start;
		flex-wrap: nowrap;
		gap: 16px;
	}

	.role-card-main {
		flex: 1;
		min-width: 0;
	}

	.role-card-title h4 {
		font-size: 17px;
		font-weight: 800;
		color: var(--admin-text-primary);
		letter-spacing: -0.3px;
	}

	.role-avatar {
		width: 60px;
		height: 60px;
		border-radius: 18px;
		object-fit: cover;
		flex-shrink: 0;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		border: 2px solid rgba(255, 255, 255, 0.1);
	}

	.role-avatar.fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 20px;
		font-weight: 800;
	}

	.role-pill,
	.role-meta span,
	.role-link,
	.role-pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border-radius: var(--admin-radius-full);
		font-size: 12px;
		font-weight: 700;
		transition: all 0.2s ease;
	}

	.role-pill.admin {
		background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05));
		border: 1px solid rgba(212, 175, 55, 0.4);
		color: #e0bc48;
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.15);
	}

	.role-pill.staff {
		background: linear-gradient(135deg, rgba(48, 209, 88, 0.2), rgba(48, 209, 88, 0.05));
		border: 1px solid rgba(48, 209, 88, 0.4);
		color: #4cd964;
		box-shadow: 0 4px 12px rgba(48, 209, 88, 0.15);
	}

	.role-pill.warn {
		background: linear-gradient(135deg, rgba(255, 159, 10, 0.2), rgba(255, 159, 10, 0.05));
		border: 1px solid rgba(255, 159, 10, 0.4);
		color: #ff9f0a;
	}

	.role-pill.neutral,
	.role-meta span,
	.role-link,
	.role-pick,
	.role-selected-user {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: var(--admin-text-secondary);
	}

	.role-meta {
		margin-top: 12px;
	}

	.role-actions {
		margin-top: 20px;
		display: flex;
		gap: 12px;
	}

	.role-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 16px;
		border: none;
		border-radius: var(--admin-radius-md);
		font-size: 14px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.role-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: scale(1) !important;
	}

	.role-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		filter: brightness(1.1);
	}

	.role-btn:active:not(:disabled) {
		transform: scale(0.96);
	}

	.role-btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: var(--admin-text-primary);
	}

	.role-btn-secondary:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
	}

	.role-btn-primary {
		background: linear-gradient(135deg, var(--admin-accent), #b8941e);
		color: #111;
		box-shadow: 0 6px 16px rgba(212, 175, 55, 0.3);
	}

	:global([data-theme='clean']) .role-btn-primary {
		color: white;
	}

	.role-btn-danger {
		background: linear-gradient(135deg, #ff453a, #d42218);
		color: white;
		box-shadow: 0 6px 16px rgba(255, 69, 58, 0.3);
	}

	.role-btn-wide,
	.role-save {
		width: 100%;
	}

	.role-add-member-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: var(--admin-radius-full);
		font-size: 13px;
		font-weight: 700;
		background: linear-gradient(135deg, var(--admin-accent), #b8941e);
		color: #111;
		border: none;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
		transition: all 0.2s;
	}

	.role-add-member-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(212, 175, 55, 0.4);
	}

	.role-note,
	.role-helper {
		margin-top: 14px;
	}

	.role-editor {
		margin-top: 16px;
		padding: 16px;
		border-radius: var(--admin-radius-lg);
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(0, 0, 0, 0.2);
		animation: editDrop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
		transform-origin: top;
	}

	@keyframes editDrop {
		from { opacity: 0; transform: scaleY(0.95); }
		to { opacity: 1; transform: scaleY(1); }
	}

	.role-editor-grid,
	.role-confirm-actions {
		display: grid;
		gap: 16px;
	}

	.role-editor-grid label,
	.role-selected-user,
	.role-result {
		display: grid;
		gap: 8px;
	}

	.role-editor-grid span,
	.role-result small,
	.role-selected-user small {
		font-size: 12px;
		color: var(--admin-text-secondary);
		font-weight: 600;
	}

	.role-editor-grid input,
	.staff-form-group input {
		width: 100%;
		padding: 14px 16px;
		border-radius: var(--admin-radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(0, 0, 0, 0.4);
		color: var(--admin-text-primary);
		font-size: 15px;
		font-family: var(--admin-font);
		transition: all 0.3s ease;
	}

	.role-editor-grid input:focus,
	.staff-form-group input:focus {
		border-color: var(--admin-accent);
		outline: none;
		background: rgba(0, 0, 0, 0.6);
		box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.15);
	}

	.role-methods,
	.role-picker {
		margin-bottom: 20px;
	}

	.role-pick {
		cursor: pointer;
		padding: 10px 16px;
		font-size: 14px;
	}

	.role-pick.active {
		background: var(--admin-accent-light);
		border-color: rgba(212, 175, 55, 0.4);
		color: var(--admin-accent);
		box-shadow: 0 4px 12px rgba(212, 175, 55, 0.1);
	}

	.role-selected-user,
	.role-result,
	.role-empty-inline {
		padding: 16px;
		border-radius: var(--admin-radius-md);
	}

	.role-result {
		width: 100%;
		text-align: left;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		font-family: var(--admin-font);
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		transition: all 0.2s ease;
	}

	.role-result:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateY(-2px);
		border-color: rgba(255, 255, 255, 0.2);
	}

	.role-empty-inline {
		border: 1px dashed rgba(255, 255, 255, 0.15);
		background: transparent;
		color: var(--admin-text-secondary);
		font-size: 14px;
		text-align: center;
		padding: 24px;
	}

	.role-guide-card {
		padding: 14px;
		border-radius: var(--admin-radius-md);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		margin-bottom: 12px;
	}

	.role-guide-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border-radius: var(--admin-radius-full);
		font-size: 11px;
		font-weight: 700;
		margin-bottom: 10px;
	}

	.role-guide-badge.admin {
		background: var(--admin-accent-light);
		color: var(--admin-accent);
	}

	.role-guide-badge.staff {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.role-guide-card ul {
		padding-left: 18px;
		color: var(--admin-text-secondary);
		font-size: 12px;
		line-height: 1.6;
	}

	.role-confirm-overlay {
		position: fixed;
		inset: 0;
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: overlayFadeIn 0.3s ease forwards;
	}

	.role-info-overlay {
		position: fixed;
		inset: 0;
		z-index: 210;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		background: rgba(9, 11, 20, 0.8);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		animation: overlayFadeIn 0.3s ease forwards;
	}

	@keyframes overlayFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.role-info-modal {
		width: 100%;
		max-width: 580px;
		max-height: 86vh;
		overflow: auto;
		padding: 24px;
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: linear-gradient(160deg, rgba(32, 32, 34, 0.95), rgba(20, 20, 22, 0.95));
		box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes modalPop {
		from { opacity: 0; transform: scale(0.95) translateY(20px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.role-info-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 24px;
	}

	.role-info-title {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.role-info-icon {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(94, 92, 230, 0.3), rgba(94, 92, 230, 0.1));
		color: #8c8ae6;
		box-shadow: 0 4px 12px rgba(94, 92, 230, 0.2);
	}

	.role-info-title h3 {
		font-size: 22px;
		font-weight: 800;
		color: var(--admin-text-primary);
		letter-spacing: -0.5px;
	}

	.role-info-title p {
		margin-top: 4px;
		font-size: 13px;
		color: var(--admin-text-secondary);
	}

	.role-info-close {
		width: 36px;
		height: 36px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.05);
		color: var(--admin-text-secondary);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.role-info-close:hover {
		background: rgba(255, 255, 255, 0.15);
		color: white;
		transform: scale(1.05);
	}

	.role-info-grid {
		display: grid;
		gap: 16px;
		margin-bottom: 16px;
	}

	.role-info-card,
	.role-info-block {
		padding: 18px;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(0, 0, 0, 0.2);
	}

	.role-info-card h4,
	.role-info-block h4 {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 800;
		color: var(--admin-text-primary);
		margin-bottom: 12px;
	}

	.role-info-card ul,
	.role-info-block ol {
		padding-left: 20px;
		color: var(--admin-text-secondary);
		font-size: 14px;
		line-height: 1.7;
	}

	.role-info-footer {
		margin-top: 24px;
		display: flex;
		justify-content: flex-end;
	}

	.role-confirm-modal {
		width: 100%;
		max-width: 400px;
		padding: 32px 24px;
		border-radius: 24px;
		background: linear-gradient(160deg, rgba(32, 32, 34, 0.95), rgba(20, 20, 22, 0.95));
		box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		text-align: center;
		animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.role-confirm-icon {
		width: 64px;
		height: 64px;
		margin: 0 auto 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20px;
		background: linear-gradient(135deg, rgba(48, 209, 88, 0.3), rgba(48, 209, 88, 0.1));
		color: #4cd964;
		box-shadow: 0 8px 24px rgba(48, 209, 88, 0.2);
	}

	.role-confirm-icon.danger {
		background: linear-gradient(135deg, rgba(255, 69, 58, 0.3), rgba(255, 69, 58, 0.1));
		color: #ff453a;
		box-shadow: 0 8px 24px rgba(255, 69, 58, 0.2);
	}

	.role-confirm-modal h3 {
		font-size: 22px;
		font-weight: 800;
		color: white;
		margin-bottom: 12px;
		letter-spacing: -0.5px;
	}

	.role-confirm-modal p {
		font-size: 14px;
		line-height: 1.6;
		color: var(--admin-text-secondary);
		margin-bottom: 24px;
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(15px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@media (min-width: 720px) {
		.role-overview {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}

		.role-hero,
		.role-add-layout,
		.role-confirm-actions,
		.role-editor-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.role-info-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 960px) {
		.role-list,
		.role-results {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	/* ── Light Mode Overrides ────────────────────────────────── */
	:global([data-theme='clean']) .role-hero-count,
	:global([data-theme='clean']) .role-inline-note,
	:global([data-theme='clean']) .role-stat-card {
		background: rgba(255, 255, 255, 0.7);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global([data-theme='clean']) .role-section {
		background: rgba(255, 255, 255, 0.88);
		border-color: rgba(0, 0, 0, 0.07);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='clean']) .role-section-head > span {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.1);
	}

	:global([data-theme='clean']) .role-card {
		background: #ffffff;
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
	}

	:global([data-theme='clean']) .role-card:hover {
		background: #fafafa;
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.09);
	}

	:global([data-theme='clean']) .role-card::before {
		background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.08), transparent);
	}

	:global([data-theme='clean']) .role-card.admin-card {
		border-color: rgba(180, 140, 20, 0.3);
	}

	:global([data-theme='clean']) .role-card.staff-card {
		border-color: rgba(30, 170, 60, 0.25);
	}

	:global([data-theme='clean']) .role-editor {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.08);
	}

	:global([data-theme='clean']) .role-editor-grid input,
	:global([data-theme='clean']) .staff-form-group input {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.12);
		color: var(--admin-text-primary);
	}

	:global([data-theme='clean']) .role-editor-grid input:focus,
	:global([data-theme='clean']) .staff-form-group input:focus {
		background: #ffffff;
		border-color: var(--admin-accent);
		box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
	}

	:global([data-theme='clean']) .role-btn-secondary {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.12);
		color: var(--admin-text-primary);
	}

	:global([data-theme='clean']) .role-btn-secondary:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.09);
	}

	:global([data-theme='clean']) .role-pill.neutral,
	:global([data-theme='clean']) .role-meta span,
	:global([data-theme='clean']) .role-link,
	:global([data-theme='clean']) .role-pick,
	:global([data-theme='clean']) .role-selected-user {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.1);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='clean']) .role-result {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.07);
		color: var(--admin-text-primary);
	}

	:global([data-theme='clean']) .role-result:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.14);
	}

	:global([data-theme='clean']) .role-empty-inline {
		border-color: rgba(0, 0, 0, 0.12);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='clean']) .role-note,
	:global([data-theme='clean']) .role-helper {
		color: var(--admin-text-secondary);
	}

	:global([data-theme='clean']) .role-info-overlay {
		background: rgba(200, 200, 210, 0.7);
	}

	:global([data-theme='clean']) .role-confirm-overlay {
		background: rgba(0, 0, 0, 0.35);
	}

	:global([data-theme='clean']) .role-info-modal,
	:global([data-theme='clean']) .role-confirm-modal {
		background: linear-gradient(160deg, #ffffff, #f5f5f7);
		box-shadow: 0 32px 80px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
		border-color: rgba(0, 0, 0, 0.07);
	}

	:global([data-theme='clean']) .role-info-card,
	:global([data-theme='clean']) .role-info-block {
		background: rgba(0, 0, 0, 0.03);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='clean']) .role-info-close {
		background: rgba(0, 0, 0, 0.05);
		border-color: rgba(0, 0, 0, 0.1);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='clean']) .role-info-close:hover {
		background: rgba(0, 0, 0, 0.1);
		color: var(--admin-text-primary);
	}

	:global([data-theme='clean']) .role-confirm-modal h3,
	:global([data-theme='clean']) .role-confirm-modal p {
		color: var(--admin-text-primary);
	}

	:global([data-theme='clean']) .role-confirm-modal p {
		color: var(--admin-text-secondary);
	}

	:global([data-theme='clean']) .role-info-btn {
		border-color: rgba(0, 122, 255, 0.25);
		background: rgba(0, 122, 255, 0.08);
	}

	:global([data-theme='clean']) .role-info-btn:hover {
		background: rgba(0, 122, 255, 0.15);
	}

	:global([data-theme='clean']) .scroll-to-top-btn {
		background: rgba(255, 255, 255, 0.9);
		border-color: rgba(0, 0, 0, 0.1);
		color: var(--admin-text-primary);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
	}

	/* ── Glitch Theme Overrides ──────────────────────────────── */
	:global([data-theme='glitch']) .role-section {
		background: rgba(255, 255, 255, 0.75);
		border-color: rgba(108, 93, 211, 0.2);
		box-shadow: 6px 6px 0 rgba(108, 93, 211, 0.12);
	}

	:global([data-theme='glitch']) .role-section-head > span {
		background: rgba(108, 93, 211, 0.1);
		border-color: rgba(108, 93, 211, 0.3);
		color: #6c5dd3;
	}

	:global([data-theme='glitch']) .role-card {
		background: rgba(255, 255, 255, 0.85);
		border-color: rgba(108, 93, 211, 0.2);
	}

	:global([data-theme='glitch']) .role-card:hover {
		background: #ffffff;
		box-shadow: 6px 6px 0 rgba(108, 93, 211, 0.18);
	}

	:global([data-theme='glitch']) .role-card.admin-card {
		border-color: rgba(180, 140, 20, 0.35);
	}

	:global([data-theme='glitch']) .role-card.staff-card {
		border-color: rgba(0, 180, 80, 0.3);
	}

	:global([data-theme='glitch']) .role-btn-secondary {
		background: rgba(108, 93, 211, 0.07);
		border-color: rgba(108, 93, 211, 0.25);
		color: var(--admin-text-primary);
	}

	:global([data-theme='glitch']) .role-btn-secondary:hover:not(:disabled) {
		background: rgba(108, 93, 211, 0.14);
	}

	:global([data-theme='glitch']) .role-pill.neutral,
	:global([data-theme='glitch']) .role-meta span,
	:global([data-theme='glitch']) .role-link,
	:global([data-theme='glitch']) .role-pick,
	:global([data-theme='glitch']) .role-selected-user {
		background: rgba(108, 93, 211, 0.07);
		border-color: rgba(108, 93, 211, 0.2);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='glitch']) .role-editor {
		background: rgba(108, 93, 211, 0.04);
		border-color: rgba(108, 93, 211, 0.2);
	}

	:global([data-theme='glitch']) .role-editor-grid input,
	:global([data-theme='glitch']) .staff-form-group input {
		background: rgba(255, 255, 255, 0.7);
		border-color: rgba(108, 93, 211, 0.25);
		color: var(--admin-text-primary);
	}

	:global([data-theme='glitch']) .role-result {
		background: rgba(108, 93, 211, 0.04);
		border-color: rgba(108, 93, 211, 0.15);
		color: var(--admin-text-primary);
	}

	:global([data-theme='glitch']) .role-empty-inline {
		border-color: rgba(108, 93, 211, 0.2);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='glitch']) .role-info-modal,
	:global([data-theme='glitch']) .role-confirm-modal {
		background: linear-gradient(160deg, #ffffff, #f0f0ff);
		border-color: rgba(108, 93, 211, 0.2);
		box-shadow: 8px 8px 0 rgba(108, 93, 211, 0.15);
	}

	:global([data-theme='glitch']) .role-info-card,
	:global([data-theme='glitch']) .role-info-block {
		background: rgba(108, 93, 211, 0.05);
		border-color: rgba(108, 93, 211, 0.15);
	}

	:global([data-theme='glitch']) .role-info-close {
		background: rgba(108, 93, 211, 0.08);
		border-color: rgba(108, 93, 211, 0.2);
		color: var(--admin-text-secondary);
	}

	:global([data-theme='glitch']) .role-confirm-modal h3 {
		color: var(--admin-text-primary);
	}

	:global([data-theme='glitch']) .role-confirm-modal p {
		color: var(--admin-text-secondary);
	}

	:global([data-theme='glitch']) .role-info-btn {
		border-color: rgba(108, 93, 211, 0.35);
		background: rgba(108, 93, 211, 0.1);
		color: #6c5dd3;
	}

	:global([data-theme='glitch']) .role-info-btn:hover {
		background: rgba(108, 93, 211, 0.18);
	}

	:global([data-theme='glitch']) .role-confirm-overlay {
		background: rgba(0, 0, 0, 0.4);
	}

	:global([data-theme='glitch']) .role-info-overlay {
		background: rgba(108, 93, 211, 0.25);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}
</style>

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
		{#if roleFilter !== 'staff'}
			<section class="role-section">
				<div class="role-section-head">
					<div>
						<h3>Admins</h3>
						<p>Full access to the admin app and staff tools.</p>
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

		{#if roleFilter !== 'admin'}
			<section class="role-section">
				<div class="role-section-head">
					<div>
						<h3>Staff</h3>
						<p>Operational access for bookings, schedule, and service work.</p>
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
				<div class="role-picker">
					<button class="role-pick" class:active={existingRole === 'admin'} onclick={() => (existingRole = 'admin')}><Crown size={15} /> Admin</button>
					<button class="role-pick" class:active={existingRole === 'staff'} onclick={() => (existingRole = 'staff')}><ShieldCheck size={15} /> Staff</button>
				</div>
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
				<div class="role-picker">
					<button class="role-pick" class:active={newMemberRole === 'admin'} onclick={() => (newMemberRole = 'admin')}><Crown size={15} /> Admin</button>
					<button class="role-pick" class:active={newMemberRole === 'staff'} onclick={() => (newMemberRole = 'staff')}><ShieldCheck size={15} /> Staff</button>
				</div>
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
	.role-hero {
		display: grid;
		gap: 18px;
		margin-bottom: 18px;
		/* Prevent Android GPU paint glitches bleeding into following sections */
		contain: paint;
		isolation: isolate;
	}

	/* This page inherits the global admin hero glow pseudo-element.
	   Disable it here to avoid strip-noise artifacts seen on some mobile GPUs. */
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
		background: var(--admin-surface);
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
		padding: 0 14px;
		border-radius: var(--admin-radius-md);
		border: 1px solid rgba(94, 92, 230, 0.26);
		background: rgba(94, 92, 230, 0.13);
		color: var(--admin-indigo);
		font-size: 13px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
	}

	.role-info-btn:hover {
		filter: brightness(1.05);
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
		background: var(--admin-surface);
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
		margin-bottom: 18px;
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
		padding: 16px;
		border-radius: var(--admin-radius-lg);
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		box-shadow: var(--admin-shadow-sm);
	}

	.role-section-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
		margin-bottom: 14px;
	}

	.role-section-head h3 {
		font-size: 18px;
		font-weight: 700;
		color: var(--admin-text-primary);
	}

	.role-section-head p {
		margin-top: 4px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--admin-text-secondary);
	}

	.role-section-head > span {
		min-width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 10px;
		border-radius: var(--admin-radius-full);
		background: var(--admin-bg);
		border: 1px solid var(--admin-border);
		font-size: 13px;
		font-weight: 700;
	}

	.role-list,
	.role-results {
		display: grid;
		gap: 12px;
	}

	.role-card {
		padding: 14px;
		border-radius: var(--admin-radius-md);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
	}

	.role-card.admin-card {
		border-color: rgba(212, 175, 55, 0.22);
	}

	.role-card.staff-card {
		border-color: rgba(48, 209, 88, 0.2);
	}

	.role-card.protected-card {
		box-shadow: 0 0 0 1px rgba(255, 159, 10, 0.18);
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
		gap: 12px;
	}

	.role-card-main {
		flex: 1;
		min-width: 0;
	}

	.role-card-title h4 {
		font-size: 15px;
		font-weight: 700;
		color: var(--admin-text-primary);
	}

	.role-avatar {
		width: 52px;
		height: 52px;
		border-radius: 16px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.role-avatar.fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 18px;
		font-weight: 800;
	}

	.role-pill,
	.role-meta span,
	.role-link,
	.role-pick {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: var(--admin-radius-full);
		font-size: 11px;
		font-weight: 700;
	}

	.role-pill.admin {
		background: var(--admin-accent-light);
		color: var(--admin-accent);
	}

	.role-pill.staff {
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.role-pill.warn {
		background: var(--admin-orange-light);
		color: var(--admin-orange);
	}

	.role-pill.neutral,
	.role-meta span,
	.role-link,
	.role-pick,
	.role-selected-user {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		color: var(--admin-text-secondary);
	}

	.role-meta {
		margin-top: 10px;
	}

	.role-actions {
		margin-top: 14px;
	}

	.role-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 42px;
		padding: 0 14px;
		border: none;
		border-radius: var(--admin-radius-md);
		font-size: 13px;
		font-weight: 700;
		font-family: var(--admin-font);
		cursor: pointer;
	}

	.role-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.role-btn-secondary {
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		color: var(--admin-text-primary);
	}

	.role-btn-primary {
		background: linear-gradient(135deg, var(--admin-accent), #b8941e);
		color: #111;
	}

	:global([data-theme='clean']) .role-btn-primary {
		color: white;
	}

	.role-btn-danger {
		background: var(--admin-red);
		color: white;
	}

	.role-btn-wide,
	.role-save {
		width: 100%;
	}

	.role-note,
	.role-helper {
		margin-top: 12px;
	}

	.role-editor {
		margin-top: 14px;
		padding: 14px;
		border-radius: var(--admin-radius-md);
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
	}

	.role-editor-grid,
	.role-confirm-actions {
		display: grid;
		gap: 12px;
	}

	.role-editor-grid label,
	.role-selected-user,
	.role-result {
		display: grid;
		gap: 6px;
	}

	.role-editor-grid span,
	.role-result small,
	.role-selected-user small {
		font-size: 11px;
		color: var(--admin-text-secondary);
	}

	.role-editor-grid input,
	.staff-form-group input {
		width: 100%;
		padding: 11px 12px;
		border-radius: var(--admin-radius-sm);
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		color: var(--admin-text-primary);
		font-size: 14px;
		font-family: var(--admin-font);
	}

	.role-methods,
	.role-picker {
		margin-bottom: 14px;
	}

	.role-pick {
		cursor: pointer;
	}

	.role-pick.active {
		background: var(--admin-accent-light);
		border-color: rgba(212, 175, 55, 0.24);
		color: var(--admin-accent);
	}

	.role-selected-user,
	.role-result,
	.role-empty-inline {
		padding: 12px;
		border-radius: var(--admin-radius-md);
	}

	.role-result {
		width: 100%;
		text-align: left;
		border: 1px solid var(--admin-border);
		background: var(--admin-bg);
		font-family: var(--admin-font);
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}

	.role-empty-inline {
		border: 1px dashed var(--admin-border);
		background: var(--admin-bg);
		color: var(--admin-text-secondary);
		font-size: 12px;
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
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.role-info-overlay {
		position: fixed;
		inset: 0;
		z-index: 210;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
		background: rgba(9, 11, 20, 0.72);
		backdrop-filter: blur(6px);
	}

	.role-info-modal {
		width: 100%;
		max-width: 560px;
		max-height: 86vh;
		overflow: auto;
		padding: 18px;
		border-radius: 18px;
		border: 1px solid var(--admin-border);
		background: linear-gradient(180deg, var(--admin-surface), var(--admin-bg));
		box-shadow: 0 22px 56px rgba(0, 0, 0, 0.35);
	}

	.role-info-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
	}

	.role-info-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.role-info-icon {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: rgba(94, 92, 230, 0.16);
		color: var(--admin-indigo);
	}

	.role-info-title h3 {
		font-size: 18px;
		font-weight: 800;
		color: var(--admin-text-primary);
	}

	.role-info-title p {
		margin-top: 2px;
		font-size: 12px;
		color: var(--admin-text-secondary);
	}

	.role-info-close {
		width: 30px;
		height: 30px;
		border-radius: 10px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
		color: var(--admin-text-secondary);
		cursor: pointer;
	}

	.role-info-grid {
		display: grid;
		gap: 12px;
		margin-bottom: 12px;
	}

	.role-info-card,
	.role-info-block {
		padding: 14px;
		border-radius: 14px;
		border: 1px solid var(--admin-border);
		background: var(--admin-surface);
	}

	.role-info-card h4,
	.role-info-block h4 {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
		color: var(--admin-text-primary);
		margin-bottom: 8px;
	}

	.role-info-card ul,
	.role-info-block ol {
		padding-left: 18px;
		color: var(--admin-text-secondary);
		font-size: 12px;
		line-height: 1.7;
	}

	.role-info-footer {
		margin-top: 14px;
		display: flex;
		justify-content: flex-end;
	}

	.role-confirm-modal {
		width: 100%;
		max-width: 360px;
		padding: 24px;
		border-radius: var(--admin-radius-lg);
		background: var(--admin-surface);
		text-align: center;
	}

	.role-confirm-icon {
		width: 56px;
		height: 56px;
		margin: 0 auto 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 16px;
		background: var(--admin-green-light);
		color: var(--admin-green);
	}

	.role-confirm-icon.danger {
		background: var(--admin-orange-light);
		color: var(--admin-orange);
	}

	.role-confirm-modal h3 {
		font-size: 18px;
		font-weight: 700;
		margin-bottom: 8px;
	}

	.role-confirm-modal p {
		font-size: 13px;
		line-height: 1.6;
		color: var(--admin-text-secondary);
		margin-bottom: 18px;
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
</style>

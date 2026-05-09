<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		allUsers,
		allBookings,
		getUserDisplayName,
		getUserPhoto,
		getUserPhone,
		formatFirestoreDate,
		updateUserDetails,
		type AppUser,
		type Booking
	} from '$lib/stores/adminData';
	import { showToast } from '$lib/stores/toast';
	import { onMount, onDestroy } from 'svelte';
	import { isBottomNavVisible } from '$lib/stores/adminUI';
	import {
		Pencil,
		Save,
		X,
		Phone,
		Mail,
		Calendar,
		Clock,
		Copy,
		History,
		ArrowLeft,
		Shield,
		Wallet,
		User as UserIcon,
		CalendarCheck,
		IndianRupee,
		ChevronRight
	} from 'lucide-svelte';

	// --- Get user ID from route params ---
	let userId = $derived(page.params.id);

	// --- Find user from store ---
	let user = $derived($allUsers.find((u) => u.id === userId) || null);
	let name = $derived(user ? getUserDisplayName(user) : 'Unknown User');
	let photo = $derived(user ? getUserPhoto(user) : null);
	let phone = $derived(user ? getUserPhone(user) : null);

	// --- Edit Mode ---
	let isEditing = $state(false);
	let isSaving = $state(false);
	let editName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');

	function startEditing() {
		if (!user) return;
		editName = getUserDisplayName(user);
		editEmail = user.email || '';
		editPhone = getUserPhone(user) || '';
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
	}

	async function saveChanges() {
		if (!user || isSaving) return;
		isSaving = true;
		try {
			const updates: Partial<AppUser> = {};

			// Determine which name field to update
			if (editName !== getUserDisplayName(user)) {
				if (user.displayName !== undefined) updates.displayName = editName;
				else if (user.name !== undefined) updates.name = editName;
				else if (user.fullName !== undefined) updates.fullName = editName;
				else updates.displayName = editName;
			}

			if (editEmail !== (user.email || '')) {
				updates.email = editEmail;
			}

			const currentPhone = getUserPhone(user) || '';
			if (editPhone !== currentPhone) {
				if (user.phone !== undefined) updates.phone = editPhone;
				else if (user.phoneNumber !== undefined) updates.phoneNumber = editPhone;
				else if (user.mobile !== undefined) updates.mobile = editPhone;
				else updates.phone = editPhone;
			}

			if (Object.keys(updates).length === 0) {
				showToast('No changes to save', 'info');
				isEditing = false;
				isSaving = false;
				return;
			}

			await updateUserDetails(user.id, updates);
			showToast('User updated successfully!', 'success');
			isEditing = false;
		} catch (e: any) {
			console.error('[UserDetail] Save error:', e);
			showToast('Failed to save: ' + e.message, 'error');
		} finally {
			isSaving = false;
		}
	}

	// --- User's Bookings ---
	let userBookings = $derived.by(() => {
		if (!user) return [];
		return $allBookings
			.filter((b) => {
				// Match by userId field, uid field, or userEmail
				if (b.userId === user!.id || b.uid === user!.id) return true;
				// Also match by phone number or email
				if (user!.email && b.userEmail && b.userEmail === user!.email) return true;
				if (phone && b.userPhone && b.userPhone === phone) return true;
				return false;
			})
			.sort((a, b) => {
				const tA = a.createdAt?.seconds || 0;
				const tB = b.createdAt?.seconds || 0;
				return tB - tA; // Newest first
			});
	});

	// --- Helpers ---
	function getBookingAmount(b: Booking): number {
		return b.totalAmount || b.amount || b.price || 0;
	}

	function getServicesList(b: Booking): string[] {
		const data =
			b.servicesList || (b.service ? b.service.split(',') : b.serviceName ? [b.serviceName] : []);
		if (!Array.isArray(data)) return [];
		return data.map((s: any) =>
			typeof s === 'string' ? s.trim() : s.name || s.serviceName || 'Unknown'
		);
	}

	function formatJoinDate(dateField: any): string {
		if (!dateField) return 'Unknown';
		let d: Date;
		if (dateField.seconds) d = new Date(dateField.seconds * 1000);
		else d = new Date(dateField);
		if (isNaN(d.getTime())) return 'Unknown';
		return d.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function copyUserId() {
		if (!user) return;
		try {
			await navigator.clipboard.writeText(user.id);
			showToast('User ID Copied!', 'success');
		} catch {
			showToast('Failed to copy', 'error');
		}
	}

	const avatarColors = ['#FF9F0A', '#30D158', '#D4AF37', '#BF5AF2', '#FF375F', '#AC8E68', '#5E5CE6', '#32ADE6'];

	function getAvatarColor(n: string): string {
		return avatarColors[(n || '?').charCodeAt(0) % avatarColors.length];
	}

	const chipColors = [
		{ bg: 'rgba(212, 175, 55, 0.18)', text: '#b8941e' },
		{ bg: 'rgba(191, 90, 242, 0.18)', text: '#9b40d8' },
		{ bg: 'rgba(48, 209, 88, 0.18)', text: '#1a9e3f' },
		{ bg: 'rgba(255, 159, 10, 0.18)', text: '#d97706' },
		{ bg: 'rgba(255, 55, 95, 0.18)', text: '#dc2653' },
		{ bg: 'rgba(94, 92, 230, 0.18)', text: '#4f46e5' }
	];
</script>

<!-- Back Button + Edit Toggle -->
{#if user}
	<div class="admin-ud-card">
		<!-- Profile Header -->
		<div class="admin-ud-header">
			<div class="admin-ud-avatar-wrap">
				{#if photo}
					<img src={photo} alt={name} class="admin-ud-avatar" />
				{:else}
					<div class="admin-ud-avatar-fallback" style="background: {getAvatarColor(name)};">
						{name.charAt(0).toUpperCase()}
					</div>
				{/if}
			</div>

			<div class="admin-ud-header-info">
				<div class="admin-ud-name-row">
					<span class="admin-ud-name">{name}</span>
					{#if user.accountType === 'walkin'}
						<span
							class="admin-role-badge"
							style="background: rgba(234,179,8,0.15); color: #ca8a04; border-color: rgba(234,179,8,0.3);"
						>
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
				{#if !isEditing}
					<div class="admin-ud-email">{user.email || 'No email'}</div>
					{#if phone}
						<div class="admin-ud-phone">
							<Phone size={12} />
							{phone}
						</div>
					{/if}
				{/if}
			</div>

			<button
				class="admin-ud-edit-btn"
				class:active={isEditing}
				onclick={() => (isEditing ? cancelEditing() : startEditing())}
				aria-label={isEditing ? 'Cancel Edit' : 'Edit User'}
			>
				{#if isEditing}
					<X size={18} />
				{:else}
					<Pencil size={16} />
				{/if}
			</button>
		</div>

		<!-- Editable Fields -->
		{#if isEditing}
			<div class="admin-ud-fields">
				<div class="admin-ud-field full editing">
					<span class="admin-ud-field-label">
						<UserIcon size={10} /> Display Name
					</span>
					<input
						type="text"
						class="admin-ud-field-input"
						bind:value={editName}
						placeholder="Enter name"
					/>
				</div>
				<div class="admin-ud-field full editing">
					<span class="admin-ud-field-label">
						<Mail size={10} /> Email
					</span>
					<input
						type="email"
						class="admin-ud-field-input"
						bind:value={editEmail}
						placeholder="Enter email"
					/>
				</div>
				<div class="admin-ud-field full editing">
					<span class="admin-ud-field-label">
						<Phone size={10} /> Phone
					</span>
					<input
						type="tel"
						class="admin-ud-field-input"
						bind:value={editPhone}
						placeholder="Enter phone"
					/>
				</div>
			</div>

			<div class="admin-ud-edit-actions">
				<button class="admin-ud-cancel-btn" onclick={cancelEditing} disabled={isSaving}>
					<X size={14} />
					Cancel
				</button>
				<button class="admin-ud-save-btn" onclick={saveChanges} disabled={isSaving}>
					<Save size={14} />
					{isSaving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		{:else}
			<!-- Read-only Detail Fields -->
			<div class="admin-ud-fields">
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<UserIcon size={10} /> Display Name
					</span>
					<span class="admin-ud-field-value">{name}</span>
				</div>
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<Shield size={10} /> Role
					</span>
					<span class="admin-ud-field-value">{user.role || 'user'}</span>
				</div>
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<Mail size={10} /> Email
					</span>
					<span class="admin-ud-field-value">{user.email || 'No email'}</span>
				</div>
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<Phone size={10} /> Phone
					</span>
					<span class="admin-ud-field-value">{phone || 'N/A'}</span>
				</div>
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<Calendar size={10} /> Joined
					</span>
					<span class="admin-ud-field-value">{formatJoinDate(user.createdAt)}</span>
				</div>
				<div class="admin-ud-field">
					<span class="admin-ud-field-label">
						<Wallet size={10} /> Beu Cash
					</span>
					<span class="admin-ud-field-value">₹{user.beuCash || user.walletBalance || 0}</span>
				</div>
			</div>

			<!-- Quick Info Pills -->
			<div class="admin-ud-pills">
				<button class="admin-ud-pill" onclick={copyUserId}>
					<Copy size={12} />
					ID: {user.id.slice(0, 8)}...
				</button>
				{#if user.accountType}
					<span class="admin-ud-pill">
						<UserIcon size={12} />
						{user.accountType}
					</span>
				{/if}
				{#if user.accountStatus}
					<span class="admin-ud-pill">
						<Shield size={12} />
						{user.accountStatus}
					</span>
				{/if}
				<span class="admin-ud-pill">
					<CalendarCheck size={12} />
					{userBookings.length} bookings
				</span>
			</div>
		{/if}
	</div>

	<!-- ═══════════ Booking History ═══════════ -->
	<div class="admin-ud-section-header">
		<div class="admin-ud-section-title">
			<div class="admin-title-icon" style="background: var(--admin-accent-light); color: var(--admin-accent);">
				<History size={16} />
			</div>
			Booking History
		</div>
		<span class="admin-ud-section-count">{userBookings.length} total</span>
	</div>

	{#if userBookings.length === 0}
		<div class="admin-empty-state">
			<CalendarCheck size={44} color="var(--admin-text-tertiary)" />
			<p>No bookings yet</p>
		</div>
	{:else}
		{#each userBookings as booking (booking.id)}
			{@const status = (booking.status || 'pending').toLowerCase()}
			{@const statusClass = status === 'declined' ? 'cancelled' : status}
			{@const dateStr = formatFirestoreDate(booking.date)}
			{@const services = getServicesList(booking)}
			{@const amount = getBookingAmount(booking)}

			<div class="admin-ud-booking {statusClass}">
				<div class="admin-ud-booking-top">
					<span class="admin-ud-booking-id">#{booking.id.slice(0, 8).toUpperCase()}</span>
					<span class="admin-status-badge {statusClass}">{status}</span>
				</div>

				<div class="admin-ud-booking-meta">
					<span class="admin-ud-booking-date">
						<Calendar size={12} />
						{dateStr}
					</span>
					{#if booking.time}
						<span class="admin-ud-booking-time">
							<Clock size={11} />
							{booking.time}
						</span>
					{/if}
					{#if amount > 0}
						<span class="admin-ud-booking-amount">
							₹{amount.toLocaleString('en-IN')}
						</span>
					{/if}
				</div>

				{#if services.length > 0}
					<div class="admin-ud-booking-services">
						{#each services as service, i}
							{@const c = chipColors[(service.length + i) % chipColors.length]}
							<span class="admin-service-chip" style="background: {c.bg}; color: {c.text};">
								{service}
							</span>
						{/each}
					</div>
				{/if}

				{#if booking.notes}
					<div style="margin-top: 6px; font-size: 12px; color: var(--admin-text-secondary); font-style: italic;">
						"{booking.notes}"
					</div>
				{/if}
			</div>
		{/each}
	{/if}
{:else}
	<!-- User not found -->
	<div class="admin-empty-state">
		<UserIcon size={44} color="var(--admin-text-tertiary)" />
		<p>User not found</p>
		<button
			class="admin-ud-cancel-btn"
			style="margin-top: 12px; max-width: 200px;"
			onclick={() => goto('/admin/users')}
		>
			<ArrowLeft size={14} />
			Back to Users
		</button>
	</div>
{/if}

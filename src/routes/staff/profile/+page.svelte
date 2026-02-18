<script lang="ts">
	import { staffUser, staffLogout } from '$lib/stores/staffAuth';
	import { goto } from '$app/navigation';
	import StaffHeader from '$lib/components/staff/StaffHeader.svelte';
	import StaffNav from '$lib/components/staff/StaffNav.svelte';

	async function handleLogout() {
		if (confirm('Log out of Staff App?')) {
			await staffLogout();
			goto('/staff/login');
		}
	}
</script>

<StaffHeader title="Profile" />

<div class="profile-page">
	<div class="profile-card">
		<div class="avatar-container">
			{#if $staffUser?.photoURL}
				<img src={$staffUser.photoURL} alt="Profile" />
			{:else}
				<div class="placeholder">
					{$staffUser?.displayName?.[0] || 'S'}
				</div>
			{/if}
		</div>
		<h2>{$staffUser?.displayName || 'Staff Member'}</h2>
		<p class="email">{$staffUser?.email}</p>
		<span class="role-badge">Staff Mode</span>
	</div>

	<div class="menu-list">
		<div class="menu-item">
			<span class="label">Availability</span>
			<span class="value">9:00 AM - 6:00 PM</span>
		</div>
		<div class="menu-item">
			<span class="label">Notifications</span>
			<span class="toggle">ON</span>
		</div>
		<div class="menu-item">
			<span class="label">App Version</span>
			<span class="value">v1.2.0</span>
		</div>
	</div>

	<button class="logout-btn" onclick={handleLogout}> Sign Out </button>
</div>

<StaffNav />

<style>
	.profile-page {
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.profile-card {
		background: white;
		padding: 32px;
		border-radius: 20px;
		width: 100%;
		max-width: 400px;
		text-align: center;
		margin-bottom: 24px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
	}

	.avatar-container {
		width: 80px;
		height: 80px;
		margin: 0 auto 16px auto;
		border-radius: 50%;
		overflow: hidden;
		background: #f2f2f7;
	}

	.avatar-container img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		color: #8e8e93;
		font-weight: 600;
	}

	h2 {
		margin: 0 0 4px 0;
		font-size: 1.5rem;
	}

	.email {
		color: #8e8e93;
		margin: 0 0 16px 0;
		font-size: 0.9rem;
	}

	.role-badge {
		background: #e8f5e9;
		color: #388e3c;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.menu-list {
		width: 100%;
		max-width: 400px;
		background: white;
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 24px;
	}

	.menu-item {
		display: flex;
		justify-content: space-between;
		padding: 16px;
		border-bottom: 1px solid #f2f2f7;
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.label {
		font-weight: 500;
	}

	.value {
		color: #8e8e93;
	}

	.toggle {
		color: #34c759;
		font-weight: 600;
	}

	.logout-btn {
		width: 100%;
		max-width: 400px;
		padding: 16px;
		background: #fff0f0;
		color: #d32f2f;
		border: none;
		border-radius: 12px;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
	}
</style>

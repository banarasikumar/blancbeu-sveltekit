<script lang="ts">
	import { staffUser, staffLogout } from '$lib/stores/staffAuth';
	import { goto } from '$app/navigation';

	let { title = 'Staff App' } = $props();

	async function handleLogout() {
		if (confirm('Are you sure you want to log out?')) {
			await staffLogout();
			goto('/staff/login');
		}
	}
</script>

<header class="staff-header">
	<div class="header-content">
		<h1 class="page-title">{title}</h1>
		<button class="profile-btn" onclick={handleLogout}>
			{#if $staffUser?.photoURL}
				<img src={$staffUser.photoURL} alt="Profile" class="avatar" />
			{:else}
				<div class="avatar-placeholder">
					{$staffUser?.email?.[0].toUpperCase() || 'S'}
				</div>
			{/if}
		</button>
	</div>
</header>

<style>
	.staff-header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		padding: 12px 16px;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 600px;
		margin: 0 auto;
	}

	.page-title {
		font-family: 'Outfit', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1c1c1e;
		margin: 0;
	}

	.profile-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.avatar-placeholder {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: #000;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 1rem;
		border: 2px solid white;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
</style>

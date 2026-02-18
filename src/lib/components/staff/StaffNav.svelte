<script lang="ts">
	import { page } from '$app/state';

	// Simple derived check to see active route
	let activeRoute = $derived(page.url.pathname);

	const routes = [
		{ path: '/staff/dashboard', label: 'Home', icon: 'home' },
		{ path: '/staff/schedule', label: 'Schedule', icon: 'calendar' },
		{ path: '/staff/bookings', label: 'Bookings', icon: 'list' },
		{ path: '/staff/profile', label: 'Profile', icon: 'user' }
	];
</script>

<nav class="staff-nav">
	<div class="nav-content">
		{#each routes as route}
			<a href={route.path} class="nav-item" class:active={activeRoute.startsWith(route.path)}>
				<div class="icon-container">
					{#if route.icon === 'home'}
						<svg
							viewBox="0 0 24 24"
							width="24"
							height="24"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline
								points="9 22 9 12 15 12 15 22"
							></polyline></svg
						>
					{:else if route.icon === 'calendar'}
						<svg
							viewBox="0 0 24 24"
							width="24"
							height="24"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line
								x1="16"
								y1="2"
								x2="16"
								y2="6"
							></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"
							></line></svg
						>
					{:else if route.icon === 'list'}
						<svg
							viewBox="0 0 24 24"
							width="24"
							height="24"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"
							></line><line x1="8" y1="18" x2="21" y2="18"></line><line
								x1="3"
								y1="6"
								x2="3.01"
								y2="6"
							></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line
								x1="3"
								y1="18"
								x2="3.01"
								y2="18"
							></line></svg
						>
					{:else if route.icon === 'user'}
						<svg
							viewBox="0 0 24 24"
							width="24"
							height="24"
							stroke="currentColor"
							stroke-width="2"
							fill="none"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle
								cx="12"
								cy="7"
								r="4"
							></circle></svg
						>
					{/if}
				</div>
				<span class="label">{route.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.staff-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		width: 100%;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 1px solid rgba(0, 0, 0, 0.05);
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 50;
	}

	.nav-content {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 64px;
		max-width: 600px;
		margin: 0 auto;
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: #8e8e93;
		font-size: 0.7rem;
		font-weight: 500;
		gap: 4px;
		width: 60px;
		transition: color 0.2s;
	}

	.nav-item.active {
		color: #000;
	}

	.nav-item.active .icon-container {
		transform: translateY(-2px);
	}

	.icon-container {
		transition: transform 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-item svg {
		width: 24px;
		height: 24px;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Home, CalendarCheck, Users, Megaphone } from 'lucide-svelte';
	import { isBottomNavVisible } from '$lib/stores/adminUI';

	const navItems = [
		{ path: '/admin', label: 'Home', icon: Home, exact: true },
		{ path: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
		{ path: '/admin/users', label: 'Users', icon: Users },
		{ path: '/admin/notify', label: 'Notify', icon: Megaphone }
	];

	function isActive(item: (typeof navItems)[0]): boolean {
		if (item.exact) return page.url.pathname === item.path;
		return page.url.pathname.startsWith(item.path);
	}

	function navigate(path: string) {
		goto(path);
	}
</script>

{#if $isBottomNavVisible}
	<nav class="admin-bottom-nav">
		{#each navItems as item}
			<button
				class="admin-nav-item"
				class:active={isActive(item)}
				onclick={() => navigate(item.path)}
				aria-label={item.label}
			>
				<item.icon size={22} strokeWidth={isActive(item) ? 2.5 : 1.8} />
				<span>{item.label}</span>
			</button>
		{/each}
	</nav>
{/if}

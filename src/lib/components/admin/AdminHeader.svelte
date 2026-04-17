<script lang="ts">
	import { Bell, Menu, Moon, Sun } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import { isOnline } from '$lib/stores/networkStatus';
	import { adminUnreadCount } from '$lib/stores/adminNotificationsList';

	let { title = 'Dashboard' }: { title?: string } = $props();
</script>

<header class="admin-header">
	<div class="admin-header-title">{title}</div>
	<div style="display: flex; gap: 8px;">
		<button class="admin-header-btn admin-header-bell" onclick={() => goto('/admin/notify')} aria-label="Notifications">
			<Bell size={22} />
			{#if $adminUnreadCount > 0}
				<span class="admin-header-badge">{$adminUnreadCount > 99 ? '99+' : $adminUnreadCount}</span>
			{/if}
		</button>
		<button class="admin-header-btn" onclick={toggleTheme} aria-label="Toggle Theme">
			{#if $theme === 'clean'}
				<Moon size={22} />
			{:else}
				<Sun size={22} />
			{/if}
		</button>
		<button class="admin-header-btn" aria-label="Menu">
			<Menu size={22} />
		</button>
	</div>
</header>

{#if !$isOnline}
	<div class="admin-offline-banner">
		<span class="admin-offline-dot"></span>
		You are offline
	</div>
{/if}

<style>
	.admin-offline-banner {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 16px;
		background: #d32f2f;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		z-index: 199;
		animation: adminSlideDown 0.3s ease;
	}

	.admin-offline-dot {
		width: 6px;
		height: 6px;
		background: #fff;
		border-radius: 50%;
		animation: adminPulseDot 2s ease-in-out infinite;
	}

	@keyframes adminSlideDown {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(0);
		}
	}

	@keyframes adminPulseDot {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	.admin-header-bell {
		position: relative;
	}

	.admin-header-badge {
		position: absolute;
		top: -5px;
		right: -5px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 999px;
		background: #ff3b30;
		color: #fff;
		font-size: 10px;
		font-weight: 700;
		line-height: 18px;
		text-align: center;
	}
</style>

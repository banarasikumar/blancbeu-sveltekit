<script lang="ts">
	import { Bell, Menu, Moon, Sun, UploadCloud, MoreVertical } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { theme, toggleTheme } from '$lib/stores/theme';
	import { isOnline } from '$lib/stores/networkStatus';
	import { adminUnreadCount } from '$lib/stores/adminNotificationsList';
	import { uploadStore } from '$lib/stores/uploadStore';
	import { headerActions } from '$lib/stores/adminUI';
	import { untrack } from 'svelte';

	let { title = 'Dashboard' }: { title?: string } = $props();

	let activeUploadsCount = $derived(
		$uploadStore.filter((u) => u.status === 'uploading' || u.status === 'pending').length
	);

	let showMenu = $state(false);

	function toggleMenu() {
		showMenu = !showMenu;
	}

	// Close menu on click outside
	function handleOutsideClick(e: MouseEvent) {
		if (showMenu) {
			showMenu = false;
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<header class="admin-header">
	<div style="display: flex; align-items: center; gap: 12px;">
		<button
			class="admin-header-btn"
			style="padding-left: 0; padding-right: 4px;"
			onclick={() => goto('/admin/settings')}
			aria-label="Settings"
		>
			<Menu size={24} />
		</button>
		<div class="admin-header-title">{title}</div>
	</div>
	<div style="display: flex; gap: 8px;">
		{#if activeUploadsCount > 0}
			<button
				class="admin-header-btn admin-header-upload"
				onclick={() => goto('/admin/uploads')}
				aria-label="Uploads"
			>
				<UploadCloud size={22} class="animate-bounce-subtle" />
				<span class="admin-header-badge">{activeUploadsCount}</span>
			</button>
		{/if}
		<button
			class="admin-header-btn admin-header-bell"
			onclick={() => goto('/admin/notifications')}
			aria-label="Notifications"
		>
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
		{#if $headerActions.length === 1 && $headerActions[0].direct}
			<button
				class="admin-header-btn"
				onclick={$headerActions[0].handler}
				aria-label={$headerActions[0].label}
			>
				{#if $headerActions[0].icon}
					{@const Icon = $headerActions[0].icon}
					<Icon size={22} />
				{/if}
			</button>
		{:else}
			<div style="position: relative;">
				<button
					class="admin-header-btn"
					onclick={(e) => {
						e.stopPropagation();
						toggleMenu();
					}}
					aria-label="More Options"
				>
					<MoreVertical size={22} />
				</button>

				{#if showMenu && $headerActions.length > 0}
					<div class="admin-header-dropdown">
						{#each $headerActions as action}
							<button
								class="admin-header-dropdown-item"
								onclick={() => {
									action.handler();
									showMenu = false;
								}}
							>
								{#if action.icon}
									<action.icon size={18} />
								{/if}
								<span>{action.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
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

	.admin-header-bell,
	.admin-header-upload {
		position: relative;
	}

	.admin-header-upload {
		color: var(--admin-accent, #d4af37);
	}

	:global(.animate-bounce-subtle) {
		animation: bounceSubtle 2s infinite ease-in-out;
	}

	@keyframes bounceSubtle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-3px);
		}
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

	.admin-header-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 8px;
		background: var(--admin-surface);
		border: 1px solid var(--admin-border);
		border-radius: var(--admin-radius-sm);
		box-shadow: var(--admin-shadow-lg);
		min-width: 180px;
		z-index: 1000;
		overflow: hidden;
		transform-origin: top right;
		animation: adminMenuPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.admin-header-dropdown-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background: none;
		border: none;
		color: var(--admin-text-primary);
		font-family: var(--admin-font);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
	}

	.admin-header-dropdown-item:hover {
		background: var(--admin-surface-hover);
	}

	.admin-header-dropdown-item:active {
		background: var(--admin-border);
	}

	@keyframes adminMenuPopIn {
		from {
			opacity: 0;
			transform: scale(0.85) translateY(-8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
</style>

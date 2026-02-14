<script lang="ts">
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { Bell } from 'lucide-svelte';
	import { unreadCount } from '$lib/stores/notifications';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	function handleNotificationClick(e: MouseEvent) {
		e.preventDefault();
		if ($page.url.pathname === '/notifications') {
			// If already on notifications page, go back or home
			if (window.history.length > 1) {
				window.history.back();
			} else {
				goto('/');
			}
		} else {
			goto('/notifications');
		}
	}
</script>

<header class="app-header">
	<div class="header-left">
		<!-- Optional: Menu Icon or Empty -->
	</div>

	<div class="logo-text">BLANCBEU</div>

	<div class="header-right">
		<a
			href="/notifications"
			class="icon-btn relative"
			aria-label="Notifications"
			onclick={handleNotificationClick}
		>
			<Bell size={20} strokeWidth={1.5} />
			{#if $unreadCount > 0}
				<span class="badge">{$unreadCount}</span>
			{/if}
		</a>
		<ThemeToggle />
	</div>
</header>

<style>
	.app-header {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 56px;
		display: grid; /* Changed to Grid for easy centering */
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 20px;
		z-index: 1000;
		background: rgba(var(--color-bg-primary-rgb), 0.85); /* Use accessible RGB var */
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		transition:
			background-color 0.4s ease,
			border-color 0.4s ease;
	}

	/* Subtle gold gradient line at bottom */
	.app-header::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.3), transparent);
		opacity: 0.6;
	}

	.header-left {
		/* Empty placeholder for grid balance if needed, or menu icon */
		justify-self: start;
	}

	.logo-text {
		justify-self: center;
		font-family: var(--font-heading);
		font-weight: 700;
		font-size: 1.5rem; /* Larger per premium look */
		letter-spacing: 0.15em;
		background: var(--gradient-gold);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-transform: uppercase;
	}

	.header-right {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-primary);
		background: transparent;
		transition: color 0.3s ease;
	}

	.icon-btn:hover {
		color: var(--color-accent-gold);
	}

	.relative {
		position: relative;
		text-decoration: none; /* For the anchor tag */
	}

	.badge {
		position: absolute;
		top: 2px;
		right: 2px;
		background: var(--color-accent-gold); /* Gold badge */
		color: #000;
		font-size: 0.65rem;
		font-weight: 800;
		min-width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0 4px;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	@keyframes popIn {
		from {
			transform: scale(0);
		}
		to {
			transform: scale(1);
		}
	}
</style>

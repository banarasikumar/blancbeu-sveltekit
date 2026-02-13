<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toasts } from '$lib/stores/toast';

	const icons: Record<string, string> = {
		success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
		error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
		logout: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`
	};
</script>

<div class="toast-container">
	{#each $toasts as toast (toast.id)}
		<div
			class="toast toast-{toast.type}"
			in:fly={{ y: -50, duration: 300 }}
			out:fade={{ duration: 200 }}
		>
			<div class="toast-content">
				<span class="toast-icon">{@html icons[toast.type] || icons.success}</span>
				<span class="toast-message">{toast.message}</span>
			</div>
			<div class="toast-progress"></div>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 25%; /* 75% up from the bottom */
		left: 50%;
		transform: translateX(-50%);
		z-index: 2147483647;
		display: flex;
		flex-direction: column;
		align-items: center; /* Center items for dynamic width */
		gap: 12px;
		pointer-events: none;
		width: 100%; /* Full width to allow centering */
	}

	.toast {
		/* Layout & Shape */
		display: flex;
		flex-direction: column; /* Stack content and progress bar */
		min-width: 300px;
		max-width: 90vw; /* Prevent screen overflow */
		width: fit-content;
		border-radius: 9999px; /* Perfect pill shape */
		overflow: hidden;
		pointer-events: auto;

		/* Base */
		background: #fff; /* Fallback */
		border: 1px solid rgba(255, 255, 255, 0.2);

		/* Typography */
		font-family: 'Outfit', 'Poppins', sans-serif;
		color: white;

		/* Shadows & Transition */
		box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.4);
		transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Type Specific Gradients (Restored) */
	.toast-success {
		background: linear-gradient(135deg, #00f260 0%, #0575e6 100%);
		box-shadow: 0 20px 60px -10px rgba(0, 242, 96, 0.4);
		border: none;
	}

	.toast-error {
		background: linear-gradient(135deg, #ff00cc 0%, #333399 100%);
		box-shadow: 0 20px 60px -10px rgba(255, 0, 204, 0.4);
		border: none;
	}

	.toast-logout {
		background: linear-gradient(135deg, #f12711 0%, #f5af19 100%);
		box-shadow: 0 20px 60px -10px rgba(245, 175, 25, 0.4);
		border: none;
	}

	.toast-content {
		display: flex;
		flex-direction: row; /* Ensure row layout */
		align-items: center;
		padding: 14px 24px;
		gap: 16px;
		white-space: nowrap;
	}

	.toast-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Icon Backgrounds */
	.toast-success .toast-icon,
	.toast-error .toast-icon,
	.toast-logout .toast-icon {
		background: rgba(255, 255, 255, 0.25);
		color: white;
	}

	.toast-message {
		font-weight: 500;
		font-size: 0.95rem;
		line-height: 1.4;
		color: white; /* Always white on gradients */
		text-align: left;
		white-space: nowrap; /* Force single line */
		overflow: hidden;
		text-overflow: ellipsis; /* ... if too long */
		max-width: 60vw; /* Limit width */
	}

	.toast-progress {
		height: 3px;
		width: 100%;
		background: rgba(255, 255, 255, 0.4); /* Simple white progress for gradients */
		transform-origin: left;
		animation: shrink 5s linear forwards;
		opacity: 0.7;
	}

	@keyframes shrink {
		from {
			transform: scaleX(1);
		}
		to {
			transform: scaleX(0);
		}
	}

	@media (max-width: 480px) {
		.toast {
			min-width: auto;
			width: 90%;
		}
	}
</style>

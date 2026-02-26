<script lang="ts">
	type StatusType = 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
	type BadgeSize = 'sm' | 'md' | 'lg';

	let {
		status,
		size = 'md',
		animated = false,
		dot = false
	}: {
		status: StatusType;
		size?: BadgeSize;
		animated?: boolean;
		dot?: boolean;
	} = $props();

	const labels: Record<StatusType, string> = {
		pending: 'Pending',
		confirmed: 'Confirmed',
		'in-progress': 'In Progress',
		completed: 'Completed',
		cancelled: 'Cancelled'
	};

	const icons: Record<StatusType, string> = {
		pending: '⏳',
		confirmed: '✓',
		'in-progress': '▶',
		completed: '✓',
		cancelled: '✕'
	};
</script>

{#if dot}
	<span class="status-dot {status}" class:pulse={animated && status === 'in-progress'}></span>
{:else}
	<span
		class="status-badge {status} size-{size}"
		class:pulse={animated && status === 'in-progress'}
	>
		<span class="badge-icon">{icons[status]}</span>
		{labels[status]}
	</span>
{/if}

<style>
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-radius: var(--s-radius-full, 9999px);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		line-height: 1.3;
		white-space: nowrap;
	}

	.badge-icon {
		font-size: 0.7em;
		line-height: 1;
	}

	/* Sizes */
	.size-sm {
		font-size: 0.6rem;
		padding: 2px 6px;
	}
	.size-md {
		font-size: 0.68rem;
	}
	.size-lg {
		font-size: 0.78rem;
		padding: 4px 12px;
	}

	/* Status Colors */
	.status-badge.pending {
		background: var(--s-pending);
		color: #ffffff;
	}
	.status-badge.confirmed {
		background: var(--s-confirmed);
		color: #ffffff;
	}
	.status-badge.in-progress {
		background: var(--s-in-progress);
		color: #ffffff;
	}
	.status-badge.completed {
		background: var(--s-completed);
		color: #ffffff;
	}
	.status-badge.cancelled {
		background: var(--s-cancelled);
		color: #ffffff;
	}

	/* Dot */
	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		position: relative;
	}

	.status-dot.pending {
		background: var(--s-pending);
		box-shadow: 0 0 0 3px var(--s-pending-bg);
	}
	.status-dot.confirmed {
		background: var(--s-confirmed);
		box-shadow: 0 0 0 3px var(--s-confirmed-bg);
	}
	.status-dot.in-progress {
		background: var(--s-in-progress);
		box-shadow: 0 0 0 3px var(--s-in-progress-bg);
	}
	.status-dot.completed {
		background: var(--s-completed);
		box-shadow: 0 0 0 3px var(--s-completed-bg);
	}
	.status-dot.cancelled {
		background: var(--s-cancelled);
		box-shadow: 0 0 0 3px var(--s-cancelled-bg);
	}

	/* Pulse animation for in-progress */
	.pulse {
		animation: statusPulse 2s ease-in-out infinite;
	}

	@keyframes statusPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>

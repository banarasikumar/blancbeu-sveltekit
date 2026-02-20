<script lang="ts">
	type SkeletonVariant = 'text' | 'card' | 'avatar' | 'stat' | 'button';

	let {
		variant = 'text',
		count = 1,
		width = '100%',
		height
	}: {
		variant?: SkeletonVariant;
		count?: number;
		width?: string;
		height?: string;
	} = $props();

	const defaults: Record<SkeletonVariant, { w: string; h: string }> = {
		text: { w: '100%', h: '14px' },
		card: { w: '100%', h: '80px' },
		avatar: { w: '44px', h: '44px' },
		stat: { w: '100%', h: '64px' },
		button: { w: '100%', h: '44px' }
	};

	let resolvedWidth = $derived(width || defaults[variant].w);
	let resolvedHeight = $derived(height || defaults[variant].h);
</script>

<div class="skeleton-group" class:inline={variant === 'avatar'}>
	{#each Array(count) as _, i}
		<div
			class="skeleton {variant}"
			style="width: {resolvedWidth}; height: {resolvedHeight}; animation-delay: {i * 100}ms"
		></div>
	{/each}
</div>

<style>
	.skeleton-group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.skeleton-group.inline {
		flex-direction: row;
		gap: 12px;
	}

	.skeleton {
		background: linear-gradient(
			90deg,
			var(--s-bg-tertiary, #eee) 25%,
			var(--s-surface-hover, #f5f5f5) 50%,
			var(--s-bg-tertiary, #eee) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: var(--s-radius-sm, 8px);
	}

	.skeleton.avatar {
		border-radius: 50%;
		flex-shrink: 0;
	}

	.skeleton.card {
		border-radius: var(--s-radius-lg, 16px);
	}

	.skeleton.stat {
		border-radius: var(--s-radius-md, 12px);
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>

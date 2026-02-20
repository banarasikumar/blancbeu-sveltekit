<script lang="ts">
	let {
		icon = '📭',
		title = 'Nothing here yet',
		description = '',
		actionLabel = '',
		onAction
	}: {
		icon?: string;
		title?: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
	} = $props();
</script>

<div class="empty-state s-anim-fade-up">
	<div class="empty-icon">{icon}</div>
	<h3 class="empty-title">{title}</h3>
	{#if description}
		<p class="empty-desc">{description}</p>
	{/if}
	{#if actionLabel && onAction}
		<button class="empty-action s-btn s-btn-outline s-btn-sm" onclick={onAction}>
			{actionLabel}
		</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--s-space-4xl, 40px) var(--s-space-xl, 20px);
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: var(--s-space-lg, 16px);
		animation: s-bounce 2s ease-in-out infinite;
	}

	.empty-title {
		margin: 0 0 var(--s-space-sm, 8px) 0;
		font-family: var(--s-font-display, 'Outfit', sans-serif);
		font-size: var(--s-text-lg, 1.1rem);
		font-weight: 600;
		color: var(--s-text-primary, #1c1c1e);
	}

	.empty-desc {
		margin: 0 0 var(--s-space-xl, 20px) 0;
		font-size: var(--s-text-sm, 0.8rem);
		color: var(--s-text-secondary, #6e6e73);
		max-width: 260px;
		line-height: 1.5;
	}

	.empty-action {
		margin-top: var(--s-space-sm, 8px);
	}
</style>

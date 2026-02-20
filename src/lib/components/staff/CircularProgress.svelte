<script lang="ts">
	let {
		progress = 0,
		size = 80,
		strokeWidth = 6,
		color = 'var(--s-accent)',
		trackColor = 'var(--s-border)',
		children
	}: {
		progress?: number;
		size?: number;
		strokeWidth?: number;
		color?: string;
		trackColor?: string;
		children?: import('svelte').Snippet;
	} = $props();

	let radius = $derived((size - strokeWidth) / 2);
	let circumference = $derived(2 * Math.PI * radius);
	let offset = $derived(
		circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference
	);
	let center = $derived(size / 2);
</script>

<div class="circular-progress" style="width: {size}px; height: {size}px;">
	<svg width={size} height={size} viewBox="0 0 {size} {size}">
		<!-- Track -->
		<circle
			cx={center}
			cy={center}
			r={radius}
			fill="none"
			stroke={trackColor}
			stroke-width={strokeWidth}
		/>
		<!-- Progress -->
		<circle
			class="progress-ring"
			cx={center}
			cy={center}
			r={radius}
			fill="none"
			stroke={color}
			stroke-width={strokeWidth}
			stroke-linecap="round"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			transform="rotate(-90 {center} {center})"
		/>
	</svg>
	{#if children}
		<div class="progress-content">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.circular-progress {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.circular-progress svg {
		display: block;
	}

	.progress-ring {
		transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.progress-content {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
	}
</style>

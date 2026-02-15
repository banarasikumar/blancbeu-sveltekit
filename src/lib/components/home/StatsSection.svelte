<script lang="ts">
	import { onMount } from 'svelte';

	let container: HTMLElement;
	let visible = false;

	const stats = [
		{
			value: 7,
			label: 'Months of Excellence',
			suffix: '+',
			desc: 'Serving the community with premium beauty treatments'
		},
		{
			value: 1000,
			label: 'Happy Clients',
			suffix: '+',
			desc: 'Thousands of satisfied customers every year'
		},
		{
			value: 50,
			label: 'Services Offered',
			suffix: '+',
			desc: 'Comprehensive beauty and wellness solutions'
		}
	];

	onMount(() => {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0].isIntersecting) {
				visible = true;
				// Trigger counter animation logic here if needed
			}
		});
		if (container) observer.observe(container);
	});
</script>

<section class="trust-section container section-padding" bind:this={container}>
	<div class="section-header">
		<h2 class="section-title">
			<span class="title-decoration">✨</span>
			Why Trust Blancbeu
			<span class="title-decoration">✨</span>
		</h2>
		<p class="section-subtitle">Trusted by thousands for premium beauty care</p>
	</div>

	<div class="stats-grid">
		{#each stats as stat}
			<div class="stat-card">
				<div class="number">
					{stat.value}{stat.suffix}
				</div>
				<div class="label">{stat.label}</div>
				<div class="desc">{stat.desc}</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.section-padding {
		padding-top: 60px;
		padding-bottom: 60px;
	}
	.section-header {
		text-align: center;
		margin-bottom: 40px;
	}
	.section-title {
		font-size: 2rem;
		margin-bottom: 8px;
		color: var(--color-text-primary);
		display: inline-flex;
		justify-content: center;
		gap: 10px;
	}
	.section-subtitle {
		color: var(--color-text-secondary);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
	}

	.stat-card {
		background: rgba(255, 255, 255, 0.03);
		border-radius: var(--radius-lg);
		padding: 30px;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition: transform 0.3s;
	}

	.stat-card:hover {
		transform: translateY(-5px);
		border-color: var(--color-accent-gold);
	}

	.number {
		font-family: var(--font-heading);
		font-size: 3rem;
		font-weight: 700;
		color: var(--color-accent-gold);
		margin-bottom: 10px;
		line-height: 1;
	}

	.label {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--color-text-primary);
		margin-bottom: 8px;
	}

	.desc {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
		line-height: 1.4;
	}
</style>

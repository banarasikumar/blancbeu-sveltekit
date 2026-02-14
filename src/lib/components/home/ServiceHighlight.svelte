<script lang="ts">
	import LazyImage from '$lib/components/ui/LazyImage.svelte';
	import { cart } from '$lib/stores/booking';
	import { goto } from '$app/navigation';
	import type { Service } from '$lib/stores/appData';
	import { Clock } from 'lucide-svelte';
	import { user } from '$lib/stores/auth';

	export let service: Service;

	function handleBook() {
		cart.add(service);
		if ($user) {
			goto('/booking');
		} else {
			goto('/login');
		}
	}

	function formatDuration(minutes: number): string {
		if (!minutes) return '';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;

		if (hours === 0) return `${mins} min`;
		if (mins === 0) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
		return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${mins} min`;
	}
</script>

<div class="service-card">
	<div class="image-container">
		<LazyImage
			src={service.image}
			alt={service.name}
			width="100%"
			height="180px"
			className="card-img"
		/>
		<div class="category-badge">{service.category}</div>
	</div>

	<div class="content">
		<div class="header">
			<h3>{service.name}</h3>
			<div class="duration">
				<Clock size={12} strokeWidth={2} />
				<span>{formatDuration(service.duration)}</span>
			</div>
		</div>

		<p class="desc">{service.description}</p>

		<div class="footer">
			<div class="price">
				<span class="curr">₹{service.price}</span>
				{#if service.originalPrice}
					<span class="orig">₹{service.originalPrice}</span>
				{/if}
			</div>
			<button class="book-btn" on:click={handleBook}>Book</button>
		</div>
	</div>
</div>

<style>
	.service-card {
		background: var(--color-bg-secondary);
		border-radius: var(--radius-md);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.05);
		transition:
			transform 0.3s ease,
			box-shadow 0.3s ease;
	}

	.service-card:active {
		transform: scale(0.98);
	}

	.image-container {
		position: relative;
	}

	.category-badge {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		color: white;
		font-size: 0.7rem;
		padding: 4px 8px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.content {
		padding: 16px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		flex: 1;
	}

	.duration {
		display: flex;
		align-items: center;
		gap: 3px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 500;
		background: rgba(255, 255, 255, 0.05);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.desc {
		font-size: 0.85rem;
		color: var(--color-text-secondary);
		margin-bottom: 16px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.price {
		display: flex;
		flex-direction: column;
	}

	.curr {
		font-weight: 700;
		color: var(--color-accent-gold);
		font-size: 1.1rem;
	}

	.orig {
		font-size: 0.75rem;
		text-decoration: line-through;
		color: var(--color-text-secondary);
	}

	.book-btn {
		background: var(--color-text-primary);
		color: var(--color-bg-primary);
		padding: 8px 20px;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: var(--radius-full);
		transition: opacity 0.2s;
	}

	.book-btn:hover {
		opacity: 0.9;
	}
</style>

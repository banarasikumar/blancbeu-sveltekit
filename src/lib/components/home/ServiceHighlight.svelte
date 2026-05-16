<script lang="ts">
	import LazyImage from '$lib/components/ui/LazyImage.svelte';
	import { cart } from '$lib/stores/booking';
	import { goto } from '$app/navigation';
	import type { Service } from '$lib/stores/appData';
	import { Clock, Wand2, Check, Plus } from 'lucide-svelte';
	import { user } from '$lib/stores/auth';
	import { tryOnPicker, tryOnPickerFull } from '$lib/stores/tryOnPicker';

	let { service, tryOnMode = false } = $props();

	let isSelected = $derived($tryOnPicker.selectedIds.includes(service.id));
	let isFull = $derived($tryOnPickerFull);

	function handleBook() {
		cart.add(service);
		if ($user) {
			goto('/booking');
		} else {
			goto('/login');
		}
	}

	function handleTryOnToggle() {
		if (isSelected) {
			tryOnPicker.removeService(service.id);
		} else if (!isFull) {
			tryOnPicker.addService({ name: service.name, id: service.id, price: service.price });
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

<div class="service-card" class:selected-for-tryon={tryOnMode && isSelected}>
	<div class="image-container">
		<LazyImage
			src={service.image}
			alt={service.name}
			width="100%"
			height="180px"
			className="card-img"
		/>
		<div class="category-badge">{service.category}</div>
		{#if !tryOnMode && service.category === 'Hair'}
			<button
				class="tryon-pill"
				onclick={(e) => {
					e.stopPropagation();
					goto(`/try-on?serviceId=${service.id}&serviceName=${encodeURIComponent(service.name)}`);
				}}
				title="Virtual Try-On"
			>
				<span>Try On</span>
				<div class="icon-circle"><Wand2 size={10} strokeWidth={3} /></div>
			</button>
		{/if}
		{#if tryOnMode && isSelected}
			<div class="selected-check"><Check size={16} strokeWidth={3} /></div>
		{/if}
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
			<div class="actions">
				{#if tryOnMode}
					<button
						class="tryon-add-btn"
						class:is-selected={isSelected}
						onclick={handleTryOnToggle}
						disabled={!isSelected && isFull}
					>
						{#if isSelected}
							<Check size={14} strokeWidth={3} /> Added
						{:else}
							<Plus size={14} strokeWidth={2.5} /> Add
						{/if}
					</button>
				{:else}
					<button class="book-btn" onclick={handleBook}>Book</button>
				{/if}
			</div>
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

	.tryon-pill {
		position: absolute;
		top: 8px;
		right: 8px;
		border: none;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(0, 0, 0, 0.1) 20%,
			rgba(0, 0, 0, 0.35) 100%
		);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		display: flex;
		align-items: center;
		height: 22px;
		gap: 4px;
		padding: 0 1px 0 8px;
		border-radius: 999px;
		cursor: pointer;
		z-index: 2;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow:
			0 4px 25px rgba(0, 0, 0, 0.4),
			0 0 15px rgba(0, 0, 0, 0.1);
	}

	.tryon-pill span {
		font-size: 0.55rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #fff;
		line-height: 1;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}

	.icon-circle {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: linear-gradient(135deg, #e040fb, #aa00ff, #d500f9);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 2px 10px rgba(170, 0, 255, 0.5),
			0 0 15px rgba(224, 64, 251, 0.2);
		flex-shrink: 0;
		margin-right: -1px;
	}

	.tryon-pill:active {
		transform: scale(0.94);
		background: rgba(170, 0, 255, 0.2);
	}

	.tryon-pill:hover .icon-circle {
		animation: iconPulse 1.5s ease-in-out infinite;
	}

	@keyframes iconPulse {
		0%,
		100% {
			transform: scale(1);
			box-shadow: 0 2px 6px rgba(170, 0, 255, 0.4);
		}
		50% {
			transform: scale(1.1);
			box-shadow: 0 2px 10px rgba(170, 0, 255, 0.6);
		}
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

	.actions {
		display: flex;
		gap: 8px;
		align-items: center;
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

	/* Try-On Picker Mode */
	.selected-for-tryon {
		border-color: rgba(212, 175, 55, 0.5);
		box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.3), 0 4px 16px rgba(212, 175, 55, 0.1);
	}

	.selected-check {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-accent-gold);
		color: #1a1a1a;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		z-index: 2;
	}

	.tryon-add-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 8px 16px;
		font-size: 0.78rem;
		font-weight: 700;
		border-radius: var(--radius-full);
		border: 1.5px solid rgba(212, 175, 55, 0.4);
		background: rgba(212, 175, 55, 0.08);
		color: var(--color-accent-gold);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tryon-add-btn:active {
		transform: scale(0.95);
	}

	.tryon-add-btn.is-selected {
		background: var(--color-accent-gold);
		color: #1a1a1a;
		border-color: var(--color-accent-gold);
	}

	.tryon-add-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
</style>

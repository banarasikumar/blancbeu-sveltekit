<script lang="ts">
	import { User, MapPin, CreditCard, Heart, ChevronRight, Calendar } from 'lucide-svelte';
	import { goto } from '$app/navigation';
</script>

<div class="quick-actions-panel glass-panel">
	<h3 class="panel-title">My Account</h3>

	<div class="actions-list">
		<button class="action-item" on:click={() => goto('/you/bookings')}>
			<div class="action-icon">
				<Calendar size={20} />
			</div>
			<div class="action-text">
				<span class="action-main">My Bookings</span>
				<span class="action-sub">View history & upcoming</span>
			</div>
			<ChevronRight size={16} class="action-arrow" />
		</button>

		<button class="action-item" on:click={() => goto('/you/personal-details')}>
			<div class="action-icon">
				<User size={20} />
			</div>
			<div class="action-text">
				<span class="action-main">Personal Details</span>
				<span class="action-sub">Edit name & information</span>
			</div>
			<ChevronRight size={16} class="action-arrow" />
		</button>

		<button class="action-item" on:click={() => goto('/you/addresses')}>
			<div class="action-icon">
				<MapPin size={20} />
			</div>
			<div class="action-text">
				<span class="action-main">Addresses</span>
				<span class="action-sub">Manage delivery addresses</span>
			</div>
			<ChevronRight size={16} class="action-arrow" />
		</button>

		<button class="action-item">
			<div class="action-icon">
				<CreditCard size={20} />
			</div>
			<div class="action-text">
				<span class="action-main">Payment Methods</span>
				<span class="action-sub">Save & manage cards</span>
			</div>
			<ChevronRight size={16} class="action-arrow" />
		</button>

		<button class="action-item">
			<div class="action-icon">
				<Heart size={20} />
			</div>
			<div class="action-text">
				<span class="action-main">Favorite Services</span>
				<span class="action-sub">Your preferred treatments</span>
			</div>
			<ChevronRight size={16} class="action-arrow" />
		</button>
	</div>
</div>

<style>
	.glass-panel {
		background: var(--color-bg-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.panel-title {
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: var(--color-text-primary);
		padding: 20px 20px 10px;
		margin: 0;
	}

	.actions-list {
		display: flex;
		flex-direction: column;
	}

	.action-item {
		display: flex;
		align-items: center;
		padding: 16px 20px;
		background: transparent;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		transition: background 0.2s;
		color: var(--color-text-primary);
	}

	.action-item:last-child {
		border-bottom: none;
	}

	.action-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.action-icon {
		width: 40px;
		height: 40px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 16px;
		color: var(--color-accent-gold);
	}

	.action-text {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.action-main {
		font-size: 1rem;
		font-weight: 500;
		margin-bottom: 2px;
	}

	.action-sub {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.action-arrow {
		color: var(--color-text-secondary);
		opacity: 0.5;
	}
</style>
